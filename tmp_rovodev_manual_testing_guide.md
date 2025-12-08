# 📋 CAFE PIRANHA SYSTEM - MANUAL TESTING GUIDE

## 🎯 Purpose
This guide provides step-by-step instructions to manually test all features of the Cafe Piranha Staff Management System with Firebase integration.

---

## ⚙️ Prerequisites

Before starting the tests, ensure:
- ✅ Firebase project is configured with valid credentials in `.env` file
- ✅ Firestore database is set up with proper security rules
- ✅ Firebase Authentication is enabled
- ✅ Application is running (`npm run dev`)
- ✅ You have at least one admin account and one staff account created

---

## 🔐 TEST SECTION 1: AUTHENTICATION & LOGIN

### Test 1.1: Valid Login - Admin
**Steps:**
1. Navigate to the login page
2. Enter admin email: `admin@cafepiranha.com`
3. Enter admin password
4. Click "Login" button

**Expected Results:**
- ✅ No error messages displayed
- ✅ Redirected to Admin Dashboard
- ✅ Admin navigation menu visible (Staff Accounts, Salary Management, etc.)
- ✅ User name displayed in header

**Status:** [ ] Pass  [ ] Fail

---

### Test 1.2: Valid Login - Staff
**Steps:**
1. Logout from admin account (if logged in)
2. Navigate to the login page
3. Enter staff email: `staff@cafepiranha.com`
4. Enter staff password
5. Click "Login" button

**Expected Results:**
- ✅ No error messages displayed
- ✅ Redirected to Staff Dashboard
- ✅ Staff navigation menu visible (Availability, Salary, Request Advance)
- ✅ User name displayed in header

**Status:** [ ] Pass  [ ] Fail

---

### Test 1.3: Invalid Login - Wrong Password
**Steps:**
1. Logout from any account
2. Enter valid email
3. Enter incorrect password
4. Click "Login" button

**Expected Results:**
- ✅ Error message displayed: "Invalid email or password"
- ✅ User remains on login page
- ✅ No redirection occurs

**Status:** [ ] Pass  [ ] Fail

---

### Test 1.4: Invalid Login - Non-existent User
**Steps:**
1. Enter email that doesn't exist: `nonexistent@test.com`
2. Enter any password
3. Click "Login" button

**Expected Results:**
- ✅ Error message displayed
- ✅ User remains on login page

**Status:** [ ] Pass  [ ] Fail

---

### Test 1.5: Invalid Login - Empty Fields
**Steps:**
1. Leave email field empty
2. Leave password field empty
3. Click "Login" button

**Expected Results:**
- ✅ Validation error displayed
- ✅ Form does not submit

**Status:** [ ] Pass  [ ] Fail

---

### Test 1.6: Logout Functionality
**Steps:**
1. Login with any valid account
2. Click "Logout" button

**Expected Results:**
- ✅ User is logged out
- ✅ Redirected to login page
- ✅ Cannot access dashboard by navigating to URL directly

**Status:** [ ] Pass  [ ] Fail

---

## 👥 TEST SECTION 2: ADMIN - STAFF ACCOUNTS MANAGEMENT

### Test 2.1: View All Staff Accounts
**Steps:**
1. Login as admin
2. Navigate to "Staff Accounts" section

**Expected Results:**
- ✅ List of all staff members displayed
- ✅ Shows: Name, Email, Role, Base Salary for each staff
- ✅ Data loaded from Firebase

**Status:** [ ] Pass  [ ] Fail

---

### Test 2.2: Create New Staff Account - Valid Data
**Steps:**
1. In Staff Accounts section, fill in the form:
   - Name: "Test Staff"
   - Email: "teststaff@cafe.com"
   - Password: "test123456"
   - Role: "Staff"
   - Base Salary: 15000
2. Click "Add Staff" button

**Expected Results:**
- ✅ Success message displayed
- ✅ New staff appears in the list immediately
- ✅ Data saved to Firebase
- ✅ Form fields are cleared

**Status:** [ ] Pass  [ ] Fail

---

