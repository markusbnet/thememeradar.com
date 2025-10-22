# Authentication System - Complete Test Plan

## 🎯 Test Coverage Requirements

**100% test coverage for authentication system including:**
1. Unit tests (utilities, helpers)
2. Integration tests (API endpoints, database operations)
3. **Playwright UI tests (all user interactions)**

---

## 📋 Test Breakdown

### 1. Unit Tests (Jest)

#### `lib/auth/password.test.ts`
- [x] Should hash password with bcrypt (10 rounds)
- [x] Should return different hash for same password (salting)
- [x] Should verify correct password against hash
- [x] Should reject incorrect password
- [x] Should enforce minimum password length (8 chars)
- [x] Should enforce password complexity (uppercase, lowercase, number, special char)
- [x] Should reject weak passwords

#### `lib/auth/jwt.test.ts`
- [x] Should generate valid JWT token with userId payload
- [x] Should set correct expiration (7 days)
- [x] Should verify valid JWT token and return payload
- [x] Should reject expired JWT token
- [x] Should reject invalid JWT token (wrong secret)
- [x] Should reject malformed JWT token

#### `lib/auth/validation.test.ts`
- [x] Should validate correct email format
- [x] Should reject invalid email formats
- [x] Should validate password requirements
- [x] Should sanitize input (XSS prevention)

---

### 2. Integration Tests (Jest)

#### `tests/integration/api/auth/signup.test.ts`
**POST /api/auth/signup**
- [x] Should create new user with valid email + password
- [x] Should return 201 status and JWT token
- [x] Should hash password in database (not plain text)
- [x] Should reject duplicate email (409 Conflict)
- [x] Should reject invalid email format (400 Bad Request)
- [x] Should reject weak password (400 Bad Request)
- [x] Should reject missing email field (400 Bad Request)
- [x] Should reject missing password field (400 Bad Request)
- [x] Should trim whitespace from email
- [x] Should normalize email to lowercase
- [x] Should enforce rate limiting (5 attempts per 15 min)
- [x] Should set httpOnly cookie with JWT token

#### `tests/integration/api/auth/login.test.ts`
**POST /api/auth/login**
- [x] Should authenticate user with correct email + password
- [x] Should return 200 status and JWT token
- [x] Should update lastLoginAt timestamp in database
- [x] Should reject incorrect password (401 Unauthorized)
- [x] Should reject non-existent email (401 Unauthorized)
- [x] Should reject missing credentials (400 Bad Request)
- [x] Should enforce rate limiting (5 attempts per 15 min)
- [x] Should set httpOnly cookie with JWT token
- [x] Should accept email case-insensitively (test@test.com = TEST@TEST.COM)

#### `tests/integration/api/auth/logout.test.ts`
**POST /api/auth/logout**
- [x] Should clear JWT cookie
- [x] Should return 200 status
- [x] Should work even if user not logged in (idempotent)

#### `tests/integration/api/auth/me.test.ts`
**GET /api/auth/me** (protected endpoint)
- [x] Should return current user data when authenticated
- [x] Should return 401 when no JWT token provided
- [x] Should return 401 when JWT token is invalid
- [x] Should return 401 when JWT token is expired
- [x] Should not return passwordHash in response

#### `tests/integration/middleware/auth-middleware.test.ts`
**Auth Middleware (for protected routes)**
- [x] Should allow access with valid JWT token
- [x] Should block access without JWT token (401)
- [x] Should block access with invalid JWT token (401)
- [x] Should block access with expired JWT token (401)
- [x] Should attach user object to request context
- [x] Should handle malformed tokens gracefully

---

### 3. Playwright UI Tests (E2E)

#### `tests/e2e/auth/signup.spec.ts`
**User Signup Flow**

**Test: Successful signup with valid credentials**
- [ ] Navigate to /signup page
- [ ] Verify signup form is visible
- [ ] Fill email field with `newuser@test.com`
- [ ] Fill password field with `ValidPass123!`
- [ ] Click "Sign Up" button
- [ ] Verify redirect to /dashboard
- [ ] Verify user is authenticated (see dashboard content)
- [ ] Verify no error messages displayed

**Test: Show error for invalid email format**
- [ ] Navigate to /signup page
- [ ] Fill email field with `invalid-email`
- [ ] Fill password field with `ValidPass123!`
- [ ] Click "Sign Up" button
- [ ] Verify error message "Invalid email format" is displayed
- [ ] Verify user remains on /signup page
- [ ] Verify not redirected

