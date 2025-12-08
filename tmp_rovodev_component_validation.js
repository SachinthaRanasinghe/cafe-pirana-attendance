// ============================================================================
// CAFE PIRANHA SYSTEM - COMPONENT VALIDATION TESTS
// ============================================================================

console.log("🧪 Starting Component Validation Tests...\n");

// ============================================================================
// TEST SUITE 1: FORM VALIDATION LOGIC
// ============================================================================

console.log("📊 TEST SUITE 1: Form Validation Logic");
console.log("=".repeat(60));

// Email Validation - FIXED
function isValidEmail(email) {
  if (email === null || email === undefined || email === '') {
    return false;
  }
  const emailStr = String(email).trim();
  if (emailStr === '') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailStr);
}

// Password Validation - FIXED
function isValidPassword(password) {
  if (password === null || password === undefined || password === '') {
    return false;
  }
  const passwordStr = String(password);
  return passwordStr.length >= 6;
}

// Amount Validation - FIXED
function isValidAmount(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return false;
  }
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}

// Name Validation - FIXED
function isValidName(name) {
  if (name === null || name === undefined || name === '') {
    return false;
  }
  const nameStr = String(name).trim();
  return nameStr.length > 0;
}

function runFormValidationTests() {
  const tests = [
    // Email Tests
    {
      name: "Valid Email",
      test: () => isValidEmail("staff@cafepiranha.com"),
      expected: true,
    },
    {
      name: "Invalid Email - No @",
      test: () => isValidEmail("staffcafepiranha.com"),
      expected: false,
    },
    {
      name: "Invalid Email - No Domain",
      test: () => isValidEmail("staff@"),
      expected: false,
    },
    {
      name: "Invalid Email - Empty",
      test: () => isValidEmail(""),
      expected: false,
    },
    {
      name: "Invalid Email - Spaces",
      test: () => isValidEmail("staff @cafe.com"),
      expected: false,
    },
    
    // Password Tests
    {
      name: "Valid Password - 6 chars",
      test: () => isValidPassword("pass12"),
      expected: true,
    },
    {
      name: "Valid Password - Long",
      test: () => isValidPassword("password123456"),
      expected: true,
    },
    {
      name: "Invalid Password - 5 chars",
      test: () => isValidPassword("pass1"),
      expected: false,
    },
    {
      name: "Invalid Password - Empty",
      test: () => isValidPassword(""),
      expected: false,
    },
    {
      name: "Invalid Password - Null",
      test: () => isValidPassword(null),
      expected: false,
    },
    
    // Amount Tests
    {
      name: "Valid Amount - Positive Integer",
      test: () => isValidAmount("1000"),
      expected: true,
    },
    {
      name: "Valid Amount - Positive Decimal",
      test: () => isValidAmount("1000.50"),
      expected: true,
    },
    {
      name: "Invalid Amount - Zero",
      test: () => isValidAmount("0"),
      expected: false,
    },
    {
      name: "Invalid Amount - Negative",
      test: () => isValidAmount("-100"),
      expected: false,
    },
    {
      name: "Invalid Amount - Text",
      test: () => isValidAmount("abc"),
      expected: false,
    },
    {
      name: "Invalid Amount - Empty",
      test: () => isValidAmount(""),
      expected: false,
    },
    
    // Name Tests
    {
      name: "Valid Name",
      test: () => isValidName("John Doe"),
      expected: true,
    },
    {
      name: "Valid Name - Single Word",
      test: () => isValidName("John"),
      expected: true,
    },
    {
      name: "Invalid Name - Empty",
      test: () => isValidName(""),
      expected: false,
    },
    {
      name: "Invalid Name - Only Spaces",
      test: () => isValidName("   "),
      expected: false,
    },
    {
      name: "Invalid Name - Null",
      test: () => isValidName(null),
      expected: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = test.test();
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}: Expected ${test.expected}, Got ${result}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const formValidationResults = runFormValidationTests();

// ============================================================================
// TEST SUITE 2: AVAILABILITY LOGIC
// ============================================================================

console.log("📊 TEST SUITE 2: Availability Logic");
console.log("=".repeat(60));

// Simulate availability data structure
function createAvailabilityMap(dates) {
  const map = {};
  dates.forEach(date => {
    map[date] = true; // true = available, false = unavailable
  });
  return map;
}

function isDateAvailable(availabilityMap, date) {
  return availabilityMap[date] === true;
}

function toggleAvailability(availabilityMap, date) {
  if (availabilityMap[date] === undefined) {
    availabilityMap[date] = false; // First click = unavailable
  } else {
    availabilityMap[date] = !availabilityMap[date];
  }
  return availabilityMap;
}

function countDaysOff(availabilityMap) {
  let count = 0;
  Object.values(availabilityMap).forEach(isAvailable => {
    if (isAvailable === false) {
      count++;
    }
  });
  return count;
}

function runAvailabilityTests() {
  const tests = [
    {
      name: "Create Availability Map",
      test: () => {
        const map = createAvailabilityMap(["2025-01-15", "2025-01-16"]);
        return Object.keys(map).length === 2;
      },
      expected: true,
    },
    {
      name: "Check Available Date",
      test: () => {
        const map = createAvailabilityMap(["2025-01-15"]);
        return isDateAvailable(map, "2025-01-15");
      },
      expected: true,
    },
    {
      name: "Check Unavailable Date",
      test: () => {
        const map = { "2025-01-15": false };
        return isDateAvailable(map, "2025-01-15");
      },
      expected: false,
    },
    {
      name: "Toggle Availability - First Click",
      test: () => {
        const map = {};
        toggleAvailability(map, "2025-01-15");
        return map["2025-01-15"] === false;
      },
      expected: true,
    },
    {
      name: "Toggle Availability - Second Click",
      test: () => {
        const map = { "2025-01-15": false };
        toggleAvailability(map, "2025-01-15");
        return map["2025-01-15"] === true;
      },
      expected: true,
    },
    {
      name: "Count Days Off - None",
      test: () => {
        const map = { "2025-01-15": true, "2025-01-16": true };
        return countDaysOff(map) === 0;
      },
      expected: true,
    },
    {
      name: "Count Days Off - Some",
      test: () => {
        const map = { 
          "2025-01-15": true, 
          "2025-01-16": false,
          "2025-01-17": false 
        };
        return countDaysOff(map) === 2;
      },
      expected: true,
    },
    {
      name: "Count Days Off - All",
      test: () => {
        const map = { 
          "2025-01-15": false, 
          "2025-01-16": false,
          "2025-01-17": false 
        };
        return countDaysOff(map) === 3;
      },
      expected: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = test.test();
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const availabilityResults = runAvailabilityTests();

// ============================================================================
// TEST SUITE 3: ADVANCE REQUEST LOGIC
// ============================================================================

console.log("📊 TEST SUITE 3: Advance Request Logic");
console.log("=".repeat(60));

function validateAdvanceRequest(amount, reason) {
  if (!isValidAmount(amount)) {
    return { valid: false, error: "Invalid amount" };
  }
  if (!reason || reason.trim().length === 0) {
    return { valid: false, error: "Reason is required" };
  }
  return { valid: true, error: null };
}

function canSubmitNewRequest(existingRequests) {
  // Check if there's any pending request
  return !existingRequests.some(req => req.status === "pending");
}

function calculateTotalAdvanceDeductions(requests) {
  return requests
    .filter(req => req.status === "approved")
    .reduce((total, req) => total + req.amount, 0);
}

function runAdvanceRequestTests() {
  const tests = [
    {
      name: "Valid Advance Request",
      test: () => validateAdvanceRequest("1000", "Medical emergency").valid,
      expected: true,
    },
    {
      name: "Invalid Amount - Zero",
      test: () => validateAdvanceRequest("0", "Medical emergency").valid,
      expected: false,
    },
    {
      name: "Invalid Amount - Negative",
      test: () => validateAdvanceRequest("-100", "Medical emergency").valid,
      expected: false,
    },
    {
      name: "Invalid Reason - Empty",
      test: () => validateAdvanceRequest("1000", "").valid,
      expected: false,
    },
    {
      name: "Invalid Reason - Only Spaces",
      test: () => validateAdvanceRequest("1000", "   ").valid,
      expected: false,
    },
    {
      name: "Can Submit - No Pending Requests",
      test: () => {
        const requests = [
          { status: "approved", amount: 1000 },
          { status: "rejected", amount: 500 }
        ];
        return canSubmitNewRequest(requests);
      },
      expected: true,
    },
    {
      name: "Cannot Submit - Has Pending Request",
      test: () => {
        const requests = [
          { status: "approved", amount: 1000 },
          { status: "pending", amount: 500 }
        ];
        return canSubmitNewRequest(requests);
      },
      expected: false,
    },
    {
      name: "Calculate Total Deductions - Single",
      test: () => {
        const requests = [
          { status: "approved", amount: 1000 }
        ];
        return calculateTotalAdvanceDeductions(requests) === 1000;
      },
      expected: true,
    },
    {
      name: "Calculate Total Deductions - Multiple",
      test: () => {
        const requests = [
          { status: "approved", amount: 1000 },
          { status: "approved", amount: 1500 },
          { status: "rejected", amount: 500 },
          { status: "pending", amount: 300 }
        ];
        return calculateTotalAdvanceDeductions(requests) === 2500;
      },
      expected: true,
    },
    {
      name: "Calculate Total Deductions - None Approved",
      test: () => {
        const requests = [
          { status: "rejected", amount: 500 },
          { status: "pending", amount: 300 }
        ];
        return calculateTotalAdvanceDeductions(requests) === 0;
      },
      expected: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = test.test();
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const advanceRequestResults = runAdvanceRequestTests();

// ============================================================================
// TEST SUITE 4: MONTH/DATE NAVIGATION LOGIC
// ============================================================================

console.log("📊 TEST SUITE 4: Month/Date Navigation Logic");
console.log("=".repeat(60));

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getNextMonth(year, month) {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

function getPreviousMonth(year, month) {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

function getMonthString(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function runMonthNavigationTests() {
  const tests = [
    {
      name: "Days in January 2025",
      test: () => getDaysInMonth(2025, 1),
      expected: 31,
    },
    {
      name: "Days in February 2025 (not leap year)",
      test: () => getDaysInMonth(2025, 2),
      expected: 28,
    },
    {
      name: "Days in February 2024 (leap year)",
      test: () => getDaysInMonth(2024, 2),
      expected: 29,
    },
    {
      name: "Days in April 2025 (30 days)",
      test: () => getDaysInMonth(2025, 4),
      expected: 30,
    },
    {
      name: "Next Month - January to February",
      test: () => {
        const next = getNextMonth(2025, 1);
        return next.year === 2025 && next.month === 2;
      },
      expected: true,
    },
    {
      name: "Next Month - December to January",
      test: () => {
        const next = getNextMonth(2024, 12);
        return next.year === 2025 && next.month === 1;
      },
      expected: true,
    },
    {
      name: "Previous Month - February to January",
      test: () => {
        const prev = getPreviousMonth(2025, 2);
        return prev.year === 2025 && prev.month === 1;
      },
      expected: true,
    },
    {
      name: "Previous Month - January to December",
      test: () => {
        const prev = getPreviousMonth(2025, 1);
        return prev.year === 2024 && prev.month === 12;
      },
      expected: true,
    },
    {
      name: "Month String Format - Single Digit",
      test: () => getMonthString(2025, 1),
      expected: "2025-01",
    },
    {
      name: "Month String Format - Double Digit",
      test: () => getMonthString(2025, 12),
      expected: "2025-12",
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = test.test();
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}: Expected ${test.expected}, Got ${result}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const monthNavigationResults = runMonthNavigationTests();

// ============================================================================
// TEST SUITE 5: ROLE-BASED ACCESS LOGIC
// ============================================================================

console.log("📊 TEST SUITE 5: Role-Based Access Logic");
console.log("=".repeat(60));

// Role-Based Access - FIXED
function canAccessAdminDashboard(user) {
  if (!user || user === null || user === undefined) {
    return false;
  }
  return user.role === "admin";
}

function canAccessStaffDashboard(user) {
  if (!user || user === null || user === undefined) {
    return false;
  }
  return user.role === "staff" || user.role === "admin";
}

function canViewAllStaffData(user) {
  if (!user || user === null || user === undefined) {
    return false;
  }
  return user.role === "admin";
}

function canViewOwnDataOnly(user) {
  if (!user || user === null || user === undefined) {
    return false;
  }
  return user.role === "staff";
}

function canManageStaffAccounts(user) {
  if (!user || user === null || user === undefined) {
    return false;
  }
  return user.role === "admin";
}

function canApproveRequests(user) {
  if (!user || user === null || user === undefined) {
    return false;
  }
  return user.role === "admin";
}

function runRoleAccessTests() {
  const adminUser = { id: "1", name: "Admin", role: "admin" };
  const staffUser = { id: "2", name: "Staff", role: "staff" };
  const nullUser = null;

  const tests = [
    {
      name: "Admin - Access Admin Dashboard",
      test: () => canAccessAdminDashboard(adminUser),
      expected: true,
    },
    {
      name: "Staff - Access Admin Dashboard",
      test: () => canAccessAdminDashboard(staffUser),
      expected: false,
    },
    {
      name: "Null User - Access Admin Dashboard",
      test: () => canAccessAdminDashboard(nullUser),
      expected: false,
    },
    {
      name: "Admin - Access Staff Dashboard",
      test: () => canAccessStaffDashboard(adminUser),
      expected: true,
    },
    {
      name: "Staff - Access Staff Dashboard",
      test: () => canAccessStaffDashboard(staffUser),
      expected: true,
    },
    {
      name: "Null User - Access Staff Dashboard",
      test: () => canAccessStaffDashboard(nullUser),
      expected: false,
    },
    {
      name: "Admin - View All Staff Data",
      test: () => canViewAllStaffData(adminUser),
      expected: true,
    },
    {
      name: "Staff - View All Staff Data",
      test: () => canViewAllStaffData(staffUser),
      expected: false,
    },
    {
      name: "Admin - View Own Data Only",
      test: () => canViewOwnDataOnly(adminUser),
      expected: false,
    },
    {
      name: "Staff - View Own Data Only",
      test: () => canViewOwnDataOnly(staffUser),
      expected: true,
    },
    {
      name: "Admin - Manage Staff Accounts",
      test: () => canManageStaffAccounts(adminUser),
      expected: true,
    },
    {
      name: "Staff - Manage Staff Accounts",
      test: () => canManageStaffAccounts(staffUser),
      expected: false,
    },
    {
      name: "Admin - Approve Requests",
      test: () => canApproveRequests(adminUser),
      expected: true,
    },
    {
      name: "Staff - Approve Requests",
      test: () => canApproveRequests(staffUser),
      expected: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = test.test();
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const roleAccessResults = runRoleAccessTests();

// ============================================================================
// FINAL SUMMARY
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("🎯 COMPONENT VALIDATION TEST SUMMARY");
console.log("=".repeat(60));

const allResults = [
  { suite: "Form Validation Logic", ...formValidationResults },
  { suite: "Availability Logic", ...availabilityResults },
  { suite: "Advance Request Logic", ...advanceRequestResults },
  { suite: "Month/Date Navigation Logic", ...monthNavigationResults },
  { suite: "Role-Based Access Logic", ...roleAccessResults },
];

let totalPassed = 0;
let totalFailed = 0;

allResults.forEach((result) => {
  totalPassed += result.passed;
  totalFailed += result.failed;
  const percentage = ((result.passed / (result.passed + result.failed)) * 100).toFixed(1);
  console.log(`\n${result.suite}:`);
  console.log(`  ✅ Passed: ${result.passed}`);
  console.log(`  ❌ Failed: ${result.failed}`);
  console.log(`  📊 Success Rate: ${percentage}%`);
});

console.log("\n" + "=".repeat(60));
console.log(`TOTAL TESTS: ${totalPassed + totalFailed}`);
console.log(`✅ PASSED: ${totalPassed}`);
console.log(`❌ FAILED: ${totalFailed}`);
console.log(`📊 OVERALL SUCCESS RATE: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
console.log("=".repeat(60));

if (totalFailed === 0) {
  console.log("\n🎉 ALL COMPONENT VALIDATION TESTS PASSED!");
} else {
  console.log(`\n⚠️ ${totalFailed} test(s) failed. Review the failures above.`);
}

console.log("\n✅ Test execution completed!\n");
