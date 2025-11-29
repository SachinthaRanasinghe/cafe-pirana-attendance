# 📅 SYSTEM TIMING & DATA REFRESH REPORT
## When Calculations Happen & When Data Resets

**Report Date:** December 2024  
**System:** Cafe Piranha Staff Management System  
**Focus:** Timing of calculations, data visibility, and month transitions

---

## 🎯 EXECUTIVE SUMMARY

### **Critical Date: 1st of Every Month**

**On the 1st day of each month:**
- ✅ Day-off calculations finalize for PREVIOUS month
- ✅ Admin can view Monthly Day-Off Report
- ✅ Bonus/deduction amounts become visible in salary
- ✅ Previous month salaries show complete data

**Important:** Data doesn't "reset" - it's **filtered by month**

---

## 📊 PART 1: DAY-OFF CALCULATION TIMING

### 1.1 When Day-Off Calculations Happen

**Trigger Function:**
```javascript
export const isFirstDayOfMonth = () => {
  const today = new Date();
  return today.getDate() === 1;
};
```

**Timeline:**

| Date | Time | System Behavior |
|------|------|-----------------|
| **Jan 31, 11:59 PM** | Last moment of January | Day-off = Rs. 0 (pending) |
| **Feb 1, 12:00 AM** | **MIDNIGHT - TRIGGER** | ✅ Calculation runs |
| **Feb 1, 12:01 AM** | One minute later | January day-offs finalized |
| **Feb 1, All Day** | Entire 24 hours | Day-Off Report visible |
| **Feb 2, 12:00 AM** | Next day starts | Report becomes unavailable |

---

### 1.2 What Happens at Midnight on the 1st

```
FEBRUARY 1st, 00:00:00 (Midnight)
│
├─ [1] isFirstDayOfMonth() returns TRUE
│
├─ [2] MonthlyDayOffReport page becomes accessible
│     ├─ Admin can navigate to /admin/dayoff-report
│     └─ Page shows "January 2025 Attendance Summary"
│
├─ [3] calculatePreviousMonthDaysOffForAllStaff() executes
│     │
│     ├─ Calculates: "2025-01" (January)
│     │
│     ├─ For each staff member:
│     │   ├─ Query weeklyAvailability collection
│     │   ├─ Filter: January 1 - January 31
│     │   ├─ Count days marked as unavailable
│     │   ├─ Compare to threshold (e.g., 4 days)
│     │   ├─ Calculate adjustment:
│     │   │   ├─ If daysOff < 4: Bonus = (4 - daysOff) × Rs. 300
│     │   │   ├─ If daysOff > 4: Deduction = (daysOff - 4) × Rs. 500
│     │   │   └─ If daysOff = 4: No adjustment (Rs. 0)
│     │   └─ Return result
│     │
│     └─ Generate report with all staff adjustments
│
├─ [4] SalaryManagement page updates
│     ├─ Admin selects "January 2025" from month selector
│     ├─ getDayOffAdjustment("staffUid", "2025-01") now returns actual value
│     └─ January salary displays complete breakdown
│
└─ [5] Staff can view finalized January salary
      └─ SalaryView shows day-off bonus/deduction for January
```

---

### 1.3 Detailed Calculation Process

**Step-by-Step:**

```javascript
// Called on February 1st
await calculatePreviousMonthDaysOffForAllStaff(staffList);

// Inside the function:
const now = new Date(); // Feb 1, 2025
const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Jan 1, 2025
const monthString = "2025-01"; // January

// For John Doe:
const daysOff = await calculateMonthlyDaysOff("john_uid", "2025-01", false);
// Returns: 2 days (counted from weeklyAvailability)

const config = { maxDaysOff: 4, bonusPerDay: 300, deductionPerDay: 500 };

// Calculate adjustment:
// 2 < 4, so bonus
const bonusDays = 4 - 2 = 2;
const adjustment = 2 × 300 = Rs. 600;

// Result stored in reportData:
{
  staffName: "John Doe",
  daysOff: 2,
  threshold: 4,
  adjustment: 600,
  status: "bonus"
}
```

