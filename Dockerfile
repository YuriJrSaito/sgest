FROM node:24-alpine

WORKDIR /app

# Copia apenas package.json + package-lock.json primeiro para aproveitar cache
COPY package*.json ./

# Instala dependências dentro do container
RUN npm install

EXPOSE 3000 9229

# Copia o restante do código
COPY . .

CMD ["--inspect=0.0.0.0:9229", "npm", "run", "dev"]
