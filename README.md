# Village Connecte Dioradougou

**Node.js + MySQL + Docker + Traefik** - FabLab UVCI

Plateforme de gestion de bornes Wi-Fi solaires pour villages ruraux (Cote d'Ivoire).
Dashboard admin + API REST + portail captif + systeme de vouchers Wi-Fi.

---

## Architecture

```
Traefik (serveur) --> https://villageconnecte.voisilab.online
    |
    └── backend Express (port 3001)
            ├── /api/*      --> routes API REST
            ├── /health     --> healthcheck
            ├── /admin/*    --> dashboard admin (React build)
            └── /*          --> portail captif (React build)
                    |
              MySQL 8.0 (reseau interne)
              phpMyAdmin (localhost:8081)
```

Un seul conteneur backend sert l'API et les deux frontends en fichiers statiques.
Traefik tourne deja sur le serveur et gere le HTTPS + Let's Encrypt.

---

## Structure du projet

```
VillageConnecte/
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── server.js            # Point d'entree Express (API + statique)
│   │   ├── config/database.js   # Pool MySQL
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── scripts/
│       ├── init.sql             # Schema MySQL complet
│       └── seed.js              # Donnees initiales
├── admin/                       # Dashboard React
│   ├── src/
│   └── build/                   # Build statique servi par Express
└── portail-captif/              # Portail captif React
    ├── src/
    └── build/                   # Build statique servi par Express
```

---

## Prerequis

| Outil | Version minimale | Verifier |
|-------|-----------------|---------|
| Docker | 24+ | `docker --version` |
| Docker Compose | 2.x | `docker compose version` |
| Node.js | 20+ | `node --version` |
| Reseau Traefik | `traefik-network` existant sur le serveur | `docker network ls` |

---

## Deploiement sur le serveur

### 1. Builder les frontends

```bash
cd admin && npm install && npm run build && cd ..
cd portail-captif && npm install && npm run build && cd ..
```

### 2. Configurer l'environnement

Modifier le fichier `.env` avec les valeurs de production :

```env
MYSQL_ROOT_PASSWORD=<mot_de_passe_root_fort>
MYSQL_DATABASE=village_connecte
MYSQL_USER=vc_user
MYSQL_PASSWORD=<mot_de_passe_fort>

DB_HOST=db
DB_PORT=3306
DB_NAME=village_connecte
DB_USER=vc_user
DB_PASSWORD=<mot_de_passe_fort>
PORT=3001
NODE_ENV=production
JWT_SECRET=<secret_aleatoire_long>
JWT_EXPIRES_HOURS=8
CORS_ORIGINS=https://villageconnecte.voisilab.online

REACT_APP_API_URL=https://villageconnecte.voisilab.online/api
DOMAIN=villageconnecte.voisilab.online
```

### 3. Lancer les services

```bash
docker compose up --build -d
```

Le site sera accessible sur **https://villageconnecte.voisilab.online**

---

## Commandes utiles

### Logs

```bash
# Tous les services
docker compose logs -f

# Backend seulement
docker compose logs -f backend

# MySQL seulement
docker compose logs -f db
```

### Arreter / Redemarrer

```bash
docker compose down
docker compose up -d

# Reset complet (supprime les donnees)
docker compose down -v
docker compose up --build -d
```

### Etat des conteneurs

```bash
docker compose ps
```

### Acceder a MySQL en ligne de commande

```bash
docker compose exec db mysql -u vc_user -p village_connecte
```

### Relancer le seed

```bash
docker compose exec backend node scripts/seed.js
```

### Rebuild apres modification du code

```bash
docker compose up --build -d backend
```

---

## Services

| Service | Acces | Description |
|---------|-------|-------------|
| Portail captif | https://villageconnecte.voisilab.online | Page d'accueil utilisateurs |
| Dashboard admin | https://villageconnecte.voisilab.online/admin | Interface administration |
| API REST | https://villageconnecte.voisilab.online/api | Endpoints backend |
| Health check | https://villageconnecte.voisilab.online/health | Etat du service |
| phpMyAdmin | http://localhost:8081 (serveur uniquement) | Gestion base de donnees |

---

## Authentification admin

### Credentials par defaut (seed)

```
Email    : admin@village-connecte.ci
Password : Admin2026!
```

### Obtenir un token JWT

```bash
curl -X POST https://villageconnecte.voisilab.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@village-connecte.ci","password":"Admin2026!"}'
```

---

## Routes API principales

| Route | Auth | Description |
|-------|------|-------------|
| `GET /health` | Non | Etat du service + BDD |
| `POST /api/auth/login` | Non | Connexion admin |
| `POST /api/vouchers/validate` | Non | Validation code portail captif |
| `GET /api/vouchers/status/:code` | Non | Statut d'un voucher |
| `GET /api/tarifs` | Non | Liste des tarifs |
| `GET /api/dashboard/kpis` | Oui | Indicateurs temps reel |
| `GET /api/bornes` | Oui | Liste des bornes |
| `GET /api/agents` | Oui | Liste des agents |
| `GET /api/sessions` | Oui | Sessions actives |
| `GET /api/transactions` | Oui | Historique transactions |
| `GET /api/alertes` | Oui | Alertes reseau |
| `POST /api/vouchers/generate` | Oui | Generer des vouchers |

---

## Base de donnees

### Tables principales

| Table | Description |
|-------|-------------|
| `admins` | Comptes administrateurs |
| `bornes` | Bornes WiFi mesh |
| `agents` | Agents locaux |
| `agent_bornes` | Affectation agents / bornes |
| `tarifs` | Formules (200/1000/3000 FCFA) |
| `vouchers` | Codes d'acces generes |
| `sessions_actives` | Sessions WiFi en cours |
| `transactions` | Paiements |
| `alertes` | Incidents reseau |

### Vues

- `v_kpis` — Indicateurs temps reel
- `v_agent_stats` — Stats agents + commissions
- `v_vouchers_detail` — Vouchers avec tarif + agent
- `v_sessions_actives` — Sessions actives + temps restant
- `v_revenus_30j` — Revenus 30 derniers jours

---

## Variables d'environnement

| Variable | Defaut | Description |
|----------|--------|-------------|
| `PORT` | `3001` | Port du backend |
| `DB_HOST` | `db` | Hote MySQL (nom du service Docker) |
| `DB_NAME` | `village_connecte` | Nom de la base |
| `DB_USER` | `vc_user` | Utilisateur MySQL |
| `DB_PASSWORD` | — | Mot de passe MySQL |
| `JWT_SECRET` | — | Secret JWT (a changer en prod) |
| `JWT_EXPIRES_HOURS` | `8` | Duree des tokens |
| `CORS_ORIGINS` | `localhost` | Origins autorisees |
| `ADMIN_PATH` | `/admin-frontend` | Chemin du build admin (Docker) |
| `PORTAIL_PATH` | `/portail-frontend` | Chemin du build portail (Docker) |
| `NODE_ENV` | `development` | Environnement |

---

## Depannage

### Le backend ne demarre pas

```bash
docker compose logs backend
# Verifier que MySQL est pret
docker compose logs db | grep "ready for connections"
```

### Erreur de connexion BDD

```bash
docker compose exec db mysql -u vc_user -p -e "SHOW TABLES;" village_connecte
```

### Les frontends affichent une page blanche

Verifier que les builds existent :

```bash
ls admin/build/index.html
ls portail-captif/build/index.html
```

Si non, rebuilder :

```bash
cd admin && npm run build && cd ..
cd portail-captif && npm run build && cd ..
docker compose restart backend
```

### Le reseau traefik-network n'existe pas

```bash
docker network create traefik-network
```

---

*FabLab UVCI - Village Connecte Dioradougou*
