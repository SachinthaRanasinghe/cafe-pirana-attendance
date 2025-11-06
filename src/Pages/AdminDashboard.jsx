import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import "./AdminDashboard.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminDashboard({ onLogout }) {
  const [allSessions, setAllSessions] = useState([]);
  const [activeStaff, setActiveStaff] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);

  // === Real-time Firestore listener ===
  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("clockIn", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = [];
      const active = [];
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        sessions.push(data);
        if (!data.clockOut) active.push(data);
      });
      setAllSessions(sessions);
      setActiveStaff(active);
    });
    return () => unsubscribe();
  }, []);

  const filteredSessions = allSessions.filter(
    (s) => s.date === new Date(selectedDate).toDateString()
  );

  // === Staff summary calculation (using staffUid) ===
  const staffSummary = {};
  filteredSessions.forEach((session) => {
    if (!staffSummary[session.staffUid]) {
      staffSummary[session.staffUid] = {
        staffName: session.staffName,
        staffId: session.staffId,
        totalHours: 0,
        sessions: 0,
        lastActivity: session.clockIn,
      };
    }

    if (session.clockOut) {
      staffSummary[session.staffUid].totalHours += session.totalHours || 0;
    }
    staffSummary[session.staffUid].sessions += 1;
  });

  // === PDF Export ===
  const exportToPDF = () => {
    setLoading(true);
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.text("Cafe Piranha - Staff Report", 105, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Date: ${new Date(selectedDate).toDateString()}`, 105, 30, {
        align: "center",
      });
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 36, {
        align: "center",
      });

      let y = 50;

      // Staff Summary Table
      if (Object.keys(staffSummary).length > 0) {
        doc.setFontSize(14);
        doc.text("Staff Summary", 14, y);
        y += 10;

        const summaryData = Object.entries(staffSummary).map(
          ([uid, data]) => [
            data.staffName,
            data.staffId,
            uid,
            data.sessions.toString(),
            `${data.totalHours.toFixed(2)}h`,
            formatTime(data.lastActivity),
          ]
        );

        autoTable(doc, {
          startY: y,
          head: [
            [
              "Staff Name",
              "Staff ID",
              "Staff UID",
              "Sessions",
              "Total Hours",
              "Last Activity",
            ],
          ],
          body: summaryData,
          theme: "grid",
          headStyles: { fillColor: [74, 124, 89] },
          styles: { fontSize: 10 },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 15;
      }

      // Detailed Sessions Table
      if (filteredSessions.length > 0) {
        doc.setFontSize(14);
        doc.text("Detailed Sessions", 14, y);
        y += 10;

        const sessionData = filteredSessions.map((s) => [
          s.staffName,
          s.staffId,
          s.staffUid,
          formatTime(s.clockIn),
          s.clockOut ? formatTime(s.clockOut) : "Active",
          s.clockOut ? formatDuration(s.duration) : "In Progress",
          s.clockOut ? "Completed" : "Active",
        ]);

        autoTable(doc, {
          startY: y,
          head: [
            [
              "Staff Name",
              "Staff ID",
              "Staff UID",
              "Clock In",
              "Clock Out",
              "Duration",
              "Status",
            ],
          ],
          body: sessionData,
          theme: "grid",
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer Stats
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : y;
      doc.setFontSize(10);
      doc.text(`Total Staff: ${Object.keys(staffSummary).length}`, 14, finalY);
      doc.text(`Total Sessions: ${filteredSessions.length}`, 14, finalY + 6);
      doc.text(`Active Staff: ${activeStaff.length}`, 14, finalY + 12);

      doc.save(`cafe-Piranha-report-${selectedDate}.pdf`);
      alert("📊 PDF generated successfully!");
    } catch (err) {
      console.error(err);
      alert("❌ Error generating PDF: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // === CSV Export ===
  const exportToCSV = () => {
    try {
      const headers = [
        "Staff Name",
        "Staff ID",
        "Staff UID",
        "Date",
        "Clock In",
        "Clock Out",
        "Duration",
        "Status",
        "Total Hours",
      ];
      const data = filteredSessions.map((s) => [
        s.staffName,
        s.staffId,
        s.staffUid,
        s.date,
        formatTime(s.clockIn),
        s.clockOut ? formatTime(s.clockOut) : "Active",
        s.clockOut ? formatDuration(s.duration) : "In Progress",
        s.clockOut ? "Completed" : "Active",
        s.totalHours ? s.totalHours.toFixed(2) : "0.00",
      ]);
      const csv = [headers, ...data]
        .map((r) => r.map((f) => `"${f}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `cafe-Piranha-data-${selectedDate}.csv`;
      link.click();
      alert("📈 CSV exported successfully!");
    } catch (err) {
      alert("❌ Error exporting CSV: " + err.message);
    }
  };

  // === Delete All Data ===
  const clearAllData = async () => {
    const confirmClear = window.confirm(
      "🚨 WARNING!\nThis will delete ALL data permanently.\nType DELETE ALL to confirm."
    );
    if (!confirmClear) return;
    const userInput = prompt('Type "DELETE ALL" to confirm:');
    if (userInput !== "DELETE ALL") return alert("Cancelled.");

    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "sessions"));
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach((docu) => {
        batch.delete(doc(db, "sessions", docu.id));
        count++;
      });
      await batch.commit();
      alert(`✅ Deleted ${count} records.`);
    } catch (err) {
      alert("❌ Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // === Delete Selected Date Data ===
  const clearDateData = async () => {
    if (!window.confirm(`Clear data for ${new Date(selectedDate).toDateString()}?`)) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      filteredSessions.forEach((s) => {
        batch.delete(doc(db, "sessions", s.id));
        count++;
      });
      await batch.commit();
      alert(`✅ Deleted ${count} records for selected date.`);
    } catch (err) {
      alert("❌ Error clearing date data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // === Helper functions ===
  const formatTime = (t) =>
    new Date(t).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const formatDuration = (ms) => {
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-info">
          <h1>🏢 Cafe Piranha - Admin Dashboard</h1>
          <p>Real-time Staff Monitoring & Reports</p>
          <div className="live-indicator">
            <span className="live-dot"></span> LIVE UPDATES
          </div>
        </div>
        <div className="active-staff-counter">
          <div className="counter-number">{activeStaff.length}</div>
          <div className="counter-label">Currently Working</div>
        </div>
      </div>

      {/* Export / Manage */}
      <div className="management-section">
        <h3>📤 Export & Data Management</h3>
        <div className="management-buttons">
          <button className="export-btn pdf-btn" onClick={exportToPDF} disabled={loading}>
            {loading ? "⏳" : "📊"} Export PDF
          </button>
          <button className="export-btn csv-btn" onClick={exportToCSV} disabled={loading}>
            {loading ? "⏳" : "📈"} Export CSV
          </button>
          <button className="clear-btn date-clear-btn" onClick={clearDateData} disabled={loading}>
            {loading ? "⏳" : "🗑️"} Clear This Date
          </button>
          <button className="clear-btn danger-btn" onClick={clearAllData} disabled={loading}>
            {loading ? "⏳" : "🚨"} Clear All Data
          </button>
        </div>
        <p className="export-stats">
          <strong>Data Summary:</strong> {Object.keys(staffSummary).length} staff,{" "}
          {filteredSessions.length} sessions on {new Date(selectedDate).toDateString()}
        </p>
      </div>

      {/* Active Staff */}
      <div className="active-staff-section">
        <h3>🟢 Currently Working</h3>
        {activeStaff.length === 0 ? (
          <p className="no-active-staff">No staff currently clocked in</p>
        ) : (
          <div className="active-staff-grid">
            {activeStaff.map((s) => (
              <div key={s.id} className="active-staff-card">
                <div className="staff-avatar">{s.staffName.charAt(0).toUpperCase()}</div>
                <div className="staff-details">
                  <strong>{s.staffName}</strong>
                  <small>ID: {s.staffId}</small>
                  <div className="session-duration">
                    Working: <LiveTimer startTime={new Date(s.clockIn)} />
                  </div>
                </div>
                <div className="status-indicator active"></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Date Selector */}
      <div className="controls-section">
        <label>Select Date:</label>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      {/* Staff Summary */}
      <div className="summary-section">
        <h3>📊 Staff Summary - {new Date(selectedDate).toDateString()}</h3>
        {Object.keys(staffSummary).length === 0 ? (
          <p className="no-data">No activity for selected date</p>
        ) : (
          <div className="staff-cards">
            {Object.entries(staffSummary).map(([uid, d]) => (
              <div key={uid} className="staff-card">
                <div className="staff-header">
                  <h4>{d.staffName}</h4>
                  <span className="staff-id">{d.staffId}</span>
                </div>
                <div className="staff-stats">
                  <div className="stat">
                    <span>Total Hours:</span> <strong>{d.totalHours.toFixed(2)}h</strong>
                  </div>
                  <div className="stat">
                    <span>Sessions:</span> <strong>{d.sessions}</strong>
                  </div>
                  <div className="stat">
                    <span>Last Activity:</span> <strong>{formatTime(d.lastActivity)}</strong>
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
          <p className="no-sessions">No sessions for selected date</p>
        ) : (
          <div className="sessions-list">
            {filteredSessions.map((s) => (
              <div key={s.id} className={`session-item ${!s.clockOut ? "active-session" : ""}`}>
                <div className="session-header">
                  <strong>{s.staffName}</strong>
                  <span className="session-id">ID: {s.staffId}</span>
                </div>
                <div className="session-times">
                  <span>In: {formatTime(s.clockIn)}</span>
                  {s.clockOut ? (
                    <span>Out: {formatTime(s.clockOut)}</span>
                  ) : (
                    <span className="active-badge">ACTIVE NOW</span>
                  )}
                </div>
                <div className="session-duration">
                  {s.clockOut ? formatDuration(s.duration) : <LiveTimer startTime={new Date(s.clockIn)} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="logout-btn" onClick={onLogout} disabled={loading}>
        {loading ? "⏳" : "🚪"} Logout
      </button>
    </div>
  );
}

// === Live Timer Component ===
function LiveTimer({ startTime }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const diff = currentTime - startTime;
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  return `${h}h ${m}m ${s}s`;
}