---

## 💰 PART 2: WHEN ADMIN SEES DAY-OFF DATA

### 2.1 Monthly Day-Off Report Visibility

**Access Rules:**

| Date | Report Status | What Admin Sees |
|------|---------------|-----------------|
| **Jan 1-31** | ❌ Unavailable | "Report only available on 1st of month" |
| **Feb 1 (All Day)** | ✅ **AVAILABLE** | **"January 2025 Attendance Summary"** |
| **Feb 2-28** | ❌ Unavailable | "Report only available on 1st of month" |
| **Mar 1 (All Day)** | ✅ **AVAILABLE** | **"February 2025 Attendance Summary"** |

**UI Implementation:**
```jsx
// MonthlyDayOffReport.jsx:130
if (!isFirstDayOfMonth) {
  return (
    <div className="not-available-message">
      <h2>Report Not Available Today</h2>
      <p>The monthly day-off report is only available on the 
         <strong>1st day of each month</strong>.
      </p>
    </div>
  );
}
```

---

### 2.2 Salary Management - Day-Off Display

**Before February 1st (Viewing January):**
```
January 2025 Salary - John Doe
├─ Base Salary:       Rs. 50,000
├─ + Overtime:        Rs.  1,500
├─ - Short Time:      Rs.    500
├─ - Advances:        Rs.  3,000
├─ Day-Off Adj:       Rs.      0  ⚠️ PENDING
│   └─ Message: "*Calculates on February 1st"
└─ Running Net:       Rs. 48,000
```

**After February 1st (Viewing January):**
```
January 2025 Salary - John Doe
├─ Base Salary:       Rs. 50,000
├─ + Overtime:        Rs.  1,500
├─ - Short Time:      Rs.    500
├─ - Advances:        Rs.  3,000
├─ + Day-Off Bonus:   Rs.    600  ✅ FINALIZED
│   └─ Details: "2 days off, earned Rs. 600 bonus"
└─ Final Net:         Rs. 48,600
```

**Code Logic:**
```javascript
// SalaryManagement.jsx
const getDayOffAdjustment = async (staffUid, month = selectedMonth) => {
  const currentMonth = new Date().toISOString().substring(0, 7);
  
  if (month === currentMonth) {
    return 0; // Current month - not calculated yet
  }
  
  // Historical month - calculate actual adjustment
  const daysOff = await calculateMonthlyDaysOff(staffUid, month, false);
  const config = await getEffectiveDayOffConfig(staffUid);
  
  if (daysOff > config.maxDaysOff) {
    return -(daysOff - config.maxDaysOff) * config.deductionPerDay;
  } else if (daysOff < config.maxDaysOff) {
    return (config.maxDaysOff - daysOff) * config.bonusPerDay;
  }
  
  return 0;
};
```

---


## 🔄 PART 3: DATA REFRESH BEHAVIOR

### 3.1 Critical Understanding: NO DATA RESETS

**Key Concept:**
> **Data doesn't "refresh" or "reset" for new months. All data is PERMANENTLY STORED and FILTERED by month.**

**Common Misconception:**
```
❌ WRONG: "On February 1st, January data gets deleted and system resets"
✅ CORRECT: "On February 1st, January data is finalized and February starts accumulating"
```

---

### 3.2 How Monthly Data Works

#### **OT (Overtime) Requests:**

**Storage:**
```javascript
// OT request created on Jan 15, 2025
{
  id: "ot_12345",
  staffUid: "john_uid",
  adjustmentType: "overtime",
  adjustmentAmount: 400,
  adjustmentHours: 2,
  shiftMonth: "2025-01",  // ← Tagged with month
  status: "approved",
  createdAt: "2025-01-15T..."
}
```

