# deploy-frontend-wss.ps1
# Deploy frontend with WSS support

$SERVER = "root@217.26.31.130"
$REMOTE_DIR = "/var/www/game.galaxyleague.ru"
$LOCAL_DIST = "./dist"

Write-Host "Deploying frontend with WSS..." -ForegroundColor Green
Write-Host ""

# Check dist folder
if (-not (Test-Path $LOCAL_DIST)) {
    Write-Host "ERROR: dist folder not found! Run npm run build" -ForegroundColor Red
    exit 1
}

Write-Host "Creating archive..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "frontend-wss-$timestamp.tar.gz"

# Create tar.gz archive
tar -czf $archiveName -C $LOCAL_DIST .

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create archive!" -ForegroundColor Red
    exit 1
}

$archiveSize = [math]::Round((Get-Item $archiveName).Length / 1MB, 2)
Write-Host "Archive created: $archiveName ($archiveSize MB)" -ForegroundColor Green
Write-Host ""

Write-Host "Uploading to server..." -ForegroundColor Cyan
$startTime = Get-Date

scp -o StrictHostKeyChecking=no $archiveName "${SERVER}:/tmp/"

if ($LASTEXITCODE -eq 0) {
    $duration = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 2)
    Write-Host "Upload completed in $duration sec" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Extracting on server..." -ForegroundColor Cyan
    
    # Execute commands on server (extract to temp, validate, then sync)
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

mkdir -p $REMOTE_DIR
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete-delay "$TMP_DIR"/ "$REMOTE_DIR"/
else
  echo "WARNING: rsync not found, using fallback copy"
  find "$REMOTE_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "$TMP_DIR"/. "$REMOTE_DIR"/
fi
chown -R www-data:www-data $REMOTE_DIR
chmod -R 755 $REMOTE_DIR
rm -rf "$TMP_DIR"
rm -f /tmp/$archiveName
"@
    ssh "$SERVER" $deployCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS: Frontend deployed!" -ForegroundColor Green
        Write-Host "URL: https://game.galaxyleague.ru" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To check WSS connection:" -ForegroundColor Cyan
        Write-Host "  1. Open https://game.galaxyleague.ru" -ForegroundColor White
        Write-Host "  2. Open browser console (F12)" -ForegroundColor White
        Write-Host "  3. Check WSS connection logs" -ForegroundColor White
    }
    else {
        Write-Host ""
        Write-Host "ERROR: Failed to extract on server!" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host ""
    Write-Host "ERROR: Failed to upload to server!" -ForegroundColor Red
    exit 1
}

# Remove local archive
Remove-Item $archiveName -Force
Write-Host ""
Write-Host "Local archive removed" -ForegroundColor Gray
