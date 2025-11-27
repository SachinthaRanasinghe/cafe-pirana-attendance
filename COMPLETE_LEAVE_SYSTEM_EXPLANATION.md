# Complete Day-Off/Leave System - How Everything Works

## 📋 Table of Contents
1. System Overview
2. How Staff Handle Leave/Day-Off
3. How Admin Handles Leave/Day-Off
4. When and How It's Added to Salary
5. Database Structure
6. Complete Calculation Examples
7. Timeline and Flow

---

## 1. SYSTEM OVERVIEW

### What is the Day-Off/Leave System?

This system tracks staff availability and calculates **bonuses or deductions** based on how many days off (leave days) staff take in a month compared to their configured threshold.

### Key Concepts:

**Day-Off = Leave Day = Unavailable Day**
- When staff marks themselves as "unavailable" on the availability page, it means they're taking that day off (leave)
- This is tracked weekly and calculated monthly

**Threshold System:**
- Each staff member has a maximum allowed days off per month (default: 4 days)
- Take MORE days off than allowed → Salary DEDUCTION
- Take FEWER days off than allowed → Salary BONUS
- Take EXACTLY the threshold → No change

**Individual vs Global Policy:**
- **Global Default:** All staff follow the same rules (4 days, Rs. 500 deduction, Rs. 300 bonus)
- **Individual Custom:** Admin can set different rules for specific staff members

---

## 2. HOW STAFF HANDLE LEAVE/DAY-OFF

### Step 1: Staff Sets Weekly Availability (SUNDAY ONLY)

**When:** Every Sunday (ONLY on Sundays - system is locked Monday-Saturday)

**Where:** Staff Dashboard → Availability Page (`/staff/availability`)

**What Staff Does:**

1. **Login** with username and password
2. **Navigate** to Availability page
3. **See the current week** (Sunday to Saturday)
4. **For each day**, mark as:
   - ✅ **Available** = Working (set start time, end time, breaks)
   - ❌ **Unavailable** = Taking leave/day-off (not working)

**Example - John's Week Planning:**
```
Sunday (Today - Jan 14):
  ☑️ Available: 9:00 AM - 5:00 PM (with 1-hour break 12:00-1:00 PM)

Monday (Jan 15):
  ☑️ Available: 9:00 AM - 5:00 PM

Tuesday (Jan 16):
  ☐ Unavailable (Taking day off - LEAVE)

Wednesday (Jan 17):
  ☑️ Available: 9:00 AM - 5:00 PM

Thursday (Jan 18):
  ☑️ Available: 9:00 AM - 5:00 PM

Friday (Jan 19):
  ☑️ Available: 9:00 AM - 5:00 PM

Saturday (Jan 20):
  ☐ Unavailable (Day off - LEAVE)
```

5. **Click "Save All Changes"**
6. System saves to database

**What Gets Saved:**
```javascript
// Saved to two places:
1. availabilities/{staffUid} - Current week (for viewing)
2. weeklyAvailability/{auto-id} - Historical archive (for calculations)

Data Structure:
{
  staffUid: "john_123",
  staffName: "John Doe",
  staffId: "CP5678",
  weekStartDate: "2024-01-14", // Sunday date
  availabilities: {
    Sunday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [...] },
    Monday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Tuesday: { available: false }, // DAY OFF!
    Wednesday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Thursday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Friday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Saturday: { available: false } // DAY OFF!
  },
  savedAt: "2024-01-14T10:30:00Z"
}
```

**Important Notes:**
- ✅ Staff can ONLY update on Sundays
- ✅ Monday-Saturday = VIEW ONLY mode (all inputs disabled)
- ✅ Each Sunday, previous week is archived automatically
- ✅ Staff must plan their week in advance

---

### Step 2: Staff Views Current Month Status (During Month)

**When:** Anytime during the month (days 2-31)

**Where:** Staff Dashboard (main page)

**What Staff Sees:**

IF they are OVER their limit:
```
╔═══════════════════════════════════════════════╗
║  ⚠️ Day-Off Limit Exceeded                    ║
║                                               ║
║  You have taken 6 days off this month,        ║
║  which exceeds your limit of 4 days.          ║
║                                               ║
║  Days Off Taken So Far: 6 days               ║
║  Allowed Limit: 4 days                        ║
║  Excess Days: 2 days                          ║
║                                               ║
║  ⚠️ Warning: You are currently over your      ║
║  day-off limit. Deductions will be            ║
║  calculated and applied to your salary on     ║
║  the 1st of next month.                       ║
║  Deduction rate: Rs. 500/day over limit.      ║
╚═══════════════════════════════════════════════╝
```

IF they are UNDER their limit:
```
No warning shown - they're doing fine!
(Optional: Could show a positive message)
```

**Important:**
- ❌ NO deduction amounts shown during the month
- ❌ NO bonus amounts calculated yet
- ✅ Only shows WARNING if exceeding limit
- ✅ Explains when it will be applied (1st of next month)

---


## 3. HOW ADMIN HANDLES LEAVE/DAY-OFF

### Admin View During Month (Days 2-31)

**Where:** Admin Dashboard → Salary Management

**What Admin Sees:**

```
╔═══════════════════════════════════════════════╗
║  📅 Day-Off Calculations                      ║
║                                               ║
║  Day-off bonuses and deductions are           ║
║  calculated and applied ONLY on the 1st       ║
║  day of each month for the previous           ║
║  month's attendance.                          ║
║                                               ║
║  Staff can see warnings during the month      ║
║  if they exceed their limits, but             ║
║  adjustments are not applied to salaries      ║
║  until the 1st.                               ║
╚═══════════════════════════════════════════════╝
```

**What This Means:**
- ❌ Admin CANNOT see day-off calculations during the month
- ❌ Net salaries shown WITHOUT day-off adjustments
- ✅ Admin can still view staff list and configure policies
- ✅ System is waiting for month to end

---

### Admin View on 1st Day of Month

**Where:** Admin Dashboard → Salary Management

**What Admin Sees:**

```
╔═══════════════════════════════════════════════╗
║  ✅ Day-Off Report Available                  ║
║                                               ║
║  Today is the 1st of the month. Day-off       ║
║  adjustments for last month are now           ║
║  calculated and applied to net salaries.      ║
║                                               ║
║  [📊 View Full Day-Off Report] ←── Button     ║
╚═══════════════════════════════════════════════╝
```

