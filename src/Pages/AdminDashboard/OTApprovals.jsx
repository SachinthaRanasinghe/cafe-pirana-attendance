// src/Pages/AdminDashboard/OTApprovals.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "../../firebase";
import "./OTApprovals.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function OTApprovals({ onLogout }) {
  const [otRequests, setOtRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [activeTab, setActiveTab] = useState("requests");
  const [searchTerm, setSearchTerm] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Helper function to format hours properly
  const formatHours = (hours) => {
    if (!hours && hours !== 0) return "0h";
    
    // Round to 2 decimal places and remove trailing zeros
    const rounded = Math.round(hours * 100) / 100;
    
    // If it's a whole number, show without decimals
    if (rounded % 1 === 0) {
      return `${rounded}h`;
    }
    
    // Otherwise show with 1 decimal place
    return `${rounded.toFixed(1)}h`;
  };

  // Fetch OT requests
  useEffect(() => {
    const q = query(
      collection(db, "otRequests"), 
      orderBy("requestedAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setOtRequests(requests);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (request) => {
    if (!window.confirm(`Approve ${formatHours(request.otHours)} OT for ${request.staffName}? Amount: Rs. ${request.otAmount}`)) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "otRequests", request.id), {
        status: "approved",
        approvedBy: "admin",
        approvedAt: new Date().toISOString()
      });
      
      showNotification(`✅ OT approved for ${request.staffName}`, "success");
    } catch (error) {
      console.error("Error approving OT:", error);
      showNotification("❌ Error approving OT: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (request) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "otRequests", request.id), {
        status: "rejected",
        approvedBy: "admin",
        approvedAt: new Date().toISOString(),
        rejectionReason: reason
      });
      
      showNotification(`❌ OT rejected for ${request.staffName}`, "info");
    } catch (error) {
      console.error("Error rejecting OT:", error);
      showNotification("❌ Error rejecting OT: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg, type = "info") => {
    // For mobile, we'll use alert but with emoji indicators
    alert(msg);
  };

  const filteredRequests = otRequests.filter(request => {
    const matchesFilter = filter === "all" ? true : request.status === filter;
    const matchesSearch = request.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.staffId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate stats with formatted hours
  const stats = {
    pending: otRequests.filter(r => r.status === "pending").length,
    approved: otRequests.filter(r => r.status === "approved").length,
    rejected: otRequests.filter(r => r.status === "rejected").length,
    totalOTHours: otRequests.filter(r => r.status === "approved").reduce((sum, r) => sum + (r.otHours || 0), 0),
    totalOTAmount: otRequests.filter(r => r.status === "approved").reduce((sum, r) => sum + (r.otAmount || 0), 0),
    nightShifts: otRequests.filter(r => r.isNightShift).length
  };

  // Format total OT hours for display
  const formattedTotalHours = formatHours(stats.totalOTHours);

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
    <div className="ot-approvals">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">🏪</div>
            <div className="brand-text">
              <h1>Cafe Piranha</h1>
              <span>OT Approvals</span>
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
            <h2>OT Approvals</h2>
            <p>Manage staff overtime requests</p>
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
              <div className="stat-icon-mobile primary">⏳</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.pending}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile success">✅</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.approved}</div>
                <div className="stat-label">Approved</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile accent">🕒</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{formattedTotalHours}</div>
                <div className="stat-label">OT Hours</div>
              </div>
            </div>
            
            <div className="stat-card-mobile highlight">
              <div className="stat-icon-mobile warning">💰</div>
              <div className="stat-content-mobile">
                <div className="stat-value">Rs. {Math.round(stats.totalOTAmount / 1000)}k</div>
                <div className="stat-label">Total OT</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="tabs-section">
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
              onClick={() => setActiveTab("requests")}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-text">Requests</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === "stats" ? "active" : ""}`}
              onClick={() => setActiveTab("stats")}
            >
              <span className="tab-icon">📊</span>
              <span className="tab-text">Statistics</span>
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
              <h3>Filter Requests</h3>
              <div className="filter-badge">
                {filter === "pending" && "⏳ Pending"}
                {filter === "approved" && "✅ Approved"}
                {filter === "rejected" && "❌ Rejected"}
                {filter === "all" && "📋 All"}
              </div>
            </div>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)} 
              className="filter-select-mobile"
            >
              <option value="pending">⏳ Pending OT</option>
              <option value="approved">✅ Approved OT</option>
              <option value="rejected">❌ Rejected OT</option>
              <option value="all">📋 All OT</option>
            </select>
          </div>
        </section>

        {/* OT Requests List */}
        {activeTab === "requests" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>Overtime Requests</h3>
              <span className="badge-mobile">{filteredRequests.length}</span>
            </div>
            
            {filteredRequests.length === 0 ? (
              <div className="empty-state-mobile">
                <div className="empty-icon">🕒</div>
                <h4>No OT Requests</h4>
                <p>
                  {searchTerm ? 
                    "No matching OT requests found" : 
                    `No ${filter !== "all" ? filter : ""} overtime requests`
                  }
                </p>
              </div>
            ) : (
              <div className="requests-list-mobile">
                {filteredRequests.map(request => {
                  // Format hours for this specific request
                  const regularHours = formatHours(request.regularHours || 0);
                  const otHours = formatHours(request.otHours || 0);
                  const totalHours = formatHours((request.regularHours || 0) + (request.otHours || 0));
                  
                  return (
                    <div key={request.id} className={`request-item-mobile ${request.status}`}>
                      <div className="request-header-mobile">
                        <div className="staff-info-mobile">
                          <div className="staff-avatar-mobile">
                            {request.staffName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="staff-details-mobile">
                            <h4>{request.staffName}</h4>
                            <span className="staff-id">ID: {request.staffId}</span>
                          </div>
                        </div>
                        <div className={`status-badge-mobile ${request.status}`}>
                          {request.status === "pending" && "⏳ Pending"}
                          {request.status === "approved" && "✅ Approved"}
                          {request.status === "rejected" && "❌ Rejected"}
                        </div>
                      </div>

                      <div className="request-details-mobile">
                        {/* Date and Shift Info */}
                        <div className="date-shift-info">
                          <span className="date-value">
                            {request.date}
                            {request.isNightShift && " 🌙"}
                            {request.crossMidnight && " ⏰"}
                          </span>
                        </div>

                        {/* Hours Breakdown */}
                        <div className="hours-breakdown-mobile">
                          <div className="hours-grid-mobile">
                            <div className="hours-item-mobile">
                              <span className="hours-label">Regular</span>
                              <span className="hours-value">{regularHours}</span>
                            </div>
                            <div className="hours-item-mobile highlight">
                              <span className="hours-label">OT Hours</span>
                              <span className="hours-value ot-highlight">{otHours}</span>
                            </div>
                            <div className="hours-item-mobile total">
                              <span className="hours-label">Total</span>
                              <span className="hours-value">{totalHours}</span>
                            </div>
                          </div>
                        </div>

                        {/* Amount Section */}
                        <div className="amount-section-mobile">
                          <div className="amount-display-mobile">
                            <span className="amount-label">OT Amount</span>
                            <span className="amount-value">Rs. {request.otAmount?.toLocaleString() || '0'}</span>
                          </div>
                          <div className="rate-info-mobile">
                            <span className="rate-label">Rate: Rs. 200/hour</span>
                          </div>
                        </div>

                        {/* Shift Tags */}
                        {(request.isNightShift || request.crossMidnight) && (
                          <div className="shift-tags-mobile">
                            {request.isNightShift && <span className="shift-tag night">🌙 Night Shift</span>}
                            {request.crossMidnight && <span className="shift-tag cross">⏰ Crossed Midnight</span>}
                          </div>
                        )}

                        {/* Approval Info */}
                        {request.approvedAt && (
                          <div className="approval-info-mobile">
                            <div className="approval-header-mobile">
                              <strong>
                                {request.status === "approved" ? "Approved" : "Rejected"} on:
                              </strong>
                              <span>{new Date(request.approvedAt).toLocaleDateString()}</span>
                            </div>
                            {request.rejectionReason && (
                              <div className="rejection-reason-mobile">
                                <strong>Reason:</strong> {request.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons for Pending Requests */}
                      {request.status === "pending" && (
                        <div className="request-actions-mobile">
                          <button 
                            className="btn-approve-mobile"
                            onClick={() => handleApprove(request)}
                            disabled={loading}
                          >
                            <span className="btn-icon">✅</span>
                            <span className="btn-text">Approve OT</span>
                          </button>
                          <button 
                            className="btn-reject-mobile"
                            onClick={() => handleReject(request)}
                            disabled={loading}
                          >
                            <span className="btn-icon">❌</span>
                            <span className="btn-text">Reject OT</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Statistics Tab */}
        {activeTab === "stats" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>OT Statistics</h3>
              <span className="badge-mobile">{otRequests.length}</span>
            </div>
            
            <div className="stats-overview-mobile">
              <div className="stat-row-mobile">
                <span className="stat-label">Total Requests:</span>
                <span className="stat-value">{otRequests.length}</span>
              </div>
              <div className="stat-row-mobile">
                <span className="stat-label">Pending Approval:</span>
                <span className="stat-value pending">{stats.pending}</span>
              </div>
              <div className="stat-row-mobile">
                <span className="stat-label">Approved Requests:</span>
                <span className="stat-value success">{stats.approved}</span>
              </div>
              <div className="stat-row-mobile">
                <span className="stat-label">Rejected Requests:</span>
                <span className="stat-value error">{stats.rejected}</span>
              </div>
              <div className="stat-row-mobile">
                <span className="stat-label">Night Shifts:</span>
                <span className="stat-value warning">{stats.nightShifts}</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-row-mobile total">
                <span className="stat-label">Total OT Hours:</span>
                <span className="stat-value">{formattedTotalHours}</span>
              </div>
              <div className="stat-row-mobile total">
                <span className="stat-label">Total OT Amount:</span>
                <span className="stat-value">Rs. {stats.totalOTAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Approval Rate */}
            <div className="approval-rate-mobile">
              <div className="rate-header-mobile">
                <h4>OT Approval Rate</h4>
                <span className="rate-value">
                  {otRequests.length > 0 
                    ? Math.round((stats.approved / otRequests.length) * 100) 
                    : 0
                  }%
                </span>
              </div>
              <div className="rate-bar-mobile">
                <div 
                  className="rate-progress-mobile"
                  style={{ 
                    width: `${otRequests.length > 0 ? (stats.approved / otRequests.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="additional-stats-mobile">
              <div className="stat-card-mini">
                <div className="stat-mini-icon">📈</div>
                <div className="stat-mini-content">
                  <div className="stat-mini-value">
                    {formatHours(stats.approved > 0 ? (stats.totalOTHours / stats.approved) : 0)}
                  </div>
                  <div className="stat-mini-label">Avg OT Hours</div>
                </div>
              </div>
              <div className="stat-card-mini">
                <div className="stat-mini-icon">💰</div>
                <div className="stat-mini-content">
                  <div className="stat-mini-value">
                    Rs. {stats.approved > 0 ? Math.round(stats.totalOTAmount / stats.approved) : 0}
                  </div>
                  <div className="stat-mini-label">Avg OT Amount</div>
                </div>
              </div>
            </div>
          </section>
        )}

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
                setFilter("pending");
                setActiveTab("requests");
              }}
            >
              <span className="btn-icon">⏳</span>
              <span className="btn-text">View Pending</span>
            </button>
            
            <button 
              className="btn-quick-action-mobile outline"
              onClick={() => {
                setSearchTerm("");
                setFilter("all");
              }}
            >
              <span className="btn-icon">🔄</span>
              <span className="btn-text">Clear Filters</span>
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