#!/bin/bash

# Configurações do Servidor
VPS_HOST="administrator@190.2.72.72"
TARGET_DIR="~/plataforma-eventos"

echo "=========================================================="
echo "🚀 Iniciando deploy seguro para PLATAFORMA EVENTOS"
echo "🌐 Servidor: $VPS_HOST"
echo "📁 Diretório de destino: $TARGET_DIR"
echo "=========================================================="

# 1. Cria a pasta no servidor caso não exista
echo "📂 Garantindo que o diretório de destino existe..."
ssh $VPS_HOST "mkdir -p $TARGET_DIR"
if [ $? -ne 0 ]; then
    echo "❌ Erro ao conectar no servidor. Verifique suas credenciais."
    exit 1
fi

# 2. Compacta o monorepo localmente
echo "📦 Compactando projeto localmente..."
tar --exclude='.git' \
    --exclude='.turbo' \
    --exclude='node_modules' \
    --exclude='*/node_modules' \
    --exclude='*/*/node_modules' \
    --exclude='dist' \
    --exclude='*/dist' \
    --exclude='.next' \
    --exclude='*/.next' \
    --exclude='.env' \
    --exclude='*.log' \
    --exclude='deploy.tar.gz' \
    -czf deploy.tar.gz .

echo "⬆️ Enviando pacote para o servidor via SCP..."
scp deploy.tar.gz $VPS_HOST:$TARGET_DIR/
if [ $? -ne 0 ]; then
    echo "❌ Falha no envio do pacote."
    rm deploy.tar.gz
    exit 1
fi

echo "🧹 Limpando pacote local..."
rm deploy.tar.gz

# 3. Descompacta, prepara .env caso não exista e inicia serviços
echo "🐳 Configurando projeto e subindo containers via Docker Compose..."
ssh -t $VPS_HOST "cd $TARGET_DIR && \
    tar -xzf deploy.tar.gz && \
    rm deploy.tar.gz && \
    if [ ! -f .env ]; then \
        echo '📄 Criando arquivo .env padrão...' && \
        cp .env.production.example .env; \
    fi && \
    sudo docker compose -f docker-compose.prod.yml build --no-cache api worker frontend nginx && \
    sudo docker compose -f docker-compose.prod.yml up -d && \
    sudo docker compose -f docker-compose.prod.yml restart nginx"

if [ $? -ne 0 ]; then
    echo "❌ Ocorreu um erro na construção dos containers."
    exit 1
fi

# 4. Executa migrações do banco de dados (Prisma)
echo "🗄️ Executando migrações do banco de dados..."
ssh -t $VPS_HOST "cd $TARGET_DIR && \
    sudo docker compose -f docker-compose.prod.yml exec -T api ./apps/api/node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma"

if [ $? -eq 0 ]; then
    echo "=========================================================="
    echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
    echo "🌐 Acesse no navegador: https://eventos.valterpcjria.com.br"
    echo "⚠️ Mapeie o domínio para http://localhost:3050 no Nginx Proxy Manager."
    echo "=========================================================="
else
    echo "❌ Falha ao rodar as migrações do banco de dados."
    exit 1
fi
