Got it! Since we're now using **Nostr Tools** instead of NDK, the architecture will still be similar but with updates to align with **Nostr Tools' API and event handling**.  

---

## **🔹 Key Adjustments for Nostr Tools Integration**  
1. **Cart & Session Management** → **localStorage for persistence**  
2. **Payments** → **NSite Gateway + Nostr Tools for invoice handling & payment DMs**  
3. **Collateral & Booking Confirmation** → **Nostr DM events & signature verification**  
4. **Final Payment** → **Real-time BTC price fetch via Nostr relays**  
5. **Verification & Booking Completion** → **Provider verifies reference keys via Nostr Events**  

---

## **2️⃣ Session Management & Cart Persistence (Static Site Approach)**  

Since **NSite is static**, we need to **store session data locally** and use **Nostr DMs** for communication.  

### **🔹 Steps for Cart Handling (Static NSite)**
- **Store cart data in `localStorage`**:  
  ```json
  {
    "items": [{ "id": "package1", "price": 50000, "qty": 1 }],
    "locked_price": 50000,
    "collateral_paid": false
  }
  ```
- When the user **returns**, the cart restores automatically.  
- **NDK is replaced with `nostr-tools` to sign and send messages.**  

---

## **3️⃣ Collateral Payment & Booking Confirmation**  

### **🔹 Payment Flow Using NSite Gateway + Nostr Tools**
1. **User selects a package & clicks "Reserve"**  
2. **Invoice is created via NSite Gateway**  
   ```js
   const invoice = await fetch("https://your-nsite-gateway.com/create-invoice", {
     method: "POST",
     body: JSON.stringify({ amount: 50000, memo: "Booking Collateral" })
   }).then(res => res.json());
   ```
3. **User pays invoice & nostr-tools sends confirmation DM**  
4. **Cart updates to mark collateral as paid**  

---

## **3.2 Payment Methods & Tips**  

### **🔹 Payment Handling**
- **Lightning** (up to **900k sats**)  
- **On-Chain BTC** (**over 900k sats**)  
- **eCash** (**under 150k sats, except tips**)  

### **🔹 Tip Handling**
- **Tips handled via Nutzaps**  
- **User selects tip amount & sends via Nostr invoice or eCash**  

---

## **4️⃣ Final Payment & DM Flow**  

### **🔹 Steps for Final Payment**
1. **User clicks "Fetch Remaining Balance"**  
2. **Nostr Tools fetches latest BTC price & fees**  
3. **Final payment request sent via Nostr DM (4 days before activity)**  
4. **User pays via NSite Gateway**  
5. **Nostr event logs transaction confirmation**  

---

## **5️⃣ Verification & Booking Completion**  

### **🔹 How Providers Verify Bookings**
- **Nostr Event Lookup:** Provider queries payment event.  
- **Manual Entry:** User enters reference key.  
- **QR Scan (Optional)**  

### **🔹 Final Access Flow**
1. **Provider confirms payment & reference key**  
2. **Booking is marked as complete**  
3. **User gains access to service**  

---

## **📌 Summary (Updated for Nostr Tools)**
✅ **Uses Nostr Tools for DMs & payment tracking**  
✅ **NSite-Gateway for invoice creation**  
✅ **localStorage for cart persistence**  
✅ **No backend, fully browser-based**  

This structure ensures a **fully decentralized** flow while keeping the booking system **fast & lightweight**. 🚀 Let me know if any refinements are needed!