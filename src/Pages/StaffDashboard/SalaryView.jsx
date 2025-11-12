// src/Pages/StaffDashboard/SalaryView.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  query,
  where,
  orderBy,
  doc
} from "firebase/firestore";
import { db } from "../../firebase";
import "./SalaryView.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function SalaryView({ staffData, onLogout }) {
  const [salary, setSalary] = useState(null);
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [otRequests, setOtRequests] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  const navigate = useNavigate();
  const location = useLocation();
  
  const { staffName, staffId, uid } = staffData || {};

  // Fetch staff salary
  useEffect(() => {
    if (!uid) {
      console.error("No UID available for salary fetch");
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "salaries", uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setSalary(docSnapshot.data());
      } else {
        setSalary(null);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // Fetch advance requests
  useEffect(() => {
    if (!uid) {
      console.error("No UID available for advance requests fetch");
      return;
    }

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

  // Fetch OT requests
  useEffect(() => {
    if (!uid) {
      console.error("No UID available for OT requests fetch");
      return;
    }

    const q = query(
      collection(db, "otRequests"),
      where("staffUid", "==", uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      
      requests.sort((a, b) => new Date(b.date) - new Date(a.date));
      setOtRequests(requests);
    });

    return () => unsubscribe();
  }, [uid]);

  // Calculate current month stats with proper advance deduction
  const calculateMonthStats = () => {
    const basicSalary = salary?.monthlySalary || 0;
    
    // Calculate approved advances for current month
    // Use shiftMonth if available, otherwise fall back to month field
    const currentMonthAdvances = advanceRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth && req.status === "approved";
      })
      .reduce((sum, req) => sum + (req.amount || 0), 0);

    // Calculate approved OT for current month
    // Use shiftMonth if available, otherwise fall back to month field
    const currentMonthOT = otRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth && req.status === "approved";
      })
      .reduce((sum, req) => sum + (req.otAmount || 0), 0);

    // Calculate net salary (basic + OT - advances)
    const netSalary = Math.max(0, basicSalary + currentMonthOT - currentMonthAdvances);

    return {
      basicSalary,
      advances: currentMonthAdvances,
      ot: currentMonthOT,
      netSalary,
      remainingSalary: Math.max(0, basicSalary - currentMonthAdvances) // Salary remaining after advances (before OT)
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

  const advanceStats = getAdvanceStats();

  const showNotification = (msg, type = "info") => {
    const styles = {
      success: "background: #4CAF50; color: white; padding: 12px; border-radius: 4px;",
      error: "background: #f44336; color: white; padding: 12px; border-radius: 4px;",
      info: "background: #2196F3; color: white; padding: 12px; border-radius: 4px;"
    };
    console.log(`%c${msg}`, styles[type] || styles.info);
    alert(msg);
  };

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
      {/* Navigation Header */}
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <div className="brand-icon">🏪</div>
          <div className="brand-text">
            <h2>Cafe Piranha</h2>
            <span>Staff Portal</span>
          </div>
        </div>
        
        <div className="nav-user">
          <div className="user-avatar">
            {staffName?.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{staffName}</span>
            <span className="user-id">ID: {staffId}</span>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <div className="dashboard-container">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${isActiveRoute('/staff') ? 'active' : ''}`}
              onClick={() => safeNavigate('/staff')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-text">Dashboard</span>
            </button>
            
            <button 
              className={`nav-item ${isActiveRoute('/salary') ? 'active' : ''}`}
              onClick={() => safeNavigate('/staff/salary')}
            >
              <span className="nav-icon">💰</span>
              <span className="nav-text">Salary</span>
            </button>
            
            <button 
              className={`nav-item ${isActiveRoute('/advance') ? 'active' : ''}`}
              onClick={() => safeNavigate('/staff/advance')}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">Request Advance</span>
            </button>

            {/* ADDED AVAILABILITY BUTTON */}
            <button 
              className={`nav-item ${isActiveRoute('/availability') ? 'active' : ''}`}
              onClick={() => safeNavigate('/staff/availability')}
            >
              <span className="nav-icon">📅</span>
              <span className="nav-text">Availability</span>
            </button>
            
            <div className="nav-divider"></div>
            
            <button className="nav-item logout-item" onClick={handleLogout}>
              <span className="nav-icon">🚪</span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="dashboard-main">
          {/* Welcome Header */}
          <div className="welcome-header">
            <div className="welcome-text">
              <h1>Salary Overview</h1>
              <p>View your salary breakdown and history</p>
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

          {/* Month Selector */}
          <div className="filter-card">
            <div className="filter-header">
              <h3>Select Month</h3>
              <div className="current-month-badge">
                {new Date(currentMonth + '-01').toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </div>
            </div>
            <div className="filter-controls">
              <input 
                type="month" 
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="month-input"
              />
            </div>
          </div>

          {!salary ? (
            <div className="warning-card">
              <div className="warning-header">
                <div className="warning-icon">💰</div>
                <h3>Salary Not Configured</h3>
              </div>
              <div className="warning-content">
                <p>Your salary has not been set up yet. Please contact administration to configure your salary details.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Salary Summary Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon primary">💼</div>
                  <div className="stat-content">
                    <h3>Rs. {monthStats.basicSalary.toLocaleString()}</h3>
                    <p>Basic Salary</p>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon success">🕒</div>
                  <div className="stat-content">
                    <h3>+ Rs. {monthStats.ot.toLocaleString()}</h3>
                    <p>Overtime Earnings</p>
                    <div className="stat-detail">
                      {otRequests.filter(ot => {
                        const otMonth = ot.shiftMonth || ot.month;
                        return otMonth === currentMonth && ot.status === "approved";
                      }).length} approved sessions
                    </div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon warning">📋</div>
                  <div className="stat-content">
                    <h3>- Rs. {monthStats.advances.toLocaleString()}</h3>
                    <p>Advance Deductions</p>
                    <div className="stat-detail">
                      {advanceStats.approvedCount} advances • {advanceStats.pendingCount} pending
                    </div>
                  </div>
                </div>
                
                <div className="stat-card highlight">
                  <div className="stat-icon accent">💰</div>
                  <div className="stat-content">
                    <h3>Rs. {monthStats.netSalary.toLocaleString()}</h3>
                    <p>Net Salary</p>
                    <div className="stat-detail">
                      Final amount for {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long' })}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon secondary">📊</div>
                  <div className="stat-content">
                    <h3>Rs. {monthStats.remainingSalary.toLocaleString()}</h3>
                    <p>Remaining Base Salary</p>
                    <div className="stat-detail">
                      After advances, before OT
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon info">⚡</div>
                  <div className="stat-content">
                    <h3>{Math.round((monthStats.advances / monthStats.basicSalary) * 100)}%</h3>
                    <p>Advance Usage</p>
                    <div className="stat-detail">
                      of monthly salary
                    </div>
                  </div>
                </div>
              </div>

              {/* Overtime History */}
              <div className="history-card">
                <div className="card-header">
                  <h2>Overtime History</h2>
                  <span className="badge">
                    {otRequests.filter(ot => {
                      const otMonth = ot.shiftMonth || ot.month;
                      return otMonth === currentMonth;
                    }).length}
                  </span>
                </div>
                
                {otRequests.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🕒</div>
                    <h3>No Overtime Records</h3>
                    <p>Your approved overtime sessions will appear here</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {otRequests
                      .filter(ot => {
                        const otMonth = ot.shiftMonth || ot.month;
                        return otMonth === currentMonth;
                      })
                      .map(ot => (
                      <div key={ot.id} className={`history-item ${ot.status}`}>
                        <div className="history-main">
                          <div className="history-amount">
                            <div className="amount-primary">Rs. {ot.otAmount || 0}</div>
                            <div className="amount-detail">
                              {ot.otHours || 0} hours
                              {ot.isNightShift && " 🌙"}
                              {ot.crossMidnight && " ⏰"}
                            </div>
                          </div>
                          <div className={`status-badge ${ot.status}`}>
                            {ot.status === "pending" && "⏳ Pending"}
                            {ot.status === "approved" && "✅ Approved"}
                            {ot.status === "rejected" && "❌ Rejected"}
                          </div>
                        </div>
                        
                        <div className="history-details">
                          <div className="history-date">
                            {ot.date || 'Unknown date'}
                            {ot.isNightShift && " (Night Shift)"}
                          </div>
                          
                          {ot.sessionId && (
                            <div className="history-reference">
                              Session: {ot.sessionId.substring(0, 8)}...
                            </div>
                          )}
                          
                          {ot.status === "rejected" && ot.rejectionReason && (
                            <div className="rejection-reason">
                              <strong>Note:</strong> {ot.rejectionReason}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {otRequests.filter(ot => {
                      const otMonth = ot.shiftMonth || ot.month;
                      return otMonth === currentMonth;
                    }).length === 0 && (
                      <div className="empty-state">
                        <div className="empty-icon">📅</div>
                        <h3>No Overtime This Month</h3>
                        <p>No overtime records found for selected month</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Advance History */}
              <div className="history-card">
                <div className="card-header">
                  <h2>Advance History</h2>
                  <span className="badge">
                    {advanceRequests.filter(adv => {
                      const advanceMonth = adv.shiftMonth || adv.month;
                      return advanceMonth === currentMonth;
                    }).length}
                  </span>
                </div>
                
                {advanceRequests.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No Advance Requests</h3>
                    <p>Your advance request history will appear here</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {advanceRequests
                      .filter(adv => {
                        const advanceMonth = adv.shiftMonth || adv.month;
                        return advanceMonth === currentMonth;
                      })
                      .map(advance => (
                      <div key={advance.id} className={`history-item ${advance.status}`}>
                        <div className="history-main">
                          <div className="history-amount">
                            <div className="amount-primary">Rs. {advance.amount?.toLocaleString() || '0'}</div>
                            <div className="amount-detail">
                              {advance.shiftMonth === currentMonth || advance.month === currentMonth ? 'This month' : (advance.shiftMonth || advance.month)}
                            </div>
                          </div>
                          <div className={`status-badge ${advance.status}`}>
                            {advance.status === "pending" && "⏳ Pending"}
                            {advance.status === "approved" && "✅ Approved"}
                            {advance.status === "rejected" && "❌ Rejected"}
                          </div>
                        </div>
                        
                        <div className="history-details">
                          <div className="history-date">
                            {advance.requestDate ? new Date(advance.requestDate).toLocaleDateString() : 'Unknown date'}
                          </div>
                          
                          {advance.reason && advance.reason !== "No reason provided" && (
                            <div className="history-reason">
                              {advance.reason}
                            </div>
                          )}
                          
                          {advance.approvedAt && (
                            <div className="history-processed">
                              {advance.status === "approved" ? "Approved" : "Rejected"} on{" "}
                              {new Date(advance.approvedAt).toLocaleDateString()}
                            </div>
                          )}
                          
                          {advance.rejectionReason && (
                            <div className="rejection-reason">
                              <strong>Reason:</strong> {advance.rejectionReason}
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
                        <h3>No Advances This Month</h3>
                        <p>No advance records found for selected month</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Summary Section */}
              <div className="summary-card">
                <div className="summary-header">
                  <h3>Monthly Summary</h3>
                  <div className="summary-period">
                    {new Date(currentMonth + '-01').toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
                <div className="summary-content">
                  <div className="summary-item">
                    <span className="summary-label">Basic Salary:</span>
                    <span className="summary-value">Rs. {monthStats.basicSalary.toLocaleString()}</span>
                  </div>
                  <div className="summary-item positive">
                    <span className="summary-label">Overtime Earnings:</span>
                    <span className="summary-value">+ Rs. {monthStats.ot.toLocaleString()}</span>
                  </div>
                  <div className="summary-item negative">
                    <span className="summary-label">Advance Deductions:</span>
                    <span className="summary-value">- Rs. {monthStats.advances.toLocaleString()}</span>
                  </div>
                  <div className="summary-divider"></div>
                  <div className="summary-item total">
                    <span className="summary-label">Net Salary:</span>
                    <span className="summary-value">Rs. {monthStats.netSalary.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}