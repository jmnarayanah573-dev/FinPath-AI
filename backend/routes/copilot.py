import logging
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
import httpx
from pydantic import BaseModel

from auth import get_current_user
from config import settings

logger = logging.getLogger("copilot")

router = APIRouter(prefix="/copilot", tags=["AI Financial Copilot"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class CopilotRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    context: Optional[dict] = None


# =====================================================================
# SYSTEM PROMPT: Financial Education Assistant
# =====================================================================
SYSTEM_PROMPT = """You are FinPath AI Financial Copilot, an expert, beginner-friendly financial education assistant.
Your mission is to help users understand personal finance, lending, insurance, banking, budgeting, and general financial concepts through clear, accurate, and supportive explanations.

Strict Operating Guidelines:
1. Answer the user's exact question first: Begin your response with a direct, unambiguous answer in the very first sentence or paragraph. Do not start with generic pleasantries, disclaimers, or unsolicited financial advice.
2. Use simple, beginner-friendly language: Explain financial terms in plain English. Whenever you introduce technical concepts (such as 'premium', 'principal', 'reducing balance', 'collateral', or 'liquidity'), immediately define them simply.
3. Concrete, realistic examples: Provide a relatable real-world example with realistic numbers whenever it helps illustrate the concept.
4. Keep it strictly relevant: Only provide additional advice or tips that are directly pertinent to the user's specific question. Do NOT bring up unrelated topics, metrics (such as FOIR or debt-to-income limits), processing fees, or document checklists unless the user explicitly inquired about them.
5. Avoid generic templates and unnecessary lists: Do not output boilerplate answers or arbitrary numbered lists. Provide tailored, focused explanations.
6. Factual and grounded: Never invent user information, imaginary interest rates as guaranteed, fictional insurance policy clauses, or guarantee loan approvals.
7. Distinguish educational information from personalized advice: Clearly frame explanations as educational and informational principles, reminding users that these do not represent a formal loan sanction or binding insurance underwriting decision.
8. Ask clarifying questions only when genuinely necessary: If the query is clear, answer it completely. Only ask for clarification if the question is genuinely ambiguous.
9. Conversation history and topic switching: Use conversation history to understand contextual follow-ups. However, if the user asks about a new topic (for example, switching from loans to insurance), immediately pivot to the new topic and do not carry forward unrelated advice from earlier messages.
10. Clean markdown formatting: Use standard markdown (###, ####, **bold**, and bullet points). Never escape formatting characters (write **term**, never \\*\\*term\\*\\*).
"""


def clean_markdown_escapes(text: str) -> str:
    """Ensure responses never contain literal escaped formatting characters like \\*\\*."""
    if not text:
        return ""
    # Unescape double backslashes and single backslashes before markdown characters
    text = re.sub(r'\\\\([*_`#~\[\]\(\)\-\+\.!\$])', r'\1', text)
    text = re.sub(r'\\([*_`#~\[\]\(\)\-\+\.!\$])', r'\1', text)
    return text.strip()


def is_topic_switch(query: str) -> bool:
    """Determine if query is an independent, complete question on a new subject."""
    q = query.lower().strip()
    topic_starters = [
        "what is", "what are", "how is", "how do", "how does", "define",
        "explain", "meaning of", "difference between", "tell me about", "i earn"
    ]
    is_starter = any(q.startswith(starter) for starter in topic_starters)
    has_subject = any(term in q for term in [
        "insurance", "loan", "emi", "budget", "document", "interest rate",
        "banking", "cibil", "credit score", "inflation", "deposit"
    ])
    return is_starter or has_subject


def get_effective_history(query: str, history: List[ChatMessage]) -> List[ChatMessage]:
    """
    Ensure the AI does not let unrelated previous advice override the latest user question.
    If the user starts an independent question or switches topics, ignore past distracting turns.
    """
    if not history:
        return []
    if is_topic_switch(query):
        # Fresh topic: Do not carry forward prior conversation turns to avoid bleeding unrelated advice
        return []
    # Follow-up query: carry up to last 4 conversation turns for context
    return history[-4:]


def extract_query_intents(query: str) -> dict:
    q = query.lower().strip()
    words = set(re.findall(r'\b[a-z0-9_]+\b', q))
    salary_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{3})+|\d{4,7})', q)
    amount = None
    if salary_match:
        try:
            amount = int(salary_match.group(1).replace(',', ''))
        except Exception:
            amount = None

    return {
        "text": q,
        "words": words,
        "amount": amount,
    }


