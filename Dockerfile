FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    chromium \
    && npm install -g npm@latest

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p \
    data \
    uploads \
    plugins \
    public \
    views \
    logs

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
