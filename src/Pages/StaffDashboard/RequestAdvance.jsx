// src/Pages/StaffDashboard/RequestAdvance.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  getDocs
} from "firebase/firestore";
import { db } from "../../firebase";
import "./RequestAdvance.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function RequestAdvance({ staffData, onLogout }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [salary, setSalary] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [approvedAdvances, setApprovedAdvances] = useState(0);
  const [remainingSalary, setRemainingSalary] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  // Helper function for shift-based month calculation
  const getShiftMonth = (timestamp) => {
    const date = new Date(timestamp);
    if (date.getHours() >= 18) { // 6 PM
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().substring(0, 7); // YYYY-MM
  };

  // Use correct property names from Login.jsx
  const { staffName = "Unknown Staff", staffId = "Unknown ID", uid } = staffData || {};

  // Fetch staff salary - real-time listener for updates
  useEffect(() => {
    if (!uid) {
      console.error("No UID available for salary fetch");
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "salaries", uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const salaryData = docSnapshot.data();
        setSalary(salaryData);
      } else {
        setSalary(null);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // Fetch approved advances for current staff with shift-based month
  useEffect(() => {
    const fetchApprovedAdvances = async () => {
      if (!uid) return;
      
      try {
        const q = query(
          collection(db, "advanceRequests"),
          where("staffUid", "==", uid),
          where("status", "==", "approved")
        );
        
        const querySnapshot = await getDocs(q);
        let totalAdvances = 0;
        const currentShiftMonth = getShiftMonth(new Date());
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Use shiftMonth if available, otherwise fall back to month
          const requestMonth = data.shiftMonth || data.month;
          if (requestMonth === currentShiftMonth) {
            totalAdvances += data.amount || 0;
          }
        });
        
        setApprovedAdvances(totalAdvances);
        
        // Calculate remaining salary
        if (salary) {
          setRemainingSalary(Math.max(0, salary.monthlySalary - totalAdvances));
        }
      } catch (error) {
        console.error("Error fetching approved advances:", error);
      }
    };

    if (salary) {
      fetchApprovedAdvances();
    }
    
    // Real-time listener for advance requests
    const unsubscribe = onSnapshot(
      query(
        collection(db, "advanceRequests"),
        where("staffUid", "==", uid),
        where("status", "==", "approved")
      ),
      () => {
        if (salary) {
          fetchApprovedAdvances();
        }
      }
    );

    return () => unsubscribe();
  }, [uid, salary]);

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
      const allRequests = [];
      const pending = [];

      snapshot.forEach((doc) => {
        const request = { id: doc.id, ...doc.data() };
        allRequests.push(request);
        if (request.status === "pending") {
          pending.push(request);
        }
      });

      allRequests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));

      setPendingRequests(pending);
      setRequestHistory(allRequests);
    });

    return () => unsubscribe();
  }, [uid]);

  // Calculate max advance based on current salary and remaining balance
  const calculateMaxAdvance = () => {
    if (!salary || !salary.monthlySalary) return 0;
    
    // Maximum advance is 50% of monthly salary OR remaining salary, whichever is lower
    const fiftyPercent = salary.monthlySalary * 0.5;
    return Math.min(fiftyPercent, remainingSalary);
  };

  // Submit advance request with shiftMonth
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validations = {
      hasAmount: !!amount && !isNaN(amount) && amount > 0,
      hasSalary: !!salary,
      hasStaffData: !!staffName && !!staffId && !!uid,
      noPendingRequests: pendingRequests.length === 0,
      hasRemainingSalary: remainingSalary > 0
    };

    if (!validations.hasAmount) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    if (!validations.hasSalary) {
      showNotification("Your salary is not set. Please contact administration.", "error");
      return;
    }

    if (!validations.hasRemainingSalary) {
      showNotification("No remaining salary available for advance this month.", "error");
      return;
    }

    const advanceAmount = parseFloat(amount);
    const maxAdvance = calculateMaxAdvance();

    if (advanceAmount > maxAdvance) {
      showNotification(`Maximum advance amount is Rs. ${maxAdvance.toLocaleString()} (50% of salary or remaining balance)`, "error");
      return;
    }

    if (advanceAmount < 100) {
      showNotification("Minimum advance amount is Rs. 100", "error");
      return;
    }

    if (!validations.noPendingRequests) {
      showNotification("You already have a pending advance request. Please wait for it to be processed.", "error");
      return;
    }

    if (!validations.hasStaffData) {
      showNotification("Staff information is incomplete. Please log out and log in again.", "error");
      return;
    }
    
    setLoading(true);
    try {
      const currentDate = new Date();
      const advanceRequest = {
        staffUid: uid,
        staffName: staffName,
        staffId: staffId,
        amount: advanceAmount,
        requestDate: currentDate.toISOString(),
        reason: reason.trim() || "No reason provided",
        status: "pending",
        month: currentDate.toISOString().substring(0, 7), // Regular month
        shiftMonth: getShiftMonth(currentDate), // Shift-based month
        maxAllowed: maxAdvance,
        currentSalary: salary.monthlySalary,
        hourlyRate: salary.hourlyRate,
        remainingSalaryBefore: remainingSalary
      };
      
      await addDoc(collection(db, "advanceRequests"), advanceRequest);
      
      showNotification("Advance request submitted successfully!", "success");
      setAmount("");
      setReason("");
    } catch (error) {
      console.error("Error submitting advance request:", error);
      showNotification("Error submitting request: " + error.message, "error");
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

  // Calculate percentage of max advance
  const getAdvancePercentage = () => {
    if (!amount || !salary) return 0;
    const advanceAmount = parseFloat(amount);
    const maxAdvance = calculateMaxAdvance();
    return Math.min((advanceAmount / maxAdvance) * 100, 100);
  };

  if (!staffData) {
    return (
      <div className="request-advance">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h2>Staff Data Not Available</h2>
          <p>Please log in again to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="request-advance">
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
            {staffName.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{staffName}</span>
            <span className="user-id">ID: {staffId}</span>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <div className="dashboard-container">
        {/* Main Content Area */}
        <main className="dashboard-main">
          {/* Welcome Header */}
          <div className="welcome-header">
            <div className="welcome-text">
              <h1>Salary Advance Request</h1>
              <p>Request an advance on your monthly salary</p>
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

          {!salary ? (
            <div className="warning-card">
              <div className="warning-header">
                <div className="warning-icon">⚠️</div>
                <h3>Salary Not Configured</h3>
              </div>
              <div className="warning-content">
                <p>Your salary has not been set up yet. Please contact administration to set up your salary before requesting advances.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Salary Overview Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon primary">💰</div>
                  <div className="stat-content">
                    <h3>Rs. {salary.monthlySalary?.toLocaleString() || '0'}</h3>
                    <p>Monthly Salary</p>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon warning">💸</div>
                  <div className="stat-content">
                    <h3>Rs. {approvedAdvances.toLocaleString()}</h3>
                    <p>Approved Advances</p>
                  </div>
                </div>
                
                <div className="stat-card success">
                  <div className="stat-icon success">📊</div>
                  <div className="stat-content">
                    <h3>Rs. {remainingSalary.toLocaleString()}</h3>
                    <p>Remaining Salary</p>
                  </div>
                </div>

                <div className="stat-card highlight">
                  <div className="stat-icon secondary">📈</div>
                  <div className="stat-content">
                    <h3>Rs. {calculateMaxAdvance().toLocaleString()}</h3>
                    <p>Max Advance Available</p>
                  </div>
                </div>
              </div>

              {/* Request Form Card */}
              <div className="advance-card">
                <div className="card-header">
                  <h2>Request Salary Advance</h2>
                  <div className="card-badge">
                    {pendingRequests.length > 0 ? 'Pending' : remainingSalary > 0 ? 'Available' : 'Exhausted'}
                  </div>
                </div>

                {pendingRequests.length > 0 ? (
                  <div className="pending-warning">
                    <div className="warning-content">
                      <div className="warning-icon-large">⏳</div>
                      <div className="warning-text">
                        <h4>Pending Request Exists</h4>
                        <p>You already have a pending advance request. Please wait for it to be processed before submitting a new one.</p>
                        <div className="pending-details">
                          <div className="detail-item">
                            <span className="detail-label">Amount:</span>
                            <span className="detail-value">Rs. {pendingRequests[0]?.amount?.toLocaleString() || '0'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Requested:</span>
                            <span className="detail-value">
                              {pendingRequests[0]?.requestDate ? new Date(pendingRequests[0].requestDate).toLocaleDateString() : 'Unknown'}
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Based on Salary:</span>
                            <span className="detail-value">
                              Rs. {pendingRequests[0]?.currentSalary?.toLocaleString() || salary.monthlySalary.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : remainingSalary <= 0 ? (
                  <div className="warning-card">
                    <div className="warning-header">
                      <div className="warning-icon">💰</div>
                      <h3>Advance Limit Reached</h3>
                    </div>
                    <div className="warning-content">
                      <p>You have already received the maximum advance amount for this month. No further advances can be processed until next month.</p>
                      <div className="salary-summary">
                        <div className="summary-item">
                          <span>Monthly Salary:</span>
                          <span>Rs. {salary.monthlySalary.toLocaleString()}</span>
                        </div>
                        <div className="summary-item">
                          <span>Approved Advances:</span>
                          <span>Rs. {approvedAdvances.toLocaleString()}</span>
                        </div>
                        <div className="summary-item highlight">
                          <span>Remaining Salary:</span>
                          <span>Rs. {remainingSalary.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="advance-form">
                    <div className="form-group">
                      <label htmlFor="amount" className="form-label">
                        Advance Amount (Rs.)
                      </label>
                      <input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="form-input"
                        min="100"
                        max={calculateMaxAdvance()}
                        step="100"
                        required
                      />
                      <div className="form-hint">
                        Maximum allowed: Rs. {calculateMaxAdvance().toLocaleString()} (50% of salary or remaining balance)
                      </div>
                      
                      {/* Progress bar showing percentage of max advance */}
                      {amount && !isNaN(amount) && amount > 0 && (
                        <div className="advance-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{ width: `${getAdvancePercentage()}%` }}
                            ></div>
                          </div>
                          <div className="progress-text">
                            {getAdvancePercentage().toFixed(1)}% of maximum advance available
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="reason" className="form-label">
                        Reason for Advance <span className="optional">(Optional)</span>
                      </label>
                      <textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Briefly explain why you need this advance..."
                        className="form-textarea"
                        rows="4"
                      />
                    </div>

                    <div className="advance-summary">
                      <h4>Salary & Advance Summary</h4>
                      <div className="summary-grid">
                        <div className="summary-item">
                          <span>Your Monthly Salary:</span>
                          <span>Rs. {salary.monthlySalary.toLocaleString()}</span>
                        </div>
                        <div className="summary-item">
                          <span>Approved Advances This Month:</span>
                          <span>Rs. {approvedAdvances.toLocaleString()}</span>
                        </div>
                        <div className="summary-item success">
                          <span>Remaining Salary:</span>
                          <span>Rs. {remainingSalary.toLocaleString()}</span>
                        </div>
                        <div className="summary-item highlight">
                          <span>Maximum Advance Available:</span>
                          <span>Rs. {calculateMaxAdvance().toLocaleString()}</span>
                        </div>
                        <div className="summary-item requested">
                          <span>Requested Amount:</span>
                          <span>Rs. {amount ? parseFloat(amount).toLocaleString() : '0'}</span>
                        </div>
                        {amount && !isNaN(amount) && amount > 0 && (
                          <div className="summary-item remaining-after">
                            <span>Remaining After Advance:</span>
                            <span>Rs. {(remainingSalary - parseFloat(amount)).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="btn-primary submit-btn"
                      disabled={loading || !amount || !uid || remainingSalary <= 0}
                    >
                      <span className="btn-icon">📋</span>
                      {loading ? "Submitting..." : "Submit Advance Request"}
                    </button>
                  </form>
                )}
              </div>

              {/* Request History Card */}
              <div className="history-card">
                <div className="card-header">
                  <h2>Request History</h2>
                  <span className="badge">{requestHistory.length}</span>
                </div>
                
                {requestHistory.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No Advance Requests</h3>
                    <p>Your advance request history will appear here</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {requestHistory.map((request, index) => (
                      <div key={request.id} className={`history-item ${request.status}`}>
                        <div className="history-main">
                          <div className="history-amount">
                            Rs. {request.amount?.toLocaleString() || '0'}
                          </div>
                          <div className={`status-badge ${request.status}`}>
                            {request.status === "pending" && "⏳ Pending"}
                            {request.status === "approved" && "✅ Approved"}
                            {request.status === "rejected" && "❌ Rejected"}
                          </div>
                        </div>
                        
                        <div className="history-details">
                          <div className="history-date">
                            {request.requestDate ? new Date(request.requestDate).toLocaleDateString() : 'Unknown date'}
                          </div>
                          
                          <div className="salary-reference">
                            Based on salary: Rs. {request.currentSalary?.toLocaleString() || 'N/A'}
                          </div>
                          
                          {request.reason && request.reason !== "No reason provided" && (
                            <div className="history-reason">
                              {request.reason}
                            </div>
                          )}
                          
                          {request.approvedAt && (
                            <div className="history-processed">
                              {request.status === "approved" ? "Approved" : "Rejected"} on{" "}
                              {new Date(request.approvedAt).toLocaleDateString()}
                            </div>
                          )}
                          
                          {request.rejectionReason && (
                            <div className="rejection-reason">
                              <strong>Reason:</strong> {request.rejectionReason}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Bottom Navigation Bar - Fixed at bottom */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${isActiveRoute('/staff') && !isActiveRoute('/staff/salary') && !isActiveRoute('/staff/advance') && !isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-text">Dashboard</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/salary')}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-text">Salary</span>
        </button>
        
        <button 
          className={`nav-item ${isActiveRoute('/staff/advance') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/advance')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-text">Advance</span>
        </button>
        
        {/* ADDED AVAILABILITY BUTTON */}
        <button 
          className={`nav-item ${isActiveRoute('/staff/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/staff/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-text">Availability</span>
        </button>
        
        <button className="nav-item logout-item" onClick={handleLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-text">Logout</span>
        </button>
      </nav>
    </div>
  );
}