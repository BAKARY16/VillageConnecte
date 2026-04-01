FROM node:20-alpine

LABEL maintainer="FabLab UVCI"
LABEL description="Village Connecte - API Backend + Frontends"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
