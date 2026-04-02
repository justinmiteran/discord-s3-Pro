param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("upload", "list", "status", "help", "download", "delete", "login", "logout")]
    [string]$Action = "help",

    [Parameter(Mandatory=$false)]
    [string]$Path,

    [Parameter(Mandatory=$false)]
    [string]$Id
)

$ApiUrl     = "http://localhost:3000"
$SessionDir = "$env:USERPROFILE\.discord-s3"
$SessionFile = "$SessionDir\session.json"
$ResumeDir = "$SessionDir\resume"

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
        filePath = $filePath
        fileHash = $fileHash
        timestamp = (Get-Date).ToString("o")
        attempts = 1
    } | ConvertTo-Json | Set-Content $resumeFile
}

function Get-UploadState($fileHash) {
    $resumeFile = "$ResumeDir\$fileHash.json"
    if (-not (Test-Path $resumeFile)) { return $null }
    return Get-Content $resumeFile | ConvertFrom-Json
}

function Update-UploadAttempts($fileHash) {
    $state = Get-UploadState $fileHash
    if ($state) {
        $state.attempts++
        $state.timestamp = (Get-Date).ToString("o")
        $resumeFile = "$ResumeDir\$fileHash.json"
        $state | ConvertTo-Json | Set-Content $resumeFile
    }
}

function Clear-UploadState($fileHash) {
    $resumeFile = "$ResumeDir\$fileHash.json"
    if (Test-Path $resumeFile) { Remove-Item $resumeFile }
}

function Get-FileHashQuick($filePath) {
    $hash = Get-FileHash -Path $filePath -Algorithm SHA256
    return $hash.Hash.ToLower()
}

# --- Token refresh ---

