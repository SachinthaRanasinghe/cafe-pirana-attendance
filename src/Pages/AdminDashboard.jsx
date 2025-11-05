import { useState, useEffect } from "react";
import "./AdminDashboard.css";

export default function AdminDashboard({ onLogout }) {
  const [reports, setReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffSummary, setStaffSummary] = useState({});

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    calculateStaffSummary();
  }, [reports, selectedDate]);

  const loadReports = () => {
    const savedReports = JSON.parse(localStorage.getItem('adminReports') || '[]');
    setReports(savedReports);
  };

  const calculateStaffSummary = () => {
    const filteredReports = reports.filter(report => 
      report.date === new Date(selectedDate).toDateString()
    );

    const summary = {};
    filteredReports.forEach(report => {
      if (!summary[report.staffId]) {
        summary[report.staffId] = {
          staffName: report.staffName,
          totalHours: 0,
          sessions: 0,
          lastActivity: null
        };
      }
      
      summary[report.staffId].totalHours += report.totalHours;
      summary[report.staffId].sessions += 1;
      
      const sessionTime = new Date(report.clockOut);
      if (!summary[report.staffId].lastActivity || sessionTime > new Date(summary[report.staffId].lastActivity)) {
        summary[report.staffId].lastActivity = report.clockOut;
      }
    });

    setStaffSummary(summary);
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (hours) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const clearAllData = () => {
    if (window.confirm("Are you sure you want to clear ALL data? This cannot be undone!")) {
      localStorage.removeItem('adminReports');
      setReports([]);
      setStaffSummary({});
      alert("All data has been cleared.");
    }
  };

  const exportToCSV = () => {
    const filteredReports = reports.filter(report => 
      report.date === new Date(selectedDate).toDateString()
    );

    if (filteredReports.length === 0) {
      alert("No data to export for selected date.");
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + "Staff Name,Staff ID,Date,Clock In,Clock Out,Duration (Hours),Total Hours\n"
      + filteredReports.map(report => 
          `"${report.staffName}","${report.staffId}","${report.date}","${formatTime(report.clockIn)}","${formatTime(report.clockOut)}","${formatDuration(report.totalHours)}","${report.totalHours.toFixed(2)}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cafe_pirana_report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const filteredReports = reports.filter(report => 
    report.date === new Date(selectedDate).toDateString()
  );

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-info">
          <h1>🏢 Cafe Pirana - Admin Dashboard</h1>
          <p>Staff Attendance & Time Tracking System</p>
        </div>
        <div className="admin-actions">
          <button className="logout-btn" onClick={onLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-section">
        <div className="control-group">
          <label htmlFor="dateFilter">Select Date:</label>
          <input 
            id="dateFilter"
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="control-buttons">
          <button className="export-btn" onClick={exportToCSV}>
            📥 Export CSV
          </button>
          <button className="refresh-btn" onClick={loadReports}>
            🔄 Refresh
          </button>
          <button className="clear-btn" onClick={clearAllData}>
            🗑️ Clear All Data
          </button>
        </div>
      </div>

      {/* Staff Summary */}
      <div className="summary-section">
        <h2>👥 Staff Summary - {new Date(selectedDate).toDateString()}</h2>
        {Object.keys(staffSummary).length === 0 ? (
          <div className="no-data">
            <p>No staff activity recorded for selected date.</p>
          </div>
        ) : (
          <div className="staff-cards">
            {Object.entries(staffSummary).map(([staffId, data]) => (
              <div key={staffId} className="staff-card">
                <div className="staff-header">
                  <h3>{data.staffName}</h3>
                  <span className="staff-id">ID: {staffId}</span>
                </div>
                <div className="staff-stats">
                  <div className="stat">
                    <span className="stat-label">Total Hours:</span>
                    <span className="stat-value">{data.totalHours.toFixed(2)}h</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Sessions:</span>
                    <span className="stat-value">{data.sessions}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Last Activity:</span>
                    <span className="stat-value">{formatTime(data.lastActivity)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Reports */}
      <div className="reports-section">
        <h2>📋 Detailed Session Reports</h2>
        {filteredReports.length === 0 ? (
          <div className="no-data">
            <p>No session reports for selected date.</p>
          </div>
        ) : (
          <div className="reports-table">
            <div className="table-header">
              <div>Staff Name</div>
              <div>Clock In</div>
              <div>Clock Out</div>
              <div>Duration</div>
              <div>Total Hours</div>
            </div>
            {filteredReports.map((report, index) => (
              <div key={index} className="table-row">
                <div className="staff-info">
                  <strong>{report.staffName}</strong>
                  <small>ID: {report.staffId}</small>
                </div>
                <div>{formatTime(report.clockIn)}</div>
                <div>{formatTime(report.clockOut)}</div>
                <div>{formatDuration(report.totalHours)}</div>
                <div><strong>{report.totalHours.toFixed(2)}h</strong></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="stats-section">
        <h2>📊 Daily Statistics</h2>
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>Active Staff</h3>
              <p className="stat-number">{Object.keys(staffSummary).length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-content">
              <h3>Total Sessions</h3>
              <p className="stat-number">{filteredReports.length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🕒</div>
            <div className="stat-content">
              <h3>Total Hours</h3>
              <p className="stat-number">
                {filteredReports.reduce((total, report) => total + report.totalHours, 0).toFixed(2)}h
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}