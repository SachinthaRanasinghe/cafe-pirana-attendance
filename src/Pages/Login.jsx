import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import "./Login.css";
import StaffDashboard from "./StaffDashboard.jsx";
import AdminDashboard from "./AdminDashboard.jsx";

export default function Login() {
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [userType, setUserType] = useState(""); // "staff" or "admin"
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Admin credentials
  const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "cafepirana2024"
  };

  // Staff Registration
  const handleStaffRegister = async (e) => {
    e.preventDefault();
    
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      alert("Please fill in all fields.");
      return;
    }

    if (staffPassword.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, staffEmail, staffPassword);
      const user = userCredential.user;

      // Create staff profile in Firestore
      const staffProfile = {
        staffName: staffName.trim(),
        staffEmail: staffEmail.trim(),
        createdAt: new Date().toISOString(),
        staffId: `CP${staffName.replace(/\s+/g, '').toUpperCase().substr(0, 3)}`,
        totalHours: 0,
        sessionsCount: 0
      };

      await setDoc(doc(db, 'staff', user.uid), staffProfile);

      alert("✅ Account created successfully! You can now login.");
      setIsRegistering(false);
      setStaffEmail("");
      setStaffPassword("");
      
    } catch (error) {
      console.error("Registration error:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("❌ Email already registered. Please use a different email or login.");
      } else if (error.code === 'auth/invalid-email') {
        alert("❌ Invalid email address.");
      } else {
        alert("❌ Registration failed: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Staff Login
  const handleStaffLogin = async (e) => {
    e.preventDefault();
    
    if (!staffEmail.trim() || !staffPassword.trim()) {
      alert("Please enter both email and password.");
      return;
    }

    setIsLoading(true);

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, staffEmail, staffPassword);
      const user = userCredential.user;

      // Get staff profile from Firestore
      const staffDoc = await getDoc(doc(db, 'staff', user.uid));
      
      if (staffDoc.exists()) {
        const staffData = staffDoc.data();
        setUserData({
          uid: user.uid,
          ...staffData
        });
        setUserType("staff");
        setLoggedIn(true);
      } else {
        alert("❌ Staff profile not found. Please contact administrator.");
        await auth.signOut();
      }
      
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === 'auth/user-not-found') {
        alert("❌ Account not found. Please register first.");
        setIsRegistering(true);
      } else if (error.code === 'auth/wrong-password') {
        alert("❌ Incorrect password.");
      } else if (error.code === 'auth/invalid-email') {
        alert("❌ Invalid email address.");
      } else {
        alert("❌ Login failed: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    
    if (!adminUsername || !adminPassword) {
      alert("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    
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
    if (userType === "staff") {
      auth.signOut();
    }
    setLoggedIn(false);
    setUserType("");
    setUserData(null);
    setStaffName("");
    setStaffEmail("");
    setStaffPassword("");
    setAdminUsername("");
    setAdminPassword("");
    setIsAdminLogin(false);
    setIsRegistering(false);
  };

  // Redirect to appropriate dashboard after login
  if (loggedIn && userType === "staff" && userData) {
    return <StaffDashboard staffData={userData} onLogout={handleLogout} />;
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
                {isAdminLogin ? "Admin Portal" : isRegistering ? "Staff Registration" : "Staff Portal"}
              </p>
            </div>
          </div>
          <p className="login-subtitle">
            {isAdminLogin ? "Administrator Access" : 
             isRegistering ? "Create Your Staff Account" : "Working Time & Attendance System"}
          </p>
        </div>

        {/* Staff Login/Register Form */}
        {!isAdminLogin ? (
          <form onSubmit={isRegistering ? handleStaffRegister : handleStaffLogin} className="login-form">
            {isRegistering && (
              <div className="input-group">
                <label htmlFor="staffName" className="input-label">
                  Full Name
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
            )}

            <div className="input-group">
              <label htmlFor="staffEmail" className="input-label">
                Email Address
              </label>
              <input
                id="staffEmail"
                type="email"
                placeholder="Enter your email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="staffPassword" className="input-label">
                Password
              </label>
              <input
                id="staffPassword"
                type="password"
                placeholder={isRegistering ? "Create a password (min. 6 characters)" : "Enter your password"}
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                className="form-input"
                required
                minLength={6}
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
                  {isRegistering ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isRegistering ? 'Create Account' : 'Sign In'
              )}
            </button>

            <div className="form-switch">
              <button 
                type="button"
                className="switch-btn"
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering 
                  ? '← Already have an account? Sign In' 
                  : 'Need an account? Register Here'
                }
              </button>
              
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

            <div className="form-switch">
              <button 
                type="button"
                className="back-btn"
                onClick={() => setIsAdminLogin(false)}
              >
                ← Back to Staff Portal
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
              : isRegistering 
                ? "Your account data is securely stored and encrypted."
                : "Secure staff access only. Unauthorized access prohibited."
            }
          </p>
        </div>
      </div>
    </div>
  );
}