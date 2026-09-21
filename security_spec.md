# Firestore Security Specification

## Master Data Invariants
1. **Admins:** The user whose authenticated email is `sorkarporosh6@gmail.com` or whose UID exists in `/admins/{uid}` has full administrative privileges over settings, services, orders, deposits, banners, tutorials, and categories.
2. **Users:** A user can read and manage their own user record (`/users/{uid}`). A user cannot increase their own balance directly.
3. **Public Catalog & Recent Orders Feed:** Services, products, banners, tutorials, general settings, and recent fulfillment activity (`/orders` public feed) are readable by anyone (public read) so visitors and customers can view games, prices, instructions, announcements, and live proof of top-up fulfillment.
4. **Orders Management:** Authenticated customers can create their orders where `userId == request.auth.uid`. Only administrators can alter existing orders (status completion or refunds) or delete orders.
5. **Deposits:** Authenticated customers can create deposit requests where `userId == request.auth.uid` and can read deposits to verify transaction IDs and order history. Only admins can update deposit status (`approved`, `rejected`).
6. **Stock:** Product stock items contain redemption codes and can only be managed by admins.

## The Dirty Dozen Payloads (Designed to be REJECTED)
1. **Identity Spoofing in Orders:** Customer `user_a` tries to create an order with `userId: "user_b"`. (Expected: PERMISSION_DENIED)
2. **Self-Approval in Deposits:** Customer creates deposit with `status: "approved"`. (Expected: PERMISSION_DENIED)
3. **Balance Self-Inflation:** Customer tries to update `/users/{uid}` with `balance: 999999`. (Expected: PERMISSION_DENIED)
4. **Unauthenticated Order Creation:** Unauthenticated client tries to submit an order. (Expected: PERMISSION_DENIED)
5. **Order Scraping:** Customer `user_a` tries to query or read customer `user_b`'s orders. (Expected: PERMISSION_DENIED)
6. **Deposit Scraping:** Customer `user_a` tries to query or read customer `user_b`'s deposits. (Expected: PERMISSION_DENIED)
7. **Unauthorized Service Deletion:** Regular user attempts to delete a game service. (Expected: PERMISSION_DENIED)
8. **Malicious Stock Harvest:** Regular user attempts to read all codes in `/stock`. (Expected: PERMISSION_DENIED)
9. **Settings Overwrite:** Regular user attempts to change payment numbers in `/admin/payment`. (Expected: PERMISSION_DENIED)
10. **Ghost Field Injection in Deposit:** Customer submits a deposit with arbitrary extra executable payload or invalid method. (Expected: PERMISSION_DENIED)
11. **Oversized String Bomb:** Attempt to insert a 2MB string into game name or order note. (Expected: PERMISSION_DENIED)
12. **Status Tampering:** Customer attempts to update status of an existing order to `success`. (Expected: PERMISSION_DENIED)