### Test 2.3: Create New Staff - Invalid Email
**Steps:**
1. Try to create staff with invalid email: "invalidemail"
2. Fill other fields correctly
3. Click "Add Staff"

**Expected Results:**
- ✅ Validation error: "Invalid email format"
- ✅ Staff account NOT created
- ✅ No data saved to Firebase

**Status:** [ ] Pass  [ ] Fail

---

### Test 2.4: Create New Staff - Password Too Short
**Steps:**
1. Try to create staff with password: "12345" (5 characters)
2. Fill other fields correctly
3. Click "Add Staff"

**Expected Results:**
- ✅ Validation error: "Password must be at least 6 characters"
- ✅ Staff account NOT created

**Status:** [ ] Pass  [ ] Fail

---

### Test 2.5: Create New Staff - Duplicate Email
**Steps:**
1. Try to create staff with email that already exists
2. Fill other fields correctly
3. Click "Add Staff"

**Expected Results:**
- ✅ Error message: "Email already exists"
- ✅ Staff account NOT created

**Status:** [ ] Pass  [ ] Fail

---

### Test 2.6: Edit Staff Account
**Steps:**
1. Click "Edit" button on any staff member
2. Change base salary from 15000 to 18000
3. Save changes

**Expected Results:**
- ✅ Changes saved successfully
- ✅ Updated salary displayed immediately
- ✅ Data updated in Firebase

**Status:** [ ] Pass  [ ] Fail

---

### Test 2.7: Delete Staff Account
**Steps:**
1. Click "Delete" button on a test staff account
2. Confirm deletion

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Staff removed from list
- ✅ Data deleted from Firebase

**Status:** [ ] Pass  [ ] Fail

---

### Test 2.8: Filter Staff by Role
**Steps:**
1. Select "Staff" from role filter dropdown
2. Observe the list

**Expected Results:**
- ✅ Only staff with role "Staff" are displayed
- ✅ Admin accounts are hidden

**Status:** [ ] Pass  [ ] Fail

---

## 💰 TEST SECTION 3: ADMIN - SALARY MANAGEMENT

### Test 3.1: View Salary Management Page
**Steps:**
1. Login as admin
2. Navigate to "Salary Management"
3. Select current month and year

**Expected Results:**
- ✅ All staff members listed
- ✅ Each staff shows: Base Salary, OT, Day Off charges, Advances, Net Salary
- ✅ Cards are collapsible

**Status:** [ ] Pass  [ ] Fail

---

### Test 3.2: Add OT Hours for Staff
**Steps:**
1. Expand a staff member's salary card
2. Click "Add OT"
3. Enter date: Today's date
4. Enter hours: 5
5. Save OT entry

**Expected Results:**
- ✅ OT entry added successfully
- ✅ OT payment calculated: 5 hours × ₹100 = ₹500
- ✅ Net salary updated automatically
- ✅ Data saved to Firebase

**Status:** [ ] Pass  [ ] Fail

---

### Test 3.3: Add Multiple OT Entries
**Steps:**
1. Add OT: 3 hours on Jan 15
2. Add OT: 2 hours on Jan 16
3. Add OT: 4 hours on Jan 17

**Expected Results:**
- ✅ All entries displayed
- ✅ Total OT payment: 9 hours × ₹100 = ₹900
- ✅ Net salary reflects total OT

**Status:** [ ] Pass  [ ] Fail

---

### Test 3.4: Delete OT Entry
**Steps:**
1. Click delete button on an OT entry
2. Confirm deletion

**Expected Results:**
- ✅ OT entry removed
- ✅ OT payment recalculated
- ✅ Net salary updated
- ✅ Data removed from Firebase

**Status:** [ ] Pass  [ ] Fail

---

### Test 3.5: View Day Off Charges
**Steps:**
1. Check a staff member who has marked days off
2. View the "Day Off Charges" section

**Expected Results:**
- ✅ Shows number of days off
- ✅ Shows total charges
- ✅ Correct rates applied:
  - Saturday: ₹450
  - Sunday: ₹550
  - Weekdays: ₹500

**Status:** [ ] Pass  [ ] Fail

---

