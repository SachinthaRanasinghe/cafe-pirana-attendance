import { useState, useEffect } from "react";
import "./App.css";
import Login from "./Pages/Login.jsx";
import AdminDashboard from "./Pages/AdminDashboard.jsx"; 

function App() {
  const [allowed, setAllowed] = useState(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [coords, setCoords] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [progress, setProgress] = useState(0);

  // Admin login states
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Admin credentials
  const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "cafepirana2024"
  };

  // Allowed location (Cafe Piranha - Ella)
 const ALLOWED_LAT = 6.871796;  
const ALLOWED_LNG = 81.057271;

  const MAX_DISTANCE_METERS = 50;

  // Helper functions
  const toRad = (value) => (value * Math.PI) / 180;
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // meters
  };

  useEffect(() => {
    if (checking) {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return 90;
          return prev + 10;
        });
      }, 300);
      return () => clearInterval(timer);
    } else {
      setProgress(0);
    }
  }, [checking]);

  const checkLocation = () => {
    if (!navigator.geolocation) {
      setMessage("❌ Geolocation is not supported by your browser.");
      return;
    }

    setChecking(true);
    setAllowed(null);
    setMessage("📍 Initializing location services...");
    setProgress(10);

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProgress(80);
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });

        const distance = getDistance(latitude, longitude, ALLOWED_LAT, ALLOWED_LNG);

        setTimeout(() => {
          setProgress(100);
          if (distance <= MAX_DISTANCE_METERS) {
            setAllowed(true);
            setMessage("✅ Location Verified Successfully! Welcome to Cafe Piranha.");
            // Redirect to login after 2 seconds
            setTimeout(() => {
              setShowLogin(true);
            }, 2000);
          } else {
            setAllowed(false);
            setMessage(
              `❌ Access Restricted. You're ${distance.toFixed(1)}m away from Cafe Piranha. Please visit our Ella location to continue.`
            );
          }
          setChecking(false);
        }, 800);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setChecking(false);
        setProgress(0);
        if (err.code === 1)
          setMessage("🚫 Location access denied. Please enable location services in your browser settings.");
        else if (err.code === 2)
          setMessage("⚠️ Location services unavailable. Please check your connection and try again.");
        else if (err.code === 3)
          setMessage("⏱️ Location request timeout. Please ensure you have a stable connection.");
        else setMessage("❌ Unable to determine location. Please refresh and try again.");
      },
      options
    );
  };

  // Admin Login Handler
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
        setAdminLoggedIn(true);
      } else {
        alert("Invalid admin credentials!");
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleAdminLogout = () => {
    setAdminLoggedIn(false);
    setAdminUsername("");
    setAdminPassword("");
    setShowAdminLogin(false);
  };

  const handleBackToLocation = () => {
    setShowAdminLogin(false);
    setAdminUsername("");
    setAdminPassword("");
  };

  // Show admin dashboard if admin is logged in
  if (adminLoggedIn) {
    return <AdminDashboard onLogout={handleAdminLogout} />;
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
              Administrator Access
            </p>
          </div>

          {/* Admin Login Form */}
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
                onClick={handleBackToLocation}
              >
                ← Back to Location Verification
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="security-notice">
            <div className="security-icon">🔒</div>
            <p>
              Administrative access only. All activities are logged.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show login page if location is verified
  if (showLogin) {
    return <Login />;
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
                <p className="cafe-subtitle">Staff Portal</p>
              </div>
            </div>
          </div>
          <p className="tagline">Secure Access • Professional Environment</p>
          
          {/* Admin Access Button */}
          <div className="admin-access-section">
            <button 
              className="admin-access-btn"
              onClick={() => setShowAdminLogin(true)}
            >
              <span className="admin-icon">⚙️</span>
              Admin Access
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="content">
          <div className="welcome-card">
            <div className="card-header">
              <div className="header-icon">📍</div>
              <h2>Location Verification</h2>
              <p className="card-subtitle">Employee Access Control System</p>
            </div>
            
            <p className="description">
              To maintain security and ensure proper attendance tracking, 
              access to the staff portal is restricted to Cafe Piranha premises in Ella, Sri Lanka.
            </p>

            <div className="requirements-grid">
              <div className="requirement-card">
                <div className="requirement-icon">🏢</div>
                <div className="requirement-content">
                  <h4>Physical Presence</h4>
                  <p>Must be at Cafe Piranha location</p>
                </div>
              </div>
              <div className="requirement-card">
                <div className="requirement-icon">📏</div>
                <div className="requirement-content">
                  <h4>Proximity Check</h4>
                  <p>Within 50 meters radius</p>
                </div>
              </div>
              <div className="requirement-card">
                <div className="requirement-icon">👥</div>
                <div className="requirement-content">
                  <h4>Staff Only</h4>
                  <p>Authorized personnel access</p>
                </div>
              </div>
            </div>

            <div className="verification-section">
              <div className="verification-header">
                <h3>Verify Your Location</h3>
                <div className="signal-indicator">
                  <div className={`signal-dot ${checking ? 'active' : ''}`}></div>
                  <div className={`signal-dot ${checking ? 'active' : ''}`}></div>
                  <div className={`signal-dot ${checking ? 'active' : ''}`}></div>
                </div>
              </div>

              {checking && (
                <div className="progress-container">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{progress}%</span>
                </div>
              )}

              <button
                onClick={checkLocation}
                disabled={checking}
                className={`verify-btn ${checking ? 'loading' : ''} ${allowed ? 'success' : ''}`}
              >
                {checking ? (
                  <>
                    <div className="spinner"></div>
                    <span>Scanning Location...</span>
                  </>
                ) : allowed ? (
                  <>
                    <span className="btn-icon">✅</span>
                    <span>Access Granted</span>
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🌐</span>
                    <span>Verify Location</span>
                  </>
                )}
              </button>

              <p className="verification-note">
                Secure location verification ensures system integrity and accurate time tracking
              </p>
            </div>

            {/* Status Message */}
            {message && (
              <div className={`status-message ${allowed ? 'success' : allowed === false ? 'error' : 'info'}`}>
                <div className="status-content">
                  <div className="status-icon">
                    {allowed && (
                      <div className="success-animation">
                        <div className="checkmark">✓</div>
                      </div>
                    )}
                    {allowed === false && '❌'}
                    {!allowed && allowed !== false && '📍'}
                  </div>
                  <div className="status-text">
                    <p>{message}</p>
                    {allowed && (
                      <div className="redirect-notice">
                        <div className="pulse-dot"></div>
                        <span>Preparing your dashboard...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Coordinates Display */}
            {coords && (
              <div className="coordinates-card">
                <div className="coordinates-header">
                  <h4>📍 Location Data</h4>
                  <span className="coordinates-badge">Live</span>
                </div>
                <div className="coords-grid">
                  <div className="coord-group">
                    <label>Your Position</label>
                    <div className="coord-values">
                      <div className="coord-item">
                        <span className="coord-label">Latitude</span>
                        <span className="coord-value">{coords.latitude.toFixed(6)}</span>
                      </div>
                      <div className="coord-item">
                        <span className="coord-label">Longitude</span>
                        <span className="coord-value">{coords.longitude.toFixed(6)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="coord-group">
                    <label>Cafe Location</label>
                    <div className="coord-values">
                      <div className="coord-item">
                        <span className="coord-label">Latitude</span>
                        <span className="coord-value">{ALLOWED_LAT.toFixed(6)}</span>
                      </div>
                      <div className="coord-item">
                        <span className="coord-label">Longitude</span>
                        <span className="coord-value">{ALLOWED_LNG.toFixed(6)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                <p>This system employs advanced location verification to ensure authorized access only. All activities are monitored and logged.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;