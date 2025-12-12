# Clock-In System: How 6 PM Day Boundary and Session Grouping Works

## Overview

The clock-in system uses a **shift-based tracking approach** where shifts starting after 6 PM (18:00) are counted as part of the **next calendar day**. This creates a unique day boundary that affects how sessions are grouped and calculated.

---

## Core Concepts

### 1. The 6 PM Day Boundary Rule

**Location in code:** `src/Pages/StaffDashboard/StaffDashboard.jsx` (lines 48-54) and `src/utils/dateHelpers.js` (lines 20-26)

```javascript
const getShiftDate = (timestamp) => {
  const date = new Date(timestamp);
  if (date.getHours() >= 18) {  // If 6 PM or later
    date.setDate(date.getDate() + 1);  // Count as next day
  }
  return date.toDateString();
};
```

**What this means:**
- If you clock in at **5:59 PM on Monday** → counts as **Monday's shift**
- If you clock in at **6:00 PM on Monday** → counts as **Tuesday's shift**
- If you clock in at **11:00 PM on Monday** → counts as **Tuesday's shift**

### 2. The Shift Period Window

**Location in code:** `src/Pages/StaffDashboard/StaffDashboard.jsx` (lines 240-252)

The system defines a "shift period" that captures all sessions belonging to the current shift:

```javascript
const now = new Date();

// Start of shift period: Yesterday at 6 PM
const startOfShiftPeriod = new Date(now);
startOfShiftPeriod.setHours(18, 0, 0, 0);
startOfShiftPeriod.setDate(startOfShiftPeriod.getDate() - 1);

// End of shift period: Today at 6 PM
const endOfShiftPeriod = new Date(now);
endOfShiftPeriod.setHours(18, 0, 0, 0);
```

**Example:**
If the current time is **3:00 PM on Wednesday**, the system loads all sessions between:
- **Start:** Tuesday 6:00 PM
- **End:** Wednesday 6:00 PM

All these sessions are grouped together as "today's sessions" because they all belong to the same shift day (Wednesday).

---

## How Session Grouping Works

### Scenario 1: Starting After 6 PM and Working Past Midnight

**Example:**
1. Staff member clocks in at **8:00 PM on Monday**
2. Works for 14 hours
3. Clocks out at **10:00 AM on Tuesday**

**How the system handles it:**

**When clocking in at 8 PM Monday:**
```javascript
clockInTime = new Date("2025-01-13 20:00:00");  // 8 PM Monday
shiftDate = getShiftDate(clockInTime);
// Since hour (20) >= 18, add 1 day
// Result: "Tue Jan 14 2025"
```

**Session data stored:**
```javascript
{
  clockIn: "2025-01-13T20:00:00",
  shiftDate: "Tue Jan 14 2025",  // Counted as Tuesday!
  isNightShift: true,  // Flagged as night shift
  crossMidnight: true  // Will be set when clocking out
}
```

**Why this matters:**
- This 14-hour session is counted as part of **Tuesday's shift**, not Monday's
- When calculating daily totals, it's grouped with any other Tuesday sessions
- The `shiftMonth` is also set to reflect the next day's month

### Scenario 2: Multiple Sessions on the Same Shift Day

**Example:**
1. **Session 1:** Clock in at 8 PM Monday → work 14 hours → clock out at 10 AM Tuesday
2. **Session 2:** Clock in at 2 PM Tuesday → work 2 hours → clock out at 4 PM Tuesday

**How the system groups them:**

Both sessions belong to **Tuesday's shift** because:
- Session 1: Started after 6 PM Monday → `shiftDate = "Tuesday"`
- Session 2: Started before 6 PM Tuesday → `shiftDate = "Tuesday"`

**When loading "today's sessions" on Tuesday at 3 PM:**

The Firestore query fetches sessions where:
```javascript
clockIn >= "Monday 6:00 PM"  // Start of shift period
clockIn < "Tuesday 6:00 PM"  // End of shift period (not yet reached)
```

**Result:** Both sessions are loaded as `todaySessions`

**Total calculation:**
```javascript
const totalHours = sessions.reduce((sum, s) => {
  if (s.clockOut && s.duration) {
    return sum + (s.duration / (1000 * 60 * 60));
  }
  return sum;
}, 0);
// Result: 14 hours + 2 hours = 16 hours total
```

---

## Scenario 3: Forgetting to End Shift

**Example:**
1. Staff member clocks in at 8 PM Monday
2. Works until 6 AM Tuesday morning
3. **Forgets to clock out**
4. Goes home and sleeps
5. Returns and clocks in at 8 PM Tuesday evening
6. Works until 10 PM Tuesday
7. Properly clocks out

**What happens:**

**Session 1 (the forgotten one):**
```javascript
{
  clockIn: "Monday 8:00 PM",
  clockOut: null,  // Never clocked out!
  shiftDate: "Tuesday",  // Counted as Tuesday
  status: "active"  // Still shows as active
}
```

