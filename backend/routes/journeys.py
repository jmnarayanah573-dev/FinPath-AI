from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uuid
import json
from datetime import datetime
from database import get_connection
from auth import get_current_user

router = APIRouter(prefix="/journeys", tags=["Financial Journey Tracker & AI Workflows"])

class CreateJourneyRequest(BaseModel):
    title: str
    journey_type: str # "home_loan", "personal_loan", "health_insurance", "term_life"
    target_amount: float
    metadata: Optional[Dict[str, Any]] = None

class StepUpdateRequest(BaseModel):
    target_step: int
    step_data: Optional[Dict[str, Any]] = None

class ChecklistToggleRequest(BaseModel):
    checklist_id: str
    done: bool

JOURNEY_TEMPLATES = {
    "home_loan": {
        "title": "Home Loan Acquisition Journey",
        "total_steps": 5,
        "steps": [
            {"step": 1, "title": "Financial Profiling & Goal Setting", "description": "Define target property budget, downpayment, and city requirements."},
            {"step": 2, "title": "FOIR & Affordability Check", "description": "Calculate debt-to-income balance and establish safe monthly EMI limits."},
            {"step": 3, "title": "Income & Property Documents Ingestion", "description": "Upload salary slips, 6-month bank statements, and sale agreement."},
            {"step": 4, "title": "AI Underwriting & Credit Risk Assessment", "description": "Simulate bank credit policies, CIBIL benchmarks, and title clearances."},
            {"step": 5, "title": "Digital In-Principle Sanction Approval", "description": "Generate pre-approved sanction certificate and disbursement roadmap."}
        ],
        "checklist": [
            {"id": "chk_1", "label": "Last 3 Months Salary Slips", "done": True, "category": "Income"},
            {"id": "chk_2", "label": "6 Months Bank Account Statement", "done": True, "category": "Income"},
            {"id": "chk_3", "label": "Form 16 / Tax Acknowledgement", "done": True, "category": "Tax"},
            {"id": "chk_4", "label": "Property Sale Agreement Draft", "done": False, "category": "Property"},
            {"id": "chk_5", "label": "Identity Proof (Aadhaar / PAN)", "done": True, "category": "KYC"}
        ]
    },
    "personal_loan": {
        "title": "Express Personal Loan Journey",
        "total_steps": 4,
        "steps": [
            {"step": 1, "title": "Loan Purpose & Requirement", "description": "Select requirement (medical, wedding, education, debt consolidation)."},
            {"step": 2, "title": "Instant Income & Obligation Audit", "description": "Verify monthly net cash flow and calculate maximum permissible EMI."},
            {"step": 3, "title": "KYC & Document Verification", "description": "Automated OCR matching on Aadhaar and salary statement."},
            {"step": 4, "title": "Digital Agreement & Fund Disbursement", "description": "Simulated instant loan agreement execution and bank account credit."}
        ],
        "checklist": [
            {"id": "pl_1", "label": "PAN Card Identification", "done": True, "category": "KYC"},
            {"id": "pl_2", "label": "Recent 3-Month Bank Statements", "done": True, "category": "Banking"},
            {"id": "pl_3", "label": "Latest Company Payslip", "done": True, "category": "Income"},
            {"id": "pl_4", "label": "e-Mandate / NACH Auto-Debit Setup", "done": False, "category": "Disbursement"}
        ]
    },
    "health_insurance": {
        "title": "Family Health Shield Advisory",
        "total_steps": 4,
        "steps": [
            {"step": 1, "title": "Coverage Gap & Need Assessment", "description": "Analyze existing corporate cover, family age brackets, and hospital inflation."},
            {"step": 2, "title": "Policy Document Analysis & Comparison", "description": "Examine room rent sub-limits, waiting periods, and copay clauses."},
            {"step": 3, "title": "Medical History & PED Declaration", "description": "Document disclosures for hypertension, diabetes, and past treatments."},
            {"step": 4, "title": "Final Policy Activation & E-Card Issuance", "description": "Complete premium calculation and unlock instant digital cashless card."}
        ],
        "checklist": [
            {"id": "hi_1", "label": "Existing Policy Copy (if porting)", "done": True, "category": "Existing Cover"},
            {"id": "hi_2", "label": "Family Member ID Details", "done": True, "category": "KYC"},
            {"id": "hi_3", "label": "Pre-existing Medical History Report", "done": False, "category": "Medical"}
        ]
    }
}

