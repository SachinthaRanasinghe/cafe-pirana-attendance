// src/Pages/AdminDashboard/AdminDashboard.jsx
import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import "./AdminDashboard.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate, useLocation } from "react-router-dom";

export default function AdminDashboard({ onLogout }) {
  const [allSessions, setAllSessions] = useState([]);
  const [activeStaff, setActiveStaff] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const navigate = useNavigate();
  const location = useLocation();

  // Helper functions for shift-based tracking
  const getShiftDate = (timestamp) => {
    const date = new Date(timestamp);
    if (date.getHours() >= 18) {
      date.setDate(date.getDate() + 1);
    }
    return date.toDateString();
  };

  // === Real-time Firestore listener with shift support ===
  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("clockIn", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = [];
      const active = [];
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        sessions.push(data);
        if (!data.clockOut) active.push(data);
      });
      setAllSessions(sessions);
      setActiveStaff(active);
    });
    return () => unsubscribe();
  }, []);

  // Filter sessions by shift date instead of calendar date
  const filteredSessions = allSessions.filter(
    (s) => getShiftDate(s.clockIn) === new Date(selectedDate).toDateString()
  );

  // === Staff summary calculation with shift support ===
  const staffSummary = {};
  filteredSessions.forEach((session) => {
    if (!staffSummary[session.staffUid]) {
      staffSummary[session.staffUid] = {
        staffName: session.staffName,
        staffId: session.staffId,
        totalHours: 0,
        sessions: 0,
        nightShifts: 0,
        otHours: 0,
        lastActivity: session.clockIn,
      };
    }

    if (session.clockOut) {
      staffSummary[session.staffUid].totalHours += session.totalHours || 0;
      staffSummary[session.staffUid].otHours += session.otHours || 0;
    }
    staffSummary[session.staffUid].sessions += 1;
    if (session.isNightShift) {
      staffSummary[session.staffUid].nightShifts += 1;
    }
  });

  // === Navigation ===
  const isActiveRoute = (path) => location.pathname === path;

  // === PDF Export with shift support ===
  const exportToPDF = () => {
    setLoading(true);
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.text("Cafe Piranha - Staff Report", 105, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Shift Date: ${new Date(selectedDate).toDateString()}`, 105, 30, {
        align: "center",
      });
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 36, {
        align: "center",
      });

      let y = 50;

      // Staff Summary Table
      if (Object.keys(staffSummary).length > 0) {
        doc.setFontSize(14);
        doc.text("Staff Summary", 14, y);
        y += 10;

        const summaryData = Object.entries(staffSummary).map(
          ([uid, data]) => [
            data.staffName,
            data.staffId,
            data.sessions.toString(),
            `${data.totalHours.toFixed(2)}h`,
            `${data.otHours.toFixed(1)}h`,
            data.nightShifts.toString(),
            formatTime(data.lastActivity),
          ]
        );

        autoTable(doc, {
          startY: y,
          head: [
            [
              "Staff Name",
              "Staff ID",
              "Sessions",
              "Total Hours",
              "OT Hours",
              "Night Shifts",
              "Last Activity",
            ],
          ],
          body: summaryData,
          theme: "grid",
          headStyles: { fillColor: [74, 124, 89] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 15;
      }

      // Detailed Sessions Table
      if (filteredSessions.length > 0) {
        doc.setFontSize(14);
        doc.text("Detailed Sessions", 14, y);
        y += 10;

        const sessionData = filteredSessions.map((s) => [
          s.staffName,
          s.staffId,
          formatTime(s.clockIn),
          s.clockOut ? formatTime(s.clockOut) : "Active",
          s.clockOut ? formatDuration(s.duration) : "In Progress",
          s.clockOut ? "Completed" : "Active",
          s.isNightShift ? "🌙 Yes" : "No",
          s.crossMidnight ? "⏰ Yes" : "No",
          s.otHours > 0 ? `${s.otHours.toFixed(1)}h` : "No",
        ]);

        autoTable(doc, {
          startY: y,
          head: [
            [
              "Staff Name",
              "Staff ID",
              "Clock In",
              "Clock Out",
              "Duration",
              "Status",
              "Night Shift",
              "Cross Midnight",
              "OT Hours",
            ],
          ],
          body: sessionData,
          theme: "grid",
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer Stats
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : y;
      doc.setFontSize(10);
      doc.text(`Total Staff: ${Object.keys(staffSummary).length}`, 14, finalY);
      doc.text(`Total Sessions: ${filteredSessions.length}`, 14, finalY + 6);
      doc.text(`Active Staff: ${activeStaff.length}`, 14, finalY + 12);
      doc.text(`Night Shifts: ${filteredSessions.filter(s => s.isNightShift).length}`, 14, finalY + 18);
      doc.text(`Cross-Midnight: ${filteredSessions.filter(s => s.crossMidnight).length}`, 14, finalY + 24);

      doc.save(`cafe-piranha-report-${selectedDate}.pdf`);
      alert("PDF report generated successfully!");
    } catch (err) {
      console.error(err);
      alert("Error generating PDF: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // === CSV Export with shift support ===
  const exportToCSV = () => {
    try {
      const headers = [
        "Staff Name",
        "Staff ID",
        "Date",
        "Clock In",
        "Clock Out",
        "Duration",
        "Status",
        "Total Hours",
        "OT Hours",
        "Night Shift",
        "Cross Midnight",
        "Regular Hours"
      ];
      const data = filteredSessions.map((s) => [
        s.staffName,
        s.staffId,
        s.date,
        formatTime(s.clockIn),
        s.clockOut ? formatTime(s.clockOut) : "Active",
        s.clockOut ? formatDuration(s.duration) : "In Progress",
        s.clockOut ? "Completed" : "Active",
        s.totalHours ? s.totalHours.toFixed(2) : "0.00",
        s.otHours ? s.otHours.toFixed(1) : "0.0",
        s.isNightShift ? "Yes" : "No",
        s.crossMidnight ? "Yes" : "No",
        s.regularHours ? s.regularHours.toFixed(1) : "0.0"
      ]);
      const csv = [headers, ...data]
        .map((r) => r.map((f) => `"${f}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `cafe-piranha-data-${selectedDate}.csv`;
      link.click();
      alert("CSV data exported successfully!");
    } catch (err) {
      alert("Error exporting CSV: " + err.message);
    }
  };

  // === Delete All Data ===
  const clearAllData = async () => {
    const confirmClear = window.confirm(
      "🚨 CRITICAL ACTION\nThis will delete ALL attendance data permanently.\nThis cannot be undone."
    );
    if (!confirmClear) return;
    const userInput = prompt('Type "DELETE ALL" to confirm:');
    if (userInput !== "DELETE ALL") {
      alert("Data deletion cancelled");
      return;
    }

    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "sessions"));
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach((docu) => {
        batch.delete(doc(db, "sessions", docu.id));
        count++;
      });
      await batch.commit();
      alert(`Successfully deleted ${count} attendance records`);
    } catch (err) {
      alert("Error deleting data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // === Delete Selected Date Data ===
  const clearDateData = async () => {
    if (!window.confirm(`Clear attendance data for ${new Date(selectedDate).toDateString()}?`)) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      filteredSessions.forEach((s) => {
        batch.delete(doc(db, "sessions", s.id));
        count++;
      });
      await batch.commit();
      alert(`Deleted ${count} records for selected date`);
    } catch (err) {
      alert("Error clearing date data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // === Helper functions ===
  const formatTime = (t) =>
    new Date(t).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const formatDuration = (ms) => {
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (error) {
      console.warn("Navigation error, using fallback:", error);
      window.location.href = path;
    }
  };

  // Calculate statistics for the stats grid
  const stats = {
    totalStaff: Object.keys(staffSummary).length,
    activeStaff: activeStaff.length,
    totalSessions: filteredSessions.length,
    nightShifts: filteredSessions.filter(s => s.isNightShift).length,
    crossMidnight: filteredSessions.filter(s => s.crossMidnight).length,
    otSessions: filteredSessions.filter(s => s.otHours > 0).length,
    totalOvertime: filteredSessions.reduce((sum, s) => sum + (s.otHours || 0), 0)
  };

  return (
    <div className="admin-dashboard">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">🏪</div>
            <div className="brand-text">
              <h1>Cafe Piranha</h1>
              <span>Admin Portal</span>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="live-indicator">
              <span className="live-dot"></span>
              <span>Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div className="welcome-content">
            <h2>Admin Dashboard</h2>
            <p>Real-time staff monitoring</p>
          </div>
          <div className="date-display-mobile">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </section>

        {/* Quick Stats */}
        <section className="stats-section">
          <div className="stats-grid-mobile">
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile primary">👥</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.totalStaff}</div>
                <div className="stat-label">Staff Today</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile success">🟢</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.activeStaff}</div>
                <div className="stat-label">Active Now</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile accent">📊</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.totalSessions}</div>
                <div className="stat-label">Sessions</div>
              </div>
            </div>

            <div className="stat-card-mobile">
              <div className="stat-icon-mobile warning">🌙</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.nightShifts}</div>
                <div className="stat-label">Night Shifts</div>
              </div>
            </div>

            <div className="stat-card-mobile">
              <div className="stat-icon-mobile secondary">⏰</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.crossMidnight}</div>
                <div className="stat-label">Cross Midnight</div>
              </div>
            </div>

            <div className="stat-card-mobile">
              <div className="stat-icon-mobile info">⚡</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.otSessions}</div>
                <div className="stat-label">OT Sessions</div>
                <div className="stat-detail">{stats.totalOvertime.toFixed(1)}h</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="tabs-section">
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span className="tab-icon">📊</span>
              <span className="tab-text">Overview</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === "active" ? "active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              <span className="tab-icon">🟢</span>
              <span className="tab-text">Active</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === "sessions" ? "active" : ""}`}
              onClick={() => setActiveTab("sessions")}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-text">Sessions</span>
            </button>
          </div>
        </section>

        {/* Date Filter */}
        <section className="filter-section">
          <div className="filter-card-mobile">
            <div className="filter-header">
              <h3>Select Shift Date</h3>
              <div className="date-badge">
                {new Date(selectedDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input-mobile"
            />
            <div className="shift-info">
              Shifts after 6PM count for next day
            </div>
          </div>
        </section>

        {/* Overview Tab Content */}
        {activeTab === "overview" && (
          <>
            {/* Active Staff Section */}
            <section className="section-mobile">
              <div className="section-header-mobile">
                <h3>Currently Working</h3>
                <span className="badge-mobile success">{activeStaff.length}</span>
              </div>
              
              {activeStaff.length === 0 ? (
                <div className="empty-state-mobile">
                  <div className="empty-icon">👥</div>
                  <h4>No Active Staff</h4>
                  <p>No staff members are currently clocked in</p>
                </div>
              ) : (
                <div className="active-staff-list-mobile">
                  {activeStaff.map((staff) => (
                    <div key={staff.id} className="active-staff-item-mobile">
                      <div className="staff-avatar-mobile">
                        {staff.staffName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="staff-info-mobile">
                        <div className="staff-name">{staff.staffName}</div>
                        <div className="staff-id">ID: {staff.staffId}</div>
                        <div className="session-timer">
                          <LiveTimer startTime={new Date(staff.clockIn)} />
                        </div>
                        {staff.isNightShift && (
                          <div className="shift-indicator night">🌙 Night Shift</div>
                        )}
                      </div>
                      <div className="status-indicator active"></div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Staff Summary */}
            <section className="section-mobile">
              <div className="section-header-mobile">
                <h3>Staff Summary</h3>
                <span className="badge-mobile">{Object.keys(staffSummary).length}</span>
              </div>
              
              {Object.keys(staffSummary).length === 0 ? (
                <div className="empty-state-mobile">
                  <div className="empty-icon">📊</div>
                  <h4>No Activity</h4>
                  <p>No staff activity for selected shift date</p>
                </div>
              ) : (
                <div className="staff-summary-list-mobile">
                  {Object.entries(staffSummary).map(([uid, data]) => (
                    <div key={uid} className="summary-item-mobile">
                      <div className="summary-header-mobile">
                        <div className="staff-main-mobile">
                          <h4>{data.staffName}</h4>
                          <span className="staff-tag">ID: {data.staffId}</span>
                        </div>
                        <div className="total-hours">
                          {data.totalHours.toFixed(1)}h
                          {data.otHours > 0 && (
                            <div className="ot-indicator">+{data.otHours.toFixed(1)}h OT</div>
                          )}
                        </div>
                      </div>
                      <div className="summary-stats-mobile">
                        <div className="stat-mobile">
                          <span className="stat-label">Sessions:</span>
                          <span className="stat-value">{data.sessions}</span>
                        </div>
                        <div className="stat-mobile">
                          <span className="stat-label">Night Shifts:</span>
                          <span className="stat-value">{data.nightShifts}</span>
                        </div>
                        <div className="stat-mobile">
                          <span className="stat-label">Last Activity:</span>
                          <span className="stat-value">{formatTime(data.lastActivity)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Active Staff Tab Content */}
        {activeTab === "active" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>Active Staff Members</h3>
              <span className="badge-mobile success">{activeStaff.length}</span>
            </div>
            
            {activeStaff.length === 0 ? (
              <div className="empty-state-mobile">
                <div className="empty-icon">🟢</div>
                <h4>All Staff Clocked Out</h4>
                <p>No active sessions at the moment</p>
              </div>
            ) : (
              <div className="active-staff-grid-mobile">
                {activeStaff.map((staff) => (
                  <div key={staff.id} className="active-staff-card-mobile">
                    <div className="card-avatar-mobile">
                      {staff.staffName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="card-content-mobile">
                      <h4>{staff.staffName}</h4>
                      <p className="staff-meta">ID: {staff.staffId}</p>
                      <div className="active-timer">
                        <LiveTimer startTime={new Date(staff.clockIn)} />
                      </div>
                      {staff.isNightShift && (
                        <div className="shift-badge night">🌙 Night Shift</div>
                      )}
                    </div>
                    <div className="active-status"></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Sessions Tab Content */}
        {activeTab === "sessions" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>Session Details</h3>
              <span className="badge-mobile">{filteredSessions.length}</span>
            </div>
            
            {filteredSessions.length === 0 ? (
              <div className="empty-state-mobile">
                <div className="empty-icon">📋</div>
                <h4>No Sessions</h4>
                <p>No sessions recorded for selected shift date</p>
              </div>
            ) : (
              <div className="sessions-list-mobile">
                {filteredSessions.map((session) => (
                  <div key={session.id} className={`session-item-mobile ${!session.clockOut ? 'active' : ''}`}>
                    <div className="session-header-mobile">
                      <div className="session-staff-mobile">
                        <strong>{session.staffName}</strong>
                        <span className="staff-id">ID: {session.staffId}</span>
                        <div className="session-shift-info">
                          {session.isNightShift && <span className="shift-tag">🌙 Night</span>}
                          {session.crossMidnight && <span className="shift-tag">⏰ Cross Midnight</span>}
                          {session.otHours > 0 && <span className="ot-tag">⚡ {session.otHours.toFixed(1)}h OT</span>}
                        </div>
                      </div>
                      <div className={`session-status ${!session.clockOut ? 'active' : 'completed'}`}>
                        {!session.clockOut ? 'Active' : 'Completed'}
                      </div>
                    </div>
                    
                    <div className="session-times-mobile">
                      <div className="time-block-mobile">
                        <span className="time-label">Clock In</span>
                        <span className="time-value">{formatTime(session.clockIn)}</span>
                      </div>
                      
                      {session.clockOut ? (
                        <div className="time-block-mobile">
                          <span className="time-label">Clock Out</span>
                          <span className="time-value">{formatTime(session.clockOut)}</span>
                        </div>
                      ) : (
                        <div className="time-block-mobile active">
                          <span className="time-label">Status</span>
                          <span className="time-value">
                            <LiveTimer startTime={new Date(session.clockIn)} />
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {session.clockOut && (
                      <div className="session-meta-mobile">
                        <div className="session-duration">
                          Duration: {formatDuration(session.duration)}
                        </div>
                        <div className="session-hours">
                          Regular: {session.regularHours?.toFixed(1) || '0.0'}h
                          {session.otHours > 0 && (
                            <span className="ot-hours">OT: {session.otHours.toFixed(1)}h</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Management Actions */}
        <section className="section-mobile">
          <div className="section-header-mobile">
            <h3>Data Management</h3>
            <span className="badge-mobile warning">Admin</span>
          </div>
          
          <div className="action-buttons-mobile">
            <button 
              className="btn-action-primary"
              onClick={exportToPDF}
              disabled={loading}
            >
              <span className="btn-icon">📊</span>
              <span className="btn-text">Export PDF</span>
            </button>
            
            <button 
              className="btn-action-secondary"
              onClick={exportToCSV}
              disabled={loading}
            >
              <span className="btn-icon">📈</span>
              <span className="btn-text">Export CSV</span>
            </button>
            
            <button 
              className="btn-action-outline"
              onClick={clearDateData}
              disabled={loading}
            >
              <span className="btn-icon">🗑️</span>
              <span className="btn-text">Clear Date</span>
            </button>
            
            <button 
              className="btn-action-danger"
              onClick={clearAllData}
              disabled={loading}
            >
              <span className="btn-icon">🚨</span>
              <span className="btn-text">Clear All Data</span>
            </button>
          </div>
          
          <div className="data-summary-mobile">
            <div className="summary-item-mobile">
              <span>Staff Today:</span>
              <strong>{stats.totalStaff}</strong>
            </div>
            <div className="summary-item-mobile">
              <span>Total Sessions:</span>
              <strong>{stats.totalSessions}</strong>
            </div>
            <div className="summary-item-mobile">
              <span>Active Now:</span>
              <strong>{stats.activeStaff}</strong>
            </div>
            <div className="summary-item-mobile">
              <span>Night Shifts:</span>
              <strong>{stats.nightShifts}</strong>
            </div>
            <div className="summary-item-mobile">
              <span>OT Sessions:</span>
              <strong>{stats.otSessions}</strong>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`nav-item ${isActiveRoute('/admin') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/admin/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/salary')}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-label">Salary</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/admin/advances') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/advances')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Advances</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/admin/ot-approvals') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/ot-approvals')}
        >
          <span className="nav-icon">🕒</span>
          <span className="nav-label">OT</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/admin/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Availability</span>
        </button>
        
        <button className="nav-item logout-item" onClick={onLogout}>
          <span className="nav-icon">🚪</span>
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
    <span className="live-timer">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}