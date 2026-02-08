param(
  [Parameter(Mandatory = $false)]
  [string]$Thumbprint,

  [Parameter(Mandatory = $false)]
  [switch]$Persist,

  [Parameter(Mandatory = $false)]
  [switch]$Bundle,

  [Parameter(Mandatory = $false)]
  [switch]$BundleAll,

  [Parameter(Mandatory = $false)]
  [string]$OutDir = ".certs"
)

$ErrorActionPreference = "Stop"

function Get-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Key
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0) { continue }
    if ($trimmed.StartsWith("#")) { continue }

    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }

    $k = $trimmed.Substring(0, $idx).Trim()
    if ($k -ne $Key) { continue }

    $v = $trimmed.Substring($idx + 1).Trim()
    if ($v.StartsWith('"') -and $v.EndsWith('"') -and $v.Length -ge 2) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    if ($v.StartsWith("'") -and $v.EndsWith("'") -and $v.Length -ge 2) {
      $v = $v.Substring(1, $v.Length - 2)
    }

    return $v
  }

  return $null
}

function Find-CertificateByThumbprint {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Thumb
  )

  $normalized = ($Thumb -replace "\s", "").ToUpperInvariant()

  $cert = Get-ChildItem -Path Cert:\CurrentUser\Root |
    Where-Object { $_.Thumbprint -eq $normalized } |
    Select-Object -First 1

  if ($null -ne $cert) {
    return $cert
  }

  try {
    $cert = Get-ChildItem -Path Cert:\LocalMachine\Root |
      Where-Object { $_.Thumbprint -eq $normalized } |
      Select-Object -First 1
  } catch {
    $cert = $null
  }

  return $cert
}

function Export-CertToPemText {
  param(
    [Parameter(Mandatory = $true)]
    $Cert
  )

  $bytes = $Cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
  $base64 = [System.Convert]::ToBase64String($bytes)

  $lines = @("-----BEGIN CERTIFICATE-----")
  for ($i = 0; $i -lt $base64.Length; $i += 64) {
    $lines += $base64.Substring($i, [Math]::Min(64, $base64.Length - $i))
  }
  $lines += "-----END CERTIFICATE-----"
  return ($lines -join "`n")
}

function Try-GetStoreCerts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$StorePath
  )
  try {
    return Get-ChildItem -Path $StorePath -ErrorAction Stop
  } catch {
    return @()
  }
}

function Write-PemFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string[]]$PemBlocks
  )

  $content = ($PemBlocks | Where-Object { $_ -and $_.Trim().Length -gt 0 }) -join ("`n`n")
  Set-Content -LiteralPath $Path -Value $content -Encoding ascii
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

if ($BundleAll -and -not $Thumbprint) {
  Write-Host "Bundling ALL Windows trusted CAs (Root + Intermediate) into a single PEM for dev..." -ForegroundColor Cyan

  $stores = @(
    "Cert:\CurrentUser\Root",
    "Cert:\CurrentUser\CA",
    "Cert:\LocalMachine\Root",
    "Cert:\LocalMachine\CA"
  )

  $all = @()
  foreach ($store in $stores) {
    $all += Try-GetStoreCerts -StorePath $store
  }

  $unique = $all | Sort-Object Thumbprint -Unique
  if (-not $unique -or $unique.Count -eq 0) {
    Write-Host "No certificates found in Windows stores." -ForegroundColor Yellow
    exit 1
  }

  $pemBlocks = @()
  foreach ($c in $unique) {
    $pemBlocks += Export-CertToPemText -Cert $c
  }

  $bundlePath = Join-Path $OutDir "corp-windows-store.pem"
  Write-PemFile -Path $bundlePath -PemBlocks $pemBlocks

  $absBundlePath = (Resolve-Path -LiteralPath $bundlePath).Path
  $env:NODE_EXTRA_CA_CERTS = $absBundlePath

  Write-Host "Wrote Windows CA store bundle: $absBundlePath" -ForegroundColor Green
  Write-Host "Set for current PowerShell session: NODE_EXTRA_CA_CERTS=$absBundlePath" -ForegroundColor Green

  if ($Persist) {
    setx NODE_EXTRA_CA_CERTS $absBundlePath | Out-Null
    Write-Host "Persisted for user via setx. Restart VS Code/terminals to apply." -ForegroundColor Green
  }

  Write-Host "" 
  Write-Host "Now run 'npm run dev' from THIS PowerShell window." -ForegroundColor Cyan
  exit 0
}

