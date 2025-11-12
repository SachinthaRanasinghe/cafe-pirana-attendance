// src/App.jsx
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase";
import "./App.css";

// Import Pages
import Login from "./Pages/Login.jsx";

// Admin Pages
import AdminDashboard from "./Pages/AdminDashboard/AdminDashboard.jsx";
import SalaryManagement from "./Pages/AdminDashboard/SalaryManagement.jsx";
import AdvanceRequests from "./Pages/AdminDashboard/AdvanceRequests.jsx";
import OTApprovals from "./Pages/AdminDashboard/OTApprovals.jsx";
import StaffAvailabilityView from "./Pages/AdminDashboard/StaffAvailabilityView.jsx";

// Staff Pages  
import StaffDashboard from "./Pages/StaffDashboard/StaffDashboard.jsx";
import SalaryView from "./Pages/StaffDashboard/SalaryView.jsx";
import RequestAdvance from "./Pages/StaffDashboard/RequestAdvance.jsx";
import StaffAvailability from "./Pages/StaffDashboard/StaffAvailability.jsx";

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Admin login states
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Staff login states
  const [staffLoggedIn, setStaffLoggedIn] = useState(false);
  const [staffData, setStaffData] = useState(null);

  // Admin credentials - Now using email for Firebase Auth
  const ADMIN_CREDENTIALS = {
    email: "admin@cafepiranha.com",
    password: "cafepirana2024"
  };

  // Check if user is already logged in on app start
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email === ADMIN_CREDENTIALS.email) {
        setAdminLoggedIn(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Staff Login Handler
  const handleStaffLogin = (staff) => {
    console.log("Staff logged in:", staff);
    setStaffData(staff);
    setStaffLoggedIn(true);
    setShowLogin(false);
  };

  // Admin Login Handler with Firebase Authentication
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    
    if (!adminEmail || !adminPassword) {
      alert("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    
    try {
      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        adminEmail, 
        adminPassword
      );
      
      const user = userCredential.user;
      
      // Additional check to ensure it's the admin account
      if (user.email === ADMIN_CREDENTIALS.email) {
        setAdminLoggedIn(true);
        setAdminEmail("");
        setAdminPassword("");
        setShowAdminLogin(false);
      } else {
        await signOut(auth);
        alert("Access denied. Admin credentials required.");
      }
    } catch (error) {
      console.error("Admin login error:", error);
      let errorMessage = "Invalid admin credentials!";
      
      if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email format.";
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = "No admin account found with this email.";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      setAdminLoggedIn(false);
      setAdminEmail("");
      setAdminPassword("");
      setShowAdminLogin(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleStaffLogout = () => {
    setStaffLoggedIn(false);
    setStaffData(null);
    setShowLogin(false);
  };

  const handleBackToMain = () => {
    setShowAdminLogin(false);
    setShowLogin(false);
    setAdminEmail("");
    setAdminPassword("");
  };

  // Show admin dashboard if admin is logged in
  if (adminLoggedIn) {
    return (
      <Router>
        <Routes>
          <Route path="/admin" element={<AdminDashboard onLogout={handleAdminLogout} />} />
          <Route path="/admin/salary" element={<SalaryManagement onLogout={handleAdminLogout} />} />
          <Route path="/admin/advances" element={<AdvanceRequests onLogout={handleAdminLogout} />} />
          <Route path="/admin/ot-approvals" element={<OTApprovals onLogout={handleAdminLogout} />} />
          <Route path="/admin/availability" element={<StaffAvailabilityView onLogout={handleAdminLogout} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Router>
    );
  }

  // Show staff dashboard if staff is logged in
  if (staffLoggedIn) {
    return (
      <Router>
        <Routes>
          <Route path="/staff" element={<StaffDashboard staffData={staffData} onLogout={handleStaffLogout} />} />
          <Route path="/staff/salary" element={<SalaryView staffData={staffData} onLogout={handleStaffLogout} />} />
          <Route path="/staff/advance" element={<RequestAdvance staffData={staffData} onLogout={handleStaffLogout} />} />
          <Route path="/staff/availability" element={<StaffAvailability staffData={staffData} onLogout={handleStaffLogout} />} />
          <Route path="*" element={<Navigate to="/staff" replace />} />
        </Routes>
      </Router>
    );
  }

  // Show admin login if admin login is requested
  if (showAdminLogin) {
    return (
      <div className="app">
        <div className="login-container">
          {/* Cafe Piranha Branding */}
          <div className="login-header">
            <div className="cafe-brand">
              <div className="cafe-logo">☕</div>
              <div className="brand-text">
                <h1 className="cafe-name">Cafe Piranha</h1>
                <p className="cafe-subtitle">Admin Portal</p>
              </div>
            </div>
            <p className="login-subtitle">
              Administrator Access - Firebase Authentication
            </p>
          </div>

          {/* Admin Login Form */}
          <form onSubmit={handleAdminLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="adminEmail" className="input-label">
                Admin Email
              </label>
              <input
                id="adminEmail"
                type="email"
                placeholder="Enter admin email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="adminPassword" className="input-label">
                Admin Password
              </label>
              <input
                id="adminPassword"
                type="password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <button 
              type="submit" 
              className={`login-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  Signing In...
                </>
              ) : (
                'Access Admin Panel'
              )}
            </button>

            <div className="form-switch">
              <button 
                type="button"
                className="back-btn"
                onClick={handleBackToMain}
              >
                ← Back to Main Screen
              </button>
            </div>
          </form>

          {/* Admin Account Info */}
          <div className="admin-info-notice">
            <div className="info-icon">ℹ️</div>
            <div className="info-content">
              <strong>Admin Account:</strong>
              <p>Email: admin@cafepiranha.com</p>
              <p>Password: cafepirana2024</p>
              <small>Make sure this account exists in Firebase Authentication</small>
            </div>
          </div>

          {/* Security Notice */}
          <div className="security-notice">
            <div className="security-icon">🔒</div>
            <p>
              Administrative access only. All activities are logged and authenticated.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show login page if staff login is requested
  if (showLogin) {
    return (
      <Login 
        onStaffLogin={handleStaffLogin} 
        onAdminLogin={() => setShowAdminLogin(true)} 
        onBack={handleBackToMain}
      />
    );
  }

  return (
    <div className="app">
      <div className="location-container">
        {/* Animated Background Elements */}
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>

        {/* Header */}
        <div className="header">
          <div className="logo">
            <div className="cafe-brand">
              <div className="cafe-logo-container">
                <span className="cafe-logo">☕</span>
                <div className="logo-glow"></div>
              </div>
              <div className="brand-text">
                <h1 className="cafe-name">Cafe Piranha</h1>
                <p className="cafe-subtitle">Staff Management System</p>
              </div>
            </div>
          </div>
          <p className="tagline">Professional Environment • Secure Access</p>
        </div>

        {/* Main Content */}
        <div className="content">
          <div className="welcome-card">
            <div className="card-header">
              <div className="header-icon">🚪</div>
              <h2>Welcome to Cafe Piranha</h2>
              <p className="card-subtitle">Choose Your Access Method</p>
            </div>
            
            <p className="description">
              Access the staff management system using one of the options below. 
              Staff members can log in directly, while administrators have separate secure access.
            </p>

            {/* Access Options Grid */}
            <div className="access-grid">
              {/* Staff Access Card */}
              <div className="access-card staff-access">
                <div className="access-icon">👥</div>
                <div className="access-content">
                  <h3>Staff Portal</h3>
                  <p>Access your personal dashboard, track hours, request advances, and manage availability</p>
                  <ul className="access-features">
                    <li>✅ Clock in/out tracking</li>
                    <li>✅ Salary overview</li>
                    <li>✅ Advance requests</li>
                    <li>✅ Availability scheduling</li>
                    <li>✅ Overtime tracking</li>
                  </ul>
                </div>
                <button 
                  className="access-btn primary"
                  onClick={() => setShowLogin(true)}
                >
                  <span className="btn-icon">🔑</span>
                  Staff Login
                </button>
              </div>

              {/* Admin Access Card */}
              <div className="access-card admin-access">
                <div className="access-icon">⚙️</div>
                <div className="access-content">
                  <h3>Admin Portal</h3>
                  <p>Manage staff, salaries, approve requests, and oversee system operations</p>
                  <ul className="access-features">
                    <li>🔒 Staff management</li>
                    <li>🔒 Salary configuration</li>
                    <li>🔒 Advance approvals</li>
                    <li>🔒 OT management</li>
                    <li>🔒 Availability overview</li>
                  </ul>
                </div>
                <button 
                  className="access-btn secondary"
                  onClick={() => setShowAdminLogin(true)}
                >
                  <span className="btn-icon">🔒</span>
                  Admin Login
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
              <div className="stat-item">
                <div className="stat-number">24/7</div>
                <div className="stat-label">System Access</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">Secure</div>
                <div className="stat-label">Authentication</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">Real-time</div>
                <div className="stat-label">Updates</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">Mobile</div>
                <div className="stat-label">Friendly</div>
              </div>
            </div>

            {/* System Information */}
            <div className="system-info">
              <div className="info-section">
                <h4>📋 System Features</h4>
                <div className="features-grid">
                  <div className="feature-item">
                    <span className="feature-icon">⏰</span>
                    <span>Time Tracking</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">💰</span>
                    <span>Salary Management</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">📋</span>
                    <span>Advance Requests</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🕒</span>
                    <span>Overtime Tracking</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">📅</span>
                    <span>Availability Scheduling</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">📊</span>
                    <span>Reports & Analytics</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Footer */}
          <div className="security-footer">
            <div className="security-notice">
              <div className="security-badge">
                <div className="security-icon">🔒</div>
                <div className="security-glow"></div>
              </div>
              <div className="security-text">
                <strong>Enterprise Security Protocol</strong>
                <p>This system employs secure authentication and role-based access control. All activities are monitored and logged for security purposes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;