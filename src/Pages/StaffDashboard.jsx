import { useState, useEffect, useMemo } from "react";
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import "./StaffDashboard.css";

export default function StaffDashboard({ staffName, onLogout }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [loading, setLoading] = useState(false);

  // FIXED: Consistent staff ID using useMemo and localStorage
  const staffId = useMemo(() => {
    // Try to get existing staff ID from localStorage
    const storedStaffId = localStorage.getItem(`staffId_${staffName}`);
    
    if (storedStaffId) {
      console.log("Using existing staff ID:", storedStaffId);
      return storedStaffId;
    }
    
    // Create new consistent ID based on name only (no random part)
    const namePart = staffName.replace(/\s+/g, '').toUpperCase().substr(0, 3);
    const newStaffId = `CP${namePart}`;
    
    // Store it for future use
    localStorage.setItem(`staffId_${staffName}`, newStaffId);
    console.log("Created new staff ID:", newStaffId);
    
    return newStaffId;
  }, [staffName]);

  // Real-time listener for today's sessions
  useEffect(() => {
    console.log("Setting up Firestore listener for staff:", staffId);
    
    const today = new Date().toDateString();
    const q = query(
      collection(db, 'sessions'),
      where('staffId', '==', staffId),
      where('date', '==', today),
      orderBy('clockIn', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log("Received data from Firestore:", snapshot.size, "documents");
        const sessions = [];
        let totalHours = 0;
        
        snapshot.forEach((doc) => {
          const sessionData = { id: doc.id, ...doc.data() };
          console.log("Session data:", sessionData);
          sessions.push(sessionData);
          
          // Calculate total hours from completed sessions
          if (sessionData.clockOut && sessionData.duration) {
            totalHours += sessionData.duration / (1000 * 60 * 60); // Convert ms to hours
          }
        });
        
        setTodaySessions(sessions);
        setTotalHoursToday(totalHours);
        console.log("Total sessions found:", sessions.length);
        console.log("Total hours:", totalHours);
        
        // Check for active session
        const activeSession = sessions.find(session => !session.clockOut);
        if (activeSession) {
          setIsClockedIn(true);
          setCurrentSession(activeSession);
          console.log("Active session found:", activeSession);
        } else {
          setIsClockedIn(false);
          setCurrentSession(null);
          console.log("No active session found");
        }
      },
      (error) => {
        console.error("Firestore error:", error);
        alert("Error connecting to database: " + error.message);
      }
    );

    return () => unsubscribe();
  }, [staffId]);

  const clockIn = async () => {
    setLoading(true);
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
      console.log("Clock in - Adding document:", session);
      const docRef = await addDoc(collection(db, 'sessions'), session);
      console.log("Document written with ID: ", docRef.id);
      setCurrentSession({ id: docRef.id, ...session });
      setIsClockedIn(true);
      showNotification(`🟢 Clocked in at ${formatTime(clockInTime)}`, 'success');
    } catch (error) {
      console.error('Error clocking in:', error);
      showNotification('❌ Error clocking in: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const clockOut = async () => {
    if (!currentSession) return;
    
    setLoading(true);
    const clockOutTime = new Date();
    const clockInTime = new Date(currentSession.clockIn);
    const duration = clockOutTime - clockInTime;
    
    try {
      console.log("Clock out - Updating document:", currentSession.id);
      const sessionRef = doc(db, 'sessions', currentSession.id);
      await updateDoc(sessionRef, {
        clockOut: clockOutTime.toISOString(),
        duration: duration,
        totalHours: duration / (1000 * 60 * 60),
        status: 'completed'
      });
      
      console.log("Document updated successfully");
      setIsClockedIn(false);
      setCurrentSession(null);
      showNotification(`🔴 Clocked out - Session: ${formatDuration(duration)}`, 'info');
    } catch (error) {
      console.error('Error clocking out:', error);
      showNotification('❌ Error clocking out: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type) => {
    alert(message);
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
    
    // Clear staff session but keep the staff ID for next time
    if (onLogout) {
      onLogout();
    }
  };

  const clearTodayData = () => {
    const shouldClear = window.confirm(
      "🗑️ Clear all today's data?\n\nThis will remove all your sessions for today. This action cannot be undone."
    );
    
    if (shouldClear) {
      // This would need to delete from Firestore - for now just clear local state
      setTodaySessions([]);
      setTotalHoursToday(0);
      showNotification('Today\'s data has been cleared locally', 'info');
    }
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
            <p><strong>Status:</strong> {isClockedIn ? 'Clocked In' : 'Clocked Out'}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className={`status-badge ${isClockedIn ? 'clocked-in' : 'clocked-out'}`}>
            {isClockedIn ? '🟢 CLOCKED IN' : '🔴 CLOCKED OUT'}
          </div>
          <button className="logout-btn" onClick={handleLogout} disabled={loading}>
            {loading ? '⏳' : '🚪'} Logout
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
              <p><strong>Current Duration:</strong> {formatDuration(new Date() - new Date(currentSession.clockIn))}</p>
            </div>
          </div>
        </div>
      )}

      {/* Clock In/Out Buttons */}
      <div className="actions-section">
        <div className="action-buttons">
          {!isClockedIn ? (
            <button className="clock-in-btn" onClick={clockIn} disabled={loading}>
              {loading ? '⏳' : '📍'} Clock In
            </button>
          ) : (
            <button className="clock-out-btn" onClick={clockOut} disabled={loading}>
              {loading ? '⏳' : '🏁'} Clock Out
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

        <div className="summary-card">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <h3>Status</h3>
            <p className="card-value">{isClockedIn ? 'Working' : 'Offline'}</p>
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
            {todaySessions.map((session, index) => (
              <div key={session.id} className={`session-item ${!session.clockOut ? 'active-session' : ''}`}>
                <div className="session-number">#{index + 1}</div>
                <div className="session-details">
                  <div className="session-times">
                    <span className="time-in">🟢 {formatTime(session.clockIn)}</span>
                    <span className="time-separator">→</span>
                    <span className="time-out">
                      {session.clockOut ? `🔴 ${formatTime(session.clockOut)}` : '🟢 Active'}
                    </span>
                  </div>
                  <div className="session-date">
                    {session.clockOut ? 'Completed' : 'In Progress'}
                  </div>
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