// Salary Card Component - Handles async day-off calculations
import { useState, useEffect } from 'react';
import { calculateNetSalaryWithWarning } from '../../utils/validationHelpers';

export default function SalaryCard({ 
  salary, 
  getTotalOT, 
  getTotalShort, 
  getTotalAdvances, 
  getDayOffAdjustment, 
  getTotalOTHours, 
  getTotalShortHours, 
  formatCurrency,
  handleEditSalary,
  selectedMonth,
  isCurrentMonth
}) {
  const [dayOffAdjustment, setDayOffAdjustment] = useState(0);
  const [netSalary, setNetSalary] = useState(0);
  const [loading, setLoading] = useState(true);
  const [salaryWarning, setSalaryWarning] = useState(null);

  useEffect(() => {
    const calculateSalary = async () => {
      setLoading(true);
      try {
        const adjustment = await getDayOffAdjustment(salary.staffUid, selectedMonth);
        setDayOffAdjustment(adjustment);
        
        const advances = getTotalAdvances(salary.staffUid, selectedMonth);
        const otAmount = getTotalOT(salary.staffUid, selectedMonth);
        const shortAmount = getTotalShort(salary.staffUid, selectedMonth);
        
        // Use validation helper to calculate and detect negative salary
        const salaryResult = calculateNetSalaryWithWarning(
          salary.monthlySalary,
          otAmount - shortAmount,
          -adjustment, // adjustment is positive for bonus, negative for deduction
          advances
        );
        
        setNetSalary(Math.max(0, salaryResult.netSalary));
        setSalaryWarning(salaryResult.warning);
      } catch (error) {
        console.error('Error calculating salary:', error);
        setDayOffAdjustment(0);
        setNetSalary(0);
      } finally {
        setLoading(false);
      }
    };

    calculateSalary();
  }, [salary.staffUid, selectedMonth, salary.monthlySalary]);

  const advances = getTotalAdvances(salary.staffUid, selectedMonth);
  const otAmount = getTotalOT(salary.staffUid, selectedMonth);
  const shortAmount = getTotalShort(salary.staffUid, selectedMonth);
  const otHours = getTotalOTHours(salary.staffUid, selectedMonth);
  const shortHours = getTotalShortHours(salary.staffUid, selectedMonth);

  // Inline Styles using your design system
  const styles = {
    // Design System Variables
    variables: {
      primary: '#2563eb',
      primaryDark: '#1d4ed8',
      secondary: '#7c3aed',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      background: '#0f172a',
      surface: '#1e293b',
      surfaceLight: '#334155',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: 'rgba(148, 163, 184, 0.2)',
      shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
      shadowSm: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
      radius: '16px',
      radiusSm: '12px',
      radiusLg: '20px',
      gradientPrimary: 'linear-gradient(135deg, #2563eb, #7c3aed)',
      gradientSuccess: 'linear-gradient(135deg, #10b981, #059669)',
    },

    // Main Card Container
    salaryItem: {
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(100, 116, 139, 0.2)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      marginBottom: '16px',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(10px)',
      position: 'relative',
      overflow: 'hidden',
    },

    salaryItemHover: {
      transform: 'translateY(-2px)',
      borderColor: 'rgba(59, 130, 246, 0.4)',
      boxShadow: 'var(--shadow-sm)',
    },

    // Header Section
    salaryHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '16px',
      background: 'rgba(30, 41, 59, 0.8)',
      borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
      margin: '-20px -20px 20px -20px',
    },

    staffProfile: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },

    staffAvatar: {
      width: '48px',
      height: '48px',
      background: 'var(--gradient-primary)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '600',
      color: 'white',
      fontSize: '1.1rem',
    },

    staffDetails: {
      flex: '1',
    },

    staffName: {
      fontSize: '1rem',
      fontWeight: '600',
      color: 'var(--text-primary)',
      marginBottom: '2px',
    },

    staffId: {
      fontSize: '0.8rem',
      color: 'var(--text-muted)',
    },

    salaryDisplay: {
      textAlign: 'right',
    },

    baseSalary: {
      fontSize: '1.2rem',
      fontWeight: '700',
      color: 'var(--text-primary)',
      marginBottom: '2px',
    },

    salaryPeriod: {
      fontSize: '0.75rem',
      color: 'var(--text-muted)',
    },

    // Edit Button
    editButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      background: 'rgba(100, 116, 139, 0.1)',
      border: '1px solid rgba(100, 116, 139, 0.3)',
      borderRadius: 'var(--radius-sm)',
      color: 'var(--text-muted)',
      fontSize: '0.8rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    },

    editButtonHover: {
      background: 'rgba(100, 116, 139, 0.2)',
      color: 'var(--text-primary)',
      transform: 'translateY(-1px)',
    },

    // Summary Section
    salarySummary: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },

    summaryItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid rgba(100, 116, 139, 0.1)',
    },

    summaryItemTotal: {
      borderTop: '2px solid rgba(100, 116, 139, 0.2)',
      paddingTop: '12px',
      marginTop: '4px',
    },

    summaryLabel: {
      fontSize: '0.85rem',
      color: 'var(--text-secondary)',
    },

    summaryValue: {
      fontSize: '0.9rem',
      fontWeight: '600',
      color: 'var(--text-primary)',
    },

    positiveValue: {
      color: 'var(--success)',
    },

    negativeValue: {
      color: 'var(--error)',
    },

    warningValue: {
      color: 'var(--warning)',
    },

    totalValue: {
      fontSize: '1.1rem',
      color: 'var(--text-primary)',
    },

    highlightValue: {
      fontWeight: '700',
      fontSize: '1.15rem',
    },

    // Loading State
    loadingShimmer: {
      display: 'inline-block',
      width: '60px',
      height: '16px',
      background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.2), rgba(148, 163, 184, 0.4), rgba(148, 163, 184, 0.2))',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '4px',
    },

    // Card Actions
    cardActions: {
      padding: '12px 16px',
      background: 'rgba(30, 41, 59, 0.8)',
      borderTop: '1px solid rgba(100, 116, 139, 0.2)',
      margin: '20px -20px -20px -20px',
    },
  };

  // Dynamic style functions
  const getSummaryItemStyle = (type) => {
    const baseStyle = { ...styles.summaryItem };
    if (type === 'total') {
      Object.assign(baseStyle, styles.summaryItemTotal);
    }
    return baseStyle;
  };

  const getValueStyle = (type, isHighlight = false) => {
    const baseStyle = { ...styles.summaryValue };
    if (isHighlight) {
      Object.assign(baseStyle, styles.highlightValue);
    }
    
    switch (type) {
      case 'positive':
        return { ...baseStyle, ...styles.positiveValue };
      case 'negative':
        return { ...baseStyle, ...styles.negativeValue };
      case 'warning':
        return { ...baseStyle, ...styles.warningValue };
      case 'total':
        return { ...baseStyle, ...styles.totalValue };
      default:
        return baseStyle;
    }
  };

  return (
    <div 
      style={styles.salaryItem}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, styles.salaryItemHover);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = styles.variables.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Add CSS variables */}
      <style>
        {`
          :root {
            --primary: ${styles.variables.primary};
            --primary-dark: ${styles.variables.primaryDark};
            --secondary: ${styles.variables.secondary};
            --success: ${styles.variables.success};
            --warning: ${styles.variables.warning};
            --error: ${styles.variables.error};
            --background: ${styles.variables.background};
            --surface: ${styles.variables.surface};
            --surface-light: ${styles.variables.surfaceLight};
            --text-primary: ${styles.variables.textPrimary};
            --text-secondary: ${styles.variables.textSecondary};
            --text-muted: ${styles.variables.textMuted};
            --border: ${styles.variables.border};
            --shadow: ${styles.variables.shadow};
            --shadow-sm: ${styles.variables.shadowSm};
            --radius: ${styles.variables.radius};
            --radius-sm: ${styles.variables.radiusSm};
            --radius-lg: ${styles.variables.radiusLg};
            --gradient-primary: ${styles.variables.gradientPrimary};
            --gradient-success: ${styles.variables.gradientSuccess};
          }
          
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}
      </style>

      <div style={styles.salaryHeader}>
        <div style={styles.staffProfile}>
          <div style={styles.staffAvatar}>
            {salary.staffName?.charAt(0).toUpperCase()}
          </div>
          <div style={styles.staffDetails}>
            <div style={styles.staffName}>{salary.staffName}</div>
            <div style={styles.staffId}>ID: {salary.staffId}</div>
          </div>
        </div>
        <div style={styles.salaryDisplay}>
          <div style={styles.baseSalary}>{formatCurrency(salary.monthlySalary)}</div>
          <div style={styles.salaryPeriod}>Base Salary</div>
        </div>
      </div>

      <div style={styles.salarySummary}>
        <div style={getSummaryItemStyle()}>
          <span style={styles.summaryLabel}>Base Salary</span>
          <span style={getValueStyle()}>{formatCurrency(salary.monthlySalary)}</span>
        </div>

        {otAmount > 0 && (
          <div style={getSummaryItemStyle()}>
            <span style={styles.summaryLabel}>
              Overtime ({otHours.toFixed(1)}h)
            </span>
            <span style={getValueStyle('positive')}>+{formatCurrency(otAmount)}</span>
          </div>
        )}

        {shortAmount > 0 && (
          <div style={getSummaryItemStyle()}>
            <span style={styles.summaryLabel}>
              Short Time ({shortHours.toFixed(1)}h)
            </span>
            <span style={getValueStyle('negative')}>-{formatCurrency(shortAmount)}</span>
          </div>
        )}

        {advances > 0 && (
          <div style={getSummaryItemStyle()}>
            <span style={styles.summaryLabel}>Advances</span>
            <span style={getValueStyle('negative')}>-{formatCurrency(advances)}</span>
          </div>
        )}

        {!isCurrentMonth() && dayOffAdjustment !== 0 && (
          <div style={getSummaryItemStyle()}>
            <span style={styles.summaryLabel}>
              Day-Off {dayOffAdjustment > 0 ? 'Bonus' : 'Deduction'}
            </span>
            <span style={getValueStyle(dayOffAdjustment > 0 ? 'positive' : 'negative')}>
              {dayOffAdjustment > 0 ? '+' : ''}{formatCurrency(dayOffAdjustment)}
            </span>
          </div>
        )}

        {isCurrentMonth() && (
          <div style={getSummaryItemStyle()}>
            <span style={styles.summaryLabel}>Day-Off Adjustment</span>
            <span style={getValueStyle('warning')}>Pending*</span>
          </div>
        )}

        <div style={getSummaryItemStyle('total')}>
          <span style={styles.summaryLabel}>
            {isCurrentMonth() ? 'Running Net' : 'Final Net'}
          </span>
          <span style={getValueStyle('total', true)}>
            {loading ? (
              <span style={styles.loadingShimmer}></span>
            ) : (
              formatCurrency(netSalary)
            )}
          </span>
        </div>
        
        {/* Warning for negative net salary */}
        {salaryWarning && (
          <div style={{
            padding: '12px',
            background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
            border: '2px solid #ffc107',
            borderRadius: '8px',
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: 'bold', 
                color: '#856404',
                marginBottom: '4px'
              }}>
                Negative Net Salary Warning
              </div>
              <div style={{ 
                fontSize: '13px', 
                color: '#856404'
              }}>
                Deductions exceed income. Please review salary components.
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.cardActions}>
        <button 
          style={styles.editButton}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, styles.editButtonHover);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = styles.editButton.background;
            e.currentTarget.style.borderColor = styles.editButton.borderColor;
            e.currentTarget.style.color = styles.editButton.color;
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          onClick={() => handleEditSalary({ 
            staffUid: salary.staffUid, 
            staffName: salary.staffName, 
            staffId: salary.staffId 
          })}
        >
          ✏️ Edit Salary
        </button>
      </div>
    </div>
  );
}