**Admin Can:**

1. **View Net Salaries with Day-Off Adjustments Applied**
   ```
   John Doe (CP5678)
   Base Salary: Rs. 50,000
   + OT: Rs. 5,000
   - Short Time: Rs. 2,000
   - Day-Off Deduction: Rs. 2,000  ← NOW INCLUDED!
   - Advances: Rs. 10,000
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NET SALARY: Rs. 41,000
   ```

2. **Click "View Full Day-Off Report"** → Goes to `/admin/dayoff-report`
   
   Shows detailed report:
   ```
   ╔════════════════════════════════════════════════════════════╗
   ║  📊 Monthly Day-Off Report - January 2025                  ║
   ╠════════════════════════════════════════════════════════════╣
   ║  Summary:                                                  ║
   ║  💰 Total Bonuses: Rs. 3,600                              ║
   ║  ⚠️ Total Deductions: Rs. 4,500                           ║
   ║  👥 Staff Count: 15                                        ║
   ╠════════════════════════════════════════════════════════════╣
   ║  Detailed Breakdown:                                       ║
   ║                                                            ║
   ║  Staff ID | Name    | Days Off | Adjustment | Status     ║
   ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
   ║  CP5678   | John    | 8/4 ⚠️   | -Rs. 2,000 | Deduction  ║
   ║  CP1234   | Sarah   | 2/4 ✅   | +Rs. 600   | Bonus      ║
   ║  CP9012⚙️ | Mike    | 5/6 ✅   | +Rs. 400   | Bonus      ║
   ║  CP4567   | Lisa    | 4/4 ⚖️   | Rs. 0      | On Track   ║
   ║  ...                                                       ║
   ╚════════════════════════════════════════════════════════════╝
   ```

---

### Admin Configuration: Global Default Policy

**Where:** Admin Dashboard → Salary Management → Configure Day-Off Policy

**Admin Can Set:**
1. **Max Days Off** (Threshold) - Default: 4 days
2. **Deduction Per Day** - Default: Rs. 500
3. **Bonus Per Day** - Default: Rs. 300

**Example Configuration:**
```
Max Days Off: 4
Deduction/Day: Rs. 500
Bonus/Day: Rs. 300

This means:
• If staff takes > 4 days off → Deduct Rs. 500 per extra day
• If staff takes < 4 days off → Bonus Rs. 300 per unused day
• If staff takes = 4 days off → No change
```

---

### Admin Configuration: Individual Custom Policy

**Where:** Admin Dashboard → Salary Management → Setup Tab → Select Staff

**Admin Can:**

1. **Select a specific staff member**
2. **Check ✅ "Use Custom Day-Off Policy"**
3. **Set individual values:**
   ```
   Days Off Threshold: 6  (instead of 4)
   Deduction Rate: Rs. 700/day  (instead of 500)
   Bonus Rate: Rs. 400/day  (instead of 300)
   ```
4. **Save** with the salary configuration

**Why Use Custom Policy?**
- Senior staff might get more allowed days off
- Different roles have different requirements
- Performance-based adjustments
- Flexible management

**Example:**
```
Regular Staff (Default):
  • Max: 4 days
  • Deduction: Rs. 500/day
  • Bonus: Rs. 300/day

Senior Staff (Custom):
  • Max: 6 days  ← More allowed!
  • Deduction: Rs. 700/day  ← Higher penalty if exceeded
  • Bonus: Rs. 400/day  ← Higher reward!
```

**Visual Indicator:**
- Staff with custom policy show ⚙️ icon in admin views
- Reports clearly mark "Custom Policy" vs "Default Policy"

---


## 4. WHEN AND HOW IT'S ADDED TO SALARY

### Timing: ONLY on 1st Day of Each Month

**Key Rule:** Day-off adjustments are calculated and applied **ONLY on the 1st day of each month** for the **previous month's** data.

**Example Timeline:**
```
January 1-31:
  • Staff marks availability weekly (every Sunday)
  • System archives each week's data
  • Staff sees warnings if over limit (NO amounts)
  • Admin sees info notice (NO calculations)
  • Net salaries shown WITHOUT day-off adjustments

February 1st:
  • System calculates January's days off for ALL staff
  • System applies bonuses/deductions
  • Admin sees full report
  • Net salaries NOW include January's day-off adjustments
  • These adjustments apply to February's salary payment

February 2-28:
  • Same as January - tracking for February
  • January's adjustments already applied
  • Waiting for February to end

March 1st:
  • System calculates February's days off
  • February's adjustments applied to March salary
  • And so on...
```

---

### Calculation Formula

**Step 1: Count Days Off**
```javascript
// System queries all archived weeks from the month
// Counts how many days marked as "available: false"

Example for January:
Week 1 (Jan 7-13):   2 days off (Tue, Sat)
Week 2 (Jan 14-20):  2 days off (Tue, Sat)
Week 3 (Jan 21-27):  3 days off (Tue, Wed, Sat)
Week 4 (Jan 28-Feb 3): 1 day off in Jan (Tue only)

Total January Days Off: 2 + 2 + 3 + 1 = 8 days
```

**Step 2: Get Staff's Policy**
```javascript
// Check if staff has custom policy
if (staffDayOffConfig exists && isCustom) {
  threshold = custom.maxDaysOff (e.g., 6)
  deductionRate = custom.deductionPerDay (e.g., 700)
  bonusRate = custom.bonusPerDay (e.g., 400)
} else {
  threshold = default.maxDaysOff (4)
  deductionRate = default.deductionPerDay (500)
  bonusRate = default.bonusPerDay (300)
}
```

**Step 3: Calculate Adjustment**
```javascript
if (daysOff > threshold) {
  // DEDUCTION
  excessDays = daysOff - threshold
  adjustment = -(excessDays × deductionRate)
  
  Example: 8 days off, threshold 4
  excessDays = 8 - 4 = 4
  adjustment = -(4 × 500) = -Rs. 2,000
  
} else if (daysOff < threshold) {
  // BONUS
  bonusDays = threshold - daysOff
  adjustment = bonusDays × bonusRate
  
  Example: 2 days off, threshold 4
  bonusDays = 4 - 2 = 2
  adjustment = 2 × 300 = +Rs. 600
  
} else {
  // EXACTLY AT THRESHOLD
  adjustment = 0
}
```

