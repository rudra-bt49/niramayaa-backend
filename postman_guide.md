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
**Expected Response**: `success: true` if the OTP matches.

---

### Step 3: Patient Signup
**Endpoint**: `POST /api/auth/patient-signup`  
**Body**:
```json
{
    "email": "test@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "9876543210",
    "password": "Password@123",
    "gender": "MALE",
    "city": "MUMBAI",
    "dob": "1995-01-01",
    "otp_token": "PASTE_TOKEN_FROM_STEP_1",
    "otp": "123456"
}
```
**Expected Response**: User object + `accessToken` + `refreshToken` (in cookie).

---

## 3. Login & Session Management

### Login (First Device)
**Endpoint**: `POST /api/auth/login`  
**Body**:
```json
{
    "email": "test@example.com",
    "password": "Password@123"
}
```

### Login (Second Device Attempt)
If you try to login again while the first session is active:
**Expected Response**: `409 Conflict` - "You are already logged in on another device..."

### Force Logout (Confirm Login)
To logout from the other device and login here:
**Body**:
```json
{
    "email": "test@example.com",
    "password": "Password@123",
    "forceLogout": true
}
```

---

## 4. Health Check
**Endpoint**: `GET /`  
**Expected Response**: `Niramayaa backend is up and running 🚀`
