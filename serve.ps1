param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

# Determine local IP for mobile access
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*","Ethernet*" -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "169.254*" } | Select-Object -First 1).IPAddress
if (-not $localIp) { $localIp = "127.0.0.1" }

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    # If 8080 is in use, switch to 8081
    $Port = 8081
    $prefix = "http://localhost:$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "       Nostalgic Map Server is Running!                " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " Local URL:    $prefix" -ForegroundColor Yellow
if ($localIp -ne "127.0.0.1") {
    Write-Host " Mobile URL:   http://$($localIp):$Port/ (on same Wi-Fi)" -ForegroundColor Cyan
}
Write-Host ""
Write-Host " Opening default web browser..." -ForegroundColor Gray
Write-Host " Press Ctrl+C in this window to stop the server." -ForegroundColor Gray
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

Start-Process $prefix

$mimeMap = @{
    ".html"        = "text/html; charset=utf-8"
    ".htm"         = "text/html; charset=utf-8"
    ".css"         = "text/css; charset=utf-8"
    ".js"          = "application/javascript; charset=utf-8"
    ".json"        = "application/json; charset=utf-8"
    ".png"         = "image/png"
    ".jpg"         = "image/jpeg"
    ".jpeg"        = "image/jpeg"
    ".svg"         = "image/svg+xml"
    ".ico"         = "image/x-icon"
    ".webmanifest" = "application/manifest+json"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.Url.LocalPath
        if ($rawUrl -eq "/" -or [string]::IsNullOrWhiteSpace($rawUrl)) {
            $rawUrl = "/index.html"
        }

        $relPath = $rawUrl.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        $relPath = [System.Uri]::UnescapeDataString($relPath)
        $filePath = Join-Path $root $relPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Cache-Control", "no-cache")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rawUrl")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.Close()
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
        $listener.Close()
    }
}