**Step 4: Add to Net Salary**
```javascript
netSalary = baseSalary + otAmount - shortTime + dayOffAdjustment - advances

Example 1 - John (Deduction):
  Base: Rs. 50,000
  + OT: Rs. 5,000
  - Short: Rs. 2,000
  + Day-Off: Rs. -2,000  ← DEDUCTION
  - Advances: Rs. 10,000
  ━━━━━━━━━━━━━━━━━━━━━━━
  NET: Rs. 41,000

Example 2 - Sarah (Bonus):
  Base: Rs. 45,000
  + OT: Rs. 3,000
  - Short: Rs. 0
  + Day-Off: Rs. +600  ← BONUS
  - Advances: Rs. 5,000
  ━━━━━━━━━━━━━━━━━━━━━━━
  NET: Rs. 43,600
```

---

### Where It Appears in Salary

**Admin View - Salary Breakdown (on 1st day only):**
```
╔════════════════════════════════════════╗
║  John Doe (CP5678)                     ║
║  January 2025 Salary                   ║
╠════════════════════════════════════════╣
║  Base Salary          Rs. 50,000       ║
║  + Overtime           Rs.  5,000       ║
║  - Short Time         Rs. -2,000       ║
║  + Day-Off Adj        Rs. -2,000  ⚠️   ║
║  - Advances           Rs.-10,000       ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║  NET SALARY           Rs. 41,000       ║
╠════════════════════════════════════════╣
║  Day-Off Details:                      ║
║  • Days Off Taken: 8 days              ║
║  • Your Limit: 4 days                  ║
║  • Excess: 4 days                      ║
║  • Rate: Rs. 500/day                   ║
║  • Deduction: -Rs. 2,000               ║
╚════════════════════════════════════════╝
```

**Staff View - Salary Details:**
```
Staff can see their salary breakdown in Salary View page
Shows same information as admin view
Explains why deduction or bonus was applied
```

---


## 5. DATABASE STRUCTURE

### Collections Used:

#### **A. `availabilities/{staffUid}` - Current Week**
**Purpose:** Store the current week's availability (live data)

**Structure:**
```javascript
{
  staffUid: "john_123",
  staffName: "John Doe",
  staffId: "CP5678",
  currentWeek: "2024-01-14", // Sunday date
  availabilities: {
    Sunday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Monday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Tuesday: { available: false }, // DAY OFF
    Wednesday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Thursday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Friday: { available: true, startTime: "09:00", endTime: "17:00", breaks: [] },
    Saturday: { available: false } // DAY OFF
  },
  lastUpdated: "2024-01-14T10:30:00Z",
  updatedAt: "2024-01-14T10:30:00Z"
}
```

**When Updated:** Every Sunday when staff saves availability

---

#### **B. `weeklyAvailability/{auto-id}` - Historical Archive**
**Purpose:** Store all past weeks for monthly calculations

**Structure:**
```javascript
{
  staffUid: "john_123",
  staffName: "John Doe",
  staffId: "CP5678",
  weekStartDate: "2024-01-14", // Sunday date
  availabilities: {
    // Same structure as above
    Sunday: { available: true, ... },
    Monday: { available: true, ... },
    Tuesday: { available: false }, // Day off
    ...
  },
  savedAt: "2024-01-14T10:30:00Z",
  archivedAt: "2024-01-14T10:30:00Z"
}
```

**When Created:** Every Sunday when staff saves (immediately archived)

**Why Important:** This is what the system queries to calculate monthly days off!

---

#### **C. `systemConfig/dayOffRates` - Global Default Policy**
**Purpose:** Store the default day-off policy for all staff

**Structure:**
```javascript
{
  maxDaysOff: 4,
  deductionPerDay: 500,
  bonusPerDay: 300,
  updatedAt: "2024-01-15T10:00:00Z"
}
```

**When Updated:** When admin configures global policy

---

#### **D. `staffDayOffConfig/{staffUid}` - Individual Custom Policies**
**Purpose:** Store custom day-off policies for specific staff

**Structure:**
```javascript
{
  staffUid: "mike_789",
  staffName: "Mike Chen",
  staffId: "CP9012",
  maxDaysOff: 6,
  deductionPerDay: 700,
  bonusPerDay: 400,
  useDefault: false, // false = use custom, true = use default
  updatedAt: "2024-01-15T11:00:00Z"
}
```

**When Updated:** When admin sets custom policy for a staff member in Setup tab

---

#### **E. `salaries/{staffUid}` - Staff Salaries**
**Purpose:** Store base salary and OT rate

**Structure:**
```javascript
{
  staffUid: "john_123",
  staffName: "John Doe",
  staffId: "CP5678",
  monthlySalary: 50000,
  hourlyRate: 240.38, // Calculated: monthlySalary / (26 × 8)
  otRate: 500,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T10:00:00Z"
}
```

**When Updated:** When admin sets or updates salary in Setup tab

---

#### **F. `adjustmentRequests/{requestId}` - OT and Short Time**
**Purpose:** Track overtime and short time approvals

**Structure:**
```javascript
{
  staffUid: "john_123",
  adjustmentType: "overtime", // or "short_time"
  adjustmentHours: 10,
  adjustmentAmount: 5000, // hours × otRate
  status: "approved",
  shiftMonth: "2024-01",
  ...
}
```

**When Created:** When admin approves OT or short time requests

**Used In Calculation:** Yes - OT adds, Short Time subtracts from net salary

---

#### **G. `advanceRequests/{requestId}` - Advance Payments**
**Purpose:** Track staff advance requests and approvals

**Structure:**
```javascript
{
  staffUid: "john_123",
  amount: 10000,
  status: "approved",
  shiftMonth: "2024-01",
  ...
}
```

**When Created:** When admin approves advance requests

**Used In Calculation:** Yes - Advances subtract from net salary

---


## 6. COMPLETE CALCULATION EXAMPLES

### Example 1: Regular Staff - TOO MANY Days Off (Deduction)

**Staff:** John Doe (CP5678)  
**Policy:** Default (4 days threshold, Rs. 500 deduction, Rs. 300 bonus)  
**Month:** January 2025  

**Weekly Breakdown:**
```
Week 1 (Jan 5-11):   Took off: Tuesday, Saturday = 2 days
Week 2 (Jan 12-18):  Took off: Tuesday, Saturday = 2 days  
Week 3 (Jan 19-25):  Took off: Tuesday, Wednesday, Saturday = 3 days
Week 4 (Jan 26-Feb 1): Took off: Tuesday (only 1 day in January)

TOTAL JANUARY DAYS OFF: 2 + 2 + 3 + 1 = 8 days
```

