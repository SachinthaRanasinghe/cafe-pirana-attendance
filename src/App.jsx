import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { notificationManager } from "./utils/notificationManager.js"; 
import "./App.css";

// ✅ CORRECT lazy imports with proper syntax
const Login = lazy(() => import("./Pages/Login.jsx"));

// Admin Pages
const AdminDashboard = lazy(() => import("./Pages/AdminDashboard/AdminDashboard.jsx"));
const SalaryManagement = lazy(() => import("./Pages/AdminDashboard/SalaryManagement.jsx"));
const AdvanceRequests = lazy(() => import("./Pages/AdminDashboard/AdvanceRequests.jsx"));
const OTApprovals = lazy(() => import("./Pages/AdminDashboard/OTApprovals.jsx"));
const StaffAvailabilityView = lazy(() => import("./Pages/AdminDashboard/StaffAvailabilityView.jsx"));
const StaffAccounts = lazy(() => import("./Pages/AdminDashboard/StaffAccounts.jsx"));
const MonthlyDayOffReport = lazy(() => import("./Pages/AdminDashboard/MonthlyDayOffReport.jsx"));

// Staff Pages  
const StaffDashboard = lazy(() => import("./Pages/StaffDashboard/StaffDashboard.jsx"));
const SalaryView = lazy(() => import("./Pages/StaffDashboard/SalaryView.jsx"));
const RequestAdvance = lazy(() => import("./Pages/StaffDashboard/RequestAdvance.jsx"));
const StaffAvailability = lazy(() => import("./Pages/StaffDashboard/StaffAvailability.jsx"));

// Import Assets
import CafeLogo from "./Logo/logo.PNG";

// Constants for better maintainability
const APP_CONFIG = {
  ADMIN_CREDENTIALS: {
    email: "admin@cafepiranha.com",
    password: process.env.REACT_APP_ADMIN_PASSWORD || "cafepirana2024"
  },
  ROUTES: {
    ADMIN: {
      DASHBOARD: "/admin",
      SALARY: "/admin/salary",
      ACCOUNTS: "/admin/accounts",
      ADVANCES: "/admin/advances",
      OT_APPROVALS: "/admin/ot-approvals",
      AVAILABILITY: "/admin/availability",
      DAYOFF_REPORT: "/admin/dayoff-report"
    },
    STAFF: {
      DASHBOARD: "/staff",
      SALARY: "/staff/salary",
      ADVANCE: "/staff/advance",
      AVAILABILITY: "/staff/availability"
    }
  }
};

// Service Worker Registration
const registerServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((reg) => console.log("Service Worker registered successfully"))
      .catch((err) => console.error("Service Worker registration failed:", err));
  }
};

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

