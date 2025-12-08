// src/utils/validationHelpers.js
// Validation helper functions with proper null/undefined/empty handling

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidEmail = (email) => {
  // Fix Issue 1: Add explicit null/undefined/empty checks
  if (email === null || email === undefined || email === '') {
    return false;
  }
  
  // Convert to string if not already
  const emailStr = String(email).trim();
  
  if (emailStr === '') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailStr);
};

/**
 * Validate password (minimum 6 characters per Firebase requirement)
 * @param {string} password - Password to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidPassword = (password) => {
  // Fix Issue 2: Add explicit null/undefined/empty checks
  if (password === null || password === undefined || password === '') {
    return false;
  }
  
  // Convert to string if not already
  const passwordStr = String(password);
  
  return passwordStr.length >= 6;
};

/**
 * Validate name (non-empty string)
 * @param {string} name - Name to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidName = (name) => {
  // Fix Issue 3: Add explicit null/undefined/empty checks
  if (name === null || name === undefined || name === '') {
    return false;
  }
  
  // Convert to string and trim
  const nameStr = String(name).trim();
  
  return nameStr.length > 0;
};

/**
 * Validate amount (positive number)
 * @param {string|number} amount - Amount to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidAmount = (amount) => {
  // Fix Issue 4: Add explicit null/undefined/empty checks
  if (amount === null || amount === undefined || amount === '') {
    return false;
  }
  
  const num = parseFloat(amount);
  
  // Fix Issue 5: Reject negative numbers explicitly
  if (isNaN(num) || num <= 0) {
    return false;
  }
  
  return true;
};

/**
 * Validate positive number (including zero)
 * @param {string|number} value - Value to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidPositiveNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  
  const num = parseFloat(value);
  
  // Fix Issue 5: Reject negative numbers explicitly
  if (isNaN(num) || num < 0) {
    return false;
  }
  
  return true;
};

/**
 * Validate OT hours (positive number, can be decimal)
 * @param {string|number} hours - Hours to validate
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateOTHours = (hours) => {
  // Fix Issue 5: Explicit validation for OT hours
  if (hours === null || hours === undefined || hours === '') {
    return { valid: false, error: 'Hours is required' };
  }
  
  const num = parseFloat(hours);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Please enter a valid number' };
  }
  
  if (num < 0) {
    return { valid: false, error: 'Hours cannot be negative' };
  }
  
  if (num === 0) {
    return { valid: false, error: 'Hours must be greater than 0' };
  }
  
  if (num > 24) {
    return { valid: false, error: 'Hours cannot exceed 24 in a day' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate salary amount
 * @param {string|number} salary - Salary to validate
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateSalary = (salary) => {
  // Fix Issue 5: Explicit validation for salary
  if (salary === null || salary === undefined || salary === '') {
    return { valid: false, error: 'Salary is required' };
  }
  
  const num = parseFloat(salary);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Please enter a valid salary amount' };
  }
  
  if (num < 0) {
    return { valid: false, error: 'Salary cannot be negative' };
  }
  
  if (num === 0) {
    return { valid: false, error: 'Salary must be greater than 0' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate advance request
 * @param {string|number} amount - Amount to validate
 * @param {string} reason - Reason for advance
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateAdvanceRequest = (amount, reason) => {
  // Validate amount
  if (amount === null || amount === undefined || amount === '') {
    return { valid: false, error: 'Amount is required' };
  }
  
  const num = parseFloat(amount);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Please enter a valid amount' };
  }
  
  if (num <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }
  
  if (num < 0) {
    return { valid: false, error: 'Amount cannot be negative' };
  }
  
  // Validate reason
  if (reason === null || reason === undefined || reason === '') {
    return { valid: false, error: 'Reason is required' };
  }
  
  const reasonStr = String(reason).trim();
  
  if (reasonStr === '') {
    return { valid: false, error: 'Reason cannot be empty' };
  }
  
  return { valid: true, error: null };
};

/**
 * Check if user has required role
 * @param {object} user - User object
 * @param {string} requiredRole - Required role ('admin' or 'staff')
 * @returns {boolean} - True if user has role, false otherwise
 */
