import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from main import generate_campus_ai_reply

def test_questions():
    print("Testing upgraded AI reasoning engine with grammar, replies, definitions & math...")

    # 1. Grammar: What is a noun?
    p1 = "what is a noun"
    r1 = generate_campus_ai_reply(p1, "student", [])[0]
    assert "Proper Noun" in r1 and "Common Noun" in r1, f"Failed on noun test: {r1[:100]}"
    print("1. [PASS] 'What is a noun' answered with complete grammar breakdown!")

    # 2. Communication: How do I reply to this?
    p2 = "how do i reply to this: customer asking for a 40% discount on shoes"
    r2 = generate_campus_ai_reply(p2, "vendor", [])[0]
    assert "Option 1" in r2 and "Option 2" in r2, f"Failed on reply test: {r2[:100]}"
    print("2. [PASS] 'How do I reply to this' answered with tailored message options!")

    # 3. Random question: What is 25% of 80000?
    p3 = "what is 25% of 80000"
    r3 = generate_campus_ai_reply(p3, "student", [])[0]
    assert "20000" in r3, f"Failed on percentage calculation: {r3[:100]}"
    print("3. [PASS] 'What is 25% of 80000' calculated correctly (20,000)!")

    # 4. Definition: What is photosynthesis?
    p4 = "explain photosynthesis"
    r4 = generate_campus_ai_reply(p4, "student", [])[0]
    assert "light energy" in r4.lower() or "glucose" in r4.lower(), f"Failed on photosynthesis test: {r4[:100]}"
    print("4. [PASS] 'Explain photosynthesis' answered accurately!")

    # 5. Casual: How do I reply to a friend asking for notes?
    p5 = "how do i reply to: can you send me your bio lecture notes?"
    r5 = generate_campus_ai_reply(p5, "student", [])[0]
    assert "Option" in r5, f"Failed on friend reply: {r5[:100]}"
    print("5. [PASS] Casual reply advice generated!")

    print("\nALL USER-REQUESTED SCENARIOS PASSED WITH FLYING COLORS!")

if __name__ == "__main__":
    test_questions()
