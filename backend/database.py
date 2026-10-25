"""
database.py — PostgreSQL (Supabase) database access layer for FinPath AI.

Connection strategy:
  - Backend-only access using the service-role key (or anon key with RLS disabled).
  - All authorization is enforced in application code via get_current_user().
  - Row Level Security is NOT required because no browser client ever calls
    Supabase directly; every request goes through this FastAPI backend.
  - The service-role key must NEVER be exposed to the frontend.

Driver: psycopg2 (synchronous, compatible with existing FastAPI sync routes).
Connection pooling: simple reconnect-on-use pattern (suitable for low-medium concurrency).
"""

import json
import os
import psycopg2
import psycopg2.extras
from datetime import datetime
from typing import Optional, Dict, Any, List
from config import settings


# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def _build_dsn() -> str:
    """Build a libpq DSN from SUPABASE_DB_URL (preferred) or individual parts."""
    if settings.SUPABASE_DB_URL:
        return settings.SUPABASE_DB_URL
    raise RuntimeError(
        "SUPABASE_DB_URL is not set. "
        "Add it to your .env file. See .env.example for details."
    )


def get_connection():
    """
    Return a new psycopg2 connection with DictCursor row factory.
    Callers are responsible for closing the connection (or using a context manager).
    """
    dsn = _build_dsn()
    conn = psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    return conn


# ---------------------------------------------------------------------------
# Schema creation
# ---------------------------------------------------------------------------

_CREATE_SCHEMA_SQL = """
-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name   TEXT NOT NULL,
    role        TEXT DEFAULT 'user',
    created_at  TEXT NOT NULL
);

-- 2. Financial Journeys
CREATE TABLE IF NOT EXISTS journeys (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    journey_type    TEXT NOT NULL,
    current_step    INTEGER DEFAULT 1,
    total_steps     INTEGER DEFAULT 5,
    status          TEXT DEFAULT 'in_progress',
    target_amount   DOUBLE PRECISION DEFAULT 0,
    data_json       TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- 3. Affordability Records
CREATE TABLE IF NOT EXISTS affordability_records (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id),
    monthly_income      DOUBLE PRECISION NOT NULL,
    monthly_expenses    DOUBLE PRECISION NOT NULL,
    existing_emi        DOUBLE PRECISION NOT NULL,
    requested_amount    DOUBLE PRECISION NOT NULL,
    interest_rate       DOUBLE PRECISION NOT NULL,
    tenure_months       INTEGER NOT NULL,
    calculated_emi      DOUBLE PRECISION NOT NULL,
    dti_ratio           DOUBLE PRECISION NOT NULL,
    max_loan_eligible   DOUBLE PRECISION NOT NULL,
    created_at          TEXT NOT NULL
);

-- 4. Documents
CREATE TABLE IF NOT EXISTS documents (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id),
    journey_id              TEXT,
    file_name               TEXT NOT NULL,
    file_type               TEXT NOT NULL,
    file_size               INTEGER NOT NULL,
    file_path               TEXT,
    extracted_data_json     TEXT DEFAULT '{}',
    missing_fields_json     TEXT DEFAULT '[]',
    summary                 TEXT,
    confidence_score        DOUBLE PRECISION DEFAULT 0.95,
    status                  TEXT DEFAULT 'verified',
    created_at              TEXT NOT NULL
);

-- 5. Insurance Analyses
CREATE TABLE IF NOT EXISTS insurance_analyses (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id),
    policy_name             TEXT NOT NULL,
    policy_type             TEXT NOT NULL,
    sum_insured             DOUBLE PRECISION NOT NULL,
    key_coverages_json      TEXT DEFAULT '[]',
    exclusions_json         TEXT DEFAULT '[]',
    waiting_periods_json    TEXT DEFAULT '[]',
    copay_clause            TEXT,
    room_rent_clause        TEXT,
    source_truth_score      DOUBLE PRECISION DEFAULT 0.98,
    unverified_clauses_json TEXT DEFAULT '[]',
    summary                 TEXT,
    created_at              TEXT NOT NULL
);

-- 6. Copilot Conversations
CREATE TABLE IF NOT EXISTS copilot_conversations (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    messages_json TEXT DEFAULT '[]',
    updated_at  TEXT NOT NULL
);
"""


