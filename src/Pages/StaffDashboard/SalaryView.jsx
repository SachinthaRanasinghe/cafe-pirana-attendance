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
      {/* Enhanced Header */}
      <header className="dashboard-header">
        <div className="header-container">
          <div className="brand-section">
            <div className="logo-container">
              <div className="logo-icon">💰</div>
              <div className="brand-text">
                <h1 className="brand-title">Cafe Piranha</h1>
                <span className="brand-subtitle">Salary Portal</span>
              </div>
            </div>
          </div>
          
          <div className="user-section">
            <div className="user-profile">
              <div className="user-avatar">
                {staffName?.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{staffName}</span>
                <span className="user-id">ID: {staffId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-item">
            <div className="date-badge">
              <span className="date-icon">📅</span>
              <span>{new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })}</span>
            </div>
          </div>
          
          {salary?.monthlySalary && (
            <div className="status-item">
              <div className="rate-badge">
                <span className="rate-icon">💼</span>
                <span>Base: {formatCurrency(salary.monthlySalary)}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div className="welcome-card">
            <div className="welcome-content">
              <h2 className="welcome-title">
                Good {getTimeOfDay()}, {staffName?.split(' ')[0]}!
              </h2>
              <p className="welcome-subtitle">
                Your salary overview and financial insights
              </p>
              <div className="salary-period">
                <span className="period-label">Viewing Period</span>
                <span className="period-value">
                  {new Date(currentMonth + '-01').toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </span>
              </div>
            </div>
            <div className="welcome-graphic">
              <div className="money-animation">💰✨</div>
            </div>
          </div>
        </section>

        {/* Month Selector */}
        <section className="filter-section">
          <div className="filter-card">
            <div className="filter-header">
              <h3 className="filter-title">Select Period</h3>
              <div className="current-month-badge">
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
              <div className="selector-icon">📅</div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading salary data...</p>
          </div>
        ) : !salary ? (
          <div className="warning-card">
            <div className="warning-header">
              <div className="warning-icon">💰</div>
              <div className="warning-content">
                <h3 className="warning-title">Salary Not Configured</h3>
                <p className="warning-description">
                  Your salary has not been set up yet. Please contact administration.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Financial Overview */}
            <section className="financial-overview">
              <div className="overview-card">
                <div className="overview-header">
                  <h3 className="overview-title">Financial Summary</h3>
                  <div className="net-salary">
                    <span className="net-amount">{formatCurrency(monthStats.netSalary)}</span>
                    <span className="net-label">Net Salary</span>
                  </div>
                </div>
                
                <div className="overview-grid">
                  <div className="overview-item income">
                    <div className="overview-icon">📈</div>
                    <div className="overview-content">
                      <span className="overview-label">Total Income</span>
                      <span className="overview-value">
                        {formatCurrency(monthStats.basicSalary + monthStats.otAmount)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="overview-item deductions">
                    <div className="overview-icon">📉</div>
                    <div className="overview-content">
                      <span className="overview-label">Total Deductions</span>
                      <span className="overview-value">
                        {formatCurrency(monthStats.advances + monthStats.shortAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Salary Breakdown */}
            <section className="breakdown-section">
              <div className="breakdown-card">
                <div className="breakdown-header">
                  <h3 className="breakdown-title">Salary Breakdown</h3>
                  <div className="breakdown-period">
                    {new Date(currentMonth + '-01').toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
                
                <div className="breakdown-content">
                  <div className="breakdown-item">
                    <div className="breakdown-icon">💼</div>
                    <div className="breakdown-details">
                      <span className="breakdown-label">Basic Salary</span>
                      <span className="breakdown-value">{formatCurrency(monthStats.basicSalary)}</span>
                    </div>
                  </div>
                  
                  {monthStats.otAmount > 0 && (
                    <div className="breakdown-item positive">
                      <div className="breakdown-icon">🔼</div>
                      <div className="breakdown-details">
                        <span className="breakdown-label">Overtime Earnings</span>
                        <span className="breakdown-value">+ {formatCurrency(monthStats.otAmount)}</span>
                        <span className="breakdown-note">Based on approved OT requests</span>
                      </div>
                    </div>
                  )}
                  
                  {monthStats.shortAmount > 0 && (
                    <div className="breakdown-item negative">
                      <div className="breakdown-icon">🔽</div>
                      <div className="breakdown-details">
                        <span className="breakdown-label">Short Time Deductions</span>
                        <span className="breakdown-value">- {formatCurrency(monthStats.shortAmount)}</span>
                        <span className="breakdown-note">Hours below required minimum</span>
                      </div>
                    </div>
                  )}
                  
                  {monthStats.advances > 0 && (
                    <div className="breakdown-item negative">
                      <div className="breakdown-icon">📋</div>
                      <div className="breakdown-details">
                        <span className="breakdown-label">Advance Deductions</span>
                        <span className="breakdown-value">- {formatCurrency(monthStats.advances)}</span>
                        <span className="breakdown-note">Approved advance requests</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="breakdown-divider"></div>
                  
                  <div className="breakdown-item total">
                    <div className="breakdown-icon">💰</div>
                    <div className="breakdown-details">
                      <span className="breakdown-label">Net Salary Payable</span>
                      <span className="breakdown-value">{formatCurrency(monthStats.netSalary)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Stats */}
            <section className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon primary">💸</div>
                  <div className="stat-content">
                    <div className="stat-value">{formatCurrency(monthStats.basicSalary)}</div>
                    <div className="stat-label">Base Salary</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon success">🕒</div>
                  <div className="stat-content">
                    <div className="stat-value">+{formatCurrency(monthStats.otAmount)}</div>
                    <div className="stat-label">Overtime</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon warning">⏰</div>
                  <div className="stat-content">
                    <div className="stat-value">-{formatCurrency(monthStats.shortAmount)}</div>
                    <div className="stat-label">Short Time</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon danger">📋</div>
                  <div className="stat-content">
                    <div className="stat-value">-{formatCurrency(monthStats.advances)}</div>
                    <div className="stat-label">Advances</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Time Adjustments History */}
            <section className="history-section">
              <div className="section-header">
                <h3 className="section-title">Time Adjustments</h3>
                <div className="section-badge">
                  <span>
                    {adjustmentRequests.filter(adj => {
                      const adjMonth = adj.shiftMonth || adj.month;
                      return adjMonth === currentMonth;
                    }).length}
                  </span>
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
                      <div className="history-header">
                        <div className="history-type">
                          <div className={`type-icon ${adj.adjustmentType}`}>
                            {adj.adjustmentType === 'overtime' ? '🔼' : '🔽'}
                          </div>
                          <div className="type-info">
                            <span className="type-label">
                              {adj.adjustmentType === 'overtime' ? 'Overtime' : 'Short Time'}
                            </span>
                            <span className="type-date">{adj.date || 'Unknown date'}</span>
                          </div>
                        </div>
                        <div className={`amount-display ${adj.adjustmentType}`}>
                          {adj.adjustmentType === 'overtime' ? '+' : '-'}{formatCurrency(adj.adjustmentAmount || 0)}
                        </div>
                      </div>
                      
                      <div className="history-details">
                        <div className="detail-row">
                          <span className="detail-label">Hours:</span>
                          <span className="detail-value">
                            {adj.adjustmentHours || 0}h (Total: {adj.totalHours || 0}h)
                          </span>
                        </div>
                        
                        <div className="detail-row">
                          <span className="detail-label">Status:</span>
                          <div className={`status-badge ${adj.status}`}>
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
                          <div className="rejection-reason">
                            <span className="reason-label">Reason:</span>
                            <span className="reason-text">{adj.rejectionReason}</span>
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

            {/* Advance History */}
            <section className="history-section">
              <div className="section-header">
                <h3 className="section-title">Advance History</h3>
                <div className="section-badge">
                  <span>
                    {advanceRequests.filter(adv => {
                      const advanceMonth = adv.shiftMonth || adv.month;
                      return advanceMonth === currentMonth;
                    }).length}
                  </span>
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
                      <div className="history-header">
                        <div className="history-type">
                          <div className="type-icon">💳</div>
                          <div className="type-info">
                            <span className="type-label">Salary Advance</span>
                            <span className="type-date">
                              {advance.requestDate ? 
                                new Date(advance.requestDate).toLocaleDateString() : 'Unknown date'
                              }
                            </span>
                          </div>
                        </div>
                        <div className="amount-display advance">
                          {formatCurrency(advance.amount || 0)}
                        </div>
                      </div>
                      
                      <div className="history-details">
                        {advance.reason && advance.reason !== "No reason provided" && (
                          <div className="detail-row">
                            <span className="detail-label">Purpose:</span>
                            <span className="detail-value">{advance.reason}</span>
                          </div>
                        )}
                        
                        <div className="detail-row">
                          <span className="detail-label">Status:</span>
                          <div className={`status-badge ${advance.status}`}>
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
                          <div className="detail-row">
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

            {/* Additional Insights */}
            <section className="insights-section">
              <div className="insights-grid">
                <div className="insight-card">
                  <div className="insight-icon">📊</div>
                  <div className="insight-content">
                    <div className="insight-value">{advanceStats.approvedCount}</div>
                    <div className="insight-label">Approved Advances</div>
                  </div>
                </div>
                
                <div className="insight-card">
                  <div className="insight-icon">🕒</div>
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
          </>
        )}
      </main>

      {/* Enhanced Bottom Navigation */}
      <nav className="bottom-navigation">
        <button 
          className={`nav-item ${isActiveRoute('/staff') && !isActiveRoute('/staff/salary') && !isActiveRoute('/staff/advance') && !isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff')}
        >
          <div className="nav-icon">📊</div>
          <span className="nav-label">Dashboard</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/salary')}
        >
          <div className="nav-icon">💰</div>
          <span className="nav-label">Salary</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/advance') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/advance')}
        >
          <div className="nav-icon">📋</div>
          <span className="nav-label">Advance</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/availability')}
        >
          <div className="nav-icon">📅</div>
          <span className="nav-label">Schedule</span>
        </button>

        <button className="nav-item logout" onClick={handleLogout}>
          <div className="nav-icon">🚪</div>
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </div>
  );
}