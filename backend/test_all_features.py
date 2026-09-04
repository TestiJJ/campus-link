import requests

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=== CAMPUSLINK FULL COMPREHENSIVE VERIFICATION ===")
    
    # 1. Login
    login_res = requests.post(f"{BASE_URL}/login", json={
        "email": "student@campuslink.ng",
        "password": "password123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("1. [PASS] Student Login: 200 OK")

    # 2. Get Profile & Update Profile without Password
    me_res = requests.get(f"{BASE_URL}/me", headers=headers)
    assert me_res.status_code == 200, f"Get /me failed: {me_res.text}"
    profile = me_res.json()
    print(f"2. [PASS] Fetch /me: {profile['full_name']} ({profile['email']})")

    update_payload = {
        "full_name": profile["full_name"],
        "bio": "400L Mechanical Engineering student passionate about robotics & campus community.",
        "phone_number": "08012345678",
        "department": "Mechanical Engineering",
        "level": "400L",
        "hostel": "Moremi Hall Room 204"
    }
    up_res = requests.put(f"{BASE_URL}/users/profile", json=update_payload, headers=headers)
    assert up_res.status_code == 200, f"Update profile failed: {up_res.text}"
    updated_user = up_res.json()["user"]
    assert updated_user["bio"] == update_payload["bio"]
    assert updated_user["level"] == "400L"
    print("3. [PASS] Profile Update without Password Roadblock: 200 OK")

    # 3. Test Notifications
    notif_res = requests.get(f"{BASE_URL}/notifications", headers=headers)
    assert notif_res.status_code == 200, f"Get notifications failed: {notif_res.text}"
    notif_data = notif_res.json()
    notifs = notif_data.get("notifications", [])
    print(f"4. [PASS] Fetch Notifications: {len(notifs)} notifications found (Unread count: {notif_data.get('unread_count')})")

    if notifs:
        read_res = requests.post(f"{BASE_URL}/notifications/{notifs[0]['id']}/read", headers=headers)
        assert read_res.status_code == 200
        print(f"5. [PASS] Mark Single Notification Read: 200 OK")

    read_all_res = requests.post(f"{BASE_URL}/notifications/read-all", headers=headers)
    assert read_all_res.status_code == 200
    print("6. [PASS] Mark All Notifications Read: 200 OK")

    # 4. Status Story with Friends Privacy
    status_payload = {
        "media_type": "text",
        "caption": "Studying late at the engineering library for exams! 📚⚡",
        "background_color": "from-emerald-600 to-teal-800",
        "privacy_setting": "friends",
        "allowed_user_ids": []
    }
    status_res = requests.post(f"{BASE_URL}/campus/statuses", json=status_payload, headers=headers)
    assert status_res.status_code == 200, f"Post status failed: {status_res.text}"
    new_status = status_res.json()
    print(f"7. [PASS] Post Status with 'friends' Privacy: ID {new_status['id']}")

    # 5. Fetch Statuses
    statuses_res = requests.get(f"{BASE_URL}/campus/statuses", headers=headers)
    assert statuses_res.status_code == 200
    groups = statuses_res.json()
    print(f"8. [PASS] Fetch Campus Statuses: {len(groups)} user story group(s)")

    # 6. Verify Services have Distinct Images & Accurate Data
    services_res = requests.get(f"{BASE_URL}/services")
    assert services_res.status_code == 200
    services = services_res.json()
    svc_images = [s.get("image") for s in services]
    assert len(svc_images) == len(set(svc_images)), f"Duplicate service image detected: {svc_images}"
    print(f"9. [PASS] Verify Essential Services: {len(services)} services with 100% unique images")
    for s in services:
        print(f"   - {s['name']}: NGN {s['price']:,.0f} ({s.get('location')})")

    # 7. Verify Products have Distinct Images
    prod_res = requests.get(f"{BASE_URL}/products")
    assert prod_res.status_code == 200
    products = prod_res.json()
    prod_images = [p.get("image") for p in products]
    assert len(prod_images) == len(set(prod_images)), f"Duplicate product image detected: {prod_images}"
    # Also verify no collision between products and services
    all_images = svc_images + prod_images
    assert len(all_images) == len(set(all_images)), "Duplicate image between product and service!"
    print(f"10. [PASS] Verify Products: {len(products)} products with 100% unique images (zero duplicates with services)")
    for p in products:
        print(f"   - {p['name']}: NGN {p['price']:,.0f}")

    # 11. Test Reel Creation, Comment, Comment Delete, and Reel Post Deletion
    reel_payload = {
        "title": "Study session at the library quad",
        "description": "Finals prep with the team! #CampusMoments",
        "media_type": "text",
        "location": "UNILAG Central Library"
    }
    create_reel_res = requests.post(f"{BASE_URL}/reels", json=reel_payload, headers=headers)
    assert create_reel_res.status_code == 200, f"Create reel failed: {create_reel_res.text}"
    created_reel = create_reel_res.json()
    reel_id = created_reel["id"]
    print(f"11. [PASS] Create Campus Reel Post (ID: {reel_id}): 200 OK")

    # Add comment to reel
    comment_res = requests.post(f"{BASE_URL}/reels/{reel_id}/comments", json={"content": "Good luck with prep!"}, headers=headers)
    assert comment_res.status_code == 200, f"Comment on reel failed: {comment_res.text}"
    comment_id = comment_res.json()["id"]
    print(f"    - [PASS] Add Comment to Reel (ID: {comment_id}): 200 OK")

    # Delete comment from reel
    del_comment_res = requests.delete(f"{BASE_URL}/reels/comments/{comment_id}", headers=headers)
    assert del_comment_res.status_code == 200, f"Delete reel comment failed: {del_comment_res.text}"
    print(f"    - [PASS] Delete Reel Comment (ID: {comment_id}): 200 OK")

    # Delete reel post
    del_reel_res = requests.delete(f"{BASE_URL}/reels/{reel_id}", headers=headers)
    assert del_reel_res.status_code == 200, f"Delete reel failed: {del_reel_res.text}"
    print(f"    - [PASS] Delete Reel Post by Author (ID: {reel_id}): 200 OK")

    # Verify reel is gone
    all_reels = requests.get(f"{BASE_URL}/reels").json()
    assert not any(r["id"] == reel_id for r in all_reels), "Deleted reel still returned in feed!"
    print("    - [PASS] Verified Deleted Reel is completely gone from feed")

    # 12. Test Campus Notice Creation and Deletion
    notice_payload = {
        "type": "lost",
        "title": "Lost Scientific Calculator FX-991EX",
        "category": "phone_gadget",
        "description": "Left in room 204 after physics lecture",
        "location": "Faculty of Science Room 204"
    }
    create_not_res = requests.post(f"{BASE_URL}/campus/notices", json=notice_payload, headers=headers)
    assert create_not_res.status_code == 200, f"Create notice failed: {create_not_res.text}"
    notice_id = create_not_res.json()["id"]
    print(f"12. [PASS] Create Campus Notice (ID: {notice_id}): 200 OK")

    del_not_res = requests.delete(f"{BASE_URL}/campus/notices/{notice_id}", headers=headers)
    assert del_not_res.status_code == 200, f"Delete notice failed: {del_not_res.text}"
    print(f"    - [PASS] Delete Campus Notice (ID: {notice_id}): 200 OK")

    # 13. Test Campus Status Creation and Deletion
    status_payload = {
        "media_type": "text",
        "caption": "Chilling at the amphitheatre",
        "background_color": "from-emerald-600 to-teal-800",
        "privacy_setting": "friends"
    }
    create_st_res = requests.post(f"{BASE_URL}/campus/statuses", json=status_payload, headers=headers)
    assert create_st_res.status_code == 200, f"Create status failed: {create_st_res.text}"
    status_id = create_st_res.json()["id"]
    print(f"13. [PASS] Create Campus Story (ID: {status_id}): 200 OK")

    del_st_res = requests.delete(f"{BASE_URL}/campus/statuses/{status_id}", headers=headers)
    assert del_st_res.status_code == 200, f"Delete status failed: {del_st_res.text}"
    print(f"    - [PASS] Delete Campus Story (ID: {status_id}): 200 OK")

    # 14. Verify Student Contact Privacy
    students_res = requests.get(f"{BASE_URL}/students", headers=headers)
    assert students_res.status_code == 200
    for s in students_res.json():
        if s.get("role") != "vendor":
            assert s.get("phone_number") is None, f"Student phone exposed: {s.get('full_name')} -> {s.get('phone_number')}"
    print("14. [PASS] Student Contact Privacy Verified (0 student phone numbers leaked)")

    print("\nALL 14 COMPREHENSIVE SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
