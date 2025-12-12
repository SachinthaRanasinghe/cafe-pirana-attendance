# Auto-Close Session Testing Guide

## Quick Testing Checklist

Use this guide to verify the auto-close feature is working correctly in your system.

---

## Pre-Test Setup

### 1. Required Firestore Index

The auto-close feature requires a compound index on the `sessions` collection:

```
Collection: sessions
Fields Indexed:
  - staffUid (Ascending)
  - status (Ascending)
  - clockOut (Ascending)
  - clockIn (Ascending)
```

**How to create:**
1. Run the app and trigger a clock-in
2. Firebase will show an error in console with an index creation link
3. Click the link to auto-create the index
4. Wait 2-3 minutes for index to build
5. Test again

---

## Test Scenarios

### ✅ Test 1: Basic Auto-Close (Single Session)

**Steps:**
1. Open the Staff Dashboard
2. Click "Clock In" at 9:00 AM
3. Verify session shows as "Clocked In" with live timer
4. **DO NOT** click "Clock Out"
5. Wait 5 minutes (or refresh browser)
6. Click "Clock In" again

**Expected Results:**
- ⚠️ Notification: "Auto-closed 1 previous session that was not properly ended. Starting new session..."
- ✅ Success notification: "Clocked in at [time] - Location Verified! (1 previous session auto-closed)"
- 📊 Session list shows:
  - **Session #2:** Currently active (new session)
  - **Session #1:** Completed, with "🤖 Auto-Closed" badge
- ℹ️ Auto-close notice displayed on Session #1
- 📝 Clock Out time shows "(Auto)" label
- ⏱️ Duration calculated correctly (~5 minutes)

**Console Logs to Check:**
```
Auto-closed 1 unclosed session(s)
Successfully auto-closed 1 session(s)
```

---

### ✅ Test 2: Previous Day Session

**Steps:**
1. **Simulate old session:** Manually create a session in Firestore:
   ```javascript
   {
     staffUid: "[your-uid]",
     staffId: "[your-staff-id]",
     staffName: "[your-name]",
     clockIn: "2025-01-13T09:00:00.000Z",  // Yesterday 9 AM
     clockOut: null,
     status: "active",
     duration: 0,
     date: "Mon Jan 13 2025",
     shiftDate: "Mon Jan 13 2025",
     month: "2025-01",
     shiftMonth: "2025-01",
     isNightShift: false
   }
   ```
2. Open Staff Dashboard
3. Click "Clock In"

**Expected Results:**
- ✅ Yesterday's session auto-closed
- ⏱️ Duration shows ~24+ hours
- 🔴 `crossMidnight: true` flag set
- 📊 Both sessions visible if within current shift period window

---

### ✅ Test 3: Night Shift (After 6 PM)

**Steps:**
1. **Set system time to 8:00 PM** (or wait until after 6 PM)
2. Click "Clock In"
3. Verify session shows "🌙 Night" badge
4. Verify `shiftDate` is set to **tomorrow's date**
5. **DO NOT** clock out
6. Wait or refresh
7. Click "Clock In" again

**Expected Results:**
- ✅ Night shift session auto-closed
- ✅ `shiftDate` correctly shows next day
- ✅ New session created with correct shift date
- 🌙 Night shift badge visible on both sessions

---

### ✅ Test 4: Multiple Unclosed Sessions

**Steps:**
1. **Manually create 3 unclosed sessions in Firestore:**
   - Session A: Monday 9 AM (unclosed)
   - Session B: Tuesday 2 PM (unclosed)
   - Session C: Wednesday 8 PM (unclosed)
2. Open Staff Dashboard
3. Click "Clock In"

