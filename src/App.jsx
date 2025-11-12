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

  // Admin credentials
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
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        adminEmail, 
        adminPassword
      );
      
      const user = userCredential.user;
      
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
              <div className="cafe-logo">🏪</div>
              <div className="brand-text">
                <h1 className="cafe-name">Cafe Piranha</h1>
                <p className="cafe-subtitle">Admin Portal</p>
              </div>
            </div>
            <p className="login-subtitle">
              Secure Administrator Access
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

  // Main Landing Page
  return (
    <div className="app">
      <div className="landing-container">
        {/* Animated Background */}
        <div className="background-animation">
          <div className="floating-coffee">☕</div>
          <div className="floating-croissant">🥐</div>
          <div className="floating-spoon">🥄</div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* Hero Section */}
          <div className="hero-section">
            <div className="logo-container">
              <div className="main-logo">
                <span className="logo-icon">🏪</span>
                <div className="logo-shine"></div>
              </div>
              <h1 className="hero-title">
                Cafe <span className="brand-accent">Piranha</span>
              </h1>
              <p className="hero-subtitle">
                Staff Management Portal
              </p>
            </div>
          </div>

          {/* Access Cards */}
          <div className="access-section">
            <div className="access-cards">
              {/* Staff Access */}
              <div className="access-card staff-card">
                <div className="card-glow"></div>
                <div className="card-icon">👥</div>
                <div className="card-content">
                  <h3>Staff Portal</h3>
                  <p>Access your personal workspace</p>
                  <ul className="feature-list">
                    <li>• Track hours & salary</li>
                    <li>• Request advances</li>
                    <li>• Manage availability</li>
                    <li>• View schedules</li>
                  </ul>
                </div>
                <button 
                  className="access-btn staff-btn"
                  onClick={() => setShowLogin(true)}
                >
                  <span className="btn-icon">🔑</span>
                  Staff Login
                </button>
              </div>

              {/* Admin Access */}
              <div className="access-card admin-card">
                <div className="card-glow"></div>
                <div className="card-icon">⚙️</div>
                <div className="card-content">
                  <h3>Admin Portal</h3>
                  <p>Manage cafe operations</p>
                  <ul className="feature-list">
                    <li>• Staff management</li>
                    <li>• Salary processing</li>
                    <li>• Request approvals</li>
                    <li>• System oversight</li>
                  </ul>
                </div>
                <button 
                  className="access-btn admin-btn"
                  onClick={() => setShowAdminLogin(true)}
                >
                  <span className="btn-icon">🔒</span>
                  Admin Login
                </button>
              </div>
            </div>
          </div>

          {/* Quick Features */}
          <div className="features-section">
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon">⏰</div>
                <span>Time Tracking</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">💰</div>
                <span>Salary Management</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📋</div>
                <span>Advance Requests</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📅</div>
                <span>Scheduling</span>
              </div>
            </div>
          </div>

          {/* Security Footer */}
          <div className="security-footer">
            <div className="security-badge">
              <div className="lock-icon">🔒</div>
              <span>Secure & Private</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;