**Retrieval:**
```javascript
// When viewing January salary:
const otAmount = getTotalOT(staffUid, "2025-01");
// Queries: WHERE shiftMonth = "2025-01"
// Returns: Rs. 400

// When viewing February salary:
const otAmount = getTotalOT(staffUid, "2025-02");
// Queries: WHERE shiftMonth = "2025-02"
// Returns: Rs. 0 (no February OT yet)
```

**Timeline:**
```
January 1-31:
├─ Staff works OT sessions
├─ Requests created with shiftMonth: "2025-01"
├─ Admin approves
└─ getTotalOT("2025-01") returns accumulated total

February 1:
├─ January data STILL EXISTS
├─ getTotalOT("2025-01") still returns same total
├─ New OT requests tagged with "2025-02"
└─ getTotalOT("2025-02") starts from Rs. 0

February 28:
├─ January data: Still accessible via month selector
├─ February data: Accumulated throughout month
└─ March 1: February gets finalized, March starts
```

---

#### **Advance Requests:**

**Storage:**
```javascript
// Advance taken on Jan 20, 2025
{
  id: "adv_789",
  staffUid: "jane_uid",
  amount: 3000,
  shiftMonth: "2025-01",  // ← Tagged with month
  status: "approved",
  requestDate: "2025-01-20T...",
  reason: "Family emergency"
}
```

**Monthly Calculation:**
```javascript
// January salary:
getTotalAdvances("jane_uid", "2025-01") → Rs. 3,000

// February salary:
getTotalAdvances("jane_uid", "2025-02") → Rs. 0 (fresh start)

// March salary:
getTotalAdvances("jane_uid", "2025-03") → Rs. 0 (fresh start)
```

**Key Point:**
```
Each month's advances are INDEPENDENT
- January advance: Deducted from January salary only
- February advance: Deducted from February salary only
- No carry-over or accumulation across months
```

---

#### **Clock Sessions:**

**Storage:**
```javascript
// Session on Jan 31, 7 PM
{
  id: "session_456",
  staffUid: "mike_uid",
  clockIn: "2025-01-31T19:00:00",
  clockOut: "2025-02-01T03:00:00",
  shiftMonth: "2025-02",  // ← Assigned by shift function
  duration: 8,
  status: "completed"
}
```

**Important:**
```
Sessions are NEVER deleted
- January sessions: Always queryable
- February sessions: Added alongside January
- Historical data: Preserved indefinitely
```

---

### 3.3 Weekly Availability Refresh

**This is the ONLY thing that resets:**

```javascript
// StaffAvailability.jsx:81
const checkAndResetForNewWeek = async () => {
  const currentWeekStart = getWeekStart(new Date());
  const weekStartString = currentWeekStart.toISOString().split('T')[0];
  
  if (weekStartString !== existingAvailability.currentWeek) {
    // NEW WEEK DETECTED
    
    // 1. Archive current week to weeklyAvailability collection
    await addDoc(collection(db, 'weeklyAvailability'), {
      staffUid: user.uid,
      weekStartDate: existingAvailability.currentWeek,
      availabilities: existingAvailability.availabilities,
      archivedAt: new Date().toISOString()
    });
    
    // 2. Reset current availability for new week
    await updateDoc(availabilityRef, {
      currentWeek: weekStartString,
      availabilities: {
        Sunday: { available: true, note: "" },
        Monday: { available: true, note: "" },
        // ... all days reset to available
      }
    });
  }
};
```

**Timeline:**
```
Sunday, Jan 7, 00:00:00:
├─ System detects new week
├─ Archives Jan 1-6 availability
└─ Resets form to all "Available"

Monday, Jan 8 - Saturday, Jan 13:
└─ Staff marks days as needed

Sunday, Jan 14, 00:00:00:
├─ Archives Jan 7-13 availability
└─ Resets form again

Repeat every Sunday...
```

**Why Weekly Reset?**
```
Purpose: Keep staff availability form clean and easy to use
Benefit: Old data archived for monthly calculations
Process: Automatic, happens at midnight Sunday
```

---

## 📈 PART 4: COMPLETE MONTH TRANSITION EXAMPLE

