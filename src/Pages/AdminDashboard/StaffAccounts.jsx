// src/Pages/AdminDashboard/StaffAccounts.jsx
import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../../firebase";
import { collection, doc, setDoc, getDocs, query, where, orderBy, onSnapshot, updateDoc } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import "./StaffAccounts.css";

export default function StaffAccounts({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Form states
  const [staffName, setStaffName] = useState("");
  const [username, setUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Validation messages
  const [usernameError, setUsernameError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // Password reset states
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Load all staff accounts
  useEffect(() => {
    setLoadingStaff(true);
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const staffData = [];
        snapshot.forEach((doc) => {
          staffData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setStaffList(staffData);
        setLoadingStaff(false);
      },
      (error) => {
        console.error("Error fetching staff:", error);
        setLoadingStaff(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Check username uniqueness
  const checkUsernameExists = async (username) => {
    const q = query(collection(db, "staff"), where("username", "==", username.trim()));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  // Generate random password
  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(password);
  };

  // Handle username validation
  const handleUsernameChange = async (value) => {
    setUsername(value);
    setUsernameError("");

    if (value.length > 0 && value.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }

    if (value.length >= 3) {
      const exists = await checkUsernameExists(value);
      if (exists) {
        setUsernameError("Username already taken");
      }
    }
  };

  // Create staff account
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setSuccessMessage("");

    // Validation
    if (!staffName.trim() || !username.trim() || !tempPassword.trim()) {
      showNotification("Please fill in all fields.", "error");
      return;
    }

    if (username.length < 3) {
      showNotification("Username must be at least 3 characters.", "error");
      return;
    }

    if (tempPassword.length < 6) {
      showNotification("Password must be at least 6 characters.", "error");
      return;
    }

    // Check username uniqueness
    const usernameExists = await checkUsernameExists(username);
    if (usernameExists) {
      showNotification("Username already exists. Please choose a different username.", "error");
      return;
    }

    setIsLoading(true);

    try {
      // Generate unique email for Firebase Auth
      const email = `${username.trim().toLowerCase()}@cafepiranha.internal`;

      // Create Firebase Authentication account
      const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
      const user = userCredential.user;

      // Generate staff ID
      const staffId = `CP${Date.now().toString().slice(-4)}`;

      // Create staff profile in Firestore
      const staffProfile = {
        staffName: staffName.trim(),
        username: username.trim(),
        email: email,
        staffId: staffId,
        createdAt: new Date().toISOString(),
        isFirstLogin: true,
        createdBy: "admin",
        totalHours: 0,
        sessionsCount: 0,
        uid: user.uid,
      };

      await setDoc(doc(db, "staff", user.uid), staffProfile);

      // Success!
      setSuccessMessage(
        `✅ Account created successfully!\n\nUsername: ${username}\nTemporary Password: ${tempPassword}\n\nStaff ID: ${staffId}\n\nPlease provide these credentials to ${staffName}.`
      );

      // Reset form
      setStaffName("");
      setUsername("");
      setTempPassword("");
      setShowCreateForm(false);

      // Logout the created user (admin is still logged in separately)
      await auth.signOut();

    } catch (error) {
      console.error("Account creation error:", error);
      if (error.code === "auth/email-already-in-use") {
        showNotification("❌ Account already exists. Please use a different username.", "error");
      } else if (error.code === "auth/weak-password") {
        showNotification("❌ Password is too weak. Please use a stronger password.", "error");
      } else {
        showNotification("❌ Account creation failed: " + error.message, "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Notification helper
  const showNotification = (msg, type = "info") => {
    alert(msg); // Replace with toast notification in production
  };

  // Generate random password for reset
  const generateResetPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Open reset password modal
  const handleOpenResetModal = (staff) => {
    setSelectedStaff(staff);
    setNewPassword(generateResetPassword());
    setResetModalOpen(true);
  };

  // Close reset password modal
  const handleCloseResetModal = () => {
    setResetModalOpen(false);
    setSelectedStaff(null);
    setNewPassword("");
  };

  // Handle password reset
  const handleResetPassword = async () => {
    if (!selectedStaff || !newPassword) {
      showNotification("Error: Missing staff information or password", "error");
      return;
    }

    if (newPassword.length < 6) {
      showNotification("Password must be at least 6 characters", "error");
      return;
    }

    setResettingPassword(true);

    try {
      // Update staff document to indicate password has been reset
      await updateDoc(doc(db, "staff", selectedStaff.id), {
        isFirstLogin: true,
        passwordResetAt: new Date().toISOString(),
        passwordResetBy: "admin"
      });

      // Show success message with credentials
      const message = `✅ Password Reset Successful!\n\nStaff: ${selectedStaff.staffName}\nUsername: ${selectedStaff.username}\nNew Password: ${newPassword}\n\n⚠️ Important: Please provide these credentials to ${selectedStaff.staffName}. They will need to change this password on first login.\n\n📋 Copy this information before closing.`;
      
      setSuccessMessage(message);
      handleCloseResetModal();

      showNotification("Password reset successfully! Please provide the new credentials to the staff member.", "success");

    } catch (error) {
      console.error("Password reset error:", error);
      showNotification("❌ Password reset failed: " + error.message, "error");
    } finally {
      setResettingPassword(false);
    }
  };

  // Navigation helpers
  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (error) {
      console.error("Navigation error:", error);
      window.location.href = path;
    }
  };

  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  const handleLogout = () => {
    if (onLogout && typeof onLogout === "function") {
      onLogout();
    }
  };

  return (
    <div className="staff-accounts-page">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-logo">👥</div>
            <div className="brand-text">
              <div className="brand-title">Staff Accounts</div>
              <div className="brand-subtitle">Manage User Accounts</div>
            </div>
          </div>
          
          <button className="logout-btn" onClick={handleLogout}>
            <span className="logout-icon">🚪</span>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-main">
        {/* Success Message */}
        {successMessage && (
          <div className="success-banner">
            <div className="success-icon">✅</div>
            <div className="success-text">
              <pre>{successMessage}</pre>
            </div>
            <button 
              className="close-banner"
              onClick={() => setSuccessMessage("")}
            >
              ✕
            </button>
          </div>
        )}

        {/* Create Account Section */}
        <section className="content-section">
          <div className="section-header">
            <h2>Create New Account</h2>
            <button 
              className={`toggle-form-btn ${showCreateForm ? 'cancel' : 'create'}`}
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <span className="btn-icon">{showCreateForm ? "✕" : "+"}</span>
              <span className="btn-text">
                {showCreateForm ? "Cancel" : "Create Account"}
              </span>
            </button>
          </div>

          {showCreateForm && (
            <div className="create-form-container">
              <form onSubmit={handleCreateAccount} className="create-account-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Staff Name *
                      <span className="label-help">Full name of the staff member</span>
                    </label>
                    <input
                      type="text"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g., John Doe"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Username *
                      <span className="label-help">Login username (min. 3 characters)</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      placeholder="e.g., johndoe"
                      className={`form-input ${usernameError ? "input-error" : ""}`}
                      required
                      minLength={3}
                    />
                    {usernameError && (
                      <span className="error-message">⚠️ {usernameError}</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Temporary Password *
                    <span className="label-help">Staff will change on first login</span>
                  </label>
                  <div className="password-input-group">
                    <input
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Enter temporary password"
                      className="form-input"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="generate-btn"
                      onClick={generatePassword}
                    >
                      <span className="generate-icon">🎲</span>
                      <span className="generate-text">Generate</span>
                    </button>
                  </div>
                </div>

                <div className="form-info">
                  <div className="info-icon">ℹ️</div>
                  <div className="info-text">
                    <strong>Important:</strong> Save the username and temporary password. 
                    Staff will need these for first login and must set a new password.
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className={`submit-btn ${isLoading ? "loading" : ""}`}
                    disabled={isLoading || usernameError}
                  >
                    {isLoading ? (
                      <>
                        <div className="spinner"></div>
                        <span className="btn-loading-text">Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">👤</span>
                        <span className="btn-text">Create Staff Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* Staff List Section */}
        <section className="content-section">
          <div className="section-header">
            <h2>All Staff Accounts</h2>
            <span className="staff-count">{staffList.length} total</span>
          </div>

          {loadingStaff ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading staff accounts...</p>
            </div>
          ) : staffList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>No staff accounts created yet</p>
              <button 
                className="create-first-btn"
                onClick={() => setShowCreateForm(true)}
              >
                <span className="btn-icon">+</span>
                <span className="btn-text">Create First Account</span>
              </button>
            </div>
          ) : (
            <div className="staff-list-container">
              <div className="staff-table-container">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Staff ID</th>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Reset Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((staff) => (
                      <tr key={staff.id}>
                        <td className="staff-id">{staff.staffId}</td>
                        <td className="staff-name">{staff.staffName}</td>
                        <td className="staff-username">@{staff.username}</td>
                        <td className="staff-date">
                          {new Date(staff.createdAt).toLocaleDateString()}
                        </td>
                        <td className="staff-status">
                          {staff.isFirstLogin ? (
                            <span className="badge badge-pending">Pending</span>
                          ) : (
                            <span className="badge badge-complete">Active</span>
                          )}
                        </td>
                        <td className="staff-actions">
                          <button
                            className="action-btn reset-btn"
                            onClick={() => handleOpenResetModal(staff)}
                            title="Reset Password"
                          >
                            <span className="action-icon">🔑</span>
                            <span className="action-text">Reset Password</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Password Reset Modal */}
      {resetModalOpen && selectedStaff && (
        <div className="modal-overlay" onClick={handleCloseResetModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔑 Reset Password</h3>
              <button className="modal-close" onClick={handleCloseResetModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="staff-info-box">
                <div className="info-row">
                  <span className="info-label">Staff Name:</span>
                  <span className="info-value">{selectedStaff.staffName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Staff ID:</span>
                  <span className="info-value">{selectedStaff.staffId}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Username:</span>
                  <span className="info-value">@{selectedStaff.username}</span>
                </div>
              </div>

              <div className="password-section">
                <label className="form-label">
                  New Temporary Password
                  <span className="label-help">Staff must change on first login</span>
                </label>
                <div className="password-input-group">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                    placeholder="Enter new password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="generate-btn"
                    onClick={() => setNewPassword(generateResetPassword())}
                  >
                    <span className="generate-icon">🎲</span>
                    <span className="generate-text">Generate</span>
                  </button>
                </div>
              </div>

              <div className="warning-box">
                <div className="warning-icon">⚠️</div>
                <div className="warning-text">
                  <strong>Important:</strong> After resetting, save the new password and provide it to {selectedStaff.staffName}. 
                  The staff member will need to log in with this password and set a new one.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={handleCloseResetModal}
                disabled={resettingPassword}
              >
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={handleResetPassword}
                disabled={resettingPassword || newPassword.length < 6}
              >
                {resettingPassword ? (
                  <>
                    <div className="spinner-small"></div>
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <span>🔑</span>
                    <span>Reset Password</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-navigation">
        <button
          className={`nav-btn ${isActiveRoute('/admin') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>

        <button
          className={`nav-btn ${isActiveRoute('/admin/salary') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/salary')}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-label">Salary</span>
        </button>

        <button
          className={`nav-btn ${isActiveRoute('/admin/accounts') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/accounts')}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">Accounts</span>
        </button>

        <button
          className={`nav-btn ${isActiveRoute('/admin/ot') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/ot')}
        >
          <span className="nav-icon">⏰</span>
          <span className="nav-label">OT</span>
        </button>

        <button
          className={`nav-btn ${isActiveRoute('/admin/availability') ? 'active' : ''}`}
          onClick={() => safeNavigate('/admin/availability')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">Schedule</span>
        </button>
      </nav>
    </div>
  );
}