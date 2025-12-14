# Script to delete the old [adminSlug] folder after renaming
# Run this AFTER closing your IDE and stopping the dev server

Write-Host "Cleaning up old [adminSlug] folder..." -ForegroundColor Yellow

$oldFolderPath = "app\[projectSlug]\[adminSlug]"

if (-not (Test-Path -LiteralPath $oldFolderPath)) {
    Write-Host "The old [adminSlug] folder doesn't exist. It may have already been deleted." -ForegroundColor Green
    exit 0
}

try {
    Remove-Item -LiteralPath $oldFolderPath -Recurse -Force
    Write-Host "Successfully deleted old [adminSlug] folder!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Cleanup complete! Your admin panel is now accessible at:" -ForegroundColor Cyan
    Write-Host "  /{projectSlug}/admin (e.g., /myloot/admin)" -ForegroundColor Green
} catch {
    Write-Host "Error deleting folder: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "The folder is still locked. Please:" -ForegroundColor Yellow
    Write-Host "  1. Make sure your IDE/Editor is completely closed" -ForegroundColor White
    Write-Host "  2. Make sure the Next.js dev server is stopped" -ForegroundColor White
    Write-Host "  3. Close any file explorers that might have the folder open" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "Or manually delete: $oldFolderPath" -ForegroundColor Cyan
    exit 1
}