**On February 1st - Calculation Happens:**
```javascript
// Step 1: Count days off
daysOff = 8

// Step 2: Get policy
threshold = 4 (default)
deductionRate = 500 (default)

// Step 3: Calculate
daysOff > threshold? YES (8 > 4)
excessDays = 8 - 4 = 4
adjustment = -(4 × 500) = -Rs. 2,000

// Step 4: Apply to salary
baseSalary = 50,000
otAmount = 5,000
shortTime = -2,000
dayOffAdjustment = -2,000  ← DEDUCTION
advances = -10,000

netSalary = 50,000 + 5,000 - 2,000 - 2,000 - 10,000
netSalary = Rs. 41,000
```

**Admin Sees (Feb 1st):**
```
John Doe Salary for January:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base Salary:        Rs. 50,000
+ Overtime:         Rs.  5,000
- Short Time:       Rs. -2,000
- Day-Off:          Rs. -2,000  ⚠️
- Advances:         Rs.-10,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NET SALARY:         Rs. 41,000

Day-Off Details:
• Days Off: 8 / 4 limit
• Excess: 4 days
• Rate: Rs. 500/day
• Deduction: -Rs. 2,000
```

**Monthly Report (Feb 1st):**
```
CP5678 | John Doe | 8/4 ⚠️ | -Rs. 2,000 | Deduction
```

---

### Example 2: Regular Staff - FEWER Days Off (Bonus)

**Staff:** Sarah Lee (CP1234)  
**Policy:** Default (4 days threshold)  
**Month:** January 2025  

**Weekly Breakdown:**
```
Week 1 (Jan 5-11):   Took off: Saturday = 1 day
Week 2 (Jan 12-18):  Took off: Saturday = 1 day
Week 3 (Jan 19-25):  Took off: None = 0 days
Week 4 (Jan 26-Feb 1): Took off: None = 0 days

TOTAL JANUARY DAYS OFF: 1 + 1 + 0 + 0 = 2 days
```

**On February 1st - Calculation:**
```javascript
daysOff = 2
threshold = 4

daysOff < threshold? YES (2 < 4)
bonusDays = 4 - 2 = 2
adjustment = 2 × 300 = +Rs. 600

netSalary = 45,000 + 3,000 + 600 - 5,000
netSalary = Rs. 43,600
```

**Admin Sees:**
```
Sarah Lee Salary for January:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base Salary:        Rs. 45,000
+ Overtime:         Rs.  3,000
+ Day-Off Bonus:    Rs.    600  ✅
- Advances:         Rs. -5,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NET SALARY:         Rs. 43,600

Day-Off Details:
• Days Off: 2 / 4 limit
• Under limit: 2 days
• Rate: Rs. 300/day
• Bonus: +Rs. 600
```

**Monthly Report:**
```
CP1234 | Sarah Lee | 2/4 ✅ | +Rs. 600 | Bonus
```

---

### Example 3: Senior Staff - CUSTOM Policy

**Staff:** Mike Chen (CP9012) - Senior Staff  
**Policy:** Custom (6 days threshold, Rs. 700 deduction, Rs. 400 bonus) ⚙️  
**Month:** January 2025  

**Admin Set Custom Policy:**
```
Admin went to Setup tab
Selected Mike Chen
✅ Checked "Use Custom Day-Off Policy"
Set:
  • Days Off Threshold: 6
  • Deduction Rate: Rs. 700/day
  • Bonus Rate: Rs. 400/day
Saved configuration
```

**Weekly Breakdown:**
```
Week 1: 1 day off
Week 2: 1 day off
Week 3: 2 days off
Week 4: 1 day off

TOTAL: 5 days off
```

**On February 1st - Calculation:**
```javascript
daysOff = 5
threshold = 6 (CUSTOM!)
bonusRate = 400 (CUSTOM!)

daysOff < threshold? YES (5 < 6)
bonusDays = 6 - 5 = 1
adjustment = 1 × 400 = +Rs. 400

netSalary = 60,000 + 8,000 - 1,000 + 400 - 15,000
netSalary = Rs. 52,400
```

**Admin Sees:**
```
Mike Chen ⚙️ Salary for January:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base Salary:        Rs. 60,000
+ Overtime:         Rs.  8,000
- Short Time:       Rs. -1,000
+ Day-Off Bonus:    Rs.    400  ✅ (Custom)
- Advances:         Rs.-15,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NET SALARY:         Rs. 52,400

Day-Off Details:
• Days Off: 5 / 6 limit ⚙️
• Under limit: 1 day
• Rate: Rs. 400/day (custom)
• Bonus: +Rs. 400
```

**Monthly Report:**
```
CP9012⚙️ | Mike Chen | 5/6 ✅ | +Rs. 400 | Bonus (Custom)
```

---

### Example 4: Staff at EXACT Threshold (No Change)

**Staff:** Lisa Wang (CP4567)  
**Policy:** Default (4 days threshold)  
**Month:** January 2025  

**Weekly Breakdown:**
```
Week 1: 1 day off
Week 2: 1 day off
Week 3: 1 day off
Week 4: 1 day off

TOTAL: 4 days off (EXACTLY at threshold)
```

**On February 1st - Calculation:**
```javascript
daysOff = 4
threshold = 4

daysOff === threshold? YES
adjustment = 0 (no bonus, no deduction)

netSalary = 40,000 + 2,000 - 500 + 0 - 8,000
netSalary = Rs. 33,500
```

**Admin Sees:**
```
Lisa Wang Salary for January:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base Salary:        Rs. 40,000
+ Overtime:         Rs.  2,000
- Short Time:       Rs.   -500
+ Day-Off:          Rs.      0  ⚖️
- Advances:         Rs. -8,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NET SALARY:         Rs. 33,500

Day-Off Details:
• Days Off: 4 / 4 limit
• Status: On Track
• No adjustment applied
```

**Monthly Report:**
```
CP4567 | Lisa Wang | 4/4 ⚖️ | Rs. 0 | On Track
```

---

### Comparison Table: All Examples

