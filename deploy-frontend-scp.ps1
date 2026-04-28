# Деплой фронтенда через SCP (без rsync)
param(
    [string]$Server = "root@217.26.31.130",
    [string]$RemoteDir = "/var/www/galaxyleague",
    [string]$LocalDir = "./dist"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "ДЕПЛОЙ ФРОНТЕНДА (через SCP)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Проверка dist директории
if (-not (Test-Path $LocalDir)) {
    Write-Host "❌ Директория $LocalDir не найдена!" -ForegroundColor Red
    Write-Host "Сначала выполните: npm run build" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Найдена директория: $LocalDir" -ForegroundColor Green
Write-Host ""

# Создание временного архива
Write-Host "📦 Создание архива..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "frontend-$timestamp.tar.gz"

# Используем tar (встроен в Windows 10+)
tar -czf $archiveName -C $LocalDir .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка создания архива!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Архив создан: $archiveName" -ForegroundColor Green
Write-Host ""

# Создание бэкапа на сервере
Write-Host "💾 Создание бэкапа на сервере..." -ForegroundColor Cyan
$backupCmd = "cp -r $RemoteDir /var/www/galaxyleague.backup.$timestamp && echo 'Backup created'"
ssh -o StrictHostKeyChecking=no $Server $backupCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Бэкап создан" -ForegroundColor Green
} else {
    Write-Host "⚠️  Не удалось создать бэкап, продолжаем..." -ForegroundColor Yellow
}
Write-Host ""

# Отправка архива на сервер
Write-Host "📤 Отправка архива на сервер..." -ForegroundColor Cyan
$startTime = Get-Date

scp -o StrictHostKeyChecking=no $archiveName ${Server}:/tmp/

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка отправки!" -ForegroundColor Red
    Remove-Item $archiveName
    exit 1
}

$duration = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 2)
Write-Host "✅ Архив отправлен за $duration сек" -ForegroundColor Green
Write-Host ""

# Распаковка на сервере
Write-Host "📂 Распаковка на сервере..." -ForegroundColor Cyan
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
ls -lah $RemoteDir | head -10
"@

ssh -o StrictHostKeyChecking=no $Server $deployCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Распаковка завершена" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка распаковки!" -ForegroundColor Red
    Remove-Item $archiveName
    exit 1
}

# Удаление локального архива
Remove-Item $archiveName
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ ДЕПЛОЙ ЗАВЕРШЕН!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Игра доступна по адресу:" -ForegroundColor Cyan
Write-Host "🌐 https://game.galaxyleague.ru/" -ForegroundColor White
Write-Host ""
Write-Host "Проверьте PvP в браузере:" -ForegroundColor Yellow
Write-Host "  1. Откройте DevTools (F12)" -ForegroundColor Gray
Write-Host "  2. Зайдите в PvP режим" -ForegroundColor Gray
Write-Host "  3. Проверьте Console на наличие '[MP] Connected!'" -ForegroundColor Gray
Write-Host ""
