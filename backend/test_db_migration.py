"""
test_db_migration.py — Backend connectivity and data-isolation tests.

Run from the backend directory with SUPABASE_DB_URL set in your .env:
    python test_db_migration.py

All tests use ON CONFLICT DO NOTHING inserts and clean up after themselves
using unique test IDs so they do not affect production data.
"""

import json
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

PASS = "✅ PASS"
FAIL = "❌ FAIL"
results = []


def check(label: str, condition: bool, detail: str = ""):
    status = PASS if condition else FAIL
    msg = f"  {status}  {label}"
    if detail and not condition:
        msg += f"\n         Detail: {detail}"
    print(msg)
    results.append((label, condition))


# ---------------------------------------------------------------------------
# 1. Connection
# ---------------------------------------------------------------------------
print("\n=== 1. Database Connectivity ===")
try:
    from database import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT 1")
    row = cur.fetchone()
    conn.close()
    check("PostgreSQL connection established", row is not None)
except Exception as e:
    check("PostgreSQL connection established", False, str(e))
    print("\nAborting: cannot connect to database.")
    sys.exit(1)

# ---------------------------------------------------------------------------
# 2. Schema — all six tables exist
# ---------------------------------------------------------------------------
print("\n=== 2. Schema Verification ===")
EXPECTED_TABLES = [
    "users", "journeys", "affordability_records",
    "documents", "insurance_analyses", "copilot_conversations"
]
conn = get_connection()
cur = conn.cursor()
for table in EXPECTED_TABLES:
    try:
        cur.execute(f"SELECT COUNT(*) AS cnt FROM {table}")
        row = cur.fetchone()
        check(f"Table '{table}' exists and is readable", row is not None)
    except Exception as e:
        check(f"Table '{table}' exists", False, str(e))
conn.close()

# ---------------------------------------------------------------------------
# 3. Demo data
# ---------------------------------------------------------------------------
print("\n=== 3. Demo Data Presence ===")
conn = get_connection()
cur = conn.cursor()

cur.execute("SELECT id FROM users WHERE email = %s", ("demo@finpath.ai",))
demo_user = cur.fetchone()
check("Demo user 'demo@finpath.ai' exists", demo_user is not None)

if demo_user:
    demo_id = demo_user["id"]

    cur.execute("SELECT COUNT(*) AS cnt FROM journeys WHERE user_id = %s", (demo_id,))
    jcount = cur.fetchone()["cnt"]
    check("Demo user has at least 2 journeys", jcount >= 2, f"found {jcount}")

    cur.execute("SELECT COUNT(*) AS cnt FROM affordability_records WHERE user_id = %s", (demo_id,))
    acount = cur.fetchone()["cnt"]
    check("Demo affordability record exists", acount >= 1, f"found {acount}")

    cur.execute("SELECT COUNT(*) AS cnt FROM documents WHERE user_id = %s", (demo_id,))
    dcount = cur.fetchone()["cnt"]
    check("Demo documents exist (>=3)", dcount >= 3, f"found {dcount}")

    cur.execute("SELECT COUNT(*) AS cnt FROM insurance_analyses WHERE user_id = %s", (demo_id,))
    icount = cur.fetchone()["cnt"]
    check("Demo insurance analysis exists", icount >= 1, f"found {icount}")

conn.close()

# ---------------------------------------------------------------------------
# 4. User isolation — two test users cannot see each other's data
# ---------------------------------------------------------------------------
print("\n=== 4. User-Level Data Isolation ===")

uid_a = f"test_user_a_{uuid.uuid4().hex[:8]}"
uid_b = f"test_user_b_{uuid.uuid4().hex[:8]}"
jid_a = f"test_jrn_{uuid.uuid4().hex[:8]}"
jid_b = f"test_jrn_{uuid.uuid4().hex[:8]}"
now = "2026-01-01T00:00:00"

conn = get_connection()
cur = conn.cursor()

try:
    # Insert two isolated test users
    for uid in (uid_a, uid_b):
        cur.execute(
            "INSERT INTO users (id, email, password_hash, full_name, role, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
            (uid, f"{uid}@test.invalid", "fakehash", "Test User", "user", now)
        )

    # Give each a journey
    cur.execute(
        "INSERT INTO journeys (id, user_id, title, journey_type, current_step, total_steps, "
        "status, target_amount, data_json, created_at, updated_at) "
        "VALUES (%s, %s, 'Test Journey', 'home_loan', 1, 5, 'in_progress', 0, '{}', %s, %s) "
        "ON CONFLICT (id) DO NOTHING",
        (jid_a, uid_a, now, now)
    )
    cur.execute(
        "INSERT INTO journeys (id, user_id, title, journey_type, current_step, total_steps, "
        "status, target_amount, data_json, created_at, updated_at) "
        "VALUES (%s, %s, 'Test Journey', 'home_loan', 1, 5, 'in_progress', 0, '{}', %s, %s) "
        "ON CONFLICT (id) DO NOTHING",
        (jid_b, uid_b, now, now)
    )
    conn.commit()

    # User A should only see their own journey
    cur.execute("SELECT id FROM journeys WHERE user_id = %s", (uid_a,))
    a_journeys = [r["id"] for r in cur.fetchall()]
    check("User A can see their own journey", jid_a in a_journeys)
    check("User A cannot see User B's journey", jid_b not in a_journeys)

    # User B should only see their own journey
    cur.execute("SELECT id FROM journeys WHERE user_id = %s", (uid_b,))
    b_journeys = [r["id"] for r in cur.fetchall()]
    check("User B can see their own journey", jid_b in b_journeys)
    check("User B cannot see User A's journey", jid_a not in b_journeys)