function Invoke-Refresh {
    $session = Load-Session
    if (-not $session) { return $null }

    try {
        $body = @{ refreshToken = $session.refreshToken } | ConvertTo-Json
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
        Write-Host "[!] Non authentifié. Lance : .\cli.ps1 -Action login" -ForegroundColor Red
        return $null
    }

    $headers = @{ Authorization = "Bearer $($session.accessToken)" }

    $params = @{ Uri = $Uri; Method = $Method; Headers = $headers }
    if ($Body)    { $params.Body = $Body; $params.ContentType = "application/json; charset=utf-8" }
    if ($OutFile) { $params.OutFile = $OutFile }

    try {
        if ($ShowProgress) {
            $job = Start-Job -ScriptBlock {
                param($Uri, $Method, $Headers, $Body, $OutFile, $ContentType)
                try {
                    $params = @{ Uri = $Uri; Method = $Method; Headers = $Headers; ErrorAction = 'Stop' }
                    if ($Body) { $params.Body = $Body; $params.ContentType = $ContentType }
                    if ($OutFile) { 
                        $params.OutFile = $OutFile
                        Invoke-WebRequest @params | Out-Null
                        return @{ success = $true; result = $true }
                    }
                    $result = Invoke-RestMethod @params
                    return @{ success = $true; result = $result }
                } catch {
                    return @{ success = $false; error = $_.Exception.Message; status = $_.Exception.Response.StatusCode.value__ }
                }
            } -ArgumentList $Uri, $Method, $headers, $Body, $OutFile, $params.ContentType

            $startTime = Get-Date
            $lastPercent = 0
            while ($job.State -eq 'Running') {
                $elapsed = ((Get-Date) - $startTime).TotalSeconds
                # Logarithmic progress: fast start, slows down
                $percent = [Math]::Min(95, [Math]::Floor(30 * [Math]::Log($elapsed + 1)))
                if ($percent -gt $lastPercent) {
                    Write-Progress -Activity $ProgressActivity -Status "En cours... ($([Math]::Floor($elapsed))s)" -PercentComplete $percent
                    $lastPercent = $percent
                }
                Start-Sleep -Milliseconds 300
            }
            
            Write-Progress -Activity $ProgressActivity -Status "Finalisation..." -PercentComplete 100
            $jobResult = Receive-Job -Job $job
            Remove-Job -Job $job
            Write-Progress -Activity $ProgressActivity -Completed

            if (-not $jobResult.success) {
                if ($jobResult.status -eq 401) {
                    $newToken = Invoke-Refresh
                    if (-not $newToken) {
                        Write-Host "[!] Session expirée. Lance : .\cli.ps1 -Action login" -ForegroundColor Red
                        return $null
                    }
                    # Retry with new token
                    $headers = @{ Authorization = "Bearer $newToken" }
                    if ($OutFile) { 
                        Invoke-WebRequest -Uri $Uri -Method $Method -Headers $headers -Body $Body -ContentType $params.ContentType -OutFile $OutFile -ErrorAction Stop | Out-Null
                        return $true
                    }
                    return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $headers -Body $Body -ContentType $params.ContentType -ErrorAction Stop
                }
                Write-Host "[X] Erreur : $($jobResult.error)" -ForegroundColor Red
                return $null
            }
            return $jobResult.result
        }

        if ($OutFile) {
            Invoke-WebRequest @params | Out-Null
            return $true
        }
        return Invoke-RestMethod @params
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401) {
            $newToken = Invoke-Refresh
            if (-not $newToken) {
                Write-Host "[!] Session expirée. Lance : .\cli.ps1 -Action login" -ForegroundColor Red
                return $null
            }
            $params.Headers = @{ Authorization = "Bearer $newToken" }
            try {
                if ($OutFile) { Invoke-WebRequest @params | Out-Null; return $true }
                return Invoke-RestMethod @params
            } catch {
                Write-Host "[X] Erreur : $($_.Exception.Message)" -ForegroundColor Red
                return $null
            }
        }
        Write-Host "[X] Erreur : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# --- Actions ---

switch ($Action) {
    "help" {
        Write-Host "`n--- DISCORD STORAGE CLI ---" -ForegroundColor Cyan
        Write-Host "Usage: .\cli.ps1 -Action <commande> [-Path <chemin>] [-Id <id>]"
        Write-Host "  login    : Authentification (requis avant toute opération)"
        Write-Host "  logout   : Supprime la session locale"
        Write-Host "  upload   : Envoie un fichier (ex: -Path 'C:\test.zip')"
        Write-Host "             Reprend automatiquement en cas d'échec"
        Write-Host "  list     : Liste les fichiers sur le cloud"
        Write-Host "  download : Télécharge un fichier (ex: -Id a7f2b)"
        Write-Host "  delete   : Supprime un fichier partout (ex: -Id a7f2b)"
        Write-Host "  status   : Vérifie si le bot est en ligne"
    }

    "login" {
        $username = Read-Host "Username"
        $password = Read-Host "Password" -AsSecureString
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
        )

        try {
            $body = @{ username = $username; password = $plainPassword } | ConvertTo-Json
            $result = Invoke-RestMethod -Uri "$ApiUrl/auth/login" -Method Post -Body $body -ContentType "application/json"
            Save-Session $result.accessToken $result.refreshToken
            Write-Host "[OK] Connecté en tant que $username" -ForegroundColor Green
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
        Write-Host "[OK] Session supprimée." -ForegroundColor Green
    }

    "status" {
        try {
            $result = Invoke-RestMethod -Uri "$ApiUrl/status" -Method Get
            Write-Host "[OK] Serveur actif (Bot: $($result.bot))" -ForegroundColor Green
        } catch {
            Write-Host "[X] Serveur hors-ligne." -ForegroundColor Red
        }
    }

    "upload" {
        if (-not $Path) { Write-Host "[!] Path requis." -ForegroundColor Red; return }
        if (-not (Test-Path $Path)) { Write-Host "[!] Fichier introuvable." -ForegroundColor Red; return }

        $FullPath = (Resolve-Path -Path $Path).Path
        $FileSize = (Get-Item $FullPath).Length
        $FileName = Split-Path $FullPath -Leaf
        
        Write-Host "[>] Calcul du hash du fichier..." -ForegroundColor Cyan
        $FileHash = Get-FileHashQuick $FullPath
        
        # Check for previous failed upload
        $resumeState = Get-UploadState $FileHash
        if ($resumeState) {
            Write-Host "[!] Upload précédent détecté (tentative #$($resumeState.attempts))" -ForegroundColor Yellow
            $retry = Read-Host "Voulez-vous réessayer ? (O/N)"
            if ($retry -ne "O" -and $retry -ne "o") {
                Clear-UploadState $FileHash
                Write-Host "[!] Upload annulé." -ForegroundColor Yellow
                return
            }
            Update-UploadAttempts $FileHash
        } else {
            Save-UploadState $FullPath $FileHash
        }
        
        Write-Host "[>] Upload de : $FileName ($([math]::Round($FileSize/1MB, 2)) MB)" -ForegroundColor Cyan

        $body = @{ filePath = $FullPath } | ConvertTo-Json
        $result = Invoke-Auth -Uri "$ApiUrl/upload" -Method Post -Body $body -ShowProgress -ProgressActivity "Upload: $FileName"
        
        if ($result) {
            Clear-UploadState $FileHash
            Write-Host "[OK] Succès ! ID : $($result.id)" -ForegroundColor Green
            Write-Host "[#] Lien : $($result.url)" -ForegroundColor Yellow
        } else {
            Write-Host "[X] Échec de l'upload. L'état a été sauvegardé pour reprise." -ForegroundColor Red
            Write-Host "[i] Relancez la commande pour réessayer." -ForegroundColor Yellow
        }
    }

    "list" {
        Write-Progress -Activity "Récupération de la liste" -Status "Connexion au serveur..." -PercentComplete 0
        $files = Invoke-Auth -Uri "$ApiUrl/list"
        Write-Progress -Activity "Récupération de la liste" -Completed
        
        if ($null -eq $files -or $files.Count -eq 0) {
            Write-Host "[!] Le registre est vide." -ForegroundColor Yellow
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

        $OutFile = if ($Path) { $Path } else { "downloaded_$Id" }
        Write-Host "[>] Récupération du fichier ID: $Id..." -ForegroundColor Cyan
        
        $result = Invoke-Auth -Uri "$ApiUrl/download/$Id" -OutFile $OutFile -ShowProgress -ProgressActivity "Download: $Id"
        
        if ($result) {
            $FileSize = (Get-Item $OutFile).Length
            Write-Host "[OK] Fichier téléchargé : $OutFile ($([math]::Round($FileSize/1MB, 2)) MB)" -ForegroundColor Green
        }
    }

    "delete" {
        if (-not $Id) { Write-Host "[!] -Id requis." -ForegroundColor Red; return }

        Write-Host "[!] Suppression du fichier ID: $Id..." -ForegroundColor Yellow
        $result = Invoke-Auth -Uri "$ApiUrl/file/$Id" -Method Delete
        if ($result -and $result.success) {
            Write-Host "[OK] $($result.message)" -ForegroundColor Green
        }
    }
}