| Staff | Days Off | Threshold | Policy | Excess/Bonus Days | Rate | Adjustment | Net Impact |
|-------|----------|-----------|--------|-------------------|------|------------|------------|
| John | 8 | 4 | Default | 4 excess | Rs. 500 | **-Rs. 2,000** | Deduction |
| Sarah | 2 | 4 | Default | 2 bonus | Rs. 300 | **+Rs. 600** | Bonus |
| Mike | 5 | 6 | Custom⚙️ | 1 bonus | Rs. 400 | **+Rs. 400** | Bonus |
| Lisa | 4 | 4 | Default | 0 | - | **Rs. 0** | Neutral |

---


## 7. TIMELINE AND FLOW - Complete Monthly Cycle

### JANUARY (Throughout the Month)

#### **Week 1: Sunday, January 7**
**Staff Side:**
```
John logs in
→ Today is SUNDAY ✅
→ Can update availability
→ Marks Tuesday & Saturday as "unavailable"
→ Clicks "Save All Changes"
→ System saves to:
   • availabilities/john_123 (current)
   • weeklyAvailability/week1_id (archive)
```

**System Action:**
```javascript
// Immediate save to database
availabilities/john_123 = {current week data}
weeklyAvailability/auto-id-1 = {
  weekStartDate: "2024-01-07",
  availabilities: {...},
  archivedAt: "2024-01-07T10:30:00Z"
}
```

#### **Monday, January 8 - Saturday, January 13**
**Staff Side:**
```
John tries to access Availability page
→ Sees: 🔒 "Availability Updates Restricted"
→ Next Update Day: Sunday, Jan 14, 2025
→ All inputs disabled (grayed out)
→ Can VIEW his schedule but cannot EDIT
```

**Admin Side:**
```
Admin views Salary Management
→ Sees: "Day-off calculations only on 1st day"
→ Cannot see day-off adjustments yet
→ Net salaries shown WITHOUT day-off
```

---

#### **Week 2: Sunday, January 14**
**Staff Side:**
```
John logs in again
→ Today is SUNDAY ✅
→ Previous week automatically archived
→ Updates new week's availability
→ Marks Tuesday & Saturday as "unavailable"
→ Saves successfully
```

**System Action:**
```javascript
// Week 1 already archived from last Sunday
// New week 2 data saved:
weeklyAvailability/auto-id-2 = {
  weekStartDate: "2024-01-14",
  availabilities: {...}
}
```

**Cumulative Days Off So Far:**
```
Week 1: 2 days (Tue, Sat)
Week 2: 2 days (Tue, Sat)
TOTAL SO FAR: 4 days
```

**Staff Dashboard:**
```
John sees his dashboard
→ Days off: 4 / 4 limit
→ Status: On Track ⚖️
→ No warning shown (not over limit yet)
```

---

#### **Week 3: Sunday, January 21**
**Staff Side:**
```
John logs in
→ Updates availability
→ Marks Tuesday, Wednesday, Saturday as "unavailable" (3 days)
→ Saves
```

**System Action:**
```javascript
weeklyAvailability/auto-id-3 = {
  weekStartDate: "2024-01-21",
  availabilities: {...}
}
```

**Cumulative Days Off:**
```
Week 1: 2 days
Week 2: 2 days
Week 3: 3 days
TOTAL: 7 days (3 OVER limit!)
```

**Staff Dashboard - WARNING APPEARS:**
```
╔═══════════════════════════════════════════════╗
║  ⚠️ Day-Off Limit Exceeded                    ║
║                                               ║
║  You have taken 7 days off this month,        ║
║  which exceeds your limit of 4 days.          ║
║                                               ║
║  Days Off Taken So Far: 7 days               ║
║  Allowed Limit: 4 days                        ║
║  Excess Days: 3 days                          ║
║                                               ║
║  ⚠️ Warning: Deductions will be calculated    ║
║  and applied on the 1st of next month.        ║
║  Deduction rate: Rs. 500/day over limit.      ║
╚═══════════════════════════════════════════════╝
```

**Important:**
- ❌ NO deduction amount calculated yet
- ✅ Warning is INFORMATIONAL only
- ✅ Tells John what will happen on Feb 1st

---

#### **Week 4: Sunday, January 28**
**Staff Side:**
```
John updates last week of January
→ Marks Tuesday as "unavailable" (1 day in January, rest in Feb)
→ Saves
```

**Final Count for January:**
```
Week 1: 2 days
Week 2: 2 days
Week 3: 3 days
Week 4: 1 day (only Tuesday is in January)

FINAL JANUARY TOTAL: 8 days off
```

**Staff Dashboard:**
```
Warning updated:
• Days Off: 8 days
• Limit: 4 days
• Excess: 4 days
• Still just a warning - no calculation
```

---

#### **January 29-31 (End of Month)**
**Staff Side:**
```
John can view his dashboard
→ Still sees warning (8 days / 4 limit)
→ No deduction applied yet
→ Waiting for February 1st
```

**Admin Side:**
```
Admin views Salary Management
→ Still sees info notice
→ Net salaries WITHOUT day-off adjustments
→ Cannot see calculations yet
```

---

### FEBRUARY 1st (CALCULATION DAY!)

#### **System Automatic Process (Midnight/Early Morning)**
```javascript
// For ALL staff members:

1. Check today's date
   → Is it the 1st? YES

2. Calculate previous month (January)
   → Query all weeklyAvailability records
   → Filter by January dates
   → Count "available: false" days

3. For each staff:
   → Get their policy (custom or default)
   → Calculate adjustment
   → Store result

4. Apply to salaries
   → Add/subtract from net salary calculation
```

#### **Admin Login (February 1st)**
**Admin Dashboard:**
```
╔═══════════════════════════════════════════════╗
║  ✅ Day-Off Report Available                  ║
║                                               ║
║  Today is the 1st of the month. Day-off       ║
║  adjustments for January are now calculated   ║
║  and applied to net salaries below.           ║
║                                               ║
║  [📊 View Full Day-Off Report]                ║
╚═══════════════════════════════════════════════╝
```

**Admin clicks "View Full Day-Off Report":**
```
╔════════════════════════════════════════════════╗
║  📊 Monthly Day-Off Report - January 2025      ║
╠════════════════════════════════════════════════╣
║  💰 Total Bonuses: Rs. 5,400                  ║
║  ⚠️ Total Deductions: Rs. 6,500               ║
║  👥 Staff Count: 20                            ║
╠════════════════════════════════════════════════╣
║  Staff ID | Name  | Days Off | Adjustment     ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║  CP5678   | John  | 8/4 ⚠️   | -Rs. 2,000     ║
║  CP1234   | Sarah | 2/4 ✅   | +Rs. 600       ║
║  CP9012⚙️ | Mike  | 5/6 ✅   | +Rs. 400       ║
║  CP4567   | Lisa  | 4/4 ⚖️   | Rs. 0          ║
║  ...                                           ║
╚════════════════════════════════════════════════╝
```

