import requests

BASE_URL = "http://127.0.0.1:8000/api"

def test_ai():
    res = requests.post(f"{BASE_URL}/login", json={"email": "kicks@campuslink.ng", "password": "Vendor2026!"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # 1. Get AI messages
    m_res = requests.get(f"{BASE_URL}/ai/messages", headers=h)
    assert m_res.status_code == 200, f"Get AI messages failed: {m_res.text}"
    msgs = m_res.json()
    print("1. [PASS] Get AI Messages:", len(msgs), "messages")

    # 2. Chat with AI (Store information)
    c_res = requests.post(
        f"{BASE_URL}/ai/chat",
        json={"message": "Remember that my MAT201 quiz is on Thursday 10am in LT2"},
        headers=h
    )
    assert c_res.status_code == 200, f"Chat with AI failed: {c_res.text}"
    data = c_res.json()
    assert data["is_memory_stored"] is True, "Memory was not detected and stored!"
    assert data["stored_memory"] is not None
    print("2. [PASS] Chat Store Memory:", data["is_memory_stored"])

    # 3. Get memories
    mem_res = requests.get(f"{BASE_URL}/ai/memories", headers=h)
    assert mem_res.status_code == 200
    mems = mem_res.json()
    print("3. [PASS] Fetched Memories Count:", len(mems))
    assert len(mems) > 0, "No memories found!"

    # 4. Recall memories
    rec_res = requests.post(
        f"{BASE_URL}/ai/chat",
        json={"message": "What notes do you have saved?"},
        headers=h
    )
    assert rec_res.status_code == 200
    print("4. [PASS] Recall Query Status: 200 OK")

    # 5. Delete memory
    mem_id = mems[0]["id"]
    del_res = requests.delete(f"{BASE_URL}/ai/memories/{mem_id}", headers=h)
    assert del_res.status_code == 200, f"Delete memory failed: {del_res.text}"
    print(f"5. [PASS] Delete Memory (ID: {mem_id}): 200 OK")

    # 6. Clear chat
    clear_res = requests.post(f"{BASE_URL}/ai/clear", headers=h)
    assert clear_res.status_code == 200
    print("6. [PASS] Clear AI Chat: 200 OK")

    print("\nALL AI TEST SUITES PASSED!")

if __name__ == "__main__":
    test_ai()
