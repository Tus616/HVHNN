$ErrorActionPreference = "Stop"

$wrapperDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent (Split-Path -Parent $wrapperDir)
$propertiesPath = Join-Path $wrapperDir "maven-wrapper.properties"
$properties = Get-Content -Raw -LiteralPath $propertiesPath | ConvertFrom-StringData
$distributionUrl = $properties.distributionUrl

if ([string]::IsNullOrWhiteSpace($distributionUrl)) {
    throw "Missing distributionUrl in $propertiesPath"
}

$mavenUserHome = if ($env:MAVEN_USER_HOME) { $env:MAVEN_USER_HOME } else { Join-Path $HOME ".m2" }
$distributionName = Split-Path $distributionUrl -Leaf
$distributionBaseName = $distributionName -replace "\.zip$", ""
$distributionBaseName = $distributionBaseName -replace "-bin$", ""
$hashBytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($distributionUrl))
$hash = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
$mavenHomeParent = Join-Path $mavenUserHome ("wrapper\dists\" + $distributionBaseName)
$mavenHome = Join-Path $mavenHomeParent $hash
$mvnCmd = Join-Path $mavenHome "bin\mvn.cmd"

if (!(Test-Path -LiteralPath $mvnCmd -PathType Leaf)) {
    New-Item -ItemType Directory -Force -Path $mavenHomeParent | Out-Null
    $tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mvnw-" + [Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $tmpRoot $distributionName
    New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $distributionUrl -OutFile $zipPath
        Expand-Archive -LiteralPath $zipPath -DestinationPath $tmpRoot -Force
        $extracted = Get-ChildItem -LiteralPath $tmpRoot -Directory |
            Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "bin\mvn.cmd") } |
            Select-Object -First 1
        if (!$extracted) {
            throw "Could not find Maven executable in downloaded wrapper distribution."
        }
        Move-Item -LiteralPath $extracted.FullName -Destination $mavenHome -Force
    } finally {
        Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Set-Location -LiteralPath $backendDir
& $mvnCmd @args
exit $LASTEXITCODE
