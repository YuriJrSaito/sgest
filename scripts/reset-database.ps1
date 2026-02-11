# =============================================================================
# Reset e recria o banco de dados via Docker (PowerShell)
# Uso: .\scripts\reset-database.ps1 [-Force]
# =============================================================================

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$ContainerName = if ($env:CONTAINER_NAME) { $env:CONTAINER_NAME } else { "sgest_db" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "sgest" }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SqlDir = Join-Path (Split-Path -Parent $ScriptDir) "docker-init"

Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "                         RESET DATABASE - sgest" -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Container: " -NoNewline; Write-Host "$ContainerName" -ForegroundColor Green
Write-Host "Database:  " -NoNewline; Write-Host "$DbName / ${DbName}_test" -ForegroundColor Green
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

# Confirmar
if (-not $Force) {
    Write-Host "[!] ATENCAO: Isso vai APAGAR todos os dados!" -ForegroundColor Red
    $confirm = Read-Host "Continuar? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Cancelado."
        exit 0
    }
}

Write-Host ""
Write-Host "[1/3] Dropando databases..." -ForegroundColor Yellow

$dropSql = @"
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname IN ('$DbName', '${DbName}_test') AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $DbName;
DROP DATABASE IF EXISTS ${DbName}_test;
"@

$dropSql | docker exec -i $ContainerName psql -U postgres -d postgres

Write-Host "[OK] Databases dropados" -ForegroundColor Green

Write-Host ""
Write-Host "[2/3] Criando databases..." -ForegroundColor Yellow

$createSql = @"
CREATE DATABASE $DbName;
CREATE DATABASE ${DbName}_test;
"@

$createSql | docker exec -i $ContainerName psql -U postgres -d postgres

Write-Host "[OK] Databases criados" -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Executando migrations..." -ForegroundColor Yellow

$sqlFiles = Get-ChildItem -Path $SqlDir -Filter "*.sql" | Sort-Object Name

foreach ($sqlFile in $sqlFiles) {
    $filename = $sqlFile.Name

    if ($filename -eq "01-init.sql") {
        continue
    }

    Write-Host "  [>] $filename" -ForegroundColor Yellow

    $sqlContent = Get-Content -Path $sqlFile.FullName -Raw
    $sqlContent | docker exec -i $ContainerName psql -U postgres -d $DbName -q
    $sqlContent | docker exec -i $ContainerName psql -U postgres -d "${DbName}_test" -q
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "                         [OK] DATABASE RESETADO!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
