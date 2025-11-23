# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


Reviewing key files to understand the project.


[6 tools called]


Reviewing key components and utilities:


[6 tools called]


Reviewing additional key files:


[4 tools called]


## **Cafe Piranha - Staff Management System**

### **Project Overview**
A React-based staff management system for Cafe Piranha (Ella, Sri Lanka) with real-time attendance tracking, salary management, and request handling.

---

## **Technology Stack**

### **Frontend**
- React 19.1.1
- React Router DOM 7.9.5
- Vite 7.1.7
- CSS3

### **Backend & Services**
- Firebase (Firestore, Authentication, Analytics, Cloud Messaging)
- Project: `cafe-pirana-attendance`

### **Key Libraries**
- `jspdf` & `jspdf-autotable` - PDF report generation
- `react-csv` - CSV export
- `file-saver` - File downloads
- `recharts` - Data visualization

---

## **Core Features**

### **1. Authentication System**
- Dual login:
  - Admin: `admin@cafepiranha.com` / `cafepirana2024`
  - Staff: Email/password registration and login
- Firebase Authentication
- Session persistence

### **2. Staff Dashboard**
- Clock in/out with location verification
  - GPS check (within 100m of cafe)
  - Coordinates: 6.871796, 81.057271
- Real-time session timer
- Shift management:
  - Shift date logic (shifts after 6 PM count for next day)
  - Night shift detection
  - Cross-midnight tracking
- Overtime/Short time calculation:
  - Full shift: 12 hours (43,200 seconds)
  - Interval: 1 hour (3,600 seconds)
  - Rate: Configurable per staff (default Rs. 200/hour)
- Daily summary with adjustments
- Session history

### **3. Admin Dashboard**
- Real-time attendance monitoring
- Active staff tracking with live timers
- Session management:
  - Filter by shift date
  - View all sessions
  - Staff performance summaries
- Export:
  - PDF reports (executive summary, staff performance, detailed sessions)
  - CSV data export
- Data management:
  - Clear date-specific data
  - Clear all data (with confirmation)
- Statistics:
  - Total staff, active staff, total hours
  - Night shifts, cross-midnight sessions
  - Location verification stats

### **4. Salary Management**
- Staff salary setup:
  - Monthly salary
  - OT rate per staff
- Monthly salary calculation:
  - Base salary
  - OT adjustments
  - Advance deductions
  - Day-off calculations
- Salary history and reports
- Staff search and filtering

### **5. Advance Requests**
- Staff can request salary advances
- Admin approval/rejection workflow
- Request history tracking
- Status filtering (pending/approved/rejected)
- Amount tracking

### **6. Overtime/Adjustment Requests**
- Automatic OT/Short time calculation
- Request creation on shift end
- Admin approval workflow
- Adjustment tracking by month
- Integration with salary calculations

### **7. Staff Availability Management**
- Weekly availability setting
- Day-specific availability (Mon-Sun)
- Time range selection per day
- Admin view of all staff availability
- Monthly availability reports (PDF export)

### **8. Push Notifications**
- Firebase Cloud Messaging
- Admin notifications for pending requests
- Service worker for background notifications
- iOS limitations handled (notifications not supported in Safari)

---

## **Project Structure**

```
Cafe_Piranha/
├── src/
│   ├── Pages/
│   │   ├── Login.jsx                    # Staff login/registration
│   │   ├── AdminDashboard/
│   │   │   ├── AdminDashboard.jsx       # Main admin view
│   │   │   ├── SalaryManagement.jsx    # Salary setup & calculation
│   │   │   ├── AdvanceRequests.jsx     # Advance request management
│   │   │   ├── OTApprovals.jsx         # OT/Short time approvals
│   │   │   └── StaffAvailabilityView.jsx # View all staff availability
│   │   └── StaffDashboard/
│   │       ├── StaffDashboard.jsx      # Main staff view
│   │       ├── SalaryView.jsx          # Staff salary view
│   │       ├── RequestAdvance.jsx       # Request salary advance
│   │       └── StaffAvailability.jsx   # Set availability
│   ├── utils/
│   │   ├── notificationManager.js      # Push notification handler
│   │   └── pdfGenerator.js             # PDF report generation
│   ├── config/
│   │   └── dayOffRates.js              # Day-off rate configuration
│   ├── firebase.js                     # Firebase configuration
│   ├── App.jsx                         # Main app router & auth
│   └── main.jsx                        # App entry point
├── public/
│   └── firebase-messaging-sw.js        # Service worker for notifications
└── dist/                               # Production build
```

---

## **Key Business Logic**

### **Shift Date Calculation**
- Shifts starting after 6 PM are counted for the next day
- Used for attendance grouping and salary calculations

### **Overtime Calculation**
- Full shift: 12 hours (43,200 seconds)
- Overtime: Time beyond 12 hours
- Short time: Time less than 12 hours
- Calculated in 1-hour intervals
- Rate: Per-staff configurable (default Rs. 200/hour)

### **Location Verification**
- Required for clock in/out
- Must be within 100 meters of cafe location
- Uses Haversine formula for distance calculation

### **Salary Calculation Formula**
```
Final Salary = Base Salary 
             + OT Adjustments (if approved)
             - Short Time Deductions (if approved)
             - Approved Advances
             - Day-off Deductions
             + Day-off Bonuses (unused days)
```

---

## **Firebase Collections**

1. `staff` - Staff profiles
2. `sessions` - Attendance records
3. `salaries` - Staff salary configurations
4. `advanceRequests` - Salary advance requests
5. `adjustmentRequests` - OT/Short time adjustment requests
6. `staffAvailability` - Weekly availability schedules
7. `adminTokens` - Admin FCM tokens for notifications

---

## **Security Features**

- Firebase Authentication
- Admin-only routes
- Location-based clock in/out
- Confirmation dialogs for critical actions
- Secure logout with session cleanup

---

## **UI/UX Features**

- Responsive design
- Real-time updates via Firestore listeners
- Live timers for active sessions
- Loading states and progress indicators
- Empty states with helpful messages
- Color-coded status indicators
- Professional PDF reports with branding

---

## **Deployment**

- Built with Vite
- Static site hosting ready
- Service worker for PWA capabilities
- Firebase hosting compatible

---

## **Current Configuration**

- **Cafe Location**: Ella, Sri Lanka (6.871796, 81.057271)
- **Admin Email**: admin@cafepiranha.com
- **Max Distance**: 100 meters for location verification
- **Full Shift Duration**: 12 hours
- **Default OT Rate**: Rs. 200/hour (configurable per staff)

---

## **Notable Features**

1. Real-time synchronization via Firestore
2. Location-based attendance verification
3. Shift-based date logic (6 PM cutoff)
4. Automatic OT/Short time calculation
5. PDF report generation
6. Push notifications for admins
7. Mobile-responsive design
8. Professional UI with animations

This is a production-ready staff management system for a cafe, with real-time tracking, salary management, and request workflows.
