# backend/transfer.py
import hashlib
from datetime import datetime
from typing import Union
from datetime import UTC
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from model import User, AuditLog
from logger import logger


def _create_audit_log(
    db: Session,
    sender_id: int,
    receiver_id: int | None,
    amount: float,
    status: str,
    error_detail: str | None = None
) -> AuditLog:
    """
    Helper to create an audit log entry.
    Also adds hash chaining for tamper-evidence.
    """
    # Get the hash of the previous log entry (if any)
    last_log = (
        db.query(AuditLog.entry_hash)
        .order_by(AuditLog.id.desc())
        .first()
    )
    previous_hash = last_log[0] if last_log else None

    # Create deterministic hash of this entry's core data
    log_data = f"{sender_id}|{receiver_id or ''}|{amount}|{datetime.now(UTC).isoformat()}|{status}"
    if error_detail:
        log_data += f"|{error_detail}"
    
    entry_hash = hashlib.sha256(log_data.encode("utf-8")).hexdigest()

    audit_log = AuditLog(
        sender_id=sender_id,
        receiver_id=receiver_id,
        amount=amount,
        timestamp=datetime.now(UTC),
        status=status,
        previous_hash=previous_hash,
        entry_hash=entry_hash
    )
    db.add(audit_log)
    return audit_log


def transfer_funds(
    db: Session,
    sender_id: int,
    receiver_identifier: Union[str, int],
    amount: float
) -> User:

    if amount <= 0:
        _create_audit_log(
            db=db,
            sender_id=sender_id,
            receiver_id=None,
            amount=amount,
            status="FAILED",
            error_detail="Amount must be positive"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be positive"
        )

    if sender_id == receiver_identifier:
        _create_audit_log(
            db=db,
            sender_id=sender_id,
            receiver_id=None,
            amount=amount,
            status="FAILED",
            error_detail="Cannot transfer to yourself"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer to yourself"
        )

    # Lock sender
    sender = db.query(User).filter(User.id == sender_id).with_for_update().first()
    if not sender:
        _create_audit_log(
            db=db,
            sender_id=sender_id,
            receiver_id=None,
            amount=amount,
            status="FAILED",
            error_detail="Sender not found"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sender not found"
        )

    # Resolve receiver
    if isinstance(receiver_identifier, int) or (
        isinstance(receiver_identifier, str) and receiver_identifier.isdigit()
    ):
        receiver_id_to_lookup = int(receiver_identifier)
        receiver = (
            db.query(User)
            .filter(User.id == receiver_id_to_lookup)
            .with_for_update()
            .first()
        )
    else:
        receiver = (
            db.query(User)
            .filter(User.email == receiver_identifier)
            .with_for_update()
            .first()
        )

    if not receiver:
        _create_audit_log(
            db=db,
            sender_id=sender_id,
            receiver_id=None,
            amount=amount,
            status="FAILED",
            error_detail="Receiver not found"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receiver not found"
        )

    if sender.id == receiver.id:
        _create_audit_log(
            db=db,
            sender_id=sender_id,
            receiver_id=receiver.id,
            amount=amount,
            status="FAILED",
            error_detail="Self-transfer attempted"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer to yourself"
        )

    if sender.balance < amount:
        _create_audit_log(
            db=db,
            sender_id=sender_id,
            receiver_id=receiver.id,
            amount=amount,
            status="FAILED",
            error_detail="Insufficient balance"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient balance"
        )

    try:
        # Perform the transfer
        sender.balance -= amount
        receiver.balance += amount

        # Log successful transfer
        _create_audit_log(
            db=db,
            sender_id=sender_id,
            receiver_id=receiver.id,
            amount=amount,
            status="SUCCESS"
        )

        logger.info(
            f"Transfer successful: {sender_id} → {receiver.id} (${amount:.2f}) "
            f"| Receiver email: {receiver.email}"
        )

        return receiver  # Return receiver so API can send email to frontend

    except Exception as e:
        db.rollback()
        logger.error(f"Transfer failed unexpectedly: {e}")

        _create_audit_log(
            db=db,
            sender_id=sender_id,
            receiver_id=receiver.id,
            amount=amount,
            status="FAILED",
            error_detail="Server error during transfer"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transaction failed due to server error"
        )