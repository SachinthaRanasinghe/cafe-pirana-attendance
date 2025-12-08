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
import SalaryCard from "./SalaryCard";
import { getLocalMonth } from "../../utils/dateHelpers";
import { validateSalary, validateNumericInput, safeParseFloat } from "../../utils/validationHelpers";

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
  const [selectedMonth, setSelectedMonth] = useState(getLocalMonth());

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

  // Check if selected month is current month
  const isCurrentMonth = () => {
    const currentMonth = getLocalMonth();
    return selectedMonth === currentMonth;
  };

  // Check if selected month is finalized (not current month)
  const isMonthFinalized = () => {
    return !isCurrentMonth();
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
  useEffect(() => {
    const calculateAllStaffDaysOff = async () => {
      if (!staffMembers.length) return;
      
      if (!isFirstDayOfMonth()) {
        setStaffDaysOff({});
        return;
      }
      
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = previousMonth.getFullYear();
      const month = previousMonth.getMonth() + 1;
      const monthString = `${year}-${month.toString().padStart(2, '0')}`;
      
      const daysOffData = {};
      
      for (const staff of staffMembers) {
        try {
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
    // Use improved validation
    const salaryValidation = validateSalary(monthlySalary);
    if (!salaryValidation.valid) {
      alert(salaryValidation.error);
      return;
    }

    // Validate OT rate
    const otRateValidation = validateNumericInput(otRate || 200, {
      min: 0,
      allowZero: false,
      allowNegative: false,
      fieldName: 'OT Rate'
    });
    
    if (!otRateValidation.valid) {
      alert(otRateValidation.error);
      return;
    }

    setLoading(true);
    try {
      const salaryData = {
        staffUid: staff.staffUid,
        staffName: staff.staffName,
        staffId: staff.staffId,
        monthlySalary: safeParseFloat(monthlySalary, 0),
        hourlyRate: safeParseFloat(monthlySalary, 0) / (26 * 8),
        otRate: safeParseFloat(otRate, 200),
        updatedAt: new Date().toISOString(),
        createdAt: salaries[staff.staffUid]?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, "salaries", staff.staffUid), salaryData);
      
      if (useCustomDayOff) {
        await saveStaffDayOffConfig(staff.staffUid, {
          maxDaysOff: parseInt(customDayOffConfig.maxDaysOff) || 4,
          deductionPerDay: parseFloat(customDayOffConfig.deductionPerDay) || 500,
          bonusPerDay: parseFloat(customDayOffConfig.bonusPerDay) || 300,
          staffName: staff.staffName,
          staffId: staff.staffId
        });
      } else {
        await deleteStaffDayOffConfig(staff.staffUid);
      }
      
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
  const getTotalAdjustments = (staffUid, month = selectedMonth) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    const monthData = adjustmentRequests[staffUid][month] || { totalOTAmount: 0, totalShortAmount: 0 };
    
    return monthData.totalOTAmount - monthData.totalShortAmount;
  };

  // Calculate total OT for a staff member
  const getTotalOT = (staffUid, month = selectedMonth) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    return adjustmentRequests[staffUid][month]?.totalOTAmount || 0;
  };

  // Calculate total Short Time for a staff member
  const getTotalShort = (staffUid, month = selectedMonth) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    return adjustmentRequests[staffUid][month]?.totalShortAmount || 0;
  };

  // Calculate total OT hours for a staff member
  const getTotalOTHours = (staffUid, month = selectedMonth) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    return adjustmentRequests[staffUid][month]?.totalOTHours || 0;
  };

  // Calculate total Short Time hours for a staff member
  const getTotalShortHours = (staffUid, month = selectedMonth) => {
    if (!adjustmentRequests[staffUid]) return 0;
    
    return adjustmentRequests[staffUid][month]?.totalShortHours || 0;
  };

  // Calculate total advances for a staff member
  const getTotalAdvances = (staffUid, month = selectedMonth) => {
    if (!approvedAdvances[staffUid]) return 0;
    
    return approvedAdvances[staffUid][month] || 0;
  };

  // Calculate day-off deduction/bonus using staff-specific config
  // Now accepts month parameter to get historical day-off data
  const getDayOffAdjustment = async (staffUid, month = selectedMonth) => {
    // For current month, return 0 (day-off not calculated yet)
    const currentMonth = getLocalMonth();
    if (month === currentMonth) {
      return 0;
    }
    
    // For historical months, calculate day-off adjustment
    try {
      const daysOff = await calculateMonthlyDaysOff(staffUid, month, false);
      const config = staffDayOffConfigs[staffUid] || dayOffConfig;
      const { maxDaysOff, deductionPerDay, bonusPerDay } = config;
      
      if (daysOff > maxDaysOff) {
        const excessDays = daysOff - maxDaysOff;
        return -Math.abs(excessDays * deductionPerDay);
      } else if (daysOff < maxDaysOff) {
        const bonusDays = maxDaysOff - daysOff;
        return bonusDays * bonusPerDay;
      }
      
      return 0;
    } catch (error) {
      console.error('Error calculating day-off adjustment:', error);
      return 0;
    }
  };

  // Calculate net salary
  const calculateNetSalary = async (staffUid, monthlySalary, month = selectedMonth) => {
    const advances = getTotalAdvances(staffUid, month);
    const adjustments = getTotalAdjustments(staffUid, month);
    const dayOffAdjustment = await getDayOffAdjustment(staffUid, month);
    
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
    
    Object.keys(salaries).forEach(staffUid => {
      const advances = getTotalAdvances(staffUid, selectedMonth);
      const ot = getTotalOT(staffUid, selectedMonth);
      const short = getTotalShort(staffUid, selectedMonth);
      
      totalAdvances += advances;
      totalOT += ot;
      totalShort += short;
    });
    
    return { 
      totalStaff, 
      staffWithSalary, 
      totalMonthlySalary, 
      totalAdvances,
      totalOT,
      totalShort,
      totalNetSalary: 0, // Will be calculated async in the view
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
    // Use improved validation
    const validation = validateNumericInput(serviceChargeInput, {
      min: 0,
      allowZero: true,
      allowNegative: false,
      fieldName: 'Service Charge'
    });
    
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const amount = validation.value;
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
            <div className="brand-logo">
              <div className="logo-icon">💰</div>
              <div className="logo-glow"></div>
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Salary Management</h1>
              <span className="brand-subtitle">Cafe Piranha</span>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="live-status">
              <div className="status-pulse"></div>
              <span className="status-text">Live</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{stats.staffWithSalary}/{stats.totalStaff}</div>
            <div className="stat-label">Salaries Set</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-value">{formatCurrency(stats.totalNetSalary)}</div>
            <div className="stat-label">Net Payroll</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-main">
        {/* Month Selection Section */}
        <section className="month-selection-section">
          <div className="month-selector-card">
            <div className="month-selector-header">
              <div className="selector-icon">📅</div>
              <div className="selector-content">
                <h3 className="selector-title">View Salaries for</h3>
                <p className="selector-subtitle">
                  {isCurrentMonth() ? '🟢 CURRENT MONTH - RUNNING TOTALS' : '✅ FINALIZED SALARY'}
                </p>
              </div>
            </div>
            <div className="month-input-wrapper">
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                max={getLocalMonth()}
                className="month-input"
              />
            </div>
          </div>
        </section>

        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-card">
            <div className="hero-content">
              <div className="hero-badge">
                <span className="badge-icon">✨</span>
                <span>Professional Payroll</span>
              </div>
              <h1 className="hero-title">
                Salary Management - {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h1>
              <p className="hero-subtitle">
                Set and manage staff salaries with custom OT rates and day-off policies
              </p>
              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="stat-number">{stats.totalStaff}</span>
                  <span className="stat-label">Total Staff</span>
                </div>
                <div className="hero-stat">
                  <span className="stat-number">{stats.staffWithSalary}</span>
                  <span className="stat-label">With Salary</span>
                </div>
                <div className="hero-stat">
                  <span className="stat-number">{formatCurrency(stats.totalMonthlySalary)}</span>
                  <span className="stat-label">Base Payroll</span>
                </div>
              </div>
            </div>
            <div className="hero-graphic">
              <div className="graphic-container">
                <div className="money-stack">💰</div>
                <div className="chart-line"></div>
                <div className="chart-bar"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Metrics */}
        <section className="metrics-section">
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-container">
                <div className="metric-icon total-staff">👥</div>
                <div className="metric-glow"></div>
              </div>
              <div className="metric-content">
                <h3 className="metric-value">{stats.totalStaff}</h3>
                <p className="metric-label">Total Staff</p>
                <div className="metric-progress">
                  <div 
                    className="progress-bar" 
                    style={{width: `${(stats.staffWithSalary / stats.totalStaff) * 100}%`}}
                  ></div>
                </div>
                <span className="metric-subtext">
                  {stats.staffWithSalary} with salary set
                </span>
              </div>
            </div>
            
            <div className="metric-card highlight">
              <div className="metric-icon-container">
                <div className="metric-icon service-charge">💡</div>
                <div className="metric-glow"></div>
              </div>
              <div className="metric-content">
                <h3 className="metric-value">{formatCurrency(serviceCharge || 0)}</h3>
                <p className="metric-label">Service Charge</p>
                <span className="metric-badge reference">Reference</span>
                <span className="metric-subtext">Not included in net salary</span>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon-container">
                <div className="metric-icon payroll">📊</div>
                <div className="metric-glow"></div>
              </div>
              <div className="metric-content">
                <h3 className="metric-value">{formatCurrency(stats.totalMonthlySalary)}</h3>
                <p className="metric-label">Base Payroll</p>
                <span className="metric-subtext">
                  {formatCurrency(stats.totalMonthlySalary / stats.staffWithSalary || 0)} avg
                </span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-container">
                <div className="metric-icon adjustments">⚖️</div>
                <div className="metric-glow"></div>
              </div>
              <div className="metric-content">
                <h3 className="metric-value">{formatCurrency(stats.netAdjustments)}</h3>
                <p className="metric-label">Net Adjustments</p>
                <div className="adjustment-breakdown">
                  <span className="adjustment-positive">+{formatCurrency(stats.totalOT)}</span>
                  <span className="adjustment-negative">-{formatCurrency(stats.totalShort)}</span>
                </div>
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

        {/* Month Status Notice */}
        <section className="notice-section">
          {isCurrentMonth() ? (
            <div className="notice-card warning">
              <div className="notice-icon">🟡</div>
              <div className="notice-content">
                <h3 className="notice-title">🟢 RUNNING TOTAL - NOT FINAL</h3>
                <p className="notice-message">
                  Viewing <strong>current month</strong> data. Day-off adjustments will be calculated on the 1st of next month.
                  OT, Short-Time, and Advances shown are running totals for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
                </p>
              </div>
            </div>
          ) : (
            <div className="notice-card success">
              <div className="notice-icon">✅</div>
              <div className="notice-content">
                <h3 className="notice-title">✅ FINALIZED SALARY</h3>
                <p className="notice-message">
                  Viewing <strong>historical month</strong> data for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
                  All adjustments including day-off calculations are finalized.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Day-Off Configuration */}
        <section className="config-section">
          <div className="config-card">
            <div className="config-header">
              <div className="config-title">
                <span className="config-icon">⚙️</span>
                <h3>Day-Off Policy</h3>
              </div>
              <button 
                className="btn-ghost"
                onClick={() => setShowDayOffConfig(!showDayOffConfig)}
              >
                <span className="btn-icon">{showDayOffConfig ? "▼" : "▶"}</span>
                <span>{showDayOffConfig ? "Hide" : "Configure"}</span>
              </button>
            </div>
            
            {showDayOffConfig && (
              <div className="config-content">
                <div className="config-info">
                  <p>Configure default day-off policy for all staff:</p>
                </div>
                
                <div className="config-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Max Days Off</label>
                      <input
                        type="number"
                        value={dayOffConfig.maxDaysOff}
                        onChange={(e) => setDayOffConfig({ ...dayOffConfig, maxDaysOff: parseInt(e.target.value) || 4 })}
                        className="form-input"
                        min="0"
                        max="30"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Deduction/Day</label>
                      <input
                        type="number"
                        value={dayOffConfig.deductionPerDay}
                        onChange={(e) => setDayOffConfig({ ...dayOffConfig, deductionPerDay: parseFloat(e.target.value) || 500 })}
                        className="form-input"
                        min="0"
                        step="50"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Bonus/Day</label>
                      <input
                        type="number"
                        value={dayOffConfig.bonusPerDay}
                        onChange={(e) => setDayOffConfig({ ...dayOffConfig, bonusPerDay: parseFloat(e.target.value) || 300 })}
                        className="form-input"
                        min="0"
                        step="50"
                      />
                    </div>
                  </div>
                  
                  <button 
                    className={`btn-primary ${savingConfig ? 'loading' : ''}`}
                    onClick={handleSaveDayOffConfig}
                    disabled={savingConfig}
                  >
                    {savingConfig ? (
                      <>
                        <div className="spinner"></div>
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
                  <h2>{isEditing ? "Edit Salary" : "Set Salary"}</h2>
                  <div className="section-badge pending">
                    {staffMembers.length - Object.keys(salaries).length} pending
                  </div>
                </div>

                <div className="setup-form">
                  <div className="form-group">
                    <label className="form-label">Select Staff Member</label>
                    
                    {staffLoading ? (
                      <div className="loading-state">
                        <div className="spinner"></div>
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
                        <label className="form-label">Overtime Rate (Rs./hour)</label>
                        <input
                          type="number"
                          value={otRate}
                          onChange={(e) => setOtRate(e.target.value)}
                          placeholder="Enter OT rate per hour"
                          className="form-input"
                          min="0"
                          step="10"
                        />
                        <div className="form-help">Default rate: Rs. 200/hour</div>
                      </div>

                      {/* Custom Day-Off Configuration */}
                      <div className="form-group">
                        <div className="custom-config-toggle">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={useCustomDayOff}
                              onChange={(e) => setUseCustomDayOff(e.target.checked)}
                              className="form-checkbox"
                            />
                            <span className="checkbox-custom"></span>
                            <span className="checkbox-text">
                              <span className="checkbox-icon">📅</span>
                              Use Custom Day-Off Policy
                            </span>
                          </label>
                        </div>

                        {useCustomDayOff && (
                          <div className="custom-dayoff-config">
                            <div className="config-header">
                              <h4>Custom Day-Off Policy</h4>
                            </div>
                            
                            <div className="form-row">
                              <div className="form-group">
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
                              </div>

                              <div className="form-group">
                                <label className="form-label-small">Deduction Rate</label>
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
                              </div>

                              <div className="form-group">
                                <label className="form-label-small">Bonus Rate</label>
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
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {monthlySalary && (
                        <div className="breakdown-card">
                          <div className="breakdown-header">
                            <h4>Salary Breakdown</h4>
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
                            <div className="spinner"></div>
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
                    </div>

                    <button
                      className={`btn-primary ${serviceChargeSaving ? "loading" : ""}`}
                      onClick={handleSaveServiceCharge}
                      disabled={serviceChargeSaving}
                    >
                      {serviceChargeSaving ? (
                        <>
                          <div className="spinner"></div>
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
                    {filteredSalaries.map(salary => (
                      <SalaryCard
                        key={salary.staffUid}
                        salary={salary}
                        getTotalOT={getTotalOT}
                        getTotalShort={getTotalShort}
                        getTotalAdvances={getTotalAdvances}
                        getDayOffAdjustment={getDayOffAdjustment}
                        getTotalOTHours={getTotalOTHours}
                        getTotalShortHours={getTotalShortHours}
                        formatCurrency={formatCurrency}
                        handleEditSalary={handleEditSalary}
                        selectedMonth={selectedMonth}
                        isCurrentMonth={isCurrentMonth}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
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
        
        <button className="nav-btn logout" onClick={onLogout}>
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </div>
  );
}
