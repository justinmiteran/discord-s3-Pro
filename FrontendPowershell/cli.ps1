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
        [string]$OutFile
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
        Write-Host "[>] Upload de : $FullPath" -ForegroundColor Cyan

        $body = @{ filePath = $FullPath } | ConvertTo-Json
        $result = Invoke-Auth -Uri "$ApiUrl/upload" -Method Post -Body $body
        if ($result) {
            Write-Host "[OK] Succès ! ID : $($result.id)" -ForegroundColor Green
            Write-Host "[#] Lien : $($result.url)" -ForegroundColor Yellow
        }
    }

    "list" {
        $files = Invoke-Auth -Uri "$ApiUrl/list"
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

        $result = Invoke-Auth -Uri "$ApiUrl/download/$Id" -OutFile $OutFile
        if ($result) {
            Write-Host "[OK] Fichier téléchargé : $OutFile" -ForegroundColor Green
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
