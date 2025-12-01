// src/Pages/StaffDashboard/StaffDashboard.jsx
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase";
import "./StaffDashboard.css";
import { useNavigate, useLocation } from "react-router-dom";
import { getCurrentMonthRunningDaysOff } from "../../config/dayOffRates";

export default function StaffDashboard({ staffData, onLogout }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [loading, setLoading] = useState(false);
  const [endingShift, setEndingShift] = useState(false);
  const [staffSalary, setStaffSalary] = useState(null);
  
  // Location verification states
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationAllowed, setLocationAllowed] = useState(null);
  const [userCoords, setUserCoords] = useState(null);

  // Day-off warning states
  const [dayOffData, setDayOffData] = useState(null);
  const [loadingDayOff, setLoadingDayOff] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  // Destructure staff data from props
  const { staffName, staffId, uid } = staffData;

  // Allowed location (Cafe Piranha - Ella)
  const ALLOWED_LAT = 6.871796;  
  const ALLOWED_LNG = 81.057271;
  const MAX_DISTANCE_METERS = 100;

  // Helper functions for shift-based tracking
  const getShiftDate = (timestamp) => {
    const date = new Date(timestamp);
    if (date.getHours() >= 18) {
      date.setDate(date.getDate() + 1);
    }
    return date.toDateString();
  };

  // Helper for local month and shift month calculation
  const getLocalMonth = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getShiftMonth = (timestamp) => {
    const date = new Date(timestamp);
    if (date.getHours() >= 18) {
      date.setDate(date.getDate() + 1);
    }
    return getLocalMonth(date);
  };

  // Helper functions for distance calculation
  const toRad = (value) => (value * Math.PI) / 180;
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // === Location Verification Function ===
  const verifyLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      setCheckingLocation(true);
      setLocationMessage("Verifying your location...");
      setLocationAllowed(null);

      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ latitude, longitude });

          const distance = getDistance(latitude, longitude, ALLOWED_LAT, ALLOWED_LNG);

          setTimeout(() => {
            if (distance <= MAX_DISTANCE_METERS) {
              setLocationAllowed(true);
              setLocationMessage("Location Verified - You're at Cafe Piranha");
              resolve({ allowed: true, coords: { latitude, longitude } });
            } else {
              setLocationAllowed(false);
              setLocationMessage(
                `Location Restricted - ${distance.toFixed(1)}m away from Cafe Piranha`
              );
              resolve({ allowed: false, distance: distance });
            }
            setCheckingLocation(false);
          }, 1000);
        },
        (err) => {
          setCheckingLocation(false);
          let errorMsg = "Unable to determine location";
          if (err.code === 1) errorMsg = "Location access denied. Please enable location services";
          else if (err.code === 2) errorMsg = "Location services unavailable";
          else if (err.code === 3) errorMsg = "Location request timeout";
          
          setLocationMessage(errorMsg);
          reject(new Error(errorMsg));
        },
        options
      );
    });
  };

  // === Fetch Staff Salary Data ===
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "salaries", uid), (doc) => {
      if (doc.exists()) {
        setStaffSalary(doc.data());
      } else {
        setStaffSalary(null);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // === Calculate Daily Hours and Adjustments (TEST MODE) ===
  const calculateDailyAdjustments = (sessions) => {
    const totalSeconds = sessions.reduce((sum, s) => {
      if (s.clockOut && s.duration) {
        return sum + Math.floor(s.duration / 1000);
      }
      return sum;
    }, 0);
  
    // REAL MODE CONSTANTS
    const FULL_SHIFT_SECONDS = 12 * 3600;   // 12 hours in seconds
    const INTERVAL_SECONDS = 3600;          // 1 hour in seconds
    const RATE_PER_INTERVAL = staffSalary?.otRate || 200;
  
    let regularSeconds = Math.min(totalSeconds, FULL_SHIFT_SECONDS);
    let otSeconds = 0;
    let shortSeconds = 0;
  
    if (totalSeconds > FULL_SHIFT_SECONDS) {
      // overtime
      otSeconds = totalSeconds - FULL_SHIFT_SECONDS;
    } else if (totalSeconds < FULL_SHIFT_SECONDS) {
      // short time
      shortSeconds = FULL_SHIFT_SECONDS - totalSeconds;
    }
  
    // intervals
    const otIntervals = Math.floor(otSeconds / INTERVAL_SECONDS);
    const shortIntervals = Math.ceil(shortSeconds / INTERVAL_SECONDS);
  
    // amounts
    const otAmount = otIntervals * RATE_PER_INTERVAL;
    const shortAmount = shortIntervals * RATE_PER_INTERVAL;
  
    return {
      totalSecondsToday: totalSeconds,
      regularSeconds: regularSeconds,
  
      otSeconds: otSeconds,
      otIntervals: otIntervals,
      otAmount: otAmount,
      hasOT: otIntervals > 0,
  
      shortSeconds: shortSeconds,
      shortIntervals: shortIntervals,
      shortAmount: shortAmount,
      hasShort: shortIntervals > 0,
  
      adjustmentType:
        otIntervals > 0 ? "overtime" :
        shortIntervals > 0 ? "short_time" : "none",
  
      testingMode: false,                    // ← real mode now
      fullShiftSeconds: FULL_SHIFT_SECONDS,
      intervalSeconds: INTERVAL_SECONDS,
      ratePerInterval: RATE_PER_INTERVAL,
      staffOtRate: RATE_PER_INTERVAL,
    };
  };
  

  // === Load current month day-off data ===
  useEffect(() => {
    const loadDayOffData = async () => {
      if (!uid) return;
      
      setLoadingDayOff(true);
      try {
        const data = await getCurrentMonthRunningDaysOff(uid);
        setDayOffData(data);
      } catch (error) {
        console.error("Error loading day-off data:", error);
      } finally {
        setLoadingDayOff(false);
      }
    };

    loadDayOffData();
    
    // Refresh day-off data every hour
    const interval = setInterval(loadDayOffData, 3600000);
    return () => clearInterval(interval);
  }, [uid]);

  // === Real-time Firestore listener ===
  useEffect(() => {
    const now = new Date();
    const startOfShiftPeriod = new Date(now);
    startOfShiftPeriod.setHours(18, 0, 0, 0);
    startOfShiftPeriod.setDate(startOfShiftPeriod.getDate() - 1);
    
    const endOfShiftPeriod = new Date(now);
    endOfShiftPeriod.setHours(18, 0, 0, 0);

    const q = query(
      collection(db, "sessions"),
      where("staffUid", "==", uid),
      where("clockIn", ">=", startOfShiftPeriod.toISOString()),
      orderBy("clockIn", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessions = [];
        let totalHours = 0;

        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          
          if (new Date(data.clockIn) >= startOfShiftPeriod) {
            sessions.push(data);
            if (data.clockOut && data.duration) {
              totalHours += data.duration / (1000 * 60 * 60);
            }
          }
        });

        setTodaySessions(sessions);
        setTotalHoursToday(totalHours);

        const activeSession = sessions.find((s) => !s.clockOut);
        if (activeSession) {
          setIsClockedIn(true);
          setCurrentSession(activeSession);
        } else {
          setIsClockedIn(false);
          setCurrentSession(null);
        }
      },
      (error) => {
        console.error("Firestore error:", error);
        showNotification("Error connecting to database: " + error.message, "error");
      }
    );

    return () => unsubscribe();
  }, [uid, staffName]);

  // === Clock In ===
  const clockIn = async () => {
    setLoading(true);
    
    try {
      const locationResult = await verifyLocation();
      
      if (!locationResult.allowed) {
        showNotification(`Cannot clock in: ${locationMessage}`, "error");
        setLoading(false);
        return;
      }

      const clockInTime = new Date();
      const session = {
        staffUid: uid,
        staffId: staffId,
        staffName: staffName,
        clockIn: clockInTime.toISOString(),
        clockOut: null,
        duration: 0,
        date: new Date().toDateString(),
        shiftDate: getShiftDate(clockInTime),
        status: "active",
        timestamp: new Date().toISOString(),
        location: {
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
          verified: true,
          distance: getDistance(locationResult.coords.latitude, locationResult.coords.longitude, ALLOWED_LAT, ALLOWED_LNG)
        },
        regularHours: 0,
        otHours: 0,
        otAmount: 0,
        otStatus: "none",
        month: getLocalMonth(new Date()),
        shiftMonth: getShiftMonth(clockInTime),
        isNightShift: clockInTime.getHours() >= 18
      };

      const docRef = await addDoc(collection(db, "sessions"), session);
      setCurrentSession({ id: docRef.id, ...session });
      setIsClockedIn(true);
      showNotification(`Clocked in at ${formatTime(clockInTime)} - Location Verified!`, "success");
      
    } catch (error) {
      console.error("Error clocking in:", error);
      showNotification("Error clocking in: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // === Clock Out ===
  const clockOut = async () => {
    if (!currentSession) return;
    setLoading(true);

    try {
      const locationResult = await verifyLocation();
      
      if (!locationResult.allowed) {
        showNotification(`Cannot clock out: ${locationMessage}`, "error");
        setLoading(false);
        return;
      }

      const clockOutTime = new Date();
      const clockInTime = new Date(currentSession.clockIn);
      const duration = clockOutTime - clockInTime;

      const updateData = {
        clockOut: clockOutTime.toISOString(),
        duration: duration,
        totalHours: duration / (1000 * 60 * 60),
        status: "completed",
        clockOutLocation: {
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
          verified: true,
          distance: getDistance(locationResult.coords.latitude, locationResult.coords.longitude, ALLOWED_LAT, ALLOWED_LNG)
        },
        crossMidnight: clockInTime.toDateString() !== clockOutTime.toDateString()
      };

      const sessionRef = doc(db, "sessions", currentSession.id);
      await updateDoc(sessionRef, updateData);

      setIsClockedIn(false);
      setCurrentSession(null);
      showNotification(`Clocked out - Worked ${formatDuration(duration)} - Location Verified!`, "info");
    } catch (error) {
      console.error("Error clocking out:", error);
      showNotification("Error clocking out: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // === End Shift - Calculate Daily Adjustments ===
  const endShift = async () => {
    if (todaySessions.length === 0) {
      showNotification("No sessions today to end shift", "info");
      return;
    }

    setEndingShift(true);
    
    try {
      const locationResult = await verifyLocation();
      
      if (!locationResult.allowed) {
        showNotification(`Cannot end shift: ${locationMessage}`, "error");
        setEndingShift(false);
        return;
      }

      const dailyAdjustments = calculateDailyAdjustments(todaySessions);
      
      let summaryMessage = `End Your Shift?\n\n`;
      summaryMessage += `Total Time: ${formatSeconds(dailyAdjustments.totalSecondsToday)}\n`;
      summaryMessage += `Regular Time: ${formatSeconds(dailyAdjustments.regularSeconds)}\n`;
      
      if (dailyAdjustments.hasOT) {
        summaryMessage += `Overtime: +${dailyAdjustments.otIntervals} x ${dailyAdjustments.intervalSeconds}-second intervals\n`;
        summaryMessage += `OT Amount: +Rs. ${dailyAdjustments.otAmount} (Rate: Rs. ${dailyAdjustments.staffOtRate}/hour)\n`;
      }
      
      if (dailyAdjustments.hasShort) {
        summaryMessage += `Short Time: -${dailyAdjustments.shortIntervals} x ${dailyAdjustments.intervalSeconds}-second intervals\n`;
        summaryMessage += `Deduction: -Rs. ${dailyAdjustments.shortAmount}\n`;
      }
      
      if (!dailyAdjustments.hasOT && !dailyAdjustments.hasShort) {
        summaryMessage += `Perfect shift! Exactly ${dailyAdjustments.fullShiftSeconds} seconds worked\n`;
      }
      
      summaryMessage += `\nThis will create separate requests for admin approval.`;

      const confirmEnd = window.confirm(summaryMessage);
      
      if (!confirmEnd) {
        setEndingShift(false);
        return;
      }

      if (dailyAdjustments.hasOT) {
        await createAdjustmentRequest({
          ...dailyAdjustments,
          adjustmentType: 'overtime',
          adjustmentHours: dailyAdjustments.otIntervals,
          adjustmentAmount: dailyAdjustments.otAmount,
          adjustmentIntervals: dailyAdjustments.otIntervals
        });
      }

      if (dailyAdjustments.hasShort) {
        await createAdjustmentRequest({
          ...dailyAdjustments,
          adjustmentType: 'short_time',
          adjustmentHours: dailyAdjustments.shortIntervals,
          adjustmentAmount: dailyAdjustments.shortAmount,
          adjustmentIntervals: dailyAdjustments.shortIntervals
        });
      }

      let successMessage = "Shift ended! ";
      if (dailyAdjustments.hasOT && dailyAdjustments.hasShort) {
        successMessage += `+${dailyAdjustments.otIntervals} OT intervals and -${dailyAdjustments.shortIntervals} Short Time intervals requested`;
      } else if (dailyAdjustments.hasOT) {
        successMessage += `+${dailyAdjustments.otIntervals} OT intervals requested (Rate: Rs. ${dailyAdjustments.staffOtRate}/hour)`;
      } else if (dailyAdjustments.hasShort) {
        successMessage += `-${dailyAdjustments.shortIntervals} Short Time intervals reported`;
      } else {
        successMessage += 'Perfect timing! No adjustments needed';
      }

      showNotification(successMessage, "success");

    } catch (error) {
      console.error("Error ending shift:", error);
      showNotification("Error ending shift: " + error.message, "error");
    } finally {
      setEndingShift(false);
    }
  };

  // === Create Adjustment Request (OT or Short Time) ===
  const createAdjustmentRequest = async (adjustments) => {
    try {
      const request = {
        staffUid: uid,
        staffName: staffName,
        staffId: staffId,
        date: new Date().toDateString(),
        shiftDate: getShiftDate(new Date()),
        totalHours: adjustments.totalHoursToday || 0,
        totalSeconds: adjustments.totalSecondsToday || 0,
        regularHours: adjustments.regularHours || 0,
        regularSeconds: adjustments.regularSeconds || 0,
        adjustmentType: adjustments.adjustmentType,
        adjustmentHours: adjustments.adjustmentHours || 0,
        adjustmentSeconds: adjustments.adjustmentType === 'overtime' ? 
          (adjustments.otSeconds || 0) : 
          (adjustments.shortSeconds || 0),
        adjustmentIntervals: adjustments.adjustmentIntervals || 0,
        adjustmentAmount: adjustments.adjustmentAmount || 0,
        status: "pending",
        requestedAt: new Date().toISOString(),
        month: getLocalMonth(new Date()),
        shiftMonth: getShiftMonth(new Date()),
        sessions: todaySessions.map(s => ({
          sessionId: s.id,
          clockIn: s.clockIn,
          clockOut: s.clockOut || null,
          duration: s.duration || 0
        })),
        testingMode: true,
        ratePerInterval: adjustments.ratePerInterval || 200,
        intervalSeconds: adjustments.intervalSeconds || 5,
        fullShiftSeconds: adjustments.fullShiftSeconds || 60,
        staffOtRate: adjustments.staffOtRate || (staffSalary?.otRate || 200)
      };

      console.log("Creating adjustment request:", request);
      await addDoc(collection(db, "adjustmentRequests"), request);
      console.log("Adjustment request created successfully");
    } catch (error) {
      console.error("Error creating adjustment request:", error);
      throw error;
    }
  };

  // === Manual Location Check ===
  const checkLocationManually = async () => {
    try {
      const result = await verifyLocation();
      if (result.allowed) {
        showNotification("Location verified! You can clock in/out.", "success");
      } else {
        showNotification(locationMessage, "error");
      }
    } catch (error) {
      showNotification(error.message, "error");
    }
  };

  const isActiveRoute = (path) => location.pathname === path;

  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (error) {
      console.warn("Navigation error, using fallback:", error);
      window.location.href = path;
    }
  };

  const showNotification = (msg, type = "info") => {
    alert(msg);
  };

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const formatDuration = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatSeconds = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleLogout = () => {
    if (isClockedIn) {
      const confirmLogout = window.confirm(
        "You are currently clocked in! Logging out will end your active session. Continue?"
      );
      if (!confirmLogout) return;
      clockOut();
    }
    if (onLogout) onLogout();
  };

  // Calculate today's adjustments for display
  const todayAdjustments = calculateDailyAdjustments(todaySessions);

  return (
    <div className="staff-dashboard">
      {/* Enhanced Header */}
      <header className="dashboard-header">
        <div className="header-container">
          <div className="brand-section">
            <div className="logo-container">
              <div className="logo-icon">☕</div>
              <div className="brand-text">
                <h1 className="brand-title">Cafe Piranha</h1>
                <span className="brand-subtitle">Staff Portal</span>
              </div>
            </div>
          </div>
          
          <div className="user-section">
            <div className="user-profile">
              <div className="user-avatar">
                {staffName.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{staffName}</span>
                <span className="user-id">ID: {staffId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-item">
            <div className={`status-indicator ${isClockedIn ? 'active' : 'inactive'}`}>
              <div className="status-pulse"></div>
              <span className="status-text">
                {isClockedIn ? 'Currently Working' : 'Available'}
              </span>
            </div>
          </div>
          
          {staffSalary?.otRate && (
            <div className="status-item">
              <div className="rate-badge">
                <span className="rate-icon">💰</span>
                <span>OT Rate: Rs. {staffSalary.otRate}/hour</span>
              </div>
            </div>
          )}
          
          <div className="status-item">
            <div className="date-badge">
              <span className="date-icon">📅</span>
              <span>{new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div className="welcome-card">
            <div className="welcome-content">
              <h2 className="welcome-title">
                Good {getTimeOfDay()}, {staffName.split(' ')[0]}!
              </h2>
              <p className="welcome-subtitle">
                Ready to start your shift at Cafe Piranha?
              </p>
              {staffSalary?.otRate && (
                <div className="rate-card">
                  <div className="rate-icon">⚡</div>
                  <div className="rate-info">
                    <span className="rate-label">Your OT Rate</span>
                    <span className="rate-value">Rs. {staffSalary.otRate}/hour</span>
                  </div>
                </div>
              )}
            </div>
            <div className="welcome-graphic">
              <div className="coffee-animation">☕✨</div>
            </div>
          </div>
        </section>

        {/* Day-Off Warning Alert (Only when exceeding limit) */}
        {!loadingDayOff && dayOffData && dayOffData.status === 'over-limit' && (
          <section className="dayoff-alert-section">
            <div className="alert-card warning">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <h3 className="alert-title">Day-Off Limit Exceeded</h3>
                <p className="alert-message">
                  You have taken <strong>{dayOffData.daysOff} days off</strong> this month, 
                  which exceeds your limit of <strong>{dayOffData.threshold} days</strong>.
                </p>
                <div className="alert-calculation">
                  <div className="calc-row">
                    <span className="calc-label">Days Off Taken So Far:</span>
                    <span className="calc-value">{dayOffData.daysOff} days</span>
                  </div>
                  <div className="calc-row">
                    <span className="calc-label">Allowed Limit:</span>
                    <span className="calc-value">{dayOffData.threshold} days</span>
                  </div>
                  <div className="calc-row">
                    <span className="calc-label">Excess Days:</span>
                    <span className="calc-value excess">{dayOffData.excessDays} days</span>
                  </div>
                </div>
                <div className="alert-note warning-note">
                  <span className="note-icon">⚠️</span>
                  <span>
                    <strong>Warning:</strong> You are currently over your day-off limit. 
                    Deductions will be calculated and applied to your salary on the 1st of next month. 
                    Deduction rate: Rs. {dayOffData.deductionPerDay}/day over limit.
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Clock Control Section */}
        <section className="clock-section">
          <div className="clock-card">
            <div className="clock-header">
              <h3 className="clock-title">Shift Control</h3>
              <div className="clock-status">
                <div className={`status-badge ${isClockedIn ? 'clocked-in' : 'clocked-out'}`}>
                  <div className="status-dot"></div>
                  {isClockedIn ? 'ON SHIFT' : 'OFF SHIFT'}
                </div>
              </div>
            </div>

            {/* Active Timer */}
            {isClockedIn && currentSession && (
              <div className="active-session">
                <div className="timer-container">
                  <div className="timer-header">
                    <span className="timer-label">Current Session</span>
                    <span className="start-time">
                      Started at {formatTime(currentSession.clockIn)}
                      {currentSession.isNightShift && " 🌙"}
                    </span>
                  </div>
                  <div className="live-timer-wrapper">
                    <LiveTimer startTime={new Date(currentSession.clockIn)} />
                  </div>
                </div>
              </div>
            )}

            {/* Clock Actions */}
            <div className="clock-actions">
              {!isClockedIn ? (
                <button 
                  className="btn-clock btn-clock-in"
                  onClick={clockIn}
                  disabled={loading || checkingLocation}
                >
                  <div className="btn-content">
                    <div className="btn-icon">🟢</div>
                    <div className="btn-text">
                      <span className="btn-main-text">Clock In</span>
                      <span className="btn-sub-text">Start your shift</span>
                    </div>
                  </div>
                  {loading && <div className="btn-spinner"></div>}
                </button>
              ) : (
                <button 
                  className="btn-clock btn-clock-out"
                  onClick={clockOut}
                  disabled={loading || checkingLocation}
                >
                  <div className="btn-content">
                    <div className="btn-icon">🔴</div>
                    <div className="btn-text">
                      <span className="btn-main-text">Clock Out</span>
                      <span className="btn-sub-text">End current session</span>
                    </div>
                  </div>
                  {loading && <div className="btn-spinner"></div>}
                </button>
              )}
            </div>

            {/* End Shift Section */}
            {todaySessions.length > 0 && !isClockedIn && (
              <div className="end-shift-section">
                <div className="shift-divider">
                  <span>Shift Complete</span>
                </div>
                <button 
                  className="btn-end-shift"
                  onClick={endShift}
                  disabled={endingShift || checkingLocation}
                >
                  <div className="btn-content">
                    <div className="btn-icon">⏹️</div>
                    <div className="btn-text">
                      <span className="btn-main-text">
                        {endingShift ? 'Processing...' : 'End Shift'}
                      </span>
                      <span className="btn-sub-text">
                        Calculate OT/Short Time adjustments
                      </span>
                    </div>
                  </div>
                </button>
                <div className="test-mode-badge">
                  <span className="test-icon">🧪</span>
                  <span>Test Mode Active</span>
                </div>
              </div>
            )}

            {/* Location Section */}
            <div className="location-section">
              <button 
                className="btn-location"
                onClick={checkLocationManually}
                disabled={checkingLocation}
              >
                <div className="btn-content">
                  <div className="btn-icon">📍</div>
                  <div className="btn-text">
                    <span className="btn-main-text">
                      {checkingLocation ? 'Checking...' : 'Verify Location'}
                    </span>
                  </div>
                </div>
              </button>
              
              {locationMessage && (
                <div className={`location-status ${locationAllowed ? 'verified' : locationAllowed === false ? 'restricted' : 'checking'}`}>
                  <div className="location-icon">
                    {locationAllowed ? '✅' : locationAllowed === false ? '❌' : '📍'}
                  </div>
                  <span className="location-message">{locationMessage}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Today's Summary */}
        <section className="summary-section">
          <div className="summary-card">
            <div className="summary-header">
              <h3 className="summary-title">Today's Summary</h3>
              <div className="total-time">
                <span className="time-value">{formatSeconds(todayAdjustments.totalSecondsToday)}</span>
                <span className="time-label">Total Time</span>
              </div>
            </div>
            
            <div className="summary-content">
              <div className="summary-item">
                <div className="summary-icon">⏱️</div>
                <div className="summary-details">
                  <span className="summary-label">Regular Time</span>
                  <span className="summary-value">60 seconds</span>
                </div>
              </div>
              
              {todayAdjustments.hasOT && (
                <div className="summary-item positive">
                  <div className="summary-icon">🔼</div>
                  <div className="summary-details">
                    <span className="summary-label">Overtime</span>
                    <span className="summary-value">
                      +{todayAdjustments.otIntervals} intervals
                    </span>
                    <span className="summary-amount">
                      +Rs. {todayAdjustments.otAmount}
                      {staffSalary?.otRate && ` @ Rs. ${staffSalary.otRate}/hour`}
                    </span>
                  </div>
                </div>
              )}
              
              {todayAdjustments.hasShort && (
                <div className="summary-item negative">
                  <div className="summary-icon">🔽</div>
                  <div className="summary-details">
                    <span className="summary-label">Short Time</span>
                    <span className="summary-value">
                      -{todayAdjustments.shortIntervals} intervals
                    </span>
                    <span className="summary-amount">
                      -Rs. {todayAdjustments.shortAmount}
                    </span>
                  </div>
                </div>
              )}
              
              {!todayAdjustments.hasOT && !todayAdjustments.hasShort && todayAdjustments.totalSecondsToday > 0 && (
                <div className="summary-item perfect">
                  <div className="summary-icon">🎯</div>
                  <div className="summary-details">
                    <span className="summary-label">Perfect Timing!</span>
                    <span className="summary-value">No adjustments needed</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon primary">📊</div>
              <div className="stat-content">
                <div className="stat-value">{formatSeconds(todayAdjustments.totalSecondsToday)}</div>
                <div className="stat-label">Today's Time</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon secondary">🕒</div>
              <div className="stat-content">
                <div className="stat-value">{todaySessions.length}</div>
                <div className="stat-label">Sessions</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon accent">💰</div>
              <div className="stat-content">
                <div className="stat-value">
                  {todayAdjustments.hasOT ? '+' : todayAdjustments.hasShort ? '-' : '0'}
                </div>
                <div className="stat-label">Adjustment</div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Sessions */}
        <section className="sessions-section">
          <div className="section-header">
            <h3 className="section-title">Today's Sessions</h3>
            <div className="session-count-badge">
              <span>{todaySessions.length}</span>
            </div>
          </div>

          {todaySessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🕒</div>
              <h4 className="empty-title">No Sessions Today</h4>
              <p className="empty-description">Clock in to start your first session</p>
            </div>
          ) : (
            <div className="sessions-list">
              {todaySessions.map((session, index) => (
                <div key={session.id} className="session-card">
                  <div className="session-header">
                    <div className="session-info">
                      <h4 className="session-title">Session #{todaySessions.length - index}</h4>
                      <div className="session-meta">
                        <span className="session-date">{formatTime(session.clockIn)}</span>
                        {session.isNightShift && <span className="night-badge">🌙 Night</span>}
                        {session.crossMidnight && <span className="midnight-badge">⏰ Cross Midnight</span>}
                      </div>
                    </div>
                    <div className={`session-status ${session.status}`}>
                      {session.status}
                    </div>
                  </div>
                  
                  <div className="session-times">
                    <div className="time-entry">
                      <span className="time-label">Clock In</span>
                      <span className="time-value">{formatTime(session.clockIn)}</span>
                    </div>
                    
                    {session.clockOut && (
                      <div className="time-entry">
                        <span className="time-label">Clock Out</span>
                        <span className="time-value">{formatTime(session.clockOut)}</span>
                      </div>
                    )}
                  </div>

                  <div className="session-footer">
                    <span className="session-duration">
                      {session.clockOut 
                        ? formatDuration(session.duration)
                        : 'In Progress'
                      }
                    </span>
                    {session.otHours > 0 && (
                      <span className="ot-badge">
                        +{session.otHours.toFixed(1)}h OT
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Enhanced Bottom Navigation */}
      <nav className="bottom-navigation">
        <button 
          className={`nav-item ${isActiveRoute('/staff') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff')}
        >
          <div className="nav-icon">📊</div>
          <span className="nav-label">Dashboard</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/salary')}
        >
          <div className="nav-icon">💰</div>
          <span className="nav-label">Salary</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/advance') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/advance')}
        >
          <div className="nav-icon">📋</div>
          <span className="nav-label">Advance</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/availability')}
        >
          <div className="nav-icon">📅</div>
          <span className="nav-label">Schedule</span>
        </button>
        
        <button className="nav-item logout" onClick={handleLogout}>
          <div className="nav-icon">🚪</div>
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </div>
  );
}

// === Live Timer Component ===
function LiveTimer({ startTime }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const diff = currentTime - startTime;
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  
  return (
    <div className="live-timer">
      <div className="timer-digits">
        <span className="timer-digit">{String(h).padStart(2, "0")}</span>
        <span className="timer-separator">:</span>
        <span className="timer-digit">{String(m).padStart(2, "0")}</span>
        <span className="timer-separator">:</span>
        <span className="timer-digit">{String(s).padStart(2, "0")}</span>
      </div>
      <div className="timer-labels">
        <span>Hours</span>
        <span>Minutes</span>
        <span>Seconds</span>
      </div>
    </div>
  );
}

// Helper function for time-based greeting
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}