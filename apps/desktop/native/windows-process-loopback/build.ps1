# Copyright 2026 Element Creations Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the repository root for full details.

$ErrorActionPreference = "Stop"

if (-not [Environment]::Is64BitOperatingSystem) {
    throw "The screen-share audio helper requires 64-bit Windows."
}

$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $compiler)) {
    throw "The 64-bit .NET Framework C# compiler is unavailable."
}

$sourceDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDirectory = Join-Path $sourceDirectory "build\windows-x64"
$outputPath = Join-Path $outputDirectory "windows-process-loopback.exe"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

& $compiler `
    /nologo `
    /debug- `
    /optimize+ `
    /platform:x64 `
    /target:exe `
    "/out:$outputPath" `
    (Join-Path $sourceDirectory "Program.cs")
if ($LASTEXITCODE -ne 0) {
    throw "Screen-share audio helper compilation failed."
}

$probe = & $outputPath probe
if ($LASTEXITCODE -ne 0 -or ($probe -join "`n") -ne "protocol=1`nformat=48000,2,pcm-s16le") {
    throw "Screen-share audio helper compatibility probe failed."
}

Write-Output $outputPath
