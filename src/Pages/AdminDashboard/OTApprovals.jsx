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
import { validateOTHours } from "../../utils/validationHelpers";

export default function OTApprovals({ onLogout }) {
  const [adjustmentRequests, setAdjustmentRequests] = useState([]);
  const [salaries, setSalaries] = useState({}); // Add salaries state
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [activeTab, setActiveTab] = useState("requests");
  const [searchTerm, setSearchTerm] = useState("");
  const [requestType, setRequestType] = useState("all");
  const [editingRequest, setEditingRequest] = useState(null);
  const [editedHours, setEditedHours] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Helper function to format hours properly
  const formatHours = (hours) => {
    if (!hours && hours !== 0) return "0h";
    
    const rounded = Math.round(hours * 100) / 100;
    if (rounded % 1 === 0) {
      return `${rounded}h`;
    }
    return `${rounded.toFixed(1)}h`;
  };

  // Calculate amount based on hours and staff-specific rate
  const calculateAmount = (hours, staffUid) => {
    const staffOtRate = salaries[staffUid]?.otRate || 200;
    return Math.round(hours * staffOtRate);
  };

  // Get OT rate for a staff member
  const getOtRate = (staffUid) => {
    return salaries[staffUid]?.otRate || 200;
  };

  // Fetch adjustment requests
  useEffect(() => {
    const q = query(
      collection(db, "adjustmentRequests"), 
      orderBy("requestedAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setAdjustmentRequests(requests);
    });

    return () => unsubscribe();
  }, []);

  // Fetch salaries to get staff-specific OT rates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "salaries"), (snapshot) => {
      const salaryData = {};
      snapshot.forEach((doc) => {
        salaryData[doc.id] = doc.data();
      });
      setSalaries(salaryData);
    });

    return () => unsubscribe();
  }, []);

  // Start editing a request
  const startEditing = (request) => {
    setEditingRequest(request);
    setEditedHours(request.adjustmentHours?.toString() || "");
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingRequest(null);
    setEditedHours("");
  };

  // Save edited hours - UPDATED to use staff-specific rates
  const saveEditedHours = async () => {
    // Use improved validation
    const validation = validateOTHours(editedHours);
    if (!validation.valid) {
      showNotification(validation.error, "error");
      return;
    }
    
    if (!editingRequest) {
      showNotification("No request selected for editing", "error");
      return;
    }

    setSavingEdit(true);
    try {
      const newHours = parseFloat(editedHours);
      const staffOtRate = getOtRate(editingRequest.staffUid);
      const newAmount = calculateAmount(newHours, editingRequest.staffUid);
      const isOT = editingRequest.adjustmentType === 'overtime';

      await updateDoc(doc(db, "adjustmentRequests", editingRequest.id), {
        adjustmentHours: newHours,
        adjustmentAmount: newAmount,
        adminEdited: true,
        originalHours: editingRequest.adjustmentHours,
        originalAmount: editingRequest.adjustmentAmount,
        editedAt: new Date().toISOString(),
        editedBy: "admin",
        staffOtRate: staffOtRate // Store the rate used
      });

      showNotification(
        `✅ ${isOT ? 'OT' : 'Short Time'} hours updated from ${formatHours(editingRequest.adjustmentHours)} to ${formatHours(newHours)}. ` +
        `Amount: ${isOT ? '+' : '-'}Rs. ${newAmount} (Rate: Rs. ${staffOtRate}/hour)`,
        "success"
      );
      
      setEditingRequest(null);
      setEditedHours("");
    } catch (error) {
      console.error("Error updating hours:", error);
      showNotification("❌ Error updating hours: " + error.message, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleApprove = async (request) => {
    const isOT = request.adjustmentType === 'overtime';
    const amount = Math.abs(request.adjustmentAmount || 0);
    const hours = request.adjustmentHours || 0;
    const staffOtRate = getOtRate(request.staffUid);
    
    if (!window.confirm(
      `${isOT ? 'Approve' : 'Confirm'} ${formatHours(hours)} ${isOT ? 'OT' : 'Short Time'} for ${request.staffName}? ` +
      `${isOT ? 'Amount: +Rs.' : 'Deduction: -Rs.'} ${amount} (Rate: Rs. ${staffOtRate}/hour)`
    )) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "adjustmentRequests", request.id), {
        status: "approved",
        approvedBy: "admin",
        approvedAt: new Date().toISOString(),
        staffOtRate: staffOtRate // Store the rate used for approval
      });
      
      showNotification(`✅ ${isOT ? 'OT' : 'Short Time'} approved for ${request.staffName} (Rate: Rs. ${staffOtRate}/hour)`, "success");
    } catch (error) {
      console.error("Error approving adjustment:", error);
      showNotification("❌ Error approving request: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (request) => {
    const isOT = request.adjustmentType === 'overtime';
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "adjustmentRequests", request.id), {
        status: "rejected",
        approvedBy: "admin",
        approvedAt: new Date().toISOString(),
        rejectionReason: reason
      });
      
      showNotification(`❌ ${isOT ? 'OT' : 'Short Time'} rejected for ${request.staffName}`, "info");
    } catch (error) {
      console.error("Error rejecting adjustment:", error);
      showNotification("❌ Error rejecting request: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg, type = "info") => {
    alert(msg);
  };

  const filteredRequests = adjustmentRequests.filter(request => {
    const matchesFilter = filter === "all" ? true : request.status === filter;
    const matchesSearch = request.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.staffId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = requestType === "all" ? true : request.adjustmentType === requestType;
    
    return matchesFilter && matchesSearch && matchesType;
  });

  // Calculate stats with formatted hours
  const stats = {
    pending: adjustmentRequests.filter(r => r.status === "pending").length,
    approved: adjustmentRequests.filter(r => r.status === "approved").length,
    rejected: adjustmentRequests.filter(r => r.status === "rejected").length,
    totalOTHours: adjustmentRequests
      .filter(r => r.status === "approved" && r.adjustmentType === "overtime")
      .reduce((sum, r) => sum + (r.adjustmentHours || 0), 0),
    totalOTAmount: adjustmentRequests
      .filter(r => r.status === "approved" && r.adjustmentType === "overtime")
      .reduce((sum, r) => sum + (r.adjustmentAmount || 0), 0),
    totalShortHours: adjustmentRequests
      .filter(r => r.status === "approved" && r.adjustmentType === "short_time")
      .reduce((sum, r) => sum + (r.adjustmentHours || 0), 0),
    totalShortAmount: adjustmentRequests
      .filter(r => r.status === "approved" && r.adjustmentType === "short_time")
      .reduce((sum, r) => sum + (r.adjustmentAmount || 0), 0),
    overtimeRequests: adjustmentRequests.filter(r => r.adjustmentType === "overtime").length,
    shortTimeRequests: adjustmentRequests.filter(r => r.adjustmentType === "short_time").length
  };

  // Format total hours for display
  const formattedOTHours = formatHours(stats.totalOTHours);
  const formattedShortHours = formatHours(stats.totalShortHours);

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
              <span>Time Adjustments</span>
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
            <h2>Time Adjustments</h2>
            <p>Manage overtime & short time requests with staff-specific rates</p>
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
              <div className="stat-icon-mobile success">🔼</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.overtimeRequests}</div>
                <div className="stat-label">OT Requests</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile warning">🔽</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.shortTimeRequests}</div>
                <div className="stat-label">Short Time</div>
              </div>
            </div>
            
            <div className="stat-card-mobile highlight">
              <div className="stat-icon-mobile accent">💰</div>
              <div className="stat-content-mobile">
                <div className="stat-value">Rs. {Math.round((stats.totalOTAmount - stats.totalShortAmount) / 1000)}k</div>
                <div className="stat-label">Net Adjust</div>
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
                {requestType === "overtime" && " 🕒 OT"}
                {requestType === "short_time" && " ⏰ Short"}
              </div>
            </div>
            
            <div className="filter-controls-mobile">
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)} 
                className="filter-select-mobile"
              >
                <option value="pending">⏳ Pending</option>
                <option value="approved">✅ Approved</option>
                <option value="rejected">❌ Rejected</option>
                <option value="all">📋 All Status</option>
              </select>
              
              <select 
                value={requestType} 
                onChange={(e) => setRequestType(e.target.value)} 
                className="filter-select-mobile"
              >
                <option value="all">📋 All Types</option>
                <option value="overtime">🕒 Overtime</option>
                <option value="short_time">⏰ Short Time</option>
              </select>
            </div>
          </div>
        </section>

        {/* Adjustment Requests List */}
        {activeTab === "requests" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>Adjustment Requests</h3>
              <span className="badge-mobile">{filteredRequests.length}</span>
            </div>
            
            {filteredRequests.length === 0 ? (
              <div className="empty-state-mobile">
                <div className="empty-icon">🕒</div>
                <h4>No Requests Found</h4>
                <p>
                  {searchTerm ? 
                    "No matching requests found" : 
                    `No ${filter !== "all" ? filter : ""} ${requestType !== "all" ? requestType : ""} requests`
                  }
                </p>
              </div>
            ) : (
              <div className="requests-list-mobile">
                {filteredRequests.map(request => {
                  const isOT = request.adjustmentType === 'overtime';
                  const adjustmentHours = request.adjustmentHours || 0;
                  const adjustmentAmount = request.adjustmentAmount || 0;
                  const totalHours = request.totalHours || 0;
                  const regularHours = request.regularHours || Math.min(totalHours, 12);
                  const isEditing = editingRequest?.id === request.id;
                  const staffOtRate = getOtRate(request.staffUid);
                  const displayRate = request.staffOtRate || staffOtRate;
                  
                  return (
                    <div key={request.id} className={`request-item-mobile ${request.status} ${isOT ? 'overtime' : 'short-time'} ${isEditing ? 'editing' : ''}`}>
                      <div className="request-header-mobile">
                        <div className="staff-info-mobile">
                          <div className="staff-avatar-mobile">
                            {request.staffName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="staff-details-mobile">
                            <h4>{request.staffName}</h4>
                            <span className="staff-id">ID: {request.staffId}</span>
                            <span className="request-date">{request.date}</span>
                            <span className="ot-rate-display">
                              OT Rate: Rs. {displayRate}/hour
                            </span>
                            {request.adminEdited && (
                              <span className="edited-badge">✏️ Admin Edited</span>
                            )}
                          </div>
                        </div>
                        <div className={`status-badge-mobile ${request.status} ${isOT ? 'overtime-badge' : 'short-time-badge'}`}>
                          {isOT ? '🕒 OT' : '⏰ Short'} • {request.status === "pending" && "⏳"}
                          {request.status === "approved" && "✅"}
                          {request.status === "rejected" && "❌"}
                        </div>
                      </div>

                      <div className="request-details-mobile">
                        {/* Hours Summary */}
                        <div className="hours-summary-mobile">
                          <div className="summary-row">
                            <span className="summary-label">Total Worked:</span>
                            <span className="summary-value">{formatHours(totalHours)}</span>
                          </div>
                          <div className="summary-row">
                            <span className="summary-label">Regular Hours:</span>
                            <span className="summary-value">{formatHours(regularHours)}</span>
                          </div>
                          
                          {/* Editable Hours Section */}
                          {isEditing ? (
                            <div className="edit-hours-section-mobile">
                              <div className="edit-row">
                                <span className="edit-label">
                                  {isOT ? 'Overtime:' : 'Short Time:'}
                                </span>
                                <div className="edit-controls">
                                  <input
                                    type="number"
                                    value={editedHours}
                                    onChange={(e) => setEditedHours(e.target.value)}
                                    className="hours-input-mobile"
                                    step="0.5"
                                    min="0.5"
                                    max={isOT ? "24" : "12"}
                                    placeholder="Enter hours"
                                  />
                                  <span className="hours-unit">hours</span>
                                </div>
                              </div>
                              <div className="calculated-amount-mobile">
                                <span className="amount-label">Calculated Amount:</span>
                                <span className={`amount-value ${isOT ? 'positive' : 'negative'}`}>
                                  {isOT ? '+' : '-'}Rs. {calculateAmount(parseFloat(editedHours) || 0, request.staffUid).toLocaleString()}
                                </span>
                                <span className="rate-display">@ Rs. {staffOtRate}/hour</span>
                              </div>
                            </div>
                          ) : (
                            <div className="summary-row highlight">
                              <span className="summary-label">
                                {isOT ? 'Overtime:' : 'Short Time:'}
                              </span>
                              <span className={`summary-value ${isOT ? 'positive' : 'negative'}`}>
                                {isOT ? '+' : '-'}{formatHours(adjustmentHours)}
                                {request.adminEdited && " ✏️"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Amount Section */}
                        {!isEditing && (
                          <div className="amount-section-mobile">
                            <div className="amount-display-mobile">
                              <span className="amount-label">
                                {isOT ? 'OT Amount' : 'Deduction Amount'}
                              </span>
                              <span className={`amount-value ${isOT ? 'positive' : 'negative'}`}>
                                {isOT ? '+' : '-'}Rs. {Math.abs(adjustmentAmount).toLocaleString()}
                              </span>
                            </div>
                            <div className="rate-info-mobile">
                              <span className="rate-label">Rate: Rs. {displayRate}/hour</span>
                              {request.staffOtRate && (
                                <span className="rate-source">(Staff-specific rate)</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Session Count */}
                        {request.sessions && !isEditing && (
                          <div className="sessions-info-mobile">
                            <span className="sessions-label">
                              Sessions: {request.sessions.length}
                            </span>
                          </div>
                        )}

                        {/* Approval Info */}
                        {request.approvedAt && !isEditing && (
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

                      {/* Action Buttons */}
                      <div className="request-actions-mobile">
                        {isEditing ? (
                          <div className="edit-actions-mobile">
                            <button 
                              className="btn-save-edit-mobile"
                              onClick={saveEditedHours}
                              disabled={savingEdit || !editedHours || parseFloat(editedHours) <= 0}
                            >
                              <span className="btn-icon">💾</span>
                              <span className="btn-text">
                                {savingEdit ? 'Saving...' : 'Save Changes'}
                              </span>
                            </button>
                            <button 
                              className="btn-cancel-edit-mobile"
                              onClick={cancelEditing}
                              disabled={savingEdit}
                            >
                              <span className="btn-icon">❌</span>
                              <span className="btn-text">Cancel</span>
                            </button>
                          </div>
                        ) : request.status === "pending" ? (
                          <>
                            <button 
                              className="btn-edit-hours-mobile"
                              onClick={() => startEditing(request)}
                              disabled={loading}
                            >
                              <span className="btn-icon">✏️</span>
                              <span className="btn-text">Edit Hours</span>
                            </button>
                            <button 
                              className={`btn-approve-mobile ${isOT ? 'ot-approve' : 'short-approve'}`}
                              onClick={() => handleApprove(request)}
                              disabled={loading}
                            >
                              <span className="btn-icon">✅</span>
                              <span className="btn-text">
                                {isOT ? 'Approve OT' : 'Confirm Deduction'}
                              </span>
                            </button>
                            <button 
                              className="btn-reject-mobile"
                              onClick={() => handleReject(request)}
                              disabled={loading}
                            >
                              <span className="btn-icon">❌</span>
                              <span className="btn-text">Reject</span>
                            </button>
                          </>
                        ) : request.status === "approved" && (
                          <button 
                            className="btn-edit-hours-mobile"
                            onClick={() => startEditing(request)}
                            disabled={loading}
                          >
                            <span className="btn-icon">✏️</span>
                            <span className="btn-text">Edit Hours</span>
                          </button>
                        )}
                      </div>

                      {/* Original Values (if edited) */}
                      {request.adminEdited && !isEditing && (
                        <div className="original-values-mobile">
                          <div className="original-header-mobile">
                            <strong>Original Values:</strong>
                          </div>
                          <div className="original-details-mobile">
                            <span>Hours: {formatHours(request.originalHours)}</span>
                            <span>Amount: Rs. {Math.abs(request.originalAmount).toLocaleString()}</span>
                            <span>Edited: {new Date(request.editedAt).toLocaleDateString()}</span>
                          </div>
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
              <h3>Adjustment Statistics</h3>
              <span className="badge-mobile">{adjustmentRequests.length}</span>
            </div>
            
            <div className="stats-overview-mobile">
              <div className="stat-row-mobile">
                <span className="stat-label">Total Requests:</span>
                <span className="stat-value">{adjustmentRequests.length}</span>
              </div>
              <div className="stat-row-mobile">
                <span className="stat-label">Pending Approval:</span>
                <span className="stat-value pending">{stats.pending}</span>
              </div>
              <div className="stat-row-mobile">
                <span className="stat-label">Overtime Requests:</span>
                <span className="stat-value success">{stats.overtimeRequests}</span>
              </div>
              <div className="stat-row-mobile">
                <span className="stat-label">Short Time Requests:</span>
                <span className="stat-value warning">{stats.shortTimeRequests}</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-row-mobile total positive">
                <span className="stat-label">Total OT Hours Approved:</span>
                <span className="stat-value">+{formattedOTHours}</span>
              </div>
              <div className="stat-row-mobile total positive">
                <span className="stat-label">Total OT Amount Approved:</span>
                <span className="stat-value">+Rs. {stats.totalOTAmount.toLocaleString()}</span>
              </div>
              <div className="stat-row-mobile total negative">
                <span className="stat-label">Total Short Hours Approved:</span>
                <span className="stat-value">-{formattedShortHours}</span>
              </div>
              <div className="stat-row-mobile total negative">
                <span className="stat-label">Total Short Amount Approved:</span>
                <span className="stat-value">-Rs. {stats.totalShortAmount.toLocaleString()}</span>
              </div>
              <div className="stat-row-mobile total highlight">
                <span className="stat-label">Net Adjustment:</span>
                <span className="stat-value">
                  Rs. {(stats.totalOTAmount - stats.totalShortAmount).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Approval Rate */}
            <div className="approval-rate-mobile">
              <div className="rate-header-mobile">
                <h4>Overall Approval Rate</h4>
                <span className="rate-value">
                  {adjustmentRequests.length > 0 
                    ? Math.round((stats.approved / adjustmentRequests.length) * 100) 
                    : 0
                  }%
                </span>
              </div>
              <div className="rate-bar-mobile">
                <div 
                  className="rate-progress-mobile"
                  style={{ 
                    width: `${adjustmentRequests.length > 0 ? (stats.approved / adjustmentRequests.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="additional-stats-mobile">
              <div className="stat-card-mini positive">
                <div className="stat-mini-icon">🔼</div>
                <div className="stat-mini-content">
                  <div className="stat-mini-value">
                    {formatHours(stats.overtimeRequests > 0 ? (stats.totalOTHours / stats.overtimeRequests) : 0)}
                  </div>
                  <div className="stat-mini-label">Avg OT Hours</div>
                </div>
              </div>
              <div className="stat-card-mini negative">
                <div className="stat-mini-icon">🔽</div>
                <div className="stat-mini-content">
                  <div className="stat-mini-value">
                    {formatHours(stats.shortTimeRequests > 0 ? (stats.totalShortHours / stats.shortTimeRequests) : 0)}
                  </div>
                  <div className="stat-mini-label">Avg Short Hours</div>
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
                setRequestType("all");
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
                setRequestType("all");
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
          <span className="nav-label">Adjustments</span>
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