def educational_intent_engine(user_query: str, history: Optional[List[ChatMessage]] = None) -> dict:
    """
    Comprehensive financial education intent engine.
    Directly answers beginner questions with simple, accurate explanations and realistic examples,
    strictly avoiding unrelated boilerplate (FOIR, fee checklists, etc.).
    """
    intents = extract_query_intents(user_query)
    q = intents["text"]
    words = intents["words"]
    amount = intents["amount"]

    # -----------------------------------------------------------------
    # 1. QUESTION D: Health Insurance vs Life Insurance
    # -----------------------------------------------------------------
    if "health" in words and "life" in words and ("insurance" in words or "difference" in words or "vs" in words or "compare" in words):
        return {
            "reply": (
                "### Difference Between Health Insurance and Life Insurance\n\n"
                "The fundamental difference between health insurance and life insurance lies in **what risk is covered** and **who receives the payout**:\n\n"
                "- **Health Insurance** covers your medical, surgical, and hospitalization bills while you are alive.\n"
                "- **Life Insurance** provides a guaranteed financial payout to your nominated family members or dependents upon your death.\n\n"
                "#### Core Comparisons:\n\n"
                "- **Primary Purpose:** Health insurance protects your current savings from being drained by sudden hospital bills; Life insurance protects your family's future income if you are no longer there to provide for them.\n"
                "- **Trigger Event:** Health insurance triggers upon illness, surgery, or emergency hospitalization; Life insurance triggers upon the policyholder's death (or upon maturity in endowment plans).\n"
                "- **Benefit Recipient:** In health insurance, the payment goes directly to the network hospital (cashless claim) or reimburses you; in life insurance, the sum assured is paid to your family/nominee.\n"
                "- **Real-World Example:** If you are hospitalized with dengue and incur a ₹75,000 medical bill, your **health insurance** pays the hospital. If a family breadwinner unexpectedly passes away, a ₹1 Crore **term life insurance** policy provides the spouse and children with funds to pay for living expenses, rent, and education."
            ),
            "followups": [
                "What is term life insurance?",
                "How much health insurance cover should I have?",
                "Can I have both health and life insurance?"
            ],
            "action": {"label": "Analyze Insurance Policy Terms", "target": "insurance"}
        }

    # -----------------------------------------------------------------
    # 2. QUESTION A: What is Insurance?
    # -----------------------------------------------------------------
    insurance_keywords = {"insurance", "insurances"}
    query_asks_insurance = (
        bool(insurance_keywords.intersection(words)) and
        (
            any(k in q for k in ["what is", "how does", "explain", "meaning", "define", "what do you mean"]) or
            q in ["insurance", "insurance?", "what is insurance??", "what is insurance?"] or
            {"what", "how", "define", "explain", "meaning"}.intersection(words)
        ) and
        "health" not in words and "life" not in words and "car" not in words and "motor" not in words
    )

    if query_asks_insurance or q in ["what is insurance", "what is insurance?", "what is insurance??"]:
        return {
            "reply": (
                "### What is Insurance?\n\n"
                "**Insurance** is a financial contract (policy) that protects you from unexpected, high-cost financial losses. In exchange for paying a relatively small, regular fee called a **premium**, an insurance company promises to pay for covered damages, medical treatments, or financial emergencies.\n\n"
                "#### How Insurance Works:\n"
                "Insurance is built on the concept of **risk pooling**. Thousands of people pay small premiums into a collective pool. Only a small percentage of individuals experience an emergency in any given year, and the pool funds their claims.\n\n"
                "#### Key Terms to Know:\n"
                "- **Premium:** The fixed amount you pay (monthly, quarterly, or annually) to keep your policy active.\n"
                "- **Claim:** A formal request you submit to the insurer to pay for a covered expense.\n"
                "- **Sum Insured / Sum Assured:** The maximum amount the insurance company will pay under your policy.\n"
                "- **Deductible:** The initial portion of a loss you agree to pay out-of-pocket before insurance coverage kicks in.\n\n"
                "#### Simple Example:\n"
                "Imagine you pay a premium of ₹10,000 per year for health insurance with a coverage limit (Sum Insured) of ₹5,00,000. If you require unexpected surgery costing ₹1,50,000, the insurance company covers the medical bill (subject to policy terms), saving you from spending ₹1,50,000 of your personal savings.\n\n"
                "#### Common Types of Insurance:\n"
                "- **Health Insurance:** Covers doctor visits, hospitalization, and surgical costs.\n"
                "- **Life Insurance:** Provides financial support to dependents if the insured passes away.\n"
                "- **Motor Insurance:** Covers vehicle damage and third-party liabilities after accidents.\n"
                "- **Property / Home Insurance:** Covers property damage caused by fire, natural disasters, or theft."
            ),
            "followups": [
                "What is the difference between health and life insurance?",
                "What is an insurance premium?",
                "How do insurance claims work?"
            ],
            "action": {"label": "Open Insurance Policy Simplifier", "target": "insurance"}
        }

    # -----------------------------------------------------------------
    # 3. QUESTION B: What is a Loan?
    # -----------------------------------------------------------------
    loan_keywords = {"loan", "loans"}
    query_asks_loan = (
        bool(loan_keywords.intersection(words)) and
        (
            any(k in q for k in ["what is a loan", "what is loan", "explain loan", "how does a loan work", "define loan", "meaning of loan"]) or
            q in ["loan", "loans", "loan?", "what is a loan?"] or
            ({"what", "how", "define", "explain", "meaning"}.intersection(words) and "personal" not in words and "home" not in words and "emi" not in words and "document" not in words)
        )
    )

    if query_asks_loan:
        return {
            "reply": (
                "### What is a Loan?\n\n"
                "A **loan** is a sum of money that you borrow from a lender (such as a bank, credit union, or financial institution) with the agreement that you will pay it back in the future, usually over a set period of time along with an additional cost called **interest**.\n\n"
                "#### Core Components of a Loan:\n"
                "- **Principal:** The actual amount of money you borrow (e.g., ₹1,00,000).\n"
                "- **Interest Rate:** The percentage fee charged by the lender for letting you use their money (e.g., 10% per year).\n"
                "- **Tenure:** The agreed timeframe over which you repay the loan (e.g., 1 year, 5 years, or 20 years).\n"
                "- **EMI (Equated Monthly Installment):** The fixed monthly payment you make until the loan is fully paid off.\n\n"
                "#### Simple Example:\n"
                "Suppose you borrow a loan of **₹1,00,000** (Principal) at an **interest rate of 10% per year** for a **tenure of 1 year** (12 months). Instead of paying ₹1,00,000 all at once, you repay approximately **₹8,792 per month**. Over the year, you pay back the ₹1,00,000 principal plus approximately ₹5,500 in total interest.\n\n"
                "#### Two Main Categories of Loans:\n"
                "- **Secured Loans:** Backed by an asset or collateral (e.g., a Home Loan backed by the house, or an Auto Loan backed by the car). If you default, the lender can repossess the asset.\n"
                "- **Unsecured Loans:** Do not require collateral (e.g., Personal Loans or Credit Cards). Lenders approve these based on your credit score and verifiable income."
            ),
            "followups": [
                "How is EMI calculated?",
                "What is the difference between secured and unsecured loans?",
                "What documents are required for a personal loan?"
            ],
            "action": {"label": "Try Loan Affordability Analyzer", "target": "affordability"}
        }

    # -----------------------------------------------------------------
    # 4. QUESTION C: How is EMI Calculated?
    # -----------------------------------------------------------------
    if (
        any(k in q for k in ["how is emi calculated", "how emi is calculated", "calculate emi", "emi formula", "what is emi", "explain emi", "emi calculation", "how emi works"]) or
        ("emi" in words and ({"calculate", "formula", "how", "what", "reduction", "reducing"}.intersection(words)))
    ):
        return {
            "reply": (
                "### How is EMI Calculated?\n\n"
                "**EMI (Equated Monthly Installment)** is the fixed amount of money you pay each month to your lender until your loan is fully repaid. Every EMI payment consists of two parts: **principal repayment** and **interest payment**.\n\n"
                "#### Standard Reducing Balance EMI Formula:\n"
                "Banks and financial institutions calculate EMI using this standard mathematical formula:\n\n"
                "$$\\text{EMI} = P \\times r \\times \\frac{(1+r)^n}{(1+r)^n - 1}$$\n\n"
                "Where:\n"
                "- **P (Principal):** The original loan amount borrowed.\n"
                "- **r (Monthly Interest Rate):** Annual interest rate divided by 12 and then divided by 100. *(For example, 10% per year = 10 / 12 / 100 = 0.008333 per month)*.\n"
                "- **n (Number of Monthly Installments):** Loan tenure in months *(e.g., 3 years = 36 months)*.\n\n"
                "#### Step-by-Step Example:\n"
                "- **Loan Principal (P):** ₹5,00,000\n"
                "- **Annual Interest Rate:** 10% p.a. -> Monthly rate $r = 10 / 12 / 100 = 0.008333$\n"
                "- **Tenure:** 3 Years (36 months, $n = 36$)\n"
                "- **Calculated EMI:** Approximately **₹16,134 per month**.\n\n"
                "#### How the Balance Reduces Over Time:\n"
                "In the beginning of your loan tenure, a larger portion of each EMI goes toward paying interest. As you gradually repay the principal, the interest portion decreases each month, and a larger portion goes toward reducing the remaining principal balance."
            ),
            "followups": [
                "What is reducing balance vs flat rate?",
                "How does loan tenure affect my total interest?",
                "Can I prepay my EMI to save interest?"
            ],
            "action": {"label": "Calculate Your EMI Instantly", "target": "affordability"}
        }

    # -----------------------------------------------------------------
    # 5. QUESTION E: Budgeting (₹30,000 per month or custom amount)
    # -----------------------------------------------------------------
    if "budget" in words or "budgeting" in words or "plan my budget" in q:
        budget_salary = amount if amount else (30000 if ("30000" in q or "30,000" in q) else None)

        if budget_salary:
            needs = int(budget_salary * 0.50)
            wants = int(budget_salary * 0.30)
            savings = int(budget_salary * 0.20)
            needs_fmt = f"₹{needs:,}"
            wants_fmt = f"₹{wants:,}"
            savings_fmt = f"₹{savings:,}"
            salary_fmt = f"₹{budget_salary:,}"

            return {
                "reply": (
                    f"### How to Plan Your Budget with a Monthly Income of {salary_fmt}\n\n"
                    f"When you earn **{salary_fmt} per month**, a clear, reliable method to organize your money is the **50/30/20 Budgeting Rule**. This approach divides your take-home pay into three practical categories:\n\n"
                    f"#### 1. 50% for Needs ({needs_fmt})\n"
                    "These are essential living expenses you cannot avoid:\n"
                    "- Rent or shared housing\n"
                    "- Groceries and household supplies\n"
                    "- Utilities (electricity, water, cooking gas, mobile/internet)\n"
                    "- Basic transportation or daily commute\n\n"
                    f"#### 2. 30% for Wants ({wants_fmt})\n"
                    "These are lifestyle and comfort expenses that enhance your quality of life:\n"
                    "- Dining out or food delivery\n"
                    "- Entertainment and digital streaming subscriptions\n"
                    "- Shopping, hobbies, and social outings\n"
                    f"*Tip: If your housing or travel costs run high, reduce wants to 20% to keep your cashflow safe.*\n\n"
                    f"#### 3. 20% for Savings & Debt Safety ({savings_fmt})\n"
                    "This portion builds your financial safety net:\n"
                    "- **Emergency Reserve:** Allocate a regular portion into a liquid savings account until you accumulate at least 2 to 3 months of basic living costs.\n"
                    "- **Future Goals / Investments:** Invest the remainder into a recurring deposit (RD) or mutual fund SIP once your emergency buffer is established.\n\n"
                    "#### Three Practical Steps to Start Today:\n"
                    f"1. **Pay Yourself First:** Move the {savings_fmt} savings into your savings account the day your salary arrives.\n"
                    f"2. **Track Discretionary Spends:** Keep daily shopping and food orders within the {wants_fmt} monthly limit.\n"
                    "3. **Avoid High-Cost Debt:** Avoid carrying credit card revolving balances or high-interest payday loans."
                ),
                "followups": [
                    "How much should I keep in an emergency fund?",
                    "What is the 50/30/20 budgeting rule?",
                    "How can I cut expenses on a fixed salary?"
                ],
                "action": {"label": "Check Discretionary Surplus", "target": "dashboard"}
            }

        # General budgeting without a specific salary
        return {
            "reply": (
                "### The 50/30/20 Rule: A Simple Framework for Budgeting\n\n"
                "The **50/30/20 budgeting rule** is a straightforward method to manage your monthly income:\n\n"
                "1. **50% for Needs:** Essential expenses you cannot live without (rent, groceries, basic utilities, transportation).\n"
                "2. **30% for Wants:** Lifestyle choices that improve your day-to-day comfort (dining out, streaming services, shopping, hobbies).\n"
                "3. **20% for Savings & Investments:** Emergency fund reserve, debt repayment, and future wealth creation (SIPs, PPF, retirement).\n\n"
                "#### How to Start:\n"
                "- Write down your net monthly take-home income.\n"
                "- Automate your 20% savings on the day you receive your paycheck.\n"
                "- Track your discretionary spending so wants stay within 30%."
            ),
            "followups": [
                "I earn ₹30,000 per month. How can I plan my budget?",
                "How much should I keep in an emergency fund?",
                "How to budget with irregular income?"
            ],
            "action": {"label": "Check Discretionary Surplus", "target": "dashboard"}
        }

    # -----------------------------------------------------------------
    # 6. QUESTION F: Documents Required for a Personal Loan
    # -----------------------------------------------------------------
    if (
        ({"document", "documents", "paperwork", "checklist", "required"}.intersection(words)) and
        ("personal loan" in q or "personal loans" in q or "unsecured loan" in q)
    ):
        return {
            "reply": (
                "### Documents Generally Required for a Personal Loan\n\n"
                "Because a personal loan is an **unsecured loan** (meaning no collateral like a house or gold is pledged), lenders evaluate your identity, residence, and proof of regular income.\n\n"
                "#### Standard Document Checklist:\n\n"
                "**1. Identity Proof (Any One):**\n"
                "- PAN Card *(Mandatory across financial institutions for tax verification)*\n"
                "- Aadhaar Card / Passport / Voter ID / Driving License\n\n"
                "**2. Address / Residence Proof (Any One):**\n"
                "- Aadhaar Card or Passport\n"
                "- Utility Bill (Electricity, Water, or Gas bill under 3 months old)\n"
                "- Registered Rent Agreement (if staying in rented accommodation)\n\n"
                "**3. Income Proof (For Salaried Applicants):**\n"
                "- Last 3 months' official payslips / salary slips\n"
                "- Form 16 (Part A and B) or latest Income Tax Return (ITR-V) acknowledgement\n\n"
                "**4. Banking Records:**\n"
                "- Last 3 to 6 months' bank account statements showing regular salary credits and healthy account balance\n\n"
                "**5. Employment Verification:**\n"
                "- Company employee ID card or official corporate email verification\n\n"
                "*Note: Personal loans do not require property title deeds, municipal building permits, or mortgage collateral because they are unsecured.*"
            ),
            "followups": [
                "What minimum credit score is needed for a personal loan?",
                "What if I don't have Form 16?",
                "Can self-employed individuals get a personal loan?"
            ],
            "action": {"label": "Upload Documents for Instant OCR Audit", "target": "documents"}
        }

    # -----------------------------------------------------------------
    # 7. Interest Rates: Fixed vs Floating & Core Concepts
    # -----------------------------------------------------------------
    if (
        any(k in q for k in ["fixed vs floating", "floating interest", "fixed interest", "interest rate", "interest rates"]) or
        ("rate" in words and "interest" in words)
    ):
        return {
            "reply": (
                "### Understanding Fixed vs Floating Interest Rates\n\n"
                "An **interest rate** represents the cost of borrowing money from a lender. When borrowing for a loan, lenders typically offer two rate structures:\n\n"
                "#### 1. Fixed Interest Rate:\n"
                "- **How it works:** The interest rate remains identical throughout the entire loan tenure regardless of market conditions.\n"
                "- **Advantage:** Predictable EMI payments make long-term financial budgeting simple.\n"
                "- **Drawback:** Usually 1% to 2% higher than floating rates; you do not benefit if market interest rates fall.\n\n"
                "#### 2. Floating (Variable) Interest Rate:\n"
                "- **How it works:** The interest rate is linked to an external benchmark (such as the RBI Repo Rate). If the benchmark changes, your loan rate and EMI/tenure adjust accordingly.\n"
                "- **Advantage:** Usually offers lower initial interest rates; your EMI decreases when the central bank lowers repo rates.\n"
                "- **Drawback:** Rates can rise during inflationary periods, increasing your monthly interest burden.\n\n"
                "#### Real-World Example:\n"
                "A Home Loan at **8.5% floating** starts with a lower monthly EMI. If repo rates drop by 0.50%, your rate reduces to 8.0%. Conversely, a **9.5% fixed** rate remains at 9.5% for all 20 years, providing complete immunity from rate spikes."
            ),
            "followups": [
                "What is the RBI repo rate and how does it affect loans?",
                "Can I switch from floating to fixed interest rate?",
                "What is reducing balance vs flat rate interest?"
            ],
            "action": {"label": "Compare Loan Scenarios in Affordability Analyzer", "target": "affordability"}
        }

    # -----------------------------------------------------------------
    # 8. Banking: Savings vs Current Account & FD vs RD
    # -----------------------------------------------------------------
    if (
        any(k in q for k in ["savings account", "current account", "fixed deposit", "recurring deposit", "fd vs rd", "banking"]) or
        ("account" in words and {"savings", "current", "bank"}.intersection(words))
    ):
        return {
            "reply": (
                "### Banking Fundamentals: Savings Accounts vs Current Accounts\n\n"
                "Banks offer distinct account types tailored to different cashflow needs:\n\n"
                "#### 1. Savings Account (For Individuals):\n"
                "- **Purpose:** A safe place to deposit personal income, earn modest interest (typically 2.5% to 4% p.a.), and manage day-to-day living expenses.\n"
                "- **Features:** Monthly transaction limits, ATM withdrawal cards, digital UPI payments, and interest credited quarterly.\n\n"
                "#### 2. Current Account (For Businesses & Traders):\n"
                "- **Purpose:** Designed for high-volume commercial transactions by companies, sole proprietorships, and partnerships.\n"
                "- **Features:** No limit on daily transactions, zero interest earned, and access to overdraft facilities to manage business working capital.\n\n"
                "#### Term Deposits: FD vs RD:\n"
                "- **Fixed Deposit (FD):** You deposit a single lump sum (e.g., ₹1,00,000) for a fixed period (e.g., 1 to 5 years) to earn guaranteed interest.\n"
                "- **Recurring Deposit (RD):** You deposit a fixed amount every month (e.g., ₹5,000/month) for a set tenure, ideal for disciplined monthly savings."
            ),
            "followups": [
                "What is the difference between UPI, NEFT, and RTGS?",
                "What is deposit insurance (DICGC)?",
                "How much interest on savings accounts is tax-free?"
            ],
            "action": None
        }

    # -----------------------------------------------------------------
    # 9. General Financial Concepts: Inflation & Compound Interest
    # -----------------------------------------------------------------
    if (
        any(k in q for k in ["inflation", "purchasing power", "compound interest", "compounding", "rule of 72"]) or
        {"inflation", "compounding"}.intersection(words)
    ):
        return {
            "reply": (
                "### Understanding Inflation and Compound Interest\n\n"
                "Two of the most powerful forces in personal finance are **inflation** and **compound interest**:\n\n"
                "#### 1. Inflation (The Silent Wealth Shrinker):\n"
                "- **What it is:** Inflation is the gradual increase in the prices of goods and services over time, meaning each rupee buys fewer goods in the future.\n"
                "- **Example:** If inflation runs at 6% annually, a basket of groceries costing **₹1,000** today will cost **₹1,060** next year. Keeping all your money in cash or zero-interest accounts causes you to lose purchasing power.\n\n"
                "#### 2. Compound Interest (The Wealth Multiplier):\n"
                "- **What it is:** Earning interest on both your initial principal and on the accumulated interest from previous periods.\n"
                "- **Example:** If you invest ₹1,00,000 at 10% annual return, you earn ₹10,000 in Year 1. In Year 2, you earn 10% on ₹1,10,000 (₹11,000). Over 20 years, your ₹1,00,000 grows to **₹6,72,750** without adding another rupee!\n\n"
                "#### The Rule of 72:\n"
                "To estimate how many years it takes to double your investment, divide 72 by the annual return rate. At 12% return, your money doubles in approximately 6 years ($72 / 12 = 6$)."
            ),
            "followups": [
                "How can I invest to beat inflation?",
                "What is the difference between simple and compound interest?",
                "What is an emergency fund?"
            ],
            "action": None
        }

    # -----------------------------------------------------------------
    # 10. FOIR / Debt-to-Income (Specific Underwriting Query)
    # -----------------------------------------------------------------
    if any(k in q for k in ["foir", "debt to income", "dti", "fixed obligation"]):
        return {
            "reply": (
                "### Fixed Obligation to Income Ratio (FOIR / DTI)\n\n"
                "**FOIR (Fixed Obligation to Income Ratio)**, also known as the **Debt-to-Income (DTI) ratio**, measures the percentage of your monthly income that goes toward paying debts (including existing loan EMIs, credit card dues, and any proposed new loan EMI).\n\n"
                "#### How Lenders Evaluate Your FOIR:\n"
                "- **Healthy (< 40%):** You have ample income left for living costs and unexpected expenses. Lenders consider you a low-risk borrower.\n"
                "- **Moderate (40% to 50%):** Standard underwriting tolerance limit for salaried borrowers.\n"
                "- **High Risk (> 50%):** Indicates high debt obligations. Lenders may reject the application, require a co-applicant, or offer a smaller loan amount.\n\n"
                "#### Simple Example:\n"
                "If your net monthly income is ₹1,00,000 and your total monthly EMIs equal ₹40,000, your FOIR is:\n"
                "$$\\text{FOIR} = \\frac{40,000}{1,00,000} \\times 100 = 40\\%$$\n"
                "This leaves ₹60,000 each month for groceries, utilities, savings, and lifestyle needs."
            ),
            "followups": [
                "How can I lower my FOIR?",
                "Does a higher tenure reduce FOIR?",
                "What is considered a safe debt ratio?"
            ],
            "action": {"label": "Calculate Your FOIR & Affordability", "target": "affordability"}
        }

    # -----------------------------------------------------------------
    # 11. Credit Score / CIBIL
    # -----------------------------------------------------------------
    if any(k in q for k in ["cibil", "credit score", "credit rating"]):
        return {
            "reply": (
                "### Understanding Your Credit / CIBIL Score\n\n"
                "A **credit score** (often referred to as a CIBIL score in India) is a 3-digit number ranging from **300 to 900** that summarizes your creditworthiness and repayment history.\n\n"
                "#### Score Tiers:\n"
                "- **750 to 900 (Excellent):** Lenders offer the lowest interest rates, higher loan amounts, and quick approvals.\n"
                "- **700 to 749 (Good):** Standard approval terms across retail banks.\n"
                "- **Below 650 (High Risk):** Loan applications may face higher interest rates, stricter collateral requirements, or rejection.\n\n"
                "#### How to Improve Your Score:\n"
                "1. **Pay On Time:** Never miss an EMI or credit card due date.\n"
                "2. **Maintain Low Credit Utilization:** Keep credit card spending below 30% of your total credit limit.\n"
                "3. **Avoid Multiple Loan Inquiries:** Applying for several credit cards or loans in a short timeframe lowers your score."
            ),
            "followups": [
                "How long does it take to improve a credit score?",
                "Does closing an old credit card hurt my score?",
                "How do errors on credit reports get corrected?"
            ],
            "action": {"label": "Check Loan Affordability", "target": "affordability"}
        }

    # -----------------------------------------------------------------
    # 12. Insurance Waiting Periods
    # -----------------------------------------------------------------
    if any(k in q for k in ["waiting period", "ped", "pre-existing disease"]):
        return {
            "reply": (
                "### Understanding Health Insurance Waiting Periods\n\n"
                "A **waiting period** is a specified duration from the start of an insurance policy during which the insurance company will **not** cover claims for certain illnesses or treatments.\n\n"
                "#### Standard Waiting Period Categories:\n"
                "1. **Initial Waiting Period (Usually 30 Days):** No non-accidental illness hospitalizations are covered during the first 30 days. Emergency accidents are covered immediately from day one.\n"
                "2. **Specific Illness Waiting Period (1 to 2 Years):** Applies to slow-developing conditions such as cataracts, hernia, kidney stones, and joint replacements.\n"
                "3. **Pre-Existing Disease (PED) Waiting Period (2 to 4 Years):** If you had a medical condition (like diabetes, hypertension, or asthma) before buying the policy, treatments related to that condition are covered only after this waiting period completes.\n\n"
                "#### Key Example:\n"
                "If you purchase a health policy with a 3-year pre-existing disease clause and disclosed pre-existing hypertension, any hospitalization directly related to hypertension will be covered only starting from Year 4."
            ),
            "followups": [
                "Can I reduce waiting periods by paying extra premium?",
                "What is room rent sub-limit in health insurance?",
                "Does porting a policy reset the waiting period?"
            ],
            "action": {"label": "Inspect Policy Clauses", "target": "insurance"}
        }

    # -----------------------------------------------------------------
    # 13. Room Rent & Copay
    # -----------------------------------------------------------------
    if any(k in q for k in ["room rent", "copay", "co-pay", "sub-limit"]):
        return {
            "reply": (
                "### Copay and Room Rent Sub-Limits Explained\n\n"
                "Room rent sub-limits and copay clauses are two common reasons patients face unexpected out-of-pocket hospital deductions:\n\n"
                "#### 1. Room Rent Sub-Limit:\n"
                "Some policies cap daily room rent at a fixed amount or percentage of the Sum Insured (e.g., 1% of a ₹5 Lakh policy = ₹5,000/day). If you choose a private room costing ₹8,000/day, the insurer applies **proportionate deductions** across doctor fees, nursing charges, and surgical procedures!\n\n"
                "#### 2. Co-Payment (Copay):\n"
                "A clause requiring you to pay a predetermined percentage of the total approved claim out-of-pocket (e.g., a 10% or 20% copay). If the approved hospital bill is ₹1,00,000 with a 10% copay, you pay ₹10,000 and the insurer pays ₹90,000.\n\n"
                "#### Practical Recommendation:\n"
                "Whenever possible, choose policies that offer **No Room Rent Capping** (or Single Private AC Room cover) and **Zero Co-payment** for primary insured members."
            ),
            "followups": [
                "What is proportionate deduction in health insurance?",
                "What is a deductible vs a copay?",
                "Does No Claim Bonus apply if I make a claim?"
            ],
            "action": {"label": "Check Policy Clauses in Simplifier", "target": "insurance"}
        }

    # -----------------------------------------------------------------
    # 14. Fallback for General / Unmatched Financial Queries
    # -----------------------------------------------------------------
    title_text = user_query.strip().capitalize()
    return {
        "reply": (
            f"### Educational Overview: {title_text}\n\n"
            f"Here is a direct overview to help answer your question regarding **{user_query.strip()}**:\n\n"
            "In personal financial planning, decisions are best evaluated through three key educational principles:\n\n"
            "1. **Direct Clarity:** Understand the exact contractual terms, fees, and obligations before signing any financial agreement.\n"
            "2. **Risk Management:** Maintain appropriate protection (such as emergency savings and essential health insurance) before taking on leverage or aggressive investments.\n"
            "3. **Long-Term Sustainability:** Keep repayments and lifestyle expenses aligned with your verifiable income so you maintain steady cashflow.\n\n"
            "*If you'd like a detailed explanation of loans, EMI calculations, insurance policies, budgeting rules, or document requirements, feel free to ask with specific details!*"
        ),
        "followups": [
            "What is insurance?",
            "What is a loan?",
            "How is EMI calculated?",
            "I earn ₹30,000 per month. How can I plan my budget?"
        ],
        "action": None
    }