### 4.1 January → February Transition

**January 31, 11:59 PM (Last moment):**

**Admin View (Salary Management):**
```
Month Selected: January 2025
Status: 🟢 CURRENT MONTH - RUNNING TOTALS

John Doe:
├─ Base Salary:       Rs. 50,000
├─ + OT (Jan):        Rs.  1,500  (7.5 hours, 5 sessions)
├─ - Short (Jan):     Rs.    500  (2 hours, 1 session)
├─ - Advances (Jan):  Rs.  3,000  (2 requests approved)
├─ Day-Off:           Rs.      0  *Pending
└─ Running Net:       Rs. 48,000

*Day-off adjustment calculates on February 1st
```

**Staff View (John Doe):**
```
MY SALARY - JANUARY 2025
🟡 CURRENT MONTH - RUNNING

Base:         Rs. 50,000
+ Overtime:   Rs.  1,500
- Short Time: Rs.    500
- Advances:   Rs.  3,000
+ Day-Off:    Rs.      0  *Pending
────────────────────────
Running Total: Rs. 48,000

*Final calculation tomorrow
```

**Data in Firestore:**
```
adjustmentRequests:
├─ { shiftMonth: "2025-01", type: "OT", amount: 400 }
├─ { shiftMonth: "2025-01", type: "OT", amount: 300 }
├─ { shiftMonth: "2025-01", type: "OT", amount: 800 }
└─ ... (all still present)

advanceRequests:
├─ { shiftMonth: "2025-01", amount: 2000 }
└─ { shiftMonth: "2025-01", amount: 1000 }

weeklyAvailability:
├─ { weekStartDate: "2025-01-07", days: {...} }
├─ { weekStartDate: "2025-01-14", days: {...} }
├─ { weekStartDate: "2025-01-21", days: {...} }
└─ { weekStartDate: "2025-01-28", days: {...} }
```

---

**February 1, 12:00 AM (Midnight - TRANSITION):**

```
🔔 SYSTEM TRIGGER: isFirstDayOfMonth() = TRUE

[Automatic Process - No Admin Action Required]
│
├─ [1] Calculate January Day-Offs
│     ├─ Query weeklyAvailability for January
│     ├─ Count John's unavailable days: 2 days
│     ├─ Threshold: 4 days
│     ├─ Adjustment: (4-2) × 300 = Rs. 600 bonus
│     └─ Store in memory for report
│
├─ [2] Monthly Day-Off Report becomes visible
│     └─ Admin can access at /admin/dayoff-report
│
└─ [3] Salary calculations update
      ├─ getDayOffAdjustment("john_uid", "2025-01") now returns 600
      └─ January net salary: Rs. 48,600 (was Rs. 48,000)
```

---

**February 1, 8:00 AM (Admin logs in):**

**Monthly Day-Off Report Page:**
```
╔════════════════════════════════════════════════════╗
║ 📊 MONTHLY DAY-OFF REPORT                         ║
║ January 2025 Attendance Summary                   ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║ Summary:                                          ║
║ ├─ Total Bonuses:    Rs. 15,600                  ║
║ ├─ Total Deductions: Rs.  2,500                  ║
║ └─ Staff Count:      25                          ║
║                                                    ║
║ Detailed Breakdown:                               ║
║ ┌──────────────────────────────────────────────┐ ║
║ │ John Doe (CP1234)                            │ ║
║ │ Days Off: 2 / 4                              │ ║
║ │ Adjustment: +Rs. 600 (Bonus)                 │ ║
║ │ Status: ✅ Bonus                             │ ║
║ └──────────────────────────────────────────────┘ ║
║                                                    ║
║ │ Sarah Lee (CP1235)                           │ ║
║ │ Days Off: 6 / 4                              │ ║
║ │ Adjustment: -Rs. 1,000 (Deduction)           │ ║
║ │ Status: ⚠️ Deduction                         │ ║
║ └──────────────────────────────────────────────┘ ║
║                                                    ║
╚════════════════════════════════════════════════════╝

📌 Note: This report is only available on the 1st of each month
```

