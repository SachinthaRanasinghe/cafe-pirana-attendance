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

export default function StaffAvailabilityView({ onLogout }) {
  const [staffAvailabilities, setStaffAvailabilities] = useState([]);
  const [filterDay, setFilterDay] = useState("All");
  const [viewMode, setViewMode] = useState("grid"); // grid, table, calendar
  const [searchTerm, setSearchTerm] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Fetch all staff availabilities
  useEffect(() => {
    const q = query(collection(db, "availabilities"), orderBy("staffName"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const availabilities = [];
      snapshot.forEach((doc) => {
        availabilities.push({ id: doc.id, ...doc.data() });
      });
      setStaffAvailabilities(availabilities);
    });

    return () => unsubscribe();
  }, []);

  // Filter staff based on search term and selected day
  const filteredStaff = staffAvailabilities.filter(staff => {
    const matchesSearch = staff.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         staff.staffId.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterDay === "All") return matchesSearch;
    
    const dayAvailable = staff.availabilities?.[filterDay]?.available;
    return matchesSearch && dayAvailable;
  });

  const getAvailabilityStats = () => {
    const stats = {
      totalStaff: staffAvailabilities.length,
      availableToday: 0,
      mostAvailableStaff: null,
      leastAvailableStaff: null
    };

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    staffAvailabilities.forEach(staff => {
      const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
      
      if (staff.availabilities?.[today]?.available) {
        stats.availableToday++;
      }

      if (!stats.mostAvailableStaff || availableDays > stats.mostAvailableStaff.availableDays) {
        stats.mostAvailableStaff = { name: staff.staffName, availableDays };
      }
      
      if (!stats.leastAvailableStaff || availableDays < stats.leastAvailableStaff.availableDays) {
        stats.leastAvailableStaff = { name: staff.staffName, availableDays };
      }
    });

    return stats;
  };

  const stats = getAvailabilityStats();

  const showNotification = (msg, type = "info") => {
    const styles = {
      success: "background: #4CAF50; color: white; padding: 12px; border-radius: 4px;",
      error: "background: #f44336; color: white; padding: 12px; border-radius: 4px;",
      info: "background: #2196F3; color: white; padding: 12px; border-radius: 4px;"
    };
    console.log(`%c${msg}`, styles[type] || styles.info);
    alert(msg);
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

  return (
    <div className="staff-availability-view">
      {/* Navigation Header */}
      <nav className="admin-nav-header">
        <div className="nav-brand">
          <div className="brand-icon">🏪</div>
          <div className="brand-text">
            <h2>Cafe Piranha</h2>
            <span>Admin Portal</span>
          </div>
        </div>
        
        <div className="nav-actions">
          <div className="live-indicator">
            <span className="live-dot"></span>
            <span>Live</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="admin-container">
        {/* Welcome Header */}
        <div className="welcome-header">
          <div className="welcome-text">
            <h1>Staff Availability</h1>
            <p>View and manage staff working availability</p>
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

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">👥</div>
            <div className="stat-content">
              <h3>{stats.totalStaff}</h3>
              <p>Total Staff</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon success">✅</div>
            <div className="stat-content">
              <h3>{stats.availableToday}</h3>
              <p>Available Today</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon warning">📊</div>
            <div className="stat-content">
              <h3>{stats.mostAvailableStaff?.availableDays || 0}/7</h3>
              <p>Most Available</p>
              <div className="stat-detail">{stats.mostAvailableStaff?.name || 'N/A'}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon accent">📅</div>
            <div className="stat-content">
              <h3>{stats.leastAvailableStaff?.availableDays || 0}/7</h3>
              <p>Least Available</p>
              <div className="stat-detail">{stats.leastAvailableStaff?.name || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="filter-card">
          <div className="filter-header">
            <h3>Filter & View Options</h3>
          </div>
          <div className="filter-controls">
            <div className="filter-group">
              <label>Search Staff</label>
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-group">
              <label>Filter by Day</label>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="filter-select"
              >
                <option value="All">All Days</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>View Mode</label>
              <div className="view-toggle">
                <button 
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <span className="btn-icon">🔲</span>
                  Grid
                </button>
                <button 
                  className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  <span className="btn-icon">📋</span>
                  Table
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Availability Grid/Table */}
        <div className="section-card">
          <div className="card-header">
            <h2>Staff Availability</h2>
            <span className="badge">{filteredStaff.length}</span>
          </div>
          
          {filteredStaff.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>No Staff Found</h3>
              <p>
                {searchTerm ? 'No staff match your search criteria' : 'No staff availability data available'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="staff-grid">
              {filteredStaff.map(staff => {
                const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
                
                return (
                  <div key={staff.id} className="staff-availability-card">
                    <div className="staff-header">
                      <div className="staff-avatar">
                        {staff.staffName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="staff-info">
                        <h4>{staff.staffName}</h4>
                        <span className="staff-id">ID: {staff.staffId}</span>
                        <div className="availability-stats">
                          <span className={`availability-badge ${availableDays > 3 ? 'high' : availableDays > 1 ? 'medium' : 'low'}`}>
                            {availableDays}/7 days available
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="availability-details">
                      {days.map(day => {
                        const dayData = staff.availabilities?.[day];
                        const isAvailable = dayData?.available;
                        
                        return (
                          <div key={day} className="day-slot">
                            <span className="day-name">{day.substring(0, 3)}</span>
                            <div className={`availability-indicator ${isAvailable ? 'available' : 'unavailable'}`}>
                              {isAvailable ? (
                                <div className="available-info">
                                  <span className="time-range">
                                    {dayData.startTime} - {dayData.endTime}
                                  </span>
                                  {dayData.breaks?.length > 0 && (
                                    <span className="break-indicator" title={`${dayData.breaks.length} break(s)`}>
                                      ☕
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="unavailable-text">Off</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="card-footer">
                      <span className="update-time">
                        Updated: {staff.lastUpdated ? new Date(staff.lastUpdated).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="availability-table">
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    {days.map(day => (
                      <th key={day}>{day}</th>
                    ))}
                    <th>Available Days</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(staff => {
                    const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
                    
                    return (
                      <tr key={staff.id}>
                        <td className="staff-cell">
                          <div className="staff-info-compact">
                            <div className="staff-avatar-small">
                              {staff.staffName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="staff-name">{staff.staffName}</div>
                              <div className="staff-id">ID: {staff.staffId}</div>
                            </div>
                          </div>
                        </td>
                        {days.map(day => {
                          const dayData = staff.availabilities?.[day];
                          const isAvailable = dayData?.available;
                          
                          return (
                            <td key={day} className={`day-cell ${isAvailable ? 'available' : 'unavailable'}`}>
                              {isAvailable ? (
                                <div className="day-schedule-compact">
                                  <div className="time-range">{dayData.startTime} - {dayData.endTime}</div>
                                  {dayData.breaks?.length > 0 && (
                                    <div className="break-count">{dayData.breaks.length} break(s)</div>
                                  )}
                                </div>
                              ) : (
                                <span className="off-text">Off</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="summary-cell">
                          <div className="availability-summary">
                            <span className="days-count">{availableDays}/7</span>
                            <div className="availability-bar">
                              <div 
                                className="availability-fill"
                                style={{ width: `${(availableDays / 7) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          <button 
            className={`nav-item ${isActiveRoute('/admin') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Dashboard</span>
          </button>
          
          <button 
            className={`nav-item ${isActiveRoute('/admin/salary') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin/salary')}
          >
            <span className="nav-icon">💰</span>
            <span className="nav-text">Salary</span>
          </button>
          
          <button 
            className={`nav-item ${isActiveRoute('/admin/advances') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin/advances')}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-text">Advances</span>
          </button>
          
          <button 
            className={`nav-item ${isActiveRoute('/admin/ot-approvals') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin/ot-approvals')}
          >
            <span className="nav-icon">🕒</span>
            <span className="nav-text">OT</span>
          </button>

          <button 
            className={`nav-item ${isActiveRoute('/admin/availability') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin/availability')}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-text">Availability</span>
          </button>
          
          <button className="nav-item logout-item" onClick={onLogout}>
            <span className="nav-icon">🚪</span>
            <span className="nav-text">Logout</span>
          </button>
        </nav>
      </div>
    </div>
  );
}