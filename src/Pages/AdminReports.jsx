import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import "./AdminDashboard.css";

export default function AdminDashboard({ onLogout }) {
  const [allSessions, setAllSessions] = useState([]);
  const [activeStaff, setActiveStaff] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Real-time listener for all sessions
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('clockIn', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = [];
      const active = [];
      
      snapshot.forEach((doc) => {
        const session = { id: doc.id, ...doc.data() };
        sessions.push(session);
        
        // Check for active sessions (no clock out time)
        if (!session.clockOut) {
          active.push(session);
        }
      });
      
      setAllSessions(sessions);
      setActiveStaff(active);
    });

    return () => unsubscribe();
  }, []);

  const filteredSessions = allSessions.filter(session => 
    session.date === new Date(selectedDate).toDateString()
  );

  // Calculate staff summary
  const staffSummary = {};
  filteredSessions.forEach(session => {
    if (!staffSummary[session.staffId]) {
      staffSummary[session.staffId] = {
        staffName: session.staffName,
        totalHours: 0,
        sessions: 0,
        lastActivity: session.clockIn
      };
    }
    
    if (session.clockOut) {
      staffSummary[session.staffId].totalHours += session.totalHours || 0;
    }
    staffSummary[session.staffId].sessions += 1;
  });

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
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

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-info">
          <h1>🏢 Cafe Pirana - Live Dashboard</h1>
          <p>Real-time Staff Monitoring</p>
          <div className="live-indicator">
            <span className="live-dot"></span>
            LIVE UPDATES
          </div>
        </div>
        
        <div className="active-staff-counter">
          <div className="counter-number">{activeStaff.length}</div>
          <div className="counter-label">Currently Working</div>
        </div>
      </div>

      {/* Real-time Active Staff */}
      <div className="active-staff-section">
        <h3>🟢 Currently Working</h3>
        {activeStaff.length === 0 ? (
          <div className="no-active-staff">
            <p>No staff currently clocked in</p>
          </div>
        ) : (
          <div className="active-staff-grid">
            {activeStaff.map(staff => (
              <div key={staff.id} className="active-staff-card">
                <div className="staff-avatar">
                  {staff.staffName.charAt(0).toUpperCase()}
                </div>
                <div className="staff-details">
                  <strong>{staff.staffName}</strong>
                  <small>ID: {staff.staffId}</small>
                  <div className="session-duration">
                    Working: <LiveTimer startTime={new Date(staff.clockIn)} />
                  </div>
                </div>
                <div className="status-indicator active"></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="controls-section">
        <div className="control-group">
          <label>Select Date:</label>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Staff Summary */}
      <div className="summary-section">
        <h3>📊 Staff Summary - {new Date(selectedDate).toDateString()}</h3>
        {Object.keys(staffSummary).length === 0 ? (
          <div className="no-data">
            <p>No activity for selected date</p>
          </div>
        ) : (
          <div className="staff-cards">
            {Object.entries(staffSummary).map(([staffId, data]) => (
              <div key={staffId} className="staff-card">
                <div className="staff-header">
                  <h4>{data.staffName}</h4>
                  <span className="staff-id">{staffId}</span>
                </div>
                <div className="staff-stats">
                  <div className="stat">
                    <span>Total Hours:</span>
                    <strong>{data.totalHours.toFixed(2)}h</strong>
                  </div>
                  <div className="stat">
                    <span>Sessions:</span>
                    <strong>{data.sessions}</strong>
                  </div>
                  <div className="stat">
                    <span>Last Activity:</span>
                    <strong>{formatTime(data.lastActivity)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Sessions */}
      <div className="sessions-section">
        <h3>📋 All Sessions Today</h3>
        {filteredSessions.length === 0 ? (
          <div className="no-sessions">
            <p>No sessions for selected date</p>
          </div>
        ) : (
          <div className="sessions-list">
            {filteredSessions.map(session => (
              <div key={session.id} className={`session-item ${!session.clockOut ? 'active-session' : ''}`}>
                <div className="session-header">
                  <strong>{session.staffName}</strong>
                  <span className="session-id">ID: {session.staffId}</span>
                </div>
                <div className="session-times">
                  <span>In: {formatTime(session.clockIn)}</span>
                  {session.clockOut ? (
                    <span>Out: {formatTime(session.clockOut)}</span>
                  ) : (
                    <span className="active-badge">ACTIVE NOW</span>
                  )}
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

      <button className="logout-btn" onClick={onLogout}>
        🚪 Logout
      </button>
    </div>
  );
}

// Live Timer Component for Admin
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
  
  return `${hours}h ${minutes}m ${seconds}s`;
}