**Test: Show error for weak password**
- [ ] Navigate to /signup page
- [ ] Fill email field with `test@test.com`
- [ ] Fill password field with `weak`
- [ ] Click "Sign Up" button
- [ ] Verify error message "Password must be at least 8 characters" is displayed
- [ ] Verify user remains on /signup page

**Test: Show error for duplicate email**
- [ ] Create existing user via API setup
- [ ] Navigate to /signup page
- [ ] Fill email field with existing user's email
- [ ] Fill password field with `ValidPass123!`
- [ ] Click "Sign Up" button
- [ ] Verify error message "Email already registered" is displayed

**Test: Form validation on empty fields**
- [ ] Navigate to /signup page
- [ ] Click "Sign Up" button without filling fields
- [ ] Verify error messages for both email and password
- [ ] Verify form not submitted

**Test: Password visibility toggle**
- [ ] Navigate to /signup page
- [ ] Fill password field with `ValidPass123!`
- [ ] Verify password is masked (type="password")
- [ ] Click "Show password" icon
- [ ] Verify password is visible (type="text")
- [ ] Click "Hide password" icon
- [ ] Verify password is masked again

---

#### `tests/e2e/auth/login.spec.ts`
**User Login Flow**

**Test: Successful login with valid credentials**
- [ ] Create test user via API setup
- [ ] Navigate to /login page
- [ ] Verify login form is visible
- [ ] Fill email field with test user email
- [ ] Fill password field with test user password
- [ ] Click "Log In" button
- [ ] Verify redirect to /dashboard
- [ ] Verify user is authenticated
- [ ] Verify no error messages

**Test: Show error for incorrect password**
- [ ] Create test user via API setup
- [ ] Navigate to /login page
- [ ] Fill email field with test user email
- [ ] Fill password field with `WrongPassword123!`
- [ ] Click "Log In" button
- [ ] Verify error message "Invalid email or password" is displayed
- [ ] Verify user remains on /login page
- [ ] Verify not redirected

**Test: Show error for non-existent email**
- [ ] Navigate to /login page
- [ ] Fill email field with `nonexistent@test.com`
- [ ] Fill password field with `SomePass123!`
- [ ] Click "Log In" button
- [ ] Verify error message "Invalid email or password" is displayed
- [ ] Verify user remains on /login page

**Test: Email case-insensitivity**
- [ ] Create test user with email `test@test.com`
- [ ] Navigate to /login page
- [ ] Fill email field with `TEST@TEST.COM` (uppercase)
- [ ] Fill password field with correct password
- [ ] Click "Log In" button
- [ ] Verify successful login (case-insensitive)

**Test: Link to signup page**
- [ ] Navigate to /login page
- [ ] Click "Don't have an account? Sign up" link
- [ ] Verify redirect to /signup page

---

#### `tests/e2e/auth/protected-routes.spec.ts`
**Protected Routes (Authenticated Access)**

**Test: Authenticated user can access dashboard**
- [ ] Create test user and login via API setup
- [ ] Navigate to /dashboard
- [ ] Verify dashboard content is visible
- [ ] Verify user email displayed in header
- [ ] Verify "Log Out" button is visible
- [ ] Verify no redirect to /login

**Test: Unauthenticated user redirected to login**
- [ ] Clear cookies (no authentication)
- [ ] Navigate to /dashboard
- [ ] Verify redirect to /login
- [ ] Verify URL includes returnUrl=/dashboard (for post-login redirect)

**Test: Authenticated user cannot access login page**
- [ ] Create test user and login via API setup
- [ ] Navigate to /login
- [ ] Verify redirect to /dashboard (already logged in)

**Test: Authenticated user cannot access signup page**
- [ ] Create test user and login via API setup
- [ ] Navigate to /signup
- [ ] Verify redirect to /dashboard (already logged in)

**Test: Authentication persists across page refreshes**
- [ ] Create test user and login via UI
- [ ] Navigate to /dashboard
- [ ] Refresh the page (F5)
- [ ] Verify user still authenticated
- [ ] Verify dashboard still accessible
- [ ] Verify no redirect to /login

**Test: Authentication persists in new tab**
- [ ] Create test user and login in Tab 1
- [ ] Open new tab (Tab 2)
- [ ] Navigate to /dashboard in Tab 2
- [ ] Verify user authenticated in Tab 2
- [ ] Verify no login required

---

