# Setup script for Sahay project

Write-Host "Setting up environment files..." -ForegroundColor Cyan

# Frontend .env
if (-not (Test-Path "frontend/.env")) {
    Copy-Item "frontend/.env.example" "frontend/.env"
    Write-Host "Created frontend/.env from example." -ForegroundColor Green
} else {
    Write-Host "frontend/.env already exists. Skipping." -ForegroundColor Yellow
}

# Backend application.properties
$backendProps = "backend/src/main/resources/application.properties"
$backendExample = "backend/src/main/resources/application-example.properties"

if (-not (Test-Path $backendProps)) {
    if (Test-Path $backendExample) {
        Copy-Item $backendExample $backendProps
        Write-Host "Created $backendProps from example." -ForegroundColor Green
    } else {
        Write-Host "Error: $backendExample not found!" -ForegroundColor Red
    }
} else {
    Write-Host "$backendProps already exists. Skipping." -ForegroundColor Yellow
}

Write-Host "Setup complete! Please fill in your secrets in the newly created files." -ForegroundColor Cyan
