// src/Pages/AdminDashboard/StaffAvailabilityView.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "../../firebase";
import "./StaffAvailabilityView.css";
import { useNavigate, useLocation } from "react-router-dom";
import { generateMonthlyReport } from "../../utils/pdfGenerator";

export default function StaffAvailabilityView({ onLogout }) {
  const [staffAvailabilities, setStaffAvailabilities] = useState([]);
  const [filterDay, setFilterDay] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generatingReport, setGeneratingReport] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Fetch all staff availabilities
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "availabilities"), orderBy("staffName"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const availabilities = [];
      snapshot.forEach((doc) => {
        availabilities.push({ id: doc.id, ...doc.data() });
      });
      setStaffAvailabilities(availabilities);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter staff based on search term and selected day
  const filteredStaff = staffAvailabilities.filter(staff => {
    const matchesSearch = staff.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         staff.staffId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterDay === "All") return matchesSearch;
    
    const dayAvailable = staff.availabilities?.[filterDay]?.available;
    return matchesSearch && dayAvailable;
  });

  const getAvailabilityStats = () => {
    const stats = {
      totalStaff: staffAvailabilities.length,
      availableToday: 0,
      mostAvailableStaff: null,
      leastAvailableStaff: null,
      averageAvailability: 0
    };

    let totalAvailableDays = 0;
    
    staffAvailabilities.forEach(staff => {
      const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
      totalAvailableDays += availableDays;
      
      if (staff.availabilities?.[TODAY]?.available) {
        stats.availableToday++;
      }

      if (!stats.mostAvailableStaff || availableDays > stats.mostAvailableStaff.availableDays) {
        stats.mostAvailableStaff = { name: staff.staffName, availableDays };
      }
      
      if (!stats.leastAvailableStaff || availableDays < stats.leastAvailableStaff.availableDays) {
        stats.leastAvailableStaff = { name: staff.staffName, availableDays };
      }
    });

    stats.averageAvailability = staffAvailabilities.length > 0 
      ? (totalAvailableDays / staffAvailabilities.length).toFixed(1)
      : 0;

    return stats;
  };

  const handleGenerateMonthlyReport = async () => {
    setGeneratingReport(true);
    try {
      await generateMonthlyReport(staffAvailabilities, reportMonth);
      showNotification("Monthly report generated successfully!", "success");
    } catch (error) {
      console.error("Error generating report:", error);
      showNotification("Error generating report: " + error.message, "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleGenerateCurrentReport = async () => {
    setGeneratingReport(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      await generateMonthlyReport(staffAvailabilities, currentMonth);
      showNotification("Current availability report generated successfully!", "success");
    } catch (error) {
      console.error("Error generating report:", error);
      showNotification("Error generating report: " + error.message, "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const showNotification = (message, type = "info") => {
    // In a real app, you'd use a proper notification system
    alert(`${type.toUpperCase()}: ${message}`);
  };

  const isActiveRoute = (path) => location.pathname === path;

  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (error) {
      console.warn("Navigation error, using fallback:", error);
      window.location.href = path;
    }
  };

  const stats = getAvailabilityStats();

  return (
    <div className="staff-availability-view">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="brand-section">
            <div className="brand-logo">🏪</div>
            <div className="brand-info">
              <h1 className="brand-title">Cafe Piranha</h1>
              <span className="brand-subtitle">Staff Availability Dashboard</span>
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
        {/* Key Metrics */}
        <section className="metrics-section">
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon total-staff">👥</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.totalStaff}</h3>
                <p className="metric-label">Total Staff</p>
              </div>
            </div>
            
            <div className="metric-card highlight">
              <div className="metric-icon available-today">✅</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.availableToday}</h3>
                <p className="metric-label">Available Today</p>
                <span className="metric-subtext">{TODAY}</span>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon coverage">📊</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.averageAvailability}/7</h3>
                <p className="metric-label">Avg. Availability</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon utilization">⚡</div>
              <div className="metric-content">
                <h3 className="metric-value">
                  {stats.mostAvailableStaff ? `${stats.mostAvailableStaff.availableDays}/7` : '0/7'}
                </h3>
                <p className="metric-label">Highest Availability</p>
                <span className="metric-subtext">
                  {stats.mostAvailableStaff?.name || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Report Generation */}
        <section className="reporting-section">
          <div className="section-header">
            <h2>Availability Reports</h2>
            <span className="admin-badge">Administrator</span>
          </div>
          
          <div className="report-card">
            <div className="report-header">
              <h3>Generate Availability Report</h3>
              <p>Export current staff availability data to PDF format</p>
            </div>
            
            <div className="report-actions">
              <button 
                className={`btn-primary ${generatingReport ? 'loading' : ''}`}
                onClick={handleGenerateCurrentReport}
                disabled={generatingReport}
              >
                <span className="btn-icon">
                  {generatingReport ? "⏳" : "📊"}
                </span>
                <span className="btn-text">
                  {generatingReport ? "Generating Report..." : "Generate Current Month Report"}
                </span>
              </button>
              
              <div className="custom-report">
                <label className="form-label">Select Specific Month</label>
                <div className="month-selector">
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="month-input"
                  />
                  <button 
                    className="btn-secondary"
                    onClick={handleGenerateMonthlyReport}
                    disabled={generatingReport}
                  >
                    <span className="btn-icon">📅</span>
                    Generate
                  </button>
                </div>
              </div>
            </div>
            
            <div className="report-info">
              <div className="info-icon">💡</div>
              <div className="info-content">
                <p>
                  <strong>Real-time Data:</strong> Reports are generated using current availability data.
                  Monthly reports are labeled for the selected period but use real-time staff availability.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Controls Section */}
        <section className="controls-section">
          <div className="view-controls">
            <div className="view-toggle">
              <button 
                className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                <span className="toggle-icon">🔲</span>
                Grid View
              </button>
              <button 
                className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
              >
                <span className="toggle-icon">📋</span>
                Table View
              </button>
            </div>
          </div>

          <div className="filter-controls">
            <div className="search-box">
              <div className="search-icon">🔍</div>
              <input
                type="text"
                placeholder="Search by staff name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button 
                  className="clear-search"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="filter-box">
              <label className="filter-label">Filter by Day</label>
              <select 
                value={filterDay} 
                onChange={(e) => setFilterDay(e.target.value)} 
                className="filter-select"
              >
                <option value="All">All Days</option>
                {DAYS.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Staff Availability Display */}
        <section className="availability-section">
          <div className="section-header">
            <h2>Staff Availability</h2>
            <div className="results-info">
              <span className="results-count">{filteredStaff.length} staff members</span>
              {filterDay !== "All" && (
                <span className="filter-indicator">Filtered by {filterDay}</span>
              )}
            </div>
          </div>
          
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner">⏳</div>
              <h3>Loading Staff Data</h3>
              <p>Please wait while we fetch the latest availability information</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>No Staff Members Found</h3>
              <p>
                {searchTerm 
                  ? `No staff match "${searchTerm}". Try adjusting your search terms.`
                  : 'No staff availability data is currently available.'
                }
              </p>
              {(searchTerm || filterDay !== "All") && (
                <button 
                  className="btn-outline"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterDay("All");
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="staff-grid">
              {filteredStaff.map(staff => {
                const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
                const availabilityPercentage = (availableDays / 7) * 100;
                
                return (
                  <div key={staff.id} className="staff-card">
                    <div className="staff-header">
                      <div className="staff-avatar">
                        {staff.staffName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="staff-info">
                        <h4 className="staff-name">{staff.staffName}</h4>
                        <span className="staff-id">ID: {staff.staffId}</span>
                        <div className="availability-summary">
                          <div className="availability-badge">
                            {availableDays}/7 days available
                          </div>
                          <div className="availability-bar">
                            <div 
                              className="availability-progress"
                              style={{ width: `${availabilityPercentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="availability-schedule">
                      {DAYS.map(day => {
                        const dayData = staff.availabilities?.[day];
                        const isAvailable = dayData?.available;
                        const isToday = day === TODAY;
                        
                        return (
                          <div key={day} className={`day-slot ${isToday ? 'today' : ''}`}>
                            <span className="day-label">{day.substring(0, 3)}</span>
                            <div className={`time-slot ${isAvailable ? 'available' : 'unavailable'}`}>
                              {isAvailable ? (
                                <div className="shift-details">
                                  <span className="shift-time">
                                    {dayData.startTime} - {dayData.endTime}
                                  </span>
                                  {dayData.breaks?.length > 0 && (
                                    <span 
                                      className="break-info"
                                      title={`${dayData.breaks.length} break(s) scheduled`}
                                    >
                                      ☕
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="off-duty">Off</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="card-footer">
                      <span className="last-updated">
                        Last updated: {staff.lastUpdated 
                          ? new Date(staff.lastUpdated).toLocaleDateString() 
                          : 'Never'
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="staff-table">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-row header">
                    <div className="table-cell staff-column">Staff Member</div>
                    {DAYS.map(day => (
                      <div key={day} className={`table-cell day-column ${day === TODAY ? 'today' : ''}`}>
                        {day.substring(0, 3)}
                        {day === TODAY && <span className="today-indicator">Today</span>}
                      </div>
                    ))}
                    <div className="table-cell summary-column">Weekly Summary</div>
                  </div>
                </div>
                <div className="table-body">
                  {filteredStaff.map(staff => {
                    const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
                    
                    return (
                      <div key={staff.id} className="table-row">
                        <div className="table-cell staff-cell">
                          <div className="staff-display">
                            <div className="avatar-small">
                              {staff.staffName?.charAt(0).toUpperCase()}
                            </div>
                            <div className="staff-details">
                              <div className="staff-name">{staff.staffName}</div>
                              <div className="staff-id">ID: {staff.staffId}</div>
                            </div>
                          </div>
                        </div>
                        {DAYS.map(day => {
                          const dayData = staff.availabilities?.[day];
                          const isAvailable = dayData?.available;
                          const isToday = day === TODAY;
                          
                          return (
                            <div key={day} className={`table-cell day-cell ${isAvailable ? 'available' : 'unavailable'} ${isToday ? 'today' : ''}`}>
                              {isAvailable ? (
                                <div className="shift-display">
                                  <div className="time-range">{dayData.startTime} - {dayData.endTime}</div>
                                  {dayData.breaks?.length > 0 && (
                                    <div className="break-count">
                                      {dayData.breaks.length} break{dayData.breaks.length > 1 ? 's' : ''}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="off-text">Off</span>
                              )}
                            </div>
                          );
                        })}
                        <div className="table-cell summary-cell">
                          <div className="weekly-summary">
                            <span className="days-count">{availableDays}/7 days</span>
                            <div className="availability-meter">
                              <div 
                                className="meter-fill"
                                style={{ width: `${(availableDays / 7) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className="actions-section">
          <div className="section-header">
            <h2>Quick Actions</h2>
          </div>
          
          <div className="action-buttons">
            <button 
              className="action-btn"
              onClick={() => {
                setFilterDay("All");
                setSearchTerm("");
              }}
            >
              <span className="btn-icon">🔄</span>
              Reset Filters
            </button>
            
            <button 
              className="action-btn"
              onClick={() => setFilterDay(TODAY)}
            >
              <span className="btn-icon">📅</span>
              Show Today's Staff
            </button>
            
            <button 
              className="action-btn"
              onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
            >
              <span className="btn-icon">{viewMode === 'grid' ? '📋' : '🔲'}</span>
              Switch to {viewMode === 'grid' ? 'Table' : 'Grid'} View
            </button>
          </div>
        </section>
      </main>

      {/* Navigation */}
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
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/ot-approvals') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/ot-approvals')}
        >
          <span className="nav-icon">🕒</span>
          <span className="nav-label">Overtime</span>
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