**Salary Management - January View:**
```
Month Selected: January 2025
Status: ✅ FINALIZED SALARY

John Doe:
├─ Base Salary:       Rs. 50,000
├─ + OT (Jan):        Rs.  1,500
├─ - Short (Jan):     Rs.    500
├─ - Advances (Jan):  Rs.  3,000
├─ + Day-Off (Jan):   Rs.    600  ✅ CALCULATED
│   └─ 2 days off, earned 2-day bonus
└─ Final Net:         Rs. 48,600  (was Rs. 48,000)
```

**Salary Management - February View:**
```
Month Selected: February 2025
Status: 🟢 CURRENT MONTH - RUNNING TOTALS

John Doe:
├─ Base Salary:       Rs. 50,000
├─ + OT (Feb):        Rs.      0  (no OT yet)
├─ - Short (Feb):     Rs.      0
├─ - Advances (Feb):  Rs.      0
├─ Day-Off:           Rs.      0  *Pending
└─ Running Net:       Rs. 50,000

*February just started, no adjustments yet
*Day-off calculates on March 1st
```

---

**February 2, 12:00 AM (Next Day):**

```
🔔 SYSTEM STATUS: isFirstDayOfMonth() = FALSE

[Changes]
│
├─ [1] Monthly Day-Off Report: ❌ NO LONGER VISIBLE
│     └─ Page shows: "Report only available on 1st of month"
│
├─ [2] January salary: Still accessible via month selector
│     └─ Admin can still view January with day-off data
│
└─ [3] February accumulation: Continues normally
      ├─ New OT requests: shiftMonth = "2025-02"
      ├─ New advances: shiftMonth = "2025-02"
      └─ New sessions: shiftMonth = "2025-02"
```

---

## 🔍 PART 5: DETAILED TIMING SCENARIOS

### 5.1 Question: When does staff see their day-off bonus/deduction?

**Answer:**

| User | When They See It | What They See |
|------|------------------|---------------|
| **Staff (Current Month)** | January 1-31 | "Day-Off: Rs. 0 *Pending" |
| **Staff (Next Month)** | February 1+ | "Day-Off: Rs. 600 (Bonus)" when viewing January |
| **Admin (Current Month)** | January 1-31 | "Day-Off: Rs. 0 *Calculates on Feb 1" |
| **Admin (Next Month)** | February 1+ | "Day-Off: Rs. 600" when viewing January |

**Code Flow:**
```javascript
// Staff views January salary on Feb 5
const dayOffAdj = await getDayOffAdjustment(staffUid, "2025-01");
// "2025-01" !== current month ("2025-02")
// So calculate historical data
// Returns: Rs. 600
```

---

### 5.2 Question: What if staff works on February 1st?

**Answer: February 1st is just a normal working day for staff**

```
Staff Experience on February 1st:
├─ Clock in/out normally
├─ New sessions tagged as "2025-02"
├─ Can request OT for yesterday (Jan 31)
│   └─ Tagged as "2025-01" if before 6 PM
│   └─ Tagged as "2025-02" if after 6 PM (shift function)
├─ Can request advances for February
│   └─ Tagged as "2025-02"
└─ Can view salary history
    ├─ January: Now shows finalized day-off
    └─ February: Shows running totals
```

**Nothing changes operationally for staff**

---

### 5.3 Question: Can admin see day-off data BEFORE the 1st?

**Answer: No, but they can see running counts**

**During January:**
```javascript
// Admin can check running day-off count
const runningData = await getCurrentMonthRunningDaysOff(staffUid);
// Returns:
{
  daysOff: 2,           // Current count
  threshold: 4,
  status: "under-limit",
  excessDays: 0
}

// But adjustment is NOT calculated
// Day-off adjustment: Rs. 0 (pending)
```

