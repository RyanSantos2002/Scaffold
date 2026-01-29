$source = "C:\Fontes\FrontM8\src\@CRM\pages\contas\form\tabs\anexos\index.tsx"
$dest = "C:\Fontes\FrontM8\src\@CRM\pages\conta\form\tabs\anexos\index.tsx"
$wrongFolder = "C:\Fontes\FrontM8\src\@CRM\pages\contas"

if (Test-Path $source) {
    Copy-Item -Path $source -Destination $dest -Force
    Write-Host "Arquivo copiado de $source para $dest"
} else {
    Write-Error "Fonte não encontrada: $source"
}

if (Test-Path $wrongFolder) {
    Remove-Item -Path $wrongFolder -Recurse -Force
    Write-Host "Pasta incorreta removida: $wrongFolder"
}
