// src/Pages/AdminDashboard/SalaryManagement.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  query,
  orderBy,
  updateDoc,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "../../firebase";
import "./SalaryManagement.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function SalaryManagement({ onLogout }) {
  const [staffMembers, setStaffMembers] = useState([]);
  const [salaries, setSalaries] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [monthlySalary, setMonthlySalary] = useState("");
  const [activeTab, setActiveTab] = useState("setup");
  const [isEditing, setIsEditing] = useState(false);
  const [approvedAdvances, setApprovedAdvances] = useState({});
  const [otRequests, setOtRequests] = useState({});

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

  // Fetch all staff members from sessions
  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("staffName"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffMap = new Map();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!staffMap.has(data.staffUid)) {
          staffMap.set(data.staffUid, {
            staffUid: data.staffUid,
            staffName: data.staffName,
            staffId: data.staffId
          });
        }
      });
      
      setStaffMembers(Array.from(staffMap.values()));
    });

    return () => unsubscribe();
  }, []);

  // Fetch existing salaries
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

  // Fetch approved advances for all staff
  useEffect(() => {
    const fetchApprovedAdvances = async () => {
      try {
        const q = query(
          collection(db, "advanceRequests"),
          where("status", "==", "approved")
        );
        
        const querySnapshot = await getDocs(q);
        const advances = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const staffUid = data.staffUid;
          // Use shiftMonth if available, otherwise fall back to month
          const month = data.shiftMonth || data.month;
          
          if (!advances[staffUid]) {
            advances[staffUid] = {};
          }
          
          if (!advances[staffUid][month]) {
            advances[staffUid][month] = 0;
          }
          
          advances[staffUid][month] += data.amount || 0;
        });
        
        setApprovedAdvances(advances);
      } catch (error) {
        console.error("Error fetching approved advances:", error);
      }
    };

    fetchApprovedAdvances();
    
    // Real-time listener for advance requests
    const unsubscribe = onSnapshot(
      query(collection(db, "advanceRequests"), where("status", "==", "approved")),
      () => {
        fetchApprovedAdvances();
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch approved OT requests for all staff
  useEffect(() => {
    const fetchOTRequests = async () => {
      try {
        const q = query(
          collection(db, "otRequests"),
          where("status", "==", "approved")
        );
        
        const querySnapshot = await getDocs(q);
        const otData = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const staffUid = data.staffUid;
          // Use shiftMonth if available, otherwise fall back to month
          const month = data.shiftMonth || data.month;
          
          if (!otData[staffUid]) {
            otData[staffUid] = {};
          }
          
          if (!otData[staffUid][month]) {
            otData[staffUid][month] = {
              totalAmount: 0,
              totalHours: 0,
              sessions: 0
            };
          }
          
          otData[staffUid][month].totalAmount += data.otAmount || 0;
          otData[staffUid][month].totalHours += data.otHours || 0;
          otData[staffUid][month].sessions += 1;
        });
        
        setOtRequests(otData);
      } catch (error) {
        console.error("Error fetching OT requests:", error);
      }
    };

    fetchOTRequests();
    
    // Real-time listener for OT requests
    const unsubscribe = onSnapshot(
      query(collection(db, "otRequests"), where("status", "==", "approved")),
      () => {
        fetchOTRequests();
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSetSalary = async (staff) => {
    if (!monthlySalary || isNaN(monthlySalary) || monthlySalary <= 0) {
      showNotification("Please enter a valid monthly salary amount", "error");
      return;
    }

    setLoading(true);
    try {
      const salaryData = {
        staffUid: staff.staffUid,
        staffName: staff.staffName,
        staffId: staff.staffId,
        monthlySalary: parseFloat(monthlySalary),
        hourlyRate: parseFloat(monthlySalary) / (26 * 8), // 26 days * 8 hours
        updatedAt: new Date().toISOString(),
        createdAt: salaries[staff.staffUid]?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, "salaries", staff.staffUid), salaryData);
      
      showNotification(
        `${isEditing ? 'Updated' : 'Set'} salary for ${staff.staffName}: Rs. ${monthlySalary}/month`, 
        "success"
      );
      setMonthlySalary("");
      setSelectedStaff(null);
      setIsEditing(false);
    } catch (error) {
      console.error("Error setting salary:", error);
      showNotification("Error setting salary: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSalary = (staff) => {
    const existingSalary = salaries[staff.staffUid];
    if (existingSalary) {
      setSelectedStaff(staff);
      setMonthlySalary(existingSalary.monthlySalary.toString());
      setIsEditing(true);
      setActiveTab("setup");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Calculate remaining salary after advances
  const calculateRemainingSalary = (staffUid, monthlySalary) => {
    if (!approvedAdvances[staffUid]) return monthlySalary;
    
    const currentMonth = getShiftMonth(new Date());
    const advancesThisMonth = approvedAdvances[staffUid][currentMonth] || 0;
    
    return Math.max(0, monthlySalary - advancesThisMonth);
  };

  // Calculate total advances for a staff member
  const getTotalAdvances = (staffUid) => {
    if (!approvedAdvances[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    return approvedAdvances[staffUid][currentMonth] || 0;
  };

  // Calculate total OT for a staff member
  const getTotalOT = (staffUid) => {
    if (!otRequests[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    return otRequests[staffUid][currentMonth]?.totalAmount || 0;
  };

  // Calculate OT hours for a staff member
  const getTotalOTHours = (staffUid) => {
    if (!otRequests[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    return otRequests[staffUid][currentMonth]?.totalHours || 0;
  };

  // Calculate net salary (basic + OT - advances)
  const calculateNetSalary = (staffUid, monthlySalary) => {
    const advances = getTotalAdvances(staffUid);
    const ot = getTotalOT(staffUid);
    
    return Math.max(0, monthlySalary + ot - advances);
  };

  // Calculate advance usage percentage
  const getAdvanceUsagePercentage = (staffUid, monthlySalary) => {
    const advances = getTotalAdvances(staffUid);
    return monthlySalary > 0 ? Math.round((advances / monthlySalary) * 100) : 0;
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

  const calculateStats = () => {
    const totalStaff = staffMembers.length;
    const staffWithSalary = Object.keys(salaries).length;
    const totalMonthlySalary = Object.values(salaries).reduce((sum, salary) => sum + salary.monthlySalary, 0);
    
    // Calculate total approved advances
    let totalAdvances = 0;
    let totalOT = 0;
    let totalNetSalary = 0;
    
    Object.keys(salaries).forEach(staffUid => {
      const salary = salaries[staffUid];
      const advances = getTotalAdvances(staffUid);
      const ot = getTotalOT(staffUid);
      
      totalAdvances += advances;
      totalOT += ot;
      totalNetSalary += calculateNetSalary(staffUid, salary.monthlySalary);
    });
    
    return { 
      totalStaff, 
      staffWithSalary, 
      totalMonthlySalary, 
      totalAdvances,
      totalOT,
      totalNetSalary
    };
  };

  const stats = calculateStats();

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
    <div className="salary-management">
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
            <h1>Salary Management</h1>
            <p>Set and manage staff monthly salaries with OT calculations</p>
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
            <div className="stat-icon primary">👥</div>
            <div className="stat-content">
              <h3>{stats.totalStaff}</h3>
              <p>Total Staff</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon success">💰</div>
            <div className="stat-content">
              <h3>{stats.staffWithSalary}</h3>
              <p>With Salary</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon warning">📊</div>
            <div className="stat-content">
              <h3>Rs. {stats.totalMonthlySalary.toLocaleString()}</h3>
              <p>Total Base Salary</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon accent">💸</div>
            <div className="stat-content">
              <h3>Rs. {stats.totalAdvances.toLocaleString()}</h3>
              <p>Total Advances</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon info">🕒</div>
            <div className="stat-content">
              <h3>Rs. {stats.totalOT.toLocaleString()}</h3>
              <p>Total OT</p>
            </div>
          </div>

          <div className="stat-card highlight">
            <div className="stat-icon secondary">💳</div>
            <div className="stat-content">
              <h3>Rs. {stats.totalNetSalary.toLocaleString()}</h3>
              <p>Total Net Salary</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === "setup" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("setup");
              setIsEditing(false);
              setSelectedStaff(null);
              setMonthlySalary("");
            }}
          >
            <span className="tab-icon">💰</span>
            {isEditing ? "Edit Salary" : "Set Salary"}
          </button>
          <button 
            className={`tab-btn ${activeTab === "view" ? "active" : ""}`}
            onClick={() => setActiveTab("view")}
          >
            <span className="tab-icon">📋</span>
            View All
          </button>
        </div>

        {/* Salary Setup Tab */}
        {activeTab === "setup" && (
          <div className="section-card">
            <div className="card-header">
              <h2>{isEditing ? "Edit Monthly Salary" : "Set Monthly Salary"}</h2>
              <span className="badge">{staffMembers.length - Object.keys(salaries).length} pending</span>
            </div>

            <div className="salary-setup-form">
              <div className="form-group">
                <label className="form-label">Select Staff Member</label>
                <select 
                  value={selectedStaff?.staffUid || ""} 
                  onChange={(e) => {
                    const staff = staffMembers.find(s => s.staffUid === e.target.value);
                    setSelectedStaff(staff);
                    if (staff) {
                      const existingSalary = salaries[staff.staffUid];
                      setMonthlySalary(existingSalary?.monthlySalary?.toString() || "");
                      setIsEditing(!!existingSalary);
                    } else {
                      setMonthlySalary("");
                      setIsEditing(false);
                    }
                  }}
                  className="form-select"
                >
                  <option value="">Choose staff member...</option>
                  {staffMembers.map(staff => (
                    <option key={staff.staffUid} value={staff.staffUid}>
                      {staff.staffName} (ID: {staff.staffId})
                      {salaries[staff.staffUid] && " - 💰 Salary Set"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStaff && (
                <>
                  <div className="staff-info-card">
                    <div className="staff-avatar-large">
                      {selectedStaff.staffName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="staff-details-large">
                      <h4>{selectedStaff.staffName}</h4>
                      <span className="staff-id">ID: {selectedStaff.staffId}</span>
                      {salaries[selectedStaff.staffUid] && (
                        <div className="current-salary-info">
                          <span>Current Salary: Rs. {salaries[selectedStaff.staffUid].monthlySalary.toLocaleString()}/month</span>
                          {approvedAdvances[selectedStaff.staffUid] && (
                            <div className="advance-info">
                              <span>Approved Advances: Rs. {getTotalAdvances(selectedStaff.staffUid).toLocaleString()}</span>
                              <span>Remaining Salary: Rs. {calculateRemainingSalary(selectedStaff.staffUid, salaries[selectedStaff.staffUid].monthlySalary).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Monthly Salary (Rs.)</label>
                    <input
                      type="number"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(e.target.value)}
                      placeholder="Enter monthly salary amount"
                      className="form-input"
                      min="0"
                      step="100"
                    />
                  </div>

                  {monthlySalary && (
                    <div className="salary-breakdown-card">
                      <div className="breakdown-header">
                        <h4>Salary Breakdown</h4>
                        <div className="breakdown-badge">Calculated</div>
                      </div>
                      <div className="breakdown-grid">
                        <div className="breakdown-item">
                          <span className="breakdown-label">Daily Rate</span>
                          <span className="breakdown-value">Rs. {(monthlySalary / 26).toFixed(2)}</span>
                        </div>
                        <div className="breakdown-item">
                          <span className="breakdown-label">Hourly Rate</span>
                          <span className="breakdown-value">Rs. {(monthlySalary / (26 * 8)).toFixed(2)}</span>
                        </div>
                        <div className="breakdown-item">
                          <span className="breakdown-label">Max Advance (50%)</span>
                          <span className="breakdown-value highlight">Rs. {(monthlySalary * 0.5).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button 
                    className="btn-primary set-salary-btn"
                    onClick={() => handleSetSalary(selectedStaff)}
                    disabled={loading || !monthlySalary}
                  >
                    <span className="btn-icon">💾</span>
                    {loading ? "Saving..." : (isEditing ? "Update Salary" : "Set Salary")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* View Salaries Tab */}
        {activeTab === "view" && (
          <div className="section-card">
            <div className="card-header">
              <h2>Current Salary Structure</h2>
              <span className="badge">{Object.keys(salaries).length}</span>
            </div>
            
            {Object.keys(salaries).length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💰</div>
                <h3>No Salaries Set</h3>
                <p>Set salaries for staff members in the "Set Salary" tab</p>
              </div>
            ) : (
              <div className="salaries-list">
                {Object.values(salaries).map(salary => {
                  const totalAdvances = getTotalAdvances(salary.staffUid);
                  const totalOT = getTotalOT(salary.staffUid);
                  const totalOTHours = getTotalOTHours(salary.staffUid);
                  const remainingSalary = calculateRemainingSalary(salary.staffUid, salary.monthlySalary);
                  const netSalary = calculateNetSalary(salary.staffUid, salary.monthlySalary);
                  const advanceUsage = getAdvanceUsagePercentage(salary.staffUid, salary.monthlySalary);
                  
                  return (
                    <div key={salary.staffUid} className="salary-item">
                      <div className="salary-header">
                        <div className="staff-info">
                          <div className="staff-avatar">
                            {salary.staffName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="staff-details">
                            <h4>{salary.staffName}</h4>
                            <span className="staff-id">ID: {salary.staffId}</span>
                          </div>
                        </div>
                        <div className="salary-amount-main">
                          Rs. {salary.monthlySalary.toLocaleString()}
                          <span className="salary-period">/month</span>
                        </div>
                      </div>

                      <div className="salary-details">
                        <div className="salary-breakdown-mini">
                          <div className="breakdown-row">
                            <span>Daily:</span>
                            <span>Rs. {(salary.monthlySalary / 26).toFixed(2)}</span>
                          </div>
                          <div className="breakdown-row">
                            <span>Hourly:</span>
                            <span>Rs. {salary.hourlyRate?.toFixed(2) || (salary.monthlySalary / (26 * 8)).toFixed(2)}</span>
                          </div>
                          <div className="breakdown-row highlight">
                            <span>Max Advance:</span>
                            <span>Rs. {(salary.monthlySalary * 0.5).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {/* Financial Summary */}
                        <div className="financial-summary">
                          <div className="summary-section">
                            <h5>Earnings</h5>
                            <div className="summary-item positive">
                              <span className="summary-label">Base Salary:</span>
                              <span className="summary-value">Rs. {salary.monthlySalary.toLocaleString()}</span>
                            </div>
                            {totalOT > 0 && (
                              <div className="summary-item positive">
                                <span className="summary-label">Overtime:</span>
                                <span className="summary-value">
                                  + Rs. {totalOT.toLocaleString()} ({totalOTHours.toFixed(1)}h)
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="summary-section">
                            <h5>Deductions</h5>
                            {totalAdvances > 0 && (
                              <div className="summary-item negative">
                                <span className="summary-label">Advances:</span>
                                <span className="summary-value">- Rs. {totalAdvances.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="summary-section total">
                            <h5>Net Salary</h5>
                            <div className="summary-item total-amount">
                              <span className="summary-label">Final Amount:</span>
                              <span className="summary-value">Rs. {netSalary.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Progress Bar for Advance Usage */}
                        {totalAdvances > 0 && (
                          <div className="advance-progress-section">
                            <div className="progress-header">
                              <span>Advance Usage: {advanceUsage}%</span>
                              <span>Rs. {totalAdvances.toLocaleString()} / Rs. {salary.monthlySalary.toLocaleString()}</span>
                            </div>
                            <div className="progress-bar">
                              <div 
                                className="progress-fill"
                                style={{ width: `${Math.min(advanceUsage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        <div className="salary-meta">
                          <span className="update-date">
                            Updated: {salary.updatedAt ? new Date(salary.updatedAt).toLocaleDateString() : 'Recently'}
                          </span>
                        </div>
                      </div>

                      <div className="salary-actions">
                        <button 
                          className="btn-outline edit-btn"
                          onClick={() => handleEditSalary({
                            staffUid: salary.staffUid,
                            staffName: salary.staffName,
                            staffId: salary.staffId
                          })}
                        >
                          <span className="btn-icon">✏️</span>
                          Edit Salary
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="section-card">
          <div className="card-header">
            <h2>Quick Actions</h2>
            <span className="badge warning">Admin</span>
          </div>
          
          <div className="action-buttons">
            <button 
              className="btn-secondary"
              onClick={() => {
                const staffWithoutSalary = staffMembers.filter(staff => !salaries[staff.staffUid]);
                if (staffWithoutSalary.length > 0) {
                  const randomStaff = staffWithoutSalary[Math.floor(Math.random() * staffWithoutSalary.length)];
                  setSelectedStaff(randomStaff);
                  setMonthlySalary("");
                  setIsEditing(false);
                  setActiveTab("setup");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  showNotification("All staff members have salaries set!", "info");
                }
              }}
            >
              <span className="btn-icon">🎲</span>
              Random Staff (No Salary)
            </button>
            
            <button 
              className="btn-outline"
              onClick={() => {
                setSelectedStaff(null);
                setMonthlySalary("");
                setIsEditing(false);
              }}
            >
              <span className="btn-icon">🔄</span>
              Clear Form
            </button>
          </div>
        </div>

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