**Staff Dashboard Warning:**
```
⚠️ DAY-OFF LIMIT EXCEEDED
You have taken 6 days off this month,
which exceeds your limit of 4 days.

Current Count: 6 days
Threshold: 4 days
Excess: 2 days

Expected Deduction: Rs. 1,000
(This will be applied to your salary on February 1st)
```

---

### 5.4 Question: What happens if admin misses checking the 1st?

**Answer: They can still view historical data via month selector**

```
Scenario: Admin doesn't log in on February 1st

February 2nd:
├─ Monthly Day-Off Report: Not visible (only on 1st)
├─ But: Admin can use Salary Management page
│   ├─ Select: "January 2025"
│   ├─ View: Complete salary with day-off adjustments
│   └─ Data is calculated on-demand for historical months

March 15th:
├─ Admin wants to see January data again
├─ Select: "January 2025" from month selector
├─ System calculates: getDayOffAdjustment("staff", "2025-01")
└─ Shows: Same Rs. 600 bonus as always
```

**Historical data is ALWAYS accessible**

---

## 📊 PART 6: DATA ACCUMULATION PATTERN

### 6.1 How Data Grows Over Time

**January (First Month of System):**
```
Database Size:
├─ adjustmentRequests: 50 documents (OT/Short sessions)
├─ advanceRequests: 20 documents
├─ weeklyAvailability: 100 documents (25 staff × 4 weeks)
└─ Total: ~170 documents
```

**February (Second Month):**
```
Database Size:
├─ adjustmentRequests: 100 documents (Jan: 50 + Feb: 50)
├─ advanceRequests: 40 documents (Jan: 20 + Feb: 20)
├─ weeklyAvailability: 200 documents (Jan: 100 + Feb: 100)
└─ Total: ~340 documents

Growth: 100% per month
```

**After 1 Year:**
```
Database Size:
├─ adjustmentRequests: 600 documents
├─ advanceRequests: 240 documents
├─ weeklyAvailability: 1,200 documents
└─ Total: ~2,040 documents

All historical data preserved
```

---

### 6.2 Query Performance Implications

**Current Query Pattern:**
```javascript
// Get January OT
const q = query(
  collection(db, "adjustmentRequests"),
  where("staffUid", "==", "john_uid"),
  where("shiftMonth", "==", "2025-01")
);

// Efficient: Indexed by staffUid and shiftMonth
// Returns: Only January data (~2-5 documents)
// Performance: Fast even with 1000s of documents
```

**Firestore Indexes Required:**
```
Collection: adjustmentRequests
Indexes:
├─ staffUid (ascending) + shiftMonth (ascending)
└─ shiftMonth (ascending) + status (ascending)

Collection: advanceRequests
Indexes:
├─ staffUid (ascending) + shiftMonth (ascending)
└─ shiftMonth (ascending) + status (ascending)

Collection: weeklyAvailability
Indexes:
├─ staffUid (ascending) + weekStartDate (ascending)
```

---

## ⚡ PART 7: PERFORMANCE CONSIDERATIONS

### 7.1 Calculation Load on the 1st

**What Happens:**
```
February 1st, First Admin Login:
│
├─ MonthlyDayOffReport loads
│   ├─ Fetches all staff (25 members)
│   ├─ For each staff:
│   │   ├─ Query weeklyAvailability (4-5 weeks)
│   │   ├─ Count days off
│   │   ├─ Calculate adjustment
│   │   └─ ~100ms per staff
│   └─ Total: 25 × 100ms = 2.5 seconds
│
└─ Result: Brief loading time acceptable
```

**Optimization Opportunity:**
```javascript
// Current: Calculate on-demand
// Better: Pre-calculate and cache

// Run at midnight Feb 1:
const results = await calculatePreviousMonthDaysOffForAllStaff();

// Store results:
await setDoc(doc(db, 'monthlyReports', '2025-01'), {
  month: '2025-01',
  calculations: results,
  generatedAt: new Date().toISOString()
});

// Admin loads instantly:
const cached = await getDoc(doc(db, 'monthlyReports', '2025-01'));
```

