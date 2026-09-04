import requests

BASE_URL = "http://127.0.0.1:8000/api"

def login(email, password="password123"):
    res = requests.post(f"{BASE_URL}/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"], res.json()["user"]

def run_tests():
    print("--- 1. Testing Login ---")
    token_chidinma, user_chidinma = login("student@campuslink.ng")
    token_testimony, user_testimony = login("testimonyjokotoye65@gmail.com")
    print(f"Logged in as {user_chidinma['full_name']} and {user_testimony['full_name']}")

    headers_c = {"Authorization": f"Bearer {token_chidinma}"}
    headers_t = {"Authorization": f"Bearer {token_testimony}"}

    print("\n--- 2. Testing Profile Update Without Password ---")
    update_payload = {
        "full_name": "Chidinma Okeke",
        "department": "Computer Science",
        "level": "400L",
        "hostel": "Moremi Hall Room 204",
        "bio": "Tech enthusiast, frontend engineer and 400L UNILAG student."
    }
    res = requests.put(f"{BASE_URL}/users/profile", json=update_payload, headers=headers_c)
    assert res.status_code == 200, f"Profile update failed: {res.text}"
    updated_user = res.json()["user"]
    assert updated_user["level"] == "400L"
    assert updated_user["hostel"] == "Moremi Hall Room 204"
    print("Profile updated successfully:", updated_user["full_name"], updated_user["department"], updated_user["level"])

    print("\n--- 3. Testing Reel Like / Comment & Notifications ---")
    # Get a reel
    reels_res = requests.get(f"{BASE_URL}/reels", headers=headers_t)
    reels = reels_res.json()
    if reels:
        target_reel = reels[0]
        # Testimony likes target_reel
        like_res = requests.post(f"{BASE_URL}/reels/{target_reel['id']}/like", headers=headers_t)
        print("Like toggle result:", like_res.json())

        # Testimony comments on target_reel
        comment_res = requests.post(f"{BASE_URL}/reels/{target_reel['id']}/comments", json={"content": "Is this gadget still available?"}, headers=headers_t)
        print("Comment result:", comment_res.json().get("content"))

    # Check notifications for Chidinma or target reel author
    notif_res = requests.get(f"{BASE_URL}/notifications", headers=headers_c)
    print("Notifications for Chidinma:", notif_res.json()["unread_count"], "unread")

    print("\n--- 4. Testing WhatsApp-style Status Creation and View ---")
    # Chidinma creates a status
    status_payload = {
        "media_type": "text",
        "caption": "Studying at Central Library Quad today! Come say hi.",
        "background_color": "from-emerald-600 to-teal-800",
        "privacy_setting": "friends"
    }
    st_res = requests.post(f"{BASE_URL}/campus/statuses", json=status_payload, headers=headers_c)
    assert st_res.status_code == 200, f"Status post failed: {st_res.text}"
    st_data = st_res.json()
    print("Created status ID:", st_data["id"], "Privacy:", st_data.get("privacy_setting"))

    # Testimony views the status
    view_res = requests.post(f"{BASE_URL}/campus/statuses/{st_data['id']}/view", headers=headers_t)
    print("Recorded status view result:", view_res.json())

    # Chidinma fetches statuses and checks viewers list
    groups_res = requests.get(f"{BASE_URL}/campus/statuses", headers=headers_c)
    groups = groups_res.json()
    my_group = next((g for g in groups if g["is_self"]), None)
    if my_group and my_group["items"]:
        latest_item = my_group["items"][0]
        print("Self status views_count:", latest_item.get("views_count"), "Viewers:", latest_item.get("viewers"))

    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
