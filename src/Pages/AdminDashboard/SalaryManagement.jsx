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
  const [otRate, setOtRate] = useState("");
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
        otRate: otRate ? parseFloat(otRate) : 200,
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
    return salaries[staffUid]?.otRate || 200;
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
    <div className="salary-management">
      {/* Professional Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-logo">💰</div>
            <div className="brand-text">
              <h1 className="brand-title">Salary Management</h1>
              <span className="brand-subtitle">Cafe Piranha</span>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="live-status">
              <span className="status-indicator"></span>
              <span className="status-text">Live</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-value">{stats.staffWithSalary}/{stats.totalStaff}</span>
            <span className="stat-label">Salaries Set</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-value">{formatCurrency(stats.totalNetSalary)}</span>
            <span className="stat-label">Net Payroll</span>
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
                  Salary Management 💰
                </h2>
                <div className="current-date">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              <p className="welcome-subtitle">
                Set and manage staff salaries with custom OT rates
              </p>
            </div>
            <div className="welcome-graphic">
              <div className="money-animation">💸✨</div>
            </div>
          </div>
        </section>

        {/* Key Metrics */}
        <section className="metrics-section">
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon total-staff">👥</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.totalStaff}</h3>
                <p className="metric-label">Total Staff</p>
              </div>
            </div>
            
            <div className="metric-card highlight">
              <div className="metric-icon salary-set">💰</div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.staffWithSalary}</h3>
                <p className="metric-label">With Salary</p>
                <span className="metric-subtext">
                  {Math.round((stats.staffWithSalary / stats.totalStaff) * 100)}% coverage
                </span>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon payroll">📊</div>
              <div className="metric-content">
                <h3 className="metric-value">{formatCurrency(stats.totalMonthlySalary)}</h3>
                <p className="metric-label">Base Payroll</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon adjustments">⚖️</div>
              <div className="metric-content">
                <h3 className="metric-value">{formatCurrency(stats.netAdjustments)}</h3>
                <p className="metric-label">Net Adjustments</p>
                <span className="metric-subtext">
                  +{formatCurrency(stats.totalOT)} / -{formatCurrency(stats.totalShort)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="navigation-section">
          <div className="tab-navigation">
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
              <span className="tab-icon">💼</span>
              <span className="tab-text">Setup</span>
              {staffMembers.length - Object.keys(salaries).length > 0 && (
                <span className="tab-badge">{staffMembers.length - Object.keys(salaries).length}</span>
              )}
            </button>
            <button 
              className={`tab-btn ${activeTab === "view" ? "active" : ""}`}
              onClick={() => setActiveTab("view")}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-text">View All</span>
              <span className="tab-badge">{Object.keys(salaries).length}</span>
            </button>
          </div>
        </section>

        {/* Search Section */}
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
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </section>

        {/* Tab Content */}
        <div className="tab-content">
          {/* Setup Tab */}
          {activeTab === "setup" && (
            <div className="tab-panel">
              <section className="content-section">
                <div className="section-header">
                  <h2>{isEditing ? "Edit Salary & OT Rate" : "Set Salary & OT Rate"}</h2>
                  <div className="section-badge pending">
                    {staffMembers.length - Object.keys(salaries).length} pending
                  </div>
                </div>

                <div className="setup-form">
                  <div className="form-group">
                    <label className="form-label">Select Staff Member</label>
                    
                    {staffLoading ? (
                      <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <span>Loading staff members...</span>
                      </div>
                    ) : filteredStaffMembers.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">👥</div>
                        <h4>No Staff Members</h4>
                        <p>No staff members found matching your criteria</p>
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
                        className="form-select"
                      >
                        <option value="">Choose staff member...</option>
                        {filteredStaffMembers.map(staff => (
                          <option key={staff.staffUid} value={staff.staffUid}>
                            {staff.staffName} (ID: {staff.staffId})
                            {salaries[staff.staffUid] && " - ✅ Salary Set"}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {selectedStaff && (
                    <>
                      <div className="staff-profile-card">
                        <div className="staff-avatar">
                          {selectedStaff.staffName?.charAt(0).toUpperCase()}
                        </div>
                        <div className="staff-info">
                          <h3 className="staff-name">{selectedStaff.staffName}</h3>
                          <p className="staff-id">ID: {selectedStaff.staffId}</p>
                          {salaries[selectedStaff.staffUid] && (
                            <div className="current-salary">
                              <div className="salary-tag">
                                <span className="tag-icon">💰</span>
                                <span>Current: {formatCurrency(salaries[selectedStaff.staffUid].monthlySalary)}/month</span>
                              </div>
                              <div className="adjustment-summary">
                                <div className="adjustment-item positive">
                                  <span>OT: +{formatCurrency(getTotalOT(selectedStaff.staffUid))}</span>
                                </div>
                                <div className="adjustment-item negative">
                                  <span>Short: -{formatCurrency(getTotalShort(selectedStaff.staffUid))}</span>
                                </div>
                                <div className="adjustment-item warning">
                                  <span>Advances: -{formatCurrency(getTotalAdvances(selectedStaff.staffUid))}</span>
                                </div>
                              </div>
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

                      <div className="form-group">
                        <label className="form-label">
                          Overtime Rate (Rs./hour)
                          <span className="help-text">Custom rate for this staff member</span>
                        </label>
                        <input
                          type="number"
                          value={otRate}
                          onChange={(e) => setOtRate(e.target.value)}
                          placeholder="Enter OT rate per hour"
                          className="form-input"
                          min="0"
                          step="10"
                        />
                        <div className="rate-info">
                          <span className="info-icon">💡</span>
                          <span>Default rate: Rs. 200/hour. Set custom rate if different.</span>
                        </div>
                      </div>

                      {monthlySalary && (
                        <div className="breakdown-card">
                          <div className="breakdown-header">
                            <h4>Salary Breakdown</h4>
                            <div className="breakdown-badge">Calculated</div>
                          </div>
                          <div className="breakdown-grid">
                            <div className="breakdown-item">
                              <span className="breakdown-label">Daily Rate</span>
                              <span className="breakdown-value">{formatCurrency(monthlySalary / 26)}</span>
                            </div>
                            <div className="breakdown-item">
                              <span className="breakdown-label">Hourly Rate</span>
                              <span className="breakdown-value">{formatCurrency(monthlySalary / (26 * 8))}</span>
                            </div>
                            <div className="breakdown-item highlight">
                              <span className="breakdown-label">OT Rate</span>
                              <span className="breakdown-value">Rs. {otRate || "200"}/hour</span>
                            </div>
                            <div className="breakdown-item">
                              <span className="breakdown-label">Max Advance (50%)</span>
                              <span className="breakdown-value">{formatCurrency(monthlySalary * 0.5)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <button 
                        className={`btn-primary ${loading ? 'loading' : ''}`}
                        onClick={() => handleSetSalary(selectedStaff)}
                        disabled={loading || !monthlySalary}
                      >
                        {loading ? (
                          <>
                            <div className="loading-spinner-small"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <span className="btn-icon">💾</span>
                            <span>{isEditing ? "Update Salary" : "Set Salary"}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* View Tab */}
          {activeTab === "view" && (
            <div className="tab-panel">
              <section className="content-section">
                <div className="section-header">
                  <h2>Salary Structure</h2>
                  <div className="section-badge">
                    {filteredSalaries.length} Staff
                  </div>
                </div>
                
                {filteredSalaries.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💰</div>
                    <h3>No Salaries Found</h3>
                    <p>
                      {searchTerm ? 
                        "No matching salaries found for your search" : 
                        "Set up staff salaries in the Setup tab to get started"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="salaries-grid">
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
                        <div key={salary.staffUid} className="salary-card">
                          <div className="card-header">
                            <div className="staff-profile">
                              <div className="staff-avatar">
                                {salary.staffName?.charAt(0).toUpperCase()}
                              </div>
                              <div className="staff-details">
                                <h3 className="staff-name">{salary.staffName}</h3>
                                <p className="staff-id">ID: {salary.staffId}</p>
                                <div className="ot-rate-tag">
                                  <span className="tag-icon">🕒</span>
                                  <span>OT: Rs. {staffOtRate}/hour</span>
                                </div>
                              </div>
                            </div>
                            <div className="salary-display">
                              <div className="base-salary">{formatCurrency(salary.monthlySalary)}</div>
                              <div className="salary-period">/month</div>
                            </div>
                          </div>

                          <div className="card-content">
                            {/* Rate Summary */}
                            <div className="rate-summary">
                              <div className="rate-item">
                                <span className="rate-label">Daily</span>
                                <span className="rate-value">{formatCurrency(salary.monthlySalary / 26)}</span>
                              </div>
                              <div className="rate-item">
                                <span className="rate-label">Hourly</span>
                                <span className="rate-value">{formatCurrency(salary.hourlyRate || (salary.monthlySalary / (26 * 8)))}</span>
                              </div>
                              <div className="rate-item highlight">
                                <span className="rate-label">OT Rate</span>
                                <span className="rate-value">Rs. {staffOtRate}/h</span>
                              </div>
                            </div>
                            
                            {/* Financial Summary */}
                            <div className="financial-summary">
                              <div className="summary-section">
                                <div className="summary-item">
                                  <span className="summary-label">Base Salary</span>
                                  <span className="summary-value">{formatCurrency(salary.monthlySalary)}</span>
                                </div>
                                {totalOT > 0 && (
                                  <div className="summary-item positive">
                                    <span className="summary-label">Overtime</span>
                                    <span className="summary-value">
                                      +{formatCurrency(totalOT)}
                                    </span>
                                    <span className="summary-note">
                                      {totalOTHours.toFixed(1)}h @ Rs.{staffOtRate}/h
                                    </span>
                                  </div>
                                )}
                                {totalShort > 0 && (
                                  <div className="summary-item negative">
                                    <span className="summary-label">Short Time</span>
                                    <span className="summary-value">
                                      -{formatCurrency(totalShort)}
                                    </span>
                                    <span className="summary-note">
                                      {totalShortHours.toFixed(1)}h deducted
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {totalAdvances > 0 && (
                                <div className="summary-section">
                                  <div className="summary-item warning">
                                    <span className="summary-label">Advances</span>
                                    <span className="summary-value">-{formatCurrency(totalAdvances)}</span>
                                  </div>
                                </div>
                              )}
                              
                              <div className="summary-section total">
                                <div className="summary-item total">
                                  <span className="summary-label">Net Salary</span>
                                  <span className="summary-value">{formatCurrency(netSalary)}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Advance Progress */}
                            {totalAdvances > 0 && (
                              <div className="advance-progress">
                                <div className="progress-header">
                                  <span className="progress-label">Advance Usage</span>
                                  <span className="progress-value">{advanceUsage}%</span>
                                </div>
                                <div className="progress-bar">
                                  <div 
                                    className={`progress-fill ${advanceUsage > 80 ? 'high' : advanceUsage > 50 ? 'medium' : 'low'}`}
                                    style={{ width: `${Math.min(advanceUsage, 100)}%` }}
                                  ></div>
                                </div>
                                <div className="progress-amount">
                                  {formatCurrency(totalAdvances)} of {formatCurrency(salary.monthlySalary * 0.5)} limit
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="card-actions">
                            <button 
                              className="btn-secondary"
                              onClick={() => handleEditSalary({
                                staffUid: salary.staffUid,
                                staffName: salary.staffName,
                                staffId: salary.staffId
                              })}
                            >
                              <span className="btn-icon">✏️</span>
                              <span>Edit Salary</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <section className="actions-section">
          <div className="section-header">
            <h3>Quick Actions</h3>
            <div className="admin-badge">Admin</div>
          </div>
          
          <div className="action-buttons">
            <button 
              className="action-btn"
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
                  alert("🎉 All staff members have salaries set!");
                }
              }}
            >
              <span className="btn-icon">🎲</span>
              <span>Random Staff</span>
            </button>
            
            <button 
              className="action-btn outline"
              onClick={() => {
                setSelectedStaff(null);
                setMonthlySalary("");
                setOtRate("200");
                setIsEditing(false);
              }}
            >
              <span className="btn-icon">🔄</span>
              <span>Clear Form</span>
            </button>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-navigation">
        <button 
          className={`nav-btn ${isActiveRoute('/admin') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/salary')}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-label">Salary</span>
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/advances') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/advances')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Advances</span>
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/ot-approvals') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/ot-approvals')}
        >
          <span className="nav-icon">🕒</span>
          <span className="nav-label">Adjustments</span>
        </button>
        
        <button 
          className={`nav-btn ${isActiveRoute('/admin/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Availability</span>
        </button>
        
        <button className="nav-btn logout" onClick={onLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </div>
  );
}