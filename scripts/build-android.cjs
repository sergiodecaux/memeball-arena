#!/usr/bin/env node
'use strict';

/**
 * Sync the Capacitor project and build a signed Android APK.
 *
 * Usage:
 *   npm run android:apk      -> signed release APK
 *   npm run android:debug    -> debug APK
 *
 * Java 17 (Android Studio's bundled JBR) is required by Gradle 8.2.1.
 * The script selects it automatically when JAVA_HOME points at a newer JDK.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android');
const MODE = (process.argv[2] || 'release').toLowerCase();

if (MODE !== 'release' && MODE !== 'debug') {
  console.error(`Unknown build mode "${MODE}". Use "release" or "debug".`);
  process.exit(1);
}

const exists = (file) => {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
};

function findSdk() {
  const localAppData = process.env.LOCALAPPDATA;
  return [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    localAppData && path.join(localAppData, 'Android', 'Sdk'),
    'C:/Android/Sdk',
    path.join(process.env.HOME || '', 'Android', 'Sdk'),
    path.join(process.env.HOME || '', 'Library', 'Android', 'sdk'),
  ].find((candidate) => candidate && exists(path.join(candidate, 'platforms')));
}

function javaMajor(javaHome) {
  const java = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!exists(java)) {
    return 0;
  }
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const text = `${result.stderr || ''}${result.stdout || ''}`;
  const match = text.match(/version "(\d+)/);
  return match ? Number(match[1]) : 0;
}

function findJava() {
  const candidates = [
    process.env.JAVA_HOME,
    'C:/Program Files/Android/Android Studio/jbr',
    'C:/Program Files/Java/jdk-17',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/usr/lib/jvm/java-17-openjdk-amd64',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const major = javaMajor(candidate);
    // Gradle 8.2.1 runs on JDK 8-20; JDK 21 is too new for this wrapper.
    if (major >= 17 && major <= 20) {
      return candidate;
    }
  }
  return null;
}

const javaHome = findJava();
if (!javaHome) {
  console.error('JDK 17 was not found. Install Android Studio or set JAVA_HOME to a JDK 17 installation.');
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
};

const localProperties = path.join(ANDROID_DIR, 'local.properties');
if (!exists(localProperties)) {
  const sdk = findSdk();
  if (!sdk) {
    console.error('Android SDK not found. Set ANDROID_HOME or create android/local.properties with sdk.dir=...');
    process.exit(1);
  }
  fs.writeFileSync(localProperties, `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
  console.log(`Created ${path.relative(ROOT, localProperties)}`);
}

if (MODE === 'release' && !exists(path.join(ANDROID_DIR, 'keystore.properties'))) {
  console.error('android/keystore.properties is missing. Restore the release keystore before building.');
  process.exit(1);
}

function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Keep the local fallback page and capacitor.config.json in sync.
run(
  process.execPath,
  [path.join(ROOT, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'],
  { cwd: ROOT, env }
);

run(
  process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
  [MODE === 'release' ? 'assembleRelease' : 'assembleDebug', '--console=plain'],
  { cwd: ANDROID_DIR, env, shell: process.platform === 'win32' }
);

const gradleFile = fs.readFileSync(path.join(ANDROID_DIR, 'app', 'build.gradle'), 'utf8');
const versionName = (gradleFile.match(/versionName\s+["']([^"']+)["']/) || [])[1] || 'unknown';
const versionCode = (gradleFile.match(/versionCode\s+(\d+)/) || [])[1] || 'unknown';

const apkName = MODE === 'release' ? 'app-release.apk' : 'app-debug.apk';
const sourceApk = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', MODE, apkName);
if (!exists(sourceApk)) {
  console.error(`APK not found at ${path.relative(ROOT, sourceApk)}`);
  process.exit(1);
}

const buildsDir = path.join(ROOT, 'builds');
fs.mkdirSync(buildsDir, { recursive: true });
const fileName = `GalaxyLeague-${versionName}${MODE === 'debug' ? '-debug' : ''}.apk`;
const outputApk = path.join(buildsDir, fileName);
fs.copyFileSync(sourceApk, outputApk);

// Resolve the SDK from local.properties so verification works even when
// ANDROID_HOME is not exported in the current shell.
let sdkDir = findSdk();
const properties = fs.readFileSync(localProperties, 'utf8');
const sdkMatch = properties.match(/^sdk\.dir=(.+)$/m);
if (sdkMatch) {
  sdkDir = sdkMatch[1].trim().replace(/\\\\/g, '\\').replace(/\\:/g, ':');
}

const buildToolsRoot = sdkDir ? path.join(sdkDir, 'build-tools') : null;
const buildToolsVersion =
  buildToolsRoot && exists(buildToolsRoot)
    ? fs
        .readdirSync(buildToolsRoot)
        .filter((version) => exists(path.join(buildToolsRoot, version, 'lib', 'apksigner.jar')))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]
    : null;

if (buildToolsVersion) {
  const buildTools = path.join(buildToolsRoot, buildToolsVersion);
  const java = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  const apksignerJar = path.join(buildTools, 'lib', 'apksigner.jar');
  run(java, ['-jar', apksignerJar, 'verify', '--verbose', '--print-certs', outputApk], {
    cwd: ROOT,
    env,
  });

  const aapt = path.join(buildTools, process.platform === 'win32' ? 'aapt.exe' : 'aapt');
  if (exists(aapt)) {
    // Run from the builds directory: aapt on Windows does not cope with
    // absolute paths containing non-ASCII characters, but relative names work.
    const badging = spawnSync(aapt, ['dump', 'badging', fileName], { cwd: buildsDir, encoding: 'utf8' });
    const summary = (badging.stdout || '')
      .split(/\r?\n/)
      .filter((line) => line.startsWith('package:') || line.startsWith('sdkVersion:') || line.startsWith('targetSdkVersion:'))
      .join('\n');
    if (summary) {
      console.log(`\n${summary}`);
    }
  }
} else {
  console.warn('apksigner was not found; skipping signature verification.');
}

const hash = crypto.createHash('sha256').update(fs.readFileSync(outputApk)).digest('hex');
const sizeMb = (fs.statSync(outputApk).size / (1024 * 1024)).toFixed(1);
fs.writeFileSync(`${outputApk}.sha256`, `${hash}  ${fileName}\n`);

console.log(`\nAPK: ${path.relative(ROOT, outputApk)}`);
console.log(`Version: ${versionName} (${versionCode})`);
console.log(`Size: ${sizeMb} MB`);
console.log(`SHA-256: ${hash}`);
