# Day-Off Monthly Calculation System - Update Summary

## Overview
Updated the Day-Off Calculation System so that bonuses and deductions are **only calculated and applied on the 1st day of each month** for the previous month's attendance. Staff see informational warnings during the month, but no calculations are applied until the 1st.

---

## ✅ Changes Implemented

### **1. Day-Off Adjustments Only on 1st Day**

**Files Modified:**
- `src/config/dayOffRates.js`
- `src/Pages/AdminDashboard/SalaryManagement.jsx`

**Key Changes:**

#### **A. Added Date Check Function**
```javascript
// src/config/dayOffRates.js
export const isFirstDayOfMonth = () => {
  const today = new Date();
  return today.getDate() === 1;
};
```

#### **B. Updated getDayOffAdjustment() Function**
```javascript
// Only apply adjustments on 1st day of month
const getDayOffAdjustment = (staffUid) => {
  // Return 0 if not the 1st day
  if (!isFirstDayOfMonth()) {
    return 0;
  }
  
  // Calculate adjustment using previous month's data
  // ... rest of calculation
};
```

#### **C. Updated Monthly Calculation Effect**
```javascript
useEffect(() => {
  const calculateAllStaffDaysOff = async () => {
    // Only calculate on 1st day
    if (!isFirstDayOfMonth()) {
      setStaffDaysOff({});
      return;
    }
    
    // Calculate for PREVIOUS month only
    const previousMonth = getPreviousMonth();
    
    for (const staff of staffMembers) {
      // Use false to exclude current week data
      const daysOff = await calculateMonthlyDaysOff(staff.staffUid, previousMonth, false);
      daysOffData[staff.staffUid] = daysOff;
    }
  };
}, [staffMembers]);
```

---

### **2. Staff Dashboard - Warning Only (No Adjustment)**

**Files Modified:**
- `src/Pages/StaffDashboard/StaffDashboard.jsx`
- `src/Pages/StaffDashboard/StaffDashboard.css`
- `src/config/dayOffRates.js`

**Key Changes:**

#### **A. Updated getCurrentMonthRunningDaysOff() Function**
```javascript
// Returns warning data, NOT adjustment amounts
export const getCurrentMonthRunningDaysOff = async (staffUid) => {
  const daysOff = await calculateMonthlyDaysOff(staffUid, currentMonth, true);
  const config = await getEffectiveDayOffConfig(staffUid);
  
  let status = 'on-track';
  if (daysOff > config.maxDaysOff) {
    status = 'over-limit';
  } else if (daysOff < config.maxDaysOff) {
    status = 'under-limit';
  } else {
    status = 'at-limit';
  }
  
  return {
    daysOff,
    threshold: config.maxDaysOff,
    excessDays: daysOff > config.maxDaysOff ? daysOff - config.maxDaysOff : 0,
    status,
    isCustom: config.isCustom,
    deductionPerDay: config.deductionPerDay,
    bonusPerDay: config.bonusPerDay
  };
  // NOTE: No 'adjustment' field - only informational
};
```

#### **B. Updated Staff Warning UI**
**Before:**
```jsx
<div className="calc-row total">
  <span className="calc-label">Current Deduction:</span>
  <span className="calc-value negative">Rs. {adjustment}</span>
</div>
```

**After:**
```jsx
<div className="alert-note warning-note">
  <span className="note-icon">⚠️</span>
  <span>
    <strong>Warning:</strong> You are currently over your day-off limit. 
    Deductions will be calculated and applied to your salary on the 1st of next month. 
    Deduction rate: Rs. {deductionPerDay}/day over limit.
  </span>
</div>
```

**What Staff Sees:**
- **During Month (2nd-31st):**
  - Warning if exceeding limit
  - Shows days taken so far
  - Shows excess days
  - Explains deduction will happen on 1st
  - NO calculation shown

- **On 1st Day:**
  - Warning still visible if they were over limit last month
  - Actual deduction will be in their salary for that month

---

### **3. Admin Salary View - Notice Added**

**Files Modified:**
- `src/Pages/AdminDashboard/SalaryManagement.jsx`
- `src/Pages/AdminDashboard/SalaryManagement.css`

**Key Changes:**

#### **A. Added Notice Card (Not 1st Day)**
```jsx
{!isFirstDayOfMonth() && (
  <div className="notice-card info">
    <h3>Day-Off Calculations</h3>
    <p>
      Day-off bonuses and deductions are calculated and applied 
      <strong>only on the 1st day of each month</strong> 
      for the previous month's attendance.
    </p>
    <p>
      Staff can see warnings during the month if they exceed their limits, 
      but adjustments are not applied to salaries until the 1st.
    </p>
  </div>
)}
```

#### **B. Added Success Card (1st Day)**
```jsx
{isFirstDayOfMonth() && (
  <div className="notice-card success">
    <h3>Day-Off Report Available</h3>
    <p>
      Today is the 1st of the month. Day-off adjustments for last month 
      are now calculated and applied to net salaries below.
    </p>
    <button onClick={() => navigate('/admin/dayoff-report')}>
      View Full Day-Off Report
    </button>
  </div>
)}
```

