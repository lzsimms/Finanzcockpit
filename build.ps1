# Baut aus den Quelldateien in .\src
#   1) Finanzcockpit.html  – eigenständige lokale Datei (Doppelklick)
#   2) docs\               – installierbare Web-App (PWA) für PC & Handy, z. B. via GitHub Pages
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$src  = Join-Path $root 'src'
$utf8 = New-Object System.Text.UTF8Encoding $false
function Read-Text($p) { [IO.File]::ReadAllText((Join-Path $src $p), $utf8) }

$shell = Read-Text 'shell.html'
$css   = Read-Text 'styles.css'
$js    = (Get-ChildItem (Join-Path $src 'js') -Filter *.js | Sort-Object Name | ForEach-Object {
            [IO.File]::ReadAllText($_.FullName, $utf8)
         }) -join "`n"
if ($js -match '</script') { throw 'JavaScript darf kein </script> enthalten.' }

$page = $shell.Replace('/*__CSS__*/', $css).Replace('/*__JS__*/', $js)

# 1) Lokale Datei
$local = Join-Path $root 'Finanzcockpit.html'
[IO.File]::WriteAllText($local, $page.Replace('<!--__PWA__-->', ''), $utf8)

# 2) Web-App
$docs = Join-Path $root 'docs'
New-Item -ItemType Directory -Force $docs | Out-Null
$web = $page.Replace('<!--__PWA__-->', (Read-Text 'pwa-head.html'))
[IO.File]::WriteAllText((Join-Path $docs 'index.html'), $web, $utf8)

$sha = [Security.Cryptography.SHA256]::Create()
$version = -join ($sha.ComputeHash($utf8.GetBytes($web)) | Select-Object -First 6 | ForEach-Object { $_.ToString('x2') })
[IO.File]::WriteAllText((Join-Path $docs 'sw.js'), (Read-Text 'sw.js').Replace('__VERSION__', $version), $utf8)
Copy-Item (Join-Path $src 'manifest.webmanifest') $docs -Force
Copy-Item (Join-Path $src 'icons\*.png') $docs -Force
[IO.File]::WriteAllText((Join-Path $docs '.nojekyll'), '', $utf8)

Write-Host ("Lokal:   {0} ({1:N0} KB)" -f $local, ((Get-Item $local).Length / 1KB))
Write-Host ("Web-App: {0}\  (Version {1})" -f $docs, $version)
