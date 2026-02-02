// src/scripts/backupData.js
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collections to backup (PII pozostaje tylko w players)
const BASE_COLLECTIONS = ['teams', 'players', 'matches', 'actions', 'gps'];
const ARCHIVE_SUFFIX = '_archive';
const EXTRA_ARCHIVE_COLLECTIONS = (process.env.BACKUP_ARCHIVE_COLLECTIONS || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const ARCHIVE_COLLECTIONS = Array.from(new Set([
  ...BASE_COLLECTIONS.map((name) => `${name}${ARCHIVE_SUFFIX}`),
  ...EXTRA_ARCHIVE_COLLECTIONS
]));
const COLLECTIONS = [...BASE_COLLECTIONS, ...ARCHIVE_COLLECTIONS];

// Function to get all documents from a collection
async function getCollectionData(collectionName) {
  console.log(`📥 Fetching documents from ${collectionName}...`);
  
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const documents = [];
    
    querySnapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Retrieved ${documents.length} documents from ${collectionName}`);
    return documents;
  } catch (error) {
    console.error(`❌ Error fetching ${collectionName}:`, error);
    return [];
  }
}

// Function to create backup directory
function createBackupDir() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', timestamp);
  
  if (!fs.existsSync(path.join(process.cwd(), 'backups'))) {
    fs.mkdirSync(path.join(process.cwd(), 'backups'));
  }
  
  fs.mkdirSync(backupDir);
  return backupDir;
}

// Function to save data to a JSON file
function saveDataToFile(data, filePath) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Error saving file ${filePath}:`, error);
    return false;
  }
}

// Main backup function
async function backupData() {
  console.log('🚀 Starting database backup...');
  
  try {
    // Create backup directory
    const backupDir = createBackupDir();
    console.log(`📁 Created backup directory: ${backupDir}`);
    
    // Backup each collection
    for (const collectionName of COLLECTIONS) {
      const data = await getCollectionData(collectionName);
      
      if (data.length > 0) {
        const filePath = path.join(backupDir, `${collectionName}.json`);
        const success = saveDataToFile(data, filePath);
        
        if (success) {
          console.log(`✅ Backed up ${collectionName} to ${filePath}`);
        }
      } else {
        console.log(`⚠️ No data found in ${collectionName}, skipping...`);
      }
    }
    
    // Create metadata file
    const metadataPath = path.join(backupDir, 'metadata.json');
    const metadata = {
      timestamp: new Date().toISOString(),
      collections: COLLECTIONS,
      counts: {}
    };
    
    // Count documents in each collection
    for (const collectionName of COLLECTIONS) {
      const filePath = path.join(backupDir, `${collectionName}.json`);
      
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath));
        metadata.counts[collectionName] = data.length;
      } else {
        metadata.counts[collectionName] = 0;
      }
    }
    
    saveDataToFile(metadata, metadataPath);
    console.log(`✅ Created backup metadata at ${metadataPath}`);
    
    console.log('\n✅ Backup completed successfully!');
    console.log(`📁 Backup stored in: ${backupDir}`);
    
    // Print document counts
    console.log('\n📊 Document counts:');
    for (const [collection, count] of Object.entries(metadata.counts)) {
      console.log(`- ${collection}: ${count} documents`);
    }
  } catch (error) {
    console.error('\n❌ Error during backup:', error);
  }
}

// Run the backup
backupData(); 