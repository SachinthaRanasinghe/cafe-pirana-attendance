// src/Pages/StaffDashboard/StaffAvailability.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  query,
  where
} from "firebase/firestore";
import { db } from "../../firebase";
import "./StaffAvailability.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function StaffAvailability({ staffData, onLogout }) {
  const [availabilities, setAvailabilities] = useState({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const { staffName, staffId, uid } = staffData || {};

  // Days of the week
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Time slots (30-minute intervals from 6 AM to 12 AM)
  const timeSlots = [];
  for (let hour = 6; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  // Fetch existing availabilities
  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "availabilities"),
      where("staffUid", "==", uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        setAvailabilities(docData.availabilities || {});
      } else {
        // Initialize empty availabilities
        const emptyAvailabilities = {};
        days.forEach(day => {
          emptyAvailabilities[day] = {
            available: false,
            startTime: "09:00",
            endTime: "17:00",
            breaks: []
          };
        });
        setAvailabilities(emptyAvailabilities);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  const handleAvailabilityChange = (day, field, value) => {
    setAvailabilities(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleTimeChange = (day, field, time) => {
    setAvailabilities(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: time
      }
    }));
  };

  const addBreak = (day) => {
    setAvailabilities(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: [...(prev[day]?.breaks || []), { start: "12:00", end: "13:00" }]
      }
    }));
  };

  const removeBreak = (day, index) => {
    setAvailabilities(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: prev[day].breaks.filter((_, i) => i !== index)
      }
    }));
  };

  const updateBreakTime = (day, index, field, time) => {
    setAvailabilities(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: prev[day].breaks.map((breakItem, i) => 
          i === index ? { ...breakItem, [field]: time } : breakItem
        )
      }
    }));
  };

  const saveAvailabilities = async () => {
    if (!uid) return;

    setLoading(true);
    try {
      const availabilityDoc = {
        staffUid: uid,
        staffName: staffName,
        staffId: staffId,
        availabilities: availabilities,
        lastUpdated: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "availabilities", uid), availabilityDoc);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      showNotification("Availability saved successfully!", "success");
    } catch (error) {
      console.error("Error saving availability:", error);
      showNotification("Error saving availability: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const copyToAllDays = (sourceDay) => {
    const sourceData = availabilities[sourceDay];
    const newAvailabilities = { ...availabilities };
    
    days.forEach(day => {
      if (day !== sourceDay) {
        newAvailabilities[day] = { ...sourceData };
      }
    });
    
    setAvailabilities(newAvailabilities);
    showNotification(`Copied ${sourceDay} schedule to all other days`, "info");
  };

  const showNotification = (msg, type = "info") => {
    const styles = {
      success: "background: #4CAF50; color: white; padding: 12px; border-radius: 4px;",
      error: "background: #f44336; color: white; padding: 12px; border-radius: 4px;",
      info: "background: #2196F3; color: white; padding: 12px; border-radius: 4px;"
    };
    console.log(`%c${msg}`, styles[type] || styles.info);
    alert(msg);
  };

  const isActiveRoute = (path) => location.pathname.includes(path);

  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (error) {
      console.warn("Navigation error, using fallback:", error);
      window.location.href = path;
    }
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
  };

  if (!staffData) {
    return (
      <div className="staff-availability">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h2>Staff Data Not Available</h2>
          <p>Please log in again to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-availability">
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
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${isActiveRoute('/staff') ? 'active' : ''}`}
              onClick={() => safeNavigate('/staff')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-text">Dashboard</span>
            </button>
            
            <button 
              className={`nav-item ${isActiveRoute('/salary') ? 'active' : ''}`}
              onClick={() => safeNavigate('/staff/salary')}
            >
              <span className="nav-icon">💰</span>
              <span className="nav-text">Salary</span>
            </button>
            
            <button 
              className={`nav-item ${isActiveRoute('/advance') ? 'active' : ''}`}
              onClick={() => safeNavigate('/staff/advance')}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">Request Advance</span>
            </button>

            <button 
              className={`nav-item ${isActiveRoute('/availability') ? 'active' : ''}`}
              onClick={() => safeNavigate('/staff/availability')}
            >
              <span className="nav-icon">📅</span>
              <span className="nav-text">Availability</span>
            </button>
            
            <div className="nav-divider"></div>
            
            <button className="nav-item logout-item" onClick={handleLogout}>
              <span className="nav-icon">🚪</span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="dashboard-main">
          {/* Welcome Header */}
          <div className="welcome-header">
            <div className="welcome-text">
              <h1>Weekly Availability</h1>
              <p>Set your available working hours for each day</p>
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

          {/* Quick Actions */}
          <div className="action-card">
            <div className="action-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="action-buttons">
              <button 
                className="btn-outline"
                onClick={() => {
                  const newAvailabilities = { ...availabilities };
                  days.forEach(day => {
                    newAvailabilities[day] = {
                      ...newAvailabilities[day],
                      available: true
                    };
                  });
                  setAvailabilities(newAvailabilities);
                }}
              >
                <span className="btn-icon">✅</span>
                Available All Week
              </button>
              <button 
                className="btn-outline"
                onClick={() => {
                  const newAvailabilities = { ...availabilities };
                  days.forEach(day => {
                    newAvailabilities[day] = {
                      ...newAvailabilities[day],
                      available: false
                    };
                  });
                  setAvailabilities(newAvailabilities);
                }}
              >
                <span className="btn-icon">❌</span>
                Unavailable All Week
              </button>
              <button 
                className="btn-primary"
                onClick={saveAvailabilities}
                disabled={loading}
              >
                <span className="btn-icon">💾</span>
                {loading ? "Saving..." : "Save All Changes"}
              </button>
            </div>
            {saved && (
              <div className="save-indicator success">
                ✅ Availability saved successfully!
              </div>
            )}
          </div>

          {/* Availability Grid */}
          <div className="availability-grid">
            {days.map(day => {
              const dayData = availabilities[day] || {
                available: false,
                startTime: "09:00",
                endTime: "17:00",
                breaks: []
              };

              return (
                <div key={day} className={`day-card ${dayData.available ? 'available' : 'unavailable'}`}>
                  <div className="day-header">
                    <div className="day-title">
                      <h3>{day}</h3>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={dayData.available}
                          onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <button 
                      className="btn-sm btn-outline"
                      onClick={() => copyToAllDays(day)}
                    >
                      <span className="btn-icon">📋</span>
                      Copy to All
                    </button>
                  </div>

                  {dayData.available && (
                    <div className="day-schedule">
                      {/* Working Hours */}
                      <div className="time-section">
                        <label className="section-label">Working Hours</label>
                        <div className="time-inputs">
                          <div className="time-input-group">
                            <label>Start Time</label>
                            <select
                              value={dayData.startTime}
                              onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                              className="time-select"
                            >
                              {timeSlots.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                          <div className="time-input-group">
                            <label>End Time</label>
                            <select
                              value={dayData.endTime}
                              onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                              className="time-select"
                            >
                              {timeSlots.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Breaks */}
                      <div className="breaks-section">
                        <div className="breaks-header">
                          <label className="section-label">Breaks</label>
                          <button 
                            className="btn-sm btn-outline"
                            onClick={() => addBreak(day)}
                          >
                            <span className="btn-icon">➕</span>
                            Add Break
                          </button>
                        </div>
                        
                        {dayData.breaks?.map((breakItem, index) => (
                          <div key={index} className="break-item">
                            <div className="break-inputs">
                              <select
                                value={breakItem.start}
                                onChange={(e) => updateBreakTime(day, index, 'start', e.target.value)}
                                className="time-select"
                              >
                                {timeSlots.map(time => (
                                  <option key={time} value={time}>{time}</option>
                                ))}
                              </select>
                              <span className="break-separator">to</span>
                              <select
                                value={breakItem.end}
                                onChange={(e) => updateBreakTime(day, index, 'end', e.target.value)}
                                className="time-select"
                              >
                                {timeSlots.map(time => (
                                  <option key={time} value={time}>{time}</option>
                                ))}
                              </select>
                              <button 
                                className="btn-sm btn-danger"
                                onClick={() => removeBreak(day, index)}
                              >
                                <span className="btn-icon">🗑️</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!dayData.available && (
                    <div className="unavailable-message">
                      <span className="unavailable-icon">❌</span>
                      Not available on {day}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary Card */}
          <div className="summary-card">
            <div className="summary-header">
              <h3>Availability Summary</h3>
            </div>
            <div className="summary-content">
              <div className="summary-stats">
                <div className="stat">
                  <span className="stat-label">Available Days:</span>
                  <span className="stat-value">
                    {days.filter(day => availabilities[day]?.available).length} / 7
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Last Updated:</span>
                  <span className="stat-value">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="summary-note">
                <p>💡 Your availability helps management schedule shifts effectively. Please keep this updated.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}