**Admin views John's salary:**
```
John Doe (CP5678) - January 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base Salary:        Rs. 50,000
+ Overtime:         Rs.  5,000
- Short Time:       Rs. -2,000
- Day-Off:          Rs. -2,000  ← NOW APPLIED!
- Advances:         Rs.-10,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NET SALARY:         Rs. 41,000

This is the amount John receives for January
```

---

#### **Staff Login (February 1st)**
**John's View:**
```
John logs into his Salary View page
→ Sees January salary breakdown
→ Shows -Rs. 2,000 day-off deduction
→ Understands why it was deducted
→ Net salary: Rs. 41,000
```

**Warning Still Visible:**
```
The warning from January is still shown as reference:
"You took 8 days off in January (4 over limit)
Deduction of Rs. 2,000 has been applied to your salary"
```

---

### FEBRUARY 2-28 (New Tracking Begins)

**Staff Side:**
```
Every Sunday:
→ John updates availability for new week
→ System tracks February days off
→ If he goes over limit, warning appears
→ But NO calculation until March 1st
```

**Admin Side:**
```
Throughout February:
→ Info notice shows
→ Cannot see day-off calculations
→ Net salaries WITHOUT February adjustments
→ January's adjustments already applied
```

---

### MARCH 1st (Next Calculation Day)

**System Process:**
```
1. Calculate FEBRUARY days off for all staff
2. Apply bonuses/deductions for February
3. Show in March 1st report
4. Add to March salary payment
```

**And the cycle continues...**

---


## 8. KEY FUNCTIONS EXPLAINED

### Staff Side Functions

#### **A. `saveAvailabilities()` - Save Weekly Data**
**Location:** `src/Pages/StaffDashboard/StaffAvailability.jsx`

**What it does:**
```javascript
async function saveAvailabilities() {
  // 1. Validate - only on Sunday
  if (!isSunday) {
    alert("Can only update on Sundays");
    return;
  }
  
  // 2. Check if new week - if yes, archive previous
  const currentWeekStart = getCurrentWeekStart(); // Sunday date
  if (newWeek !== previousWeek) {
    // Archive old week to weeklyAvailability
    archivePreviousWeek();
  }
  
  // 3. Save to current availability
  await setDoc(doc(db, "availabilities", staffUid), {
    staffUid,
    staffName,
    staffId,
    currentWeek: currentWeekStart,
    availabilities: availabilities, // The 7-day schedule
    lastUpdated: new Date().toISOString()
  });
  
  // 4. Also save to weekly archive
  await addDoc(collection(db, "weeklyAvailability"), {
    staffUid,
    staffName,
    staffId,
    weekStartDate: currentWeekStart,
    availabilities: availabilities,
    savedAt: new Date().toISOString(),
    archivedAt: new Date().toISOString()
  });
  
  // 5. Show success message
  setSaved(true);
}
```

**Result:** Data stored in both `availabilities` (current) and `weeklyAvailability` (archive)

---

#### **B. `getCurrentMonthRunningDaysOff()` - Staff Warning Check**
**Location:** `src/config/dayOffRates.js`

**What it does:**
```javascript
async function getCurrentMonthRunningDaysOff(staffUid) {
  // 1. Get current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthString = `${year}-${month.toString().padStart(2, '0')}`;
  
  // 2. Calculate days off including current partial week
  const daysOff = await calculateMonthlyDaysOff(staffUid, monthString, true);
  //                                                                   ↑
  //                                        true = include current week
  
  // 3. Get staff's policy (custom or default)
  const config = await getEffectiveDayOffConfig(staffUid);
  
  // 4. Determine status
  let status = 'on-track';
  if (daysOff > config.maxDaysOff) {
    status = 'over-limit'; // Show warning!
  } else if (daysOff < config.maxDaysOff) {
    status = 'under-limit'; // Good!
  } else {
    status = 'at-limit'; // Exactly at threshold
  }
  
  // 5. Return info (NO adjustment amount calculated!)
  return {
    daysOff,
    threshold: config.maxDaysOff,
    excessDays: daysOff > config.maxDaysOff ? daysOff - config.maxDaysOff : 0,
    status,
    isCustom: config.isCustom,
    deductionPerDay: config.deductionPerDay,
    bonusPerDay: config.bonusPerDay
  };
}
```

**Result:** Returns warning info for staff dashboard (no $ amounts)

---

### Admin Side Functions

#### **C. `calculateMonthlyDaysOff()` - Count Days Off**
**Location:** `src/config/dayOffRates.js`

**What it does:**
```javascript
async function calculateMonthlyDaysOff(staffUid, month, includeCurrent = true) {
  // month format: "2024-01" (January 2024)
  
  // 1. Parse month
  const [year, monthNum] = month.split('-');
  const monthStart = new Date(year, monthNum - 1, 1); // Jan 1
  const monthEnd = new Date(year, monthNum, 0); // Jan 31
  
  // 2. Query archived weeks for this staff
  const weeklyQuery = query(
    collection(db, 'weeklyAvailability'),
    where('staffUid', '==', staffUid)
  );
  const snapshot = await getDocs(weeklyQuery);
  
  let totalDaysOff = 0;
  
  // 3. For each archived week
  snapshot.forEach(doc => {
    const data = doc.data();
    const weekStartDate = new Date(data.weekStartDate);
    
    // Check each day of the week (Sun-Sat)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 
                  'Thursday', 'Friday', 'Saturday'];
    
    days.forEach((day, index) => {
      // Calculate actual date for this day
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(dayDate.getDate() + index);
      
      // If this day is within the target month
      if (dayDate >= monthStart && dayDate <= monthEnd) {
        // Check if unavailable
        const dayData = data.availabilities[day];
        if (!dayData || !dayData.available) {
          totalDaysOff++; // Count this day!
        }
      }
    });
  });
  
  // 4. Optionally include current week (for warnings)
  if (includeCurrent) {
    // Query current availability
    const currentDoc = await getDoc(doc(db, 'availabilities', staffUid));
    if (currentDoc.exists()) {
      // Same logic for current week up to today
      // ...
    }
  }
  
  return totalDaysOff;
}
```

