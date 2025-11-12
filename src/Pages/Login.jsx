// src/Pages/Login.jsx
import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import "./Login.css";

export default function Login({ onStaffLogin, onAdminLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      const userCredential = await createUserWithEmailAndPassword(auth, staffEmail, staffPassword);
      const user = userCredential.user;

      // Create staff profile - USE THE SAME PROPERTY NAMES CONSISTENTLY
      const staffProfile = {
        staffName: staffName.trim(), // Use staffName consistently
        staffEmail: staffEmail.trim(), // Use staffEmail consistently  
        staffId: `CP${Date.now().toString().slice(-4)}`, // Use staffId consistently
        createdAt: new Date().toISOString(),
        totalHours: 0,
        sessionsCount: 0,
        uid: user.uid
      };

      console.log("Creating staff profile:", staffProfile);
      await setDoc(doc(db, 'staff', user.uid), staffProfile);

      alert("✅ Account created successfully! You can now login.");
      setIsRegistering(false);
      setStaffName("");
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
      const userCredential = await signInWithEmailAndPassword(auth, staffEmail, staffPassword);
      const user = userCredential.user;

      // Get staff profile from Firestore
      const staffDoc = await getDoc(doc(db, 'staff', user.uid));
      
      if (staffDoc.exists()) {
        const staffData = staffDoc.data();
        console.log("Staff data from Firestore:", staffData);
        
        // Use whatever properties exist in Firestore
        const staffProfile = {
          uid: user.uid,
          staffName: staffData.staffName || staffData.name, // Try both
          staffId: staffData.staffId || staffData.id,       // Try both
          staffEmail: staffData.staffEmail || staffData.email // Try both
        };

        console.log("Final staff profile:", staffProfile);
        
        // Call the callback to notify App.jsx
        if (onStaffLogin && typeof onStaffLogin === 'function') {
          onStaffLogin(staffProfile);
        } else {
          console.error('onStaffLogin is not a function:', onStaffLogin);
          alert('Login system error. Please try again.');
        }
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

  // Add Admin Login handler
  const handleAdminLoginClick = () => {
    if (onAdminLogin && typeof onAdminLogin === 'function') {
      onAdminLogin();
    } else {
      console.error('onAdminLogin is not a function:', onAdminLogin);
      alert('Admin login system error. Please try again.');
    }
  };

  return (
    <div className="app">
      <div className="login-container">
        {/* Cafe Piranha Branding */}
        <div className="login-header">
          <div className="cafe-brand">
            <div className="cafe-logo">☕</div>
            <div className="brand-text">
              <h1 className="cafe-name">Cafe Piranha</h1>
              <p className="cafe-subtitle">
                {isRegistering ? "Staff Registration" : "Staff Portal"}
              </p>
            </div>
          </div>
          <p className="login-subtitle">
            {isRegistering ? "Create Your Staff Account" : "Working Time & Attendance System"}
          </p>
        </div>

        {/* Staff Login/Register Form */}
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
          </div>
        </form>

        {/* Admin Access Section */}
        <div className="admin-section">
          <div className="divider">
            <span>or</span>
          </div>
          <button 
            className="admin-login-btn"
            onClick={handleAdminLoginClick}
          >
            <span className="admin-icon">⚙️</span>
            Administrator Access
          </button>
        </div>

        {/* Security Notice */}
        <div className="security-notice">
          <div className="security-icon">🔒</div>
          <p>
            {isRegistering 
              ? "Your account data is securely stored and encrypted."
              : "Secure staff access only. Unauthorized access prohibited."
            }
          </p>
        </div>
      </div>
    </div>
  );
}