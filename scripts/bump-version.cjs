/**
 * Скрипт для автоматического увеличения версии при билде
 * Запускается перед vite build
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'public', 'version.json');
const VERSION_CHECKER_FILE = path.join(ROOT_DIR, 'src', 'utils', 'VersionChecker.ts');

function bumpVersion() {
  console.log('📦 Bumping version...');

  // 1. Читаем текущую версию
  let versionData;
  try {
    versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  } catch (error) {
    console.log('Creating new version.json...');
    versionData = {
      version: '1.0.0',
      buildTime: new Date().toISOString(),
      forceUpdate: false,
      changelog: ['Initial release'],
    };
  }

  // 2. Увеличиваем patch версию
  const parts = versionData.version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1; // patch++
  const newVersion = parts.join('.');

  // 3. Обновляем version.json
  versionData.version = newVersion;
  versionData.buildTime = new Date().toISOString();
  
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
  console.log(`✅ version.json updated to ${newVersion}`);

  // 4. Обновляем CURRENT_VERSION в VersionChecker.ts
  if (fs.existsSync(VERSION_CHECKER_FILE)) {
    let content = fs.readFileSync(VERSION_CHECKER_FILE, 'utf8');
    content = content.replace(
      /export const CURRENT_VERSION = '[^']+'/,
      `export const CURRENT_VERSION = '${newVersion}'`
    );
    fs.writeFileSync(VERSION_CHECKER_FILE, content);
    console.log(`✅ VersionChecker.ts updated to ${newVersion}`);
  } else {
    console.warn('⚠️ VersionChecker.ts not found, skipping...');
  }

  console.log(`\n🚀 Version bumped to ${newVersion}\n`);
}

// Запускаем
bumpVersion();