**Result:** Returns total count of days marked unavailable in the month

---

#### **D. `getDayOffAdjustment()` - Calculate $ Amount**
**Location:** `src/Pages/AdminDashboard/SalaryManagement.jsx`

**What it does:**
```javascript
function getDayOffAdjustment(staffUid) {
  // 1. CRITICAL: Only calculate on 1st day of month
  if (!isFirstDayOfMonth()) {
    return 0; // Return Rs. 0 on all other days!
  }
  
  // 2. Get days off for this staff (from previous month)
  const daysOff = staffDaysOff[staffUid];
  if (!daysOff && daysOff !== 0) return 0;
  
  // 3. Get effective policy (custom or default)
  const config = staffDayOffConfigs[staffUid] || dayOffConfig;
  const { maxDaysOff, deductionPerDay, bonusPerDay } = config;
  
  // 4. Calculate adjustment
  if (daysOff > maxDaysOff) {
    // DEDUCTION
    const excessDays = daysOff - maxDaysOff;
    return -(excessDays * deductionPerDay);
    // Example: -(4 × 500) = -2000
    
  } else if (daysOff < maxDaysOff) {
    // BONUS
    const bonusDays = maxDaysOff - daysOff;
    return bonusDays * bonusPerDay;
    // Example: 2 × 300 = 600
    
  } else {
    // EXACTLY AT THRESHOLD
    return 0;
  }
}
```

**Result:** Returns adjustment amount (negative = deduction, positive = bonus)

---

#### **E. `calculateNetSalary()` - Final Salary Calculation**
**Location:** `src/Pages/AdminDashboard/SalaryManagement.jsx`

**What it does:**
```javascript
function calculateNetSalary(staffUid, monthlySalary) {
  // 1. Get all salary components
  const otAmount = getTotalOT(staffUid);
  const shortTime = getTotalShortTime(staffUid);
  const advances = getTotalAdvances(staffUid);
  const dayOffAdjustment = getDayOffAdjustment(staffUid);
  //                        ↑
  //                 Returns 0 if not 1st day!
  
  // 2. Calculate net
  const net = monthlySalary + otAmount - shortTime + dayOffAdjustment - advances;
  
  // 3. Ensure non-negative
  return Math.max(0, net);
}
```

**Formula:**
```
NET = Base + OT - Short + DayOff - Advances

Where:
- Base: Monthly salary
- OT: Overtime earnings (positive)
- Short: Short time deductions (negative)
- DayOff: Bonus (positive) or Deduction (negative)
- Advances: Advance payments taken (negative)
```

---

#### **F. `getEffectiveDayOffConfig()` - Get Policy**
**Location:** `src/config/dayOffRates.js`

**What it does:**
```javascript
async function getEffectiveDayOffConfig(staffUid) {
  // 1. Try to get custom config first
  const customConfig = await getStaffDayOffConfig(staffUid);
  
  // 2. Check if custom config exists and is active
  if (customConfig && !customConfig.useDefault) {
    // Return CUSTOM policy
    return {
      maxDaysOff: customConfig.maxDaysOff,
      deductionPerDay: customConfig.deductionPerDay,
      bonusPerDay: customConfig.bonusPerDay,
      isCustom: true
    };
  }
  
  // 3. Otherwise, return DEFAULT policy
  const defaultConfig = await getDayOffRates();
  return {
    maxDaysOff: defaultConfig.maxDaysOff || 4,
    deductionPerDay: defaultConfig.deductionPerDay || 500,
    bonusPerDay: defaultConfig.bonusPerDay || 300,
    isCustom: false
  };
}
```

**Result:** Returns the policy to use for this staff (custom or default)

---


## 9. COMMON SCENARIOS & QUESTIONS

### Q1: What if staff forgets to update availability on Sunday?

**Answer:**
- Previous week's availability remains in the system
- Staff cannot update until next Sunday
- Admin should remind staff to update every Sunday
- No penalty - just uses last saved availability

**Example:**
```
Week 1 (Jan 7): John updates → saves availability
Week 2 (Jan 14): John forgets to update
Week 3 (Jan 21): System still has Week 1 data archived
                 Week 2 has no new data (treated as no changes)
```

---

### Q2: Can staff change availability after Sunday?

**Answer:** NO
- System is LOCKED Monday-Saturday
- All inputs are disabled (grayed out)
- Staff can VIEW but cannot EDIT
- Must wait until next Sunday

**Reason:** Ensures weekly planning and prevents mid-week changes

---

### Q3: What happens if staff takes MORE days off than expected?

**Scenario:**
```
John planned 2 days off per week
Actually took 3 days off due to emergency
```

**Result:**
- System counts ACTUAL unavailable days from database
- If planning shows "available" but John didn't work → that's a separate issue
- Day-off system only tracks what staff marks as "unavailable"
- Emergency leave should be marked on next Sunday update

**Important:** This system tracks PLANNED availability, not actual attendance

---

### Q4: How does admin know if calculations are ready?

**Answer:**
```
Days 2-31: Blue info notice
  "Day-off calculations only on 1st day"
  
Day 1: Green success notice
  "✅ Day-Off Report Available"
  [View Full Day-Off Report] button
```

**Admin can:**
- Click button to see full monthly report
- View individual salary breakdowns with adjustments
- See which staff got bonuses vs deductions

---

### Q5: Can admin change policy mid-month?

**Answer:** Yes, but it only affects NEXT month's calculation

**Example:**
```
January 15: Admin changes default from 4 days to 5 days
January data: Still uses OLD policy (4 days)
February 1: January calculated with OLD policy
February tracking: Uses NEW policy (5 days)
March 1: February calculated with NEW policy
```

**Reason:** Fair and consistent - staff knew the rules at start of month

---

### Q6: What if staff has custom policy then admin removes it?

**Scenario:**
```
January: Mike has custom policy (6 days, Rs. 700)
February 1: Admin removes custom policy
```

**Result:**
- January calculation: Uses custom policy (was active in January)
- February onwards: Uses default policy (4 days, Rs. 500)
- System always uses policy that was active during the tracking month

---

### Q7: Can staff see how much deduction/bonus before 1st?

**Answer:** NO - By design

