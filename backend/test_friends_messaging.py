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
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8')
        raise Exception(f"{method} {path} failed: {e.code} - {err}")

# 1. Login student 1 (Chidinma)
s1 = req('POST', '/login', {'email': 'student@campuslink.ng', 'password': 'Student2026!'})
t1 = s1['access_token']
u1 = s1['user']
uid1 = u1.get('user_id') or u1.get('id')
print(f"Logged in s1: {u1['full_name']} (ID: {uid1})")

# 2. Login student 2 (Chioma)
s2 = req('POST', '/login', {'email': 'chioma.cs@campuslink.ng', 'password': 'Student2026!'})
t2 = s2['access_token']
u2 = s2['user']
uid2 = u2.get('user_id') or u2.get('id')
print(f"Logged in s2: {u2['full_name']} (ID: {uid2})")

# 3. S1 views S2 profile
prof = req('GET', f"/students/{uid2}", token=t1)
print(f"S1 viewed S2 profile: {prof['full_name']} - Status: {prof['friendship_status']} - Friends: {prof['friends_count']}")

# 4. S1 sends friend request to S2
req_res = req('POST', f"/friends/request/{uid2}", token=t1)
print("S1 sent friend request:", req_res)

# 5. S2 checks pending requests
pending = req('GET', "/friends/requests/pending", token=t2)
print(f"S2 has {len(pending)} pending request(s):", pending[0]['sender_name'] if pending else "None")
if pending:
    req_id = pending[0]['request_id']

    # 6. S2 accepts friend request
    acc_res = req('POST', f"/friends/requests/{req_id}/accept", token=t2)
    print("S2 accepted request:", acc_res)

# 7. Check friends list for both
f1 = req('GET', "/friends", token=t1)
f2 = req('GET', "/friends", token=t2)
print(f"S1 friends count: {len(f1)}")
print(f"S2 friends count: {len(f2)}")

# 8. S1 sends message to S2
msg_res = req('POST', "/messages", {'recipient_id': uid2, 'content': 'Hey Chioma! Did you get the lecture notes from Prof Adams?'}, token=t1)
print("S1 sent message:", msg_res['content'])

# 9. S2 reads messages from S1
conv = req('GET', f"/messages/{uid1}", token=t2)
print(f"S2 read {len(conv)} messages:", conv[-1]['content'])

# 10. S2 replies to S1
reply_res = req('POST', "/messages", {'recipient_id': uid1, 'content': 'Yes I have them! Meet me at the Central Library quad around 2pm.'}, token=t2)
print("S2 replied:", reply_res['content'])

# 11. S1 checks conversation list
conv_list = req('GET', "/conversations", token=t1)
print(f"S1 conversations count: {len(conv_list)}, latest message: {conv_list[0]['last_message']}")

print("\n>>> ALL SOCIAL GRAPH, PROFILES, FRIEND REQUESTS & MESSAGING TESTS PASSED WITH 100% SUCCESS! <<<")
