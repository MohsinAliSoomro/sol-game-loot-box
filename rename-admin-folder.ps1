# Script to rename [adminSlug] folder to 'admin'
# This changes the admin panel route from /projectSlug/projectSlug to /projectSlug/admin

Write-Host "Renaming admin folder..." -ForegroundColor Yellow

$projectSlugPath = "app\[projectSlug]"
$oldFolderName = "[adminSlug]"
$newFolderName = "admin"

# Check if the projectSlug folder exists
if (-not (Test-Path -LiteralPath $projectSlugPath)) {
    Write-Host "Error: Cannot find $projectSlugPath" -ForegroundColor Red
    exit 1
}

# Check if [adminSlug] folder exists
$oldFolderPath = Join-Path -Path $projectSlugPath -ChildPath $oldFolderName
if (-not (Test-Path -LiteralPath $oldFolderPath)) {
    Write-Host "Error: Cannot find $oldFolderPath" -ForegroundColor Red
    Write-Host "The folder may have already been renamed or doesn't exist." -ForegroundColor Yellow
    exit 1
}

# Check if 'admin' folder already exists
$newFolderPath = Join-Path -Path $projectSlugPath -ChildPath $newFolderName
if (Test-Path -LiteralPath $newFolderPath) {
    Write-Host "Warning: $newFolderPath already exists!" -ForegroundColor Yellow
    $response = Read-Host "Do you want to delete it and continue? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
    Remove-Item -LiteralPath $newFolderPath -Recurse -Force
    Write-Host "Removed existing admin folder." -ForegroundColor Yellow
}

try {
    # Rename the folder
    Rename-Item -LiteralPath $oldFolderPath -NewName $newFolderName -Force -ErrorAction Stop
    
    # Verify the rename worked
    if (Test-Path -LiteralPath $newFolderPath) {
        Write-Host "Successfully renamed $oldFolderName to $newFolderName" -ForegroundColor Green
        Write-Host ""
        Write-Host "Admin panel route changed:" -ForegroundColor Cyan
        Write-Host "  Old: /{projectSlug}/{projectSlug} (e.g., /myloot/myloot)" -ForegroundColor Gray
        Write-Host "  New: /{projectSlug}/admin (e.g., /myloot/admin)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Please restart your development server if it's running." -ForegroundColor Yellow
    } else {
        throw "Rename appeared to succeed but new folder not found"
    }
} catch {
    Write-Host "Error renaming folder: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "The folder is locked. Attempting alternative method..." -ForegroundColor Yellow
    
    try {
        # Try copying files and then deleting old folder
        Write-Host "Copying files to new location..." -ForegroundColor Yellow
        if (Test-Path -LiteralPath $newFolderPath) {
            Remove-Item -LiteralPath $newFolderPath -Recurse -Force
        }
        Copy-Item -LiteralPath $oldFolderPath -Destination $newFolderPath -Recurse -Force
        Write-Host "Files copied successfully." -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANT: The old folder still exists. Please:" -ForegroundColor Yellow
        Write-Host "  1. Close your IDE/Editor (VS Code, Cursor, etc.)" -ForegroundColor White
        Write-Host "  2. Stop the Next.js dev server (Ctrl+C)" -ForegroundColor White
        Write-Host "  3. Manually delete: $oldFolderPath" -ForegroundColor White
        Write-Host ""
        Write-Host "The new admin folder has been created at: $newFolderPath" -ForegroundColor Green
        Write-Host "You can now use /{projectSlug}/admin route!" -ForegroundColor Green
    } catch {
        Write-Host "Alternative method also failed: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "MANUAL INSTRUCTIONS:" -ForegroundColor Yellow
        Write-Host "  1. Close your IDE/Editor completely" -ForegroundColor White
        Write-Host "  2. Stop the Next.js dev server (Ctrl+C in terminal)" -ForegroundColor White
        Write-Host "  3. In Windows File Explorer, navigate to:" -ForegroundColor White
        Write-Host "     $((Get-Location).Path)\app\[projectSlug]" -ForegroundColor Cyan
        Write-Host "  4. Right-click '[adminSlug]' folder and select 'Rename'" -ForegroundColor White
        Write-Host "  5. Rename it to 'admin' (without brackets)" -ForegroundColor White
        Write-Host "  6. Restart your IDE and dev server" -ForegroundColor White
        exit 1
    }
}

