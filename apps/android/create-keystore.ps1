# One-time: creates the Cafe Bazaar release keystore OUTSIDE the repository and the properties file the Gradle build reads.
# BACK UP BOTH FILES. Losing the keystore or its password means you can never publish an update to the same app on Bazaar.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:USERPROFILE '.bgv'
$jks = Join-Path $dir 'bazaar-release.jks'
$props = Join-Path $dir 'bazaar-keystore.properties'
if (Test-Path $jks) { Write-Host "Keystore already exists: $jks (not overwritten)"; exit 1 }
New-Item -ItemType Directory -Force $dir | Out-Null
$keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
if (-not $keytool -and $env:JAVA_HOME) { $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe' }
# Oracle's installer only puts java.exe on PATH (javapath); look for keytool in the installed JDKs, newest first.
if (-not $keytool) { $keytool = Get-ChildItem "$env:ProgramFiles\Java\*\bin\keytool.exe", "$env:ProgramFiles\Eclipse Adoptium\*\bin\keytool.exe", "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName }
if (-not $keytool) { Write-Host 'keytool not found: install a JDK (17+) or set JAVA_HOME.'; exit 1 }
$sec = Read-Host 'Keystore password (min 8 chars)' -AsSecureString
$pass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
if ($pass.Length -lt 8) { Write-Host 'Password too short.'; exit 1 }
$name = Read-Host 'Your name or company for the certificate (e.g. BoardGameVerse)'
& $keytool -genkeypair -v -keystore $jks -alias bazaar -keyalg RSA -keysize 4096 -validity 36500 -storepass $pass -keypass $pass -dname "CN=$name, C=IR"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
"storeFile=$($jks -replace '\\','/')`nstorePassword=$pass`nkeyAlias=bazaar`nkeyPassword=$pass" | Set-Content -Encoding ascii $props
Write-Host "Created $jks and $props. Back up both now (never into git)."
