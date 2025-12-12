// src/utils/sessionHelpers.js
// Helper functions for session management and auto-close logic

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Auto-close all unclosed sessions for a staff member
 * This function handles:
 * - Sessions from previous days
 * - Night shifts (started after 6pm)
 * - Multiple forgotten sessions
 * - Long-running sessions
 * 
 * @param {string} staffUid - The staff member's UID
 * @returns {Promise<Object>} - Result object with closed count and session details
 */
export const autoCloseUncompletedSessions = async (staffUid) => {
  try {
    if (!staffUid) {
      throw new Error("Staff UID is required");
    }

    // Query ALL unclosed sessions for this staff member (not just today)
    // This catches:
    // - Yesterday's forgotten sessions
    // - Night shifts from previous days
    // - Any orphaned active sessions
    const uncompletedQuery = query(
      collection(db, "sessions"),
      where("staffUid", "==", staffUid),
      where("status", "==", "active"),
      where("clockOut", "==", null),
      orderBy("clockIn", "asc")
    );

    const snapshot = await getDocs(uncompletedQuery);
    
    if (snapshot.empty) {
      console.log("No unclosed sessions found");
      return { closed: 0, sessions: [] };
    }

    const now = new Date();
    const closedSessions = [];
    const closePromises = [];

    console.log(`Found ${snapshot.size} unclosed session(s) to auto-close`);

    snapshot.forEach((docSnapshot) => {
      const sessionData = docSnapshot.data();
      const clockInTime = new Date(sessionData.clockIn);
      const duration = now - clockInTime;

      // Calculate how long the session was running
      const hoursRunning = duration / (1000 * 60 * 60);
      
      console.log(`Auto-closing session ${docSnapshot.id}:`, {
        clockIn: sessionData.clockIn,
        hoursRunning: hoursRunning.toFixed(2),
        shiftDate: sessionData.shiftDate
      });

      // Prepare update data
      const updateData = {
        clockOut: now.toISOString(),
        duration: duration,
        totalHours: duration / (1000 * 60 * 60),
        status: "completed",
        autoClosed: true,
        autoClosedAt: now.toISOString(),
        autoCloseReason: "Auto-closed due to new clock-in without proper clock-out",
        crossMidnight: clockInTime.toDateString() !== now.toDateString(),
        // Preserve original session data for audit trail
        originalStatus: sessionData.status || "active",
      };

      // Update the session in Firestore
      const sessionRef = doc(db, "sessions", docSnapshot.id);
      closePromises.push(updateDoc(sessionRef, updateData));

      closedSessions.push({
        id: docSnapshot.id,
        clockIn: sessionData.clockIn,
        clockOut: now.toISOString(),
        duration: duration,
        shiftDate: sessionData.shiftDate,
        hoursRunning: hoursRunning
      });
    });

    // Execute all updates in parallel
    await Promise.all(closePromises);

    console.log(`Successfully auto-closed ${closedSessions.length} session(s)`);

    return {
      closed: closedSessions.length,
      sessions: closedSessions,
      timestamp: now.toISOString()
    };

  } catch (error) {
    console.error("Error in autoCloseUncompletedSessions:", error);
    throw new Error("Failed to auto-close previous sessions: " + error.message);
  }
};

/**
 * Check if there are any unclosed sessions for a staff member
 * Useful for preventive checks before allowing clock-in
 * 
 * @param {string} staffUid - The staff member's UID
 * @returns {Promise<Object>} - Object with hasUnclosed flag and session count
 */
export const checkForUncompletedSessions = async (staffUid) => {
  try {
    const uncompletedQuery = query(
      collection(db, "sessions"),
      where("staffUid", "==", staffUid),
      where("status", "==", "active"),
      where("clockOut", "==", null)
    );

    const snapshot = await getDocs(uncompletedQuery);
    
    return {
      hasUnclosed: !snapshot.empty,
      count: snapshot.size,
      sessions: snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    };
  } catch (error) {
    console.error("Error checking for uncompleted sessions:", error);
    return {
      hasUnclosed: false,
      count: 0,
      sessions: [],
      error: error.message
    };
  }
};

/**
 * Get the shift date based on clock-in time (6 PM boundary rule)
 * If clock-in is at or after 6 PM, it counts as the next day's shift
 * 
 * @param {Date|string} timestamp - Clock-in timestamp
 * @returns {string} - Shift date string
 */
export const getShiftDate = (timestamp) => {
  const date = new Date(timestamp);
  if (date.getHours() >= 18) {
    date.setDate(date.getDate() + 1);
  }
  return date.toDateString();
};

/**
 * Get the shift month based on clock-in time (6 PM boundary rule)
 * 
 * @param {Date|string} timestamp - Clock-in timestamp
 * @returns {string} - Month string in YYYY-MM format
 */
export const getShiftMonth = (timestamp) => {
  const date = new Date(timestamp);
  if (date.getHours() >= 18) {
    date.setDate(date.getDate() + 1);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Validate session data before creating/updating
 * 
 * @param {Object} sessionData - Session data to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateSessionData = (sessionData) => {
  const errors = [];

  if (!sessionData.staffUid) {
    errors.push("Staff UID is required");
  }

  if (!sessionData.clockIn) {
    errors.push("Clock-in time is required");
  }

  if (sessionData.clockOut) {
    const clockIn = new Date(sessionData.clockIn);
    const clockOut = new Date(sessionData.clockOut);
    
    if (clockOut < clockIn) {
      errors.push("Clock-out time cannot be before clock-in time");
    }

    const duration = clockOut - clockIn;
    const hours = duration / (1000 * 60 * 60);
    
    // Warn if session is unreasonably long (more than 24 hours)
    if (hours > 24) {
      errors.push(`Warning: Session duration is ${hours.toFixed(1)} hours (more than 24 hours)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: errors.filter(e => e.startsWith("Warning"))
  };
};

/**
 * Format session duration for display
 * 
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} - Formatted duration string
 */
export const formatSessionDuration = (milliseconds) => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
};

/**
 * Check if a session crosses midnight
 * 
 * @param {string} clockIn - Clock-in ISO timestamp
 * @param {string} clockOut - Clock-out ISO timestamp
 * @returns {boolean} - True if session crosses midnight
 */
export const sessionCrossesMidnight = (clockIn, clockOut) => {
  if (!clockOut) return false;
  const inDate = new Date(clockIn).toDateString();
  const outDate = new Date(clockOut).toDateString();
  return inDate !== outDate;
};

/**
 * Get session age in hours (time since clock-in)
 * 
 * @param {string} clockIn - Clock-in ISO timestamp
 * @returns {number} - Hours since clock-in
 */
export const getSessionAge = (clockIn) => {
  const now = new Date();
  const clockInTime = new Date(clockIn);
  const duration = now - clockInTime;
  return duration / (1000 * 60 * 60);
};

/**
 * Check if a session is a night shift (started at or after 6 PM)
 * 
 * @param {string} clockIn - Clock-in ISO timestamp
 * @returns {boolean} - True if night shift
 */
export const isNightShift = (clockIn) => {
  const date = new Date(clockIn);
  return date.getHours() >= 18;
};