def generate_followups(query: str) -> List[str]:
    q = query.lower()
    if "insurance" in q:
        return [
            "What is the difference between health and life insurance?",
            "What is an insurance premium?",
            "What are health insurance waiting periods?"
        ]
    if "emi" in q:
        return [
            "What is reducing balance vs flat rate?",
            "How does tenure affect total interest paid?",
            "Can I prepay my loan to reduce EMI?"
        ]
    if "loan" in q:
        return [
            "How is EMI calculated?",
            "What is the difference between secured and unsecured loans?",
            "What documents are required for a personal loan?"
        ]
    if "budget" in q or "30000" in q or "30,000" in q:
        return [
            "What is the 50/30/20 budgeting rule?",
            "How much should I keep in an emergency fund?",
            "How to cut unnecessary expenses?"
        ]
    return [
        "Can you explain with a simple example?",
        "What are common pitfalls to avoid?",
        "What is the next practical step?"
    ]


def get_relevant_action(query: str) -> Optional[dict]:
    q = query.lower()
    if "insurance" in q:
        return {"label": "Analyze Policy in Insurance Simplifier", "target": "insurance"}
    if "emi" in q or "loan" in q or "foir" in q:
        return {"label": "Try Loan Affordability Analyzer", "target": "affordability"}
    if "document" in q or "pan" in q or "salary" in q:
        return {"label": "Upload Documents for Instant OCR Audit", "target": "documents"}
    if "budget" in q or "expense" in q:
        return {"label": "Check Discretionary Surplus on Dashboard", "target": "dashboard"}
    return None