def init_db():
    """Create tables (idempotent) and seed demo data."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    conn = get_connection()
    try:
        cursor = conn.cursor()
        # Execute each statement individually to avoid issues with psycopg2
        # splitting on semicolons inside strings
        statements = [
            s.strip() for s in _CREATE_SCHEMA_SQL.split(";") if s.strip()
        ]
        for stmt in statements:
            cursor.execute(stmt)
        conn.commit()
    finally:
        conn.close()

    seed_demo_data()


# ---------------------------------------------------------------------------
# Demo data seeding (idempotent)
# ---------------------------------------------------------------------------

def seed_demo_data():
    """
    Seed the demo user and associated records.
    Uses ON CONFLICT DO NOTHING / existence checks to be safe on repeated runs.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()

        # Check if demo user already exists
        cursor.execute(
            "SELECT id FROM users WHERE email = %s", ("demo@finpath.ai",)
        )
        if cursor.fetchone():
            # Demo user present — nothing to do
            return

        demo_user_id = "usr_demo_finpath_001"
        from auth import get_password_hash
        pwd_hash = get_password_hash("Password123!")
        now = datetime.utcnow().isoformat()

        # Insert demo user
        cursor.execute(
            """INSERT INTO users (id, email, password_hash, full_name, role, created_at)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO NOTHING""",
            (demo_user_id, "demo@finpath.ai", pwd_hash, "Arjun Mehta", "user", now)
        )

        # Journey 1 — Home Loan
        journey_1_data = json.dumps({
            "property_city": "Bengaluru",
            "property_type": "2 BHK Apartment",
            "estimated_cost": 7500000,
            "downpayment": 2000000,
            "tenure_years": 20,
            "interest_rate": 8.5,
            "steps": [
                {"step": 1, "title": "Financial Profiling & Goal Setting", "status": "completed", "completed_at": "2026-10-20"},
                {"step": 2, "title": "FOIR & Loan Affordability Check", "status": "completed", "completed_at": "2026-10-22"},
                {"step": 3, "title": "Income & Property Documents Ingestion", "status": "in_progress", "completed_at": None},
                {"step": 4, "title": "AI Underwriting & Credit Risk Assessment", "status": "pending", "completed_at": None},
                {"step": 5, "title": "Sanction Letter & Digital Disbursement", "status": "pending", "completed_at": None}
            ],
            "checklist": [
                {"id": "chk_1", "label": "Last 3 Months Salary Slips", "done": True, "doc_id": "doc_sal_01"},
                {"id": "chk_2", "label": "6 Months Bank Account Statement", "done": True, "doc_id": "doc_bank_01"},
                {"id": "chk_3", "label": "Form 16 / Latest ITR V Filing", "done": True, "doc_id": "doc_itr_01"},
                {"id": "chk_4", "label": "Property Sale Agreement / Allotment Letter", "done": False, "doc_id": None},
                {"id": "chk_5", "label": "KYC Document (Aadhaar / PAN Card)", "done": True, "doc_id": "doc_kyc_01"}
            ]
        })

        cursor.execute(
            """INSERT INTO journeys (id, user_id, title, journey_type, current_step, total_steps, status,
                                     target_amount, data_json, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO NOTHING""",
            ("jrn_home_loan_7701", demo_user_id, "Dream Home Acquisition Loan",
             "home_loan", 3, 5, "in_progress", 5500000.0, journey_1_data, now, now)
        )

        # Journey 2 — Health Insurance
        journey_2_data = json.dumps({
            "members_covered": "Self, Spouse, 1 Child",
            "sum_insured": 1500000,
            "steps": [
                {"step": 1, "title": "Coverage Gap & Need Assessment", "status": "completed", "completed_at": "2026-10-23"},
                {"step": 2, "title": "Policy Document Analysis & Comparison", "status": "in_progress", "completed_at": None},
                {"step": 3, "title": "Medical History & Waiting Period Review", "status": "pending", "completed_at": None},
                {"step": 4, "title": "Final Policy Activation & E-Card Issuance", "status": "pending", "completed_at": None}
            ],
            "checklist": [
                {"id": "chk_ins_1", "label": "Existing Corporate Health Policy PDF", "done": True, "doc_id": "doc_policy_01"},
                {"id": "chk_ins_2", "label": "Pre-existing Medical Condition Self-Declaration", "done": False, "doc_id": None},
                {"id": "chk_ins_3", "label": "Family KYC Identification", "done": True, "doc_id": "doc_kyc_01"}
            ]
        })

        cursor.execute(
            """INSERT INTO journeys (id, user_id, title, journey_type, current_step, total_steps, status,
                                     target_amount, data_json, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO NOTHING""",
            ("jrn_health_shield_9902", demo_user_id, "Comprehensive Family Health Cover",
             "health_insurance", 2, 4, "in_progress", 1500000.0, journey_2_data, now, now)
        )

        # Affordability record
        cursor.execute(
            """INSERT INTO affordability_records
               (id, user_id, monthly_income, monthly_expenses, existing_emi, requested_amount,
                interest_rate, tenure_months, calculated_emi, dti_ratio, max_loan_eligible, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO NOTHING""",
            ("aff_demo_001", demo_user_id, 145000.0, 48000.0, 18500.0, 5500000.0,
             8.5, 240, 47703.0, 45.65, 5850000.0, now)
        )

        # Documents
        docs = [
            (
                "doc_sal_01", demo_user_id, "jrn_home_loan_7701",
                "Salary_Slip_September_2026.pdf", "application/pdf", 142850,
                json.dumps({
                    "employer_name": "Infosys Technologies Ltd",
                    "employee_name": "Arjun Mehta",
                    "designation": "Lead System Architect",
                    "gross_salary": 160000.0,
                    "net_pay": 145000.0,
                    "provident_fund": 9000.0,
                    "tax_deducted": 6000.0,
                    "pay_period": "September 2026"
                }),
                json.dumps([]),
                "Verified salary slip with consistent net salary of ₹1,45,000 and valid PF/Tax deductions.",
                0.98, "verified", now
            ),
            (
                "doc_bank_01", demo_user_id, "jrn_home_loan_7701",
                "HDFC_Salary_Account_6M.pdf", "application/pdf", 485210,
                json.dumps({
                    "bank_name": "HDFC Bank Ltd",
                    "account_holder": "Arjun Mehta",
                    "account_number": "XXXX-XXXX-4921",
                    "ifsc_code": "HDFC0001234",
                    "average_monthly_balance": 82450.0,
                    "regular_salary_credit": 145000.0,
                    "bounce_count": 0,
                    "existing_emi_debit": 18500.0
                }),
                json.dumps([]),
                "6-Month Bank statement reflects pristine track record with zero bounces.",
                0.96, "verified", now
            ),
            (
                "doc_policy_01", demo_user_id, "jrn_health_shield_9902",
                "Care_Plus_Policy_Schedule.pdf", "application/pdf", 312400,
                json.dumps({
                    "insurer": "Care Health Insurance",
                    "policy_number": "CH-2026-884920",
                    "plan_name": "Care Supreme 15L",
                    "sum_insured": 1500000.0,
                    "cumulative_bonus": 300000.0
                }),
                json.dumps(["Nominee PAN confirmation"]),
                "Current health coverage schedule verified for ₹15,00,000 sum insured.",
                0.94, "verified", now
            )
        ]

        for d in docs:
            cursor.execute(
                """INSERT INTO documents
                   (id, user_id, journey_id, file_name, file_type, file_size,
                    extracted_data_json, missing_fields_json, summary, confidence_score, status, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO NOTHING""",
                d
            )

        # Insurance analysis
        cursor.execute(
            """INSERT INTO insurance_analyses
               (id, user_id, policy_name, policy_type, sum_insured, key_coverages_json,
                exclusions_json, waiting_periods_json, copay_clause, room_rent_clause,
                source_truth_score, unverified_clauses_json, summary, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO NOTHING""",
            (
                "ins_ana_001", demo_user_id, "Care Supreme Comprehensive Health Policy",
                "Health", 1500000.0,
                json.dumps([
                    "In-patient Hospitalization covered up to Sum Insured (₹15,00,000)",
                    "Pre-hospitalization medical expenses covered up to 60 days",
                    "Post-hospitalization medical expenses covered up to 180 days",
                    "Day Care Treatments covered for all 540+ medical procedures",
                    "Unlimited Automatic Recharge of Sum Insured once exhausted",
                    "Organ Donor Hospitalization Expenses covered up to full Sum Insured"
                ]),
                json.dumps([
                    "Cosmetic, plastic surgery, or aesthetic treatments excluded",
                    "Obesity control and weight reduction surgical programs excluded",
                    "Self-inflicted injuries or dangerous adventure sports injuries excluded",
                    "Non-prescription vitamins, dietary supplements excluded"
                ]),
                json.dumps([
                    {"duration": "30 Days", "applies_to": "Initial waiting period for all non-accidental illnesses", "clause_ref": "Section 4.1"},
                    {"duration": "24 Months", "applies_to": "Specific listed ailments (Hernia, Cataract, Joint Replacement, Kidney Stones)", "clause_ref": "Section 4.2"},
                    {"duration": "36 Months", "applies_to": "Pre-existing Diseases (PED) declared at inception", "clause_ref": "Section 4.3"}
                ]),
                "No Co-payment clause applicable for network hospitals for entry age under 60 years.",
                "Single Private AC Room without any proportional deduction cap.",
                0.97,
                json.dumps(["OPD dental coverage reimbursement requires additional premium rider endorsement."]),
                "The Care Supreme policy offers robust cashless coverage with zero room rent capping and automatic sum insured recharge.",
                now
            )
        )

        conn.commit()
    finally:
        conn.close()