### Test 3.6: View Advance Deductions
**Steps:**
1. Check a staff member who has approved advance requests
2. View "Advance Deductions" section

**Expected Results:**
- ✅ Shows list of approved advances
- ✅ Shows total deduction amount
- ✅ Amount deducted from net salary

**Status:** [ ] Pass  [ ] Fail

---

### Test 3.7: Net Salary Calculation Verification
**Steps:**
1. Note all values for a staff member:
   - Base Salary: ₹15,000
   - OT Payment: ₹500 (5 hours)
   - Day Off Charges: ₹1,000 (2 days)
   - Advance Deductions: ₹2,000
2. Verify net salary calculation

**Expected Results:**
- ✅ Formula: ₹15,000 + ₹500 - ₹1,000 - ₹2,000 = ₹12,500
- ✅ Displayed net salary matches calculation
- ✅ All components shown separately

**Status:** [ ] Pass  [ ] Fail

---

### Test 3.8: Generate PDF Salary Slip
**Steps:**
1. Expand a staff member's card
2. Click "Generate PDF" or "Download Salary Slip"

**Expected Results:**
- ✅ PDF generated successfully
- ✅ PDF contains all salary details
- ✅ PDF downloads to device
- ✅ Correct formatting and data

**Status:** [ ] Pass  [ ] Fail

---

### Test 3.9: Change Month/Year Selection
**Steps:**
1. Change month selector to previous month
2. Observe data updates

**Expected Results:**
- ✅ Salary data for selected month displayed
- ✅ Historical data loaded correctly
- ✅ All calculations remain accurate

**Status:** [ ] Pass  [ ] Fail

---


## 📊 TEST SECTION 4: ADMIN - OT APPROVALS

### Test 4.1: View Pending OT Requests
**Steps:**
1. Login as admin
2. Navigate to "OT Approvals"

**Expected Results:**
- ✅ List of all OT requests displayed
- ✅ Shows: Staff name, Date, Hours, Status
- ✅ Pending requests shown first

**Status:** [ ] Pass  [ ] Fail

---

### Test 4.2: Approve OT Request
**Steps:**
1. Find a pending OT request
2. Click "Approve" button

**Expected Results:**
- ✅ Status changes to "Approved"
- ✅ Success message displayed
- ✅ OT hours added to salary calculation
- ✅ Data updated in Firebase

**Status:** [ ] Pass  [ ] Fail

---

### Test 4.3: Reject OT Request
**Steps:**
1. Find a pending OT request
2. Click "Reject" button

**Expected Results:**
- ✅ Status changes to "Rejected"
- ✅ OT hours NOT added to salary
- ✅ Data updated in Firebase

**Status:** [ ] Pass  [ ] Fail

---

## 💵 TEST SECTION 5: ADMIN - ADVANCE REQUESTS

### Test 5.1: View All Advance Requests
**Steps:**
1. Login as admin
2. Navigate to "Advance Requests"

**Expected Results:**
- ✅ All advance requests displayed
- ✅ Shows: Staff name, Amount, Reason, Date, Status
- ✅ Sorted by date (newest first)

**Status:** [ ] Pass  [ ] Fail

---

### Test 5.2: Approve Advance Request
**Steps:**
1. Find a pending advance request
2. Click "Approve" button

**Expected Results:**
- ✅ Status changes to "Approved"
- ✅ Success message displayed
- ✅ Amount will be deducted from next salary
- ✅ Staff can see approval in their dashboard

**Status:** [ ] Pass  [ ] Fail

---

### Test 5.3: Reject Advance Request
**Steps:**
1. Find a pending advance request
2. Click "Reject" button

**Expected Results:**
- ✅ Status changes to "Rejected"
- ✅ Amount NOT deducted from salary
- ✅ Staff can see rejection in their dashboard

**Status:** [ ] Pass  [ ] Fail

---

## 📅 TEST SECTION 6: ADMIN - STAFF AVAILABILITY VIEW

### Test 6.1: View All Staff Availability
**Steps:**
1. Login as admin
2. Navigate to "Staff Availability View"
3. Select current month