// Extracted Admin Login Component for better readability
const AdminLoginView = ({ 
  adminEmail, 
  adminPassword, 
  isLoading, 
  onEmailChange, 
  onPasswordChange, 
  onSubmit, 
  onBack 
}) => (
  <div className="app">
    <div className="login-container admin-login">
      <div className="login-header">
        <div className="cafe-brand">
          <div className="cafe-logo">
            <img src={CafeLogo} alt="Cafe Piranha" className="logo-image" />
          </div>
          <div className="brand-text">
            <h1 className="cafe-name">Cafe Piranha</h1>
            <p className="cafe-subtitle">Administrator Portal</p>
          </div>
        </div>
        <p className="login-subtitle">Secure System Access</p>
      </div>

      <form onSubmit={onSubmit} className="login-form">
        <div className="input-group">
          <label htmlFor="adminEmail" className="input-label">
            Administrator Email
          </label>
          <input
            id="adminEmail"
            type="email"
            placeholder="administrator@cafepiranha.com"
            value={adminEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className="form-input"
            required
            disabled={isLoading}
          />
        </div>

        <div className="input-group">
          <label htmlFor="adminPassword" className="input-label">
            Administrator Password
          </label>
          <input
            id="adminPassword"
            type="password"
            placeholder="Enter secure password"
            value={adminPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="form-input"
            required
            disabled={isLoading}
          />
        </div>

        <button 
          type="submit" 
          className={`login-btn admin-login-btn ${isLoading ? 'loading' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="spinner"></div>
              Authenticating...
            </>
          ) : (
            'Access Administration Panel'
          )}
        </button>

        <div className="form-switch">
          <button 
            type="button"
            className="back-btn"
            onClick={onBack}
            disabled={isLoading}
          >
            ← Return to Main Menu
          </button>
        </div>
      </form>
    </div>
  </div>
);

// Reusable Access Card Component
const AccessCard = ({ type, title, description, features, buttonText, onLogin }) => (
  <div className={`access-card ${type}-card`}>
    <div className="card-glow"></div>
    <div className="card-icon">{type === 'staff' ? '👥' : '⚙️'}</div>
    <div className="card-content">
      <h3>{title}</h3>
      <p>{description}</p>
      <ul className="feature-list">
        {features.map((feature, index) => (
          <li key={index}>{feature}</li>
        ))}
      </ul>
    </div>
    <button 
      className={`access-btn ${type}-btn`}
      onClick={onLogin}
    >
      <span className="btn-icon">🔑</span>
      {buttonText}
    </button>
  </div>
);

// Feature Item Component
const FeatureItem = ({ icon, text }) => (
  <div className="feature-item">
    <div className="feature-icon">{icon}</div>
    <span>{text}</span>
  </div>
);

// Features Section Component
const FeaturesSection = () => (
  <div className="features-section">
    <h3 className="features-title">Comprehensive Features</h3>
    <div className="features-grid">
      <FeatureItem icon="⏰" text="Time Tracking" />
      <FeatureItem icon="💰" text="Payroll Management" />
      <FeatureItem icon="📋" text="Advance Requests" />
      <FeatureItem icon="📅" text="Scheduling" />
    </div>
  </div>
);

// Security Footer Component
const SecurityFooter = () => (
  <div className="security-footer">
    <div className="security-badge">
      <div className="lock-icon">🔒</div>
      <span>Enterprise-Grade Security</span>
    </div>
  </div>
);

// Extracted Landing Page Component
const LandingPage = ({ onStaffLogin, onAdminLogin }) => (
  <div className="app">
    <div className="landing-container">
      <div className="background-animation">
        <div className="floating-coffee">☕</div>
        <div className="floating-croissant">🥐</div>
        <div className="floating-spoon">🥄</div>
        <div className="floating-bubble"></div>
        <div className="floating-bubble"></div>
        <div className="floating-bubble"></div>
      </div>

      <div className="main-content">
        <div className="hero-section">
          <div className="logo-container">
            <div className="main-logo">
              <img src={CafeLogo} alt="Cafe Piranha" className="hero-logo" />
              <div className="logo-shine"></div>
            </div>
            <h1 className="hero-title">
              Cafe <span className="brand-accent">Piranha</span>
            </h1>
            <p className="hero-subtitle">
              Workforce Management System
            </p>
          </div>
        </div>

        <div className="access-section">
          <div className="access-cards">
            <AccessCard
              type="staff"
              title="Team Portal"
              description="Employee workspace access"
              features={[
                "Track hours & compensation",
                "Submit advance requests",
                "Manage availability",
                "View schedules & shifts"
              ]}
              buttonText="Team Login"
              onLogin={onStaffLogin}
            />
            <AccessCard
              type="admin"
              title="Management Portal"
              description="Administrative system access"
              features={[
                "Team management",
                "Payroll processing",
                "Request approvals",
                "System administration"
              ]}
              buttonText="Management Login"
              onLogin={onAdminLogin}
            />
          </div>
        </div>

        <FeaturesSection />
        <SecurityFooter />
      </div>
    </div>
  </div>
);

// Main App Component
function App() {
  const [authState, setAuthState] = useState({
    showLogin: false,
    showAdminLogin: false,
    adminEmail: "",
    adminPassword: "",
    adminLoggedIn: false,
    staffLoggedIn: false,
    staffData: null,
    isLoading: false
  });

  // Consolidated state updates
  const updateAuthState = useCallback((updates) => {
    setAuthState(prev => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    registerServiceWorker();
    
    console.debug("App Initialization:", {
      userAgent: navigator.userAgent,
      notificationSupport: typeof Notification !== 'undefined',
      serviceWorkerSupport: 'serviceWorker' in navigator
    });

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && user.email === APP_CONFIG.ADMIN_CREDENTIALS.email) {
        updateAuthState({ adminLoggedIn: true });
        console.info("Admin authentication successful");
        
        if (typeof Notification !== 'undefined') {
          await notificationManager.requestPermission(user.uid);
        }
      }
    });

    return () => unsubscribe();
  }, [updateAuthState]);

  const handleStaffLogin = useCallback((staff) => {
    console.info("Staff login successful:", staff.name);
    updateAuthState({
      staffData: staff,
      staffLoggedIn: true,
      showLogin: false
    });
  }, [updateAuthState]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    
    const { adminEmail, adminPassword } = authState;
    
    if (!adminEmail || !adminPassword) {
      alert("Please enter both email and password.");
      return;
    }

    updateAuthState({ isLoading: true });
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const user = userCredential.user;
      
      if (user.email === APP_CONFIG.ADMIN_CREDENTIALS.email) {
        updateAuthState({
          adminLoggedIn: true,
          adminEmail: "",
          adminPassword: "",
          showAdminLogin: false
        });
        await notificationManager.requestPermission(user.uid);
      } else {
        await signOut(auth);
        alert("Access denied. Administrator credentials required.");
      }
    } catch (error) {
      console.error("Admin authentication error:", error);
      const errorMessages = {
        'auth/invalid-email': "Invalid email address format.",
        'auth/user-not-found': "No administrator account found with this email.",
        'auth/wrong-password': "Incorrect password. Please try again.",
        'auth/too-many-requests': "Too many failed attempts. Please try again later.",
        'auth/network-request-failed': "Network error. Please check your connection."
      };
      
      alert(errorMessages[error.code] || "Authentication failed. Please try again.");
    } finally {
      updateAuthState({ isLoading: false });
    }
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      updateAuthState({
        adminLoggedIn: false,
        adminEmail: "",
        adminPassword: "",
        showAdminLogin: false
      });
    } catch (error) {
      console.error("Logout error:", error);
      alert("Logout failed. Please try again.");
    }
  };

  const handleStaffLogout = useCallback(() => {
    updateAuthState({
      staffLoggedIn: false,
      staffData: null,
      showLogin: false
    });
  }, [updateAuthState]);

  const handleBackToMain = useCallback(() => {
    updateAuthState({
      showAdminLogin: false,
      showLogin: false,
      adminEmail: "",
      adminPassword: ""
    });
  }, [updateAuthState]);

  const { 
    adminLoggedIn, 
    staffLoggedIn, 
    showAdminLogin, 
    showLogin, 
    adminEmail, 
    adminPassword, 
    isLoading, 
    staffData 
  } = authState;

  // Admin Routes
  if (adminLoggedIn) {
    return (
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path={APP_CONFIG.ROUTES.ADMIN.DASHBOARD} 
                   element={<AdminDashboard onLogout={handleAdminLogout} />} />
            <Route path={APP_CONFIG.ROUTES.ADMIN.SALARY} 
                   element={<SalaryManagement onLogout={handleAdminLogout} />} />
            <Route path={APP_CONFIG.ROUTES.ADMIN.ACCOUNTS} 
                   element={<StaffAccounts onLogout={handleAdminLogout} />} />
            <Route path={APP_CONFIG.ROUTES.ADMIN.ADVANCES} 
                   element={<AdvanceRequests onLogout={handleAdminLogout} />} />
            <Route path={APP_CONFIG.ROUTES.ADMIN.OT_APPROVALS} 
                   element={<OTApprovals onLogout={handleAdminLogout} />} />
            <Route path={APP_CONFIG.ROUTES.ADMIN.AVAILABILITY} 
                   element={<StaffAvailabilityView onLogout={handleAdminLogout} />} />
            <Route path={APP_CONFIG.ROUTES.ADMIN.DAYOFF_REPORT} 
                   element={<MonthlyDayOffReport onLogout={handleAdminLogout} />} />
            <Route path="*" element={<Navigate to={APP_CONFIG.ROUTES.ADMIN.DASHBOARD} replace />} />
          </Routes>
        </Suspense>
      </Router>
    );
  }

  // Staff Routes
  if (staffLoggedIn) {
    return (
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path={APP_CONFIG.ROUTES.STAFF.DASHBOARD} 
                   element={<StaffDashboard staffData={staffData} onLogout={handleStaffLogout} />} />
            <Route path={APP_CONFIG.ROUTES.STAFF.SALARY} 
                   element={<SalaryView staffData={staffData} onLogout={handleStaffLogout} />} />
            <Route path={APP_CONFIG.ROUTES.STAFF.ADVANCE} 
                   element={<RequestAdvance staffData={staffData} onLogout={handleStaffLogout} />} />
            <Route path={APP_CONFIG.ROUTES.STAFF.AVAILABILITY} 
                   element={<StaffAvailability staffData={staffData} onLogout={handleStaffLogout} />} />
            <Route path="*" element={<Navigate to={APP_CONFIG.ROUTES.STAFF.DASHBOARD} replace />} />
          </Routes>
        </Suspense>
      </Router>
    );
  }

  // Admin Login View
  if (showAdminLogin) {
    return <AdminLoginView 
      adminEmail={adminEmail}
      adminPassword={adminPassword}
      isLoading={isLoading}
      onEmailChange={(email) => updateAuthState({ adminEmail: email })}
      onPasswordChange={(password) => updateAuthState({ adminPassword: password })}
      onSubmit={handleAdminLogin}
      onBack={handleBackToMain}
    />;
  }

  // Staff Login View
  if (showLogin) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Login 
          onStaffLogin={handleStaffLogin} 
          onAdminLogin={() => updateAuthState({ showAdminLogin: true })} 
          onBack={handleBackToMain}
        />
      </Suspense>
    );
  }

  // Main Landing Page
  return <LandingPage onStaffLogin={() => updateAuthState({ showLogin: true })} 
                     onAdminLogin={() => updateAuthState({ showAdminLogin: true })} />;
}

export default App;