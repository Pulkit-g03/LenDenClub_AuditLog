# view_audit_log.py
# Standalone script to read and display the audit_logs from app.db
# Run with: python view_audit_log.py

import sqlite3
from datetime import datetime
import os

DB_PATH = "app.db"  # Make sure this matches your database file name

def print_audit_log():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file '{DB_PATH}' not found.")
        print("Make sure this script is in the same folder as your backend app.db")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Allows accessing columns by name
        cursor = conn.cursor()

        # Query all audit logs, ordered by timestamp
        cursor.execute("""
            SELECT 
                id,
                sender_id,
                receiver_id,
                amount,
                timestamp,
                status,
                previous_hash,
                entry_hash
            FROM audit_logs
            ORDER BY timestamp DESC
        """)

        rows = cursor.fetchall()

        if not rows:
            print("No audit log entries found.")
            return

        print("=" * 100)
        print("AUDIT LOG - All Transactions (Success + Failures)")
        print("=" * 100)
        print(f"{'ID':<4} {'Timestamp':<24} {'Sender':<8} {'Receiver':<10} {'Amount':<12} {'Status':<15} {'Note'}")
        print("-" * 100)

        for row in rows:
            ts = datetime.fromisoformat(row['timestamp'].replace("Z", "+00:00")) if isinstance(row['timestamp'], str) else row['timestamp']
            timestamp_str = ts.strftime("%Y-%m-%d %H:%M:%S")

            sender = row['sender_id'] or "-"
            receiver = row['receiver_id'] or "-"
            amount = f"${row['amount']:.2f}" if row['amount'] is not None else "-"
            status = row['status']

            # Optional: highlight failures
            status_display = f"\033[91m{status}\033[0m" if "FAILED" in status else f"\033[92m{status}\033[0m"

            note = ""
            if row['previous_hash'] and row['entry_hash']:
                note = " (Hash chained)"

            print(f"{row['id']:<4} {timestamp_str:<24} {sender:<8} {receiver:<10} {amount:<12} {status_display:<15} {note}")

        print("-" * 100)
        print(f"Total entries: {len(rows)}")
        print("\nTip: Green = SUCCESS, Red = FAILED")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    print_audit_log()