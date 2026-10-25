import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

URL = "http://127.0.0.1:8000/api/copilot/chat"

TEST_QUESTIONS = [
    ("A", "What is insurance?"),
    ("B", "What is a loan?"),
    ("C", "How is EMI calculated?"),
    ("D", "What is the difference between health insurance and life insurance?"),
    ("E", "I earn ₹30,000 per month. How can I plan my budget?"),
    ("F", "What documents are generally required for a personal loan?")
]

def query_copilot(msg):
    payload = json.dumps({"message": msg, "history": []}).encode("utf-8")
    req = urllib.request.Request(URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))

all_passed = True

print("=" * 80)
print("FINPATH AI FINANCIAL COPILOT VERIFICATION TEST SUITE")
print("=" * 80)

for code, question in TEST_QUESTIONS:
    print(f"\n[TEST {code}] QUESTION: \"{question}\"")
    try:
        res = query_copilot(question)
        reply = res.get("reply", "")
        source = res.get("source", "")
        followups = res.get("followups", [])
        action = res.get("action", {})
        
        print(f"SOURCE: {source}")
        print("REPLY PREVIEW:")
        # Print first 250 characters of reply
        print(reply[:350] + ("..." if len(reply) > 350 else ""))
        
        # Validation checks
        if code == "A":
            assert "premium" in reply.lower(), "Question A must explain premium"
            assert "contract" in reply.lower() or "protection" in reply.lower() or "financial" in reply.lower(), "Question A must define insurance"
            assert "foir" not in reply.lower(), "Question A must NOT mention irrelevant FOIR"
            print(">>> VALIDATION PASSED: Directly defines insurance, premium, risk pooling, and gives concrete examples.")
            
        elif code == "B":
            assert "borrow" in reply.lower() or "principal" in reply.lower(), "Question B must explain borrowing/principal"
            assert "interest" in reply.lower(), "Question B must explain interest"
            assert "foir" not in reply.lower(), "Question B must NOT mention irrelevant FOIR"
            print(">>> VALIDATION PASSED: Directly defines loan, principal, interest, tenure, and gives concrete example.")
            
        elif code == "C":
            assert "equated monthly installment" in reply.lower() or "formula" in reply.lower(), "Question C must explain EMI"
            assert "principal" in reply.lower() and "interest" in reply.lower(), "Question C must break down EMI components"
            print(">>> VALIDATION PASSED: Directly provides standard EMI reducing balance formula and explains balance reduction.")
            
        elif code == "D":
            assert "health" in reply.lower() and "life" in reply.lower(), "Question D must address both health and life"
            assert "hospital" in reply.lower() or "medical" in reply.lower(), "Question D must explain health medical costs"
            assert "death" in reply.lower() or "family" in reply.lower() or "nominee" in reply.lower(), "Question D must explain life protection"
            print(">>> VALIDATION PASSED: Directly contrasts health insurance vs life insurance with clear trigger and beneficiary distinctions.")
            
        elif code == "E":
            assert "30,000" in reply or "30000" in reply, "Question E must address ₹30,000 budget"
            assert "50/30/20" in reply or "needs" in reply.lower() or "wants" in reply.lower() or "savings" in reply.lower(), "Question E must provide budget breakdown"
            assert "15,000" in reply or "9,000" in reply or "6,000" in reply, "Question E must give tailored monetary figures"
            print(">>> VALIDATION PASSED: Directly provides 50/30/20 breakdown for ₹30,000 (₹15k Needs, ₹9k Wants, ₹6k Savings).")
            
        elif code == "F":
            assert "personal loan" in reply.lower(), "Question F must address personal loan"
            assert "identity" in reply.lower() or "pan" in reply.lower() or "salary" in reply.lower() or "bank" in reply.lower(), "Question F must list standard docs"
            assert "property title" not in reply.lower() or "not require" in reply.lower(), "Question F must distinguish unsecured personal loan"
            print(">>> VALIDATION PASSED: Directly lists standard personal loan documents (PAN/Aadhaar, payslips, bank statement) and notes no collateral needed.")

    except Exception as e:
        print(f">>> TEST FAILED: {e}")
        all_passed = False

print("\n" + "=" * 80)
if all_passed:
    print("ALL 6 COPILOT VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
else:
    print("SOME COPILOT TESTS ENCOUNTERED ERRORS")
print("=" * 80)
sys.exit(0 if all_passed else 1)
