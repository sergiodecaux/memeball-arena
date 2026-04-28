# Simple deploy script
param(
    [string]$Server = "root@217.26.31.130",
    [string]$RemoteDir = "/var/www/galaxyleague"
)

$LocalDir = "./dist"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "========================================"
Write-Host "FRONTEND DEPLOY"
Write-Host "========================================"
Write-Host ""

# Check dist folder
if (-not (Test-Path $LocalDir)) {
    Write-Host "ERROR: dist folder not found!"
    Write-Host "Run: npm run build"
    exit 1
}

Write-Host "OK: Found dist folder"
Write-Host ""

# Create archive
Write-Host "Creating archive..."
$archiveName = "frontend-$timestamp.tar.gz"
tar -czf $archiveName -C $LocalDir .

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot create archive!"
    exit 1
}

Write-Host "OK: Archive created"
Write-Host ""

# Check disk space on server
Write-Host "Checking disk space on server..."
$diskCheck = ssh -o StrictHostKeyChecking=no $Server "df -h /var/www | tail -1 | awk '{print \$4}'"
$archiveSize = (Get-Item $archiveName).Length / 1MB
Write-Host "Archive size: $([math]::Round($archiveSize, 2)) MB"
Write-Host "Available space: $diskCheck"
Write-Host ""

# Clean old backups if disk space is low
Write-Host "Cleaning old backups (keeping last 3)..."
ssh -o StrictHostKeyChecking=no $Server "cd /var/www && ls -td galaxyleague.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -rf"
Write-Host ""

# Create backup on server (optional - continue if fails)
Write-Host "Creating backup on server..."
$backupResult = ssh -o StrictHostKeyChecking=no $Server "cp -r $RemoteDir /var/www/galaxyleague.backup.$timestamp 2>&1"

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: Backup created"
} else {
    Write-Host "WARNING: Backup failed (disk space issue?), continuing without backup..."
    Write-Host "Backup error: $backupResult"
}
Write-Host ""

# Upload archive
Write-Host "Uploading archive..."
$startTime = Get-Date
scp -o StrictHostKeyChecking=no $archiveName ${Server}:/tmp/

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Upload failed! Check disk space on server."
    Write-Host "Try: ssh $Server 'df -h' to check disk usage"
    Write-Host "Or: ssh $Server 'du -sh /var/www/galaxyleague.backup.*' to see backup sizes"
    Remove-Item $archiveName
    exit 1
}

$duration = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 2)
Write-Host "OK: Uploaded in $duration sec"
Write-Host ""

# Deploy on server (atomic-ish: extract to temp, validate, then sync)
Write-Host "Deploying on server..."
$deployCmd = @"
set -e
TMP_DIR="/tmp/galaxyleague-release-$timestamp"
mkdir -p "$TMP_DIR"
tar -xzf /tmp/$archiveName -C "$TMP_DIR"

if [ ! -f "$TMP_DIR/index.html" ]; then
  echo "ERROR: index.html missing in archive"
  exit 1
fi

if [ ! -d "$TMP_DIR/assets" ]; then
  echo "ERROR: assets directory missing in archive"
  exit 1
fi

mkdir -p $RemoteDir
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete-delay "$TMP_DIR"/ "$RemoteDir"/
else
  echo "WARNING: rsync not found, using fallback copy"
  find "$RemoteDir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "$TMP_DIR"/. "$RemoteDir"/
fi
rm -rf "$TMP_DIR"
rm -f /tmp/$archiveName
ls -lah "$RemoteDir" | head -10
"@
ssh -o StrictHostKeyChecking=no $Server $deployCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: Deployed successfully"
} else {
    Write-Host "ERROR: Deploy failed!"
    Remove-Item $archiveName
    exit 1
}

# Cleanup
Remove-Item $archiveName
Write-Host ""

Write-Host "========================================"
Write-Host "SUCCESS!"
Write-Host "========================================"
Write-Host ""
Write-Host "Game URL: https://game.galaxyleague.ru/"
Write-Host ""
Write-Host "Check PvP:"
Write-Host "  1. Open DevTools (F12)"
Write-Host "  2. Go to PvP mode"
Write-Host "  3. Check Console for: [MP] Connected!"
Write-Host ""