**Expected Results:**
- ⚠️ Notification: "Auto-closed **3 previous sessions** that were not properly ended..."
- ✅ Success: "...(**3 previous sessions** auto-closed)"
- 📊 All 3 sessions show "🤖 Auto-Closed" badge
- ⏱️ Each has correct duration calculated
- 🆕 New session (#4) is active

**Console Logs:**
```
Found 3 unclosed session(s) to auto-close
Auto-closing session session_1: clockIn: ..., hoursRunning: 72.00
Auto-closing session session_2: clockIn: ..., hoursRunning: 48.00
Auto-closing session session_3: clockIn: ..., hoursRunning: 18.00
Successfully auto-closed 3 session(s)
```

---

### ✅ Test 5: No Unclosed Sessions (Normal Flow)

**Steps:**
1. Click "Clock In"
2. Wait 1 minute
3. Click "Clock Out" (properly close session)
4. Click "Clock In" again

**Expected Results:**
- ✅ No auto-close notification
- ✅ Normal clock-in: "Clocked in at [time] - Location Verified!"
- 📊 Previous session shows as "completed" (NO auto-close badge)
- 🚫 No "(Auto)" label on clock-out time
- ⚡ Fast clock-in (no auto-close delay)

---

### ✅ Test 6: Long Running Session (Edge Case)

**Steps:**
1. **Create session from 5 days ago:**
   ```javascript
   {
     clockIn: "2025-01-08T09:00:00.000Z",  // 5 days ago
     clockOut: null,
     status: "active",
     // ... other fields
   }
   ```
2. Click "Clock In"

**Expected Results:**
- ✅ Old session auto-closed
- ⏱️ Duration shows ~120 hours (5 days)
- 🔴 `crossMidnight: true` flag set
- ℹ️ Auto-close notice displayed
- ⚠️ Consider adding admin review flag for sessions > 24 hours (future enhancement)

---

### ✅ Test 7: Auto-Close Failure Handling

**Steps:**
1. **Simulate Firestore error:** Temporarily disable network
2. Click "Clock In"
3. Location verification should work (cached)
4. Auto-close will fail due to network

**Expected Results:**
- 🚨 Error notification: "Warning: Could not auto-close previous sessions. Please contact admin..."
- ✅ Clock-in still proceeds successfully
- 📝 Error logged to console
- 👤 User can continue working
- 🔄 Next clock-in will retry auto-close

---

### ✅ Test 8: Cross-Midnight Detection

**Steps:**
1. Clock in at 11:00 PM
2. Do not clock out
3. Wait until after midnight (or simulate)
4. Clock in at 1:00 AM

**Expected Results:**
- ✅ Session auto-closed with 2 hour duration
- 🔴 `crossMidnight: true` flag set
- 📅 Clock-in date ≠ Clock-out date
- 🌙 Night shift badge on first session

---

## Visual Inspection Checklist

### Session Card Display

For auto-closed sessions, verify these visual elements:

```
┌─────────────────────────────────────────────────────────┐
│ Session #1  🤖 Auto-Closed              [COMPLETED]     │ ← Badge visible
├─────────────────────────────────────────────────────────┤
│ ℹ️ This session was automatically closed because you   │ ← Notice banner
│    started a new session without properly ending        │
│    this one.                                           │
├─────────────────────────────────────────────────────────┤
│ Clock In:  9:00 AM                                      │
│ Clock Out: 10:00 AM (Auto)                             │ ← "(Auto)" label
├─────────────────────────────────────────────────────────┤
│ Duration: 1h 0m 0s                                      │
└─────────────────────────────────────────────────────────┘
```

**Check:**
- ✅ Orange/yellow border on left side
- ✅ Slightly tinted background (warning color)
- ✅ "🤖 Auto-Closed" badge in title
- ✅ Info notice banner with explanation
- ✅ "(Auto)" label next to clock-out time
- ✅ Correct duration calculated

---

## Data Verification (Firestore)

### Check Session Document

After auto-close, verify the Firestore document has these fields:

```javascript
{
  // Standard fields
  clockIn: "2025-01-13T09:00:00.000Z",
  clockOut: "2025-01-13T10:00:00.000Z",  // ✅ Set
  duration: 3600000,                      // ✅ Calculated (1 hour)
  totalHours: 1,                          // ✅ Calculated
  status: "completed",                    // ✅ Changed from "active"
  
  // Auto-close specific fields
  autoClosed: true,                       // ✅ NEW
  autoClosedAt: "2025-01-13T10:00:00.000Z",  // ✅ NEW (when closed)
  autoCloseReason: "Auto-closed due to new clock-in without proper clock-out",  // ✅ NEW
  
  // Metadata
  crossMidnight: false,                   // ✅ Calculated
  originalStatus: "active"                // ✅ Optional (for audit)
}
```

---

## Performance Testing

### Measure Auto-Close Speed

Add timing logs to measure performance:

```javascript
// In clockIn function
console.time("Auto-close duration");
autoCloseResult = await autoCloseUncompletedSessions();
console.timeEnd("Auto-close duration");
```

**Expected Performance:**
- 1 session: < 500ms
- 3 sessions: < 1000ms
- 10 sessions: < 2000ms

**If slower:**
- Check Firestore index is created
- Verify network connection
- Check for concurrent Firestore operations

---

## Common Issues & Solutions

### Issue 1: "Firestore index required" Error

**Error Message:**
```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

**Solution:**
1. Click the provided link
2. Wait for index to build (2-5 minutes)
3. Refresh and try again

---

### Issue 2: Auto-Close Not Triggering

**Symptoms:**
- No notification shown
- Unclosed session still appears as "active"
- New session created but old one remains

**Debug Steps:**
1. Open browser console
2. Check for error messages
3. Verify `getDocs` is imported:
   ```javascript
   import { getDocs } from "firebase/firestore";
   ```
4. Check query results:
   ```javascript
   const snapshot = await getDocs(uncompletedQuery);
   console.log("Unclosed sessions found:", snapshot.size);
   ```
5. Verify session has `status: "active"` and `clockOut: null`

---

### Issue 3: Wrong Duration Calculated

**Symptoms:**
- Duration shows negative value
- Duration shows incorrect hours
- `crossMidnight` flag incorrect

**Debug:**
```javascript
console.log("Clock In:", new Date(sessionData.clockIn));
console.log("Clock Out (Now):", new Date());
console.log("Difference (ms):", now - clockInTime);
console.log("Difference (hours):", (now - clockInTime) / (1000 * 60 * 60));
```

**Common Causes:**
- Timezone issues (use ISO strings)
- System clock incorrect
- Clock-in stored in wrong format

---

### Issue 4: UI Not Updating

**Symptoms:**
- Auto-close happens but badge doesn't show
- Session still shows as "active" in UI
- Duration not displayed

**Solution:**
- Check Firestore real-time listener is working
- Verify CSS classes are applied:
  ```javascript
  className={`session-card ${session.autoClosed ? 'auto-closed' : ''}`}
  ```
- Check browser cache (hard refresh: Ctrl+Shift+R)
- Verify CSS file is loaded

---

## Automated Testing Script

### Create Test Session Programmatically

```javascript
// Add to browser console for quick testing

const createTestSession = async (hoursAgo) => {
  const clockInTime = new Date();
  clockInTime.setHours(clockInTime.getHours() - hoursAgo);
  
  const testSession = {
    staffUid: "[YOUR_UID]",  // Replace with actual UID
    staffId: "TEST001",
    staffName: "Test User",
    clockIn: clockInTime.toISOString(),
    clockOut: null,
    duration: 0,
    status: "active",
    date: clockInTime.toDateString(),
    shiftDate: clockInTime.toDateString(),
    month: "2025-01",
    shiftMonth: "2025-01",
    isNightShift: false,
    timestamp: new Date().toISOString()
  };
  
  await addDoc(collection(db, "sessions"), testSession);
  console.log(`Created test session from ${hoursAgo} hours ago`);
};

// Usage:
await createTestSession(24);  // Create session from 24 hours ago
```

---

## Success Criteria

### All Tests Pass When:

- ✅ Single unclosed session auto-closes correctly
- ✅ Multiple unclosed sessions all close in one operation
- ✅ Night shift sessions (after 6 PM) handled correctly
- ✅ Previous day sessions auto-close with correct duration
- ✅ Long-running sessions (> 24 hours) auto-close
- ✅ Normal flow (with proper clock-out) doesn't trigger auto-close
- ✅ Error handling prevents system from breaking
- ✅ UI shows auto-close badges and notices
- ✅ Firestore documents have all required fields
- ✅ Duration calculations are accurate
- ✅ Performance is acceptable (< 2 seconds)
- ✅ No duplicate sessions created
- ✅ Real-time listener updates UI immediately

---

## Production Readiness Checklist

Before deploying to production:

- [ ] All test scenarios pass
- [ ] Firestore index created and active
- [ ] Error handling tested (network failure, permission errors)
- [ ] UI components render correctly on all devices
- [ ] CSS styles apply properly (no visual glitches)
- [ ] Console logs clean (no errors)
- [ ] Performance acceptable (< 2s for auto-close)
- [ ] Admin dashboard can view auto-closed sessions
- [ ] Documentation complete
- [ ] Staff trained on auto-close feature
- [ ] Backup/rollback plan in place

---

## Monitoring & Maintenance

### Key Metrics to Track

1. **Auto-Close Frequency**
   - How often does auto-close trigger?
   - Which staff members forget to clock out most?

2. **Session Duration Distribution**
   - Average duration of auto-closed sessions
   - Flag sessions > 24 hours for review

3. **Error Rate**
   - How often does auto-close fail?
   - What's causing failures?

4. **Performance**
   - Average auto-close execution time
   - Impact on user experience

### Query for Analytics

```javascript
// Find all auto-closed sessions
const autoClosedSessions = await getDocs(
  query(
    collection(db, "sessions"),
    where("autoClosed", "==", true),
    orderBy("autoClosedAt", "desc"),
    limit(100)
  )
);

// Calculate statistics
const stats = {
  total: autoClosedSessions.size,
  byStaff: {},
  avgDuration: 0,
  longSessions: 0  // > 24 hours
};

autoClosedSessions.forEach(doc => {
  const data = doc.data();
  const duration = data.duration / (1000 * 60 * 60);  // hours
  
  stats.avgDuration += duration;
  if (duration > 24) stats.longSessions++;
  
  stats.byStaff[data.staffName] = (stats.byStaff[data.staffName] || 0) + 1;
});

stats.avgDuration /= stats.total;

console.log("Auto-Close Statistics:", stats);
```

---

## Quick Reference

### Console Commands for Testing

```javascript
// Check for unclosed sessions
const checkUnclosed = async (uid) => {
  const q = query(
    collection(db, "sessions"),
    where("staffUid", "==", uid),
    where("status", "==", "active"),
    where("clockOut", "==", null)
  );
  const snap = await getDocs(q);
  console.log(`Found ${snap.size} unclosed sessions`);
  snap.forEach(doc => console.log(doc.id, doc.data()));
};

// Manually trigger auto-close
// (copy autoCloseUncompletedSessions function from code)

// Reset test data
const deleteTestSessions = async (uid) => {
  const q = query(
    collection(db, "sessions"),
    where("staffUid", "==", uid),
    where("staffId", "==", "TEST001")
  );
  const snap = await getDocs(q);
  snap.forEach(doc => deleteDoc(doc.ref));
  console.log(`Deleted ${snap.size} test sessions`);
};
```

---

## Support

If you encounter issues during testing:

1. Check browser console for errors
2. Verify Firestore rules allow read/write
3. Confirm Firestore index is created
4. Review `AUTO_CLOSE_SESSION_DOCUMENTATION.md` for details
5. Check `src/utils/sessionHelpers.js` for utility functions
6. Contact system administrator if issues persist

---

**Testing Version:** 1.0.0  
**Last Updated:** January 2025  
**Status:** Ready for Testing
