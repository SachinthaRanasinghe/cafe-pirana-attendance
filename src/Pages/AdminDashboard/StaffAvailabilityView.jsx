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
  const [viewMode, setViewMode] = useState("grid"); // grid, table
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">🏪</div>
            <div className="brand-text">
              <h1>Cafe Piranha</h1>
              <span>Staff Availability</span>
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
            <h2>Staff Availability</h2>
            <p>View and manage staff working schedules</p>
          </div>
          <div className="date-display-mobile">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </section>

        {/* Stats Grid */}
        <section className="stats-section">
          <div className="stats-grid-mobile">
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile primary">👥</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.totalStaff}</div>
                <div className="stat-label">Total Staff</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile success">✅</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.availableToday}</div>
                <div className="stat-label">Available Today</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile warning">📊</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.mostAvailableStaff?.availableDays || 0}/7</div>
                <div className="stat-label">Most Days</div>
              </div>
            </div>

            <div className="stat-card-mobile highlight">
              <div className="stat-icon-mobile accent">📅</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.leastAvailableStaff?.availableDays || 0}/7</div>
                <div className="stat-label">Least Days</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="tabs-section">
          <div className="tabs-container">
            <button 
              className={`tab-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <span className="tab-icon">🔲</span>
              <span className="tab-text">Grid</span>
            </button>
            <button 
              className={`tab-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-text">Table</span>
            </button>
          </div>
        </section>

        {/* Search Bar */}
        <section className="search-section">
          <div className="search-container">
            <div className="search-icon">🔍</div>
            <input
              type="text"
              placeholder="Search staff by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                className="clear-search"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>
        </section>

        {/* Filter Section */}
        <section className="filter-section">
          <div className="filter-card-mobile">
            <div className="filter-header">
              <h3>Filter Options</h3>
              <div className="filter-badge">
                {filterDay === "All" ? "All Days" : filterDay}
              </div>
            </div>
            <select 
              value={filterDay} 
              onChange={(e) => setFilterDay(e.target.value)} 
              className="filter-select-mobile"
            >
              <option value="All">All Days</option>
              {days.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Staff Availability Content */}
        <section className="section-mobile">
          <div className="section-header-mobile">
            <h3>Staff Availability</h3>
            <span className="badge-mobile">{filteredStaff.length}</span>
          </div>
          
          {loading ? (
            <div className="empty-state-mobile">
              <div className="empty-icon">⏳</div>
              <h4>Loading...</h4>
              <p>Fetching staff availability data</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="empty-state-mobile">
              <div className="empty-icon">📅</div>
              <h4>No Staff Found</h4>
              <p>
                {searchTerm ? 'No staff match your search criteria' : 'No staff availability data available'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="staff-grid-mobile">
              {filteredStaff.map(staff => {
                const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
                
                return (
                  <div key={staff.id} className="staff-availability-card-mobile">
                    <div className="staff-header-mobile">
                      <div className="staff-avatar-mobile">
                        {staff.staffName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="staff-details-mobile">
                        <h4>{staff.staffName}</h4>
                        <span className="staff-id">ID: {staff.staffId}</span>
                        <div className="availability-stats-mobile">
                          <span className={`availability-badge-mobile ${availableDays > 3 ? 'high' : availableDays > 1 ? 'medium' : 'low'}`}>
                            {availableDays}/7 days available
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="availability-details-mobile">
                      {days.map(day => {
                        const dayData = staff.availabilities?.[day];
                        const isAvailable = dayData?.available;
                        
                        return (
                          <div key={day} className="day-slot-mobile">
                            <span className="day-name-mobile">{day.substring(0, 3)}</span>
                            <div className={`availability-indicator-mobile ${isAvailable ? 'available' : 'unavailable'}`}>
                              {isAvailable ? (
                                <div className="available-info-mobile">
                                  <span className="time-range-mobile">
                                    {dayData.startTime} - {dayData.endTime}
                                  </span>
                                  {dayData.breaks?.length > 0 && (
                                    <span className="break-indicator-mobile" title={`${dayData.breaks.length} break(s)`}>
                                      ☕
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="unavailable-text-mobile">Off</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="card-footer-mobile">
                      <span className="update-time-mobile">
                        Updated: {staff.lastUpdated ? new Date(staff.lastUpdated).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="availability-table-mobile">
              <div className="table-container-mobile">
                <div className="table-header-mobile">
                  <div className="table-row-mobile header-row">
                    <div className="table-cell-mobile staff-header">Staff Member</div>
                    {days.map(day => (
                      <div key={day} className="table-cell-mobile day-header">{day.substring(0, 3)}</div>
                    ))}
                    <div className="table-cell-mobile summary-header">Days</div>
                  </div>
                </div>
                <div className="table-body-mobile">
                  {filteredStaff.map(staff => {
                    const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
                    
                    return (
                      <div key={staff.id} className="table-row-mobile">
                        <div className="table-cell-mobile staff-cell-mobile">
                          <div className="staff-info-compact-mobile">
                            <div className="staff-avatar-small-mobile">
                              {staff.staffName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="staff-name-mobile">{staff.staffName}</div>
                              <div className="staff-id-mobile">ID: {staff.staffId}</div>
                            </div>
                          </div>
                        </div>
                        {days.map(day => {
                          const dayData = staff.availabilities?.[day];
                          const isAvailable = dayData?.available;
                          
                          return (
                            <div key={day} className={`table-cell-mobile day-cell-mobile ${isAvailable ? 'available' : 'unavailable'}`}>
                              {isAvailable ? (
                                <div className="day-schedule-compact-mobile">
                                  <div className="time-range-mobile">{dayData.startTime} - {dayData.endTime}</div>
                                  {dayData.breaks?.length > 0 && (
                                    <div className="break-count-mobile">{dayData.breaks.length} break(s)</div>
                                  )}
                                </div>
                              ) : (
                                <span className="off-text-mobile">Off</span>
                              )}
                            </div>
                          );
                        })}
                        <div className="table-cell-mobile summary-cell-mobile">
                          <div className="availability-summary-mobile">
                            <span className="days-count-mobile">{availableDays}/7</span>
                            <div className="availability-bar-mobile">
                              <div 
                                className="availability-fill-mobile"
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
        <section className="section-mobile">
          <div className="section-header-mobile">
            <h3>Quick Actions</h3>
            <span className="badge-mobile warning">Admin</span>
          </div>
          
          <div className="action-buttons-mobile">
            <button 
              className="btn-quick-action-mobile"
              onClick={() => {
                setFilterDay("All");
                setSearchTerm("");
              }}
            >
              <span className="btn-icon">🔄</span>
              <span className="btn-text">Clear Filters</span>
            </button>
            
            <button 
              className="btn-quick-action-mobile outline"
              onClick={() => {
                const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                setFilterDay(today);
              }}
            >
              <span className="btn-icon">📅</span>
              <span className="btn-text">Today's Staff</span>
            </button>
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