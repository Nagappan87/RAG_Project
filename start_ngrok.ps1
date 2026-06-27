# Keep ngrok tunnel active for project review
$WorkspaceDir = "c:\Users\Nagappan SP\rag"
Set-Location -Path $WorkspaceDir

# Load .env variables
$EnvFile = Join-Path $WorkspaceDir ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        $name = $name.Trim()
        $value = $value.Trim()
        $value = $value -replace '^["'']|["'']$'
        Set-Content -Path "env:$name" -Value $value
    }
}

$AuthToken = $env:NGROK_AUTHTOKEN
$Domain = $env:NGROK_DOMAIN

if ([string]::IsNullOrEmpty($AuthToken) -or [string]::IsNullOrEmpty($Domain)) {
    Write-Host "==========================================================" -ForegroundColor Yellow
    Write-Host "ngrok configuration is missing or incomplete in your .env file." -ForegroundColor Yellow
    Write-Host "Please open your .env file and add the following lines:" -ForegroundColor Yellow
    Write-Host "  NGROK_AUTHTOKEN=your_ngrok_authtoken" -ForegroundColor Cyan
    Write-Host "  NGROK_DOMAIN=your_static_domain.ngrok-free.app" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To obtain these details:"
    Write-Host "1. Sign up/Log in at https://dashboard.ngrok.com"
    Write-Host "2. Copy your Auth Token from: https://dashboard.ngrok.com/get-started/your-authtoken"
    Write-Host "3. Claim your free static domain from: https://dashboard.ngrok.com/cloud-edge/domains"
    Write-Host "==========================================================" -ForegroundColor Yellow
    Exit
}

Write-Host "Configuring ngrok authtoken..." -ForegroundColor Green
npx -y ngrok config add-authtoken $AuthToken

Write-Host ""
Write-Host "Starting ngrok tunnel for port 8000 (React Frontend + FastAPI Backend)..." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Your Permanent Public Review URL: https://$Domain" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the tunnel." -ForegroundColor Yellow
Write-Host ""

# Update active tunnel URL file
Set-Content -Path "active_tunnel_url.txt" -Value "https://$Domain"

npx -y ngrok http 8000 --domain=$Domain
