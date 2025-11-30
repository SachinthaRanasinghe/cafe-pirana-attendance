# 🚀 PROJECT SETUP GUIDE

## For New Team Members

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd <project-folder>
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your Firebase credentials
# (Get these from your team lead or Firebase Console)
nano .env  # or use your preferred editor
```

### 4. Verify Setup
```bash
# This will generate the Firebase config for service workers
npm run predev

# You should see: ✅ Firebase config generated successfully
```

### 5. Run Development Server
```bash
npm run dev
```

### 6. Build for Production
```bash
npm run build
```

---

## 🔐 Getting Firebase Credentials

**Option A:** Ask your team lead for the `.env` file  
**Option B:** Get them from Firebase Console:

1. Go to: https://console.firebase.google.com
2. Select project: `cafe-pirana-attendance`
3. Go to: Project Settings → General
4. Scroll to "Your apps" section
5. Copy the configuration values
6. Paste them into your `.env` file

---

## 🛠️ Available Scripts

- `npm run dev` - Start development server (auto-generates config)
- `npm run build` - Build for production (auto-generates config)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

---

## 📁 Important Files

- `.env` - Your Firebase credentials (NEVER commit!)
- `.env.example` - Template for `.env` file
- `firestore.rules` - Database security rules
- `scripts/generate-firebase-config.js` - Generates service worker config

---

## ⚠️ IMPORTANT: Never Commit

- ❌ `.env` file
- ❌ `public/firebase-config.js` (auto-generated)

These are automatically ignored by `.gitignore`.

---

## 🆘 Troubleshooting

### Error: "Firebase configuration is missing"
**Solution:** Make sure your `.env` file exists and contains all required variables

### Error: "Missing required environment variables"
**Solution:** Check that all variables in `.env.example` are in your `.env` file

### Error: "Permission denied" on login
**Solution:** Make sure Firestore rules are deployed:
```bash
firebase deploy --only firestore:rules
```

---

## 📚 Documentation

- `FIREBASE_SECURITY_GUIDE.md` - Security best practices
- `FIRESTORE_RULES_DEPLOYMENT_GUIDE.md` - How to deploy database rules
- `GITHUB_CLEANUP_GUIDE.md` - How to secure your GitHub repo

---

**Questions?** Contact your team lead or check the documentation files.
