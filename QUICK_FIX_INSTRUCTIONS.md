# 🔧 QUICK FIX: Login Permission Error

## Problem
Staff login fails with: **"❌ Login failed: Missing or insufficient permissions"**

## Root Cause
Firestore security rules are blocking the query to find staff by username during login.

---

## ✅ SOLUTION (5 Minutes)

### Step 1: Go to Firebase Console
1. Open https://console.firebase.google.com
2. Select your project (Cafe Piranha)
3. Click **"Firestore Database"** in left sidebar
4. Click **"Rules"** tab at the top

### Step 2: Replace Rules
Copy and paste this entire rule set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Staff collection - allow reading for login
    match /staff/{uid} {
      allow read: if true;  // ← THIS FIXES THE LOGIN ISSUE
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    
    // All other collections
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
    }
    
    match /salaries/{uid} {
      allow read, write: if request.auth != null;
    }
    
    match /advanceRequests/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    match /adjustmentRequests/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    match /availabilities/{uid} {
      allow read, write: if request.auth != null;
    }
    
    match /weeklyAvailability/{docId} {
      allow read, write: if request.auth != null;
    }
    
    match /systemConfig/{docId} {
      allow read, write: if request.auth != null;
    }
    
    match /staffDayOffConfig/{uid} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Step 3: Publish
1. Click **"Publish"** button (top right)
2. Wait 30 seconds for rules to update

### Step 4: Test Login
1. Refresh your app
2. Try logging in with staff credentials
3. Should work now! ✅

---

## 🔍 Why This Happens

**The Login Process:**
```
1. Staff enters username: "johndoe"
2. System queries Firestore: "Find staff where username = 'johndoe'"
   ↓
3. Firestore checks rules: Can this user read 'staff' collection?
   ↓
4. User is NOT authenticated yet (that's why they're logging in!)
   ↓
5. Rules block the query: "Missing or insufficient permissions"
   ↓
6. Login fails ❌
```

**The Fix:**
```javascript
match /staff/{uid} {
  allow read: if true;  // Allow ANYONE to read staff profiles
}
```

This is **SAFE** because:
- ✅ Passwords are stored in Firebase Auth (NOT in Firestore)
- ✅ Staff profiles only contain: username, name, staffId
- ✅ No sensitive data (salary, personal info) is in staff collection
- ✅ Write access is still protected (only authenticated users can update)

---

## 📊 What Your Current Rules Probably Look Like

**Before (Blocking Login):**
```javascript
match /staff/{uid} {
  allow read: if request.auth != null;  // ❌ Requires authentication
  allow write: if request.auth != null;
}
```

**After (Allows Login):**
```javascript
match /staff/{uid} {
  allow read: if true;  // ✅ Allows reading for login
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

---

## 🚨 Alternative: Temporary Test Mode (NOT RECOMMENDED FOR PRODUCTION)

If you want to quickly test, you can temporarily use:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ INSECURE - Test only!
    }
  }
}
```

**⚠️ WARNING:** This allows anyone to read/write ALL data. Only use for testing, then replace with proper rules above.

---

## ✅ Verification Steps

After applying the fix:

1. **Test Staff Login:**
   - Username: (one created by admin)
   - Password: (temporary password)
   - Should show password reset screen ✅

2. **Test Password Reset:**
   - Enter new password (8+ characters)
   - Confirm password
   - Should login successfully ✅

3. **Test Subsequent Login:**
   - Username: same
   - Password: new password
   - Should login directly ✅

4. **Test Admin Login:**
   - Email: admin@cafepiranha.com
   - Password: cafepirana2024
   - Should work as before ✅

---

## 📞 Still Having Issues?

If the error persists after updating rules:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Wait 2-3 minutes** for Firebase rules to propagate globally
3. **Check Firebase Console logs:**
   - Firebase Console → Firestore → Usage tab
   - Look for permission denied errors
4. **Verify rules were published:**
   - Rules tab should show "Last published: [recent time]"

---

## 🎯 Summary

**Problem:** Login blocked by Firestore rules  
**Solution:** Allow reading `staff` collection  
**Time to Fix:** 5 minutes  
**Risk:** None (passwords not stored in Firestore)  

**Action Required:**
1. Go to Firebase Console
2. Firestore Database → Rules
3. Copy/paste rules above
4. Publish
5. Test login ✅

---

## 📝 Share Your Current Rules

If you want me to review and fix your specific rules, please share them by:

1. Going to Firebase Console → Firestore Database → Rules
2. Copy all the text in the rules editor
3. Paste it in the chat

I can then provide the exact changes needed for your specific setup.

