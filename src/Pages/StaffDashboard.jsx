import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import "./StaffDashboard.css";

export default function StaffDashboard({ staffName, onLogout }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);

  // Generate staff ID
  const staffId = `CP${staffName.replace(/\s+/g, '').toUpperCase().substr(0, 3)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Real-time listener for today's sessions
  useEffect(() => {
    const today = new Date().toDateString();
    const q = query(
      collection(db, 'sessions'),
      where('staffId', '==', staffId),
      where('date', '==', today),
      orderBy('clockIn', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = [];
      let totalHours = 0;
      
      snapshot.forEach((doc) => {
        const sessionData = { id: doc.id, ...doc.data() };
        sessions.push(sessionData);
        
        // Calculate total hours from completed sessions
        if (sessionData.clockOut) {
          totalHours += sessionData.totalHours || 0;
        }
      });
      
      setTodaySessions(sessions);
      setTotalHoursToday(totalHours);
      
      // Check for active session
      const activeSession = sessions.find(session => !session.clockOut);
      if (activeSession) {
        setIsClockedIn(true);
        setCurrentSession(activeSession);
      } else {
        setIsClockedIn(false);
        setCurrentSession(null);
      }
    });

    return () => unsubscribe();
  }, [staffId]);

  const clockIn = async () => {
    const clockInTime = new Date();
    const session = {
      staffId: staffId,
      staffName: staffName,
      clockIn: clockInTime.toISOString(),
      clockOut: null,
      duration: 0,
      date: new Date().toDateString(),
      status: 'active',
      timestamp: new Date().toISOString()
    };
    
    try {
      const docRef = await addDoc(collection(db, 'sessions'), session);
      setCurrentSession({ id: docRef.id, ...session });
      setIsClockedIn(true);
      showNotification(`🟢 Clocked in at ${formatTime(clockInTime)}`, 'success');
    } catch (error) {
      console.error('Error clocking in:', error);
      showNotification('❌ Error clocking in', 'error');
    }
  };

  const clockOut = async () => {
    if (!currentSession) return;
    
    const clockOutTime = new Date();
    const clockInTime = new Date(currentSession.clockIn);
    const duration = clockOutTime - clockInTime;
    
    try {
      const sessionRef = doc(db, 'sessions', currentSession.id);
      await updateDoc(sessionRef, {
        clockOut: clockOutTime.toISOString(),
        duration: duration,
        totalHours: duration / (1000 * 60 * 60),
        status: 'completed'
      });
      
      setIsClockedIn(false);
      setCurrentSession(null);
      showNotification(`🔴 Clocked out - Session: ${formatDuration(duration)}`, 'info');
    } catch (error) {
      console.error('Error clocking out:', error);
      showNotification('❌ Error clocking out', 'error');
    }
  };

  const showNotification = (message, type) => {
    alert(message); // Simple alert for now
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleLogout = () => {
    if (isClockedIn) {
      const shouldLogout = window.confirm(
        "⏰ You are currently clocked in! If you logout, your current session will be ended. Continue?"
      );
      if (!shouldLogout) return;
      clockOut();
    }
    if (onLogout) onLogout();
  };

  return (
    <div className="staff-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="staff-info">
          <h1>Welcome, {staffName}! 👋</h1>
          <div className="staff-details">
            <p><strong>Staff ID:</strong> {staffId}</p>
            <p><strong>Date:</strong> {new Date().toDateString()}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className={`status-badge ${isClockedIn ? 'clocked-in' : 'clocked-out'}`}>
            {isClockedIn ? '🟢 CLOCKED IN' : '🔴 CLOCKED OUT'}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Current Session Timer */}
      {isClockedIn && currentSession && (
        <div className="current-session">
          <div className="timer-card">
            <h3>⏱️ Active Session</h3>
            <div className="timer-display">
              <LiveTimer startTime={new Date(currentSession.clockIn)} />
            </div>
            <div className="session-info">
              <p><strong>Clock In:</strong> {formatTime(currentSession.clockIn)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Clock In/Out Buttons */}
      <div className="actions-section">
        <div className="action-buttons">
          {!isClockedIn ? (
            <button className="clock-in-btn" onClick={clockIn}>
              📍 Clock In
            </button>
          ) : (
            <button className="clock-out-btn" onClick={clockOut}>
              🏁 Clock Out
            </button>
          )}
        </div>
      </div>

      {/* Today's Summary */}
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
      </div>

      {/* Today's Sessions */}
      <div className="sessions-section">
        <h3>📋 Today's Sessions</h3>
        {todaySessions.length === 0 ? (
          <div className="no-sessions">
            <p>No sessions recorded today</p>
          </div>
        ) : (
          <div className="sessions-list">
            {todaySessions.map((session, index) => (
              <div key={session.id} className="session-item">
                <div className="session-number">#{index + 1}</div>
                <div className="session-details">
                  <p><strong>In:</strong> {formatTime(session.clockIn)}</p>
                  <p><strong>Out:</strong> {session.clockOut ? formatTime(session.clockOut) : 'Active'}</p>
                </div>
                <div className="session-duration">
                  {session.clockOut ? formatDuration(session.duration) : <LiveTimer startTime={new Date(session.clockIn)} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Live Timer Component
function LiveTimer({ startTime }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const duration = currentTime - startTime;
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((duration % (1000 * 60)) / 1000);

  return (
    <div className="live-timer">
      {String(hours).padStart(2, '0')}:
      {String(minutes).padStart(2, '0')}:
      {String(seconds).padStart(2, '0')}
    </div>
  );
}