if ($Bundle -and -not $Thumbprint) {
  $pattern = "Zscaler|Netskope|goskope|Blue Coat|Symantec|Fortinet|Palo Alto|Checkpoint|Cisco|Proxy|Inspection|Corporate|Company|Root"
  Write-Host "Bundling likely corporate MITM CAs (Root + Intermediate) matching: $pattern" -ForegroundColor Cyan

  $stores = @(
    "Cert:\CurrentUser\Root",
    "Cert:\CurrentUser\CA",
    "Cert:\LocalMachine\Root",
    "Cert:\LocalMachine\CA"
  )

  $all = @()
  foreach ($store in $stores) {
    $all += Try-GetStoreCerts -StorePath $store
  }

  $candidates = $all |
    Where-Object {
      $_.Subject -match $pattern -or $_.Issuer -match $pattern
    } |
    Sort-Object Thumbprint -Unique

  if (-not $candidates -or $candidates.Count -eq 0) {
    Write-Host "No candidate CAs found to bundle. Run without -Bundle to list candidates and pick a thumbprint." -ForegroundColor Yellow
    exit 1
  }

  $pemBlocks = @()
  foreach ($c in $candidates) {
    $pemBlocks += Export-CertToPemText -Cert $c
  }

  $bundlePath = Join-Path $OutDir "corp-bundle.pem"
  Write-PemFile -Path $bundlePath -PemBlocks $pemBlocks

  $absBundlePath = (Resolve-Path -LiteralPath $bundlePath).Path
  $env:NODE_EXTRA_CA_CERTS = $absBundlePath
  Write-Host "Wrote PEM bundle: $absBundlePath" -ForegroundColor Green
  Write-Host "Set for current PowerShell session: NODE_EXTRA_CA_CERTS=$absBundlePath" -ForegroundColor Green

  if ($Persist) {
    setx NODE_EXTRA_CA_CERTS $absBundlePath | Out-Null
    Write-Host "Persisted for user via setx. Restart VS Code/terminals to apply." -ForegroundColor Green
  }

  Write-Host "" 
  Write-Host "Now run 'npm run dev' from THIS PowerShell window." -ForegroundColor Cyan
  exit 0
}

if (-not $Thumbprint) {
  Write-Host "No -Thumbprint provided. Listing some likely corporate/proxy root CAs from Cert:\CurrentUser\Root ..." -ForegroundColor Yellow

  $candidates = Get-ChildItem -Path Cert:\CurrentUser\Root |
    Where-Object {
      $_.Subject -match "Zscaler|Netskope|Blue Coat|Symantec|Fortinet|Palo Alto|Checkpoint|Cisco|Proxy|Inspection|Corporate|Company|Root" -or
      $_.Issuer -match "Zscaler|Netskope|Blue Coat|Symantec|Fortinet|Palo Alto|Checkpoint|Cisco|Proxy|Inspection|Corporate|Company|Root"
    } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 30 Subject, Issuer, Thumbprint, NotAfter

  if (-not $candidates) {
    Write-Host "No obvious candidates found. You can still pick the right certificate manually:" -ForegroundColor Yellow
    Write-Host "- Open 'certmgr.msc' (Current User) or 'mmc' with Certificates snap-in" -ForegroundColor Yellow
    Write-Host "- Look under 'Trusted Root Certification Authorities > Certificates'" -ForegroundColor Yellow
    Write-Host "- Find your corporate/proxy root CA, then copy its Thumbprint" -ForegroundColor Yellow
    Write-Host "" 
    Write-Host "Or list everything with:" -ForegroundColor Yellow
    Write-Host "  Get-ChildItem Cert:\CurrentUser\Root | Select Subject,Thumbprint,NotAfter | Sort NotAfter -Descending" -ForegroundColor Yellow
    exit 0
  }

  $i = 0
  foreach ($c in $candidates) {
    $i++
    Write-Host "[$i]" -ForegroundColor Cyan
    Write-Host ("  Subject    : {0}" -f $c.Subject)
    Write-Host ("  Issuer     : {0}" -f $c.Issuer)
    Write-Host ("  Thumbprint : {0}" -f $c.Thumbprint)
    Write-Host ("  NotAfter   : {0}" -f $c.NotAfter)
    Write-Host ""
  }
  Write-Host "" 
  Write-Host "Tip: to find your Netskope/goskope cert quickly:" -ForegroundColor Yellow
  Write-Host "  Get-ChildItem Cert:\\CurrentUser\\Root | ? { \$_.Subject -match 'goskope|netskope' -or \$_.Issuer -match 'goskope|netskope' } | Select Subject,Issuer,Thumbprint,NotAfter | Format-Table -AutoSize -Wrap" -ForegroundColor Yellow
  Write-Host "" 
  Write-Host "Re-run with: .\\scripts\\setup-node-extra-ca.ps1 -Thumbprint <THUMBPRINT> [-Persist]" -ForegroundColor Yellow
  Write-Host "Or bundle likely CAs with: .\\scripts\\setup-node-extra-ca.ps1 -Bundle [-Persist]" -ForegroundColor Yellow
  Write-Host "Or bundle ALL Windows CAs with: .\\scripts\\setup-node-extra-ca.ps1 -BundleAll [-Persist]" -ForegroundColor Yellow
  exit 0
}

