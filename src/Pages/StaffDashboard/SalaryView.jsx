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
  const [otRequests, setOtRequests] = useState([]);
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

  // Fetch OT requests
  useEffect(() => {
    if (!uid) return;

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
    
    const currentMonthAdvances = advanceRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth && req.status === "approved";
      })
      .reduce((sum, req) => sum + (req.amount || 0), 0);

    const currentMonthOT = otRequests
      .filter(req => {
        const requestMonth = req.shiftMonth || req.month;
        return requestMonth === currentMonth && req.status === "approved";
      })
      .reduce((sum, req) => sum + (req.otAmount || 0), 0);

    const netSalary = Math.max(0, basicSalary + currentMonthOT - currentMonthAdvances);

    return {
      basicSalary,
      advances: currentMonthAdvances,
      ot: currentMonthOT,
      netSalary,
      remainingSalary: Math.max(0, basicSalary - currentMonthAdvances)
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
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">🏪</div>
            <div className="brand-text">
              <h1>Cafe Piranha</h1>
              <span>Salary Overview</span>
            </div>
          </div>
          
          <div className="header-user">
            <div className="user-avatar">
              {staffName?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        
        <div className="user-info-mobile">
          <span className="user-name">{staffName}</span>
          <span className="user-id">ID: {staffId}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div className="welcome-content">
            <h2>Salary Overview</h2>
            <p>Your earnings and deductions</p>
          </div>
          <div className="date-display-mobile">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </section>

        {/* Month Selector */}
        <section className="filter-section">
          <div className="filter-card-mobile">
            <div className="filter-header">
              <h3>Select Month</h3>
              <div className="current-month-badge">
                {new Date(currentMonth + '-01').toLocaleDateString('en-US', { 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </div>
            </div>
            <input 
              type="month" 
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="month-input-mobile"
            />
          </div>
        </section>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading salary data...</p>
          </div>
        ) : !salary ? (
          <div className="warning-card-mobile">
            <div className="warning-header">
              <div className="warning-icon">💰</div>
              <h3>Salary Not Configured</h3>
            </div>
            <div className="warning-content">
              <p>Your salary has not been set up yet. Please contact administration.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <section className="quick-stats-salary">
              <div className="stat-item-salary">
                <div className="stat-icon-salary primary">💼</div>
                <div className="stat-content-salary">
                  <div className="stat-value">Rs. {monthStats.basicSalary.toLocaleString()}</div>
                  <div className="stat-label">Basic Salary</div>
                </div>
              </div>
              
              <div className="stat-item-salary">
                <div className="stat-icon-salary success">🕒</div>
                <div className="stat-content-salary">
                  <div className="stat-value">+{monthStats.ot.toLocaleString()}</div>
                  <div className="stat-label">Overtime</div>
                </div>
              </div>
              
              <div className="stat-item-salary">
                <div className="stat-icon-salary warning">📋</div>
                <div className="stat-content-salary">
                  <div className="stat-value">-{monthStats.advances.toLocaleString()}</div>
                  <div className="stat-label">Advances</div>
                </div>
              </div>

              <div className="stat-item-salary highlight">
                <div className="stat-icon-salary accent">💰</div>
                <div className="stat-content-salary">
                  <div className="stat-value">Rs. {monthStats.netSalary.toLocaleString()}</div>
                  <div className="stat-label">Net Salary</div>
                </div>
              </div>
            </section>

            {/* Summary Card */}
            <section className="summary-section">
              <div className="summary-card-mobile">
                <div className="summary-header-mobile">
                  <h3>Monthly Breakdown</h3>
                  <div className="summary-period">
                    {new Date(currentMonth + '-01').toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
                <div className="summary-content-mobile">
                  <div className="summary-item-mobile">
                    <span className="summary-label">Basic Salary:</span>
                    <span className="summary-value">Rs. {monthStats.basicSalary.toLocaleString()}</span>
                  </div>
                  <div className="summary-item-mobile positive">
                    <span className="summary-label">Overtime Earnings:</span>
                    <span className="summary-value">+ Rs. {monthStats.ot.toLocaleString()}</span>
                  </div>
                  <div className="summary-item-mobile negative">
                    <span className="summary-label">Advance Deductions:</span>
                    <span className="summary-value">- Rs. {monthStats.advances.toLocaleString()}</span>
                  </div>
                  <div className="summary-divider"></div>
                  <div className="summary-item-mobile total">
                    <span className="summary-label">Net Salary:</span>
                    <span className="summary-value">Rs. {monthStats.netSalary.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Overtime History */}
            <section className="history-section">
              <div className="section-header">
                <h3>Overtime History</h3>
                <span className="session-count">
                  {otRequests.filter(ot => {
                    const otMonth = ot.shiftMonth || ot.month;
                    return otMonth === currentMonth;
                  }).length}
                </span>
              </div>

              {otRequests.length === 0 ? (
                <div className="empty-sessions">
                  <div className="empty-icon">🕒</div>
                  <p>No overtime records</p>
                </div>
              ) : (
                <div className="history-list-mobile">
                  {otRequests
                    .filter(ot => {
                      const otMonth = ot.shiftMonth || ot.month;
                      return otMonth === currentMonth;
                    })
                    .map(ot => (
                    <div key={ot.id} className={`history-item-mobile ${ot.status}`}>
                      <div className="history-header-mobile">
                        <div className="history-amount-mobile">
                          Rs. {ot.otAmount || 0}
                        </div>
                        <div className={`status-badge-history ${ot.status}`}>
                          {ot.status === "pending" && "⏳"}
                          {ot.status === "approved" && "✅"}
                          {ot.status === "rejected" && "❌"}
                        </div>
                      </div>
                      
                      <div className="history-details-mobile">
                        <div className="history-date-mobile">
                          {ot.date || 'Unknown date'}
                          {ot.isNightShift && " 🌙"}
                        </div>
                        
                        <div className="history-hours-mobile">
                          {ot.otHours || 0} hours
                          {ot.crossMidnight && " ⏰"}
                        </div>
                        
                        {ot.status === "rejected" && ot.rejectionReason && (
                          <div className="rejection-reason-mobile">
                            {ot.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {otRequests.filter(ot => {
                    const otMonth = ot.shiftMonth || ot.month;
                    return otMonth === currentMonth;
                  }).length === 0 && (
                    <div className="empty-sessions">
                      <div className="empty-icon">📅</div>
                      <p>No overtime this month</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Advance History */}
            <section className="history-section">
              <div className="section-header">
                <h3>Advance History</h3>
                <span className="session-count">
                  {advanceRequests.filter(adv => {
                    const advanceMonth = adv.shiftMonth || adv.month;
                    return advanceMonth === currentMonth;
                  }).length}
                </span>
              </div>

              {advanceRequests.length === 0 ? (
                <div className="empty-sessions">
                  <div className="empty-icon">📋</div>
                  <p>No advance requests</p>
                </div>
              ) : (
                <div className="history-list-mobile">
                  {advanceRequests
                    .filter(adv => {
                      const advanceMonth = adv.shiftMonth || adv.month;
                      return advanceMonth === currentMonth;
                    })
                    .map(advance => (
                    <div key={advance.id} className={`history-item-mobile ${advance.status}`}>
                      <div className="history-header-mobile">
                        <div className="history-amount-mobile">
                          Rs. {advance.amount?.toLocaleString() || '0'}
                        </div>
                        <div className={`status-badge-history ${advance.status}`}>
                          {advance.status === "pending" && "⏳"}
                          {advance.status === "approved" && "✅"}
                          {advance.status === "rejected" && "❌"}
                        </div>
                      </div>
                      
                      <div className="history-details-mobile">
                        <div className="history-date-mobile">
                          {advance.requestDate ? 
                            new Date(advance.requestDate).toLocaleDateString() : 'Unknown date'}
                        </div>
                        
                        {advance.reason && advance.reason !== "No reason provided" && (
                          <div className="history-reason-mobile">
                            {advance.reason}
                          </div>
                        )}
                        
                        {advance.approvedAt && (
                          <div className="history-processed-mobile">
                            {advance.status === "approved" ? "Approved" : "Rejected"} •{" "}
                            {new Date(advance.approvedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {advanceRequests.filter(adv => {
                    const advanceMonth = adv.shiftMonth || adv.month;
                    return advanceMonth === currentMonth;
                  }).length === 0 && (
                    <div className="empty-sessions">
                      <div className="empty-icon">📅</div>
                      <p>No advances this month</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Additional Stats */}
            <section className="stats-section">
              <div className="stats-grid-mobile">
                <div className="stat-card-mobile">
                  <div className="stat-content-mobile">
                    <div className="stat-number">{advanceStats.approvedCount}</div>
                    <div className="stat-description">Approved Advances</div>
                  </div>
                </div>
                
                <div className="stat-card-mobile">
                  <div className="stat-content-mobile">
                    <div className="stat-number">{advanceStats.pendingCount}</div>
                    <div className="stat-description">Pending Advances</div>
                  </div>
                </div>
                
                <div className="stat-card-mobile">
                  <div className="stat-content-mobile">
                    <div className="stat-number">
                      {Math.round((monthStats.advances / monthStats.basicSalary) * 100)}%
                    </div>
                    <div className="stat-description">Advance Usage</div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
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
          <span className="nav-label">Availability</span>
        </button>

        <button className="nav-item logout-item" onClick={handleLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </div>
  );
}