[CmdletBinding()]
param([switch]$Local)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Sql = ((Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "ops/product-metrics.sql")) -replace "\s+", " ").Trim()
$Arguments = @("wrangler", "d1", "execute", "michi-no-eki", "--command", $Sql, "--json")
if ($Local) { $Arguments += "--local" } else { $Arguments += "--remote" }
$Raw = & npx @Arguments
if ($LASTEXITCODE -ne 0) { throw "wrangler d1 execute failed" }
$Parsed = $Raw | ConvertFrom-Json
$Row = $Parsed[0].results[0]
$Users = [int]$Row.users
$Successful = [int]$Row.successful_searches
$NoResult = [int]$Row.no_result_searches
function Get-Percent([int]$Numerator, [int]$Denominator) {
    if ($Denominator -eq 0) { return 0 }
    return [Math]::Round(100 * $Numerator / $Denominator, 1)
}
[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        searchers = [int]$Row.searchers
        successful_searches = $Successful
        no_result_searches = $NoResult
        prefecture_changers = [int]$Row.prefecture_changers
        period_changers = [int]$Row.period_changers
        savers = [int]$Row.savers
        copiers = [int]$Row.copiers
        official_openers = [int]$Row.official_openers
        searchers_7d = [int]$Row.searchers_7d
        official_openers_7d = [int]$Row.official_openers_7d
        qa_rows = [int]$Row.qa_rows
    }
    rates = [ordered]@{
        search_percent = Get-Percent ([int]$Row.searchers) $Users
        successful_search_percent = Get-Percent $Successful ($Successful + $NoResult)
        save_percent = Get-Percent ([int]$Row.savers) $Users
        official_open_percent = Get-Percent ([int]$Row.official_openers) $Users
    }
} | ConvertTo-Json -Depth 4