**What staff sees during month:**
- ✅ Warning if exceeding limit
- ✅ Days taken vs threshold
- ✅ Excess days count
- ❌ NO dollar amounts
- ✅ Explanation that it's calculated on 1st

**Why:** 
- Prevents confusion with partial month calculations
- Clear timeline expectations
- Only final complete month data used

---

### Q8: What if staff takes 0 days off?

**Scenario:** Sarah works every single day, never marks "unavailable"

**Calculation:**
```javascript
daysOff = 0
threshold = 4

0 < 4? YES
bonusDays = 4 - 0 = 4
bonus = 4 × 300 = +Rs. 1,200

Sarah gets MAXIMUM bonus!
```

**Result:** Rs. 1,200 bonus for perfect attendance

---

### Q9: What if staff takes every day off?

**Scenario:** Tom marks unavailable for all 31 days in January

**Calculation:**
```javascript
daysOff = 31
threshold = 4

31 > 4? YES
excessDays = 31 - 4 = 27
deduction = -(27 × 500) = -Rs. 13,500

Huge deduction!
```

**Important:**
- System will apply this deduction
- But admin should investigate - this seems unusual
- Might indicate staff on extended leave or not working
- Admin can manually adjust if needed

---

### Q10: How does this work with actual attendance/clock-ins?

**Answer:** They are SEPARATE systems

**Day-Off System:**
- Tracks PLANNED availability
- Staff says "I will be available/unavailable"
- Used for bonus/deduction calculations

**Attendance System:**
- Tracks ACTUAL clock-ins/clock-outs
- Staff actually clocks in when they work
- Used for hours worked, OT, short time

**Both work together:**
```
Example:
- Staff marks Monday as "available" (day-off system)
- Staff actually clocks in Monday 9 AM (attendance system)
- Staff works 8 hours (attendance system)
- No day-off penalty (day-off system - was marked available)
- Hours counted for salary (attendance system)
```

**If mismatch:**
```
- Staff marks Monday as "available" 
- But doesn't clock in (no attendance)
- Day-off system: No penalty (was marked available)
- Attendance system: No hours worked, might be short time
- These are handled separately
```

---

### Q11: Can admin see individual staff day-off details?

**Answer:** YES, in two places

**1. Monthly Report (1st day only):**
```
Full table showing:
- Each staff member
- Days off count
- Threshold
- Adjustment amount
- Policy type
```

**2. Salary Management View (1st day only):**
```
Individual salary cards show:
• Days Off This Month: 8 / 4 limit
• Adjustment: -Rs. 2,000
• Status: Deduction applied
```

---

### Q12: What's the difference between day-off and leave?

**Answer:** In this system, they are THE SAME

**Terms used:**
- Day-Off = Leave = Unavailable = Not working
- All mean: Staff marked that day as "available: false"

**Types of leave (all counted the same):**
- Personal leave
- Sick leave
- Vacation
- Public holidays (if staff marks unavailable)
- Any day not working

**System doesn't distinguish WHY** - only counts HOW MANY

---

## 10. SUMMARY - KEY POINTS

### ✅ For STAFF:

1. **Update availability ONLY on Sundays**
   - System locked Monday-Saturday
   - Mark each day as available or unavailable
   - Plan your week in advance

2. **Unavailable = Day Off**
   - Don't check the box = day off
   - Each day off counts toward monthly total

3. **See warnings during month**
   - If over limit, warning appears
   - Shows how many days over
   - NO $ amounts until 1st of next month

4. **Adjustments applied on 1st**
   - Deductions/bonuses calculated on 1st only
   - Applied to that month's salary payment
   - See final amount in salary view

### ✅ For ADMIN:

1. **Configure policies**
   - Global default: 4 days, Rs. 500, Rs. 300
   - Individual custom: Set per staff
   - Changes affect future months

2. **Monthly report on 1st day**
   - Full breakdown for all staff
   - Summary statistics
   - Export/print for records

3. **Calculations automatic**
   - System counts from archived weeks
   - Uses policy active during that month
   - Applies to net salary automatically

4. **Two policy types**
   - Default: Applies to all staff without custom
   - Custom: Set individually in Setup tab

### 📊 Calculation Formula:

```
STEP 1: Count days off from archived weekly data
STEP 2: Get effective policy (custom or default)
STEP 3: Calculate adjustment:
        IF days > threshold: -(excess × deductionRate)
        IF days < threshold: (bonus × bonusRate)
        IF days = threshold: 0
STEP 4: Add to net salary:
        NET = Base + OT - Short + DayOffAdj - Advances
```

### 🗓️ Timeline:

```
Sunday: Staff updates availability
Monday-Saturday: View only, no edits
Throughout month: Warnings for staff, info for admin
1st of next month: Calculate, apply, report
Repeat monthly
```

### 🔑 Critical Rules:

1. ✅ Availability updates: **Sundays only**
2. ✅ Calculations: **1st day only**
3. ✅ Previous month data: **Used for calculations**
4. ✅ Current month: **Tracking only, no calculations**
5. ✅ Warnings: **Informational, no amounts**
6. ✅ Custom policies: **Override default**
7. ✅ Archived weekly: **Source of truth for calculations**

---

## 📖 GLOSSARY

**Availability:** Staff's weekly schedule showing which days they will be available to work

**Day-Off:** A day marked as "unavailable" - staff is not working that day (same as leave)

**Threshold:** Maximum allowed days off before deduction applies (default: 4 days)

**Deduction:** Money subtracted from salary for taking too many days off

**Bonus:** Money added to salary for taking fewer days off than allowed

**Custom Policy:** Individual day-off rules for a specific staff member (overrides default)

**Default Policy:** Global day-off rules applied to all staff without custom policy

**Archived Week:** Historical weekly availability data stored in `weeklyAvailability` collection

**1st Day Calculation:** Automatic process on the 1st of each month that calculates previous month's day-off adjustments

**Net Salary:** Final take-home amount after all additions and deductions

---

## 🎯 END OF DOCUMENT

This system provides fair, transparent, and automatic management of staff day-offs/leave with financial incentives for good attendance and penalties for excessive absences.

For technical implementation details, see source code:
- `src/config/dayOffRates.js` - Core calculation logic
- `src/Pages/StaffDashboard/StaffAvailability.jsx` - Staff availability UI
- `src/Pages/AdminDashboard/SalaryManagement.jsx` - Admin salary management
- `src/Pages/AdminDashboard/MonthlyDayOffReport.jsx` - Monthly report UI