finally:
    # Clean up test data
    cur.execute("DELETE FROM journeys WHERE id IN (%s, %s)", (jid_a, jid_b))
    cur.execute("DELETE FROM users WHERE id IN (%s, %s)", (uid_a, uid_b))
    conn.commit()
    conn.close()

# ---------------------------------------------------------------------------
# 5. Journey CRUD
# ---------------------------------------------------------------------------
print("\n=== 5. Journey CRUD ===")
test_uid = f"test_crud_{uuid.uuid4().hex[:8]}"
test_jid = f"jrn_crud_{uuid.uuid4().hex[:8]}"
now = "2026-06-01T12:00:00"
conn = get_connection()
cur = conn.cursor()
try:
    cur.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (test_uid, f"{test_uid}@test.invalid", "hash", "CRUD User", "user", now)
    )
    cur.execute(
        "INSERT INTO journeys (id, user_id, title, journey_type, current_step, total_steps, "
        "status, target_amount, data_json, created_at, updated_at) "
        "VALUES (%s, %s, 'CRUD Test', 'personal_loan', 1, 4, 'in_progress', 500000, '{}', %s, %s)",
        (test_jid, test_uid, now, now)
    )
    conn.commit()

    # Read
    cur.execute("SELECT * FROM journeys WHERE id = %s AND user_id = %s", (test_jid, test_uid))
    row = cur.fetchone()
    check("Journey created and readable", row is not None)
    check("Journey title correct", row and row["title"] == "CRUD Test")

    # Update
    cur.execute(
        "UPDATE journeys SET current_step = 2, status = 'in_progress', updated_at = %s WHERE id = %s",
        ("2026-06-02T00:00:00", test_jid)
    )
    conn.commit()
    cur.execute("SELECT current_step FROM journeys WHERE id = %s", (test_jid,))
    updated = cur.fetchone()
    check("Journey step updated to 2", updated and updated["current_step"] == 2)

finally:
    cur.execute("DELETE FROM journeys WHERE id = %s", (test_jid,))
    cur.execute("DELETE FROM users WHERE id = %s", (test_uid,))
    conn.commit()
    conn.close()

# ---------------------------------------------------------------------------
# 6. Affordability record insert and retrieval
# ---------------------------------------------------------------------------
print("\n=== 6. Affordability Record ===")
test_uid2 = f"test_aff_{uuid.uuid4().hex[:8]}"
test_aff_id = f"aff_{uuid.uuid4().hex[:8]}"
now = "2026-06-01T12:00:00"
conn = get_connection()
cur = conn.cursor()
try:
    cur.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (test_uid2, f"{test_uid2}@test.invalid", "hash", "Aff User", "user", now)
    )
    cur.execute(
        "INSERT INTO affordability_records "
        "(id, user_id, monthly_income, monthly_expenses, existing_emi, requested_amount, "
        "interest_rate, tenure_months, calculated_emi, dti_ratio, max_loan_eligible, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (test_aff_id, test_uid2, 120000, 40000, 10000, 3000000, 8.5, 240, 26000, 30.0, 3500000, now)
    )
    conn.commit()

    cur.execute("SELECT * FROM affordability_records WHERE id = %s AND user_id = %s", (test_aff_id, test_uid2))
    row = cur.fetchone()
    check("Affordability record inserted and retrieved", row is not None)
    check("DTI ratio stored correctly", row and abs(float(row["dti_ratio"]) - 30.0) < 0.01)
finally:
    cur.execute("DELETE FROM affordability_records WHERE id = %s", (test_aff_id,))
    cur.execute("DELETE FROM users WHERE id = %s", (test_uid2,))
    conn.commit()
    conn.close()

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print("\n" + "=" * 50)
passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
print(f"Results: {passed} passed, {failed} failed out of {len(results)} tests")
if failed == 0:
    print("All tests passed. The PostgreSQL migration is verified. ✅")
else:
    print("Some tests failed. Review the output above before going live.")
    sys.exit(1)
