param (
    [Parameter(Mandatory=$false, Position=0)]
    [ValidateSet("upload", "list", "status", "help", "download", "delete", "login", "logout")]
    [string]$Action = "help",

    [Parameter(Mandatory=$false)]
    [string]$Path,

    [Parameter(Mandatory=$false)]
    [string]$Id,

    [Parameter(Mandatory=$false)]
    [string]$OutFile
)

$ApiUrl      = "http://localhost:3000"
$SessionDir  = "$env:USERPROFILE\.discord-s3"
$SessionFile = "$SessionDir\session.json"
$ResumeDir   = "$SessionDir\resume"

# --- Session helpers ---

function Save-Session($accessToken, $refreshToken) {
    if (-not (Test-Path $SessionDir)) { New-Item -ItemType Directory -Path $SessionDir | Out-Null }
    @{ accessToken = $accessToken; refreshToken = $refreshToken } | ConvertTo-Json | Set-Content $SessionFile
}

function Load-Session {
    if (-not (Test-Path $SessionFile)) { return $null }
    return Get-Content $SessionFile | ConvertFrom-Json
}

function Clear-Session {
    if (Test-Path $SessionFile) { Remove-Item $SessionFile }
}

# --- Resume helpers ---

function Save-UploadState($filePath, $fileHash) {
    if (-not (Test-Path $ResumeDir)) { New-Item -ItemType Directory -Path $ResumeDir | Out-Null }
    $resumeFile = "$ResumeDir\$fileHash.json"
    @{
        filePath  = $filePath
        fileHash  = $fileHash
        timestamp = (Get-Date).ToString("o")
        attempts  = 1
    } | ConvertTo-Json | Set-Content $resumeFile
}

function Get-UploadState($fileHash) {
    $resumeFile = "$ResumeDir\$fileHash.json"
    if (-not (Test-Path $resumeFile)) { return $null }
    return Get-Content $resumeFile | ConvertFrom-Json
}

function Update-UploadAttempts($fileHash) {
    $resumeFile = "$ResumeDir\$fileHash.json"
    $state = Get-UploadState $fileHash
    if ($state) {
        $state.attempts++
        $state.timestamp = (Get-Date).ToString("o")
        $state | ConvertTo-Json | Set-Content $resumeFile
    }
}

function Clear-UploadState($fileHash) {
    $resumeFile = "$ResumeDir\$fileHash.json"
    if (Test-Path $resumeFile) { Remove-Item $resumeFile }
}

function Get-FileHashQuick($filePath) {
    return (Get-FileHash -Path $filePath -Algorithm SHA256).Hash.ToLower()
}

# --- Token refresh ---

function Invoke-Refresh {
    $session = Load-Session
    if (-not $session) { return $null }
    try {
        $body   = @{ refreshToken = $session.refreshToken } | ConvertTo-Json
        $result = Invoke-RestMethod -Uri "$ApiUrl/auth/refresh" -Method Post -Body $body -ContentType "application/json"
        Save-Session $result.accessToken $result.refreshToken
        return $result.accessToken
    } catch {
        Clear-Session
        return $null
    }
}

# --- Authenticated request with auto-refresh ---

