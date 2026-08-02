[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Required = @(
    "README.md", "SOURCE.md", "PRIVACY.md", "SECURITY.md", "STACK.md", "DECISIONS.md",
    "EXPERIMENT.md", "LICENSE", "src/worker.tsx", "public/app.js", "public/styles.css",
    "public/data/index.json", "public/data/stations.json", "migrations/0001_telemetry.sql"
)
foreach ($Relative in $Required) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $Relative) -PathType Leaf)) {
        throw "Missing required file: $Relative"
    }
}

$Index = Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "public/data/index.json") | ConvertFrom-Json
if ($Index.asOf -ne "2025-12-19" -or $Index.count -ne 1231 -or $Index.prefectures.Count -ne 47 -or $Index.rounds -ne 64) {
    throw "Unexpected data index dimensions"
}
$DataPath = Join-Path $RepoRoot "public/data/stations.json"
$DataFile = Get-Item -LiteralPath $DataPath
if ($DataFile.Length -gt 300000) { throw "Station data exceeds delivery budget" }
$Stations = Get-Content -Raw -LiteralPath $DataPath | ConvertFrom-Json
if ($Stations.Count -ne 1231) { throw "Station count mismatch" }

$Surface = (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "src/worker.tsx")) +
    (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "public/app.js"))
if ($Surface -match "public validation|success criteria|市場スコア|移行候補|収益性") {
    throw "Internal evaluation language leaked into product surface"
}
$Css = Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "public/styles.css")
if ($Css -match "gradient") { throw "Gradient styling is not allowed" }
$KeyFiles = @(
    Get-ChildItem -LiteralPath (Join-Path $RepoRoot "public") -File |
        Where-Object { $_.Name -match "^[a-zA-Z0-9-]{8,128}\.txt$" }
)
if ($KeyFiles.Count -ne 1 -or (Get-Content -Raw -LiteralPath $KeyFiles[0]).Trim() -ne $KeyFiles[0].BaseName) {
    throw "Invalid IndexNow key file"
}

[ordered]@{
    ok = $true
    stations = $Index.count
    prefectures = $Index.prefectures.Count
    data_bytes = $DataFile.Length
    indexnow_key = $KeyFiles[0].BaseName
} | ConvertTo-Json
