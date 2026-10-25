from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
import uuid
from datetime import datetime
from database import get_connection
from auth import get_current_user

router = APIRouter(prefix="/affordability", tags=["Loan Affordability Analyzer"])

class AffordabilityInput(BaseModel):
    monthly_income: float = Field(..., gt=0, description="Gross or net monthly income in local currency")
    monthly_expenses: float = Field(..., ge=0, description="Monthly household and lifestyle expenses")
    existing_emi: float = Field(0.0, ge=0, description="Current existing monthly loan/credit obligations")
    requested_amount: float = Field(..., gt=0, description="Requested loan principal amount")
    interest_rate: float = Field(..., gt=0, le=40, description="Annual interest rate in percentage (e.g. 8.5)")
    tenure_months: int = Field(..., gt=0, le=480, description="Repayment tenure in months (e.g. 240 for 20 years)")

@router.post("/calculate")
def calculate_affordability(data: AffordabilityInput, current_user: dict = Depends(get_current_user)):
    p = data.requested_amount
    annual_rate = data.interest_rate
    n = data.tenure_months
    r = (annual_rate / 100.0) / 12.0
    
    # Calculate reducing balance EMI
    if r > 0:
        emi = p * r * ((1 + r) ** n) / (((1 + r) ** n) - 1)
    else:
        emi = p / n
        
    total_repayment = emi * n
    total_interest = total_repayment - p
    
    total_monthly_obligations = data.existing_emi + emi
    dti_ratio = round((total_monthly_obligations / data.monthly_income) * 100, 2)
    current_dti = round((data.existing_emi / data.monthly_income) * 100, 2)
    
    remaining_discretionary = round(data.monthly_income - data.monthly_expenses - total_monthly_obligations, 2)
    
    # Calculate Max Recommended Loan based on standard 50% FOIR cap
    max_allowable_emi = max(0.0, (data.monthly_income * 0.50) - data.existing_emi)
    if r > 0 and max_allowable_emi > 0:
        max_eligible_principal = max_allowable_emi * (((1 + r) ** n) - 1) / (r * ((1 + r) ** n))
    else:
        max_eligible_principal = max_allowable_emi * n
    max_eligible_principal = round(max_eligible_principal, -3)  # round to nearest thousand
    
    # Determine risk category
    if dti_ratio <= 35:
        risk_category = "Healthy"
        risk_color = "emerald"
        status_message = "Your projected debt obligations remain comfortably under the prudent 35% threshold. Lenders typically view this profile favorably."
    elif dti_ratio <= 50:
        risk_category = "Moderate"
        risk_color = "amber"
        status_message = "Your projected debt-to-income ratio is within standard underwriting tolerance (up to 50%), but discretionary surplus will be tightened."
    else:
        risk_category = "High Obligation"
        risk_color = "rose"
        status_message = "Your total debt burden exceeds 50% of your income. Conventional lenders may request a co-applicant, lower loan amount, or longer tenure."

    # Generate Amortization schedule (yearly trajectory for charts)
    balance = p
    amortization_timeline = []
    accumulated_interest = 0.0
    accumulated_principal = 0.0
    
    # Yearly or periodic aggregation
    years = max(1, n // 12)
    monthly_balance = balance
    
    for month in range(1, n + 1):
        interest_for_month = monthly_balance * r
        principal_for_month = emi - interest_for_month
        monthly_balance = max(0.0, monthly_balance - principal_for_month)
        
        accumulated_interest += interest_for_month
        accumulated_principal += principal_for_month
        
        if month % 12 == 0 or month == n:
            year_num = (month + 11) // 12
            amortization_timeline.append({
                "year": f"Yr {year_num}",
                "month": month,
                "remaining_balance": round(monthly_balance, 0),
                "principal_paid": round(accumulated_principal, 0),
                "interest_paid": round(accumulated_interest, 0),
                "annual_emi_total": round(emi * 12, 0)
            })

    # Transparent assumptions and recommendations
    recommendations = []
    if dti_ratio > 45:
        # Suggest tenure increase
        tenure_ext_months = min(360, n + 60)
        ext_emi = p * r * ((1 + r) ** tenure_ext_months) / (((1 + r) ** tenure_ext_months) - 1) if r > 0 else p / tenure_ext_months
        saving = emi - ext_emi
        recommendations.append(
            f"Tenure Extension Option: Increasing tenure to {tenure_ext_months // 12} years could lower your monthly EMI by ~₹{round(saving):,} to ₹{round(ext_emi):,}."
        )
    if data.existing_emi > (data.monthly_income * 0.20):
        recommendations.append(
            "Debt Consolidation: Your current obligations consume over 20% of earnings. Prepaying high-cost short-term credit could dramatically improve loan terms."
        )
    if remaining_discretionary < (data.monthly_income * 0.15):
        recommendations.append(
            "Liquidity Buffer Warning: Discretionary cash flow after expenses and EMIs will be under 15%. Ensure at least 3 months of emergency reserves remain untouched."
        )
    if not recommendations:
        recommendations.append(
            "Strong Affordability Profile: You have robust borrowing capacity with healthy cash flow margins to withstand unexpected rate increases."
        )

    # Save calculation record in database
    conn = get_connection()
    cursor = conn.cursor()
    record_id = f"aff_{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """INSERT INTO affordability_records 
           (id, user_id, monthly_income, monthly_expenses, existing_emi, requested_amount, interest_rate, tenure_months, calculated_emi, dti_ratio, max_loan_eligible, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (record_id, current_user.get("id", "usr_demo_finpath_001"), data.monthly_income, data.monthly_expenses, data.existing_emi, p, annual_rate, n, round(emi, 2), dti_ratio, max_eligible_principal, now)
    )
    conn.commit()
    conn.close()

    return {
        "record_id": record_id,
        "calculation": {
            "requested_principal": p,
            "monthly_emi": round(emi, 2),
            "total_interest": round(total_interest, 2),
            "total_repayment": round(total_repayment, 2),
            "tenure_months": n,
            "tenure_years": round(n / 12, 1),
            "annual_interest_rate": annual_rate,
        },
        "affordability_metrics": {
            "dti_ratio": dti_ratio,
            "current_dti": current_dti,
            "total_monthly_debt": round(total_monthly_obligations, 2),
            "remaining_discretionary_income": remaining_discretionary,
            "max_recommended_loan": max_eligible_principal,
            "risk_category": risk_category,
            "risk_color": risk_color,
            "status_message": status_message
        },
        "breakdown": {
            "income": data.monthly_income,
            "living_expenses": data.monthly_expenses,
            "existing_obligations": data.existing_emi,
            "new_loan_emi": round(emi, 2),
            "unallocated_surplus": max(0.0, remaining_discretionary)
        },
        "amortization_timeline": amortization_timeline,
        "recommendations": recommendations,
        "assumptions": [
            "Interest computed using Standard Monthly Reducing Balance methodology.",
            "Maximum eligibility estimated at a conservative 50% Fixed Obligation to Income Ratio (FOIR).",
            "Calculations assume fixed interest throughout tenure; floating rate benchmarks may fluctuate over time."
        ],
        "disclaimer": "IMPORTANT DISCLAIMER: These calculations and metrics are algorithmic estimations for financial planning and budgeting purposes only. They do NOT constitute a loan sanction, pre-approval, credit guarantee, or contractual commitment by any lending institution."
    }

@router.get("/latest")
def get_latest_affordability(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM affordability_records WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
        (current_user.get("id"),)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return {"record": None}
    return {"record": dict(row)}
