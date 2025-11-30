// src/utils/dateHelpers.js
// Helper functions for date/time handling using LOCAL time (not UTC)

/**
 * Get current month in YYYY-MM format using LOCAL time
 * @param {Date} date - Date object (defaults to now)
 * @returns {string} - Month string like "2025-12"
 */
export const getLocalMonth = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Get shift month based on local time (for clock-in/out)
 * If after 6 PM, counts as next day's shift
 * @param {Date} timestamp - Date object
 * @returns {string} - Month string like "2025-12"
 */
export const getShiftMonth = (timestamp) => {
  const date = new Date(timestamp);
  if (date.getHours() >= 18) {
    date.setDate(date.getDate() + 1);
  }
  return getLocalMonth(date);
};