#### `tests/e2e/auth/logout.spec.ts`
**User Logout Flow**

**Test: Successful logout**
- [ ] Create test user and login via UI
- [ ] Navigate to /dashboard
- [ ] Verify user is authenticated
- [ ] Click "Log Out" button
- [ ] Verify redirect to /login
- [ ] Verify authentication cleared (cookie removed)
- [ ] Navigate to /dashboard
- [ ] Verify redirect to /login (no longer authenticated)

**Test: Logout persists across tabs**
- [ ] Create test user and login in Tab 1
- [ ] Open new tab (Tab 2), navigate to /dashboard
- [ ] Verify authenticated in both tabs
- [ ] Click "Log Out" in Tab 1
- [ ] Refresh Tab 2
- [ ] Verify redirect to /login in Tab 2 (logout propagated)

**Test: Logout button visible only when authenticated**
- [ ] Clear cookies (no authentication)
- [ ] Navigate to /login page
- [ ] Verify "Log Out" button NOT visible in header
- [ ] Login with valid credentials
- [ ] Verify "Log Out" button IS visible in header

---

#### `tests/e2e/auth/session-expiry.spec.ts`
**Session Expiration**

**Test: Expired JWT token redirects to login**
- [ ] Create test user and login
- [ ] Mock JWT token to be expired (manipulate cookie expiration)
- [ ] Navigate to /dashboard
- [ ] Verify redirect to /login
- [ ] Verify error message "Session expired. Please log in again."

**Test: JWT token expiration displays countdown (optional)**
- [ ] Create test user and login
- [ ] Navigate to /dashboard
- [ ] Verify session expiry indicator shows "6 days remaining"
- [ ] (Optional: Test with short-lived token for faster test)

---

## 🎨 UI Components to Test

### Signup Page (`/signup`)
```
┌─────────────────────────────────┐
│  📱 The Meme Radar              │
│                                 │
│  Create Account                 │
│                                 │
│  Email                          │
│  [________________________]     │
│                                 │
│  Password                       │
│  [________________________] 👁  │
│                                 │
│  [ Sign Up ]                    │
│                                 │
│  Already have an account?       │
│  Log in                         │
└─────────────────────────────────┘
```

**UI Elements:**
- Email input (type="email", required)
- Password input (type="password", required)
- Password visibility toggle icon
- Submit button "Sign Up"
- Link to login page
- Error message display area
- Loading state during submission

### Login Page (`/login`)
```
┌─────────────────────────────────┐
│  📱 The Meme Radar              │
│                                 │
│  Log In                         │
│                                 │
│  Email                          │
│  [________________________]     │
│                                 │
│  Password                       │
│  [________________________] 👁  │
│                                 │
│  [ Log In ]                     │
│                                 │
│  Don't have an account?         │
│  Sign up                        │
└─────────────────────────────────┘
```

**UI Elements:**
- Email input (type="email", required)
- Password input (type="password", required)
- Password visibility toggle icon
- Submit button "Log In"
- Link to signup page
- Error message display area
- Loading state during submission

### Dashboard Header (Authenticated)
```
┌─────────────────────────────────┐
│  📱 The Meme Radar              │
│                                 │
│  user@test.com  [ Log Out ]     │
└─────────────────────────────────┘
```

**UI Elements:**
- User email display
- "Log Out" button
- Mobile responsive menu

---

## ✅ Test Execution Order

1. **Unit tests first** (fast, no dependencies)
   - Password hashing
   - JWT generation/validation
   - Email validation

2. **Integration tests** (API endpoints with test database)
   - Signup API
   - Login API
   - Logout API
   - Protected endpoints

3. **Playwright UI tests last** (full E2E with browser)
   - Signup flow
   - Login flow
   - Protected routes
   - Logout flow
   - Session expiry

---

## 🚦 Definition of Done

Authentication system is complete when:
- ✅ All unit tests pass (100% coverage of utilities)
- ✅ All integration tests pass (100% coverage of API endpoints)
- ✅ All Playwright UI tests pass (100% coverage of user flows)
- ✅ All linters pass (ESLint, Prettier)
- ✅ Manual smoke test in browser (signup → login → dashboard → logout)
- ✅ Mobile responsive testing (iOS, Android)
- ✅ Security review (bcrypt, JWT, httpOnly cookies, rate limiting)

---

**Total Test Count: ~60 tests across unit, integration, and E2E**

This ensures rock-solid authentication with complete user flow coverage.
