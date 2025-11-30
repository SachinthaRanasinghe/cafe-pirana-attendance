// Script to generate Firebase config for service worker from environment variables
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');

// Load .env file
dotenv.config({ path: envPath });

// Read environment variables
const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Validate that all required values are present
const missingVars = Object.entries(config)
  .filter(([key, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n💡 Make sure your .env file exists and contains all Firebase credentials.');
  process.exit(1);
}

// Generate the config file
const configContent = `// This file is auto-generated - DO NOT EDIT
// Generated from environment variables for service worker use
self.FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};
`;

// Write to public directory
const outputPath = path.join(__dirname, '../public/firebase-config.js');
fs.writeFileSync(outputPath, configContent);

console.log('✅ Firebase config generated successfully for service worker');
