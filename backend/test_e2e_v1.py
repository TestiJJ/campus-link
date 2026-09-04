import urllib.request
import urllib.parse
import json

BASE = "http://127.0.0.1:8000/api"

def api_call(endpoint, method="GET", data=None, token=None, form_data=None):
    url = f"{BASE}{endpoint}"
    headers = {}
    body = None

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if form_data:
        body = urllib.parse.urlencode(form_data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        res_data = resp.read().decode("utf-8")
        return json.loads(res_data) if res_data else {}

def test_full_flow():
    print("--- 1. Testing Admin Authentication ---")
    admin_auth = api_call("/login", method="POST", data={
        "email": "admin@campuslink.ng",
        "password": "Admin2026!"
    })
    admin_token = admin_auth["access_token"]
    print("[OK] Admin login successful. Token acquired.")

    print("\n--- 2. Testing Vendor Verification Queue ---")
    pending_list = api_call("/admin/vendors/pending", token=admin_token)
    print(f"[OK] Pending vendors in queue: {len(pending_list)}")
    for v in pending_list:
        print(f"  - Business: {v['business_name']} | Front ID: {v['id_card_front'][:30]}... | Back ID: {v['id_card_back'][:30]}...")

    if len(pending_list) > 0:
        target_vendor = pending_list[0]
        print(f"\n--- 3. Testing Admin Approval for Vendor #{target_vendor['id']} ({target_vendor['business_name']}) ---")
        action_res = api_call(
            f"/admin/vendors/{target_vendor['id']}/action",
            method="POST",
            data={"action": "approve"},
            token=admin_token
        )
        print(f"[OK] Approval response: {action_res}")

        # Verify queue is updated
        pending_after = api_call("/admin/vendors/pending", token=admin_token)
        print(f"[OK] Pending vendors after approval: {len(pending_after)}")

    print("\n--- 4. Testing Admin Stats ---")
    stats = api_call("/admin/stats", token=admin_token)
    print(f"[OK] Platform Stats: {stats}")

    print("\n--- 5. Testing Student Auth & Actions ---")
    student_auth = api_call("/login", method="POST", data={
        "email": "student@campuslink.ng",
        "password": "Student2026!"
    })
    student_token = student_auth["access_token"]
    print("[OK] Student login successful.")

    print("\n--- 6. Testing TikTok Campus Reels Feed ---")
    reels = api_call("/reels")
    print(f"[OK] Existing Reels: {len(reels)}")
    
    # Post new student reel
    new_reel = api_call("/reels", method="POST", data={
        "title": "Semester Exam Kickoff at Main Quad",
        "description": "Everyone is studying hard today. Let's get that first class!",
        "media_url": "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80",
        "media_type": "image",
        "location": "UNILAG Main Library Steps"
    }, token=student_token)
    print(f"[OK] Created Reel #{new_reel['id']}: {new_reel['title']} by {new_reel['author_name']}")

    # Like the reel
    like_res = api_call(f"/reels/{new_reel['id']}/like", method="POST")
    print(f"[OK] Liked reel #{new_reel['id']}: now has {like_res['likes_count']} likes")

    print("\n--- 7. Testing Campus Rides API ---")
    ride = api_call("/rides/book", method="POST", data={
        "ride_type": "Campus Shuttle",
        "pickup_location": "Main Gate Campus Terminal",
        "dropoff_location": "New Hall Hostels Quad"
    }, token=student_token)
    print(f"[OK] Booked Ride #{ride['id']}: {ride['ride_type']} | Fare: NGN {ride['estimated_fare']} | Driver: {ride['driver_name']} ({ride['plate_number']})")

    # Fetch student's rides
    my_rides = api_call("/rides/my-rides", token=student_token)
    print(f"[OK] Student total rides on record: {len(my_rides)}")

    print("\n--- 8. Testing Ordering from Campus Marketplace ---")
    products = api_call("/products")
    assert len(products) > 0, "No products found in marketplace"
    order_item = products[0]
    print(f"Ordering item: {order_item['name']} (NGN {order_item['price']}) from Vendor #{order_item['vendor_id']}")

    order_res = api_call("/orders", method="POST", data={
        "vendor_id": order_item["vendor_id"],
        "item_title": order_item["name"],
        "product_id": order_item["id"],
        "service_id": None,
        "quantity": 2,
        "amount": order_item["price"] * 2,
        "delivery_location": "Moremi Hall Room B12"
    }, token=student_token)
    print(f"[OK] Order placed successfully: Order #{order_res['id']} for NGN {order_res['amount']}")

    print("\n========================================================")
    print("ALL API FLOWS (ADMIN VERIFICATION, REELS, RIDES, ORDERS) PASSED!")
    print("========================================================")

if __name__ == "__main__":
    test_full_flow()
