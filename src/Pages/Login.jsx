import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import "./Login.css";

export default function Login({ onStaffLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 🧾 Staff Registration
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

      const staffProfile = {
        staffName: staffName.trim(),
        staffEmail: staffEmail.trim(),
        staffId: `CP${Date.now().toString().slice(-4)}`,
        createdAt: new Date().toISOString(),
        totalHours: 0,
        sessionsCount: 0,
        uid: user.uid,
      };

      await setDoc(doc(db, "staff", user.uid), staffProfile);
      alert("✅ Account created successfully! You can now log in.");

      setIsRegistering(false);
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
    } catch (error) {
      console.error("Registration error:", error);
      if (error.code === "auth/email-already-in-use") {
        alert("❌ Email already registered. Please use a different email or login.");
      } else if (error.code === "auth/invalid-email") {
        alert("❌ Invalid email address.");
      } else {
        alert("❌ Registration failed: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 🔐 Staff Login
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

      const staffDoc = await getDoc(doc(db, "staff", user.uid));

      if (staffDoc.exists()) {
        const staffData = staffDoc.data();

        const staffProfile = {
          uid: user.uid,
          staffName: staffData.staffName || staffData.name,
          staffId: staffData.staffId || staffData.id,
          staffEmail: staffData.staffEmail || staffData.email,
        };

        if (onStaffLogin && typeof onStaffLogin === "function") {
          onStaffLogin(staffProfile);
        } else {
          console.error("onStaffLogin is not a function:", onStaffLogin);
          alert("Login system error. Please try again.");
        }
      } else {
        alert("❌ Staff profile not found. Please contact administrator.");
        await auth.signOut();
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === "auth/user-not-found") {
        alert("❌ Account not found. Please register first.");
        setIsRegistering(true);
      } else if (error.code === "auth/wrong-password") {
        alert("❌ Incorrect password.");
      } else if (error.code === "auth/invalid-email") {
        alert("❌ Invalid email address.");
      } else {
        alert("❌ Login failed: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="login-container">
        {/* ☕ Branding */}
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
            {isRegistering
              ? "Create your staff account to access shifts & salary"
              : "Staff Access • Work & Attendance System"}
          </p>
        </div>

        {/* 📋 Form */}
        <form
          onSubmit={isRegistering ? handleStaffRegister : handleStaffLogin}
          className="login-form"
        >
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
              placeholder={
                isRegistering
                  ? "Create a password (min. 6 characters)"
                  : "Enter your password"
              }
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              className="form-input"
              required
              minLength={6}
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
                {isRegistering ? "Creating Account..." : "Signing In..."}
              </>
            ) : isRegistering ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>

          <div className="form-switch">
            <button
              type="button"
              className="switch-btn"
              onClick={() => setIsRegistering(!isRegistering)}
            >
              {isRegistering
                ? "← Already have an account? Sign In"
                : "Need an account? Register Here"}
            </button>
          </div>
        </form>

        {/* 🔒 Security Notice */}
        <div className="security-notice">
          <div className="security-icon">🔒</div>
          <p>
            {isRegistering
              ? "Your account data is securely stored and encrypted."
              : "Authorized staff access only. Secure connection enabled."}
          </p>
        </div>
      </div>
    </div>
  );
}