**Expected Results:**
- ✅ Calendar grid displayed for entire month
- ✅ All staff members listed with their names
- ✅ Each staff's availability shown in separate row
- ✅ Color coding: Green = Available, Red = Unavailable

**Status:** [ ] Pass  [ ] Fail

---

### Test 6.2: Navigate Between Months
**Steps:**
1. Click "Previous Month" arrow
2. Click "Next Month" arrow

**Expected Results:**
- ✅ Calendar updates to selected month
- ✅ Availability data for that month loaded
- ✅ Month/year label updates correctly

**Status:** [ ] Pass  [ ] Fail

---

## 📈 TEST SECTION 7: ADMIN - MONTHLY DAY OFF REPORT

### Test 7.1: Generate Day Off Report
**Steps:**
1. Login as admin
2. Navigate to "Monthly Day Off Report"
3. Select month and year

**Expected Results:**
- ✅ Report generated for all staff
- ✅ Shows total days off per staff member
- ✅ Breakdown by day of week
- ✅ Total charges calculated

**Status:** [ ] Pass  [ ] Fail

---

### Test 7.2: Verify Day Off Charge Rates
**Steps:**
1. Find staff with Saturday day off
2. Find staff with Sunday day off
3. Find staff with weekday day off

**Expected Results:**
- ✅ Saturday: ₹450
- ✅ Sunday: ₹550
- ✅ Monday-Friday: ₹500 each
- ✅ Calculations are accurate

**Status:** [ ] Pass  [ ] Fail

---

## 📱 TEST SECTION 8: STAFF - AVAILABILITY MANAGEMENT

### Test 8.1: View Availability Calendar
**Steps:**
1. Login as staff member
2. Navigate to "Availability" section

**Expected Results:**
- ✅ Calendar displayed for next month
- ✅ Current availability status shown
- ✅ Can see all dates of the month

**Status:** [ ] Pass  [ ] Fail

---

### Test 8.2: Mark Days as Unavailable
**Steps:**
1. Click on a date in the calendar
2. Date should turn red (unavailable)
3. Click "Submit Availability"

**Expected Results:**
- ✅ Date changes color to red
- ✅ Success message displayed
- ✅ Data saved to Firebase
- ✅ Admin can see this change

**Status:** [ ] Pass  [ ] Fail

---

### Test 8.3: Mark Days as Available (Toggle)
**Steps:**
1. Click on a red (unavailable) date
2. Date should turn green (available)
3. Click "Submit Availability"

**Expected Results:**
- ✅ Date changes color to green
- ✅ Availability updated in Firebase

**Status:** [ ] Pass  [ ] Fail

---

## 💼 TEST SECTION 9: STAFF - SALARY VIEW

### Test 9.1: View Current Month Salary
**Steps:**
1. Login as staff member
2. Navigate to "Salary" section
3. Select current month

**Expected Results:**
- ✅ Base salary displayed
- ✅ OT hours and payment shown
- ✅ Day off deductions shown
- ✅ Advance deductions shown
- ✅ Net salary calculated correctly

**Status:** [ ] Pass  [ ] Fail

---

### Test 9.2: Verify Salary Breakdown
**Steps:**
1. Note all components and check net salary

**Expected Results:**
- ✅ Net = Base + OT - Day Off - Advance
- ✅ Calculation matches displayed value
- ✅ All components shown clearly

**Status:** [ ] Pass  [ ] Fail

---

### Test 9.3: Download Salary Slip PDF
**Steps:**
1. Click "Download Salary Slip" button

**Expected Results:**
- ✅ PDF generated successfully
- ✅ Contains all salary details
- ✅ Professional formatting
- ✅ File downloads to device

**Status:** [ ] Pass  [ ] Fail

---

## 💰 TEST SECTION 10: STAFF - REQUEST ADVANCE

### Test 10.1: Submit Valid Advance Request
**Steps:**
1. Navigate to "Request Advance"
2. Enter amount: 2000
3. Enter reason: "Medical emergency"
4. Click "Submit Request"

**Expected Results:**
- ✅ Success message displayed
- ✅ Request appears with "Pending" status
- ✅ Data saved to Firebase
- ✅ Admin can see this request