**Session 2 (the next day):**
```javascript
{
  clockIn: "Tuesday 8:00 PM",
  shiftDate: "Wednesday",  // Counted as Wednesday!
  status: "active"
}
```

**Key observation:** These are **different shift days**!
- Session 1 → Tuesday's shift
- Session 2 → Wednesday's shift

**They are NOT combined** because they have different `shiftDate` values.

### But what if the scenario is different?

**Modified Example:**
1. Clock in at 8 PM Monday (counts as Tuesday)
2. Forget to clock out
3. Clock in again at **2 PM Tuesday** (also counts as Tuesday)
4. Clock out at 4 PM Tuesday

**Now they ARE on the same shift day!**

**When viewing "today's sessions" on Tuesday at 3 PM:**

The system loads:
```javascript
// Query: clockIn >= "Monday 6:00 PM"
Session 1: {
  clockIn: "Monday 8:00 PM",
  clockOut: null,
  shiftDate: "Tuesday",
  status: "active"
}

Session 2: {
  clockIn: "Tuesday 2:00 PM", 
  clockOut: "Tuesday 4:00 PM",
  shiftDate: "Tuesday",
  status: "completed"
}
```

Both sessions appear in `todaySessions` array because they're within the shift period window (Monday 6 PM to Tuesday 6 PM).

**Active session detection:**
```javascript
const activeSession = sessions.find((s) => !s.clockOut);
// Finds Session 1 (no clockOut)
setIsClockedIn(true);
setCurrentSession(Session 1);
```

The dashboard shows:
- ✅ Clock status: "Clocked In"
- ✅ Live timer running since Monday 8 PM
- ✅ Warning: Session 1 is still active (18+ hours!)
- ✅ Session 2 also visible in the session list

**When clicking "End Shift":**

The system calculates total time:
```javascript
// Session 1: Unclosed, so duration = 0 (not counted)
// Session 2: 2 hours (counted)
totalHours = 2 hours
```

⚠️ **Important:** Unclosed sessions (without `clockOut`) are **not included** in time calculations because they have no `duration` value!

---

## How "End Shift" Calculates Totals

**Location:** `src/Pages/StaffDashboard/StaffDashboard.jsx` (lines 155-212)

When you click "End Shift", the system:

### Step 1: Calculate Total Seconds
```javascript
const totalSeconds = sessions.reduce((sum, s) => {
  if (s.clockOut && s.duration) {  // Only count completed sessions!
    return sum + Math.floor(s.duration / 1000);
  }
  return sum;
}, 0);
```

**Key point:** Only sessions with `clockOut` are counted. Unclosed sessions contribute **zero** time.

### Step 2: Compare Against Full Shift (12 hours)
```javascript
const FULL_SHIFT_SECONDS = 12 * 3600;  // 43,200 seconds

if (totalSeconds > FULL_SHIFT_SECONDS) {
  // Overtime
  otSeconds = totalSeconds - FULL_SHIFT_SECONDS;
} else if (totalSeconds < FULL_SHIFT_SECONDS) {
  // Short time
  shortSeconds = FULL_SHIFT_SECONDS - totalSeconds;
}
```

### Step 3: Calculate Intervals and Amounts
```javascript
const INTERVAL_SECONDS = 3600;  // 1 hour
const RATE_PER_INTERVAL = 200;  // Rs. 200 per hour

const otIntervals = Math.floor(otSeconds / INTERVAL_SECONDS);
const otAmount = otIntervals * RATE_PER_INTERVAL;
```

### Step 4: Create Adjustment Request
```javascript
// Store in Firestore "adjustmentRequests" collection
{
  staffUid: "...",
  shiftDate: getShiftDate(new Date()),
  totalSeconds: totalSeconds,
  adjustmentType: "overtime" or "short_time",
  adjustmentIntervals: otIntervals,
  adjustmentAmount: otAmount,
  sessions: [
    { sessionId: "...", clockIn: "...", clockOut: "...", duration: ... },
    { sessionId: "...", clockIn: "...", clockOut: "...", duration: ... }
  ],
  status: "pending"
}
```

---

## Complete Example Walkthrough

### Scenario: Long Night Shift + Short Morning Session

**Timeline:**
1. **Monday 8:00 PM:** Clock in (Session 1 starts)
2. **Tuesday 10:00 AM:** Clock out (Session 1 ends - 14 hours)
3. **Tuesday 2:00 PM:** Clock in (Session 2 starts)
4. **Tuesday 4:00 PM:** Clock out (Session 2 ends - 2 hours)
5. **Tuesday 5:00 PM:** Click "End Shift"

**Session Data:**

