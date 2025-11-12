// src/Pages/AdminDashboard/AdvanceRequests.jsx
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
import "./AdvanceRequests.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function AdvanceRequests({ onLogout }) {
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [activeTab, setActiveTab] = useState("requests");

  const navigate = useNavigate();
  const location = useLocation();

  // Fetch advance requests
  useEffect(() => {
    const q = query(
      collection(db, "advanceRequests"), 
      orderBy("requestDate", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setAdvanceRequests(requests);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (request) => {
    if (!window.confirm(`Approve advance of Rs. ${request.amount} for ${request.staffName}?`)) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "advanceRequests", request.id), {
        status: "approved",
        approvedBy: "admin",
        approvedAt: new Date().toISOString()
      });
      
      showNotification(`Advance approved for ${request.staffName}`, "success");
    } catch (error) {
      console.error("Error approving advance:", error);
      showNotification("Error approving advance: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (request) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "advanceRequests", request.id), {
        status: "rejected",
        approvedBy: "admin",
        approvedAt: new Date().toISOString(),
        rejectionReason: reason
      });
      
      showNotification(`Advance rejected for ${request.staffName}`, "info");
    } catch (error) {
      console.error("Error rejecting advance:", error);
      showNotification("Error rejecting advance: " + error.message, "error");
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

  const filteredRequests = advanceRequests.filter(request => 
    filter === "all" ? true : request.status === filter
  );

  const stats = {
    pending: advanceRequests.filter(r => r.status === "pending").length,
    approved: advanceRequests.filter(r => r.status === "approved").length,
    rejected: advanceRequests.filter(r => r.status === "rejected").length,
    totalAmount: advanceRequests.filter(r => r.status === "approved").reduce((sum, r) => sum + r.amount, 0)
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
    <div className="advance-requests">
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
            <h1>Advance Requests</h1>
            <p>Manage staff advance salary requests</p>
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
              <p>Pending</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon success">✅</div>
            <div className="stat-content">
              <h3>{stats.approved}</h3>
              <p>Approved</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon warning">❌</div>
            <div className="stat-content">
              <h3>{stats.rejected}</h3>
              <p>Rejected</p>
            </div>
          </div>
          
          <div className="stat-card highlight">
            <div className="stat-icon accent">💰</div>
            <div className="stat-content">
              <h3>Rs. {stats.totalAmount.toLocaleString()}</h3>
              <p>Total Approved</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            <span className="tab-icon">📋</span>
            Requests
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
            <option value="pending">⏳ Pending Requests</option>
            <option value="approved">✅ Approved Requests</option>
            <option value="rejected">❌ Rejected Requests</option>
            <option value="all">📋 All Requests</option>
          </select>
        </div>

        {/* Requests List */}
        {activeTab === "requests" && (
          <div className="section-card">
            <div className="card-header">
              <h2>Advance Requests</h2>
              <span className="badge">{filteredRequests.length}</span>
            </div>
            
            {filteredRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No Requests Found</h3>
                <p>No {filter !== "all" ? filter : ""} advance requests at the moment</p>
              </div>
            ) : (
              <div className="requests-list">
                {filteredRequests.map(request => (
                  <div key={request.id} className={`request-item ${request.status}`}>
                    <div className="request-header">
                      <div className="staff-info">
                        <div className="staff-avatar">
                          {request.staffName?.charAt(0).toUpperCase()}
                        </div>
                        <div className="staff-details">
                          <h4>{request.staffName}</h4>
                          <span className="staff-id">ID: {request.staffId}</span>
                        </div>
                      </div>
                      <div className={`status-badge ${request.status}`}>
                        {request.status === "pending" && "⏳ Pending"}
                        {request.status === "approved" && "✅ Approved"}
                        {request.status === "rejected" && "❌ Rejected"}
                      </div>
                    </div>

                    <div className="request-details">
                      <div className="amount-section">
                        <div className="amount-display">
                          <span className="amount-label">Amount</span>
                          <span className="amount-value">Rs. {request.amount?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="date-display">
                          <span className="date-label">Requested</span>
                          <span className="date-value">
                            {request.requestDate ? new Date(request.requestDate).toLocaleDateString() : 'Unknown date'}
                          </span>
                        </div>
                      </div>
                      
                      {request.reason && request.reason !== "No reason provided" && (
                        <div className="reason-section">
                          <div className="reason-label">Reason</div>
                          <div className="reason-text">{request.reason}</div>
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
                      <div className="request-actions">
                        <button 
                          className="btn-primary approve-btn"
                          onClick={() => handleApprove(request)}
                          disabled={loading}
                        >
                          <span className="btn-icon">✅</span>
                          Approve
                        </button>
                        <button 
                          className="btn-outline reject-btn"
                          onClick={() => handleReject(request)}
                          disabled={loading}
                        >
                          <span className="btn-icon">❌</span>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === "stats" && (
          <div className="section-card">
            <div className="card-header">
              <h2>Request Statistics</h2>
              <span className="badge">{advanceRequests.length}</span>
            </div>
            
            <div className="stats-overview">
              <div className="stat-row">
                <span className="stat-label">Total Requests:</span>
                <span className="stat-value">{advanceRequests.length}</span>
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
              <div className="stat-divider"></div>
              <div className="stat-row total">
                <span className="stat-label">Total Amount Approved:</span>
                <span className="stat-value">Rs. {stats.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="approval-rate">
              <div className="rate-header">
                <h4>Approval Rate</h4>
                <span className="rate-value">
                  {advanceRequests.length > 0 
                    ? Math.round((stats.approved / advanceRequests.length) * 100) 
                    : 0
                  }%
                </span>
              </div>
              <div className="rate-bar">
                <div 
                  className="rate-progress"
                  style={{ 
                    width: `${advanceRequests.length > 0 ? (stats.approved / advanceRequests.length) * 100 : 0}%` 
                  }}
                ></div>
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