**Status:** [ ] Pass  [ ] Fail

---

### Test 10.2: Invalid Request - Zero Amount
**Steps:**
1. Enter amount: 0
2. Enter reason: "Test"
3. Click "Submit Request"

**Expected Results:**
- ✅ Validation error displayed
- ✅ Request NOT submitted

**Status:** [ ] Pass  [ ] Fail

---

### Test 10.3: Invalid Request - Empty Reason
**Steps:**
1. Enter amount: 1000
2. Leave reason field empty
3. Click "Submit Request"

**Expected Results:**
- ✅ Validation error: "Reason is required"
- ✅ Request NOT submitted

**Status:** [ ] Pass  [ ] Fail

---

### Test 10.4: Cannot Submit Multiple Pending Requests
**Steps:**
1. Submit a request (becomes pending)
2. Try to submit another request

**Expected Results:**
- ✅ Error message displayed
- ✅ Second request NOT submitted

**Status:** [ ] Pass  [ ] Fail

---

## 🔄 TEST SECTION 11: INTEGRATION TESTS

### Test 11.1: Staff Availability → Day Off Charges
**Steps:**
1. Staff marks 2 days as unavailable (Sat + Sun)
2. Admin views Salary Management

**Expected Results:**
- ✅ Day Off Report shows ₹450 + ₹550 = ₹1,000
- ✅ Salary shows day off deduction: ₹1,000
- ✅ Net salary reduced correctly

**Status:** [ ] Pass  [ ] Fail

---

### Test 11.2: Advance Request → Salary Deduction
**Steps:**
1. Staff submits advance request: ₹2,000
2. Admin approves the request
3. Check next month's salary

**Expected Results:**
- ✅ Request status changes to "Approved"
- ✅ Next month salary shows deduction: ₹2,000
- ✅ Net salary reduced by ₹2,000

**Status:** [ ] Pass  [ ] Fail

---

### Test 11.3: OT Addition → Salary Increase
**Steps:**
1. Admin adds 5 hours OT for staff
2. Staff views their salary

**Expected Results:**
- ✅ OT appears in staff's salary view
- ✅ OT payment: 5 × ₹100 = ₹500
- ✅ Net salary increased by ₹500

**Status:** [ ] Pass  [ ] Fail

---

### Test 11.4: Complete Salary Calculation
**Steps:**
1. Base: ₹15,000
2. Days off: ₹1,000
3. OT: ₹500
4. Advance: ₹2,000

**Expected Results:**
- ✅ Net = ₹15,000 + ₹500 - ₹1,000 - ₹2,000 = ₹12,500
- ✅ Same result in admin and staff views

**Status:** [ ] Pass  [ ] Fail

---

## 🔒 TEST SECTION 12: SECURITY & ACCESS

### Test 12.1: Staff Cannot Access Admin Dashboard
**Steps:**
1. Login as staff
2. Try to access admin URL

**Expected Results:**
- ✅ Access denied
- ✅ Redirected to staff dashboard

**Status:** [ ] Pass  [ ] Fail

---

### Test 12.2: Staff Can Only View Own Data
**Steps:**
1. Login as staff
2. Try to view another staff's data

**Expected Results:**
- ✅ Only own data visible
- ✅ Cannot access other staff data

**Status:** [ ] Pass  [ ] Fail

---

### Test 12.3: Unauthenticated Access Prevention
**Steps:**
1. Logout from system
2. Try to access dashboard URL

**Expected Results:**
- ✅ Redirected to login page
- ✅ No data accessible

**Status:** [ ] Pass  [ ] Fail

---

## 📊 TEST SUMMARY

### Overall Results
- **Total Tests:** 60+
- **Tests Passed:** ___
- **Tests Failed:** ___
- **Success Rate:** ____%

### Critical Issues Found
1. ___________________________
2. ___________________________

### Minor Issues Found
1. ___________________________
2. ___________________________

### Recommendations
1. ___________________________
2. ___________________________

---

**Tester Name:** ___________________________
**Date:** ___________________________
**Version:** ___________________________

