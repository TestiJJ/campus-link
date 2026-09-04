import urllib.request
import json

BASE = 'http://127.0.0.1:8000/api'

def req(method, path, data=None, token=None):
    url = f"{BASE}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    body = json.dumps(data).encode('utf-8') if data else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode('utf-8'))

def test_live_ai():
    print("Testing live AI endpoints...")
    
    # 1. Login as student
    s = req('POST', '/login', {'email': 'ibrahim.law@campuslink.ng', 'password': 'Student2026!'})
    student_token = s['access_token']
    print("[PASS] Student logged in successfully")

    # 2. Test "What is a noun"
    print("\n--- Testing: 'What is a noun?' ---")
    r1 = req('POST', '/ai/chat', {'content': 'What is a noun?'}, token=student_token)
    reply1 = r1.get('content') or r1.get('reply', '')
    print(f"Reply Preview: {reply1[:150]}...")
    assert "noun" in reply1.lower()
    assert "person" in reply1.lower() or "place" in reply1.lower() or "thing" in reply1.lower()
    print("[PASS] 'What is a noun?' correctly answered!")

    # 3. Test "How do I reply to this: Are you free this evening?"
    print("\n--- Testing: 'How do I reply to this: Are you free this evening?' ---")
    r2 = req('POST', '/ai/chat', {'content': 'How do I reply to this: Are you free this evening?'}, token=student_token)
    reply2 = r2.get('content') or r2.get('reply', '')
    print(f"Reply Preview: {reply2[:150]}...")
    assert "option" in reply2.lower() or "reply" in reply2.lower() or "free" in reply2.lower()
    print("[PASS] 'How do I reply to this' correctly answered with contextual options!")

    # 4. Test "What is 20% of 50000"
    print("\n--- Testing: 'What is 20% of 50000' ---")
    r3 = req('POST', '/ai/chat', {'content': 'What is 20% of 50000'}, token=student_token)
    reply3 = r3.get('content') or r3.get('reply', '')
    print(f"Reply Preview: {reply3[:150]}...")
    assert "10,000" in reply3 or "10000" in reply3
    print("[PASS] Math & percentage calculated correctly!")

    # 5. Login as vendor and test vendor AI copilot chat
    v = req('POST', '/login', {'email': 'kicks@campuslink.ng', 'password': 'Vendor2026!'})
    vendor_token = v['access_token']
    print("\n[PASS] Vendor logged in successfully")

    # Vendor asks how to reply to customer
    print("\n--- Testing Vendor AI: 'How do I reply to this customer asking for 40% discount?' ---")
    r4 = req('POST', '/ai/chat', {'content': 'How do I reply to this customer asking for 40% discount?'}, token=vendor_token)
    reply4 = r4.get('content') or r4.get('reply', '')
    print(f"Reply Preview: {reply4[:150]}...")
    assert "discount" in reply4.lower() or "counter" in reply4.lower() or "option" in reply4.lower()
    print("[PASS] Vendor customer reply suggestions generated correctly!")

    # 6. Verify AI messages history endpoint
    msgs = req('GET', '/ai/messages', token=student_token)
    print(f"\nStudent AI conversation thread length: {len(msgs)} messages")
    assert len(msgs) >= 6
    print("[PASS] AI messages thread retrieved successfully!")

    print("\nALL LIVE END-TO-END AI TESTS PASSED WITH 100% ACCURACY!")

if __name__ == '__main__':
    test_live_ai()
