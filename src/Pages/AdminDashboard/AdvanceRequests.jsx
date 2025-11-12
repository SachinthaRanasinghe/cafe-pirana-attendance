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
  const [searchTerm, setSearchTerm] = useState("");

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
      
      alert(`Advance approved for ${request.staffName}`);
    } catch (error) {
      console.error("Error approving advance:", error);
      alert("Error approving advance: " + error.message);
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
      
      alert(`Advance rejected for ${request.staffName}`);
    } catch (error) {
      console.error("Error rejecting advance:", error);
      alert("Error rejecting advance: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = advanceRequests.filter(request => {
    const matchesFilter = filter === "all" ? true : request.status === filter;
    const matchesSearch = request.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.staffId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">🏪</div>
            <div className="brand-text">
              <h1>Cafe Piranha</h1>
              <span>Advance Requests</span>
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
            <h2>Advance Requests</h2>
            <p>Manage staff advance salary requests</p>
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
              <div className="stat-icon-mobile warning">❌</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.rejected}</div>
                <div className="stat-label">Rejected</div>
              </div>
            </div>
            
            <div className="stat-card-mobile highlight">
              <div className="stat-icon-mobile accent">💰</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{Math.round(stats.totalAmount / 1000)}k</div>
                <div className="stat-label">Total Approved</div>
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
              <option value="pending">⏳ Pending Requests</option>
              <option value="approved">✅ Approved Requests</option>
              <option value="rejected">❌ Rejected Requests</option>
              <option value="all">📋 All Requests</option>
            </select>
          </div>
        </section>

        {/* Requests List */}
        {activeTab === "requests" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>Advance Requests</h3>
              <span className="badge-mobile">{filteredRequests.length}</span>
            </div>
            
            {filteredRequests.length === 0 ? (
              <div className="empty-state-mobile">
                <div className="empty-icon">📋</div>
                <h4>No Requests Found</h4>
                <p>
                  {searchTerm ? 
                    "No matching requests found" : 
                    `No ${filter !== "all" ? filter : ""} advance requests at the moment`
                  }
                </p>
              </div>
            ) : (
              <div className="requests-list-mobile">
                {filteredRequests.map(request => (
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
                      <div className="amount-section-mobile">
                        <div className="amount-display-mobile">
                          <span className="amount-label">Amount</span>
                          <span className="amount-value">Rs. {request.amount?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="date-display-mobile">
                          <span className="date-label">Requested</span>
                          <span className="date-value">
                            {request.requestDate ? new Date(request.requestDate).toLocaleDateString() : 'Unknown date'}
                          </span>
                        </div>
                      </div>
                      
                      {request.reason && request.reason !== "No reason provided" && (
                        <div className="reason-section-mobile">
                          <div className="reason-label">Reason</div>
                          <div className="reason-text">{request.reason}</div>
                        </div>
                      )}

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

                    {request.status === "pending" && (
                      <div className="request-actions-mobile">
                        <button 
                          className="btn-approve-mobile"
                          onClick={() => handleApprove(request)}
                          disabled={loading}
                        >
                          <span className="btn-icon">✅</span>
                          <span className="btn-text">Approve</span>
                        </button>
                        <button 
                          className="btn-reject-mobile"
                          onClick={() => handleReject(request)}
                          disabled={loading}
                        >
                          <span className="btn-icon">❌</span>
                          <span className="btn-text">Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Statistics Tab */}
        {activeTab === "stats" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>Request Statistics</h3>
              <span className="badge-mobile">{advanceRequests.length}</span>
            </div>
            
            <div className="stats-overview-mobile">
              <div className="stat-row-mobile">
                <span className="stat-label">Total Requests:</span>
                <span className="stat-value">{advanceRequests.length}</span>
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
              <div className="stat-divider"></div>
              <div className="stat-row-mobile total">
                <span className="stat-label">Total Amount Approved:</span>
                <span className="stat-value">Rs. {stats.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="approval-rate-mobile">
              <div className="rate-header-mobile">
                <h4>Approval Rate</h4>
                <span className="rate-value">
                  {advanceRequests.length > 0 
                    ? Math.round((stats.approved / advanceRequests.length) * 100) 
                    : 0
                  }%
                </span>
              </div>
              <div className="rate-bar-mobile">
                <div 
                  className="rate-progress-mobile"
                  style={{ 
                    width: `${advanceRequests.length > 0 ? (stats.approved / advanceRequests.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="additional-stats-mobile">
              <div className="stat-card-mini">
                <div className="stat-mini-icon">📈</div>
                <div className="stat-mini-content">
                  <div className="stat-mini-value">{stats.pending}</div>
                  <div className="stat-mini-label">Awaiting Review</div>
                </div>
              </div>
              <div className="stat-card-mini">
                <div className="stat-mini-icon">💰</div>
                <div className="stat-mini-content">
                  <div className="stat-mini-value">{Math.round(stats.totalAmount / 1000)}k</div>
                  <div className="stat-mini-label">Total Approved</div>
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