---

### **4. Admin Monthly Report (1st Day Only)**

**File:** `src/Pages/AdminDashboard/MonthlyDayOffReport.jsx` (Already created)

**Behavior:**
- **1st Day:** Shows full report with previous month's data
- **Other Days:** Shows "Report Not Available" message

---

## 🔄 Complete System Flow

### **Throughout the Month (2nd - 31st)**

#### **Staff Side:**
```
1. Staff updates availability weekly (Sunday-Saturday)
2. Data archived to weeklyAvailability
3. If days off > limit:
   → Warning shown on dashboard
   → "You have taken X days (Y over limit)"
   → "Deductions will be applied on 1st of next month"
   → NO calculation applied yet
4. Staff can continue working normally
```

#### **Admin Side:**
```
1. Admin views Salary Management
2. Notice shown: "Day-off calculations only on 1st day"
3. Net salaries shown WITHOUT day-off adjustments
4. Admin sees current salary breakdown:
   → Base Salary
   → OT (positive)
   → Short Time (negative)
   → Advances (negative)
   → Net Salary (NO day-off adjustment)
5. Admin can still configure policies
```

---

### **On the 1st Day of Month**

#### **Staff Side:**
```
1. Warning still visible if exceeded last month
2. Explanation: "Applied to this month's salary"
3. Staff views their salary:
   → See deduction/bonus from LAST month
   → Applied to current payment
```

#### **Admin Side:**
```
1. Admin opens Salary Management
2. Success notice: "Day-Off Report Available"
3. Button to view full report
4. System calculates previous month:
   → Query all archived weeks from last month
   → Count days off per staff
   → Apply bonus/deduction formula
5. Net salaries NOW include day-off adjustments:
   → Base Salary
   → OT (positive)
   → Short Time (negative)
   → Day-Off Adjustment (positive/negative) ← NEW
   → Advances (negative)
   → Net Salary (includes day-off)
6. Admin can view detailed report:
   → All staff listed
   → Days off per staff
   → Bonus/deduction amounts
   → Policy types (default/custom)
```

---

## 📊 Calculation Timeline Example

### **January 2024 Scenario:**

**Week-by-Week (Staff: John)**
```
Week 1 (Dec 31 - Jan 6):   3 days off → archived
Week 2 (Jan 7 - 13):       2 days off → archived
Week 3 (Jan 14 - 20):      1 day off → archived
Week 4 (Jan 21 - 27):      2 days off → archived
Week 5 (Jan 28 - Feb 3):   0 days off in Jan → archived on Feb 4

Total January: 8 days off
```

**During January (2nd-31st):**
```
Staff Dashboard:
→ Shows running count: "8 days off (4 over limit)"
→ Warning: "Deduction will be applied on Feb 1st"
→ NO deduction shown in salary

Admin Dashboard:
→ Net Salary: Rs. 50,000 + Rs. 5,000 (OT) - Rs. 10,000 (advances)
→ Net Salary: Rs. 45,000
→ NO day-off adjustment applied
```

**On February 1st:**
```
Staff Dashboard:
→ Warning still shown (for reference)
→ Salary now includes deduction from January

Admin Dashboard:
→ "Day-Off Report Available" notice
→ Net Salary: Rs. 50,000 + Rs. 5,000 (OT) - Rs. 2,000 (day-off) - Rs. 10,000 (advances)
→ Net Salary: Rs. 43,000
→ Day-off adjustment NOW applied: -Rs. 2,000

Monthly Report:
→ John Doe: 8 days off / 4 limit → -Rs. 2,000 deduction
→ Full breakdown for all staff
```

---

## 💰 Salary Calculation Changes

### **Before (Always Calculated):**
```
Net Salary = Base + OT - Short + DayOffAdjustment - Advances
(Calculated every day)
```

### **After (Only on 1st):**

**Days 2-31:**
```
Net Salary = Base + OT - Short - Advances
(Day-off adjustment = 0)
```

**Day 1:**
```
Net Salary = Base + OT - Short + PreviousMonthDayOffAdjustment - Advances
(Day-off adjustment calculated from last month's archived data)
```

---

## 🎨 UI Changes Summary

### **Staff Dashboard:**

**Before:**
```
⚠️ Day-Off Limit Exceeded
Days Off: 8
Limit: 4
Excess: 4
──────────────
Current Deduction: Rs. 2,000  ← Showed amount
```

**After:**
```
⚠️ Day-Off Limit Exceeded
Days Off Taken So Far: 8
Limit: 4
Excess: 4

⚠️ Warning: You are currently over your day-off limit.
Deductions will be calculated and applied to your salary 
on the 1st of next month.
Deduction rate: Rs. 500/day over limit.
```

