#!/bin/bash

# =============================================================================
# Reset e recria o banco de dados via Docker
# Uso: ./scripts/reset-database.sh [-f|--force]
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONTAINER_NAME="${CONTAINER_NAME:-sgest_db}"
DB_NAME="${DB_NAME:-sgest}"
FORCE=false

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force) FORCE=true; shift ;;
        *) shift ;;
    esac
done

echo -e "${YELLOW}══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}                         RESET DATABASE - sgest${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Container: ${GREEN}$CONTAINER_NAME${NC}"
echo -e "Database:  ${GREEN}$DB_NAME${NC} / ${GREEN}${DB_NAME}_test${NC}"
echo ""

# Verificar container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}Erro: Container '$CONTAINER_NAME' não está rodando${NC}"
    echo "Execute: docker-compose up -d postgres"
    exit 1
fi

# Confirmar
if [ "$FORCE" = false ] && [ -z "$CI" ]; then
    echo -e "${RED}⚠️  ATENÇÃO: Isso vai APAGAR todos os dados!${NC}"
    read -p "Continuar? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && echo "Cancelado." && exit 0
fi

echo ""
echo -e "${YELLOW}[1/3] Dropando databases...${NC}"

docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres <<EOF
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname IN ('$DB_NAME', '${DB_NAME}_test') AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $DB_NAME;
DROP DATABASE IF EXISTS ${DB_NAME}_test;
EOF

echo -e "${GREEN}✓ Databases dropados${NC}"

echo ""
echo -e "${YELLOW}[2/3] Criando databases...${NC}"

docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres <<EOF
CREATE DATABASE $DB_NAME;
CREATE DATABASE ${DB_NAME}_test;
EOF

echo -e "${GREEN}✓ Databases criados${NC}"

echo ""
echo -e "${YELLOW}[3/3] Executando migrations...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$SCRIPT_DIR/../docker-init"

for sql_file in $(ls "$SQL_DIR"/*.sql 2>/dev/null | sort); do
    filename=$(basename "$sql_file")

    [[ "$filename" == "01-init.sql" ]] && continue

    echo -e "  ${YELLOW}▶${NC} $filename"
    docker exec -i "$CONTAINER_NAME" psql -U postgres -d "$DB_NAME" -q < "$sql_file"
    docker exec -i "$CONTAINER_NAME" psql -U postgres -d "${DB_NAME}_test" -q < "$sql_file"
done

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                         ✓ DATABASE RESETADO!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════════════════════${NC}"