export const hasRole = (user, requiredRole) => {
  // Fix Issue 6: Add explicit null checks for user
  if (!user || user === null || user === undefined) {
    return false;
  }
  
  if (!user.role) {
    return false;
  }
  
  return user.role === requiredRole;
};

/**
 * Check if user can access admin dashboard
 * @param {object} user - User object
 * @returns {boolean} - True if user can access, false otherwise
 */
export const canAccessAdminDashboard = (user) => {
  // Fix Issue 6: Add explicit null check
  if (!user || user === null || user === undefined) {
    return false;
  }
  
  return hasRole(user, 'admin');
};

/**
 * Check if user can access staff dashboard
 * @param {object} user - User object
 * @returns {boolean} - True if user can access, false otherwise
 */
export const canAccessStaffDashboard = (user) => {
  // Fix Issue 6: Add explicit null check
  if (!user || user === null || user === undefined) {
    return false;
  }
  
  return hasRole(user, 'staff') || hasRole(user, 'admin');
};

/**
 * Calculate net salary and warn if negative
 * @param {number} baseSalary - Base salary
 * @param {number} otPayment - Overtime payment
 * @param {number} dayOffCharges - Day off deductions
 * @param {number} advanceDeductions - Advance deductions
 * @returns {object} - { netSalary: number, isNegative: boolean, warning: string|null }
 */
export const calculateNetSalaryWithWarning = (baseSalary, otPayment, dayOffCharges, advanceDeductions) => {
  const netSalary = baseSalary + otPayment - dayOffCharges - advanceDeductions;
  
  // Fix Issue 7: Add warning for negative net salary
  if (netSalary < 0) {
    return {
      netSalary,
      isNegative: true,
      warning: `⚠️ WARNING: Net salary is negative (${netSalary.toLocaleString()})! Deductions exceed income.`
    };
  }
  
  return {
    netSalary,
    isNegative: false,
    warning: null
  };
};

/**
 * Safe parse float with default value
 * @param {any} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} - Parsed number or default
 */
export const safeParseFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return defaultValue;
  }
  
  return num;
};

/**
 * Safe parse int with default value
 * @param {any} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} - Parsed number or default
 */
export const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const num = parseInt(value, 10);
  
  if (isNaN(num)) {
    return defaultValue;
  }
  
  return num;
};

/**
 * Validate and sanitize numeric input
 * @param {any} value - Value to validate
 * @param {object} options - Validation options
 * @returns {object} - { valid: boolean, value: number|null, error: string|null }
 */
export const validateNumericInput = (value, options = {}) => {
  const {
    min = null,
    max = null,
    allowZero = true,
    allowNegative = false,
    fieldName = 'Value'
  } = options;
  
  if (value === null || value === undefined || value === '') {
    return { valid: false, value: null, error: `${fieldName} is required` };
  }
  
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return { valid: false, value: null, error: `Please enter a valid ${fieldName.toLowerCase()}` };
  }
  
  if (!allowNegative && num < 0) {
    return { valid: false, value: null, error: `${fieldName} cannot be negative` };
  }
  
  if (!allowZero && num === 0) {
    return { valid: false, value: null, error: `${fieldName} must be greater than 0` };
  }
  
  if (min !== null && num < min) {
    return { valid: false, value: null, error: `${fieldName} must be at least ${min}` };
  }
  
  if (max !== null && num > max) {
    return { valid: false, value: null, error: `${fieldName} cannot exceed ${max}` };
  }
  
  return { valid: true, value: num, error: null };
};

export default {
  isValidEmail,
  isValidPassword,
  isValidName,
  isValidAmount,
  isValidPositiveNumber,
  validateOTHours,
  validateSalary,
  validateAdvanceRequest,
  hasRole,
  canAccessAdminDashboard,
  canAccessStaffDashboard,
  calculateNetSalaryWithWarning,
  safeParseFloat,
  safeParseInt,
  validateNumericInput
};