@router.get("")
def list_journeys(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM journeys WHERE user_id = %s ORDER BY updated_at DESC", (current_user.get("id"),))
    rows = cursor.fetchall()
    conn.close()
    
    journeys = []
    for r in rows:
        item = dict(r)
        item["data"] = json.loads(item.get("data_json") or "{}")
        # calculate progress percentage
        curr = item.get("current_step", 1)
        tot = item.get("total_steps", 5)
        item["progress_percent"] = round((curr / tot) * 100)
        journeys.append(item)
    return {"journeys": journeys}

@router.post("")
def create_journey(req: CreateJourneyRequest, current_user: dict = Depends(get_current_user)):
    template = JOURNEY_TEMPLATES.get(req.journey_type, JOURNEY_TEMPLATES["home_loan"])
    journey_id = f"jrn_{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow().isoformat()
    
    journey_data = {
        "target_amount": req.target_amount,
        "metadata": req.metadata or {},
        "steps": template["steps"],
        "checklist": template["checklist"],
        "created_at": now
    }
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO journeys (id, user_id, title, journey_type, current_step, total_steps, status, target_amount, data_json, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            journey_id, current_user.get("id"), req.title, req.journey_type, 1, template["total_steps"],
            "in_progress", req.target_amount, json.dumps(journey_data), now, now
        )
    )
    conn.commit()
    conn.close()
    
    return {
        "journey_id": journey_id,
        "title": req.title,
        "current_step": 1,
        "total_steps": template["total_steps"],
        "status": "in_progress",
        "progress_percent": round((1 / template["total_steps"]) * 100),
        "data": journey_data
    }

@router.post("/{journey_id}/checklist-toggle")
def toggle_checklist(journey_id: str, req: ChecklistToggleRequest, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM journeys WHERE id = %s AND user_id = %s", (journey_id, current_user.get("id")))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Journey not found")
        
    data = json.loads(row["data_json"] or "{}")
    checklist = data.get("checklist", [])
    
    for item in checklist:
        if item.get("id") == req.checklist_id:
            item["done"] = req.done
            
    data["checklist"] = checklist
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE journeys SET data_json = %s, updated_at = %s WHERE id = %s",
        (json.dumps(data), now, journey_id)
    )
    conn.commit()
    conn.close()
    
    return {"status": "success", "checklist": checklist}

@router.post("/{journey_id}/step")
def advance_step(journey_id: str, req: StepUpdateRequest, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM journeys WHERE id = %s AND user_id = %s", (journey_id, current_user.get("id")))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Journey not found")
        
    data = json.loads(row["data_json"] or "{}")
    total_steps = row["total_steps"]
    
    new_step = min(total_steps, max(1, req.target_step))
    status_str = "completed" if new_step >= total_steps else "in_progress"
    
    if req.step_data:
        data.setdefault("step_responses", {})
        data["step_responses"][f"step_{new_step}"] = req.step_data
        
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE journeys SET current_step = %s, status = %s, data_json = %s, updated_at = %s WHERE id = %s",
        (new_step, status_str, json.dumps(data), now, journey_id)
    )
    conn.commit()
    conn.close()
    
    return {
        "journey_id": journey_id,
        "current_step": new_step,
        "total_steps": total_steps,
        "status": status_str,
        "progress_percent": round((new_step / total_steps) * 100),
        "data": data
    }

@router.post("/{journey_id}/evaluate-sanction")
def evaluate_and_sanction(journey_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM journeys WHERE id = %s AND user_id = %s", (journey_id, current_user.get("id")))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Journey not found")
        
    target_amount = row["target_amount"] or 5000000.0
    now = datetime.utcnow()
    
    # Calculate simulated pre-approval terms
    approved_amount = min(target_amount, target_amount * 0.95)
    sanction_ref = f"FPA-SANC-{now.strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
    
    sanction_letter = {
        "sanction_reference": sanction_ref,
        "applicant_name": current_user.get("full_name", "Arjun Mehta"),
        "applicant_email": current_user.get("email", "demo@finpath.ai"),
        "issue_date": now.strftime("%B %d, %Y"),
        "valid_until": (now.replace(year=now.year + 1)).strftime("%B %d, %Y"),
        "approved_facility": "In-Principle Credit Approval (Home Loan / Personal Facility)",
        "sanctioned_amount": approved_amount,
        "indicative_rate": 8.40,
        "max_tenure_years": 20,
        "estimated_monthly_emi": round(approved_amount * 0.008678, 2), # ~8.4% 20y
        "underwriting_score": 862,
        "risk_grade": "Tier-1 Prime (Low Default Risk)",
        "verified_conditions": [
            "Income verified via 6-month continuous banking credits and Form 16 reconciliation.",
            "Debt-To-Income (FOIR) obligations verified strictly within 45% threshold.",
            "Clean credit track record with zero active delinquency or repayment defaults."
        ],
        "conditions_precedent": [
            "Original property title deeds and non-encumbrance certificate review by panel advocate.",
            "Independent site inspection and valuation report by certified bank empaneled valuer.",
            "Execution of digital loan agreement and NACH e-mandate registration."
        ],
        "regulatory_disclaimer": "This in-principle approval is an automated algorithmic preliminary evaluation based on borrower-submitted records. Final disbursement is subject to legal vetting and title search."
    }
    
    # Update journey step to final
    data = json.loads(row["data_json"] or "{}")
    data["sanction_letter"] = sanction_letter
    
    update_time = now.isoformat()
    cursor.execute(
        "UPDATE journeys SET current_step = total_steps, status = 'completed', data_json = %s, updated_at = %s WHERE id = %s",
        (json.dumps(data), update_time, journey_id)
    )
    conn.commit()
    conn.close()
    
    return {
        "status": "sanctioned",
        "journey_id": journey_id,
        "sanction_letter": sanction_letter
    }
