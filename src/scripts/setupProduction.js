const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
require('dotenv').config();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Generate a secure random string
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Function to update .env file
async function updateEnvFile() {
  console.log('\n📝 Updating environment variables...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, value] = trimmed.split('=');
      if (key && value) {
        acc[key] = value;
      }
    }
    return acc;
  }, {});
  
  // Check for required Firebase config variables
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];
  
  let missingVars = false;
  
  for (const varName of requiredVars) {
    if (!envVars[varName]) {
      missingVars = true;
      const value = await askQuestion(`Enter value for ${varName}: `);
      envVars[varName] = value;
    }
  }
  
  // Add API secret key if not present
  if (!envVars['API_SECRET_KEY']) {
    console.log('\n🔑 Generating API secret key...');
    envVars['API_SECRET_KEY'] = generateSecureToken();
  }
  
  // Add app environment if not present
  if (!envVars['NODE_ENV']) {
    const env = await askQuestion('\nSelect environment (development/production): ');
    envVars['NODE_ENV'] = env.toLowerCase() === 'production' ? 'production' : 'development';
  }
  
  // Write updated env file
  const newEnvContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  fs.writeFileSync(envPath, newEnvContent);
  console.log('✅ Environment variables updated successfully!');
  
  return envVars;
}

// Function to update or create firestore.rules
function updateFirestoreRules() {
  console.log('\n🔒 Updating Firestore security rules...');
  
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const productionRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Secure by default
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Teams collection
    match /teams/{teamId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    
    // Players collection
    match /players/{playerId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    
    // Matches collection
    match /matches/{matchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Actions collection
    match /actions/{actionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Settings and configurations
    match /settings/{settingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}`;

  fs.writeFileSync(rulesPath, productionRules);
  console.log('✅ Firestore security rules updated!');
}

// Function to create a production-ready .gitignore
function updateGitignore() {
  console.log('\n📝 Updating .gitignore file...');
  
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let gitignoreContent = '';
  
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }
  
  const entries = gitignoreContent.split('\n');
  const requiredEntries = [
    '# dependencies',
    'node_modules',
    '/.pnp',
    '.pnp.js',
    '# testing',
    '/coverage',
    '# next.js',
    '/.next/',
    '/out/',
    'next-env.d.ts',
    '# production',
    '/build',
    '# misc',
    '.DS_Store',
    '*.pem',
    '# debug',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    '# env files',
    '.env',
    '.env.local',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local',
    '# vercel',
    '.vercel',
    '# backups',
    '/backups'
  ];
  
  for (const entry of requiredEntries) {
    if (!entries.includes(entry)) {
      entries.push(entry);
    }
  }
  
  fs.writeFileSync(gitignorePath, entries.join('\n'));
  console.log('✅ .gitignore updated!');
}

// Function to create/update README.md with deployment instructions
function updateReadme() {
  console.log('\n📝 Updating README.md...');
  
  const readmePath = path.join(process.cwd(), 'README.md');
  let readmeContent = '';
  
  if (fs.existsSync(readmePath)) {
    readmeContent = fs.readFileSync(readmePath, 'utf8');
  }
  
  // If README doesn't exist or doesn't have deployment instructions
  if (!readmeContent.includes('## Deployment')) {
    const deploymentInstructions = `
## Deployment

To deploy this application to production:

1. Ensure you have completed the setup by running:
   \`\`\`
   node src/scripts/setupProduction.js
   \`\`\`

2. Build the application:
   \`\`\`
   npm run build
   \`\`\`

3. Start the production server:
   \`\`\`
   npm start
   \`\`\`

### Environment Variables

Make sure the following environment variables are properly set in your production environment:

- \`NEXT_PUBLIC_FIREBASE_API_KEY\`
- \`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\`
- \`NEXT_PUBLIC_FIREBASE_PROJECT_ID\`
- \`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET\`
- \`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID\`
- \`NEXT_PUBLIC_FIREBASE_APP_ID\`
- \`API_SECRET_KEY\`
- \`NODE_ENV=production\`

### Database Backups

To backup your Firestore data:
\`\`\`
node src/scripts/backupData.js
\`\`\`

To restore from a backup:
\`\`\`
node src/scripts/restoreData.js
\`\`\`
`;

    // Append to existing content or create new README
    if (readmeContent) {
      readmeContent += deploymentInstructions;
    } else {
      readmeContent = `# Packing Analyzer

A football analytics application for tracking and analyzing player actions, packing rates, and match statistics.
${deploymentInstructions}`;
    }
    
    fs.writeFileSync(readmePath, readmeContent);
    console.log('✅ README.md updated with deployment instructions!');
  } else {
    console.log('✅ README.md already contains deployment instructions.');
  }
}

// Function to ensure backups directory exists
function ensureBackupsDirectory() {
  console.log('\n📂 Setting up backups directory...');
  
  const backupsDir = path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
    console.log('✅ Created backups directory!');
  } else {
    console.log('✅ Backups directory already exists!');
  }
}

// Main function to run setup
async function setupProduction() {
  console.log('🚀 Starting production setup...');
  
  try {
    // Update environment variables
    const envVars = await updateEnvFile();
    
    // Update Firestore rules
    updateFirestoreRules();
    
    // Update .gitignore
    updateGitignore();
    
    // Update README.md
    updateReadme();
    
    // Ensure backups directory exists
    ensureBackupsDirectory();
    
    console.log('\n✅ Production setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Deploy Firestore security rules to Firebase');
    console.log('2. Build your application: npm run build');
    console.log('3. Start in production mode: npm start');
    
    // Log environment for confirmation
    console.log(`\nCurrent environment: ${envVars['NODE_ENV'] || 'Not set'}`);
  } catch (error) {
    console.error('\n❌ Error during production setup:', error);
  } finally {
    rl.close();
  }
}

// Run the setup
setupProduction(); 