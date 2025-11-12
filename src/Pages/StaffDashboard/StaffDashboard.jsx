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

export default function StaffDashboard({ staffData, onLogout }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Location verification states
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationAllowed, setLocationAllowed] = useState(null);
  const [userCoords, setUserCoords] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Destructure staff data from props
  const { staffName, staffId, uid } = staffData;

  // Allowed location (Cafe Piranha - Ella)
  const ALLOWED_LAT = 6.844030;  
  const ALLOWED_LNG = 81.005913;
  const MAX_DISTANCE_METERS = 500;

  // Helper functions for shift-based tracking
  const getShiftDate = (timestamp) => {
    const date = new Date(timestamp);
    // Consider shifts starting after 6 PM as part of the next day's schedule
    if (date.getHours() >= 18) { // 6 PM
      date.setDate(date.getDate() + 1);
    }
    return date.toDateString();
  };

  const getShiftMonth = (timestamp) => {
    const date = new Date(timestamp);
    if (date.getHours() >= 18) { // 6 PM
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().substring(0, 7); // YYYY-MM
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
    return R * c; // meters
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

  // === Calculate OT Hours with shift support - FIXED VERSION ===
  const calculateShiftOTHours = (clockIn, clockOut) => {
    try {
      const clockInTime = new Date(clockIn);
      const clockOutTime = new Date(clockOut);
      
      // Ensure valid dates
      if (isNaN(clockInTime.getTime()) || isNaN(clockOutTime.getTime())) {
        throw new Error("Invalid date values");
      }

      const hoursWorked = (clockOutTime - clockInTime) / (1000 * 60 * 60);
      
      // Ensure hoursWorked is a valid number
      if (isNaN(hoursWorked) || !isFinite(hoursWorked)) {
        throw new Error("Invalid hours calculation");
      }

      const regularHours = Math.min(Math.max(0, hoursWorked), 12); // Ensure between 0-12
      const otHours = Math.max(hoursWorked - 12, 0);
      const otAmount = otHours * 200; // 200 Rs per OT hour
      
      return {
        hoursWorked,
        regularHours,
        otHours,
        otAmount,
        hasOT: otHours > 0,
        isNightShift: clockInTime.getHours() >= 18 // 6 PM or later
      };
    } catch (error) {
      console.error("Error calculating OT hours:", error);
      // Return safe fallback values
      return {
        hoursWorked: 0,
        regularHours: 0,
        otHours: 0,
        otAmount: 0,
        hasOT: false,
        isNightShift: false
      };
    }
  };

  // === Real-time Firestore listener for this staff with shift-based tracking ===
  useEffect(() => {
    console.log("Setting up Firestore listener for:", staffName, "UID:", uid);

    // Get sessions from yesterday 6 PM to today 6 PM
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
          
          // Only include sessions within our shift period
          if (new Date(data.clockIn) >= startOfShiftPeriod) {
            sessions.push(data);
            if (data.clockOut && data.duration) {
              totalHours += data.duration / (1000 * 60 * 60);
            }
          }
        });

        setTodaySessions(sessions);
        setTotalHoursToday(totalHours);

        // Check for active session
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

  // === Clock In with Location Verification and Shift Tracking ===
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
        date: new Date().toDateString(), // Keep original date for reference
        shiftDate: getShiftDate(clockInTime), // Use shift-based date
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
        month: new Date().toISOString().substring(0, 7), // Original month
        shiftMonth: getShiftMonth(clockInTime), // Shift-based month for salary
        isNightShift: clockInTime.getHours() >= 18 // Flag for night shifts
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

  // === Clock Out with Location Verification and OT Calculation - FIXED VERSION ===
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

      const otCalculation = calculateShiftOTHours(currentSession.clockIn, clockOutTime);

      // Ensure all values are defined and have fallbacks
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
        regularHours: otCalculation.regularHours || 0,
        otHours: otCalculation.otHours || 0,
        otAmount: otCalculation.otAmount || 0,
        otStatus: otCalculation.hasOT ? "pending" : "none",
        isNightShift: otCalculation.isNightShift || false,
        crossMidnight: clockInTime.toDateString() !== clockOutTime.toDateString()
      };

      const sessionRef = doc(db, "sessions", currentSession.id);
      await updateDoc(sessionRef, updateData);

      if (otCalculation.hasOT) {
        await createOTRequest(otCalculation, currentSession.id);
      }

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

  // === Create OT Request with Shift Tracking - FIXED VERSION ===
  const createOTRequest = async (otCalculation, sessionId) => {
    try {
      const clockInTime = new Date(currentSession.clockIn);
      const otRequest = {
        staffUid: uid,
        staffName: staffName,
        staffId: staffId,
        sessionId: sessionId,
        date: new Date().toDateString(),
        shiftDate: getShiftDate(clockInTime),
        regularHours: otCalculation.regularHours || 0,
        otHours: otCalculation.otHours || 0,
        otAmount: otCalculation.otAmount || 0,
        status: "pending",
        requestedAt: new Date().toISOString(),
        month: new Date().toISOString().substring(0, 7),
        shiftMonth: getShiftMonth(clockInTime),
        isNightShift: otCalculation.isNightShift || false,
        crossMidnight: new Date(currentSession.clockIn).toDateString() !== new Date().toDateString()
      };

      await addDoc(collection(db, "otRequests"), otRequest);
      console.log("OT request created:", otRequest);
    } catch (error) {
      console.error("Error creating OT request:", error);
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
    // In a real app, you'd use a proper notification system
    const styles = {
      success: "background: #4CAF50; color: white; padding: 12px; border-radius: 4px;",
      error: "background: #f44336; color: white; padding: 12px; border-radius: 4px;",
      info: "background: #2196F3; color: white; padding: 12px; border-radius: 4px;"
    };
    console.log(`%c${msg}`, styles[type] || styles.info);
    alert(msg); // Fallback
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
    return `${hours}h ${minutes}m`;
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

  return (
    <div className="staff-dashboard">
      {/* Navigation Header */}
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <div className="brand-icon">🏪</div>
          <div className="brand-text">
            <h2>Cafe Piranha</h2>
            <span>Staff Portal</span>
          </div>
        </div>
        
        <div className="nav-user">
          <div className="user-avatar">
            {staffName.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{staffName}</span>
            <span className="user-id">ID: {staffId}</span>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <div className="dashboard-container">
        {/* Main Content Area */}
        <main className="dashboard-main">
          {/* Welcome Header */}
          <div className="welcome-header">
            <div className="welcome-text">
              <h1>Welcome back, {staffName}!</h1>
              <p>Here's your work summary for today</p>
            </div>
            <div className="date-display">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>

          {/* Clock Section */}
          <div className="clock-card">
            <div className="clock-header">
              <h2>Time Tracking</h2>
              <div className={`status-badge ${isClockedIn ? 'active' : 'inactive'}`}>
                <div className="status-dot"></div>
                {isClockedIn ? 'Currently Clocked In' : 'Currently Clocked Out'}
              </div>
            </div>
            
            <div className="clock-content">
              {isClockedIn && currentSession && (
                <div className="active-session">
                  <div className="session-timer">
                    <LiveTimer startTime={new Date(currentSession.clockIn)} />
                  </div>
                  <p>Started at {formatTime(currentSession.clockIn)}</p>
                  {currentSession.isNightShift && (
                    <div className="night-shift-badge">🌙 Night Shift</div>
                  )}
                </div>
              )}
              
              <div className="clock-actions">
                {!isClockedIn ? (
                  <button 
                    className="btn-primary clock-in-btn"
                    onClick={clockIn}
                    disabled={loading || checkingLocation}
                  >
                    <span className="btn-icon">🟢</span>
                    {loading ? 'Processing...' : 'Clock In'}
                  </button>
                ) : (
                  <button 
                    className="btn-secondary clock-out-btn"
                    onClick={clockOut}
                    disabled={loading || checkingLocation}
                  >
                    <span className="btn-icon">🔴</span>
                    {loading ? 'Processing...' : 'Clock Out'}
                  </button>
                )}
                
                <button 
                  className="btn-outline location-btn"
                  onClick={checkLocationManually}
                  disabled={checkingLocation}
                >
                  <span className="btn-icon">📍</span>
                  {checkingLocation ? 'Checking Location...' : 'Verify Location'}
                </button>
              </div>

              {/* Location Status */}
              {locationMessage && (
                <div className={`location-status ${locationAllowed ? 'success' : locationAllowed === false ? 'error' : 'info'}`}>
                  <div className="location-status-icon">
                    {locationAllowed ? '✅' : locationAllowed === false ? '❌' : '📍'}
                  </div>
                  <span>{locationMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon primary">⏱️</div>
              <div className="stat-content">
                <h3>{totalHoursToday.toFixed(2)}h</h3>
                <p>Total Hours Today</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon secondary">📅</div>
              <div className="stat-content">
                <h3>{todaySessions.length}</h3>
                <p>Today's Sessions</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon accent">⚡</div>
              <div className="stat-content">
                <h3>
                  {todaySessions.filter(s => s.otHours > 0).length}
                </h3>
                <p>OT Sessions</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon warning">🌙</div>
              <div className="stat-content">
                <h3>
                  {todaySessions.filter(s => s.isNightShift).length}
                </h3>
                <p>Night Shifts</p>
              </div>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="sessions-card">
            <div className="card-header">
              <h2>Today's Sessions</h2>
              <span className="badge">{todaySessions.length}</span>
            </div>
            
            {todaySessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🕒</div>
                <h3>No sessions today</h3>
                <p>Your work sessions will appear here after clocking in</p>
              </div>
            ) : (
              <div className="sessions-list">
                {todaySessions.map((session, index) => (
                  <div key={session.id} className="session-item">
                    <div className="session-number">#{todaySessions.length - index}</div>
                    
                    <div className="session-times">
                      <div className="time-block">
                        <span className="time-label">IN</span>
                        <span className="time-value">
                          {formatTime(session.clockIn)}
                          {session.isNightShift && " 🌙"}
                        </span>
                      </div>
                      
                      {session.clockOut && (
                        <>
                          <div className="time-arrow">→</div>
                          <div className="time-block">
                            <span className="time-label">OUT</span>
                            <span className="time-value">
                              {formatTime(session.clockOut)}
                              {session.crossMidnight && " ⏰"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="session-meta">
                      <div className={`session-status ${session.status}`}>
                        {session.status}
                        {session.crossMidnight && " 🌙"}
                      </div>
                      <div className="session-duration">
                        {session.clockOut 
                          ? formatDuration(session.duration)
                          : 'In Progress'
                        }
                      </div>
                      {session.otHours > 0 && (
                        <div className="ot-badge">
                          +{session.otHours.toFixed(1)}h OT
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bottom Navigation Bar - Fixed at bottom */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${isActiveRoute('/staff') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-text">Dashboard</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/salary')}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-text">Salary</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/advance') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/advance')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-text">Advance</span>
        </button>
        
        {/* ADDED AVAILABILITY BUTTON */}
        <button 
          className={`nav-item ${isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-text">Availability</span>
        </button>
        
        <button className="nav-item logout-item" onClick={handleLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-text">Logout</span>
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
      <span className="timer-hours">{String(h).padStart(2, "0")}</span>
      <span className="timer-separator">:</span>
      <span className="timer-minutes">{String(m).padStart(2, "0")}</span>
      <span className="timer-separator">:</span>
      <span className="timer-seconds">{String(s).padStart(2, "0")}</span>
    </div>
  );
}