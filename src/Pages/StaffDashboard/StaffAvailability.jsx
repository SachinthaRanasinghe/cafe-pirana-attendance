// src/Pages/StaffDashboard/StaffAvailability.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  query,
  where,
  addDoc,
  getDocs
} from "firebase/firestore";
import { db } from "../../firebase";
import "./StaffAvailability.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function StaffAvailability({ staffData, onLogout }) {
  const [availabilities, setAvailabilities] = useState({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentWeek, setCurrentWeek] = useState("");
  const [isSunday, setIsSunday] = useState(false);
  const [nextSunday, setNextSunday] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  const { staffName, staffId, uid } = staffData || {};

  // Check if today is Sunday
  useEffect(() => {
    const checkDay = () => {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday
      setIsSunday(dayOfWeek === 0);
      
      // Calculate next Sunday
      if (dayOfWeek !== 0) {
        const daysUntilSunday = 7 - dayOfWeek;
        const nextSundayDate = new Date(today);
        nextSundayDate.setDate(today.getDate() + daysUntilSunday);
        setNextSunday(nextSundayDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        }));
      }
    };

    checkDay();
    // Check every hour in case day changes
    const interval = setInterval(checkDay, 3600000);
    return () => clearInterval(interval);
  }, []);

  // Days of the week (starting with Sunday)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Time slots (30-minute intervals from 6 AM to 12 AM)
  const timeSlots = [];
  for (let hour = 6; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  // Get current week start date (Sunday)
  const getCurrentWeekStart = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = dayOfWeek; // Days since Sunday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - diff);
    sunday.setHours(0, 0, 0, 0);
    return sunday.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // Check if it's a new week and reset if needed
  const checkAndResetForNewWeek = async () => {
    const weekStart = getCurrentWeekStart();
    setCurrentWeek(weekStart);

    // Check if we already have availability for this week
    const weeklyAvailabilityQuery = query(
      collection(db, "weeklyAvailability"),
      where("staffUid", "==", uid),
      where("weekStartDate", "==", weekStart)
    );

    const snapshot = await getDocs(weeklyAvailabilityQuery);
    
    if (snapshot.empty) {
      // It's a new week, archive current availability if it exists
      const currentAvailabilityQuery = query(
        collection(db, "availabilities"),
        where("staffUid", "==", uid)
      );
      
      const currentSnapshot = await getDocs(currentAvailabilityQuery);
      if (!currentSnapshot.empty) {
        const currentData = currentSnapshot.docs[0].data();
        
        // Archive the previous week's availability
        await addDoc(collection(db, "weeklyAvailability"), {
          ...currentData,
          weekStartDate: getPreviousWeekStart(),
          archivedAt: new Date().toISOString()
        });

        // Reset availability for new week
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
        
        // Update current availability
        await setDoc(doc(db, "availabilities", uid), {
          staffUid: uid,
          staffName: staffName,
          staffId: staffId,
          availabilities: emptyAvailabilities,
          lastUpdated: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentWeek: weekStart
        });
      }
    }
  };

  const getPreviousWeekStart = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const diff = dayOfWeek + 7; // Go back 7 days from current Sunday
    const previousSunday = new Date(today);
    previousSunday.setDate(today.getDate() - diff);
    previousSunday.setHours(0, 0, 0, 0);
    return previousSunday.toISOString().split('T')[0];
  };

  // Fetch existing availabilities and check for week reset
  useEffect(() => {
    if (!uid) return;

    const initializeAvailability = async () => {
      await checkAndResetForNewWeek();

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
    };

    initializeAvailability();
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
      const weekStart = getCurrentWeekStart();
      
      const availabilityDoc = {
        staffUid: uid,
        staffName: staffName,
        staffId: staffId,
        availabilities: availabilities,
        lastUpdated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentWeek: weekStart
      };

      // Save to current availability
      await setDoc(doc(db, "availabilities", uid), availabilityDoc);
      
      // Also save to weekly records for history
      await addDoc(collection(db, "weeklyAvailability"), {
        ...availabilityDoc,
        weekStartDate: weekStart,
        savedAt: new Date().toISOString()
      });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving availability:", error);
      alert("Error saving availability: " + error.message);
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
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">🏪</div>
            <div className="brand-text">
              <h1>Cafe Piranha</h1>
              <span>Availability</span>
            </div>
          </div>
          
          <div className="header-user">
            <div className="user-avatar">
              {staffName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        
        <div className="user-info-mobile">
          <span className="user-name">{staffName}</span>
          <span className="user-id">ID: {staffId}</span>
          <div className="week-indicator">
            Week: {currentWeek ? new Date(currentWeek).toLocaleDateString() : 'Loading...'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div className="welcome-content">
            <h2>Weekly Availability</h2>
            <p>Set your working hours for each day</p>
          </div>
          <div className="date-display-mobile">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </section>

        {/* Sunday Restriction Notice */}
        {!isSunday && (
          <section className="restriction-notice-section">
            <div className="restriction-card">
              <div className="restriction-icon">🔒</div>
              <div className="restriction-content">
                <h3 className="restriction-title">Availability Updates Restricted</h3>
                <p className="restriction-message">
                  Weekly availability can <strong>only be updated on Sundays</strong>.
                </p>
                <p className="restriction-submessage">
                  You can view your current availability below, but you cannot make changes until Sunday.
                </p>
                <div className="next-update-info">
                  <span className="calendar-icon">📅</span>
                  <div className="next-update-text">
                    <span className="label">Next Update Day:</span>
                    <span className="date">{nextSunday}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {isSunday && (
          <section className="restriction-notice-section">
            <div className="restriction-card success">
              <div className="restriction-icon">✅</div>
              <div className="restriction-content">
                <h3 className="restriction-title">Update Available Today</h3>
                <p className="restriction-message">
                  Today is Sunday! You can now update your weekly availability below.
                </p>
                <p className="restriction-submessage">
                  Make sure to save your changes before the end of the day.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Week Info Card */}
        <section className="section-mobile">
          <div className="info-card-mobile">
            <div className="info-header-mobile">
              <span className="info-icon">📅</span>
              <h4>Weekly Availability</h4>
            </div>
            <div className="info-content-mobile">
              <p>
                Your availability automatically resets every Sunday. 
                Changes are saved weekly for reporting purposes.
              </p>
              <div className="week-info-mobile">
                <strong>Current Week:</strong> {currentWeek ? new Date(currentWeek).toLocaleDateString() : 'Loading...'}
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="actions-section">
          <div className="actions-card-mobile">
            <div className="actions-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="actions-grid">
              <button 
                className="btn-action-outline"
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
                <span className="btn-text">Available All Week</span>
              </button>
              <button 
                className="btn-action-outline"
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
                <span className="btn-text">Unavailable All Week</span>
              </button>
              <button 
                className="btn-action-primary"
                onClick={saveAvailabilities}
                disabled={loading || !isSunday}
              >
                <span className="btn-icon">💾</span>
                <span className="btn-text">
                  {loading ? "Saving..." : !isSunday ? "Updates Restricted" : "Save All Changes"}
                </span>
              </button>
            </div>
            {saved && (
              <div className="save-indicator-mobile success">
                <span className="save-icon">✅</span>
                Availability saved successfully for this week!
              </div>
            )}
          </div>
        </section>

        {/* Availability Grid */}
        <section className="availability-section">
          <div className="availability-grid-mobile">
            {days.map(day => {
              const dayData = availabilities[day] || {
                available: false,
                startTime: "09:00",
                endTime: "17:00",
                breaks: []
              };

              return (
                <div key={day} className={`day-card-mobile ${dayData.available ? 'available' : 'unavailable'}`}>
                  <div className="day-header-mobile">
                    <div className="day-title-mobile">
                      <h3 className="day-name">{day}</h3>
                      <label className="toggle-switch-mobile">
                        <input
                          type="checkbox"
                          checked={dayData.available}
                          onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                          disabled={!isSunday}
                        />
                        <span className="toggle-slider-mobile"></span>
                      </label>
                    </div>
                    <button 
                      className="btn-copy-mobile"
                      onClick={() => copyToAllDays(day)}
                      disabled={!isSunday}
                    >
                      <span className="btn-icon">📋</span>
                      <span className="btn-text">Copy to All</span>
                    </button>
                  </div>

                  {dayData.available && (
                    <div className="day-schedule-mobile">
                      {/* Working Hours */}
                      <div className="time-section-mobile">
                        <label className="section-label-mobile">Working Hours</label>
                        <div className="time-inputs-mobile">
                          <div className="time-input-group-mobile">
                            <label className="time-label">Start Time</label>
                            <select
                              value={dayData.startTime}
                              onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                              className="time-select-mobile"
                              disabled={!isSunday}
                            >
                              {timeSlots.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                          <div className="time-input-group-mobile">
                            <label className="time-label">End Time</label>
                            <select
                              value={dayData.endTime}
                              onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                              className="time-select-mobile"
                              disabled={!isSunday}
                            >
                              {timeSlots.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Breaks */}
                      <div className="breaks-section-mobile">
                        <div className="breaks-header-mobile">
                          <label className="section-label-mobile">Breaks</label>
                          <button 
                            className="btn-add-break-mobile"
                            onClick={() => addBreak(day)}
                            disabled={!isSunday}
                          >
                            <span className="btn-icon">➕</span>
                            <span className="btn-text">Add Break</span>
                          </button>
                        </div>
                        
                        {dayData.breaks?.map((breakItem, index) => (
                          <div key={index} className="break-item-mobile">
                            <div className="break-inputs-mobile">
                              <select
                                value={breakItem.start}
                                onChange={(e) => updateBreakTime(day, index, 'start', e.target.value)}
                                className="time-select-mobile"
                                disabled={!isSunday}
                              >
                                {timeSlots.map(time => (
                                  <option key={time} value={time}>{time}</option>
                                ))}
                              </select>
                              <span className="break-separator-mobile">to</span>
                              <select
                                value={breakItem.end}
                                onChange={(e) => updateBreakTime(day, index, 'end', e.target.value)}
                                className="time-select-mobile"
                                disabled={!isSunday}
                              >
                                {timeSlots.map(time => (
                                  <option key={time} value={time}>{time}</option>
                                ))}
                              </select>
                              <button 
                                className="btn-remove-break-mobile"
                                onClick={() => removeBreak(day, index)}
                                disabled={!isSunday}
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
                    <div className="unavailable-message-mobile">
                      <span className="unavailable-icon">❌</span>
                      <span className="unavailable-text">Not available on {day}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Summary Card */}
        <section className="summary-section">
          <div className="summary-card-mobile">
            <div className="summary-header-mobile">
              <h3>Availability Summary</h3>
            </div>
            <div className="summary-content-mobile">
              <div className="summary-stats-mobile">
                <div className="stat-item-mobile">
                  <span className="stat-label">Available Days:</span>
                  <span className="stat-value">
                    {days.filter(day => availabilities[day]?.available).length} / 7
                  </span>
                </div>
                <div className="stat-item-mobile">
                  <span className="stat-label">Current Week:</span>
                  <span className="stat-value">
                    {currentWeek ? new Date(currentWeek).toLocaleDateString() : 'Loading...'}
                  </span>
                </div>
                <div className="stat-item-mobile">
                  <span className="stat-label">Last Updated:</span>
                  <span className="stat-value">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="summary-note-mobile">
                <span className="note-icon">💡</span>
                <p>Your availability is saved weekly and automatically resets every Sunday for accurate monthly reporting.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`nav-item ${isActiveRoute('/staff') && !isActiveRoute('/staff/salary') && !isActiveRoute('/staff/advance') && !isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/salary')}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-label">Salary</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/advance') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/advance')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Advance</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Availability</span>
        </button>

        <button className="nav-item logout-item" onClick={handleLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </div>
  );
}