---

### 7.2 Month Selector Performance

**Current Implementation:**
```javascript
// Every time month changes:
useEffect(() => {
  // Re-fetch all data for selected month
  fetchOTRequests(selectedMonth);
  fetchAdvances(selectedMonth);
  calculateDayOff(selectedMonth);
}, [selectedMonth]);

// 3 separate queries per month switch
```

**Impact:**
```
User switches: Jan → Feb → Mar → Jan
Total Queries: 3 × 4 = 12 queries
Load Time: ~300-500ms per switch
```

**Acceptable for current scale**

---

## 🎯 PART 8: SUMMARY TABLES

### 8.1 Complete Timeline Reference

| Event | Date/Time | Trigger | Result |
|-------|-----------|---------|--------|
| **Staff works January** | Jan 1-31 | Normal operations | Data accumulates with shiftMonth: "2025-01" |
| **Last day of January** | Jan 31, 11:59 PM | End of month | Day-off still shows Rs. 0 (pending) |
| **Midnight calculation** | Feb 1, 00:00:00 | `isFirstDayOfMonth() = true` | January day-offs calculated |
| **Report available** | Feb 1, 00:00:01 | Calculation complete | Admin can view Monthly Day-Off Report |
| **All day Feb 1** | Feb 1, 00:00 - 23:59 | First day status | Report visible, January finalized |
| **Report closes** | Feb 2, 00:00:00 | `isFirstDayOfMonth() = false` | Report unavailable until Mar 1 |
| **Historical access** | Feb 2+ | Month selector | January data still accessible |
| **Next calculation** | Mar 1, 00:00:00 | Next 1st of month | February day-offs calculated |

---

### 8.2 Data Refresh Reference

| Data Type | Refresh Pattern | Storage Method | Access Method |
|-----------|----------------|----------------|---------------|
| **OT Requests** | ❌ Never resets | Tagged by shiftMonth | Filtered query |
| **Short Time** | ❌ Never resets | Tagged by shiftMonth | Filtered query |
| **Advances** | ❌ Never resets | Tagged by shiftMonth | Filtered query |
| **Sessions** | ❌ Never resets | Tagged by shiftMonth | Filtered query |
| **Weekly Availability** | ✅ Resets Sundays | Archived weekly | Historical query |
| **Day-Off Calculations** | ✅ Calculated monthly | On-demand | Calculated from archives |

---

### 8.3 Visibility Reference

| Item | When Visible | Who Sees It | Contains |
|------|-------------|-------------|----------|
| **Monthly Day-Off Report** | 1st of month ONLY | Admin only | Previous month summary |
| **Current Month Salary** | Anytime | Admin & Staff | Running totals, day-off = Rs. 0 |
| **Historical Salary** | Anytime via selector | Admin & Staff | Complete data with day-off |
| **Running Day-Off Count** | Current month only | Staff (if over limit) | Warning message |

---

## 🚨 PART 9: IMPORTANT EDGE CASES

### 9.1 What if system is down on the 1st?

**Scenario:** Server maintenance on February 1st

**Impact:**
```
✅ NO IMPACT - Calculations are on-demand
│
├─ Report not viewed on Feb 1: No problem
├─ Admin logs in Feb 2: Uses month selector for January
├─ System calculates on-demand: getDayOffAdjustment("2025-01")
└─ Result: Same as if viewed on Feb 1
```

**Conclusion:** No special handling needed

---

### 9.2 What if timezone causes date mismatch?

**Problem:**
```javascript
// Server in UTC, runs at 00:00 UTC on Feb 1
// Sri Lanka is UTC+5:30
// So Feb 1, 00:00 UTC = Feb 1, 05:30 AM Sri Lanka time

Admin in Sri Lanka logs in at 2 AM:
├─ Their local time: Feb 1, 02:00 AM
├─ Server time: Jan 31, 20:30 (still Jan 31!)
└─ isFirstDayOfMonth() = FALSE ❌
```

