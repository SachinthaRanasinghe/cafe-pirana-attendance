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
import { notificationManager } from "../../utils/notificationManager";
import { getAuth } from "firebase/auth";

export default function AdminDashboard({ onLogout }) {
  const [allSessions, setAllSessions] = useState([]);
  const [activeStaff, setActiveStaff] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [exportProgress, setExportProgress] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pendingRequests, setPendingRequests] = useState({ ot: 0, advance: 0 });

  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  // Initialize notifications
  useEffect(() => {
    const initializeNotifications = async () => {
      if (auth.currentUser) {
        const enabled = await notificationManager.requestPermission(auth.currentUser.uid);
        setNotificationsEnabled(enabled);
        
        if (enabled) {
          console.log('Push notifications enabled for admin');
        }
      }
    };

    initializeNotifications();
  }, [auth.currentUser]);

  // Request notification permission
  const requestNotificationPermission = async () => {
    const enabled = await notificationManager.requestPermission(auth.currentUser.uid);
    setNotificationsEnabled(enabled);
    
    if (enabled) {
      showNotification('🔔 Notifications enabled! You will receive alerts for new requests.', 'success');
    } else {
      showNotification('❌ Please enable notifications in your browser settings to receive alerts.', 'warning');
    }
  };

  // Helper functions for shift-based tracking
  const getShiftDate = (timestamp) => {
    const date = new Date(timestamp);
    if (date.getHours() >= 18) {
      date.setDate(date.getDate() + 1);
    }
    return date.toDateString();
  };

  // Real-time Firestore listener with shift support
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

  // Listen for pending requests
  useEffect(() => {
    // Listen for OT requests
    const otQuery = query(
      collection(db, "adjustmentRequests"), 
      orderBy("requestedAt", "desc")
    );
    
    const otUnsubscribe = onSnapshot(otQuery, (snapshot) => {
      const pendingOT = snapshot.docs.filter(doc => 
        doc.data().status === 'pending'
      ).length;
      setPendingRequests(prev => ({ ...prev, ot: pendingOT }));
    });

    // Listen for advance requests
    const advanceQuery = query(
      collection(db, "advanceRequests"), 
      orderBy("requestDate", "desc")
    );
    
    const advanceUnsubscribe = onSnapshot(advanceQuery, (snapshot) => {
      const pendingAdvance = snapshot.docs.filter(doc => 
        doc.data().status === 'pending'
      ).length;
      setPendingRequests(prev => ({ ...prev, advance: pendingAdvance }));
    });

    return () => {
      otUnsubscribe();
      advanceUnsubscribe();
    };
  }, []);

  // Filter sessions by shift date instead of calendar date
  const filteredSessions = allSessions.filter(
    (s) => getShiftDate(s.clockIn) === new Date(selectedDate).toDateString()
  );

  // Staff summary calculation with shift support
  const staffSummary = {};
  filteredSessions.forEach((session) => {
    if (!staffSummary[session.staffUid]) {
      staffSummary[session.staffUid] = {
        staffName: session.staffName,
        staffId: session.staffId,
        totalHours: 0,
        sessions: 0,
        nightShifts: 0,
        crossMidnight: 0,
        lastActivity: session.clockIn,
      };
    }

    if (session.clockOut) {
      staffSummary[session.staffUid].totalHours += session.totalHours || 0;
    }
    staffSummary[session.staffUid].sessions += 1;
    if (session.isNightShift) {
      staffSummary[session.staffUid].nightShifts += 1;
    }
    if (session.crossMidnight) {
      staffSummary[session.staffUid].crossMidnight += 1;
    }
  });

  // Navigation
  const isActiveRoute = (path) => location.pathname === path;

  // Enhanced PDF Export with progress tracking
  const exportToPDF = async () => {
    setLoading(true);
    setExportProgress(0);
    
    try {
      const doc = new jsPDF();
      setExportProgress(20);

      // Professional Header with branding
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 50, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text("CAFE PIRANHA", 105, 20, { align: "center" });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text("Staff Attendance Report", 105, 28, { align: "center" });
      
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(10);
      doc.text(`Shift Date: ${new Date(selectedDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`, 105, 35, { align: "center" });
      
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 41, { align: "center" });
      
      setExportProgress(40);

      let y = 60;

      // Executive Summary Section
      if (Object.keys(staffSummary).length > 0) {
        doc.setFillColor(59, 130, 246);
        doc.rect(14, y, 182, 8, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("EXECUTIVE SUMMARY", 20, y + 5.5);
        
        y += 15;

        const summaryData = [
          ['Total Staff', Object.keys(staffSummary).length],
          ['Active Sessions', activeStaff.length],
          ['Total Hours', `${stats.totalHours.toFixed(1)}h`],
          ['Night Shifts', stats.nightShifts],
          ['Cross Midnight', stats.crossMidnight],
          ['Location Verified', stats.locationVerified]
        ];

        autoTable(doc, {
          startY: y,
          head: [['Metric', 'Value']],
          body: summaryData,
          theme: 'grid',
          headStyles: { 
            fillColor: [30, 41, 59],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: { 
            fontSize: 10,
            cellPadding: 3
          },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 15;
      }

      setExportProgress(60);

      // Staff Performance Table
      if (Object.keys(staffSummary).length > 0) {
        doc.setFillColor(74, 124, 89);
        doc.rect(14, y, 182, 8, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("STAFF PERFORMANCE", 20, y + 5.5);
        
        y += 15;

        const summaryData = Object.entries(staffSummary).map(
          ([uid, data]) => [
            data.staffName,
            data.staffId,
            data.sessions.toString(),
            `${data.totalHours.toFixed(2)}h`,
            data.nightShifts.toString(),
            data.crossMidnight.toString(),
            new Date(data.lastActivity).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }),
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
              "Night Shifts",
              "Cross Midnight",
              "Last Activity",
            ],
          ],
          body: summaryData,
          theme: "grid",
          headStyles: { 
            fillColor: [30, 41, 59],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: { 
            fontSize: 8,
            cellPadding: 2
          },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 15;
      }

      setExportProgress(80);

      // Detailed Sessions Table
      if (filteredSessions.length > 0) {
        doc.setFillColor(139, 92, 246);
        doc.rect(14, y, 182, 8, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("DETAILED SESSIONS", 20, y + 5.5);
        
        y += 15;

        const sessionData = filteredSessions.map((s) => [
          s.staffName,
          s.staffId,
          formatTime(s.clockIn),
          s.clockOut ? formatTime(s.clockOut) : 'Active',
          s.clockOut ? formatDuration(s.duration) : 'In Progress',
          s.clockOut ? "Completed" : "Active",
          s.isNightShift ? "🌙 Yes" : "No",
          s.crossMidnight ? "⏰ Yes" : "No",
          s.location?.verified ? "✅" : "❌",
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
              "Location",
            ],
          ],
          body: sessionData,
          theme: "grid",
          headStyles: { 
            fillColor: [30, 41, 59],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: { 
            fontSize: 7,
            cellPadding: 1
          },
          margin: { left: 14, right: 14 },
        });
      }

      setExportProgress(100);

      // Add professional footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${pageCount} • Cafe Piranha Staff Management System`,
          105,
          290,
          { align: "center" }
        );
      }

      doc.save(`cafe-piranha-report-${selectedDate}.pdf`);
      showNotification("PDF report generated successfully!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Error generating PDF: " + err.message, "error");
    } finally {
      setLoading(false);
      setExportProgress(0);
    }
  };

  // Enhanced CSV Export
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
        "Night Shift",
        "Cross Midnight",
        "Location Verified",
        "Location Distance"
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
        s.isNightShift ? "Yes" : "No",
        s.crossMidnight ? "Yes" : "No",
        s.location?.verified ? "Yes" : "No",
        s.location?.distance ? `${s.location.distance.toFixed(1)}m` : "N/A"
      ]);
      const csv = [headers, ...data]
        .map((r) => r.map((f) => `"${f}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `cafe-piranha-attendance-${selectedDate}.csv`;
      link.click();
      showNotification("CSV data exported successfully!", "success");
    } catch (err) {
      showNotification("Error exporting CSV: " + err.message, "error");
    }
  };

  // Enhanced Delete All Data with confirmation steps
  const clearAllData = async () => {
    const confirmClear = window.confirm(
      "🚨 CRITICAL ADMIN ACTION\n\nThis will PERMANENTLY DELETE ALL attendance records from the system.\n\nThis action cannot be undone and will affect all historical data."
    );
    if (!confirmClear) return;
    
    const userInput = prompt('Type "DELETE ALL DATA" to confirm permanent deletion:');
    if (userInput !== "DELETE ALL DATA") {
      showNotification("Data deletion cancelled", "info");
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
      showNotification(`Successfully deleted ${count} attendance records`, "success");
    } catch (err) {
      showNotification("Error deleting data: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Enhanced Delete Selected Date Data
  const clearDateData = async () => {
    if (!window.confirm(
      `Clear attendance data for ${new Date(selectedDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}?\n\nThis will remove ${filteredSessions.length} session records.`
    )) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      filteredSessions.forEach((s) => {
        batch.delete(doc(db, "sessions", s.id));
        count++;
      });
      await batch.commit();
      showNotification(`Deleted ${count} records for selected date`, "success");
    } catch (err) {
      showNotification("Error clearing date data: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Notification system
  const showNotification = (message, type = "info") => {
    // In a real app, you'd use a proper notification system
    const bgColor = type === "success" ? "#10b981" : 
                   type === "error" ? "#ef4444" : 
                   type === "warning" ? "#f59e0b" : "#3b82f6";
    
    console.log(`%c${type.toUpperCase()}: ${message}`, 
      `background: ${bgColor}; color: white; padding: 8px; border-radius: 4px;`);
    
    alert(`${type.toUpperCase()}: ${message}`);
  };

  // Helper functions
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

  // Calculate comprehensive statistics
  const stats = {
    totalStaff: Object.keys(staffSummary).length,
    activeStaff: activeStaff.length,
    totalSessions: filteredSessions.length,
    nightShifts: filteredSessions.filter(s => s.isNightShift).length,
    crossMidnight: filteredSessions.filter(s => s.crossMidnight).length,
    locationVerified: filteredSessions.filter(s => s.location?.verified).length,
    totalHours: filteredSessions.reduce((sum, s) => sum + (s.totalHours || 0), 0),
    avgSessionLength: filteredSessions.length > 0 
      ? filteredSessions.reduce((sum, s) => sum + (s.totalHours || 0), 0) / filteredSessions.length 
      : 0
  };

  return (
    <div className="admin-dashboard">
      {/* Professional Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="brand-section">
            <div className="brand-logo">🏪</div>
            <div className="brand-info">
              <h1 className="brand-title">Cafe Piranha</h1>
              <span className="brand-subtitle">Admin Dashboard</span>
            </div>
          </div>
          
          <div className="header-controls">
            <div className="live-status">
              <span className="status-indicator"></span>
              <span className="status-text">Live Data</span>
            </div>
            <div className="current-date">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric',
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Notifications Section */}
        <section className="notifications-section">
          <div className="notification-prompt-card">
            <div className="notification-header">
              <div className="notification-icon">🔔</div>
              <div className="notification-content">
                <h3>Push Notifications</h3>
                <p>Get instant alerts for new requests even when the app is closed</p>
              </div>
              <div className={`notification-status ${notificationsEnabled ? 'enabled' : 'disabled'}`}>
                {notificationsEnabled ? '✅ Enabled' : '🔕 Disabled'}
              </div>
            </div>
            
            {!notificationsEnabled && (
              <button 
                className="btn-enable-notifications"
                onClick={requestNotificationPermission}
              >
                <span className="btn-icon">🔔</span>
                <span className="btn-text">Enable Push Notifications</span>
              </button>
            )}
            
            {/* Pending Requests Badges */}
            <div className="pending-requests-badges">
              {(pendingRequests.ot > 0 || pendingRequests.advance > 0) && (
                <>
                  {pendingRequests.ot > 0 && (
                    <div className="pending-badge ot">
                      <span className="badge-icon">🕒</span>
                      <span className="badge-text">{pendingRequests.ot} OT Requests</span>
                    </div>
                  )}
                  {pendingRequests.advance > 0 && (
                    <div className="pending-badge advance">
                      <span className="badge-icon">💰</span>
                      <span className="badge-text">{pendingRequests.advance} Advance Requests</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Key Metrics Section */}
        <section className="metrics-section">
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon total-staff">👥</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.totalStaff}</h3>
                <p className="metric-label">Staff Today</p>
                <span className="metric-subtext">{stats.totalSessions} sessions</span>
              </div>
            </div>
            
            <div className="metric-card highlight">
              <div className="metric-icon active-staff">🟢</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.activeStaff}</h3>
                <p className="metric-label">Active Now</p>
                <span className="metric-subtext">Currently working</span>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon total-hours">⏱️</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.totalHours.toFixed(1)}h</h3>
                <p className="metric-label">Total Hours</p>
                <span className="metric-subtext">{stats.avgSessionLength.toFixed(1)}h avg</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon night-shifts">🌙</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.nightShifts}</h3>
                <p className="metric-label">Night Shifts</p>
                <span className="metric-subtext">{stats.crossMidnight} cross midnight</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="navigation-section">
          <div className="tab-navigation">
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
              <span className="tab-text">Active Staff</span>
              {activeStaff.length > 0 && (
                <span className="tab-badge">{activeStaff.length}</span>
              )}
            </button>
            <button 
              className={`tab-btn ${activeTab === "sessions" ? "active" : ""}`}
              onClick={() => setActiveTab("sessions")}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-text">All Sessions</span>
              <span className="tab-badge">{filteredSessions.length}</span>
            </button>
          </div>
        </section>

        {/* Date Filter Section */}
        <section className="filter-section">
          <div className="filter-card">
            <div className="filter-header">
              <h3>Shift Date Selection</h3>
              <div className="date-display">
                {new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            <div className="date-controls">
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-input"
              />
              <div className="shift-info">
                <span className="info-icon">💡</span>
                Shifts after 6PM count for next day
              </div>
            </div>
          </div>
        </section>

        {/* Tab Content */}
        <div className="tab-content">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="tab-panel">
              {/* Active Staff Panel */}
              <section className="content-section">
                <div className="section-header">
                  <h2>Currently Working</h2>
                  <div className="section-badge success">
                    {activeStaff.length} Active
                  </div>
                </div>
                
                {activeStaff.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">👥</div>
                    <h3>No Active Staff</h3>
                    <p>No team members are currently clocked in</p>
                  </div>
                ) : (
                  <div className="active-staff-grid">
                    {activeStaff.map((staff) => (
                      <div key={staff.id} className="active-staff-card">
                        <div className="staff-avatar">
                          {staff.staffName?.charAt(0).toUpperCase()}
                        </div>
                        <div className="staff-details">
                          <h4 className="staff-name">{staff.staffName}</h4>
                          <p className="staff-id">ID: {staff.staffId}</p>
                          <div className="session-info">
                            <div className="live-timer-container">
                              <LiveTimer startTime={new Date(staff.clockIn)} />
                            </div>
                            <div className="session-tags">
                              {staff.isNightShift && (
                                <span className="tag night">🌙 Night Shift</span>
                              )}
                              {staff.location?.verified && (
                                <span className="tag verified">📍 Verified</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="active-indicator"></div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Staff Summary Panel */}
              <section className="content-section">
                <div className="section-header">
                  <h2>Staff Performance Summary</h2>
                  <div className="section-badge">
                    {Object.keys(staffSummary).length} Staff
                  </div>
                </div>
                
                {Object.keys(staffSummary).length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>No Activity Data</h3>
                    <p>No staff activity recorded for selected shift date</p>
                  </div>
                ) : (
                  <div className="staff-summary-grid">
                    {Object.entries(staffSummary).map(([uid, data]) => (
                      <div key={uid} className="summary-card">
                        <div className="summary-header">
                          <div className="staff-info">
                            <h4 className="staff-name">{data.staffName}</h4>
                            <span className="staff-tag">ID: {data.staffId}</span>
                          </div>
                          <div className="total-hours-display">
                            {data.totalHours.toFixed(1)}h
                          </div>
                        </div>
                        <div className="summary-stats">
                          <div className="stat-row">
                            <span className="stat-label">Sessions:</span>
                            <span className="stat-value">{data.sessions}</span>
                          </div>
                          <div className="stat-row">
                            <span className="stat-label">Night Shifts:</span>
                            <span className="stat-value">{data.nightShifts}</span>
                          </div>
                          <div className="stat-row">
                            <span className="stat-label">Cross Midnight:</span>
                            <span className="stat-value">{data.crossMidnight}</span>
                          </div>
                          <div className="stat-row">
                            <span className="stat-label">Last Activity:</span>
                            <span className="stat-value time">
                              {formatTime(data.lastActivity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Active Staff Tab */}
          {activeTab === "active" && (
            <div className="tab-panel">
              <section className="content-section">
                <div className="section-header">
                  <h2>Active Staff Members</h2>
                  <div className="section-badge success">
                    {activeStaff.length} Currently Working
                  </div>
                </div>
                
                {activeStaff.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🟢</div>
                    <h3>All Staff Clocked Out</h3>
                    <p>No active sessions at the moment</p>
                  </div>
                ) : (
                  <div className="active-staff-detailed-grid">
                    {activeStaff.map((staff) => (
                      <div key={staff.id} className="active-staff-detailed-card">
                        <div className="card-header">
                          <div className="staff-avatar-large">
                            {staff.staffName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="staff-main-info">
                            <h3 className="staff-name">{staff.staffName}</h3>
                            <p className="staff-id">Employee ID: {staff.staffId}</p>
                          </div>
                          <div className="active-status-indicator">
                            <div className="pulse-dot"></div>
                            <span>Active</span>
                          </div>
                        </div>
                        
                        <div className="card-content">
                          <div className="session-duration">
                            <span className="duration-label">Current Session:</span>
                            <div className="live-timer-large">
                              <LiveTimer startTime={new Date(staff.clockIn)} />
                            </div>
                          </div>
                          
                          <div className="session-meta">
                            <div className="meta-item">
                              <span className="meta-label">Clock In:</span>
                              <span className="meta-value">{formatTime(staff.clockIn)}</span>
                            </div>
                            {staff.location && (
                              <div className="meta-item">
                                <span className="meta-label">Location:</span>
                                <span className={`meta-value ${staff.location.verified ? 'verified' : 'unverified'}`}>
                                  {staff.location.verified ? '✅ Verified' : '❌ Unverified'}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="session-tags">
                            {staff.isNightShift && (
                              <span className="tag large night">🌙 Night Shift</span>
                            )}
                            {staff.crossMidnight && (
                              <span className="tag large warning">⏰ Cross Midnight</span>
                            )}
                            {staff.location?.verified && (
                              <span className="tag large success">📍 Location Verified</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === "sessions" && (
            <div className="tab-panel">
              <section className="content-section">
                <div className="section-header">
                  <h2>Session Details</h2>
                  <div className="section-badge">
                    {filteredSessions.length} Total Sessions
                  </div>
                </div>
                
                {filteredSessions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No Sessions Recorded</h3>
                    <p>No attendance sessions for selected shift date</p>
                  </div>
                ) : (
                  <div className="sessions-timeline">
                    {filteredSessions.map((session) => (
                      <div key={session.id} className={`session-card ${!session.clockOut ? 'active' : ''}`}>
                        <div className="session-header">
                          <div className="session-staff">
                            <h4 className="staff-name">{session.staffName}</h4>
                            <p className="staff-id">ID: {session.staffId}</p>
                          </div>
                          <div className={`session-status ${!session.clockOut ? 'active' : 'completed'}`}>
                            {!session.clockOut ? (
                              <>
                                <div className="status-dot"></div>
                                Active
                              </>
                            ) : (
                              'Completed'
                            )}
                          </div>
                        </div>
                        
                        <div className="session-timeline">
                          <div className="time-block">
                            <span className="time-label">Clock In</span>
                            <span className="time-value">{formatTime(session.clockIn)}</span>
                          </div>
                          
                          {session.clockOut ? (
                            <div className="time-block">
                              <span className="time-label">Clock Out</span>
                            <span className="time-value">{formatTime(session.clockOut)}</span>
                            </div>
                          ) : (
                            <div className="time-block active">
                              <span className="time-label">Current Duration</span>
                              <span className="time-value">
                                <LiveTimer startTime={new Date(session.clockIn)} />
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="session-footer">
                          <div className="session-metrics">
                            {session.clockOut && (
                              <div className="metric">
                                <span className="metric-label">Duration:</span>
                                <span className="metric-value">{formatDuration(session.duration)}</span>
                              </div>
                            )}
                            <div className="metric">
                              <span className="metric-label">Total Hours:</span>
                              <span className="metric-value">
                                {session.totalHours?.toFixed(1) || '0.0'}h
                              </span>
                            </div>
                          </div>
                          
                          <div className="session-tags">
                            {session.isNightShift && <span className="tag">🌙 Night</span>}
                            {session.crossMidnight && <span className="tag">⏰ Cross Midnight</span>}
                            {session.location?.verified ? (
                              <span className="tag success">📍 Verified</span>
                            ) : (
                              <span className="tag error">📍 Unverified</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Data Management Section */}
        <section className="management-section">
          <div className="section-header">
            <h2>Data Management</h2>
            <div className="admin-badge">Administrator</div>
          </div>
          
          <div className="management-actions">
            <div className="action-group">
              <h4 className="action-group-title">Export Reports</h4>
              <div className="action-buttons">
                <button 
                  className={`btn-primary ${loading ? 'loading' : ''}`}
                  onClick={exportToPDF}
                  disabled={loading}
                >
                  {loading && exportProgress > 0 ? (
                    <>
                      <div className="progress-ring">
                        <div 
                          className="progress-fill"
                          style={{ transform: `rotate(${exportProgress * 3.6}deg)` }}
                        ></div>
                      </div>
                      <span>Generating {exportProgress}%</span>
                    </>
                  ) : (
                    <>
                      <span className="btn-icon">📊</span>
                      <span>Export PDF Report</span>
                    </>
                  )}
                </button>
                
                <button 
                  className="btn-secondary"
                  onClick={exportToCSV}
                  disabled={loading}
                >
                  <span className="btn-icon">📈</span>
                  <span>Export CSV Data</span>
                </button>
              </div>
            </div>
            
            <div className="action-group">
              <h4 className="action-group-title">Data Management</h4>
              <div className="action-buttons">
                <button 
                  className="btn-outline"
                  onClick={clearDateData}
                  disabled={loading}
                >
                  <span className="btn-icon">🗑️</span>
                  <span>Clear Date Data</span>
                </button>
                
                <button 
                  className="btn-danger"
                  onClick={clearAllData}
                  disabled={loading}
                >
                  <span className="btn-icon">🚨</span>
                  <span>Clear All Data</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Data Summary */}
          <div className="data-summary">
            <h4 className="summary-title">Shift Summary</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Staff Count</span>
                <span className="summary-value">{stats.totalStaff}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Sessions</span>
                <span className="summary-value">{stats.totalSessions}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Active Now</span>
                <span className="summary-value">{stats.activeStaff}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Night Shifts</span>
                <span className="summary-value">{stats.nightShifts}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Location Verified</span>
                <span className="summary-value">{stats.locationVerified}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Hours</span>
                <span className="summary-value">{stats.totalHours.toFixed(1)}h</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Professional Bottom Navigation */}
      <nav className="bottom-navigation">
        <button 
          className={`nav-btn ${isActiveRoute('/admin') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/salary')}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-label">Salary</span>
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/advances') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/advances')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Advances</span>
          {pendingRequests.advance > 0 && (
            <span className="nav-badge">{pendingRequests.advance}</span>
          )}
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/ot-approvals') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/ot-approvals')}
        >
          <span className="nav-icon">🕒</span>
          <span className="nav-label">Adjustments</span>
          {pendingRequests.ot > 0 && (
            <span className="nav-badge">{pendingRequests.ot}</span>
          )}
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Availability</span>
        </button>
        
        <button className="nav-btn logout" onClick={onLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </div>
  );
}

// Enhanced Live Timer Component
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