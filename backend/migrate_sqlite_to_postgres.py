"""
migrate_sqlite_to_postgres.py
------------------------------
One-shot data migration: copies all existing records from the local SQLite
database (finpath.db) into the Supabase PostgreSQL database.

Prerequisites:
  1. SUPABASE_DB_URL is set in your .env file (see .env.example).
  2. The PostgreSQL schema has been created by running the FastAPI app once
     (init_db() runs automatically on startup and creates all tables).
  3. Run this script ONCE from the backend directory:
       python migrate_sqlite_to_postgres.py

Safety guarantees:
  - Uses INSERT ... ON CONFLICT DO NOTHING for every table.
    Re-running the script is safe; no duplicate rows will be created.
  - The original SQLite file is NOT deleted or modified.
  - A dry-run option is available: set DRY_RUN = True below.
"""

import json
import sqlite3
import sys
import os

# ---- configuration ----
DRY_RUN = False          # Set True to preview counts without writing to Postgres
SQLITE_PATH = "finpath.db"
# -----------------------

# Ensure the parent directory is on sys.path so we can import config/database
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from config import settings

if not settings.SUPABASE_DB_URL:
    print("ERROR: SUPABASE_DB_URL is not set in your .env file.")
    print("       See .env.example for instructions.")
    sys.exit(1)

import psycopg2
import psycopg2.extras


def sqlite_rows(sqlite_conn, table: str):
    cur = sqlite_conn.cursor()
    cur.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def migrate():
    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Connecting to SQLite: {SQLITE_PATH}")
    sq_conn = sqlite3.connect(SQLITE_PATH)

    print(f"Connecting to PostgreSQL: {settings.SUPABASE_DB_URL[:40]}...")
    pg_conn = psycopg2.connect(
        settings.SUPABASE_DB_URL,
        cursor_factory=psycopg2.extras.RealDictCursor
    )
    pg_conn.autocommit = False
    pg_cur = pg_conn.cursor()

    tables_order = [
        "users",
        "journeys",
        "affordability_records",
        "documents",
        "insurance_analyses",
        "copilot_conversations",
    ]

    # Column definitions for each table (matches database.py schema)
    insert_sql = {
        "users": """
            INSERT INTO users (id, email, password_hash, full_name, role, created_at)
            VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
        "journeys": """
            INSERT INTO journeys (id, user_id, title, journey_type, current_step, total_steps,
                                  status, target_amount, data_json, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
        "affordability_records": """
            INSERT INTO affordability_records (id, user_id, monthly_income, monthly_expenses,
                existing_emi, requested_amount, interest_rate, tenure_months,
                calculated_emi, dti_ratio, max_loan_eligible, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
        "documents": """
            INSERT INTO documents (id, user_id, journey_id, file_name, file_type, file_size,
                file_path, extracted_data_json, missing_fields_json, summary,
                confidence_score, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
        "insurance_analyses": """
            INSERT INTO insurance_analyses (id, user_id, policy_name, policy_type, sum_insured,
                key_coverages_json, exclusions_json, waiting_periods_json, copay_clause,
                room_rent_clause, source_truth_score, unverified_clauses_json, summary, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
        "copilot_conversations": """
            INSERT INTO copilot_conversations (id, user_id, messages_json, updated_at)
            VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
    }

    col_order = {
        "users": ["id", "email", "password_hash", "full_name", "role", "created_at"],
        "journeys": ["id", "user_id", "title", "journey_type", "current_step", "total_steps",
                     "status", "target_amount", "data_json", "created_at", "updated_at"],
        "affordability_records": ["id", "user_id", "monthly_income", "monthly_expenses",
                                  "existing_emi", "requested_amount", "interest_rate",
                                  "tenure_months", "calculated_emi", "dti_ratio",
                                  "max_loan_eligible", "created_at"],
        "documents": ["id", "user_id", "journey_id", "file_name", "file_type", "file_size",
                      "file_path", "extracted_data_json", "missing_fields_json", "summary",
                      "confidence_score", "status", "created_at"],
        "insurance_analyses": ["id", "user_id", "policy_name", "policy_type", "sum_insured",
                               "key_coverages_json", "exclusions_json", "waiting_periods_json",
                               "copay_clause", "room_rent_clause", "source_truth_score",
                               "unverified_clauses_json", "summary", "created_at"],
        "copilot_conversations": ["id", "user_id", "messages_json", "updated_at"],
    }

    total_migrated = 0

    for table in tables_order:
        try:
            rows = sqlite_rows(sq_conn, table)
        except sqlite3.OperationalError:
            print(f"  [{table}] table not found in SQLite — skipping.")
            continue

        print(f"  [{table}] found {len(rows)} rows in SQLite")
        if DRY_RUN or not rows:
            continue

        cols = col_order[table]
        sql = insert_sql[table]
        inserted = 0

        for row in rows:
            values = tuple(row.get(c) for c in cols)
            try:
                pg_cur.execute(sql, values)
                if pg_cur.rowcount > 0:
                    inserted += 1
            except Exception as e:
                print(f"    WARNING: skipped row id={row.get('id')}: {e}")
                pg_conn.rollback()
                # Re-acquire cursor after rollback
                pg_cur = pg_conn.cursor()

        pg_conn.commit()
        print(f"  [{table}] inserted {inserted} new rows (skipped {len(rows) - inserted} duplicates)")
        total_migrated += inserted

    sq_conn.close()
    pg_conn.close()

    if DRY_RUN:
        print("\n[DRY RUN] No data was written. Set DRY_RUN = False to run the real migration.")
    else:
        print(f"\nMigration complete. {total_migrated} total rows migrated to PostgreSQL.")
        print("Your SQLite file has NOT been deleted. Keep it as a backup.")


if __name__ == "__main__":
    migrate()
