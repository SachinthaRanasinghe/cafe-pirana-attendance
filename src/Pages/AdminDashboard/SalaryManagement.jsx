// src/Pages/AdminDashboard/SalaryManagement.jsx
import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  query,
  orderBy,
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
  const [otRate, setOtRate] = useState(""); // New state for OT rate
  const [activeTab, setActiveTab] = useState("setup");
  const [isEditing, setIsEditing] = useState(false);
  const [approvedAdvances, setApprovedAdvances] = useState({});
  const [adjustmentRequests, setAdjustmentRequests] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [staffLoading, setStaffLoading] = useState(true);

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

  // Fetch all staff members from sessions
  useEffect(() => {
    setStaffLoading(true);
    const q = query(collection(db, "sessions"), orderBy("staffName"));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const staffMap = new Map();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          if (data.staffUid && data.staffName) {
            if (!staffMap.has(data.staffUid)) {
              staffMap.set(data.staffUid, {
                staffUid: data.staffUid,
                staffName: data.staffName,
                staffId: data.staffId || "N/A"
              });
            }
          }
        });
        
        const staffArray = Array.from(staffMap.values());
        setStaffMembers(staffArray);
        setStaffLoading(false);
      },
      (error) => {
        console.error("Error fetching staff members:", error);
        setStaffLoading(false);
      }
    );

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
    
    const unsubscribe = onSnapshot(
      query(collection(db, "advanceRequests"), where("status", "==", "approved")),
      () => {
        fetchApprovedAdvances();
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch approved adjustment requests for all staff
  useEffect(() => {
    const fetchAdjustmentRequests = async () => {
      try {
        const q = query(
          collection(db, "adjustmentRequests"),
          where("status", "==", "approved")
        );
        
        const querySnapshot = await getDocs(q);
        const adjustmentData = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const staffUid = data.staffUid;
          const month = data.shiftMonth || data.month;
          
          if (!adjustmentData[staffUid]) {
            adjustmentData[staffUid] = {};
          }
          
          if (!adjustmentData[staffUid][month]) {
            adjustmentData[staffUid][month] = {
              totalOTAmount: 0,
              totalShortAmount: 0,
              totalOTHours: 0,
              totalShortHours: 0,
              otSessions: 0,
              shortSessions: 0
            };
          }
          
          if (data.adjustmentType === 'overtime') {
            adjustmentData[staffUid][month].totalOTAmount += data.adjustmentAmount || 0;
            adjustmentData[staffUid][month].totalOTHours += data.adjustmentHours || 0;
            adjustmentData[staffUid][month].otSessions += 1;
          } else if (data.adjustmentType === 'short_time') {
            adjustmentData[staffUid][month].totalShortAmount += data.adjustmentAmount || 0;
            adjustmentData[staffUid][month].totalShortHours += data.adjustmentHours || 0;
            adjustmentData[staffUid][month].shortSessions += 1;
          }
        });
        
        setAdjustmentRequests(adjustmentData);
      } catch (error) {
        console.error("Error fetching adjustment requests:", error);
      }
    };

    fetchAdjustmentRequests();
    
    const unsubscribe = onSnapshot(
      query(collection(db, "adjustmentRequests"), where("status", "==", "approved")),
      () => {
        fetchAdjustmentRequests();
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle setting salary and OT rate
  const handleSetSalary = async (staff) => {
    if (!monthlySalary || isNaN(monthlySalary) || monthlySalary <= 0) {
      alert("Please enter a valid monthly salary amount");
      return;
    }

    setLoading(true);
    try {
      const salaryData = {
        staffUid: staff.staffUid,
        staffName: staff.staffName,
        staffId: staff.staffId,
        monthlySalary: parseFloat(monthlySalary),
        hourlyRate: parseFloat(monthlySalary) / (26 * 8),
        otRate: otRate ? parseFloat(otRate) : 200, // Default to 200 if not set
        updatedAt: new Date().toISOString(),
        createdAt: salaries[staff.staffUid]?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, "salaries", staff.staffUid), salaryData);
      
      alert(
        `${isEditing ? 'Updated' : 'Set'} salary for ${staff.staffName}: Rs. ${monthlySalary}/month\n` +
        `OT Rate: Rs. ${salaryData.otRate}/hour`
      );
      setMonthlySalary("");
      setOtRate("");
      setSelectedStaff(null);
      setIsEditing(false);
    } catch (error) {
      console.error("Error setting salary:", error);
      alert("Error setting salary: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSalary = (staff) => {
    const existingSalary = salaries[staff.staffUid];
    if (existingSalary) {
      setSelectedStaff(staff);
      setMonthlySalary(existingSalary.monthlySalary.toString());
      setOtRate(existingSalary.otRate?.toString() || "200");
      setIsEditing(true);
      setActiveTab("setup");
    }
  };

  // Get OT rate for a staff member
  const getOtRate = (staffUid) => {
    return salaries[staffUid]?.otRate || 200; // Default to 200 if not set
  };

  // Calculate total adjustments for a staff member using their specific OT rate
  const getTotalAdjustments = (staffUid) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    const monthData = adjustmentRequests[staffUid][currentMonth] || { totalOTAmount: 0, totalShortAmount: 0 };
    
    return monthData.totalOTAmount - monthData.totalShortAmount;
  };

  // Calculate total OT for a staff member
  const getTotalOT = (staffUid) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    return adjustmentRequests[staffUid][currentMonth]?.totalOTAmount || 0;
  };

  // Calculate total Short Time for a staff member
  const getTotalShort = (staffUid) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    return adjustmentRequests[staffUid][currentMonth]?.totalShortAmount || 0;
  };

  // Calculate total OT hours for a staff member
  const getTotalOTHours = (staffUid) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    return adjustmentRequests[staffUid][currentMonth]?.totalOTHours || 0;
  };

  // Calculate total Short Time hours for a staff member
  const getTotalShortHours = (staffUid) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    return adjustmentRequests[staffUid][currentMonth]?.totalShortHours || 0;
  };

  // Calculate total advances for a staff member
  const getTotalAdvances = (staffUid) => {
    if (!approvedAdvances[staffUid]) return 0;
    
    const currentMonth = getShiftMonth(new Date());
    return approvedAdvances[staffUid][currentMonth] || 0;
  };

  // Calculate net salary (basic + OT - Short Time - advances)
  const calculateNetSalary = (staffUid, monthlySalary) => {
    const advances = getTotalAdvances(staffUid);
    const adjustments = getTotalAdjustments(staffUid);
    
    return Math.max(0, monthlySalary + adjustments - advances);
  };

  // Calculate advance usage percentage
  const getAdvanceUsagePercentage = (staffUid, monthlySalary) => {
    const advances = getTotalAdvances(staffUid);
    return monthlySalary > 0 ? Math.round((advances / monthlySalary) * 100) : 0;
  };

  const calculateStats = () => {
    const totalStaff = staffMembers.length;
    const staffWithSalary = Object.keys(salaries).length;
    const totalMonthlySalary = Object.values(salaries).reduce((sum, salary) => sum + salary.monthlySalary, 0);
    
    let totalAdvances = 0;
    let totalOT = 0;
    let totalShort = 0;
    let totalNetSalary = 0;
    
    Object.keys(salaries).forEach(staffUid => {
      const salary = salaries[staffUid];
      const advances = getTotalAdvances(staffUid);
      const ot = getTotalOT(staffUid);
      const short = getTotalShort(staffUid);
      
      totalAdvances += advances;
      totalOT += ot;
      totalShort += short;
      totalNetSalary += calculateNetSalary(staffUid, salary.monthlySalary);
    });
    
    return { 
      totalStaff, 
      staffWithSalary, 
      totalMonthlySalary, 
      totalAdvances,
      totalOT,
      totalShort,
      totalNetSalary,
      netAdjustments: totalOT - totalShort
    };
  };

  const stats = calculateStats();

  // Filter staff members for search
  const filteredStaffMembers = staffMembers.filter(staff => {
    if (!staff || !staff.staffName || !staff.staffId) return false;
    
    return (
      staff.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.staffId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredSalaries = Object.values(salaries).filter(salary =>
    salary.staffName && salary.staffId && (
      salary.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      salary.staffId.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

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
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">🏪</div>
            <div className="brand-text">
              <h1>Cafe Piranha</h1>
              <span>Salary Management</span>
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
            <h2>Salary Management</h2>
            <p>Set salaries and OT rates for staff members</p>
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
              <div className="stat-icon-mobile primary">👥</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.totalStaff}</div>
                <div className="stat-label">Total Staff</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile success">💰</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{stats.staffWithSalary}</div>
                <div className="stat-label">With Salary</div>
              </div>
            </div>
            
            <div className="stat-card-mobile">
              <div className="stat-icon-mobile warning">📊</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{Math.round(stats.totalMonthlySalary / 1000)}k</div>
                <div className="stat-label">Base Salary</div>
              </div>
            </div>

            <div className="stat-card-mobile">
              <div className="stat-icon-mobile accent">💸</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{Math.round(stats.totalAdvances / 1000)}k</div>
                <div className="stat-label">Advances</div>
              </div>
            </div>

            <div className="stat-card-mobile">
              <div className="stat-icon-mobile info">🕒</div>
              <div className="stat-content-mobile">
                <div className="stat-value">+{Math.round(stats.totalOT / 1000)}k</div>
                <div className="stat-label">Overtime</div>
              </div>
            </div>

            <div className="stat-card-mobile">
              <div className="stat-icon-mobile danger">⏰</div>
              <div className="stat-content-mobile">
                <div className="stat-value">-{Math.round(stats.totalShort / 1000)}k</div>
                <div className="stat-label">Short Time</div>
              </div>
            </div>

            <div className="stat-card-mobile highlight">
              <div className="stat-icon-mobile secondary">💳</div>
              <div className="stat-content-mobile">
                <div className="stat-value">{Math.round(stats.totalNetSalary / 1000)}k</div>
                <div className="stat-label">Net Salary</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="tabs-section">
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeTab === "setup" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("setup");
                setIsEditing(false);
                setSelectedStaff(null);
                setMonthlySalary("");
                setOtRate("");
              }}
            >
              <span className="tab-icon">💰</span>
              <span className="tab-text">{isEditing ? "Edit Salary" : "Set Salary"}</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === "view" ? "active" : ""}`}
              onClick={() => setActiveTab("view")}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-text">View All</span>
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

        {/* Salary Setup Tab */}
        {activeTab === "setup" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>{isEditing ? "Edit Salary & OT Rate" : "Set Salary & OT Rate"}</h3>
              <span className="badge-mobile pending">
                {staffMembers.length - Object.keys(salaries).length} pending
              </span>
            </div>

            <div className="salary-setup-form-mobile">
              <div className="form-group-mobile">
                <label className="form-label-mobile">Select Staff Member</label>
                
                {staffLoading ? (
                  <div className="loading-state-mobile">
                    <div className="loading-spinner"></div>
                    <span>Loading staff members...</span>
                  </div>
                ) : filteredStaffMembers.length === 0 ? (
                  <div className="empty-dropdown-mobile">
                    <span>No staff members found</span>
                    <small>Make sure staff have clocked in at least once</small>
                  </div>
                ) : (
                  <select 
                    value={selectedStaff?.staffUid || ""} 
                    onChange={(e) => {
                      const staff = filteredStaffMembers.find(s => s.staffUid === e.target.value);
                      setSelectedStaff(staff);
                      if (staff) {
                        const existingSalary = salaries[staff.staffUid];
                        setMonthlySalary(existingSalary?.monthlySalary?.toString() || "");
                        setOtRate(existingSalary?.otRate?.toString() || "200");
                        setIsEditing(!!existingSalary);
                      } else {
                        setMonthlySalary("");
                        setOtRate("200");
                        setIsEditing(false);
                      }
                    }}
                    className="form-select-mobile"
                  >
                    <option value="">Choose staff member...</option>
                    {filteredStaffMembers.map(staff => (
                      <option key={staff.staffUid} value={staff.staffUid}>
                        {staff.staffName} (ID: {staff.staffId})
                        {salaries[staff.staffUid] && " - 💰 Salary Set"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedStaff && (
                <>
                  <div className="staff-info-card-mobile">
                    <div className="staff-avatar-large">
                      {selectedStaff.staffName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="staff-details-large">
                      <h4>{selectedStaff.staffName}</h4>
                      <span className="staff-id">ID: {selectedStaff.staffId}</span>
                      {salaries[selectedStaff.staffUid] && (
                        <div className="current-salary-info">
                          <span className="salary-amount">
                            Current: Rs. {salaries[selectedStaff.staffUid].monthlySalary.toLocaleString()}/month
                          </span>
                          <div className="adjustment-info">
                            <span>OT Rate: Rs. {getOtRate(selectedStaff.staffUid)}/hour</span>
                            <span>OT: +Rs. {getTotalOT(selectedStaff.staffUid).toLocaleString()}</span>
                            <span>Short: -Rs. {getTotalShort(selectedStaff.staffUid).toLocaleString()}</span>
                            <span>Advances: -Rs. {getTotalAdvances(selectedStaff.staffUid).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group-mobile">
                    <label className="form-label-mobile">Monthly Salary (Rs.)</label>
                    <input
                      type="number"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(e.target.value)}
                      placeholder="Enter monthly salary amount"
                      className="form-input-mobile"
                      min="0"
                      step="100"
                    />
                  </div>

                  <div className="form-group-mobile">
                    <label className="form-label-mobile">
                      Overtime Rate (Rs./hour)
                      <span className="help-text"> - Custom rate for this staff member</span>
                    </label>
                    <input
                      type="number"
                      value={otRate}
                      onChange={(e) => setOtRate(e.target.value)}
                      placeholder="Enter OT rate per hour"
                      className="form-input-mobile"
                      min="0"
                      step="10"
                    />
                    <div className="rate-info-mobile">
                      <span className="rate-note">
                        Default rate: Rs. 200/hour. Set custom rate for this staff member.
                      </span>
                    </div>
                  </div>

                  {monthlySalary && (
                    <div className="salary-breakdown-card-mobile">
                      <div className="breakdown-header-mobile">
                        <h4>Salary Breakdown</h4>
                        <div className="breakdown-badge">Calculated</div>
                      </div>
                      <div className="breakdown-grid-mobile">
                        <div className="breakdown-item-mobile">
                          <span className="breakdown-label">Daily Rate</span>
                          <span className="breakdown-value">Rs. {(monthlySalary / 26).toFixed(2)}</span>
                        </div>
                        <div className="breakdown-item-mobile">
                          <span className="breakdown-label">Hourly Rate</span>
                          <span className="breakdown-value">Rs. {(monthlySalary / (26 * 8)).toFixed(2)}</span>
                        </div>
                        <div className="breakdown-item-mobile highlight">
                          <span className="breakdown-label">OT Rate</span>
                          <span className="breakdown-value">Rs. {otRate || "200"}/hour</span>
                        </div>
                        <div className="breakdown-item-mobile">
                          <span className="breakdown-label">Max Advance (50%)</span>
                          <span className="breakdown-value">Rs. {(monthlySalary * 0.5).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button 
                    className="btn-set-salary-mobile"
                    onClick={() => handleSetSalary(selectedStaff)}
                    disabled={loading || !monthlySalary}
                  >
                    <span className="btn-icon">💾</span>
                    <span className="btn-text">
                      {loading ? "Saving..." : (isEditing ? "Update Salary" : "Set Salary")}
                    </span>
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {/* View Salaries Tab */}
        {activeTab === "view" && (
          <section className="section-mobile">
            <div className="section-header-mobile">
              <h3>Current Salary Structure</h3>
              <span className="badge-mobile">{filteredSalaries.length}</span>
            </div>
            
            {filteredSalaries.length === 0 ? (
              <div className="empty-state-mobile">
                <div className="empty-icon">💰</div>
                <h4>No Salaries Found</h4>
                <p>
                  {searchTerm ? 
                    "No matching salaries found for your search" : 
                    "Set salaries for staff members in the 'Set Salary' tab"
                  }
                </p>
              </div>
            ) : (
              <div className="salaries-list-mobile">
                {filteredSalaries.map(salary => {
                  const totalAdvances = getTotalAdvances(salary.staffUid);
                  const totalOT = getTotalOT(salary.staffUid);
                  const totalShort = getTotalShort(salary.staffUid);
                  const totalOTHours = getTotalOTHours(salary.staffUid);
                  const totalShortHours = getTotalShortHours(salary.staffUid);
                  const netSalary = calculateNetSalary(salary.staffUid, salary.monthlySalary);
                  const advanceUsage = getAdvanceUsagePercentage(salary.staffUid, salary.monthlySalary);
                  const staffOtRate = getOtRate(salary.staffUid);
                  
                  return (
                    <div key={salary.staffUid} className="salary-item-mobile">
                      <div className="salary-header-mobile">
                        <div className="staff-info-mobile">
                          <div className="staff-avatar-mobile">
                            {salary.staffName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="staff-details-mobile">
                            <h4>{salary.staffName}</h4>
                            <span className="staff-id">ID: {salary.staffId}</span>
                            <span className="ot-rate-badge">
                              OT Rate: Rs. {staffOtRate}/hour
                            </span>
                          </div>
                        </div>
                        <div className="salary-amount-main-mobile">
                          Rs. {salary.monthlySalary.toLocaleString()}
                          <span className="salary-period">/month</span>
                        </div>
                      </div>

                      <div className="salary-details-mobile">
                        {/* Quick Stats */}
                        <div className="quick-stats-mobile">
                          <div className="quick-stat">
                            <span className="stat-label">Daily</span>
                            <span className="stat-value">Rs. {(salary.monthlySalary / 26).toFixed(0)}</span>
                          </div>
                          <div className="quick-stat">
                            <span className="stat-label">Hourly</span>
                            <span className="stat-value">Rs. {salary.hourlyRate?.toFixed(0) || (salary.monthlySalary / (26 * 8)).toFixed(0)}</span>
                          </div>
                          <div className="quick-stat highlight">
                            <span className="stat-label">OT Rate</span>
                            <span className="stat-value">Rs. {staffOtRate}/h</span>
                          </div>
                          <div className="quick-stat">
                            <span className="stat-label">Max Advance</span>
                            <span className="stat-value">Rs. {(salary.monthlySalary * 0.5).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {/* Financial Summary */}
                        <div className="financial-summary-mobile">
                          <div className="summary-section-mobile">
                            <div className="summary-item-mobile positive">
                              <span className="summary-label">Base Salary:</span>
                              <span className="summary-value">Rs. {salary.monthlySalary.toLocaleString()}</span>
                            </div>
                            {totalOT > 0 && (
                              <div className="summary-item-mobile positive">
                                <span className="summary-label">Overtime:</span>
                                <span className="summary-value">
                                  + Rs. {totalOT.toLocaleString()} ({totalOTHours.toFixed(1)}h @ Rs.{staffOtRate}/h)
                                </span>
                              </div>
                            )}
                            {totalShort > 0 && (
                              <div className="summary-item-mobile negative">
                                <span className="summary-label">Short Time:</span>
                                <span className="summary-value">
                                  - Rs. {totalShort.toLocaleString()} ({totalShortHours.toFixed(1)}h)
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {totalAdvances > 0 && (
                            <div className="summary-section-mobile">
                              <div className="summary-item-mobile negative">
                                <span className="summary-label">Advances:</span>
                                <span className="summary-value">- Rs. {totalAdvances.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                          
                          <div className="summary-section-mobile total">
                            <div className="summary-item-mobile total-amount">
                              <span className="summary-label">Net Salary:</span>
                              <span className="summary-value">Rs. {netSalary.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Progress Bar for Advance Usage */}
                        {totalAdvances > 0 && (
                          <div className="advance-progress-section-mobile">
                            <div className="progress-header-mobile">
                              <span>Advance Usage: {advanceUsage}%</span>
                              <span>Rs. {totalAdvances.toLocaleString()}</span>
                            </div>
                            <div className="progress-bar-mobile">
                              <div 
                                className="progress-fill-mobile"
                                style={{ width: `${Math.min(advanceUsage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="salary-actions-mobile">
                        <button 
                          className="btn-edit-salary-mobile"
                          onClick={() => handleEditSalary({
                            staffUid: salary.staffUid,
                            staffName: salary.staffName,
                            staffId: salary.staffId
                          })}
                        >
                          <span className="btn-icon">✏️</span>
                          <span className="btn-text">Edit Salary & OT Rate</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                const staffWithoutSalary = staffMembers.filter(staff => !salaries[staff.staffUid]);
                if (staffWithoutSalary.length > 0) {
                  const randomStaff = staffWithoutSalary[Math.floor(Math.random() * staffWithoutSalary.length)];
                  setSelectedStaff(randomStaff);
                  setMonthlySalary("");
                  setOtRate("200");
                  setIsEditing(false);
                  setActiveTab("setup");
                } else {
                  alert("All staff members have salaries set!");
                }
              }}
            >
              <span className="btn-icon">🎲</span>
              <span className="btn-text">Random Staff</span>
            </button>
            
            <button 
              className="btn-quick-action-mobile outline"
              onClick={() => {
                setSelectedStaff(null);
                setMonthlySalary("");
                setOtRate("200");
                setIsEditing(false);
              }}
            >
              <span className="btn-icon">🔄</span>
              <span className="btn-text">Clear Form</span>
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