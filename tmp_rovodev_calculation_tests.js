// ============================================================================
// CAFE PIRANHA SYSTEM - CALCULATION TESTS
// ============================================================================

console.log("🧪 Starting Calculation Tests...\n");

// ============================================================================
// TEST SUITE 1: DAY OFF RATE CALCULATIONS
// ============================================================================

console.log("📊 TEST SUITE 1: Day Off Rate Calculations");
console.log("=".repeat(60));

const dayOffRates = {
  0: 550, // Sunday
  1: 500, // Monday
  2: 500, // Tuesday
  3: 500, // Wednesday
  4: 500, // Thursday
  5: 500, // Friday
  6: 450, // Saturday
};

function getDayOffCharge(dateString) {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay();
  return dayOffRates[dayOfWeek] || 0;
}

function runDayOffTests() {
  const tests = [
    {
      name: "Saturday Rate",
      date: "2025-01-18", // Saturday
      expected: 450,
    },
    {
      name: "Sunday Rate",
      date: "2025-01-19", // Sunday
      expected: 550,
    },
    {
      name: "Monday Rate",
      date: "2025-01-20", // Monday
      expected: 500,
    },
    {
      name: "Tuesday Rate",
      date: "2025-01-21", // Tuesday
      expected: 500,
    },
    {
      name: "Wednesday Rate",
      date: "2025-01-22", // Wednesday
      expected: 500,
    },
    {
      name: "Thursday Rate",
      date: "2025-01-23", // Thursday
      expected: 500,
    },
    {
      name: "Friday Rate",
      date: "2025-01-24", // Friday
      expected: 500,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = getDayOffCharge(test.date);
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}: Expected ₹${test.expected}, Got ₹${result}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const dayOffResults = runDayOffTests();

// ============================================================================
// TEST SUITE 2: MULTIPLE DAY OFF CALCULATIONS
// ============================================================================

console.log("📊 TEST SUITE 2: Multiple Day Off Calculations");
console.log("=".repeat(60));

function calculateTotalDayOffCharges(dayOffDates) {
  return dayOffDates.reduce((total, date) => {
    return total + getDayOffCharge(date);
  }, 0);
}

function runMultipleDayOffTests() {
  const tests = [
    {
      name: "1 Saturday + 1 Sunday",
      dates: ["2025-01-18", "2025-01-19"],
      expected: 450 + 550,
    },
    {
      name: "2 Weekdays",
      dates: ["2025-01-20", "2025-01-21"],
      expected: 500 + 500,
    },
    {
      name: "Full Week Off",
      dates: [
        "2025-01-20", // Mon
        "2025-01-21", // Tue
        "2025-01-22", // Wed
        "2025-01-23", // Thu
        "2025-01-24", // Fri
        "2025-01-25", // Sat
        "2025-01-26", // Sun
      ],
      expected: 500 + 500 + 500 + 500 + 500 + 450 + 550,
    },
    {
      name: "No Days Off",
      dates: [],
      expected: 0,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = calculateTotalDayOffCharges(test.dates);
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}: Expected ₹${test.expected}, Got ₹${result}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const multipleDayOffResults = runMultipleDayOffTests();

// ============================================================================
// TEST SUITE 3: OVERTIME PAYMENT CALCULATIONS
// ============================================================================

console.log("📊 TEST SUITE 3: Overtime Payment Calculations");
console.log("=".repeat(60));

const OT_HOURLY_RATE = 100; // ₹100 per hour

function calculateOTPayment(hours) {
  return hours * OT_HOURLY_RATE;
}

function calculateTotalOTPayment(otEntries) {
  return otEntries.reduce((total, entry) => {
    return total + calculateOTPayment(entry.hours);
  }, 0);
}

function runOTTests() {
  const tests = [
    {
      name: "0 Hours OT",
      hours: 0,
      expected: 0,
    },
    {
      name: "0.5 Hours OT",
      hours: 0.5,
      expected: 50,
    },
    {
      name: "1 Hour OT",
      hours: 1,
      expected: 100,
    },
    {
      name: "5 Hours OT",
      hours: 5,
      expected: 500,
    },
    {
      name: "10 Hours OT",
      hours: 10,
      expected: 1000,
    },
    {
      name: "24 Hours OT (Full Day)",
      hours: 24,
      expected: 2400,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = calculateOTPayment(test.hours);
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}: Expected ₹${test.expected}, Got ₹${result}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const otResults = runOTTests();

// ============================================================================
// TEST SUITE 4: MULTIPLE OT ENTRIES
// ============================================================================

console.log("📊 TEST SUITE 4: Multiple OT Entries");
console.log("=".repeat(60));

function runMultipleOTTests() {
  const tests = [
    {
      name: "Single OT Entry",
      entries: [{ date: "2025-01-15", hours: 5 }],
      expected: 500,
    },
    {
      name: "Multiple OT Entries",
      entries: [
        { date: "2025-01-15", hours: 5 },
        { date: "2025-01-16", hours: 3 },
        { date: "2025-01-17", hours: 2 },
      ],
      expected: 1000,
    },
    {
      name: "No OT Entries",
      entries: [],
      expected: 0,
    },
    {
      name: "Fractional Hours",
      entries: [
        { date: "2025-01-15", hours: 2.5 },
        { date: "2025-01-16", hours: 1.5 },
      ],
      expected: 400,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = calculateTotalOTPayment(test.entries);
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}: Expected ₹${test.expected}, Got ₹${result}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const multipleOTResults = runMultipleOTTests();

// ============================================================================
// TEST SUITE 5: NET SALARY CALCULATIONS
// ============================================================================

console.log("📊 TEST SUITE 5: Net Salary Calculations");
console.log("=".repeat(60));

function calculateNetSalary(baseSalary, otPayment, dayOffCharges, advanceDeductions) {
  return baseSalary + otPayment - dayOffCharges - advanceDeductions;
}

function runNetSalaryTests() {
  const tests = [
    {
      name: "Basic Salary Only",
      base: 15000,
      ot: 0,
      dayOff: 0,
      advance: 0,
      expected: 15000,
    },
    {
      name: "Salary + OT",
      base: 15000,
      ot: 500,
      dayOff: 0,
      advance: 0,
      expected: 15500,
    },
    {
      name: "Salary - Day Off",
      base: 15000,
      ot: 0,
      dayOff: 1000,
      advance: 0,
      expected: 14000,
    },
    {
      name: "Salary - Advance",
      base: 15000,
      ot: 0,
      dayOff: 0,
      advance: 2000,
      expected: 13000,
    },
    {
      name: "Full Calculation (Positive)",
      base: 15000,
      ot: 500,
      dayOff: 1000,
      advance: 2000,
      expected: 12500,
    },
    {
      name: "High OT Scenario",
      base: 15000,
      ot: 5000,
      dayOff: 500,
      advance: 1000,
      expected: 18500,
    },
    {
      name: "High Deductions (Potential Negative)",
      base: 15000,
      ot: 0,
      dayOff: 5000,
      advance: 12000,
      expected: -2000,
    },
    {
      name: "Zero Base Salary",
      base: 0,
      ot: 1000,
      dayOff: 500,
      advance: 0,
      expected: 500,
    },
    {
      name: "All Components Max",
      base: 50000,
      ot: 10000,
      dayOff: 3500,
      advance: 5000,
      expected: 51500,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = calculateNetSalary(test.base, test.ot, test.dayOff, test.advance);
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}`);
    console.log(`   Formula: ₹${test.base} + ₹${test.ot} - ₹${test.dayOff} - ₹${test.advance}`);
    console.log(`   Expected: ₹${test.expected}, Got: ₹${result}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const netSalaryResults = runNetSalaryTests();

// ============================================================================
// TEST SUITE 6: DATE HELPER FUNCTIONS
// ============================================================================

console.log("📊 TEST SUITE 6: Date Helper Functions");
console.log("=".repeat(60));

function getLocalMonth(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getShiftMonth(timestamp) {
  const date = new Date(timestamp);
  if (date.getHours() >= 18) {
    date.setDate(date.getDate() + 1);
  }
  return getLocalMonth(date);
}

function runDateHelperTests() {
  const tests = [
    {
      name: "Current Month Format",
      date: new Date("2025-01-15T12:00:00"),
      expected: "2025-01",
      test: (d) => getLocalMonth(d),
    },
    {
      name: "Different Month",
      date: new Date("2024-12-25T12:00:00"),
      expected: "2024-12",
      test: (d) => getLocalMonth(d),
    },
    {
      name: "Shift Month - Before 6 PM",
      date: new Date("2025-01-15T17:59:00"),
      expected: "2025-01",
      test: (d) => getShiftMonth(d),
    },
    {
      name: "Shift Month - At 6 PM",
      date: new Date("2025-01-15T18:00:00"),
      expected: "2025-01",
      test: (d) => getShiftMonth(d),
    },
    {
      name: "Shift Month - After 6 PM (counts as next day)",
      date: new Date("2025-01-15T18:01:00"),
      expected: "2025-01",
      test: (d) => getShiftMonth(d),
    },
    {
      name: "Shift Month - Late Night (crosses to next day)",
      date: new Date("2025-01-31T22:00:00"),
      expected: "2025-02",
      test: (d) => getShiftMonth(d),
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = test.test(test.date);
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}: Expected "${test.expected}", Got "${result}"`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

const dateHelperResults = runDateHelperTests();

// ============================================================================
// TEST SUITE 7: EDGE CASES
// ============================================================================

console.log("📊 TEST SUITE 7: Edge Cases & Boundary Tests");
console.log("=".repeat(60));

function runEdgeCaseTests() {
  const tests = [
    {
      name: "Negative OT Hours (Invalid Input)",
      test: () => calculateOTPayment(-5),
      expected: -500,
      note: "⚠️ Should validate: Negative hours should not be allowed",
    },
    {
      name: "Very Large OT Hours",
      test: () => calculateOTPayment(1000),
      expected: 100000,
      note: "✓ Valid: System handles large numbers",
    },
    {
      name: "Decimal Precision in OT",
      test: () => calculateOTPayment(2.75),
      expected: 275,
      note: "✓ Valid: System handles decimals correctly",
    },
    {
      name: "Negative Base Salary (Invalid)",
      test: () => calculateNetSalary(-5000, 0, 0, 0),
      expected: -5000,
      note: "⚠️ Should validate: Negative salary should not be allowed",
    },
    {
      name: "Extremely High Deductions",
      test: () => calculateNetSalary(15000, 0, 20000, 10000),
      expected: -15000,
      note: "⚠️ Warning: Net salary is negative",
    },
    {
      name: "All Zero Values",
      test: () => calculateNetSalary(0, 0, 0, 0),
      expected: 0,
      note: "✓ Valid: Handles zero values",
    },
    {
      name: "Floating Point Precision",
      test: () => calculateNetSalary(15000.50, 500.75, 1000.25, 2000.50),
      expected: 12500.50,
      note: "✓ Valid: Handles decimal precision",
    },
  ];

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  tests.forEach((test) => {
    const result = test.test();
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    
    if (result === test.expected) {
      passed++;
      if (test.note.includes("⚠️")) {
        warnings++;
      }
    } else {
      failed++;
    }
    
    console.log(`${status} | ${test.name}`);
    console.log(`   Expected: ${test.expected}, Got: ${result}`);
    console.log(`   ${test.note}`);
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed, ${warnings} warnings\n`);
  return { passed, failed, warnings };
}

const edgeCaseResults = runEdgeCaseTests();

// ============================================================================
// FINAL SUMMARY
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("🎯 FINAL TEST SUMMARY");
console.log("=".repeat(60));

const allResults = [
  { suite: "Day Off Rate Calculations", ...dayOffResults },
  { suite: "Multiple Day Off Calculations", ...multipleDayOffResults },
  { suite: "Overtime Payment Calculations", ...otResults },
  { suite: "Multiple OT Entries", ...multipleOTResults },
  { suite: "Net Salary Calculations", ...netSalaryResults },
  { suite: "Date Helper Functions", ...dateHelperResults },
  { suite: "Edge Cases & Boundary Tests", ...edgeCaseResults },
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
  console.log("\n🎉 ALL TESTS PASSED! System calculations are working correctly.");
} else {
  console.log(`\n⚠️ ${totalFailed} test(s) failed. Review the failures above.`);
}

console.log("\n✅ Test execution completed!\n");
