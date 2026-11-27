# One-time setup: creates the Android release key OUTSIDE the repo and stores it as
# GitHub Actions secrets, so CI can sign every APK with the same key.
# Back up the folder it creates: losing the key means installed apps can no longer be updated.
$ErrorActionPreference = 'Stop'

$dir = Join-Path $HOME '.android-keys\traffix'
$jks = Join-Path $dir 'traffix-release.jks'
New-Item -ItemType Directory -Force $dir | Out-Null

if (Test-Path $jks) {
  Write-Host "Key already exists at $jks - not overwriting. Remove it by hand only if you really mean to."
  exit 1
}

$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$pw = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')

& keytool -genkeypair -keystore $jks -storetype PKCS12 -alias traffix -keyalg RSA -keysize 4096 `
  -validity 10000 -storepass $pw -keypass $pw -dname 'CN=Traffix, O=Traffix, C=RO' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }

@"
Traffix Android release key - BACK THIS FOLDER UP.
keystore: traffix-release.jks
alias: traffix
store/key password: $pw
"@ | Out-File -Encoding utf8 (Join-Path $dir 'README-PASSWORD.txt')

# --body, not a pipe: Windows PowerShell would append a newline to piped values.
$repo = 'rafail3/traffix'
gh secret set ANDROID_KEYSTORE_BASE64 --repo $repo --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes($jks)))
gh secret set ANDROID_KEYSTORE_PASSWORD --repo $repo --body $pw
gh secret set ANDROID_KEY_PASSWORD --repo $repo --body $pw
gh secret set ANDROID_KEY_ALIAS --repo $repo --body 'traffix'

Write-Host "Done. Key + password saved in $dir (back it up). Secrets set on rafail3/traffix."