async def query_gemini(prompt: str, history: List[ChatMessage], api_key: str) -> str:
    """Query Google Gemini API with system instructions and error handling."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    contents = []

    for msg in history:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.content}]})

    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1000
        }
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return clean_markdown_escapes(parts[0].get("text", ""))
            raise RuntimeError("Gemini returned an empty candidate list.")
        else:
            err_text = resp.text
            try:
                err_json = resp.json()
                err_msg = err_json.get("error", {}).get("message", err_text)
            except Exception:
                err_msg = err_text[:200]
            raise RuntimeError(f"Gemini API error ({resp.status_code}): {err_msg}")


async def query_openai(prompt: str, history: List[ChatMessage], api_key: str) -> str:
    """Query OpenAI API with system instructions and error handling."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 1000
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            return clean_markdown_escapes(data["choices"][0]["message"]["content"])
        else:
            err_text = resp.text
            try:
                err_json = resp.json()
                err_msg = err_json.get("error", {}).get("message", err_text)
            except Exception:
                err_msg = err_text[:200]
            raise RuntimeError(f"OpenAI API error ({resp.status_code}): {err_msg}")


@router.post("/chat")
async def chat_copilot(req: CopilotRequest, current_user: dict = Depends(get_current_user)):
    user_query = req.message.strip()
    history = req.history or []

    # Get clean, effective history that prevents previous topics from overriding latest question
    effective_history = get_effective_history(user_query, history)

    api_error_detail: Optional[str] = None

    # 1. Check if Gemini API key is configured
    if settings.GEMINI_API_KEY:
        try:
            llm_text = await query_gemini(user_query, effective_history, settings.GEMINI_API_KEY)
            if llm_text:
                return {
                    "source": "gemini-1.5-flash",
                    "reply": llm_text,
                    "followups": generate_followups(user_query),
                    "action": get_relevant_action(user_query),
                    "mode": "live-ai",
                    "status": "success"
                }
        except Exception as e:
            logger.warning(f"Gemini API call failed: {e}")
            api_error_detail = str(e)

    # 2. Check if OpenAI API key is configured
    if settings.OPENAI_API_KEY:
        try:
            llm_text = await query_openai(user_query, effective_history, settings.OPENAI_API_KEY)
            if llm_text:
                return {
                    "source": "openai-gpt-4o-mini",
                    "reply": llm_text,
                    "followups": generate_followups(user_query),
                    "action": get_relevant_action(user_query),
                    "mode": "live-ai",
                    "status": "success"
                }
        except Exception as e:
            logger.warning(f"OpenAI API call failed: {e}")
            api_error_detail = str(e)

    # 3. High-Quality Educational Intent Engine
    engine_response = educational_intent_engine(user_query, effective_history)

    if api_error_detail:
        # Graceful error handling: explicitly labelled fallback response with error notification
        engine_response["source"] = "educational-engine-fallback"
        engine_response["mode"] = "fallback"
        engine_response["status"] = "fallback"
        engine_response["api_error"] = api_error_detail
        engine_response["notice"] = (
            f"Live AI service temporarily unavailable ({api_error_detail}). "
            "FinPath Copilot has seamlessly switched to the verified educational knowledge engine."
        )
        # Prepend a clear markdown note alert for user transparency
        engine_response["reply"] = (
            f"> [!NOTE]\n"
            f"> **Offline Educational Fallback**: Live AI service unavailable ({api_error_detail}). "
            f"The following verified educational explanation is provided by FinPath Knowledge Engine.\n\n"
            + engine_response["reply"]
        )
    else:
        # Standard offline/educational engine mode
        engine_response["source"] = "educational-intent-engine"
        engine_response["mode"] = "educational-engine"
        engine_response["status"] = "success"
        engine_response["notice"] = "Educational Knowledge Engine Active."

    return engine_response


@router.get("/prompts")
def get_suggested_prompts():
    return {
        "prompts": [
            {"title": "What is Insurance?", "query": "What is insurance and how does it work?", "category": "Insurance"},
            {"title": "What is a Loan?", "query": "What is a loan and how do principal and interest work?", "category": "Lending"},
            {"title": "How is EMI Calculated?", "query": "How is EMI calculated with reducing balance?", "category": "Calculations"},
            {"title": "Health vs Life Insurance", "query": "What is the difference between health insurance and life insurance?", "category": "Insurance"},
            {"title": "₹30,000 Budget Plan", "query": "I earn ₹30,000 per month. How can I plan my budget?", "category": "Budgeting"},
            {"title": "Personal Loan Documents", "query": "What documents are generally required for a personal loan?", "category": "Lending"}
        ]
    }
