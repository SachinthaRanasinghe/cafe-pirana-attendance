import { useState, useEffect, useMemo, useCallback } from "react";
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
import { db } from "../firebase";
import "./AdvancedStaffDashboard.css";

export default function AdvancedStaffDashboard({ staffData, onLogout }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [weekSessions, setWeekSessions] = useState([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [totalHoursWeek, setTotalHoursWeek] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [loading, setLoading] = useState(false);
  const [breakMode, setBreakMode] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [totalBreaksToday, setTotalBreaksToday] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const { staffName, staffId, uid } = staffData;
  const hourlyRate = 15; // $15 per hour

  // Real-time listeners for today and week
  useEffect(() => {
    console.log("Setting up Firestore listeners for:", staffName);

    const today = new Date().toDateString();
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfWeekStr = startOfWeek.toDateString();

    // Today's sessions
    const qToday = query(
      collection(db, "sessions"),
      where("staffUid", "==", uid),
      where("date", "==", today),
      orderBy("clockIn", "desc")
    );

    // Week's sessions
    const qWeek = query(
      collection(db, "sessions"),
      where("staffUid", "==", uid),
      where("date", ">=", startOfWeekStr),
      orderBy("date", "desc"),
      orderBy("clockIn", "desc")
    );

    const unsubscribeToday = onSnapshot(
      qToday,
      (snapshot) => {
        const sessions = [];
        let totalHours = 0;
        let breakTime = 0;

        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          sessions.push(data);
          if (data.clockOut && data.duration) {
            totalHours += data.duration / (1000 * 60 * 60);
          }
          if (data.breakDuration) {
            breakTime += data.breakDuration / (1000 * 60 * 60);
          }
        });

        setTodaySessions(sessions);
        setTotalHoursToday(totalHours);
        setTotalBreaksToday(breakTime);

        // Check for active session
        const activeSession = sessions.find((s) => !s.clockOut);
        if (activeSession) {
          setIsClockedIn(true);
          setCurrentSession(activeSession);
          setBreakMode(activeSession.onBreak || false);
          if (activeSession.breakStart) {
            setBreakStartTime(new Date(activeSession.breakStart));
          }
        } else {
          setIsClockedIn(false);
          setCurrentSession(null);
          setBreakMode(false);
          setBreakStartTime(null);
        }
      },
      (error) => {
        console.error("Firestore error:", error);
        showNotification("❌ Error loading today's data", "error");
      }
    );

    const unsubscribeWeek = onSnapshot(
      qWeek,
      (snapshot) => {
        const sessions = [];
        let totalHours = 0;

        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          sessions.push(data);
          if (data.clockOut && data.duration) {
            totalHours += data.duration / (1000 * 60 * 60);
          }
        });

        setWeekSessions(sessions);
        setTotalHoursWeek(totalHours);
        setWeeklyEarnings(totalHours * hourlyRate);
      },
      (error) => {
        console.error("Firestore error:", error);
        showNotification("❌ Error loading weekly data", "error");
      }
    );

    return () => {
      unsubscribeToday();
      unsubscribeWeek();
    };
  }, [uid, staffName]);

  // Clock In
  const clockIn = async () => {
    setLoading(true);
    const clockInTime = new Date();

    const session = {
      staffUid: uid,
      staffId: staffId,
      staffName: staffName,
      clockIn: clockInTime.toISOString(),
      clockOut: null,
      duration: 0,
      breakDuration: 0,
      onBreak: false,
      date: new Date().toDateString(),
      status: "active",
      timestamp: new Date().toISOString(),
    };

    try {
      const docRef = await addDoc(collection(db, "sessions"), session);
      setCurrentSession({ id: docRef.id, ...session });
      setIsClockedIn(true);
      showNotification(`🟢 Clocked in at ${formatTime(clockInTime)}`, "success");
    } catch (error) {
      console.error("Error clocking in:", error);
      showNotification("❌ Error clocking in: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Clock Out
  const clockOut = async () => {
    if (!currentSession) return;
    setLoading(true);

    const clockOutTime = new Date();
    const clockInTime = new Date(currentSession.clockIn);
    let duration = clockOutTime - clockInTime;

    // Subtract break time if any
    if (currentSession.breakDuration) {
      duration -= currentSession.breakDuration;
    }

    try {
      const sessionRef = doc(db, "sessions", currentSession.id);
      await updateDoc(sessionRef, {
        clockOut: clockOutTime.toISOString(),
        duration: duration,
        totalHours: duration / (1000 * 60 * 60),
        status: "completed",
        onBreak: false,
      });

      setIsClockedIn(false);
      setCurrentSession(null);
      setBreakMode(false);
      setBreakStartTime(null);
      
      showNotification(
        `🔴 Clocked out - Worked ${formatDuration(duration)}`, 
        "info"
      );
    } catch (error) {
      console.error("Error clocking out:", error);
      showNotification("❌ Error clocking out: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Break functions
  const startBreak = async () => {
    if (!currentSession || breakMode) return;

    const breakStart = new Date();
    setBreakMode(true);
    setBreakStartTime(breakStart);

    try {
      const sessionRef = doc(db, "sessions", currentSession.id);
      await updateDoc(sessionRef, {
        onBreak: true,
        breakStart: breakStart.toISOString(),
      });
      showNotification("☕ Break started", "info");
    } catch (error) {
      console.error("Error starting break:", error);
      showNotification("❌ Error starting break", "error");
    }
  };

  const endBreak = async () => {
    if (!currentSession || !breakMode || !breakStartTime) return;

    const breakEnd = new Date();
    const breakDuration = breakEnd - breakStartTime;
    const totalBreakDuration = (currentSession.breakDuration || 0) + breakDuration;

    setBreakMode(false);
    setBreakStartTime(null);

    try {
      const sessionRef = doc(db, "sessions", currentSession.id);
      await updateDoc(sessionRef, {
        onBreak: false,
        breakStart: null,
        breakDuration: totalBreakDuration,
      });
      showNotification(`✅ Break ended - ${formatDuration(breakDuration)}`, "success");
    } catch (error) {
      console.error("Error ending break:", error);
      showNotification("❌ Error ending break", "error");
    }
  };

  // Notification system
  const showNotification = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // Stats calculations
  const todayStats = useMemo(() => {
    const completedSessions = todaySessions.filter(s => s.clockOut);
    const avgSessionDuration = completedSessions.length > 0 ?
      completedSessions.reduce((sum, session) => sum + (session.duration / (1000 * 60 * 60)), 0) / completedSessions.length : 0;

    return {
      sessionsCount: todaySessions.length,
      completedSessions: completedSessions.length,
      avgSessionDuration,
      earnings: totalHoursToday * hourlyRate,
      breakTime: totalBreaksToday
    };
  }, [todaySessions, totalHoursToday, totalBreaksToday]);

  const weekStats = useMemo(() => {
    const daysWorked = new Set(weekSessions.map(s => s.date)).size;
    const avgDailyHours = daysWorked > 0 ? totalHoursWeek / daysWorked : 0;

    return {
      daysWorked,
      avgDailyHours,
      totalEarnings: weeklyEarnings,
      projectedWeekly: avgDailyHours * 7 * hourlyRate
    };
  }, [weekSessions, totalHoursWeek, weeklyEarnings]);

  const handleLogout = () => {
    if (isClockedIn) {
      const confirmLogout = window.confirm(
        "⏰ You are currently clocked in! Logging out will end your active session. Continue?"
      );
      if (!confirmLogout) return;
      clockOut();
    }
    setTimeout(() => {
      if (onLogout) onLogout();
    }, 1000);
  };

  return (
    <div className="advanced-staff-dashboard">
      {/* Notifications */}
      <div className="notifications-panel">
        {notifications.map(notif => (
          <div key={notif.id} className={`notification ${notif.type}`}>
            <span>{notif.message}</span>
            <button onClick={() => removeNotification(notif.id)}>×</button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="dashboard-header">
        <div className="staff-info">
          <h1>Welcome back, {staffName}! 👋</h1>
          <div className="staff-details">
            <div className="detail-item">
              <strong>Staff ID:</strong> {staffId}
            </div>
            <div className="detail-item">
              <strong>Date:</strong> {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            <div className="detail-item">
              <strong>Hourly Rate:</strong> ${hourlyRate}/hour
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <div className={`status-badge ${isClockedIn ? "clocked-in" : "clocked-out"}`}>
            {isClockedIn ? 
              (breakMode ? "🟡 ON BREAK" : "🟢 CLOCKED IN") : 
              "🔴 CLOCKED OUT"
            }
          </div>
          <button 
            className="logout-btn" 
            onClick={handleLogout} 
            disabled={loading}
          >
            {loading ? "⏳" : "🚪"} Logout
          </button>
        </div>
      </div>

      {/* Current Session & Timer */}
      {isClockedIn && currentSession && (
        <div className="current-session-panel">
          <div className="timer-card">
            <div className="timer-header">
              <h3>⏱️ Active Session</h3>
              {breakMode && <span className="break-badge">ON BREAK</span>}
            </div>
            
            <div className="timer-display">
              <LiveTimer 
                startTime={new Date(currentSession.clockIn)} 
                breakMode={breakMode}
                breakStartTime={breakStartTime}
              />
            </div>
            
            <div className="session-info-grid">
              <div className="info-item">
                <label>Clock In:</label>
                <span>{formatTime(currentSession.clockIn)}</span>
              </div>
              <div className="info-item">
                <label>Active Time:</label>
                <span>{formatDuration(new Date() - new Date(currentSession.clockIn))}</span>
              </div>
              <div className="info-item">
                <label>Break Time:</label>
                <span>{formatDuration(currentSession.breakDuration || 0)}</span>
              </div>
              <div className="info-item">
                <label>Earnings:</label>
                <span>${calculateEarnings(currentSession).toFixed(2)}</span>
              </div>
            </div>

            {/* Break Controls */}
            <div className="break-controls">
              {!breakMode ? (
                <button 
                  className="break-btn start"
                  onClick={startBreak}
                  disabled={loading}
                >
                  ☕ Start Break
                </button>
              ) : (
                <button 
                  className="break-btn end"
                  onClick={endBreak}
                  disabled={loading}
                >
                  ✅ End Break
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="actions-section">
        <div className="action-buttons">
          {!isClockedIn ? (
            <button 
              className="clock-in-btn" 
              onClick={clockIn} 
              disabled={loading}
            >
              {loading ? "⏳" : "📍"} Clock In
            </button>
          ) : (
            <button 
              className="clock-out-btn" 
              onClick={clockOut} 
              disabled={loading || breakMode}
            >
              {loading ? "⏳" : "🏁"} Clock Out
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card today">
          <div className="card-icon">📅</div>
          <div className="card-content">
            <h3>Today</h3>
            <p className="card-value">{totalHoursToday.toFixed(2)}h</p>
            <p className="card-subtext">${todayStats.earnings.toFixed(2)}</p>
            <p className="card-meta">{todayStats.sessionsCount} sessions</p>
          </div>
        </div>

        <div className="summary-card week">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>This Week</h3>
            <p className="card-value">{totalHoursWeek.toFixed(2)}h</p>
            <p className="card-subtext">${weeklyEarnings.toFixed(2)}</p>
            <p className="card-meta">{weekStats.daysWorked} days worked</p>
          </div>
        </div>

        <div className="summary-card breaks">
          <div className="card-icon">☕</div>
          <div className="card-content">
            <h3>Breaks</h3>
            <p className="card-value">{formatDuration(totalBreaksToday * 1000 * 60 * 60)}</p>
            <p className="card-subtext">Today</p>
            <p className="card-meta">{breakMode ? "On break" : "No active breaks"}</p>
          </div>
        </div>

        <div className="summary-card efficiency">
          <div className="card-icon">⚡</div>
          <div className="card-content">
            <h3>Efficiency</h3>
            <p className="card-value">
              {todayStats.avgSessionDuration > 0 ? todayStats.avgSessionDuration.toFixed(1) : "0"}h
            </p>
            <p className="card-subtext">Avg. Session</p>
            <p className="card-meta">
              {todayStats.completedSessions > 0 ? "Good" : "No data"}
            </p>
          </div>
        </div>
      </div>

      {/* Today's Sessions */}
      <div className="sessions-section">
        <div className="section-header">
          <h3>📋 Today's Work Sessions</h3>
          <div className="session-stats">
            <span>{todaySessions.length} sessions</span>
            <span>•</span>
            <span>{totalHoursToday.toFixed(2)} hours</span>
            <span>•</span>
            <span>${todayStats.earnings.toFixed(2)}</span>
          </div>
        </div>

        {todaySessions.length === 0 ? (
          <div className="no-sessions">
            <div className="no-sessions-icon">⏰</div>
            <p>No work sessions recorded today</p>
            <p>Clock in to start tracking your time!</p>
          </div>
        ) : (
          <div className="sessions-list">
            {todaySessions.map((session, index) => (
              <SessionCard 
                key={session.id} 
                session={session} 
                index={index}
                hourlyRate={hourlyRate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Weekly Overview */}
      <div className="weekly-section">
        <h3>📈 Weekly Overview</h3>
        <div className="weekly-stats">
          <div className="weekly-stat">
            <label>Total Hours</label>
            <value>{totalHoursWeek.toFixed(1)}h</value>
          </div>
          <div className="weekly-stat">
            <label>Days Worked</label>
            <value>{weekStats.daysWorked}</value>
          </div>
          <div className="weekly-stat">
            <label>Total Earnings</label>
            <value>${weeklyEarnings.toFixed(2)}</value>
          </div>
          <div className="weekly-stat">
            <label>Avg. Daily</label>
            <value>{weekStats.avgDailyHours.toFixed(1)}h</value>
          </div>
        </div>
        
        <div className="weekly-chart">
          <WeeklyChart sessions={weekSessions} />
        </div>
      </div>
    </div>
  );
}

// Session Card Component
function SessionCard({ session, index, hourlyRate }) {
  const isActive = !session.clockOut;
  const duration = session.clockOut ? session.duration : (new Date() - new Date(session.clockIn));
  const earnings = (duration / (1000 * 60 * 60)) * hourlyRate;
  const breakTime = session.breakDuration || 0;

  return (
    <div className={`session-card ${isActive ? 'active' : ''}`}>
      <div className="session-header">
        <div className="session-number">Session #{index + 1}</div>
        <div className="session-status">
          {isActive ? (
            <span className="status-badge active">🟢 Active</span>
          ) : (
            <span className="status-badge completed">✅ Completed</span>
          )}
        </div>
      </div>
      
      <div className="session-timeline">
        <div className="time-block">
          <span className="time-label">Clock In</span>
          <span className="time-value">{formatTime(session.clockIn)}</span>
        </div>
        
        <div className="time-arrow">→</div>
        
        <div className="time-block">
          <span className="time-label">Clock Out</span>
          <span className="time-value">
            {session.clockOut ? formatTime(session.clockOut) : '—'}
          </span>
        </div>
      </div>

      <div className="session-metrics">
        <div className="metric">
          <span className="metric-label">Duration</span>
          <span className="metric-value">
            {session.clockOut ? (
              formatDuration(session.duration)
            ) : (
              <LiveTimer startTime={new Date(session.clockIn)} />
            )}
          </span>
        </div>
        
        {breakTime > 0 && (
          <div className="metric">
            <span className="metric-label">Break Time</span>
            <span className="metric-value">{formatDuration(breakTime)}</span>
          </div>
        )}
        
        <div className="metric">
          <span className="metric-label">Earnings</span>
          <span className="metric-value earnings">${earnings.toFixed(2)}</span>
        </div>
      </div>

      {session.onBreak && (
        <div className="break-indicator">
          ☕ Currently on break
        </div>
      )}
    </div>
  );
}

// Weekly Chart Component
function WeeklyChart({ sessions }) {
  const weekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.map(day => ({ day, hours: 0, earnings: 0 }));
    
    sessions.forEach(session => {
      if (session.clockOut) {
        const dayIndex = new Date(session.date).getDay();
        const hours = session.duration / (1000 * 60 * 60);
        data[dayIndex].hours += hours;
        data[dayIndex].earnings += hours * 15;
      }
    });
    
    return data;
  }, [sessions]);

  return (
    <div className="simple-bar-chart">
      {weekData.map((dayData, index) => (
        <div key={index} className="chart-bar-container">
          <div className="chart-bar-label">{dayData.day}</div>
          <div className="chart-bar">
            <div 
              className="chart-bar-fill"
              style={{ height: `${Math.min(100, (dayData.hours / 8) * 100)}%` }}
            ></div>
          </div>
          <div className="chart-bar-value">
            {dayData.hours > 0 ? dayData.hours.toFixed(1) + 'h' : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// Enhanced Live Timer Component
function LiveTimer({ startTime, breakMode = false, breakStartTime = null }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  let displayTime = currentTime - startTime;
  
  // Subtract break time if on break
  if (breakMode && breakStartTime) {
    const breakTime = currentTime - breakStartTime;
    displayTime -= breakTime;
  }
  
  const hours = Math.floor(displayTime / (1000 * 60 * 60));
  const minutes = Math.floor((displayTime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((displayTime % (1000 * 60)) / 1000);
  
  return (
    <div className={`live-timer ${breakMode ? 'on-break' : ''}`}>
      {String(hours).padStart(2, "0")}:
      {String(minutes).padStart(2, "0")}:
      {String(seconds).padStart(2, "0")}
      {breakMode && <span className="break-indicator">⏸️</span>}
    </div>
  );
}

// Utility functions
function formatTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function calculateEarnings(session) {
  if (!session.clockOut) {
    const duration = new Date() - new Date(session.clockIn);
    const breakTime = session.breakDuration || 0;
    return ((duration - breakTime) / (1000 * 60 * 60)) * 15;
  }
  return (session.totalHours || 0) * 15;
}