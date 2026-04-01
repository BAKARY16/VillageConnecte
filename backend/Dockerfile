FROM node:20-alpine

# Metadata
LABEL maintainer="FabLab UVCI"
LABEL description="Village Connecté - API Backend"

# Répertoire de travail
WORKDIR /app

# Copier les dépendances en premier (cache Docker)
COPY package*.json ./

# Installer les dépendances
RUN npm ci --omit=dev && npm cache clean --force

# Copier le code source
COPY . .

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 && \
    chown -R nodeuser:nodejs /app

USER nodeuser

# Exposer le port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Démarrer l'application
CMD ["node", "src/server.js"]
