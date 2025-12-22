
from sqlalchemy.orm import Session
from datetime import datetime
from model import User, AuditLog
from fastapi import HTTPException
from logger import logger


def transfer_funds(
    db: Session,
    sender_id: int,
    receiver_identifier: str | int,  # Can be email (str) or user ID (int/str numeric)
    amount: float
) -> bool:
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    if sender_id == receiver_identifier:  # Works for both int and str (if same email somehow, but unlikely)
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")

    # Lock sender row first
    sender = (
        db.query(User)
        .filter(User.id == sender_id)
        .with_for_update()
        .first()
    )

    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    # Resolve receiver: try as ID first, then as email
    if isinstance(receiver_identifier, int) or (isinstance(receiver_identifier, str) and receiver_identifier.isdigit()):
        receiver_id_to_lookup = int(receiver_identifier)
        receiver = (
            db.query(User)
            .filter(User.id == receiver_id_to_lookup)
            .with_for_update()
            .first()
        )
    else:
        # Assume it's an email
        receiver = (
            db.query(User)
            .filter(User.email == receiver_identifier)
            .with_for_update()
            .first()
        )

    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    # Prevent self-transfer in case email matches sender's email
    if sender.id == receiver.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")

    if sender.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    try:
        # Perform balance updates
        sender.balance -= amount
        receiver.balance += amount

        # Create audit log entry
        audit_log = AuditLog(
            sender_id=sender_id,
            receiver_id=receiver.id,  # Always store the actual user ID
            amount=amount,
            timestamp=datetime.utcnow(),
            status="SUCCESS"
        )
        db.add(audit_log)

        return True
    except Exception as e:
        logger.error(f"Transfer failed: {e}")
        db.rollback()  #  rollback everything
        raise HTTPException(status_code=500, detail="Transaction failed")