function Invoke-Auth {
    param(
        [string]$Uri,
        [string]$Method = "Get",
        [string]$Body,
        [string]$OutFile,
        [switch]$ShowProgress,
        [string]$ProgressActivity
    )

    $session = Load-Session
    if (-not $session) {
        Write-Host "[!] Non authentifie. Lance : .\cli.ps1 login" -ForegroundColor Red
        return $null
    }

    $headers     = @{ Authorization = "Bearer $($session.accessToken)" }
    $contentType = "application/json; charset=utf-8"
    $params      = @{ Uri = $Uri; Method = $Method; Headers = $headers; ErrorAction = "Stop" }
    if ($Body)    { $params.Body = $Body; $params.ContentType = $contentType }
    if ($OutFile) { $params.OutFile = $OutFile }

    function Exec-Request($p) {
        if ($p.OutFile) { Invoke-WebRequest @p | Out-Null; return $true }
        return Invoke-RestMethod @p
    }

    function Retry-WithNewToken {
        $newToken = Invoke-Refresh
        if (-not $newToken) {
            Write-Host "[!] Session expiree. Lance : .\cli.ps1 login" -ForegroundColor Red
            return $null
        }
        $params.Headers = @{ Authorization = "Bearer $newToken" }
        try   { return Exec-Request $params }
        catch { Write-Host "[X] Erreur : $($_.Exception.Message)" -ForegroundColor Red; return $null }
    }

    if ($ShowProgress) {
        $job = Start-Job -ScriptBlock {
            param($Uri, $Method, $Headers, $Body, $OutFile, $ContentType)
            try {
                $p = @{ Uri = $Uri; Method = $Method; Headers = $Headers; ErrorAction = "Stop" }
                if ($Body)    { $p.Body = $Body; $p.ContentType = $ContentType }
                if ($OutFile) { $p.OutFile = $OutFile; Invoke-WebRequest @p | Out-Null; return @{ success = $true; result = $true } }
                return @{ success = $true; result = (Invoke-RestMethod @p) }
            } catch {
                return @{ success = $false; error = $_.Exception.Message; status = $_.Exception.Response.StatusCode.value__ }
            }
        } -ArgumentList $Uri, $Method, $headers, $Body, $OutFile, $contentType

        $startTime   = Get-Date
        $lastPercent = 0
        while ($job.State -eq "Running") {
            $elapsed = ((Get-Date) - $startTime).TotalSeconds
            $percent = [Math]::Min(95, [Math]::Floor(30 * [Math]::Log($elapsed + 1)))
            if ($percent -gt $lastPercent) {
                Write-Progress -Activity $ProgressActivity -Status "En cours... ($([Math]::Floor($elapsed))s)" -PercentComplete $percent
                $lastPercent = $percent
            }
            Start-Sleep -Milliseconds 300
        }
        Write-Progress -Activity $ProgressActivity -Status "Finalisation..." -PercentComplete 100
        $jobResult = Receive-Job -Job $job
        Remove-Job  -Job $job
        Write-Progress -Activity $ProgressActivity -Completed

        if (-not $jobResult.success) {
            if ($jobResult.status -eq 401) { return Retry-WithNewToken }
            Write-Host "[X] Erreur : $($jobResult.error)" -ForegroundColor Red
            return $null
        }
        return $jobResult.result
    }

    try   { return Exec-Request $params }
    catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) { return Retry-WithNewToken }
        Write-Host "[X] Erreur : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# --- Actions ---

