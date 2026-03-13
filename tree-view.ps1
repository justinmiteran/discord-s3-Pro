# On force l'encodage pour éviter les caractères bizarres
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$IgnoreList = @("node_modules", ".git", ".vscode", "dist", "__pycache__")

function Get-Tree {
    param (
        $Path,
        $Prefix = ""
    )
    
    $Items = Get-ChildItem -Path $Path | Where-Object { $IgnoreList -notcontains $_.Name } | Sort-Object { !$_.PSIsContainer }, Name
    $Count = $Items.Count

    for ($i = 0; $i -lt $Count; $i++) {
        $Item = $Items[$i]
        $IsLast = ($i -eq ($Count - 1))
        
        # Symboles simplifiés pour éviter les erreurs d'encodage
        $Connector = if ($IsLast) { "+-- " } else { "|-- " }
        
        $Name = if ($Item.PSIsContainer) { "$($Item.Name)/" } else { $Item.Name }
        Write-Host "$Prefix$Connector$Name"
        
        if ($Item.PSIsContainer) {
            $Indent = if ($IsLast) { "    " } else { "|   " }
            Get-Tree -Path $Item.FullName -Prefix ($Prefix + $Indent)
        }
    }
}

$CurrentDir = Get-Item .
Write-Host "`n--- Structure de : $($CurrentDir.Name) ---" -ForegroundColor Cyan
Write-Host "."
Get-Tree -Path $CurrentDir.FullName
Write-Host ""