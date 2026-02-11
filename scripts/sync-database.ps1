# =============================================================================
# Sincroniza o banco de dados executando todos os SQLs de docker-init
# Cria apenas tabelas/indices que nao existem (nao derruba nada)
# Uso: .\scripts\sync-database.ps1
# =============================================================================

$ErrorActionPreference = "SilentlyContinue"

$ContainerName = if ($env:CONTAINER_NAME) { $env:CONTAINER_NAME } else { "sgest_db" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "sgest" }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SqlDir = Join-Path (Split-Path -Parent $ScriptDir) "docker-init"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "                       SYNC DATABASE - sgest" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Container: " -NoNewline; Write-Host "$ContainerName" -ForegroundColor Green
Write-Host "Database:  " -NoNewline; Write-Host "$DbName / ${DbName}_test" -ForegroundColor Green
Write-Host ""
Write-Host "Este script executa todos os SQLs sem derrubar tabelas existentes." -ForegroundColor Gray
Write-Host ""

# Verificar diretorio SQL
if (-not (Test-Path $SqlDir)) {
    Write-Host "Erro: Diretorio $SqlDir nao encontrado" -ForegroundColor Red
    exit 1
}

# Verificar container
$containerRunning = docker ps --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }
if (-not $containerRunning) {
    Write-Host "Erro: Container '$ContainerName' nao esta rodando" -ForegroundColor Red
    Write-Host "Execute: docker-compose up -d postgres" -ForegroundColor Yellow
    exit 1
}

# Executar todos os SQLs em ordem
$sqlFiles = Get-ChildItem -Path $SqlDir -Filter "*.sql" | Sort-Object Name
$successCount = 0
$errorCount = 0

foreach ($sqlFile in $sqlFiles) {
    $filename = $sqlFile.Name

    # Pular o init que cria os databases (ja existem)
    if ($filename -eq "01-init.sql") {
        Write-Host "  [SKIP] $filename (databases ja existem)" -ForegroundColor DarkGray
        continue
    }

    Write-Host "  [>] $filename" -ForegroundColor Yellow -NoNewline

    $sqlContent = Get-Content -Path $sqlFile.FullName -Raw

    # Executar no banco principal
    $result = $sqlContent | docker exec -i $ContainerName psql -U postgres -d $DbName -q 2>&1
    $mainOk = $LASTEXITCODE -eq 0

    # Executar no banco de testes
    $resultTest = $sqlContent | docker exec -i $ContainerName psql -U postgres -d "${DbName}_test" -q 2>&1
    $testOk = $LASTEXITCODE -eq 0

    if ($mainOk -and $testOk) {
        Write-Host " [OK]" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host " [WARN]" -ForegroundColor Yellow
        if (-not $mainOk) {
            Write-Host "    ${DbName}: $result" -ForegroundColor Yellow
        }
        if (-not $testOk) {
            Write-Host "    ${DbName}_test: $resultTest" -ForegroundColor Yellow
        }
        $errorCount++
    }
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
if ($errorCount -eq 0) {
    Write-Host "  [OK] Sync concluido! $successCount arquivos executados com sucesso." -ForegroundColor Green
} else {
    Write-Host "  [!] Sync concluido com avisos. $successCount OK, $errorCount com avisos." -ForegroundColor Yellow
}
Write-Host "==============================================================================" -ForegroundColor Cyan