**Session 1:**
```javascript
{
  id: "session1",
  clockIn: "2025-01-13T20:00:00Z",  // Monday 8 PM
  clockOut: "2025-01-14T10:00:00Z",  // Tuesday 10 AM
  duration: 50400000,  // 14 hours in milliseconds
  shiftDate: "Tue Jan 14 2025",  // Counted as Tuesday
  isNightShift: true,
  crossMidnight: true,
  status: "completed"
}
```

**Session 2:**
```javascript
{
  id: "session2",
  clockIn: "2025-01-14T14:00:00Z",  // Tuesday 2 PM
  clockOut: "2025-01-14T16:00:00Z",  // Tuesday 4 PM
  duration: 7200000,  // 2 hours in milliseconds
  shiftDate: "Tue Jan 14 2025",  // Same shift date!
  isNightShift: false,
  crossMidnight: false,
  status: "completed"
}
```

**Dashboard View (Tuesday 5 PM):**
```
Today's Sessions: 2
Total Time: 16h 0m 0s

Session #2
├─ Clock In: 2:00 PM
├─ Clock Out: 4:00 PM
└─ Duration: 2h 0m 0s

Session #1
├─ Clock In: 8:00 PM 🌙
├─ Clock Out: 10:00 AM ⏰
└─ Duration: 14h 0m 0s
```

**Clicking "End Shift" - Calculation:**
```javascript
// Step 1: Calculate total
totalSeconds = 14 * 3600 + 2 * 3600 = 57,600 seconds (16 hours)

// Step 2: Compare to full shift
FULL_SHIFT_SECONDS = 12 * 3600 = 43,200 seconds
otSeconds = 57,600 - 43,200 = 14,400 seconds (4 hours overtime)

// Step 3: Calculate intervals
otIntervals = floor(14,400 / 3600) = 4 intervals
otAmount = 4 * 200 = Rs. 800

// Step 4: Show confirmation
"End Your Shift?

Total Time: 16h 0m 0s
Regular Time: 12h 0m 0s
Overtime: +4 x 3600-second intervals
OT Amount: +Rs. 800 (Rate: Rs. 200/hour)

This will create separate requests for admin approval."
```

**Result:**
- Creates an overtime adjustment request for **+4 hours** (Rs. 800)
- Admin can approve/reject from the OT Approvals page
- Once approved, adds Rs. 800 to the staff member's salary

---

## Why Sessions Are Grouped This Way

### 1. **Handles Night Shifts Naturally**
Workers who start late at night have their work counted toward the next day, which makes sense logically (you're working "Tuesday's shift" even though you started Monday night).

### 2. **Prevents Split Accounting**
Without this system, a shift from 8 PM Monday to 6 AM Tuesday would be split across two days, making it harder to track and calculate.

### 3. **Clear Shift Boundaries**
Everyone knows: "Work after 6 PM counts as tomorrow's shift." This creates a predictable pattern.

### 4. **Supports Multiple Sessions Per Day**
The system can handle multiple clock-in/out cycles within a single shift period, all grouped together for total calculation.

---

## Important Notes

### ⚠️ Unclosed Sessions Are NOT Counted
If a staff member forgets to clock out, that session has `clockOut = null` and `duration = 0`, so it contributes **zero time** to the daily total.

**Solution:** Staff must clock out properly. The system shows the active session with a live timer to remind them.

### ⚠️ Cross-Day Sessions Use Clock-In Time
The `shiftDate` is determined by the **clock-in time only**. The clock-out time doesn't change which day the session belongs to.

### ⚠️ Shift Period Window is Fixed
The system always looks at "yesterday 6 PM to today 6 PM" based on the current time. It doesn't dynamically adjust based on when you started working.

### ✅ Month Tracking Uses Same Logic
The `shiftMonth` field also respects the 6 PM boundary:
```javascript
const getShiftMonth = (timestamp) => {
  const date = new Date(timestamp);
  if (date.getHours() >= 18) {
    date.setDate(date.getDate() + 1);
  }
  return getLocalMonth(date);
};
```

This ensures sessions started late in the month (e.g., January 31st at 8 PM) are counted in the next month (February).

---

## Summary

1. **6 PM is the day boundary:** Sessions starting at or after 6 PM belong to the next calendar day
2. **Shift period window:** The system loads all sessions within "yesterday 6 PM to today 6 PM" as "today's sessions"
3. **Session grouping:** All sessions with the same `shiftDate` are grouped together
4. **Total calculation:** Only completed sessions (with `clockOut`) are counted
5. **Unclosed sessions:** Shown in the list but contribute zero time to calculations
6. **End Shift:** Sums all completed session durations, compares to 12 hours, creates OT/Short Time requests

The key insight is that **the clock-in timestamp determines which shift day a session belongs to**, and all sessions within that shift day are combined when calculating totals, regardless of how many separate clock-in/clock-out cycles occurred.