**Solution:**
```javascript
// Use Sri Lanka timezone explicitly
export const isFirstDayOfMonth = () => {
  const slDate = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Colombo',
    day: 'numeric'
  });
  return parseInt(slDate) === 1;
};
```

---

### 9.3 What if staff works night shift on Jan 31-Feb 1?

**Scenario:**
```
Staff: Mike
Shift: Jan 31, 11 PM - Feb 1, 7 AM

Clock In:  Jan 31, 23:00  → shiftMonth: "2025-02" (after 6 PM)
Clock Out: Feb 1,  07:00  → shiftMonth: "2025-02"

Result: Entire shift counted in February ✅
```

**Day-Off Impact:**
```
January availability:
├─ Jan 31 marked as "unavailable" (working night shift)
├─ Day-off count: Includes Jan 31
└─ Staff gets penalized? ❌ BUG!

Issue: Working night shift counted as "day off"
Fix needed: Exclude night shift dates from day-off count
```

---

## ✅ PART 10: QUICK REFERENCE

### 10.1 Admin Checklist for 1st of Month

**Morning of February 1st:**

- [ ] Log into Admin Dashboard
- [ ] Navigate to "Monthly Day-Off Report"
- [ ] Review January attendance summary
- [ ] Check staff with deductions (follow up if needed)
- [ ] Note total bonuses/deductions
- [ ] Export/save report if needed
- [ ] Navigate to "Salary Management"
- [ ] Select "January 2025"
- [ ] Verify day-off adjustments applied
- [ ] Review any anomalies
- [ ] Finalize January payroll

**Note:** Report only visible today, but data accessible anytime via month selector

---

### 10.2 Staff Information

**For Staff Members:**

```
When will I see my day-off bonus/deduction?
└─ On the 1st day of the next month

Example:
├─ January work: Calculated on February 1st
├─ View: Go to "My Salary" page
├─ Select: "January 2025"
└─ See: Complete breakdown including day-off

Current month always shows: "Day-Off: Rs. 0 *Pending"
```

---

### 10.3 Technical Reference

**Key Functions:**

| Function | Purpose | Returns |
|----------|---------|---------|
| `isFirstDayOfMonth()` | Check if today is 1st | Boolean |
| `calculatePreviousMonthDaysOffForAllStaff(staffList)` | Calculate all day-offs | Array of results |
| `getDayOffAdjustment(staffUid, month)` | Get day-off for specific month/staff | Number (Rs.) |
| `getTotalOT(staffUid, month)` | Get OT for specific month | Number (Rs.) |
| `getTotalAdvances(staffUid, month)` | Get advances for specific month | Number (Rs.) |

---

## 📞 CONCLUSION

### Key Takeaways:

1. ✅ **Day-off calculations happen on 1st of each month at midnight**
2. ✅ **Monthly Day-Off Report visible only on the 1st**
3. ✅ **Historical data always accessible via month selector**
4. ✅ **No data "resets" - everything is filtered by month**
5. ✅ **Weekly availability resets every Sunday (only UI reset)**
6. ✅ **OT/Advances/Sessions never reset - permanently stored**

### Visual Summary:

```
MONTH LIFECYCLE:
│
├─ January 1-31: Data accumulates (day-off shows Rs. 0)
│   └─ OT, Advances, Sessions tagged with "2025-01"
│
├─ February 1, 00:00: CALCULATION TRIGGER
│   ├─ January day-offs calculated
│   ├─ Report becomes visible
│   └─ January salaries finalized
│
├─ February 1, All Day: Report accessible
│   └─ Admin can review January
│
├─ February 2+: Report unavailable
│   └─ But January data still accessible via selector
│
└─ March 1, 00:00: February calculation trigger
    └─ Repeat process...
```

---

**Report Complete!**

**Lines:** 850+  
**Coverage:** Complete timing and data refresh behavior  
**Critical Date:** 1st of every month  
**Data Lifetime:** Permanent (never deleted)

Need clarification on any specific timing scenario? Let me know!

