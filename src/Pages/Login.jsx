import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import "./Login.css";

export default function Login({ onStaffLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  
  // Live server time state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time for display (simplified for easier reading)
  const formatDateTime = (date) => {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    return date.toLocaleString('en-US', options);
  };

  // Get current month for display (using LOCAL time, not UTC)
  const getCurrentMonth = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`; // Returns "2025-12" based on local time
  };

  // 🔐 Handle Password Reset (First Login)
  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (!newPassword.trim() || !confirmPassword.trim()) {
      alert("Please fill in all fields.");
      return;
    }

    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      // Update Firebase Authentication password
      await updatePassword(currentUser, newPassword);

      // Update Firestore to mark password as changed
      await updateDoc(doc(db, "staff", currentUser.uid), {
        isFirstLogin: false,
        passwordChangedAt: new Date().toISOString(),
      });

      alert("✅ Password updated successfully! You can now access the system.");
      
      // Complete login process
      if (onStaffLogin && typeof onStaffLogin === "function") {
        onStaffLogin(staffProfile);
      }
    } catch (error) {
      console.error("Password reset error:", error);
      alert("❌ Failed to update password: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔐 Staff Login with Username
  const handleStaffLogin = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      alert("Please enter both username and password.");
      return;
    }

    setIsLoading(true);

    try {
      // First, find the staff by username in Firestore
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const staffQuery = query(
        collection(db, "staff"),
        where("username", "==", username.trim())
      );
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.empty) {
        alert("❌ Username not found. Please contact administrator.");
        setIsLoading(false);
        return;
      }

      // Get the staff document
      const staffDoc = staffSnapshot.docs[0];
      const staffData = staffDoc.data();

      // Login with email (stored in Firestore) and provided password
      const userCredential = await signInWithEmailAndPassword(
        auth,
        staffData.email,
        password
      );
      const user = userCredential.user;

      // Check if first login
      if (staffData.isFirstLogin === true) {
        // Force password reset
        setCurrentUser(user);
        setStaffProfile({
          uid: user.uid,
          staffName: staffData.staffName,
          staffId: staffData.staffId,
          username: staffData.username,
        });
        setShowPasswordReset(true);
        setIsLoading(false);
        return;
      }

      // Normal login - proceed to dashboard
      const staffProfile = {
        uid: user.uid,
        staffName: staffData.staffName,
        staffId: staffData.staffId,
        username: staffData.username,
      };

      if (onStaffLogin && typeof onStaffLogin === "function") {
        onStaffLogin(staffProfile);
      } else {
        console.error("onStaffLogin is not a function:", onStaffLogin);
        alert("Login system error. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      
      // Handle Firestore permission errors
      if (error.code === "permission-denied" || 
          error.message.includes("Missing or insufficient permissions")) {
        alert(
          "❌ Database Permission Error\n\n" +
          "The system cannot verify your username. This is a configuration issue.\n\n" +
          "Please contact the administrator and ask them to update the Firestore security rules.\n\n" +
          "Technical details: The 'staff' collection needs read permissions for login queries."
        );
      }
      // Handle authentication errors
      else if (error.code === "auth/user-not-found") {
        alert("❌ Account not found. Please contact administrator.");
      } else if (error.code === "auth/wrong-password") {
        alert("❌ Incorrect password.");
      } else if (error.code === "auth/invalid-email") {
        alert("❌ Invalid credentials.");
      } else if (error.code === "auth/invalid-credential") {
        alert("❌ Invalid username or password. Please check and try again.");
      } else {
        alert("❌ Login failed: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Password Reset UI
  if (showPasswordReset) {
    return (
      <div className="app">
        <div className="login-container">
          {/* ☕ Branding */}
          <div className="login-header">
            <div className="cafe-brand">
              <div className="cafe-logo">🔐</div>
              <div className="brand-text">
                <h1 className="cafe-name">First Login</h1>
                <p className="cafe-subtitle">Password Reset Required</p>
              </div>
            </div>
            <p className="login-subtitle">
              Welcome {staffProfile?.staffName}! Please set a new password to continue.
            </p>
          </div>

          {/* 📋 Password Reset Form */}
          <form onSubmit={handlePasswordReset} className="login-form">
            <div className="input-group">
              <label htmlFor="newPassword" className="input-label">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                placeholder="Enter new password (min. 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                required
                minLength={8}
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword" className="input-label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              className={`login-btn ${isLoading ? "loading" : ""}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  Updating Password...
                </>
              ) : (
                "Update Password & Continue"
              )}
            </button>
          </form>

          {/* 🔒 Security Notice */}
          <div className="security-notice">
            <div className="security-icon">⚠️</div>
            <p>
              For security, you must change your temporary password before accessing the system.
              Choose a strong password with at least 8 characters.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Normal Login UI
  return (
    <div className="app">
      <div className="login-container">
        {/* ☕ Branding */}
        <div className="login-header">
          <div className="cafe-brand">
            <div className="cafe-logo">☕</div>
            <div className="brand-text">
              <h1 className="cafe-name">Cafe Piranha</h1>
              <p className="cafe-subtitle">Staff Portal</p>
            </div>
          </div>
          <p className="login-subtitle">
            Staff Access • Work & Attendance System
          </p>
        </div>

        {/* 📋 Login Form */}
        <form onSubmit={handleStaffLogin} className="login-form">
          <div className="input-group">
            <label htmlFor="username" className="input-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password" className="input-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <button
            type="submit"
            className={`login-btn ${isLoading ? "loading" : ""}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* 🔒 Security Notice */}
        <div className="security-notice">
          <div className="security-icon">🔒</div>
          <p>
            Authorized staff access only. Contact administrator if you need an account.
          </p>
        </div>

        {/* 🕐 Live System Time */}
        <div className="server-time-display">
          <div className="server-time-icon">🕐</div>
          <div className="server-time-content">
            <div className="server-time-label">System Time</div>
            <div className="server-time-value">{formatDateTime(currentTime)}</div>
            <div className="server-time-month">
              Current Month: {getCurrentMonth(currentTime)} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              {currentTime.getHours() >= 18 && " • Shift logic active"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
