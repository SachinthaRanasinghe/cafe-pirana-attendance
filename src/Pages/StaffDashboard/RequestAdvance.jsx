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
    if (date.getHours() >= 18) {
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().substring(0, 7);
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
          const requestMonth = data.shiftMonth || data.month;
          if (requestMonth === currentShiftMonth) {
            totalAdvances += data.amount || 0;
          }
        });
        
        setApprovedAdvances(totalAdvances);
        
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
        month: currentDate.toISOString().substring(0, 7),
        shiftMonth: getShiftMonth(currentDate),
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
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">🏪</div>
            <div className="brand-text">
              <h1>Cafe Piranha</h1>
              <span>Advance Request</span>
            </div>
          </div>
          
          <div className="header-user">
            <div className="user-avatar">
              {staffName.charAt(0).toUpperCase()}
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
            <h2>Salary Advance</h2>
            <p>Request an advance on your salary</p>
          </div>
          <div className="date-display-mobile">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </section>

        {!salary ? (
          <div className="warning-card-mobile">
            <div className="warning-header">
              <div className="warning-icon">⚠️</div>
              <h3>Salary Not Configured</h3>
            </div>
            <div className="warning-content">
              <p>Your salary has not been set up yet. Please contact administration.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <section className="quick-stats-advance">
              <div className="stat-item-advance">
                <div className="stat-icon-advance primary">💰</div>
                <div className="stat-content-advance">
                  <div className="stat-value">Rs. {salary.monthlySalary?.toLocaleString() || '0'}</div>
                  <div className="stat-label">Monthly</div>
                </div>
              </div>
              
              <div className="stat-item-advance">
                <div className="stat-icon-advance warning">💸</div>
                <div className="stat-content-advance">
                  <div className="stat-value">Rs. {approvedAdvances.toLocaleString()}</div>
                  <div className="stat-label">Advances</div>
                </div>
              </div>
              
              <div className="stat-item-advance">
                <div className="stat-icon-advance success">📊</div>
                <div className="stat-content-advance">
                  <div className="stat-value">Rs. {remainingSalary.toLocaleString()}</div>
                  <div className="stat-label">Remaining</div>
                </div>
              </div>
            </section>

            {/* Request Form Card */}
            <section className="advance-section">
              <div className="advance-card-mobile">
                <div className="card-header-mobile">
                  <h3>Request Advance</h3>
                  <div className={`status-badge-mobile ${
                    pendingRequests.length > 0 ? 'pending' : 
                    remainingSalary > 0 ? 'available' : 'exhausted'
                  }`}>
                    {pendingRequests.length > 0 ? 'Pending' : remainingSalary > 0 ? 'Available' : 'Exhausted'}
                  </div>
                </div>

                {pendingRequests.length > 0 ? (
                  <div className="pending-warning-mobile">
                    <div className="warning-icon-large">⏳</div>
                    <div className="warning-text-mobile">
                      <h4>Pending Request</h4>
                      <p>You have a pending advance request. Wait for processing.</p>
                      <div className="pending-details-mobile">
                        <div className="detail-item">
                          <span>Amount:</span>
                          <span>Rs. {pendingRequests[0]?.amount?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="detail-item">
                          <span>Requested:</span>
                          <span>
                            {pendingRequests[0]?.requestDate ? 
                              new Date(pendingRequests[0].requestDate).toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : remainingSalary <= 0 ? (
                  <div className="warning-card-mobile exhausted">
                    <div className="warning-header">
                      <div className="warning-icon">💰</div>
                      <h3>Limit Reached</h3>
                    </div>
                    <div className="warning-content">
                      <p>Maximum advance reached for this month.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="advance-form-mobile">
                    <div className="form-group-mobile">
                      <label htmlFor="amount" className="form-label-mobile">
                        Amount (Rs.)
                      </label>
                      <input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="form-input-mobile"
                        min="100"
                        max={calculateMaxAdvance()}
                        step="100"
                        required
                      />
                      <div className="form-hint-mobile">
                        Max: Rs. {calculateMaxAdvance().toLocaleString()}
                      </div>
                      
                      {amount && !isNaN(amount) && amount > 0 && (
                        <div className="advance-progress-mobile">
                          <div className="progress-bar-mobile">
                            <div 
                              className="progress-fill-mobile"
                              style={{ width: `${getAdvancePercentage()}%` }}
                            ></div>
                          </div>
                          <div className="progress-text-mobile">
                            {getAdvancePercentage().toFixed(1)}% of maximum
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group-mobile">
                      <label htmlFor="reason" className="form-label-mobile">
                        Reason <span className="optional">(Optional)</span>
                      </label>
                      <textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why do you need this advance?"
                        className="form-textarea-mobile"
                        rows="3"
                      />
                    </div>

                    <div className="advance-summary-mobile">
                      <div className="summary-item-mobile">
                        <span>Requested:</span>
                        <span>Rs. {amount ? parseFloat(amount).toLocaleString() : '0'}</span>
                      </div>
                      <div className="summary-item-mobile">
                        <span>Remaining After:</span>
                        <span>Rs. {amount ? (remainingSalary - parseFloat(amount)).toLocaleString() : remainingSalary.toLocaleString()}</span>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="btn-submit-advance"
                      disabled={loading || !amount || !uid || remainingSalary <= 0}
                    >
                      <span className="btn-icon">📋</span>
                      <span className="btn-text">
                        {loading ? "Submitting..." : "Submit Request"}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </section>

            {/* Request History */}
            <section className="history-section">
              <div className="section-header">
                <h3>Request History</h3>
                <span className="session-count">{requestHistory.length}</span>
              </div>

              {requestHistory.length === 0 ? (
                <div className="empty-sessions">
                  <div className="empty-icon">📋</div>
                  <p>No advance requests yet</p>
                </div>
              ) : (
                <div className="history-list-mobile">
                  {requestHistory.map((request, index) => (
                    <div key={request.id} className={`history-item-mobile ${request.status}`}>
                      <div className="history-header-mobile">
                        <div className="history-amount-mobile">
                          Rs. {request.amount?.toLocaleString() || '0'}
                        </div>
                        <div className={`status-badge-history ${request.status}`}>
                          {request.status === "pending" && "⏳"}
                          {request.status === "approved" && "✅"}
                          {request.status === "rejected" && "❌"}
                        </div>
                      </div>
                      
                      <div className="history-details-mobile">
                        <div className="history-date-mobile">
                          {request.requestDate ? 
                            new Date(request.requestDate).toLocaleDateString() : 'Unknown date'}
                        </div>
                        
                        {request.reason && request.reason !== "No reason provided" && (
                          <div className="history-reason-mobile">
                            {request.reason}
                          </div>
                        )}
                        
                        {request.approvedAt && (
                          <div className="history-processed-mobile">
                            {request.status === "approved" ? "Approved" : "Rejected"} •{" "}
                            {new Date(request.approvedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Bottom Navigation with Logout */}
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