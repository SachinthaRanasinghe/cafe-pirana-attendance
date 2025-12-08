# Cafe Piranha Staff Management System - Complete Functionality Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Admin Functions](#admin-functions)
3. [Staff Functions](#staff-functions)
4. [How Everything Works](#how-everything-works)

---

## System Overview

This is a comprehensive staff management system for Cafe Piranha that handles:
- Time tracking (Clock In/Out with shift-based calculations)
- Salary management with customizable rates
- Overtime (OT) and Short Time tracking
- Salary advances with monthly limits
- Staff availability scheduling
- Day-off policies and adjustments
- Service charge tracking (display only)

**Key Concept: Shift-Based Month Calculation**
- If you clock in/out after 6 PM (18:00), it counts towards the NEXT day's shift
- This ensures late-night shifts are properly allocated to the correct working day

---

## Admin Functions

### 1. Admin Dashboard (`/admin`)

**Purpose:** Central hub for monitoring all staff activities and system metrics

**Features:**
- **Real-time Stats Display:**
  - Total active staff members
  - Staff currently clocked in
  - Total work hours (today/this week/this month)
  - Pending requests (advances, OT/Short Time approvals)

- **Recent Activity Feed:**
  - Latest clock-ins/clock-outs
  - Recent advance requests
  - Recent time adjustment requests
  - All sorted by timestamp (newest first)

- **Quick Actions:**
  - Navigate to different admin sections
  - View pending approvals
  - Access reports

**How It Works:**
- Uses Firebase real-time listeners on `sessions` collection
- Calculates stats dynamically from Firestore data
- Updates automatically when staff clock in/out
- Shows live data without page refresh

---

### 2. Salary Management (`/admin/salary`)

**Purpose:** Configure and manage staff salaries, OT rates, and view salary calculations

**Features:**

#### A. Setup Tab - Configure Individual Salaries
- **Select staff member** from dropdown (shows all staff with session history)
- **Set monthly base salary** (in Rs.)
- **Set custom OT rate** (default: Rs. 200/hour, can customize per staff)
- **Configure Day-Off Policy:**
  - Use default policy OR custom policy per staff
  - Set max days off allowed per month
  - Set deduction rate per excess day
  - Set bonus rate per day worked over target

**Example:** 
- Staff: Chamoda
- Monthly Salary: Rs. 50,000
- OT Rate: Rs. 250/hour (custom)
- Day-Off Policy: 4 days max, Rs. 500 deduction/day, Rs. 300 bonus/day

#### B. View All Tab - See Salary Calculations
- **Month selector** - View any month (current or historical)
- **For each staff member, displays:**
  - Base monthly salary
  - Total approved advances (deducted)
  - Total OT amount (added)
  - Total Short Time amount (deducted)
  - Day-off adjustment (bonus or deduction) - only for previous months
  - **Net Salary** = Base + OT - Short Time - Advances + Day-Off Adjustment

**Current Month vs Previous Months:**
- **Current Month:** Shows running totals, day-off adjustment NOT calculated yet (calculated on 1st of next month)
- **Previous Months:** Shows finalized salary with all adjustments including day-off

#### C. Service Charge Configuration
- Set service charge amount (for reference/display only)
- NOT added to staff net salary (separate tracking)
- Updated timestamp tracked

#### D. Global Day-Off Policy Configuration
- Set default policy for all staff
- Max days off threshold (default: 4 days)
- Deduction per excess day (default: Rs. 500)
- Bonus per day under threshold (default: Rs. 300)

**How It Works:**
- Saves to `salaries` collection (keyed by staff UID)
- Fetches approved advances from `advanceRequests` collection
- Fetches approved adjustments from `adjustmentRequests` collection
- Uses `shiftMonth` field for accurate monthly allocation
- Day-off calculation uses `weeklyAvailability` archives

---

### 3. Staff Accounts Management (`/admin/accounts`)

**Purpose:** Create and manage staff user accounts

**Features:**

#### A. Create New Staff Account
- **Input fields:**
  - Staff Name (full name)
  - Username (unique, min 3 characters, used for login)
  - Temporary Password (min 6 characters, can generate random)

- **What happens:**
  - Creates Firebase Authentication account
  - Generates unique Staff ID (format: CP####)
  - Creates staff profile in `staff` collection
  - Staff marked as `isFirstLogin: true` (must change password)
  - Internal email format: `username@cafepiranha.internal`

#### B. View All Staff Accounts
- Table showing all staff with:
  - Staff ID
  - Full Name
  - Username
  - Creation date
  - Status (Pending/Active)
  
#### C. Reset Staff Password
- Select staff member
- Generate new temporary password
- Staff must change on next login
- Updates `isFirstLogin` flag and tracks reset timestamp

**How It Works:**
- Uses Firebase Authentication for secure login
- Stores staff profiles in `staff` collection
- Admin session separate from staff creation (auto logout after creation)

---

### 4. Time Adjustment Approvals (`/admin/ot-approvals`)

**Purpose:** Review and approve/reject Overtime and Short Time requests from staff

**Features:**

#### A. Requests Tab
- **Filter by:**
  - Status (Pending/Approved/Rejected/All)
  - Type (Overtime/Short Time/All)
  - Search by staff name or ID

- **For each request, displays:**
  - Staff name and ID
  - Date of shift
  - Total hours worked
  - Regular hours (up to 12 hours)
  - Adjustment hours (OT or Short Time)
  - Calculated amount using staff-specific OT rate
  - Session details

- **Actions available:**
  - **Edit Hours** - Modify adjustment hours before/after approval
  - **Approve** - Approve the request (adds to salary calculations)
  - **Reject** - Reject with reason

#### B. Statistics Tab
- Total requests (OT and Short Time)
- Pending approvals count
- Total approved OT hours and amount
- Total approved Short Time hours and amount
- Net adjustment (OT amount - Short Time amount)
- Approval rate percentage

**How OT/Short Time is Calculated:**
- System auto-generates requests when staff works >12 hours (OT) or <12 hours (Short Time)
- Uses staff-specific OT rate from salary configuration
- **OT:** Hours over 12 × OT Rate = Amount ADDED to salary
- **Short Time:** Hours under 12 × OT Rate = Amount DEDUCTED from salary
- Amount automatically recalculated if admin edits hours

**How It Works:**
- Reads from `adjustmentRequests` collection
- Updates status field when approved/rejected
- Tracks `shiftMonth` for accurate monthly allocation
- Stores staff-specific OT rate used at approval time
- Admin edits tracked with original values preserved

---

### 5. Advance Request Approvals (`/admin/advances`)

**Purpose:** Review and approve/reject salary advance requests from staff

**Features:**

#### A. Requests Tab
- **Filter by:**
  - Status (Pending/Approved/Rejected/All)
  - Search by staff name or ID

- **For each request, displays:**
  - Staff name and ID
  - Requested amount
  - Request date
  - Reason for advance (if provided)
  - Status

- **Actions available:**
  - **Approve** - Approve the advance (deducts from salary)
  - **Reject** - Reject with reason

#### B. Statistics Tab
- Total requests
- Pending approval count
- Approved requests count
- Rejected requests count
- Total amount approved
- Approval rate

**Monthly Advance Limits:**
- Staff can request up to 50% of monthly salary per month
- System tracks approved advances per shift month
- Remaining limit = (50% of salary) - (approved advances this month)

**How It Works:**
- Reads from `advanceRequests` collection
- Uses `shiftMonth` field for monthly tracking
- Approved advances automatically deducted from net salary
- Limit resets at start of new shift month

---

### 6. Staff Availability View (`/admin/availability`)

**Purpose:** View staff weekly availability schedules and generate reports

**Features:**

#### A. Availability Display
- **Two view modes:**
  - **Grid View:** Card-based layout showing each staff's weekly schedule
  - **Table View:** Spreadsheet-like view with all staff in rows

- **For each staff, shows:**
  - Name and ID
  - Availability for each day of the week (Mon-Sun)
  - Working hours (start time - end time)
  - Break times
  - Days available out of 7
  - Availability percentage

- **Filtering options:**
  - Filter by specific day (e.g., show only staff available on Monday)
  - Search by staff name or ID
  - View today's available staff

#### B. Statistics
- Total staff count
- Staff available today
- Average availability (days per week)
- Staff with highest/lowest availability

#### C. Report Generation
- **Generate Current Month Report:** PDF export of current availability
- **Generate Specific Month Report:** Select any month and generate PDF
- Reports include all staff availability data formatted for printing

**How It Works:**
- Reads from `availabilities` collection (current week)
- Reads from `weeklyAvailability` collection (historical data)
- Availability resets every Sunday
- Previous week archived automatically
- PDF generation uses jsPDF library

---

### 7. Monthly Day-Off Report (`/admin/dayoff-report`)

**Purpose:** View day-off calculations and adjustments (only on 1st of month)

**Features:**

#### A. Availability (Only on 1st Day of Month)
- Shows previous month's day-off summary for all staff
- **For each staff:**
  - Days off taken
  - Threshold (max allowed)
  - Policy type (default or custom)
  - Adjustment amount (bonus or deduction)
  - Status (bonus/deduction/on-track)

#### B. Summary Statistics
- Total bonuses earned
- Total deductions applied
- Staff count reviewed

#### C. Not Available (Other Days)
- Shows message: "Report only available on 1st of month"
- Displays next report date

**Day-Off Calculation Logic:**
- Counts days marked as unavailable in weekly availability
- Compares to threshold (default: 4 days)
- **If days off > threshold:** Deduction = (excess days) × deduction rate
- **If days off < threshold:** Bonus = (days under) × bonus rate
- **If days off = threshold:** No adjustment

**Example:**
- Threshold: 4 days
- Deduction rate: Rs. 500/day
- Bonus rate: Rs. 300/day
- Staff took 6 days off: Deduction = (6-4) × 500 = Rs. 1,000
- Staff took 2 days off: Bonus = (4-2) × 300 = Rs. 600

**How It Works:**
- Calculates from `weeklyAvailability` archives for previous month
- Uses staff-specific or default day-off configuration
- Automatically included in salary calculations for previous months
- Only visible on 1st day of each month

---

## Staff Functions

### 1. Staff Dashboard (`/staff`)

**Purpose:** Personal dashboard for staff to track time and view activity

**Features:**

#### A. Clock In/Out System
- **Clock In:**
  - Records start time
  - Creates new session in database
  - Shows timer counting up

- **Clock Out:**
  - Records end time
  - Calculates total hours worked
  - Determines shift month (considers 6 PM rule)
  - Auto-generates time adjustment request:
    - **>12 hours:** Creates Overtime request
    - **<12 hours:** Creates Short Time request (if configured)
    - **=12 hours:** No adjustment

- **Current Session Display:**
  - Shows if currently clocked in
  - Live timer showing elapsed time
  - Clock in time

#### B. Session History
- **Today's Sessions:**
  - All clock-in/out records for today
  - Total hours worked today
  - Session times and durations

- **This Week's Sessions:**
  - Sessions grouped by day
  - Weekly total hours

- **This Month's Sessions:**
  - All sessions for current month
  - Monthly total hours
  - Session count

#### C. Quick Stats
- Hours worked today/this week/this month
- Current status (Clocked In/Out)
- Session count
- Average hours per day

**Shift Month Rule:**
- If you clock out after 6 PM (18:00), the session counts for the NEXT day's shift
- Example: Clock out at 7 PM on Jan 31 → Counts for Feb 1 shift month
- This ensures overnight/late shifts are properly allocated

**How It Works:**
- Creates/updates documents in `sessions` collection
- Uses `getShiftMonth()` helper for accurate month calculation
- Real-time updates using Firebase listeners
- Timer runs in browser (updates every second)

---

### 2. Salary View (`/staff/salary`)

**Purpose:** View personal salary details and transaction history

**Features:**

#### A. Month Selector
- Select any month (current or previous)
- Current month: Shows "🟢 RUNNING TOTAL - NOT FINAL"
- Previous months: Shows "✅ FINALIZED SALARY"

#### B. Net Salary Card
- **Displays:**
  - Net salary for selected month
  - Base salary
  - Service charge (reference only, not added to net)
  - Overtime added
  - Short Time deducted
  - Advances deducted
  - Day-off adjustment (only for previous months)

**Calculation:**
```
Net Salary = Base Salary + OT - Short Time - Advances + Day-Off Adjustment
```

**Note:** Service charge is shown for reference but NOT included in net salary calculation.

#### C. Overview Tab
- Visual breakdown of salary components
- Quick stats cards showing:
  - Base salary
  - Service charge (display only)
  - Overtime earnings
  - Short time deductions
  - Advance usage

- **Monthly Insights:**
  - Number of approved advances
  - Number of OT approvals
  - Number of short time sessions
  - Advance usage percentage

#### D. Adjustments Tab (Time)
- List of all OT and Short Time requests for selected month
- Shows:
  - Type (Overtime/Short Time)
  - Date
  - Hours worked
  - Amount
  - Status (Pending/Approved/Rejected)
  - Rejection reason (if rejected)

#### E. Advances Tab
- List of all advance requests for selected month
- Shows:
  - Amount requested
  - Request date
  - Reason
  - Status (Pending/Approved/Rejected)
  - Processing date

**Current Month vs Previous Months:**
- **Current Month:**
  - Running totals (may still change)
  - Day-off adjustment NOT shown (calculated on 1st)
  - Shows warning: "Day-off adjustment calculates on 1st of next month"

- **Previous Months:**
  - Finalized salary
  - Includes day-off adjustment
  - All values locked in

**How It Works:**
- Fetches from `salaries` collection (base salary)
- Fetches from `advanceRequests` collection (approved advances)
- Fetches from `adjustmentRequests` collection (approved OT/Short Time)
- Fetches from `systemConfig` collection (service charge for display)
- Calculates day-off adjustment from `weeklyAvailability` archives

---

### 3. Request Advance (`/staff/advance`)

**Purpose:** Request salary advances with monthly limit tracking

**Features:**

#### A. Advance Limit Information
- **Displays:**
  - Monthly salary
  - Maximum advance allowed (50% of salary)
  - Advances taken this month
  - Remaining available amount
  - Usage percentage with progress bar

**Example:**
- Monthly Salary: Rs. 50,000
- Max Advance: Rs. 25,000 (50%)
- Used: Rs. 10,000
- Remaining: Rs. 15,000
- Usage: 40%

#### B. Request Form
- **Input fields:**
  - Amount (validated against remaining limit)
  - Date needed
  - Reason (optional)

- **Validation:**
  - Amount must be > 0
  - Amount cannot exceed remaining limit
  - Shows error if limit reached

#### C. Request History
- **Pending Requests:**
  - Awaiting admin approval
  - Can see status

- **Request History:**
  - All previous requests
  - Status (Approved/Rejected/Pending)
  - Amounts and dates
  - Rejection reasons if applicable

**Monthly Limit Rules:**
- Limit = 50% of monthly salary
- Resets at start of each shift month
- Only APPROVED advances count towards limit
- Pending/Rejected requests don't count

**How It Works:**
- Creates document in `advanceRequests` collection
- Sets `shiftMonth` based on current shift month
- Real-time tracking of approved advances
- Limit validation before submission

---

### 4. Staff Availability (`/staff/availability`)

**Purpose:** Set weekly work schedule (only editable on Sundays)

**Features:**

#### A. Day Restriction
- **Can only edit on Sundays**
- Other days: View-only mode
- Shows restriction message with next Sunday date

#### B. Weekly Schedule Setup
- **For each day of the week:**
  - Toggle available/unavailable
  - Set start time (if available)
  - Set end time (if available)
  - Add multiple break periods
  - Each break has start and end time

- **Time slots:** 30-minute intervals from 6:00 AM to 12:00 AM

#### C. Quick Actions
- **Available All Week:** Marks all days as available
- **Unavailable All Week:** Marks all days as unavailable
- **Copy to All Days:** Copy one day's schedule to all other days
- **Save Changes:** Save all changes (only on Sundays)

#### D. Weekly Information
- Current week start date
- Days available count (X/7)
- Last updated timestamp
- Automatic reset notice

**Weekly Reset System:**
- Availability automatically resets every Sunday
- Previous week archived to `weeklyAvailability` collection
- Archives used for day-off calculations
- History maintained for reporting

**How It Works:**
- Stores current availability in `availabilities` collection
- Archives weekly data to `weeklyAvailability` collection
- Checks day of week before allowing edits
- Auto-resets on Sunday if new week detected

---

## How Everything Works

### Data Flow Overview

```
1. Staff Clock In/Out
   ↓
2. Session Created/Updated (sessions collection)
   ↓
3. If total hours ≠ 12h, create adjustment request
   ↓
4. Admin approves adjustment (adjustmentRequests collection)
   ↓
5. Salary calculation includes approved adjustments
```

### Monthly Cycle

**Week 1-4:**
- Staff clock in/out daily
- Staff request advances as needed
- Admin approves advances/adjustments
- Staff update availability (Sundays only)
- All data tracked per shift month

**1st of Next Month:**
- Day-off report becomes available
- Previous month calculations finalized
- Day-off adjustments calculated from weekly archives
- Final salary = Base + OT - Short Time - Advances + Day-Off

### Key Collections in Firebase

1. **sessions** - Clock in/out records
2. **staff** - Staff accounts and profiles
3. **salaries** - Base salary and OT rate configurations
4. **advanceRequests** - Salary advance requests
5. **adjustmentRequests** - OT and Short Time requests
6. **availabilities** - Current week availability
7. **weeklyAvailability** - Archived weekly availability
8. **systemConfig** - Global settings (service charge, etc.)
9. **dayOffRates** - Default day-off policy configuration
10. **staffDayOffConfigs** - Staff-specific day-off policies

### Important Fields

- **shiftMonth:** Used for monthly tracking (considers 6 PM rule)
- **status:** pending/approved/rejected for requests
- **adjustmentType:** overtime or short_time
- **available:** true/false for availability
- **staffUid:** Links records to staff (Firebase Auth UID)

### Calculations Summary

**Net Salary:**
```
Base Salary
+ Approved OT (hours × staff OT rate)
- Approved Short Time (hours × staff OT rate)  
- Approved Advances
+ Day-Off Adjustment (previous months only)
= Net Salary
```

**Day-Off Adjustment:**
```
If days_off > threshold:
  Adjustment = -(excess_days × deduction_rate)
  
If days_off < threshold:
  Adjustment = (bonus_days × bonus_rate)
  
If days_off = threshold:
  Adjustment = 0
```

**Advance Limit:**
```
Max Advance = Monthly Salary × 50%
Used This Month = Sum of approved advances in shift month
Remaining = Max Advance - Used This Month
```

---

## User Roles

### Admin
- Full access to all admin pages
- Can approve/reject requests
- Can configure salaries and policies
- Can view all staff data
- Can generate reports

### Staff
- Access to personal dashboard
- Can clock in/out
- Can request advances (within limit)
- Can view own salary details
- Can set weekly availability (Sundays only)
- Cannot see other staff's data

---

## Security & Authentication

- Firebase Authentication for login
- Role-based access control (admin vs staff)
- Staff cannot access admin pages
- Admin cannot access individual staff pages
- Session management with auto-logout
- Password reset functionality
- First-login password change required

---

## Real-Time Features

The system uses Firebase real-time listeners for:
- Live clock in/out status
- Instant request updates
- Automatic salary recalculation
- Live session tracking
- Real-time stats on dashboards

All data updates appear immediately without page refresh!

---

## Mobile-First Design

- Fully responsive for mobile devices
- Bottom navigation bars
- Touch-friendly buttons
- Mobile-optimized layouts
- Works on phones, tablets, and desktops

---

*This system provides comprehensive staff management with accurate time tracking, flexible salary configurations, and automated calculations to streamline cafe operations!*