$cert = Find-CertificateByThumbprint -Thumb $Thumbprint
if ($null -eq $cert) {
  Write-Error "Certificate not found for thumbprint '$Thumbprint' in CurrentUser\\Root (or LocalMachine\\Root)."
}

$chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
$chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
$chain.ChainPolicy.RevocationFlag = [System.Security.Cryptography.X509Certificates.X509RevocationFlag]::ExcludeRoot
$chain.ChainPolicy.VerificationFlags = [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::AllowUnknownCertificateAuthority
[void]$chain.Build($cert)

$pemBlocks = @()
foreach ($el in $chain.ChainElements) {
  $pemBlocks += Export-CertToPemText -Cert $el.Certificate
}

if (-not $pemBlocks -or $pemBlocks.Count -eq 0) {
  $pemBlocks = @(Export-CertToPemText -Cert $cert)
}

$chainPemPath = Join-Path $OutDir "corp-chain.pem"
Write-PemFile -Path $chainPemPath -PemBlocks $pemBlocks

$absPemPath = (Resolve-Path -LiteralPath $chainPemPath).Path
$env:NODE_EXTRA_CA_CERTS = $absPemPath

Write-Host "Exported corporate CA chain to: $absPemPath" -ForegroundColor Green
Write-Host "Set for current PowerShell session: NODE_EXTRA_CA_CERTS=$absPemPath" -ForegroundColor Green

if ($Persist) {
  # Persist for the current user. You must restart VS Code/terminals for it to take effect.
  setx NODE_EXTRA_CA_CERTS $absPemPath | Out-Null
  Write-Host "Persisted for user via setx. Restart VS Code/terminals to apply." -ForegroundColor Green
}

# Optional TLS verification against your Supabase host (if we can discover it)
$url = $env:NEXT_PUBLIC_SUPABASE_URL
if (-not $url) { $url = $env:SUPABASE_URL }
if (-not $url) { $url = Get-DotEnvValue -Path ".env" -Key "NEXT_PUBLIC_SUPABASE_URL" }
if (-not $url) { $url = Get-DotEnvValue -Path ".env" -Key "SUPABASE_URL" }

if ($url) {
  try {
    $host = ([uri]$url).Host
    Write-Host "Verifying TLS to Supabase host: $host" -ForegroundColor Cyan
    node -e "const https=require('https'); https.get('https://$host/', (res)=>{ console.log('TLS OK, status', res.statusCode); res.resume(); }).on('error',(e)=>{ console.error('TLS FAIL', e && e.code ? e.code : e); process.exit(1); });"
  } catch {
    Write-Host "Could not parse Supabase URL for verification. That's ok." -ForegroundColor Yellow
  }
} else {
  Write-Host "Supabase URL not found in env or .env; skipping automatic TLS verification." -ForegroundColor Yellow
}

Write-Host "" 
Write-Host "Now run 'npm run dev' from THIS PowerShell window (or restart VS Code if you used -Persist)." -ForegroundColor Cyan