### **Admin Dashboard:**

**Before:**
```
(Always showed day-off adjustments in net salary)
```

**After (Not 1st Day):**
```
📅 Day-Off Calculations
Day-off bonuses and deductions are calculated and applied 
only on the 1st day of each month for the previous month's 
attendance.

(Net salaries shown WITHOUT day-off adjustments)
```

**After (1st Day):**
```
✅ Day-Off Report Available
Today is the 1st of the month. Day-off adjustments for 
last month are now calculated and applied to net salaries below.

[View Full Day-Off Report] button

(Net salaries shown WITH day-off adjustments)
```

---

## 📁 Files Changed

### **Modified Files (5):**
1. ✅ `src/config/dayOffRates.js`
   - Updated `getCurrentMonthRunningDaysOff()` - returns info only, no adjustment
   - Added `isFirstDayOfMonth()` - date check function
   
2. ✅ `src/Pages/StaffDashboard/StaffDashboard.jsx`
   - Removed adjustment display from warning
   - Changed to informational message only
   
3. ✅ `src/Pages/StaffDashboard/StaffDashboard.css`
   - Added `.warning-note` styles
   
4. ✅ `src/Pages/AdminDashboard/SalaryManagement.jsx`
   - Updated `getDayOffAdjustment()` - returns 0 if not 1st day
   - Updated `calculateAllStaffDaysOff()` - only runs on 1st, uses previous month
   - Added notice cards for 1st/not 1st day
   
5. ✅ `src/Pages/AdminDashboard/SalaryManagement.css`
   - Added `.notice-card` styles
   - Added `.view-report-btn` styles

### **New Files (1):**
1. ✅ `DAY_OFF_MONTHLY_CALCULATION_UPDATE.md` (this document)

---

## 🧪 Testing Checklist

### **Test 1: During Month (Not 1st Day)**
- [ ] Staff with excess days off sees warning
- [ ] Warning shows days taken, limit, excess
- [ ] Warning explains "applied on 1st of next month"
- [ ] NO deduction amount shown to staff
- [ ] Admin sees info notice about 1st day calculation
- [ ] Admin net salaries DO NOT include day-off adjustments
- [ ] Day-off adjustment shows as Rs. 0 in calculations

### **Test 2: On 1st Day of Month**
- [ ] Admin sees success notice "Day-Off Report Available"
- [ ] Click button navigates to monthly report
- [ ] System calculates previous month's days off
- [ ] Net salaries NOW include day-off adjustments
- [ ] Monthly report shows all staff with adjustments
- [ ] Staff still see warning (if applicable from last month)

### **Test 3: Calculation Accuracy**
- [ ] Archive 4 weeks of availability data
- [ ] Set some staff over limit, some under
- [ ] Wait for 1st of month (or set system date for testing)
- [ ] Verify adjustments match manual calculations
- [ ] Verify previous month data used (not current)

### **Test 4: Edge Cases**
- [ ] Test with custom day-off policies
- [ ] Test with staff at exact threshold
- [ ] Test with staff having 0 days off
- [ ] Test month boundary (Feb 1st with Jan data)

---

## 🔑 Key Points

1. **Monthly Calculation Only**
   - Adjustments calculated ONLY on 1st day of month
   - Uses PREVIOUS month's archived data only
   - Current/partial week data excluded

2. **Staff Warnings**
   - Informational only during month
   - No amounts calculated or shown
   - Clear explanation of when it applies

3. **Admin Transparency**
   - Notice cards explain the system
   - Easy access to full report on 1st
   - No confusion about when adjustments apply

4. **Accurate Payroll**
   - Deductions/bonuses tied to specific month
   - Applied to next month's salary
   - Complete month data only (no partial)

5. **No Breaking Changes**
   - Existing data structure unchanged
   - Weekly availability works same way
   - Only calculation timing changed

---

## 💡 Rationale

**Why only on 1st day:**
- Complete month data available
- Accurate calculations from archived weeks
- Clear payroll period boundaries
- No mid-month confusion
- Staff know exactly when it applies

**Benefits:**
- ✅ More accurate calculations
- ✅ Clear timeline for staff
- ✅ Prevents partial month issues
- ✅ Easier payroll management
- ✅ Transparent system

---

## 📞 Support

**Common Questions:**

**Q: Why don't I see day-off adjustments in salaries?**
A: Day-off adjustments are only calculated on the 1st day of each month for the previous month's attendance.

**Q: Staff is over limit but no deduction shown?**
A: During the month, staff see warnings only. Deductions are applied on the 1st of the next month.

**Q: Where can I see the detailed day-off report?**
A: The monthly report is available only on the 1st day of each month at `/admin/dayoff-report`.

**Q: Are warnings still accurate during the month?**
A: Yes, warnings show real-time running totals, but adjustments aren't calculated until the 1st.

---

**Implementation Date:** January 2025  
**Version:** 3.0  
**Status:** Complete ✅
