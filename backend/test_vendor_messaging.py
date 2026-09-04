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
uid1 = s1['user']['user_id']

# 2. Login vendor (Campus Kicks)
v = req('POST', '/login', {'email': 'kicks@campuslink.ng', 'password': 'Vendor2026!'})
tv = v['access_token']
vid = v['user']['user_id']

# 3. Student sends message to vendor
m = req('POST', '/messages', {'recipient_id': vid, 'content': 'Hi Campus Kicks, do you have size 43 in stock at SUB?'}, token=t1)
print("Student to Vendor message:", m['content'])

# 4. Vendor reads messages
msgs = req('GET', f"/messages/{uid1}", token=tv)
print("Vendor received message:", msgs[-1]['content'])

# 5. Vendor replies
rep = req('POST', '/messages', {'recipient_id': uid1, 'content': 'Yes we have size 43! Visit shop B4 at SUB or I can dispatch hostel delivery.'}, token=tv)
print("Vendor replied:", rep['content'])

# 6. Student reads reply
conv = req('GET', f"/messages/{vid}", token=t1)
print("Student read vendor reply:", conv[-1]['content'])

print("\n>>> ALL VENDOR <-> STUDENT CHAT TESTS PASSED WITH 100% SUCCESS! <<<")
