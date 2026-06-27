# Keep tunnel connection active indefinitely
$WorkspaceDir = "c:\Users\Nagappan SP\rag"
Set-Location -Path $WorkspaceDir

$Index = 0
while ($true) {
    Write-Host "Connecting to localhost.run..."
    $LogFile = "tunnel_$Index.log"
    $ErrFile = "tunnel_err_$Index.log"
    
    # Start ssh process in background
    $process = Start-Process ssh -ArgumentList "-o StrictHostKeyChecking=no -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -R 80:127.0.0.1:8000 nokey@localhost.run" -RedirectStandardOutput $LogFile -RedirectStandardError $ErrFile -NoNewWindow -PassThru
    
    # Wait for the tunnel URL to appear in the logs
    Start-Sleep -Seconds 5
    
    if (Test-Path $LogFile) {
        $content = Get-Content $LogFile -ErrorAction SilentlyContinue
        # Find line containing lhr.life
        $match = $content | Select-String -Pattern "lhr.life"
        if ($match) {
            # Extract last word (the URL)
            $url = ($match.Line -split " ")[-1]
            if ($url) {
                Set-Content -Path "active_tunnel_url.txt" -Value $url
                Write-Host "Tunnel established successfully! URL: $url"
            }
        }
    }
    
    # Keep monitoring the process
    while (-not $process.HasExited) {
        if (Test-Path $LogFile) {
            $content = Get-Content $LogFile -ErrorAction SilentlyContinue
            # Find the last line containing lhr.life
            $match = $content | Select-String -Pattern "lhr.life" | Select-Object -Last 1
            if ($match) {
                # Extract last word (the URL)
                $url = ($match.Line -split " ")[-1]
                if ($url) {
                    $currentUrl = Get-Content "active_tunnel_url.txt" -ErrorAction SilentlyContinue
                    if ($currentUrl -ne $url) {
                        Set-Content -Path "active_tunnel_url.txt" -Value $url
                        Write-Host "Tunnel updated! URL: $url"
                    }
                }
            }
        }
        Start-Sleep -Seconds 5
    }
    
    Write-Host "Tunnel disconnected. Reconnecting in 5 seconds..."
    $Index++
    Start-Sleep -Seconds 5
}

