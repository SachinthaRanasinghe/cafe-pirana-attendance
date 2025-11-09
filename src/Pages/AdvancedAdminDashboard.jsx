import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  collection, onSnapshot, query, orderBy, where, 
  getDocs, writeBatch, doc, deleteDoc, getDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer,
  AreaChart, Area 
} from 'recharts';
import { CSVLink } from 'react-csv';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import "./AdvancedAdminDashboard.css";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AdvancedAdminDashboard({ onLogout }) {
  const [allSessions, setAllSessions] = useState([]);
  const [activeStaff, setActiveStaff] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [realTimeStats, setRealTimeStats] = useState({
    totalHoursToday: 0,
    avgSessionDuration: 0,
    productivityScore: 0,
    activeStaffCount: 0,
    completedSessions: 0
  });
  const [notifications, setNotifications] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState(new Set());

  // Enhanced real-time listener
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('clockIn', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setLoading(true);
        const sessions = [];
        const active = [];
        
        snapshot.forEach((doc) => {
          const sessionData = doc.data();
          const session = { 
            id: doc.id, 
            ...sessionData,
            clockInDate: new Date(sessionData.clockIn),
            clockOutDate: sessionData.clockOut ? new Date(sessionData.clockOut) : null,
            durationMs: sessionData.clockOut ? 
              new Date(sessionData.clockOut) - new Date(sessionData.clockIn) : 0
          };
          sessions.push(session);
          
          if (!sessionData.clockOut) {
            active.push(session);
          }
        });
        
        setAllSessions(sessions);
        setActiveStaff(active);
        calculateRealTimeStats(sessions, active);
        checkForAlerts(sessions, active);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore error:', error);
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'error',
          message: 'Failed to load data',
          timestamp: new Date()
        }]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Advanced filtering
  const filteredSessions = useMemo(() => {
    let filtered = allSessions;

    // Date range filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= new Date(dateRange.start) && 
               sessionDate <= new Date(dateRange.end);
      });
    }

    // Staff filter
    if (selectedStaff !== 'all') {
      filtered = filtered.filter(session => session.staffId === selectedStaff);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(session =>
        session.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.staffId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [allSessions, selectedStaff, searchTerm, dateRange]);

  // Enhanced staff analytics
  const staffAnalytics = useMemo(() => {
    const analytics = {};
    const today = new Date().toDateString();
    
    filteredSessions.forEach(session => {
      const staffId = session.staffId;
      
      if (!analytics[staffId]) {
        analytics[staffId] = {
          staffName: session.staffName,
          totalHours: 0,
          sessions: 0,
          avgSessionDuration: 0,
          lastActivity: session.clockIn,
          todayHours: 0,
          efficiency: 0,
          sessionsToday: 0,
          totalEarnings: 0,
          overtimeHours: 0
        };
      }
      
      const sessionHours = session.clockOut ? 
        (session.durationMs / (1000 * 60 * 60)) : 0;
      
      analytics[staffId].totalHours += sessionHours;
      analytics[staffId].sessions += 1;
      
      // Calculate earnings (assuming $15/hour)
      analytics[staffId].totalEarnings += sessionHours * 15;
      
      // Overtime calculation (over 8 hours)
      if (sessionHours > 8) {
        analytics[staffId].overtimeHours += (sessionHours - 8);
      }
      
      if (session.date === today) {
        analytics[staffId].todayHours += sessionHours;
        analytics[staffId].sessionsToday += 1;
      }
    });

    // Calculate averages and efficiency
    Object.keys(analytics).forEach(staffId => {
      const staff = analytics[staffId];
      staff.avgSessionDuration = staff.sessions > 0 ? 
        (staff.totalHours / staff.sessions) : 0;
      staff.efficiency = Math.min(100, (staff.totalHours / (staff.sessions * 8)) * 100);
    });

    return analytics;
  }, [filteredSessions]);

  // Chart data preparation
  const chartData = useMemo(() => {
    // Hourly activity data
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      staffCount: 0,
      sessions: 0,
      productivity: 0
    }));

    // Staff performance for bar chart
    const staffPerformance = Object.entries(staffAnalytics).map(([id, data]) => ({
      name: data.staffName.substring(0, 12) + (data.staffName.length > 12 ? '...' : ''),
      hours: parseFloat(data.totalHours.toFixed(1)),
      sessions: data.sessions,
      efficiency: parseFloat(data.efficiency.toFixed(1)),
      earnings: parseFloat(data.totalEarnings.toFixed(0))
    }));

    // Daily summary for line chart
    const dailyData = {};
    filteredSessions.forEach(session => {
      const date = session.date;
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          totalHours: 0,
          sessions: 0,
          staffCount: new Set()
        };
      }
      dailyData[date].totalHours += session.clockOut ? 
        (session.durationMs / (1000 * 60 * 60)) : 0;
      dailyData[date].sessions += 1;
      dailyData[date].staffCount.add(session.staffId);
    });

    const dailyChartData = Object.values(dailyData).map(day => ({
      date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: parseFloat(day.totalHours.toFixed(1)),
      sessions: day.sessions,
      staff: day.staffCount.size
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate hourly data
    filteredSessions.forEach(session => {
      const hour = new Date(session.clockIn).getHours();
      hourlyData[hour].staffCount++;
      hourlyData[hour].sessions++;
    });

    return { 
      hourlyData: hourlyData.slice(6, 22), // 6 AM to 10 PM
      staffPerformance, 
      dailyChartData 
    };
  }, [filteredSessions, staffAnalytics]);

  const calculateRealTimeStats = (sessions, active) => {
    const todaySessions = sessions.filter(s => s.date === new Date().toDateString());
    const totalHours = todaySessions.reduce((sum, session) => 
      sum + (session.clockOut ? session.durationMs / (1000 * 60 * 60) : 0), 0);
    
    const completedSessions = todaySessions.filter(s => s.clockOut);
    const avgDuration = completedSessions.length > 0 ? 
      totalHours / completedSessions.length : 0;

    setRealTimeStats({
      totalHoursToday: parseFloat(totalHours.toFixed(2)),
      avgSessionDuration: parseFloat(avgDuration.toFixed(2)),
      productivityScore: Math.min(100, (totalHours / (active.length * 8)) * 100),
      activeStaffCount: active.length,
      completedSessions: completedSessions.length
    });
  };

  const checkForAlerts = (sessions, active) => {
    const newNotifications = [];
    const today = new Date().toDateString();
    
    // Check for long active sessions (over 10 hours)
    active.forEach(session => {
      const durationHours = (new Date() - new Date(session.clockIn)) / (1000 * 60 * 60);
      if (durationHours > 10) {
        newNotifications.push({
          id: Date.now() + Math.random(),
          type: 'warning',
          message: `${session.staffName} has been working for ${durationHours.toFixed(1)} hours`,
          timestamp: new Date()
        });
      }
    });

    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev.slice(0, 9)]);
    }
  };

  // Export functionality
  const exportData = useMemo(() => {
    return filteredSessions.map(session => ({
      'Staff Name': session.staffName,
      'Staff ID': session.staffId,
      'Date': session.date,
      'Clock In': formatTime(session.clockIn),
      'Clock Out': session.clockOut ? formatTime(session.clockOut) : 'Active',
      'Duration (hours)': session.clockOut ? (session.durationMs / (1000 * 60 * 60)).toFixed(2) : 'N/A',
      'Status': session.clockOut ? 'Completed' : 'Active',
      'Earnings': session.clockOut ? ((session.durationMs / (1000 * 60 * 60)) * 15).toFixed(2) : 'N/A'
    }));
  }, [filteredSessions]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Staff Attendance Report', 20, 20);
    doc.autoTable({
      head: [['Staff Name', 'Staff ID', 'Date', 'Clock In', 'Clock Out', 'Duration', 'Status']],
      body: filteredSessions.map(session => [
        session.staffName,
        session.staffId,
        session.date,
        formatTime(session.clockIn),
        session.clockOut ? formatTime(session.clockOut) : 'Active',
        session.clockOut ? (session.durationMs / (1000 * 60 * 60)).toFixed(2) + 'h' : 'N/A',
        session.clockOut ? 'Completed' : 'Active'
      ])
    });
    doc.save('staff-report.pdf');
  };

  const handleBulkDelete = async () => {
    if (selectedSessions.size === 0) return;
    
    const confirm = window.confirm(`Delete ${selectedSessions.size} sessions?`);
    if (!confirm) return;

    const batch = writeBatch(db);
    selectedSessions.forEach(sessionId => {
      const sessionRef = doc(db, 'sessions', sessionId);
      batch.delete(sessionRef);
    });

    try {
      await batch.commit();
      setSelectedSessions(new Set());
      setNotifications(prev => [{
        id: Date.now(),
        type: 'success',
        message: `Deleted ${selectedSessions.size} sessions`,
        timestamp: new Date()
      }, ...prev]);
    } catch (error) {
      setNotifications(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Failed to delete sessions',
        timestamp: new Date()
      }, ...prev]);
    }
  };

  const toggleSessionSelection = (sessionId) => {
    const newSelection = new Set(selectedSessions);
    if (newSelection.has(sessionId)) {
      newSelection.delete(sessionId);
    } else {
      newSelection.add(sessionId);
    }
    setSelectedSessions(newSelection);
  };

  const selectAllSessions = () => {
    if (selectedSessions.size === filteredSessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(filteredSessions.map(s => s.id)));
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  return (
    <div className="advanced-admin-dashboard">
      <div className="dashboard-header">
        <div className="header-main">
          <h1>🏢 Cafe Pirana - Advanced Dashboard</h1>
          <p>Real-time Analytics & Staff Management</p>
          <div className="live-indicator">
            <span className="live-dot"></span>
            LIVE UPDATES
          </div>
        </div>
        
        <div className="header-stats">
          <div className="stat-card mini">
            <div className="stat-value">{realTimeStats.activeStaffCount}</div>
            <div className="stat-label">Active Now</div>
          </div>
          <div className="stat-card mini">
            <div className="stat-value">{realTimeStats.totalHoursToday}h</div>
            <div className="stat-label">Today's Hours</div>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="notifications-panel">
          {notifications.slice(0, 3).map(notif => (
            <div key={notif.id} className={`notification ${notif.type}`}>
              <span>{notif.message}</span>
              <button onClick={() => removeNotification(notif.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced Controls */}
      <div className="advanced-controls">
        <div className="control-group">
          <label>View Mode:</label>
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value)}
            className="control-select"
          >
            <option value="overview">Overview</option>
            <option value="analytics">Analytics</option>
            <option value="detailed">Detailed View</option>
            <option value="reports">Reports</option>
          </select>
        </div>

        <div className="control-group">
          <label>Date Range:</label>
          <input 
            type="date" 
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="control-input"
          />
          <span>to</span>
          <input 
            type="date" 
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="control-input"
          />
        </div>

        <div className="control-group">
          <label>Staff Member:</label>
          <select 
            value={selectedStaff} 
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="control-select"
          >
            <option value="all">All Staff</option>
            {Object.keys(staffAnalytics).map(staffId => (
              <option key={staffId} value={staffId}>
                {staffAnalytics[staffId].staffName}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Search:</label>
          <input 
            type="text" 
            placeholder="Search staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="control-input"
          />
        </div>

        <div className="control-group">
          <CSVLink 
            data={exportData} 
            filename={"staff-sessions.csv"}
            className="export-btn"
          >
            📊 Export CSV
          </CSVLink>
          <button onClick={exportPDF} className="export-btn">
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Dynamic Views */}
      {viewMode === 'overview' && (
        <OverviewView 
          activeStaff={activeStaff}
          staffAnalytics={staffAnalytics}
          chartData={chartData}
          realTimeStats={realTimeStats}
        />
      )}

      {viewMode === 'analytics' && (
        <AnalyticsView 
          chartData={chartData}
          staffAnalytics={staffAnalytics}
          filteredSessions={filteredSessions}
        />
      )}

      {viewMode === 'detailed' && (
        <DetailedView 
          filteredSessions={filteredSessions}
          staffAnalytics={staffAnalytics}
          selectedSessions={selectedSessions}
          toggleSessionSelection={toggleSessionSelection}
          selectAllSessions={selectAllSessions}
          handleBulkDelete={handleBulkDelete}
        />
      )}

      {viewMode === 'reports' && (
        <ReportsView 
          staffAnalytics={staffAnalytics}
          exportData={exportData}
          exportPDF={exportPDF}
        />
      )}
    </div>
  );
}

// Sub-components
function OverviewView({ activeStaff, staffAnalytics, chartData, realTimeStats }) {
  return (
    <div className="overview-view">
      {/* Real-time Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{realTimeStats.activeStaffCount}</div>
            <div className="stat-label">Staff Active</div>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">🕒</div>
          <div className="stat-content">
            <div className="stat-value">{realTimeStats.totalHoursToday}h</div>
            <div className="stat-label">Hours Today</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{realTimeStats.productivityScore}%</div>
            <div className="stat-label">Productivity</div>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{realTimeStats.completedSessions}</div>
            <div className="stat-label">Sessions</div>
          </div>
        </div>
      </div>

      <div className="overview-content">
        <div className="chart-section">
          <h3>Daily Activity Trend</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData.dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="hours" stroke="#8884d8" fill="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="active-staff-section">
          <h3>🟢 Currently Working</h3>
          {activeStaff.length === 0 ? (
            <div className="no-data">
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
      </div>
    </div>
  );
}

function AnalyticsView({ chartData, staffAnalytics, filteredSessions }) {
  return (
    <div className="analytics-view">
      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Staff Performance</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.staffPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="hours" fill="#8884d8" name="Total Hours" />
                <Bar dataKey="efficiency" fill="#82ca9d" name="Efficiency %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="analytics-card">
          <h3>Earnings Distribution</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.staffPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="earnings"
                >
                  {chartData.staffPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="analytics-card">
          <h3>Hourly Activity</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="staffCount" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailedView({ 
  filteredSessions, 
  staffAnalytics, 
  selectedSessions, 
  toggleSessionSelection, 
  selectAllSessions, 
  handleBulkDelete 
}) {
  return (
    <div className="detailed-view">
      <div className="section-header">
        <h3>Detailed Session View</h3>
        <div className="bulk-actions">
          <button 
            onClick={selectAllSessions}
            className="bulk-btn"
          >
            {selectedSessions.size === filteredSessions.length ? 'Deselect All' : 'Select All'}
          </button>
          {selectedSessions.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="bulk-btn delete"
            >
              🗑️ Delete Selected ({selectedSessions.size})
            </button>
          )}
        </div>
      </div>

      <div className="sessions-table">
        <div className="table-header">
          <div className="table-col select-col">
            <input 
              type="checkbox"
              checked={selectedSessions.size === filteredSessions.length && filteredSessions.length > 0}
              onChange={selectAllSessions}
            />
          </div>
          <div className="table-col staff-col">Staff</div>
          <div className="table-col date-col">Date</div>
          <div className="table-col time-col">Clock In</div>
          <div className="table-col time-col">Clock Out</div>
          <div className="table-col duration-col">Duration</div>
          <div className="table-col status-col">Status</div>
          <div className="table-col earnings-col">Earnings</div>
        </div>

        {filteredSessions.map(session => (
          <div key={session.id} className={`table-row ${!session.clockOut ? 'active-session' : ''}`}>
            <div className="table-col select-col">
              <input 
                type="checkbox"
                checked={selectedSessions.has(session.id)}
                onChange={() => toggleSessionSelection(session.id)}
              />
            </div>
            <div className="table-col staff-col">
              <strong>{session.staffName}</strong>
              <small>ID: {session.staffId}</small>
            </div>
            <div className="table-col date-col">{session.date}</div>
            <div className="table-col time-col">{formatTime(session.clockIn)}</div>
            <div className="table-col time-col">
              {session.clockOut ? formatTime(session.clockOut) : '—'}
            </div>
            <div className="table-col duration-col">
              {session.clockOut ? (
                formatDuration(session.durationMs)
              ) : (
                <LiveTimer startTime={new Date(session.clockIn)} />
              )}
            </div>
            <div className="table-col status-col">
              <span className={`status-badge ${session.clockOut ? 'completed' : 'active'}`}>
                {session.clockOut ? 'Completed' : 'Active'}
              </span>
            </div>
            <div className="table-col earnings-col">
              {session.clockOut ? 
                `$${((session.durationMs / (1000 * 60 * 60)) * 15).toFixed(2)}` : 
                '—'
              }
            </div>
          </div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="no-data">
            <p>No sessions found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsView({ staffAnalytics, exportData, exportPDF }) {
  return (
    <div className="reports-view">
      <div className="reports-header">
        <h3>📈 Performance Reports</h3>
        <div className="report-actions">
          <CSVLink 
            data={exportData} 
            filename={"staff-performance.csv"}
            className="report-btn primary"
          >
            📊 Export CSV Report
          </CSVLink>
          <button onClick={exportPDF} className="report-btn secondary">
            📄 Generate PDF Report
          </button>
        </div>
      </div>

      <div className="performance-cards">
        {Object.entries(staffAnalytics).map(([staffId, data]) => (
          <div key={staffId} className="performance-card">
            <div className="performance-header">
              <h4>{data.staffName}</h4>
              <span className="staff-id">{staffId}</span>
            </div>
            <div className="performance-stats">
              <div className="performance-stat">
                <span>Total Hours:</span>
                <strong>{data.totalHours.toFixed(1)}h</strong>
              </div>
              <div className="performance-stat">
                <span>Sessions:</span>
                <strong>{data.sessions}</strong>
              </div>
              <div className="performance-stat">
                <span>Avg. Session:</span>
                <strong>{data.avgSessionDuration.toFixed(1)}h</strong>
              </div>
              <div className="performance-stat">
                <span>Efficiency:</span>
                <strong>{data.efficiency.toFixed(1)}%</strong>
              </div>
              <div className="performance-stat">
                <span>Total Earnings:</span>
                <strong>${data.totalEarnings.toFixed(2)}</strong>
              </div>
              <div className="performance-stat">
                <span>Overtime:</span>
                <strong>{data.overtimeHours.toFixed(1)}h</strong>
              </div>
            </div>
            <div className="performance-footer">
              <div className="efficiency-bar">
                <div 
                  className="efficiency-fill"
                  style={{ width: `${data.efficiency}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Utility functions
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

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