# Postman API Testing Guide - Niramayaa Auth

This guide walk you through testing the authentication flow using Postman.

## 1. Environment Setup
- **Base URL**: `http://localhost:5000` (or your actual port)
- **Headers**: `Content-Type: application/json`

---

## 2. Authentication Flow (Stateless OTP)

### Step 1: Send Verification OTP
**Endpoint**: `POST /api/send-verification-otp`  
**Body**:
```json
{
    "email": "test@example.com"
}
```
> [!NOTE]
> Check your **Backend Console** (terminal) to see the generated 6-digit OTP.

**Expected Response**: Returns a `token`. Copy this token.

---

### Step 2: Verify OTP
**Endpoint**: `POST /api/verify-otp`  
**Body**:
```json
{
    "token": "PASTE_TOKEN_FROM_STEP_1",
    "otp": "123456" 
}
```
**Expected Response**: Returns a `verification_token`. **Copy this token** — it is required for registration.

---

## 3. Patient Signup Flow
**Endpoint**: `POST /api/auth/patient-signup`  
**Body**:
```json
{
    "email": "patient@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "9876543210",
    "password": "Password@123",
    "gender": "MALE",
    "city": "MUMBAI",
    "dob": "1995-01-01",
    "verification_token": "PASTE_TOKEN_FROM_STEP_2"
}
```
**Expected Response**: User object + `accessToken`.

---

## 4. Doctor Signup (Resilient Flow)

### Step 4.1: Initiate Signup
**Endpoint**: `POST /api/auth/doctor-signup`  
**Body**:
```json
{
    "email": "doctor@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "phone_number": "9999988888",
    "password": "Password@123",
    "gender": "FEMALE",
    "city": "PUNE",
    "dob": "1985-05-15",
    "qualifications": ["MBBS", "MD"],
    "experience": 10,
    "specialties": ["CARDIOLOGY"],
    "consultation_fee": 1000,
    "plan_name": "PRO",
    "verification_token": "PASTE_TOKEN_FROM_STEP_2"
}
```
**Expected Response**: `sessionUrl` (Stripe Link).

### Step 4.2: Payment & Webhook
1. Open the `sessionUrl` in a browser and finish payment with a test card (4242...).
2. Stripe will call your host's Webhook (use **Stripe CLI** to listen locally).

### Step 4.3: Auto-Login
**Endpoint**: `POST /api/auth/doctor-signup/verify-session`  
**Body**:
```json
{
    "session_id": "PASTE_cs_test_SESSION_ID_FROM_SUCCESS_URL"
}
```
**Expected Response**: Logged in user data + `accessToken`.

---

## 5. Simulating Webhooks (Stripe CLI)
To test the flow without a real domain:
1.  [Install Stripe CLI](https://stripe.com/docs/stripe-cli).
2.  Run: `stripe listen --forward-to http://localhost:5000/api/payments/webhook`.
3.  The console will show "✅ Success" when the webhook hits your local server.

---

## 6. Password Reset Flow

### Step 6.1: Forgot Password
**Endpoint**: `POST /api/auth/forgot-password`  
**Body**:
```json
{
    "email": "doctor@example.com"
}
```
> [!NOTE]
> Check your **Backend Console** (terminal) to see the reset token.

### Step 6.2: Reset Password
**Endpoint**: `POST /api/auth/reset-password`  
**Body**:
```json
{
    "token": "PASTE_TOKEN_FROM_CONSOLE",
    "password": "NewPassword@123"
}
```

---

## 7. Login & Session Management
... (rest of the file remains same)
