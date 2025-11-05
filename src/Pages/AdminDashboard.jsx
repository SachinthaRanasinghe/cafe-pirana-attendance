import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import "./AdminDashboard.css";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function AdminDashboard({ onLogout }) {
  const [allSessions, setAllSessions] = useState([]);
  const [activeStaff, setActiveStaff] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  // Real-time listener for all sessions
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('clockIn', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = [];
      const active = [];
      
      snapshot.forEach((doc) => {
        const session = { id: doc.id, ...doc.data() };
        sessions.push(session);
        
        // Check for active sessions (no clock out time)
        if (!session.clockOut) {
          active.push(session);
        }
      });
      
      setAllSessions(sessions);
      setActiveStaff(active);
    });

    return () => unsubscribe();
  }, []);

  const filteredSessions = allSessions.filter(session => 
    session.date === new Date(selectedDate).toDateString()
  );

  // Calculate staff summary
  const staffSummary = {};
  filteredSessions.forEach(session => {
    if (!staffSummary[session.staffId]) {
      staffSummary[session.staffId] = {
        staffName: session.staffName,
        totalHours: 0,
        sessions: 0,
        lastActivity: session.clockIn
      };
    }
    
    if (session.clockOut) {
      staffSummary[session.staffId].totalHours += session.totalHours || 0;
    }
    staffSummary[session.staffId].sessions += 1;
  });

  // Export to PDF function
  const exportToPDF = () => {
    setLoading(true);
    
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('Cafe Pirana - Staff Report', 105, 20, { align: 'center' });
      
      // Date
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Date: ${new Date(selectedDate).toDateString()}`, 105, 30, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 36, { align: 'center' });
      
      let yPosition = 50;
      
      // Staff Summary Table
      if (Object.keys(staffSummary).length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text('Staff Summary', 14, yPosition);
        yPosition += 10;
        
        const summaryData = Object.entries(staffSummary).map(([staffId, data]) => [
          data.staffName,
          staffId,
          data.sessions.toString(),
          `${data.totalHours.toFixed(2)}h`,
          formatTime(data.lastActivity)
        ]);
        
        doc.autoTable({
          startY: yPosition,
          head: [['Staff Name', 'Staff ID', 'Sessions', 'Total Hours', 'Last Activity']],
          body: summaryData,
          theme: 'grid',
          headStyles: { fillColor: [74, 124, 89] },
          styles: { fontSize: 10 },
          margin: { left: 14, right: 14 }
        });
        
        yPosition = doc.lastAutoTable.finalY + 15;
      }
      
      // Detailed Sessions Table
      if (filteredSessions.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text('Detailed Sessions', 14, yPosition);
        yPosition += 10;
        
        const sessionData = filteredSessions.map(session => [
          session.staffName,
          formatTime(session.clockIn),
          session.clockOut ? formatTime(session.clockOut) : 'Active',
          session.clockOut ? formatDuration(session.duration) : 'In Progress',
          session.clockOut ? 'Completed' : 'Active'
        ]);
        
        doc.autoTable({
          startY: yPosition,
          head: [['Staff Name', 'Clock In', 'Clock Out', 'Duration', 'Status']],
          body: sessionData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 }
        });
      }
      
      // Statistics
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : yPosition;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Total Staff: ${Object.keys(staffSummary).length}`, 14, finalY);
      doc.text(`Total Sessions: ${filteredSessions.length}`, 14, finalY + 6);
      doc.text(`Active Staff: ${activeStaff.length}`, 14, finalY + 12);
      
      // Save the PDF
      doc.save(`cafe-pirana-report-${selectedDate}.pdf`);
      
      alert('📊 PDF report generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('❌ Error generating PDF: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Export to CSV function
  const exportToCSV = () => {
    try {
      const headers = ['Staff Name', 'Staff ID', 'Date', 'Clock In', 'Clock Out', 'Duration', 'Status', 'Total Hours'];
      const csvData = filteredSessions.map(session => [
        session.staffName,
        session.staffId,
        session.date,
        formatTime(session.clockIn),
        session.clockOut ? formatTime(session.clockOut) : 'Active',
        session.clockOut ? formatDuration(session.duration) : 'In Progress',
        session.clockOut ? 'Completed' : 'Active',
        session.totalHours ? session.totalHours.toFixed(2) : '0.00'
      ]);
      
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `cafe-pirana-data-${selectedDate}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert('📈 CSV file exported successfully!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('❌ Error exporting CSV: ' + error.message);
    }
  };

  // Clear all data function
  const clearAllData = async () => {
    const confirmClear = window.confirm(
      '🚨 DANGER ZONE!\n\nThis will permanently delete ALL data from the database.\n\nThis action cannot be undone!\n\nType "DELETE ALL" to confirm:'
    );
    
    if (!confirmClear) return;
    
    const userInput = prompt('Please type "DELETE ALL" to confirm permanent deletion:');
    if (userInput !== 'DELETE ALL') {
      alert('❌ Deletion cancelled. Data is safe.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Get all documents
      const querySnapshot = await getDocs(collection(db, 'sessions'));
      
      // Delete in batches to avoid Firestore limits
      const batch = writeBatch(db);
      let deleteCount = 0;
      
      querySnapshot.forEach((document) => {
        batch.delete(doc(db, 'sessions', document.id));
        deleteCount++;
        
        // Commit in batches of 500 (Firestore limit)
        if (deleteCount % 500 === 0) {
          batch.commit();
        }
      });
      
      // Commit remaining deletes
      await batch.commit();
      
      alert(`✅ Successfully deleted ${deleteCount} records! Database is now empty.`);
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('❌ Error clearing data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Clear data for selected date only
  const clearDateData = async () => {
    const confirmClear = window.confirm(
      `Clear all data for ${new Date(selectedDate).toDateString()}?\n\nThis action cannot be undone.`
    );
    
    if (!confirmClear) return;
    
    setLoading(true);
    
    try {
      const sessionsToDelete = filteredSessions;
      let deleteCount = 0;
      
      // Delete in batches
      const batch = writeBatch(db);
      
      sessionsToDelete.forEach(session => {
        batch.delete(doc(db, 'sessions', session.id));
        deleteCount++;
      });
      
      await batch.commit();
      
      alert(`✅ Successfully deleted ${deleteCount} records for ${new Date(selectedDate).toDateString()}`);
    } catch (error) {
      console.error('Error clearing date data:', error);
      alert('❌ Error clearing data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-info">
          <h1>🏢 Cafe Pirana - Admin Dashboard</h1>
          <p>Real-time Staff Monitoring & Reports</p>
          <div className="live-indicator">
            <span className="live-dot"></span>
            LIVE UPDATES
          </div>
        </div>
        
        <div className="active-staff-counter">
          <div className="counter-number">{activeStaff.length}</div>
          <div className="counter-label">Currently Working</div>
        </div>
      </div>

      {/* Export & Management Controls */}
      <div className="management-section">
        <h3>📤 Export & Data Management</h3>
        <div className="management-buttons">
          <button 
            className="export-btn pdf-btn" 
            onClick={exportToPDF}
            disabled={loading || filteredSessions.length === 0}
          >
            {loading ? '⏳' : '📊'} Export PDF
          </button>
          
          <button 
            className="export-btn csv-btn" 
            onClick={exportToCSV}
            disabled={loading || filteredSessions.length === 0}
          >
            {loading ? '⏳' : '📈'} Export CSV
          </button>
          
          <button 
            className="clear-btn date-clear-btn" 
            onClick={clearDateData}
            disabled={loading || filteredSessions.length === 0}
          >
            {loading ? '⏳' : '🗑️'} Clear This Date
          </button>
          
          <button 
            className="clear-btn danger-btn" 
            onClick={clearAllData}
            disabled={loading}
          >
            {loading ? '⏳' : '🚨'} Clear All Data
          </button>
        </div>
        
        <div className="export-stats">
          <p>
            <strong>Data Summary:</strong> {Object.keys(staffSummary).length} staff, {' '}
            {filteredSessions.length} sessions on {new Date(selectedDate).toDateString()}
          </p>
        </div>
      </div>

      {/* Real-time Active Staff */}
      <div className="active-staff-section">
        <h3>🟢 Currently Working</h3>
        {activeStaff.length === 0 ? (
          <div className="no-active-staff">
            <p>No staff currently clocked in</p>
          </div>
        ) : (
          <div className="active-staff-grid">
            {activeStaff.map(staff => (
              <div key={staff.id} className="active-staff-card">
                <div className="staff-avatar">
                  {staff.staffName.charAt(0).toUpperCase()}
                </div>
                <div className="staff-details">
                  <strong>{staff.staffName}</strong>
                  <small>ID: {staff.staffId}</small>
                  <div className="session-duration">
                    Working: <LiveTimer startTime={new Date(staff.clockIn)} />
                  </div>
                </div>
                <div className="status-indicator active"></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="controls-section">
        <div className="control-group">
          <label>Select Date:</label>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Staff Summary */}
      <div className="summary-section">
        <h3>📊 Staff Summary - {new Date(selectedDate).toDateString()}</h3>
        {Object.keys(staffSummary).length === 0 ? (
          <div className="no-data">
            <p>No activity for selected date</p>
          </div>
        ) : (
          <div className="staff-cards">
            {Object.entries(staffSummary).map(([staffId, data]) => (
              <div key={staffId} className="staff-card">
                <div className="staff-header">
                  <h4>{data.staffName}</h4>
                  <span className="staff-id">{staffId}</span>
                </div>
                <div className="staff-stats">
                  <div className="stat">
                    <span>Total Hours:</span>
                    <strong>{data.totalHours.toFixed(2)}h</strong>
                  </div>
                  <div className="stat">
                    <span>Sessions:</span>
                    <strong>{data.sessions}</strong>
                  </div>
                  <div className="stat">
                    <span>Last Activity:</span>
                    <strong>{formatTime(data.lastActivity)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Sessions */}
      <div className="sessions-section">
        <h3>📋 All Sessions - {new Date(selectedDate).toDateString()}</h3>
        {filteredSessions.length === 0 ? (
          <div className="no-sessions">
            <p>No sessions for selected date</p>
          </div>
        ) : (
          <div className="sessions-list">
            {filteredSessions.map(session => (
              <div key={session.id} className={`session-item ${!session.clockOut ? 'active-session' : ''}`}>
                <div className="session-header">
                  <strong>{session.staffName}</strong>
                  <span className="session-id">ID: {session.staffId}</span>
                </div>
                <div className="session-times">
                  <span>In: {formatTime(session.clockIn)}</span>
                  {session.clockOut ? (
                    <span>Out: {formatTime(session.clockOut)}</span>
                  ) : (
                    <span className="active-badge">ACTIVE NOW</span>
                  )}
                </div>
                <div className="session-duration">
                  {session.clockOut ? (
                    formatDuration(session.duration)
                  ) : (
                    <LiveTimer startTime={new Date(session.clockIn)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="logout-btn" onClick={onLogout} disabled={loading}>
        {loading ? '⏳' : '🚪'} Logout
      </button>
    </div>
  );
}

// Live Timer Component for Admin
function LiveTimer({ startTime }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  const duration = currentTime - startTime;
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((duration % (1000 * 60)) / 1000);
  
  return `${hours}h ${minutes}m ${seconds}s`;
}