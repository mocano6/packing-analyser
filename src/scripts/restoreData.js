// src/scripts/restoreData.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  setDoc,
  deleteDoc,
  getDocs
} = require('firebase/firestore');
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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for confirmation
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Function to list all backup directories
function listBackupDirs() {
  const backupsPath = path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(backupsPath)) {
    console.log('⚠️ No backups directory found.');
    return [];
  }
  
  const dirs = fs.readdirSync(backupsPath)
    .filter(dir => {
      const dirPath = path.join(backupsPath, dir);
      return fs.statSync(dirPath).isDirectory();
    })
    .sort()
    .reverse(); // Most recent first
  
  return dirs;
}

// Function to get collection data from a backup
function getBackupData(backupDir, collectionName) {
  const filePath = path.join(process.cwd(), 'backups', backupDir, `${collectionName}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ No backup file found for ${collectionName}`);
    return [];
  }
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Error reading backup file for ${collectionName}:`, error);
    return [];
  }
}

// Function to clear a collection
async function clearCollection(collectionName) {
  console.log(`🗑️ Clearing collection: ${collectionName}...`);
  
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const deletePromises = [];
    
    querySnapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, collectionName, document.id)));
    });
    
    await Promise.all(deletePromises);
    console.log(`✅ Cleared ${deletePromises.length} documents from ${collectionName}`);
  } catch (error) {
    console.error(`❌ Error clearing collection ${collectionName}:`, error);
  }
}

// Function to restore data to a collection
async function restoreCollection(collectionName, data) {
  console.log(`📤 Restoring ${data.length} documents to ${collectionName}...`);
  
  try {
    const restorePromises = data.map(async (document) => {
      const { id, ...docData } = document;
      await setDoc(doc(db, collectionName, id), docData);
    });
    
    await Promise.all(restorePromises);
    console.log(`✅ Successfully restored ${data.length} documents to ${collectionName}`);
  } catch (error) {
    console.error(`❌ Error restoring collection ${collectionName}:`, error);
  }
}

// Main restore function
async function restoreData() {
  console.log('🔄 Firebase Database Restore Tool');
  console.log('--------------------------------');
  
  // List available backups
  const backupDirs = listBackupDirs();
  
  if (backupDirs.length === 0) {
    console.log('❌ No backups found. Run the backup script first.');
    rl.close();
    return;
  }
  
  console.log('\n📂 Available backups:');
  backupDirs.forEach((dir, index) => {
    console.log(`${index + 1}. ${dir}`);
  });
  
  // Select backup
  const selectedIndex = await askQuestion('\n🔍 Enter the number of the backup to restore: ');
  const selectedDir = backupDirs[parseInt(selectedIndex) - 1];
  
  if (!selectedDir) {
    console.log('❌ Invalid selection.');
    rl.close();
    return;
  }
  
  console.log(`\n📁 Selected backup: ${selectedDir}`);
  
  // Check metadata
  const metadataPath = path.join(process.cwd(), 'backups', selectedDir, 'metadata.json');
  let collections = ['teams', 'players', 'matches', 'actions'];
  
  if (fs.existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      console.log('\n📊 Backup contains:');
      
      for (const [collection, count] of Object.entries(metadata.counts)) {
        console.log(`- ${collection}: ${count} documents`);
      }
      
      collections = metadata.collections;
    } catch (error) {
      console.error('❌ Error reading metadata:', error);
    }
  }
  
  // Confirm restore
  const confirmRestore = await askQuestion('\n⚠️ WARNING: This will replace all existing data in the database!\n📝 Type "YES" to confirm: ');
  
  if (confirmRestore !== 'YES') {
    console.log('❌ Restore cancelled.');
    rl.close();
    return;
  }
  
  // Perform restore
  console.log('\n🚀 Starting restore process...');
  
  for (const collectionName of collections) {
    const data = getBackupData(selectedDir, collectionName);
    
    if (data.length > 0) {
      await clearCollection(collectionName);
      await restoreCollection(collectionName, data);
    } else {
      console.log(`⚠️ No data to restore for ${collectionName}, skipping...`);
    }
  }
  
  console.log('\n✅ Restore completed successfully!');
  rl.close();
}

// Run the restore
restoreData().catch(error => {
  console.error('\n❌ Error during restore:', error);
  rl.close();
}); 
restoreData(); 