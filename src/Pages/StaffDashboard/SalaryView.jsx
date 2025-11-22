// src/Pages/StaffDashboard/SalaryView.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  query,
  where,
  doc
} from "firebase/firestore";
import { db } from "../../firebase";
import "./SalaryView.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function SalaryView({ staffData, onLogout }) {
  const [salary, setSalary] = useState(null);
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [adjustmentRequests, setAdjustmentRequests] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const navigate = useNavigate();
  const location = useLocation();
  
  const { staffName, staffId, uid } = staffData || {};

  // Fetch staff salary
  useEffect(() => {
    if (!uid) {
      console.error("No UID available for salary fetch");
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "salaries", uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setSalary(docSnapshot.data());
      } else {
        setSalary(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  // Fetch advance requests
  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "advanceRequests"),
      where("staffUid", "==", uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      
      requests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
      setAdvanceRequests(requests);
    });

    return () => unsubscribe();
  }, [uid]);

  // Fetch adjustment requests (both OT and Short Time)
  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "adjustmentRequests"),
      where("staffUid", "==", uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      
      requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
      setAdjustmentRequests(requests);
    });

    return () => unsubscribe();
  }, [uid]);

  // Calculate current month stats with proper adjustments
  const calculateMonthStats = () => {
    const basicSalary = salary?.monthlySalary || 0;
    
    // Calculate approved advances for current month
    const currentMonthAdvances = advanceRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth && req.status === "approved";
      })
      .reduce((sum, req) => sum + (req.amount || 0), 0);

    // Calculate net adjustments (OT - Short Time)
    const currentMonthAdjustments = adjustmentRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth && req.status === "approved";
      })
      .reduce((sum, req) => {
        if (req.adjustmentType === 'overtime') {
          return sum + (req.adjustmentAmount || 0);
        } else if (req.adjustmentType === 'short_time') {
          return sum - (req.adjustmentAmount || 0);
        }
        return sum;
      }, 0);

    const netSalary = Math.max(0, basicSalary + currentMonthAdjustments - currentMonthAdvances);

    return {
      basicSalary,
      advances: currentMonthAdvances,
      adjustments: currentMonthAdjustments,
      netSalary,
      remainingSalary: Math.max(0, basicSalary - currentMonthAdvances),
      otAmount: adjustmentRequests
        .filter(req => {
          const requestMonth = req.shiftMonth || req.month;
          return requestMonth === currentMonth && req.status === "approved" && req.adjustmentType === 'overtime';
        })
        .reduce((sum, req) => sum + (req.adjustmentAmount || 0), 0),
      shortAmount: adjustmentRequests
        .filter(req => {
          const requestMonth = req.shiftMonth || req.month;
          return requestMonth === currentMonth && req.status === "approved" && req.adjustmentType === 'short_time';
        })
        .reduce((sum, req) => sum + (req.adjustmentAmount || 0), 0)
    };
  };

  const monthStats = calculateMonthStats();

  // Calculate statistics for display
  const getAdvanceStats = () => {
    const currentMonthAdvances = advanceRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth && req.status === "approved";
      });

    const pendingAdvances = advanceRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth && req.status === "pending";
      });

    return {
      approvedCount: currentMonthAdvances.length,
      pendingCount: pendingAdvances.length,
      totalAdvances: currentMonthAdvances.reduce((sum, req) => sum + (req.amount || 0), 0)
    };
  };

  const getAdjustmentStats = () => {
    const currentMonthAdjustments = adjustmentRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth;
      });

    const approvedOT = currentMonthAdjustments.filter(req => 
      req.status === "approved" && req.adjustmentType === 'overtime'
    );
    const approvedShort = currentMonthAdjustments.filter(req => 
      req.status === "approved" && req.adjustmentType === 'short_time'
    );
    const pendingAdjustments = currentMonthAdjustments.filter(req => 
      req.status === "pending"
    );

    return {
      otCount: approvedOT.length,
      shortCount: approvedShort.length,
      pendingCount: pendingAdjustments.length,
      totalOT: approvedOT.reduce((sum, req) => sum + (req.adjustmentAmount || 0), 0),
      totalShort: approvedShort.reduce((sum, req) => sum + (req.adjustmentAmount || 0), 0)
    };
  };

  const advanceStats = getAdvanceStats();
  const adjustmentStats = getAdjustmentStats();

  const isActiveRoute = (path) => location.pathname.includes(path);

  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (error) {
      console.warn("Navigation error, using fallback:", error);
      window.location.href = path;
    }
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const formatMonth = (monthString) => {
    return new Date(monthString + '-01').toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  if (!staffData) {
    return (
      <div className="salary-view">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h2>Staff Data Not Available</h2>
          <p>Please log in again to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="salary-view">
      {/* Professional Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-logo">💰</div>
            <div className="brand-text">
              <h1 className="brand-title">Salary Portal</h1>
              <span className="brand-subtitle">Cafe Piranha</span>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="user-avatar-small">
              {staffName?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* User Info Bar */}
        <div className="user-info-bar">
          <div className="user-details">
            <span className="user-greeting">Hello, {staffName?.split(' ')[0]}</span>
            <span className="user-id">ID: {staffId}</span>
          </div>
          <div className="current-date">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-main">
        {/* Welcome Card */}
        <section className="welcome-section">
          <div className="welcome-card">
            <div className="welcome-content">
              <div className="welcome-header">
                <h2 className="welcome-title">
                  Good {getTimeOfDay()}! 🌅
                </h2>
                <div className="salary-period">
                  {formatMonth(currentMonth)}
                </div>
              </div>
              <p className="welcome-subtitle">
                Your financial overview for this period
              </p>
            </div>
            <div className="welcome-graphic">
              <div className="money-emoji">💰</div>
            </div>
          </div>
        </section>

        {/* Month Selector */}
        <section className="filter-section">
          <div className="filter-card">
            <div className="filter-header">
              <h3 className="filter-title">Select Period</h3>
              <div className="month-badge">
                {new Date(currentMonth + '-01').toLocaleDateString('en-US', { 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </div>
            </div>
            <div className="month-selector">
              <input 
                type="month" 
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="month-input"
              />
              <div className="calendar-icon">📅</div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="tabs-section">
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span className="tab-icon">📊</span>
              <span className="tab-text">Overview</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === "adjustments" ? "active" : ""}`}
              onClick={() => setActiveTab("adjustments")}
            >
              <span className="tab-icon">🕒</span>
              <span className="tab-text">Time</span>
              {adjustmentStats.pendingCount > 0 && (
                <span className="tab-badge">{adjustmentStats.pendingCount}</span>
              )}
            </button>
            <button 
              className={`tab-btn ${activeTab === "advances" ? "active" : ""}`}
              onClick={() => setActiveTab("advances")}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-text">Advances</span>
              {advanceStats.pendingCount > 0 && (
                <span className="tab-badge">{advanceStats.pendingCount}</span>
              )}
            </button>
          </div>
        </section>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading your salary data...</p>
          </div>
        ) : !salary ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <h3 className="empty-title">Salary Not Configured</h3>
            <p className="empty-description">
              Your salary information hasn't been set up yet. Please contact administration.
            </p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="tab-content">
                {/* Net Salary Card */}
                <section className="salary-card-section">
                  <div className="net-salary-card">
                    <div className="salary-header">
                      <h3 className="salary-title">Net Salary</h3>
                      <div className="salary-period">{formatMonth(currentMonth)}</div>
                    </div>
                    <div className="salary-amount">
                      {formatCurrency(monthStats.netSalary)}
                    </div>
                    <div className="salary-breakdown">
                      <div className="breakdown-item">
                        <span className="breakdown-label">Base Salary</span>
                        <span className="breakdown-value">{formatCurrency(monthStats.basicSalary)}</span>
                      </div>
                      {monthStats.otAmount > 0 && (
                        <div className="breakdown-item positive">
                          <span className="breakdown-label">Overtime</span>
                          <span className="breakdown-value">+{formatCurrency(monthStats.otAmount)}</span>
                        </div>
                      )}
                      {monthStats.shortAmount > 0 && (
                        <div className="breakdown-item negative">
                          <span className="breakdown-label">Short Time</span>
                          <span className="breakdown-value">-{formatCurrency(monthStats.shortAmount)}</span>
                        </div>
                      )}
                      {monthStats.advances > 0 && (
                        <div className="breakdown-item negative">
                          <span className="breakdown-label">Advances</span>
                          <span className="breakdown-value">-{formatCurrency(monthStats.advances)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Quick Stats */}
                <section className="stats-section">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon primary">💼</div>
                      <div className="stat-content">
                        <div className="stat-value">{formatCurrency(monthStats.basicSalary)}</div>
                        <div className="stat-label">Base Salary</div>
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-icon success">🔼</div>
                      <div className="stat-content">
                        <div className="stat-value">{formatCurrency(monthStats.otAmount)}</div>
                        <div className="stat-label">Overtime</div>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-icon warning">🔽</div>
                      <div className="stat-content">
                        <div className="stat-value">{formatCurrency(monthStats.shortAmount)}</div>
                        <div className="stat-label">Short Time</div>
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-icon danger">📋</div>
                      <div className="stat-content">
                        <div className="stat-value">{formatCurrency(monthStats.advances)}</div>
                        <div className="stat-label">Advances</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Insights */}
                <section className="insights-section">
                  <div className="section-header">
                    <h3 className="section-title">Monthly Insights</h3>
                  </div>
                  <div className="insights-grid">
                    <div className="insight-card">
                      <div className="insight-icon">📊</div>
                      <div className="insight-content">
                        <div className="insight-value">{advanceStats.approvedCount}</div>
                        <div className="insight-label">Approved Advances</div>
                      </div>
                    </div>
                    
                    <div className="insight-card">
                      <div className="insight-icon">✅</div>
                      <div className="insight-content">
                        <div className="insight-value">{adjustmentStats.otCount}</div>
                        <div className="insight-label">OT Approvals</div>
                      </div>
                    </div>

                    <div className="insight-card">
                      <div className="insight-icon">⏰</div>
                      <div className="insight-content">
                        <div className="insight-value">{adjustmentStats.shortCount}</div>
                        <div className="insight-label">Short Time</div>
                      </div>
                    </div>
                    
                    <div className="insight-card">
                      <div className="insight-icon">📈</div>
                      <div className="insight-content">
                        <div className="insight-value">
                          {Math.round((monthStats.advances / monthStats.basicSalary) * 100)}%
                        </div>
                        <div className="insight-label">Advance Usage</div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Adjustments Tab */}
            {activeTab === "adjustments" && (
              <div className="tab-content">
                <section className="history-section">
                  <div className="section-header">
                    <h3 className="section-title">Time Adjustments</h3>
                    <div className="section-badge">
                      {adjustmentRequests.filter(adj => {
                        const adjMonth = adj.shiftMonth || adj.month;
                        return adjMonth === currentMonth;
                      }).length}
                    </div>
                  </div>

                  {adjustmentRequests.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🕒</div>
                      <h4 className="empty-title">No Adjustments</h4>
                      <p className="empty-description">No time adjustments recorded yet</p>
                    </div>
                  ) : (
                    <div className="history-list">
                      {adjustmentRequests
                        .filter(adj => {
                          const adjMonth = adj.shiftMonth || adj.month;
                          return adjMonth === currentMonth;
                        })
                        .map(adj => (
                        <div key={adj.id} className={`history-card ${adj.status} ${adj.adjustmentType}`}>
                          <div className="card-header">
                            <div className="card-type">
                              <div className={`type-icon ${adj.adjustmentType}`}>
                                {adj.adjustmentType === 'overtime' ? '🔼' : '🔽'}
                              </div>
                              <div className="type-info">
                                <span className="type-name">
                                  {adj.adjustmentType === 'overtime' ? 'Overtime' : 'Short Time'}
                                </span>
                                <span className="type-date">{adj.date || 'Unknown date'}</span>
                              </div>
                            </div>
                            <div className={`amount-badge ${adj.adjustmentType}`}>
                              {adj.adjustmentType === 'overtime' ? '+' : '-'}{formatCurrency(adj.adjustmentAmount || 0)}
                            </div>
                          </div>
                          
                          <div className="card-details">
                            <div className="detail-item">
                              <span className="detail-label">Hours:</span>
                              <span className="detail-value">
                                {adj.adjustmentHours || 0}h (Total: {adj.totalHours || 0}h)
                              </span>
                            </div>
                            
                            <div className="detail-item">
                              <span className="detail-label">Status:</span>
                              <div className={`status-tag ${adj.status}`}>
                                <span className="status-icon">
                                  {adj.status === "pending" && "⏳"}
                                  {adj.status === "approved" && "✅"}
                                  {adj.status === "rejected" && "❌"}
                                </span>
                                <span className="status-text">
                                  {adj.status.charAt(0).toUpperCase() + adj.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            
                            {adj.status === "rejected" && adj.rejectionReason && (
                              <div className="rejection-note">
                                <span className="note-label">Reason:</span>
                                <span className="note-text">{adj.rejectionReason}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {adjustmentRequests.filter(adj => {
                        const adjMonth = adj.shiftMonth || adj.month;
                        return adjMonth === currentMonth;
                      }).length === 0 && (
                        <div className="empty-state">
                          <div className="empty-icon">📅</div>
                          <h4 className="empty-title">No Adjustments This Month</h4>
                          <p className="empty-description">No time adjustments for selected period</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Advances Tab */}
            {activeTab === "advances" && (
              <div className="tab-content">
                <section className="history-section">
                  <div className="section-header">
                    <h3 className="section-title">Advance History</h3>
                    <div className="section-badge">
                      {advanceRequests.filter(adv => {
                        const advanceMonth = adv.shiftMonth || adv.month;
                        return advanceMonth === currentMonth;
                      }).length}
                    </div>
                  </div>

                  {advanceRequests.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📋</div>
                      <h4 className="empty-title">No Advance Requests</h4>
                      <p className="empty-description">No advance requests made yet</p>
                    </div>
                  ) : (
                    <div className="history-list">
                      {advanceRequests
                        .filter(adv => {
                          const advanceMonth = adv.shiftMonth || adv.month;
                          return advanceMonth === currentMonth;
                        })
                        .map(advance => (
                        <div key={advance.id} className={`history-card ${advance.status}`}>
                          <div className="card-header">
                            <div className="card-type">
                              <div className="type-icon">💳</div>
                              <div className="type-info">
                                <span className="type-name">Salary Advance</span>
                                <span className="type-date">
                                  {advance.requestDate ? 
                                    new Date(advance.requestDate).toLocaleDateString() : 'Unknown date'
                                  }
                                </span>
                              </div>
                            </div>
                            <div className="amount-badge advance">
                              {formatCurrency(advance.amount || 0)}
                            </div>
                          </div>
                          
                          <div className="card-details">
                            {advance.reason && advance.reason !== "No reason provided" && (
                              <div className="detail-item">
                                <span className="detail-label">Purpose:</span>
                                <span className="detail-value">{advance.reason}</span>
                              </div>
                            )}
                            
                            <div className="detail-item">
                              <span className="detail-label">Status:</span>
                              <div className={`status-tag ${advance.status}`}>
                                <span className="status-icon">
                                  {advance.status === "pending" && "⏳"}
                                  {advance.status === "approved" && "✅"}
                                  {advance.status === "rejected" && "❌"}
                                </span>
                                <span className="status-text">
                                  {advance.status.charAt(0).toUpperCase() + advance.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            
                            {advance.approvedAt && (
                              <div className="detail-item">
                                <span className="detail-label">Processed:</span>
                                <span className="detail-value">
                                  {new Date(advance.approvedAt).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {advanceRequests.filter(adv => {
                        const advanceMonth = adv.shiftMonth || adv.month;
                        return advanceMonth === currentMonth;
                      }).length === 0 && (
                        <div className="empty-state">
                          <div className="empty-icon">📅</div>
                          <h4 className="empty-title">No Advances This Month</h4>
                          <p className="empty-description">No advance requests for selected period</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        {/* Quick Actions */}
        <section className="actions-section">
          <div className="action-buttons">
            <button 
              className="action-btn primary"
              onClick={() => safeNavigate('/staff/advance')}
            >
              <span className="btn-icon">💸</span>
              <span className="btn-text">Request Advance</span>
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={() => safeNavigate('/staff')}
            >
              <span className="btn-icon">📊</span>
              <span className="btn-text">View Dashboard</span>
            </button>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`nav-item ${isActiveRoute('/staff') && !isActiveRoute('/staff/salary') && !isActiveRoute('/staff/advance') && !isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/salary')}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-label">Salary</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/advance') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/advance')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Advance</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Schedule</span>
        </button>

        <button className="nav-item logout" onClick={handleLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </div>
  );
}