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
      
      showNotification(`OT approved for ${request.staffName}`, "success");
    } catch (error) {
      console.error("Error approving OT:", error);
      showNotification("Error approving OT: " + error.message, "error");
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
      
      showNotification(`OT rejected for ${request.staffName}`, "info");
    } catch (error) {
      console.error("Error rejecting OT:", error);
      showNotification("Error rejecting OT: " + error.message, "error");
    } finally {
      setLoading(false);
    }
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

  const filteredRequests = otRequests.filter(request => 
    filter === "all" ? true : request.status === filter
  );

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
            <h1>OT Approvals</h1>
            <p>Manage staff overtime requests</p>
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
            <div className="stat-icon primary">⏳</div>
            <div className="stat-content">
              <h3>{stats.pending}</h3>
              <p>Pending OT</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon success">✅</div>
            <div className="stat-content">
              <h3>{stats.approved}</h3>
              <p>Approved OT</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon accent">🕒</div>
            <div className="stat-content">
              <h3>{formattedTotalHours}</h3>
              <p>Total OT Hours</p>
            </div>
          </div>
          
          <div className="stat-card highlight">
            <div className="stat-icon warning">💰</div>
            <div className="stat-content">
              <h3>Rs. {stats.totalOTAmount.toLocaleString()}</h3>
              <p>Total OT Amount</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon secondary">🌙</div>
            <div className="stat-content">
              <h3>{stats.nightShifts}</h3>
              <p>Night Shifts</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            <span className="tab-icon">🕒</span>
            OT Requests
          </button>
          <button 
            className={`tab-btn ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            <span className="tab-icon">📊</span>
            Statistics
          </button>
        </div>

        {/* Filter Section */}
        <div className="filter-card">
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
            className="filter-select"
          >
            <option value="pending">⏳ Pending OT Requests</option>
            <option value="approved">✅ Approved OT Requests</option>
            <option value="rejected">❌ Rejected OT Requests</option>
            <option value="all">📋 All OT Requests</option>
          </select>
        </div>

        {/* OT Requests List */}
        {activeTab === "requests" && (
          <div className="section-card">
            <div className="card-header">
              <h2>Overtime Requests</h2>
              <span className="badge">{filteredRequests.length}</span>
            </div>
            
            {filteredRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🕒</div>
                <h3>No OT Requests Found</h3>
                <p>No {filter !== "all" ? filter : ""} overtime requests at the moment</p>
              </div>
            ) : (
              <div className="ot-requests-list">
                {filteredRequests.map(request => {
                  // Format hours for this specific request
                  const regularHours = formatHours(request.regularHours || 0);
                  const otHours = formatHours(request.otHours || 0);
                  const totalHours = formatHours((request.regularHours || 0) + (request.otHours || 0));
                  
                  return (
                    <div key={request.id} className={`ot-request-item ${request.status}`}>
                      <div className="ot-request-header">
                        <div className="staff-info">
                          <div className="staff-avatar">
                            {request.staffName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="staff-details">
                            <h4>{request.staffName}</h4>
                            <span className="staff-id">ID: {request.staffId}</span>
                            <span className="request-date">
                              {request.date}
                              {request.isNightShift && " 🌙"}
                              {request.crossMidnight && " ⏰"}
                            </span>
                          </div>
                        </div>
                        <div className={`status-badge ${request.status}`}>
                          {request.status === "pending" && "⏳ Pending"}
                          {request.status === "approved" && "✅ Approved"}
                          {request.status === "rejected" && "❌ Rejected"}
                        </div>
                      </div>

                      <div className="ot-details">
                        <div className="hours-breakdown">
                          <div className="hours-grid">
                            <div className="hours-item">
                              <span className="hours-label">Regular Hours</span>
                              <span className="hours-value">{regularHours}</span>
                            </div>
                            <div className="hours-item highlight">
                              <span className="hours-label">OT Hours</span>
                              <span className="hours-value ot-highlight">{otHours}</span>
                            </div>
                            <div className="hours-item total">
                              <span className="hours-label">Total Hours</span>
                              <span className="hours-value">{totalHours}</span>
                            </div>
                          </div>
                        </div>

                        <div className="amount-section">
                          <div className="amount-display">
                            <span className="amount-label">OT Amount</span>
                            <span className="amount-value">Rs. {request.otAmount?.toLocaleString() || '0'}</span>
                          </div>
                          <div className="rate-info">
                            <span className="rate-label">Rate</span>
                            <span className="rate-value">Rs. 200/hour</span>
                          </div>
                        </div>

                        {(request.isNightShift || request.crossMidnight) && (
                          <div className="shift-info">
                            {request.isNightShift && <span className="shift-tag night">🌙 Night Shift</span>}
                            {request.crossMidnight && <span className="shift-tag cross">⏰ Crossed Midnight</span>}
                          </div>
                        )}

                        {request.approvedAt && (
                          <div className="approval-info">
                            <div className="approval-header">
                              <strong>
                                {request.status === "approved" ? "Approved" : "Rejected"} on:
                              </strong>
                              <span>{new Date(request.approvedAt).toLocaleString()}</span>
                            </div>
                            {request.rejectionReason && (
                              <div className="rejection-reason">
                                <strong>Reason:</strong> {request.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {request.status === "pending" && (
                        <div className="ot-request-actions">
                          <button 
                            className="btn-primary approve-btn"
                            onClick={() => handleApprove(request)}
                            disabled={loading}
                          >
                            <span className="btn-icon">✅</span>
                            Approve OT
                          </button>
                          <button 
                            className="btn-outline reject-btn"
                            onClick={() => handleReject(request)}
                            disabled={loading}
                          >
                            <span className="btn-icon">❌</span>
                            Reject OT
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === "stats" && (
          <div className="section-card">
            <div className="card-header">
              <h2>OT Statistics</h2>
              <span className="badge">{otRequests.length}</span>
            </div>
            
            <div className="stats-overview">
              <div className="stat-row">
                <span className="stat-label">Total OT Requests:</span>
                <span className="stat-value">{otRequests.length}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Pending Approval:</span>
                <span className="stat-value pending">{stats.pending}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Approved Requests:</span>
                <span className="stat-value success">{stats.approved}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Rejected Requests:</span>
                <span className="stat-value error">{stats.rejected}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Night Shift Requests:</span>
                <span className="stat-value warning">{stats.nightShifts}</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-row total">
                <span className="stat-label">Total OT Hours Approved:</span>
                <span className="stat-value">{formattedTotalHours}</span>
              </div>
              <div className="stat-row total">
                <span className="stat-label">Total OT Amount Approved:</span>
                <span className="stat-value">Rs. {stats.totalOTAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="approval-rate">
              <div className="rate-header">
                <h4>OT Approval Rate</h4>
                <span className="rate-value">
                  {otRequests.length > 0 
                    ? Math.round((stats.approved / otRequests.length) * 100) 
                    : 0
                  }%
                </span>
              </div>
              <div className="rate-bar">
                <div 
                  className="rate-progress"
                  style={{ 
                    width: `${otRequests.length > 0 ? (stats.approved / otRequests.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            <div className="average-stats">
              <div className="average-item">
                <span className="average-label">Avg OT Hours/Request</span>
                <span className="average-value">
                  {formatHours(stats.approved > 0 ? (stats.totalOTHours / stats.approved) : 0)}
                </span>
              </div>
              <div className="average-item">
                <span className="average-label">Avg OT Amount/Request</span>
                <span className="average-value">
                  Rs. {stats.approved > 0 ? Math.round(stats.totalOTAmount / stats.approved) : 0}
                </span>
              </div>
              <div className="average-item">
                <span className="average-label">Night Shift Percentage</span>
                <span className="average-value">
                  {otRequests.length > 0 ? Math.round((stats.nightShifts / otRequests.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        )}

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
          
          {/* ADDED AVAILABILITY BUTTON */}
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