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
import { db } from "../firebase";
import "./StaffDashboard.css";

export default function StaffDashboard({ staffData, onLogout }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [loading, setLoading] = useState(false);

  // Destructure staff data from props
  const { staffName, staffId, uid } = staffData;

  // === Real-time Firestore listener for this staff ===
  useEffect(() => {
    console.log("Setting up Firestore listener for:", staffName, "UID:", uid);

    const today = new Date().toDateString();
    const q = query(
      collection(db, "sessions"),
      where("staffUid", "==", uid),
      where("date", "==", today),
      orderBy("clockIn", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessions = [];
        let totalHours = 0;

        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          sessions.push(data);
          if (data.clockOut && data.duration) {
            totalHours += data.duration / (1000 * 60 * 60); // ms → hours
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
        alert("Error connecting to database: " + error.message);
      }
    );

    return () => unsubscribe();
  }, [uid, staffName]);

  // === Clock In ===
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

  // === Clock Out ===
  const clockOut = async () => {
    if (!currentSession) return;
    setLoading(true);

    const clockOutTime = new Date();
    const clockInTime = new Date(currentSession.clockIn);
    const duration = clockOutTime - clockInTime;

    try {
      const sessionRef = doc(db, "sessions", currentSession.id);
      await updateDoc(sessionRef, {
        clockOut: clockOutTime.toISOString(),
        duration: duration,
        totalHours: duration / (1000 * 60 * 60),
        status: "completed",
      });

      setIsClockedIn(false);
      setCurrentSession(null);
      showNotification(`🔴 Clocked out - Worked ${formatDuration(duration)}`, "info");
    } catch (error) {
      console.error("Error clocking out:", error);
      showNotification("❌ Error clocking out: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // === Helpers ===
  const showNotification = (msg) => alert(msg);

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
        "⏰ You are currently clocked in! Logging out will end your active session. Continue?"
      );
      if (!confirmLogout) return;
      clockOut();
    }
    if (onLogout) onLogout();
  };

  const clearTodayData = () => {
    const confirmClear = window.confirm(
      "🗑️ Clear all today's data?\nThis will remove all your sessions for today (locally only)."
    );
    if (confirmClear) {
      setTodaySessions([]);
      setTotalHoursToday(0);
      showNotification("Today's data cleared locally", "info");
    }
  };

  // === UI ===
  return (
    <div className="staff-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="staff-info">
          <h1>Welcome, {staffName}! 👋</h1>
          <div className="staff-details">
            <p>
              <strong>Staff ID:</strong> {staffId}
            </p>
            <p>
              <strong>Date:</strong> {new Date().toDateString()}
            </p>
            <p>
              <strong>Status:</strong> {isClockedIn ? "Clocked In" : "Clocked Out"}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <div className={`status-badge ${isClockedIn ? "clocked-in" : "clocked-out"}`}>
            {isClockedIn ? "🟢 CLOCKED IN" : "🔴 CLOCKED OUT"}
          </div>
          <button className="logout-btn" onClick={handleLogout} disabled={loading}>
            {loading ? "⏳" : "🚪"} Logout
          </button>
        </div>
      </div>

      {/* Active Session */}
      {isClockedIn && currentSession && (
        <div className="current-session">
          <div className="timer-card">
            <h3>⏱️ Active Session</h3>
            <div className="timer-display">
              <LiveTimer startTime={new Date(currentSession.clockIn)} />
            </div>
            <div className="session-info">
              <p>
                <strong>Clock In:</strong> {formatTime(currentSession.clockIn)}
              </p>
              <p>
                <strong>Current Duration:</strong>{" "}
                {formatDuration(new Date() - new Date(currentSession.clockIn))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clock In / Out Buttons */}
      <div className="actions-section">
        <div className="action-buttons">
          {!isClockedIn ? (
            <button className="clock-in-btn" onClick={clockIn} disabled={loading}>
              {loading ? "⏳" : "📍"} Clock In
            </button>
          ) : (
            <button className="clock-out-btn" onClick={clockOut} disabled={loading}>
              {loading ? "⏳" : "🏁"} Clock Out
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">🕒</div>
          <div className="card-content">
            <h3>Total Hours</h3>
            <p className="card-value">{totalHoursToday.toFixed(2)}h</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>Today's Sessions</h3>
            <p className="card-value">{todaySessions.length}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <h3>Status</h3>
            <p className="card-value">{isClockedIn ? "Working" : "Offline"}</p>
          </div>
        </div>
      </div>

      {/* Today's Sessions */}
      <div className="sessions-section">
        <div className="section-header">
          <h3>📋 Today's Work Sessions</h3>
          {todaySessions.length > 0 && (
            <button className="clear-btn" onClick={clearTodayData}>
              🗑️ Clear Today
            </button>
          )}
        </div>

        {todaySessions.length === 0 ? (
          <div className="no-sessions">
            <div className="no-sessions-icon">⏰</div>
            <p>No work sessions recorded today</p>
            <p>Clock in to start tracking your time!</p>
          </div>
        ) : (
          <div className="sessions-list">
            {todaySessions.map((session, i) => (
              <div
                key={session.id}
                className={`session-item ${!session.clockOut ? "active-session" : ""}`}
              >
                <div className="session-number">#{i + 1}</div>
                <div className="session-details">
                  <div className="session-times">
                    <span className="time-in">🟢 {formatTime(session.clockIn)}</span>
                    <span className="time-separator">→</span>
                    <span className="time-out">
                      {session.clockOut
                        ? `🔴 ${formatTime(session.clockOut)}`
                        : "🟢 Active"}
                    </span>
                  </div>
                  <div className="session-date">
                    {session.clockOut ? "Completed" : "In Progress"}
                  </div>
                </div>
                <div className="session-duration">
                  {session.clockOut ? (
                    formatDuration(session.duration)
                  ) : (
                    <LiveTimer startTime={new Date(session.clockIn)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
      {String(s).padStart(2, "0")}
    </div>
  );
}
