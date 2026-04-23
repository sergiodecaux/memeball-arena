/**
 * Скрипт для установки конкретной версии
 * Использование: node scripts/set-version.cjs 2.0.0
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'public', 'version.json');
const VERSION_CHECKER_FILE = path.join(ROOT_DIR, 'src', 'utils', 'VersionChecker.ts');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('❌ Usage: node scripts/set-version.cjs <version>');
  console.error('   Example: node scripts/set-version.cjs 2.0.0');
  process.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('❌ Invalid version format. Use: X.Y.Z (e.g., 2.0.0)');
  process.exit(1);
}

console.log(`📦 Setting version to ${newVersion}...`);

// Update version.json
let versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
versionData.version = newVersion;
versionData.buildTime = new Date().toISOString();
fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));

// Update VersionChecker.ts
let content = fs.readFileSync(VERSION_CHECKER_FILE, 'utf8');
content = content.replace(
  /export const CURRENT_VERSION = '[^']+'/,
  `export const CURRENT_VERSION = '${newVersion}'`
);
fs.writeFileSync(VERSION_CHECKER_FILE, content);

console.log(`✅ Version set to ${newVersion}`);
