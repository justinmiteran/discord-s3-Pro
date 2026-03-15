param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("upload", "list", "status", "help", "download", "delete")]
    [string]$Action = "help",

    [Parameter(Mandatory=$false)]
    [string]$Path,

    [Parameter(Mandatory=$false)]
    [string]$Id
)

$ApiUrl = "http://localhost:3000"

switch ($Action) {
    "help" {
        Write-Host "`n--- DISCORD STORAGE CLI ---" -ForegroundColor Cyan
        Write-Host "Usage: .\cli.ps1 -Action <commande> [-Path <chemin>] [-Id <id>]"
        Write-Host "  upload   : Envoie un fichier (ex: -Path 'C:\test.zip')"
        Write-Host "  list     : Liste les fichiers sur le cloud"
        Write-Host "  download : Télécharge un fichier (ex: -Id a7f2b)"
        Write-Host "  delete   : Supprime un fichier partout (ex: -Id a7f2b)"
        Write-Host "  status   : Vérifie si le bot est en ligne"
    }

    "upload" {
        if (-not $Path) { Write-Host "[!] Path requis." -ForegroundColor Red; return }
        if (-not (Test-Path $Path)) { Write-Host "[!] Fichier introuvable." -ForegroundColor Red; return }
        
        $FullPath = (Resolve-Path -Path $Path).Path
        Write-Host "[>] Upload de : $FullPath" -ForegroundColor Cyan
        
        $Obj = @{ filePath = $FullPath }
        $Json = $Obj | ConvertTo-Json
        
        try {
            $Response = Invoke-RestMethod -Uri "$ApiUrl/upload" -Method Post -Body $Json -ContentType "application/json; charset=utf-8"
            Write-Host "[OK] Succès ! ID : $($Response.id)" -ForegroundColor Green
            Write-Host "[#] Lien : $($Response.url)" -ForegroundColor Yellow
        } catch {
            Write-Host "[X] Erreur : Le serveur a rejeté la requête." -ForegroundColor Red
            Write-Host "Détail : $($_.Exception.Message)" -ForegroundColor Gray
        }
    }

    "download" {
        if (-not $Id) { 
            Write-Host "[!] Erreur : Tu dois préciser l'ID avec -Id (ex: -Id a7f2b)" -ForegroundColor Red
            return 
        }
        
        $OutFile = if ($Path) { $Path } else { "downloaded_$Id" }
        Write-Host "[>] Récupération du fichier ID: $Id..." -ForegroundColor Cyan
        
        try {
            Invoke-WebRequest -Uri "$ApiUrl/download/$Id" -OutFile $OutFile
            Write-Host "[OK] Fichier téléchargé avec succès : $OutFile" -ForegroundColor Green
        } catch {
            Write-Host "[X] Erreur : Impossible de télécharger le fichier." -ForegroundColor Red
        }
    }

    "delete" {
        if (-not $Id) { 
            Write-Host "[!] Erreur : Tu dois préciser l'ID avec -Id (ex: -Id a7f2b)" -ForegroundColor Red
            return 
        }

        Write-Host "[!] Suppression du fichier ID: $Id..." -ForegroundColor Yellow
        
        try {
            # Appel à l'endpoint DELETE /file/:id
            $Response = Invoke-RestMethod -Uri "$ApiUrl/file/$Id" -Method Delete
            
            if ($Response.success) {
                Write-Host "[OK] $($Response.message)" -ForegroundColor Green
            }
        } catch {
            Write-Host "[X] Erreur : La suppression a échoué. Vérifie l'ID." -ForegroundColor Red
            Write-Host "Détail : $($_.Exception.Message)" -ForegroundColor Gray
        }
    }

   "list" {
        try {
            $Files = Invoke-RestMethod -Uri "$ApiUrl/list" -Method Get
            
            if ($null -eq $Files -or $Files.Count -eq 0) {
                Write-Host "[!] Le registre est vide." -ForegroundColor Yellow
                return
            }

            Write-Host "`n--- FICHIERS DISPONIBLES ---" -ForegroundColor Cyan
            
            @($Files) | ForEach-Object {
                [PSCustomObject]@{
                    ID     = $_.id
                    Nom    = $_.name
                    Taille = "{0:N2} MB" -f ($_.size / 1MB)
                    Date   = [DateTime]::Parse($_.date).ToString("dd/MM/yyyy HH:mm")
                }
            } | Format-Table -AutoSize

        } catch {
            Write-Host "[X] Erreur : Impossible de récupérer la liste." -ForegroundColor Red
        }
    }

    "status" {
        try {
            $Test = Invoke-RestMethod -Uri "$ApiUrl/status" -Method Get
            Write-Host "[OK] Serveur actif (Bot: $($Test.bot))" -ForegroundColor Green
        } catch { Write-Host "[X] Serveur hors-ligne." -ForegroundColor Red }
    }
}