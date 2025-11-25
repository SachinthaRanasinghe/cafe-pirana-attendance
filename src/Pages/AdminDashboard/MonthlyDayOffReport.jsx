import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { calculatePreviousMonthDaysOffForAllStaff } from "../../config/dayOffRates";
import "./MonthlyDayOffReport.css";

export default function MonthlyDayOffReport({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [staffMembers, setStaffMembers] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFirstDayOfMonth, setIsFirstDayOfMonth] = useState(false);
  const [previousMonthName, setPreviousMonthName] = useState("");

  // Check if today is the 1st of the month
  useEffect(() => {
    const checkDate = () => {
      const today = new Date();
      const isFirst = today.getDate() === 1;
      setIsFirstDayOfMonth(isFirst);

      // Get previous month name
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const monthName = prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
      setPreviousMonthName(monthName);
    };

    checkDate();
    
    // Check every hour in case the day changes
    const interval = setInterval(checkDate, 3600000);
    return () => clearInterval(interval);
  }, []);

  // Fetch staff members
  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("staffName"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

    return () => unsubscribe();
  }, []);

  // Calculate report data when staff members change and it's the 1st
  useEffect(() => {
    const loadReportData = async () => {
      if (!isFirstDayOfMonth || staffMembers.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await calculatePreviousMonthDaysOffForAllStaff(staffMembers);
        setReportData(data);
      } catch (error) {
        console.error("Error loading report data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [staffMembers, isFirstDayOfMonth]);

  // Navigation helpers
  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  const handleLogout = () => {
    if (onLogout && typeof onLogout === "function") {
      onLogout();
    }
  };

  // Calculate summary statistics
  const getSummaryStats = () => {
    if (reportData.length === 0) return { totalBonus: 0, totalDeduction: 0, staffCount: 0 };

    let totalBonus = 0;
    let totalDeduction = 0;

    reportData.forEach(item => {
      if (item.adjustment > 0) {
        totalBonus += item.adjustment;
      } else if (item.adjustment < 0) {
        totalDeduction += Math.abs(item.adjustment);
      }
    });

    return {
      totalBonus,
      totalDeduction,
      staffCount: reportData.length
    };
  };

  const stats = getSummaryStats();

  // If not the 1st day of month, show message
  if (!isFirstDayOfMonth) {
    return (
      <div className="monthly-report-page">
        <header className="admin-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="page-title">📊 Monthly Day-Off Report</h1>
              <p className="page-subtitle">Previous month attendance summary</p>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </header>

        <main className="report-content">
          <div className="not-available-message">
            <div className="message-icon">📅</div>
            <h2>Report Not Available Today</h2>
            <p>The monthly day-off report is only available on the <strong>1st day of each month</strong>.</p>
            <p>Please check back on the 1st to view the previous month's attendance report.</p>
            <div className="next-report-info">
              <span className="info-icon">ℹ️</span>
              <span>Next report will be available on the 1st of next month</span>
            </div>
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          <button
            className={`nav-item ${isActiveRoute('/admin') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin')}
          >
            <span className="nav-icon">🏠</span>
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
            className={`nav-item ${isActiveRoute('/admin/accounts') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin/accounts')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Accounts</span>
          </button>

          <button
            className={`nav-item ${isActiveRoute('/admin/dayoff-report') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin/dayoff-report')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Day-Off Report</span>
          </button>

          <button
            className={`nav-item ${isActiveRoute('/admin/availability') ? 'active' : ''}`}
            onClick={() => safeNavigate('/admin/availability')}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-label">Availability</span>
          </button>
        </nav>
      </div>
    );
  }

  // Show report on 1st day of month
  return (
    <div className="monthly-report-page">
      <header className="admin-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="page-title">📊 Monthly Day-Off Report</h1>
            <p className="page-subtitle">{previousMonthName} Attendance Summary</p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </header>

      <main className="report-content">
        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card bonus-card">
            <div className="card-icon">💰</div>
            <div className="card-content">
              <h3>Total Bonuses</h3>
              <p className="card-amount">Rs. {stats.totalBonus.toLocaleString()}</p>
              <span className="card-label">Earned by staff</span>
            </div>
          </div>

          <div className="summary-card deduction-card">
            <div className="card-icon">⚠️</div>
            <div className="card-content">
              <h3>Total Deductions</h3>
              <p className="card-amount">Rs. {stats.totalDeduction.toLocaleString()}</p>
              <span className="card-label">Applied to salaries</span>
            </div>
          </div>

          <div className="summary-card staff-card">
            <div className="card-icon">👥</div>
            <div className="card-content">
              <h3>Staff Count</h3>
              <p className="card-amount">{stats.staffCount}</p>
              <span className="card-label">Total staff reviewed</span>
            </div>
          </div>
        </div>

        {/* Report Table */}
        <div className="report-table-section">
          <div className="section-header">
            <h2>Detailed Breakdown</h2>
            <div className="report-info">
              <span className="info-icon">ℹ️</span>
              <span>Report for {previousMonthName}</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Calculating day-off adjustments...</p>
            </div>
          ) : reportData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No staff data available for this month</p>
            </div>
          ) : (
            <div className="report-table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Staff ID</th>
                    <th>Staff Name</th>
                    <th>Days Off</th>
                    <th>Threshold</th>
                    <th>Policy</th>
                    <th>Adjustment</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item) => (
                    <tr key={item.staffUid}>
                      <td className="staff-id">{item.staffId}</td>
                      <td className="staff-name">
                        {item.staffName}
                        {item.isCustom && (
                          <span className="custom-badge" title="Custom policy">⚙️</span>
                        )}
                      </td>
                      <td className="days-off">
                        <span className={`days-badge ${
                          item.daysOff > item.threshold ? 'over' :
                          item.daysOff < item.threshold ? 'under' : 'exact'
                        }`}>
                          {item.daysOff} days
                        </span>
                      </td>
                      <td className="threshold">{item.threshold} days</td>
                      <td className="policy-type">
                        {item.isCustom ? (
                          <div className="policy-details">
                            <span className="policy-label">Custom</span>
                            <span className="policy-rates">
                              -Rs.{item.deductionPerDay} / +Rs.{item.bonusPerDay}
                            </span>
                          </div>
                        ) : (
                          <span className="policy-label">Default</span>
                        )}
                      </td>
                      <td className={`adjustment ${item.adjustment > 0 ? 'positive' : item.adjustment < 0 ? 'negative' : 'neutral'}`}>
                        {item.adjustment > 0 ? '+' : ''}Rs. {item.adjustment.toLocaleString()}
                      </td>
                      <td className="status">
                        {item.status === 'bonus' && (
                          <span className="status-badge bonus">✅ Bonus</span>
                        )}
                        {item.status === 'deduction' && (
                          <span className="status-badge deduction">⚠️ Deduction</span>
                        )}
                        {item.status === 'at-threshold' && (
                          <span className="status-badge neutral">⚖️ On Track</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Important Notes */}
        <div className="report-notes">
          <h3>📌 Important Notes</h3>
          <ul>
            <li>This report shows the previous month's ({previousMonthName}) day-off calculations</li>
            <li>Adjustments are automatically applied to staff salaries</li>
            <li>Staff with custom policies have individual thresholds and rates</li>
            <li>This report is only available on the 1st day of each month</li>
            <li>Data is calculated from archived weekly availability records</li>
          </ul>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${isActiveRoute('/admin') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin')}
        >
          <span className="nav-icon">🏠</span>
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
          className={`nav-item ${isActiveRoute('/admin/accounts') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/accounts')}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">Accounts</span>
        </button>

        <button
          className={`nav-item ${isActiveRoute('/admin/dayoff-report') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/dayoff-report')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Day-Off Report</span>
        </button>

        <button
          className={`nav-item ${isActiveRoute('/admin/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Availability</span>
        </button>
      </nav>
    </div>
  );
}
