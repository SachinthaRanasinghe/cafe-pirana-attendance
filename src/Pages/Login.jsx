import { useState } from "react";
import "./Login.css";
import StaffDashboard from "./StaffDashboard.jsx";
import AdminDashboard from "./AdminDashboard.jsx";

export default function Login() {
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [userType, setUserType] = useState(""); // "staff" or "admin"
  const [isLoading, setIsLoading] = useState(false);

  // Admin credentials (in real app, this should be in backend)
  const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "cafepirana2024"
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    
    if (!staffName.trim()) {
      alert("Please enter your name.");
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setUserType("staff");
      setLoggedIn(true);
      setIsLoading(false);
    }, 1000);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    
    if (!adminUsername || !adminPassword) {
      alert("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    
    // Simulate API call with verification
    setTimeout(() => {
      if (adminUsername === ADMIN_CREDENTIALS.username && 
          adminPassword === ADMIN_CREDENTIALS.password) {
        setUserType("admin");
        setLoggedIn(true);
      } else {
        alert("Invalid admin credentials!");
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUserType("");
    setStaffName("");
    setAdminUsername("");
    setAdminPassword("");
    setIsAdminLogin(false);
  };

  // Redirect to appropriate dashboard after login
  if (loggedIn && userType === "staff") {
    return <StaffDashboard staffName={staffName} onLogout={handleLogout} />;
  }

  if (loggedIn && userType === "admin") {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="app">
      <div className="login-container">
        {/* Cafe Pirana Branding */}
        <div className="login-header">
          <div className="cafe-brand">
            <div className="cafe-logo">☕</div>
            <div className="brand-text">
              <h1 className="cafe-name">Cafe Pirana</h1>
              <p className="cafe-subtitle">
                {isAdminLogin ? "Admin Portal" : "Staff Portal"}
              </p>
            </div>
          </div>
          <p className="login-subtitle">
            {isAdminLogin ? "Administrator Access" : "Working Time & Attendance System"}
          </p>
        </div>

        {/* Staff Login Form */}
        {!isAdminLogin ? (
          <form onSubmit={handleStaffLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="staffName" className="input-label">
                Your Name
              </label>
              <input
                id="staffName"
                type="text"
                placeholder="Enter your full name"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
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
                'Clock In System'
              )}
            </button>

            <div className="admin-switch">
              <button 
                type="button"
                className="admin-btn"
                onClick={() => setIsAdminLogin(true)}
              >
                🔒 Admin Login
              </button>
            </div>
          </form>
        ) : (
          /* Admin Login Form */
          <form onSubmit={handleAdminLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="adminUsername" className="input-label">
                Admin Username
              </label>
              <input
                id="adminUsername"
                type="text"
                placeholder="Enter admin username"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
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
                  Verifying...
                </>
              ) : (
                'Access Admin Panel'
              )}
            </button>

            <div className="admin-switch">
              <button 
                type="button"
                className="back-btn"
                onClick={() => setIsAdminLogin(false)}
              >
                ← Back to Staff Login
              </button>
            </div>
          </form>
        )}

        {/* Security Notice */}
        <div className="security-notice">
          <div className="security-icon">🔒</div>
          <p>
            {isAdminLogin 
              ? "Administrative access only. All activities are logged."
              : "Secure staff access only. Unauthorized access prohibited."
            }
          </p>
        </div>
      </div>
    </div>
  );
}