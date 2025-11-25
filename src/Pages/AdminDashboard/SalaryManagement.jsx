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
import { getDayOffRates, saveDayOffRates, calculateMonthlyDaysOff, getEffectiveDayOffConfig, saveStaffDayOffConfig, deleteStaffDayOffConfig, isFirstDayOfMonth } from "../../config/dayOffRates";

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
  const [dayOffRates, setDayOffRates] = useState(null);
  const [dayOffConfig, setDayOffConfig] = useState({ maxDaysOff: 4, deductionPerDay: 500, bonusPerDay: 300 });
  const [staffDaysOff, setStaffDaysOff] = useState({});
  const [showDayOffConfig, setShowDayOffConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [staffDayOffConfigs, setStaffDayOffConfigs] = useState({});
  const [customDayOffConfig, setCustomDayOffConfig] = useState({ maxDaysOff: 4, deductionPerDay: 500, bonusPerDay: 300 });
  const [useCustomDayOff, setUseCustomDayOff] = useState(false);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [serviceChargeInput, setServiceChargeInput] = useState("");
  const [serviceChargeSaving, setServiceChargeSaving] = useState(false);
  const [serviceChargeUpdatedAt, setServiceChargeUpdatedAt] = useState(null);

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

  // Fetch day-off configuration
  useEffect(() => {
    const fetchDayOffRates = async () => {
      try {
        const rates = await getDayOffRates();
        setDayOffRates(rates);
        setDayOffConfig({
          maxDaysOff: rates.maxDaysOff || 4,
          deductionPerDay: rates.deductionPerDay || 500,
          bonusPerDay: rates.bonusPerDay || 300
        });
      } catch (error) {
        console.error("Error fetching day-off rates:", error);
      }
    };
    fetchDayOffRates();
  }, []);

  // Fetch service charge configuration
  useEffect(() => {
    const serviceChargeRef = doc(db, "systemConfig", "serviceCharge");
    const unsubscribe = onSnapshot(
      serviceChargeRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const amount = data.amount ?? 0;
          setServiceCharge(amount);
          setServiceChargeInput(amount?.toString() || "");
          setServiceChargeUpdatedAt(data.updatedAt || null);
        } else {
          setServiceCharge(0);
          setServiceChargeInput("");
          setServiceChargeUpdatedAt(null);
        }
      },
      (error) => {
        console.error("Error fetching service charge:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Load staff-specific day-off configurations
  useEffect(() => {
    const loadStaffDayOffConfigs = async () => {
      if (!staffMembers.length) return;
      
      const configs = {};
      
      for (const staff of staffMembers) {
        try {
          const config = await getEffectiveDayOffConfig(staff.staffUid);
          configs[staff.staffUid] = config;
        } catch (error) {
          console.error(`Error loading day-off config for ${staff.staffName}:`, error);
          configs[staff.staffUid] = {
            maxDaysOff: 4,
            deductionPerDay: 500,
            bonusPerDay: 300,
            isCustom: false
          };
        }
      }
      
      setStaffDayOffConfigs(configs);
    };
    
    loadStaffDayOffConfigs();
  }, [staffMembers]);

  // Calculate monthly days off for all staff
  // Only calculated on 1st day of month for previous month
  useEffect(() => {
    const calculateAllStaffDaysOff = async () => {
      if (!staffMembers.length) return;
      
      // Only calculate on 1st day of month
      if (!isFirstDayOfMonth()) {
        // Not the 1st day - clear any day-off data
        setStaffDaysOff({});
        return;
      }
      
      // Calculate for PREVIOUS month only
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = previousMonth.getFullYear();
      const month = previousMonth.getMonth() + 1;
      const monthString = `${year}-${month.toString().padStart(2, '0')}`;
      
      const daysOffData = {};
      
      for (const staff of staffMembers) {
        try {
          // Use false to exclude current week data
          const daysOff = await calculateMonthlyDaysOff(staff.staffUid, monthString, false);
          daysOffData[staff.staffUid] = daysOff;
        } catch (error) {
          console.error(`Error calculating days off for ${staff.staffName}:`, error);
          daysOffData[staff.staffUid] = 0;
        }
      }
      
      setStaffDaysOff(daysOffData);
    };
    
    calculateAllStaffDaysOff();
  }, [staffMembers]);

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
      
      // Save staff-specific day-off configuration if custom is enabled
      if (useCustomDayOff) {
        await saveStaffDayOffConfig(staff.staffUid, {
          maxDaysOff: parseInt(customDayOffConfig.maxDaysOff) || 4,
          deductionPerDay: parseFloat(customDayOffConfig.deductionPerDay) || 500,
          bonusPerDay: parseFloat(customDayOffConfig.bonusPerDay) || 300,
          staffName: staff.staffName,
          staffId: staff.staffId
        });
      } else {
        // Revert to default if custom is disabled
        await deleteStaffDayOffConfig(staff.staffUid);
      }
      
      // Reload staff day-off configs
      const updatedConfig = await getEffectiveDayOffConfig(staff.staffUid);
      setStaffDayOffConfigs(prev => ({
        ...prev,
        [staff.staffUid]: updatedConfig
      }));
      
      alert(
        `${isEditing ? 'Updated' : 'Set'} salary for ${staff.staffName}: Rs. ${monthlySalary}/month\n` +
        `OT Rate: Rs. ${salaryData.otRate}/hour` +
        (useCustomDayOff ? '\nCustom day-off policy applied' : '')
      );
      setMonthlySalary("");
      setOtRate("");
      setSelectedStaff(null);
      setIsEditing(false);
      setUseCustomDayOff(false);
      setCustomDayOffConfig({ maxDaysOff: 4, deductionPerDay: 500, bonusPerDay: 300 });
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
      
      // Load staff-specific day-off config
      const staffConfig = staffDayOffConfigs[staff.staffUid];
      if (staffConfig && staffConfig.isCustom) {
        setUseCustomDayOff(true);
        setCustomDayOffConfig({
          maxDaysOff: staffConfig.maxDaysOff,
          deductionPerDay: staffConfig.deductionPerDay,
          bonusPerDay: staffConfig.bonusPerDay
        });
      } else {
        setUseCustomDayOff(false);
        setCustomDayOffConfig({
          maxDaysOff: dayOffConfig.maxDaysOff,
          deductionPerDay: dayOffConfig.deductionPerDay,
          bonusPerDay: dayOffConfig.bonusPerDay
        });
      }
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

  // Calculate day-off deduction/bonus using staff-specific config
  // Only calculated on 1st day of month for previous month
  const getDayOffAdjustment = (staffUid) => {
    // Only apply day-off adjustments on the 1st day of the month
    if (!isFirstDayOfMonth()) {
      return 0;
    }
    
    if (!staffDaysOff[staffUid] && staffDaysOff[staffUid] !== 0) return 0;
    
    const daysOff = staffDaysOff[staffUid];
    
    // Use staff-specific config if available, otherwise use global default
    const config = staffDayOffConfigs[staffUid] || dayOffConfig;
    const { maxDaysOff, deductionPerDay, bonusPerDay } = config;
    
    if (daysOff > maxDaysOff) {
      // Deduct for each day over the limit
      const excessDays = daysOff - maxDaysOff;
      return -Math.abs(excessDays * deductionPerDay);
    } else if (daysOff < maxDaysOff) {
      // Bonus for each day under the limit
      const bonusDays = maxDaysOff - daysOff;
      return bonusDays * bonusPerDay;
    }
    
    return 0;
  };

  // Calculate net salary (basic + OT - Short Time - advances - day-off deductions + day-off bonus)
  // Service charge is NOT included in net salary - shown as reference only
  const calculateNetSalary = (staffUid, monthlySalary) => {
    const advances = getTotalAdvances(staffUid);
    const adjustments = getTotalAdjustments(staffUid);
    const dayOffAdjustment = getDayOffAdjustment(staffUid);
    
    return Math.max(0, monthlySalary + adjustments + dayOffAdjustment - advances);
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

  // Handle saving day-off configuration
  const handleSaveDayOffConfig = async () => {
    setSavingConfig(true);
    try {
      const success = await saveDayOffRates(dayOffConfig);
      if (success) {
        const updatedRates = await getDayOffRates();
        setDayOffRates(updatedRates);
        setShowDayOffConfig(false);
        alert("Day-off configuration saved successfully!");
      } else {
        alert("Error saving configuration. Please try again.");
      }
    } catch (error) {
      console.error("Error saving day-off config:", error);
      alert("Error saving configuration: " + error.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveServiceCharge = async () => {
    if (serviceChargeInput === "") {
      alert("Please enter a service charge amount.");
      return;
    }

    const amount = parseFloat(serviceChargeInput);
    if (Number.isNaN(amount) || amount < 0) {
      alert("Please enter a valid service charge amount.");
      return;
    }

    setServiceChargeSaving(true);
    try {
      await setDoc(doc(db, "systemConfig", "serviceCharge"), {
        amount,
        updatedAt: new Date().toISOString(),
      });
      alert("Service charge updated successfully.");
    } catch (error) {
      console.error("Error saving service charge:", error);
      alert("Error saving service charge: " + error.message);
    } finally {
      setServiceChargeSaving(false);
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
            
            <div className="metric-card">
              <div className="metric-icon service-charge">💡</div>
              <div className="metric-content">
                <h3 className="metric-value">{formatCurrency(serviceCharge || 0)}</h3>
                <p className="metric-label">Service Charge</p>
                <span className="metric-subtext">Reference only - not in net salary</span>
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
            <button 
              className={`tab-btn ${activeTab === "serviceCharge" ? "active" : ""}`}
              onClick={() => setActiveTab("serviceCharge")}
            >
              <span className="tab-icon">💡</span>
              <span className="tab-text">Service Charge</span>
            </button>
          </div>
        </section>

        {/* Day-Off Calculation Notice */}
        {!isFirstDayOfMonth() && (
          <section className="dayoff-notice-section">
            <div className="notice-card info">
              <div className="notice-icon">📅</div>
              <div className="notice-content">
                <h3 className="notice-title">Day-Off Calculations</h3>
                <p className="notice-message">
                  Day-off bonuses and deductions are calculated and applied <strong>only on the 1st day of each month</strong> for the previous month's attendance.
                </p>
                <p className="notice-submessage">
                  Staff can see warnings during the month if they exceed their limits, but adjustments are not applied to salaries until the 1st.
                </p>
              </div>
            </div>
          </section>
        )}

        {isFirstDayOfMonth() && (
          <section className="dayoff-notice-section">
            <div className="notice-card success">
              <div className="notice-icon">✅</div>
              <div className="notice-content">
                <h3 className="notice-title">Day-Off Report Available</h3>
                <p className="notice-message">
                  Today is the 1st of the month. Day-off adjustments for last month are now calculated and applied to net salaries below.
                </p>
                <button 
                  className="view-report-btn"
                  onClick={() => safeNavigate('/admin/dayoff-report')}
                >
                  <span className="btn-icon">📊</span>
                  <span>View Full Day-Off Report</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Day-Off Configuration Section */}
        <section className="dayoff-config-section">
          <div className="config-card">
            <div className="config-header">
              <div className="config-title">
                <span className="config-icon">📅</span>
                <h3>Default Day-Off Policy Configuration</h3>
              </div>
              <button 
                className="btn-config-toggle"
                onClick={() => setShowDayOffConfig(!showDayOffConfig)}
              >
                <span className="btn-icon">{showDayOffConfig ? "▼" : "▶"}</span>
                <span>{showDayOffConfig ? "Hide" : "Configure"}</span>
              </button>
            </div>
            
            {showDayOffConfig && (
              <div className="config-content">
                <div className="config-info">
                  <p>Configure default deduction and bonus amounts for staff day-off policy:</p>
                  <ul>
                    <li>If staff takes <strong>more than {dayOffConfig.maxDaysOff} days off</strong> per month → Deduct salary</li>
                    <li>If staff takes <strong>less than {dayOffConfig.maxDaysOff} days off</strong> per month → Add bonus</li>
                    <li><strong>Note:</strong> Individual staff members can have custom policies set in the Setup tab</li>
                  </ul>
                </div>
                
                <div className="config-form">
                  <div className="form-group">
                    <label className="form-label">Maximum Days Off (Threshold)</label>
                    <input
                      type="number"
                      value={dayOffConfig.maxDaysOff}
                      onChange={(e) => setDayOffConfig({ ...dayOffConfig, maxDaysOff: parseInt(e.target.value) || 4 })}
                      className="form-input"
                      min="0"
                      max="30"
                    />
                    <span className="form-help">Days off above this threshold will trigger deduction</span>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Deduction Per Day (Rs.)</label>
                    <input
                      type="number"
                      value={dayOffConfig.deductionPerDay}
                      onChange={(e) => setDayOffConfig({ ...dayOffConfig, deductionPerDay: parseFloat(e.target.value) || 500 })}
                      className="form-input"
                      min="0"
                      step="50"
                    />
                    <span className="form-help">Amount deducted for each day over the threshold</span>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Bonus Per Day (Rs.)</label>
                    <input
                      type="number"
                      value={dayOffConfig.bonusPerDay}
                      onChange={(e) => setDayOffConfig({ ...dayOffConfig, bonusPerDay: parseFloat(e.target.value) || 300 })}
                      className="form-input"
                      min="0"
                      step="50"
                    />
                    <span className="form-help">Bonus amount for each day under the threshold</span>
                  </div>
                  
                  <button 
                    className={`btn-primary ${savingConfig ? 'loading' : ''}`}
                    onClick={handleSaveDayOffConfig}
                    disabled={savingConfig}
                  >
                    {savingConfig ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">💾</span>
                        <span>Save Configuration</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
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
                            
                            // Load staff-specific day-off config
                            const staffConfig = staffDayOffConfigs[staff.staffUid];
                            if (staffConfig && staffConfig.isCustom) {
                              setUseCustomDayOff(true);
                              setCustomDayOffConfig({
                                maxDaysOff: staffConfig.maxDaysOff,
                                deductionPerDay: staffConfig.deductionPerDay,
                                bonusPerDay: staffConfig.bonusPerDay
                              });
                            } else {
                              setUseCustomDayOff(false);
                              setCustomDayOffConfig({
                                maxDaysOff: dayOffConfig.maxDaysOff,
                                deductionPerDay: dayOffConfig.deductionPerDay,
                                bonusPerDay: dayOffConfig.bonusPerDay
                              });
                            }
                          } else {
                            setMonthlySalary("");
                            setOtRate("200");
                            setIsEditing(false);
                            setUseCustomDayOff(false);
                            setCustomDayOffConfig({ maxDaysOff: 4, deductionPerDay: 500, bonusPerDay: 300 });
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
                                {dayOffConfig && staffDaysOff[selectedStaff.staffUid] !== undefined && (
                                  <div className={`adjustment-item ${getDayOffAdjustment(selectedStaff.staffUid) > 0 ? 'positive' : getDayOffAdjustment(selectedStaff.staffUid) < 0 ? 'negative' : ''}`}>
                                    <span>
                                      Days Off: {staffDaysOff[selectedStaff.staffUid]} days
                                      {getDayOffAdjustment(selectedStaff.staffUid) !== 0 && (
                                        <span> ({getDayOffAdjustment(selectedStaff.staffUid) > 0 ? '+' : ''}{formatCurrency(getDayOffAdjustment(selectedStaff.staffUid))})</span>
                                      )}
                                    </span>
                                  </div>
                                )}
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

                      {/* Custom Day-Off Configuration */}
                      <div className="form-group">
                        <div className="custom-config-toggle">
                          <label className="form-label">
                            <input
                              type="checkbox"
                              checked={useCustomDayOff}
                              onChange={(e) => setUseCustomDayOff(e.target.checked)}
                              className="form-checkbox"
                            />
                            <span className="checkbox-label">
                              <span className="checkbox-icon">📅</span>
                              <span>Use Custom Day-Off Policy</span>
                            </span>
                          </label>
                          <span className="help-text">
                            {useCustomDayOff 
                              ? "Custom rates will apply to this staff member" 
                              : "Using global default policy"}
                          </span>
                        </div>

                        {useCustomDayOff && (
                          <div className="custom-dayoff-config">
                            <div className="config-info-box">
                              <span className="info-icon">ℹ️</span>
                              <p>Set individual day-off policy for {selectedStaff.staffName}</p>
                            </div>

                            <div className="form-row">
                              <div className="form-col">
                                <label className="form-label-small">Days Off Threshold</label>
                                <input
                                  type="number"
                                  value={customDayOffConfig.maxDaysOff}
                                  onChange={(e) => setCustomDayOffConfig({ 
                                    ...customDayOffConfig, 
                                    maxDaysOff: parseInt(e.target.value) || 4 
                                  })}
                                  className="form-input-small"
                                  min="0"
                                  max="30"
                                />
                                <span className="form-help-small">Days allowed</span>
                              </div>

                              <div className="form-col">
                                <label className="form-label-small">Deduction Rate (Rs./day)</label>
                                <input
                                  type="number"
                                  value={customDayOffConfig.deductionPerDay}
                                  onChange={(e) => setCustomDayOffConfig({ 
                                    ...customDayOffConfig, 
                                    deductionPerDay: parseFloat(e.target.value) || 500 
                                  })}
                                  className="form-input-small"
                                  min="0"
                                  step="50"
                                />
                                <span className="form-help-small">Per excess day</span>
                              </div>

                              <div className="form-col">
                                <label className="form-label-small">Bonus Rate (Rs./day)</label>
                                <input
                                  type="number"
                                  value={customDayOffConfig.bonusPerDay}
                                  onChange={(e) => setCustomDayOffConfig({ 
                                    ...customDayOffConfig, 
                                    bonusPerDay: parseFloat(e.target.value) || 300 
                                  })}
                                  className="form-input-small"
                                  min="0"
                                  step="50"
                                />
                                <span className="form-help-small">Per unused day</span>
                              </div>
                            </div>

                            <div className="policy-preview">
                              <strong>Policy Preview:</strong>
                              <ul>
                                <li>If {selectedStaff.staffName} takes <strong>more than {customDayOffConfig.maxDaysOff} days off</strong> → Deduct Rs. {customDayOffConfig.deductionPerDay} per extra day</li>
                                <li>If {selectedStaff.staffName} takes <strong>less than {customDayOffConfig.maxDaysOff} days off</strong> → Bonus Rs. {customDayOffConfig.bonusPerDay} per unused day</li>
                              </ul>
                            </div>
                          </div>
                        )}
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

          {/* Service Charge Tab */}
          {activeTab === "serviceCharge" && (
            <div className="tab-panel">
              <section className="content-section">
                <div className="section-header">
                  <h2>Service Charge</h2>
                  <div className="section-badge">
                    {serviceCharge !== null ? formatCurrency(serviceCharge) : "Not set"}
                  </div>
                </div>

                <div className="service-charge-card">
                  <div className="current-value">
                    <div className="value-label">Current Amount</div>
                    <div className="value-amount">
                      {formatCurrency(serviceCharge || 0)}
                    </div>
                    {serviceChargeUpdatedAt && (
                      <div className="value-updated">
                        Updated {new Date(serviceChargeUpdatedAt).toLocaleString()}
                      </div>
                    )}
                    <p className="value-note">
                      This amount is shared with every staff member and does not reset monthly.
                    </p>
                  </div>

                  <div className="service-charge-form">
                    <div className="form-group">
                      <label className="form-label">Update Service Charge (LKR)</label>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        step="100"
                        value={serviceChargeInput}
                        onChange={(e) => setServiceChargeInput(e.target.value)}
                      />
                      <span className="form-help">
                        Enter the total service charge amount per staff member.
                      </span>
                    </div>

                    <button
                      className={`btn-primary ${serviceChargeSaving ? "loading" : ""}`}
                      onClick={handleSaveServiceCharge}
                      disabled={serviceChargeSaving}
                    >
                      {serviceChargeSaving ? (
                        <>
                          <div className="loading-spinner-small"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <span className="btn-icon">💾</span>
                          <span>Save Service Charge</span>
                        </>
                      )}
                    </button>
                  </div>
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
                      const dayOffAdjustment = getDayOffAdjustment(salary.staffUid);
                      const daysOff = staffDaysOff[salary.staffUid] || 0;
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

                              {serviceCharge > 0 && (
                                <div className="summary-section reference-section">
                                  <div className="summary-item reference">
                                    <span className="summary-label">
                                      Service Charge
                                      <span className="reference-badge">Reference Only</span>
                                    </span>
                                    <span className="summary-value reference-value">{formatCurrency(serviceCharge)}</span>
                                  </div>
                                  <div className="reference-note">
                                    <span className="note-icon">ℹ️</span>
                                    <span>Not included in net salary</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Day-Off Adjustment */}
                              {dayOffAdjustment !== 0 && (
                                <div className="summary-section">
                                  <div className={`summary-item ${dayOffAdjustment > 0 ? 'positive' : 'negative'}`}>
                                    <span className="summary-label">
                                      Day-Off {dayOffAdjustment > 0 ? 'Bonus' : 'Deduction'}
                                    </span>
                                    <span className="summary-value">
                                      {dayOffAdjustment > 0 ? '+' : ''}{formatCurrency(dayOffAdjustment)}
                                    </span>
                                    <span className="summary-note">
                                      {daysOff} days off this month
                                      {dayOffConfig && (
                                        <>
                                          {daysOff > dayOffConfig.maxDaysOff && (
                                            <span> ({daysOff - dayOffConfig.maxDaysOff} over limit)</span>
                                          )}
                                          {daysOff < dayOffConfig.maxDaysOff && (
                                            <span> ({dayOffConfig.maxDaysOff - daysOff} under limit)</span>
                                          )}
                                        </>
                                      )}
                                    </span>
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
                            
                            {/* Day-Off Status */}
                            {dayOffConfig && (
                              <div className="dayoff-status">
                                <div className="status-header">
                                  <span className="status-label">
                                    Days Off This Month
                                    {staffDayOffConfigs[salary.staffUid]?.isCustom && (
                                      <span className="custom-policy-badge" title="Custom policy applied">⚙️</span>
                                    )}
                                  </span>
                                  <span className={`status-value ${daysOff > (staffDayOffConfigs[salary.staffUid]?.maxDaysOff || dayOffConfig.maxDaysOff) ? 'warning' : daysOff < (staffDayOffConfigs[salary.staffUid]?.maxDaysOff || dayOffConfig.maxDaysOff) ? 'success' : 'neutral'}`}>
                                    {daysOff} / {staffDayOffConfigs[salary.staffUid]?.maxDaysOff || dayOffConfig.maxDaysOff} limit
                                  </span>
                                </div>
                                {daysOff > dayOffConfig.maxDaysOff && (
                                  <div className="status-message warning">
                                    <span className="status-icon">⚠️</span>
                                    <span>Exceeded limit by {daysOff - dayOffConfig.maxDaysOff} day(s)</span>
                                  </div>
                                )}
                                {daysOff < dayOffConfig.maxDaysOff && (
                                  <div className="status-message success">
                                    <span className="status-icon">✅</span>
                                    <span>Under limit by {dayOffConfig.maxDaysOff - daysOff} day(s) - Bonus eligible</span>
                                  </div>
                                )}
                                {daysOff === dayOffConfig.maxDaysOff && (
                                  <div className="status-message neutral">
                                    <span className="status-icon">✓</span>
                                    <span>Exactly at limit - No adjustment</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
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
          className={`nav-btn ${isActiveRoute('/admin/accounts') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/accounts')}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">Accounts</span>
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