switch ($Action) {
    "help" {
        Write-Host "`n--- DISCORD STORAGE CLI ---" -ForegroundColor Cyan
        Write-Host "Usage: .\cli.ps1 <commande> [options]"
        Write-Host "  login                                  : Authentification"
        Write-Host "  logout                                 : Supprime la session locale"
        Write-Host "  status                                 : Verifie si le serveur est en ligne"
        Write-Host "  upload   -Path <chemin>                : Envoie un fichier"
        Write-Host "  list                                   : Liste les fichiers"
        Write-Host "  download -Id <id> [-OutFile <chemin>]  : Telecharge un fichier"
        Write-Host "  delete   -Id <id>                      : Supprime un fichier"
    }

    "login" {
        $username      = Read-Host "Username"
        $password      = Read-Host "Password" -AsSecureString
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
        )
        try {
            $body   = @{ username = $username; password = $plainPassword } | ConvertTo-Json
            $result = Invoke-RestMethod -Uri "$ApiUrl/auth/login" -Method Post -Body $body -ContentType "application/json"
            Save-Session $result.accessToken $result.refreshToken
            Write-Host "[OK] Connecte en tant que $username" -ForegroundColor Green
        } catch {
            Write-Host "[X] Identifiants invalides." -ForegroundColor Red
        }
    }

    "logout" {
        $session = Load-Session
        if ($session) {
            try {
                $body = @{ refreshToken = $session.refreshToken } | ConvertTo-Json
                Invoke-RestMethod -Uri "$ApiUrl/auth/logout" -Method Post -Body $body -ContentType "application/json" | Out-Null
            } catch {}
        }
        Clear-Session
        Write-Host "[OK] Session supprimee." -ForegroundColor Green
    }

    "status" {
        try {
            $result = Invoke-RestMethod -Uri "$ApiUrl/status" -Method Get -ErrorAction Stop
            Write-Host "[OK] Serveur actif (Bot: $($result.bot))" -ForegroundColor Green
        } catch {
            Write-Host "[X] Serveur hors-ligne : $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    "upload" {
        if (-not $Path)              { Write-Host "[!] -Path requis." -ForegroundColor Red; return }
        if (-not (Test-Path $Path))  { Write-Host "[!] Fichier introuvable." -ForegroundColor Red; return }

        $FullPath = (Resolve-Path -Path $Path).Path
        $FileName = Split-Path $FullPath -Leaf

        Write-Host "[>] Calcul du hash..." -ForegroundColor Cyan
        $FileHash    = Get-FileHashQuick $FullPath
        $resumeState = Get-UploadState $FileHash

        if ($resumeState) {
            Write-Host "[!] Upload precedent detecte (tentative #$($resumeState.attempts))" -ForegroundColor Yellow
            $retry = Read-Host "Reessayer ? (O/N)"
            if ($retry -ne "O" -and $retry -ne "o") {
                Clear-UploadState $FileHash
                Write-Host "[!] Upload annule." -ForegroundColor Yellow
                return
            }
            Update-UploadAttempts $FileHash
        } else {
            Save-UploadState $FullPath $FileHash
        }

        $FileSize = (Get-Item $FullPath).Length
        Write-Host "[>] Upload : $FileName ($([math]::Round($FileSize/1MB, 2)) MB)" -ForegroundColor Cyan

        $body   = @{ filePath = $FullPath } | ConvertTo-Json
        $result = Invoke-Auth -Uri "$ApiUrl/upload" -Method Post -Body $body -ShowProgress -ProgressActivity "Upload: $FileName"

        if ($result) {
            Clear-UploadState $FileHash
            Write-Host "[OK] Succes ! ID : $($result.id)" -ForegroundColor Green
            if ($result.url) { Write-Host "[#] Lien : $($result.url)" -ForegroundColor Yellow }
        } else {
            Write-Host "[X] Echec. Etat sauvegarde pour reprise." -ForegroundColor Red
        }
    }

    "list" {
        Write-Progress -Activity "Liste des fichiers" -Status "Connexion..." -PercentComplete 0
        $files = Invoke-Auth -Uri "$ApiUrl/list"
        Write-Progress -Activity "Liste des fichiers" -Completed

        if (-not $files -or @($files).Count -eq 0) {
            Write-Host "[!] Aucun fichier." -ForegroundColor Yellow
            return
        }

        Write-Host "`n--- FICHIERS DISPONIBLES ---" -ForegroundColor Cyan
        @($files) | ForEach-Object {
            [PSCustomObject]@{
                ID     = $_.id
                Nom    = $_.name
                Taille = "{0:N2} MB" -f ($_.size / 1MB)
                Date   = [DateTime]::Parse($_.date).ToString("dd/MM/yyyy HH:mm")
            }
        } | Format-Table -AutoSize
    }

    "download" {
        if (-not $Id) { Write-Host "[!] -Id requis." -ForegroundColor Red; return }

        $session = Load-Session
        if (-not $session) { Write-Host "[!] Non authentifie. Lance : .\cli.ps1 login" -ForegroundColor Red; return }

        $dest    = if ($OutFile) { $OutFile } elseif ($Path) { $Path } else { "downloaded_$Id" }
        $AbsDest = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($dest)
        $headers = @{ Authorization = "Bearer $($session.accessToken)" }

        Write-Host "[>] Telechargement ID: $Id..." -ForegroundColor Cyan
        $startTime          = Get-Date
        $ProgressPreference = "SilentlyContinue"
        try {
            Invoke-WebRequest -Uri "$ApiUrl/download/$Id" -Headers $headers -OutFile $AbsDest -ErrorAction Stop | Out-Null
            $ProgressPreference = "Continue"
            $elapsed  = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
            $FileSize = (Get-Item $AbsDest).Length
            $speed    = if ($elapsed -gt 0) { [math]::Round(($FileSize / 1MB) / $elapsed, 2) } else { "?" }
            Write-Host "[OK] $AbsDest - $([math]::Round($FileSize/1MB, 2)) MB en ${elapsed}s ($speed MB/s)" -ForegroundColor Green
        } catch {
            $status = $_.Exception.Response.StatusCode.value__
            if ($status -eq 401) {
                $newToken = Invoke-Refresh
                if (-not $newToken) { Write-Host "[!] Session expiree." -ForegroundColor Red; return }
                $headers = @{ Authorization = "Bearer $newToken" }
                Invoke-WebRequest -Uri "$ApiUrl/download/$Id" -Headers $headers -OutFile $AbsDest -ErrorAction Stop | Out-Null
                $FileSize = (Get-Item $AbsDest).Length
                Write-Host "[OK] $AbsDest ($([math]::Round($FileSize/1MB, 2)) MB)" -ForegroundColor Green
            } else {
                Write-Host "[X] Erreur : $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }

    "delete" {
        if (-not $Id) { Write-Host "[!] -Id requis." -ForegroundColor Red; return }

        $confirm = Read-Host "[!] Supprimer le fichier $Id ? (O/N)"
        if ($confirm -ne "O" -and $confirm -ne "o") { Write-Host "[!] Annule." -ForegroundColor Yellow; return }

        $result = Invoke-Auth -Uri "$ApiUrl/file/$Id" -Method Delete
        if ($result -and $result.success) {
            Write-Host "[OK] $($result.message)" -ForegroundColor Green
        }
    }
}
