# Déploiement Village Connecté en production

Guide complet pour déployer Village Connecté sur le serveur de production avec Traefik, HTTPS automatique (Let's Encrypt) et MySQL.

---

## 1. Architecture cible

```
  Internet (HTTPS)
        ↓
  Traefik (deja en route sur le serveur, gere TLS + routing)
        ↓ Host(villageconnecte.voisilab.online)
  villageconnecte-backend  (Express, port 3001 interne)
        ├── /api/*        → routes API REST
        ├── /admin        → admin/build (React, statique)
        └── /             → portail-captif/build (React, statique)
                ↓
        villageconnecte-db (MySQL 8.0, reseau interne uniquement)
```

Un seul conteneur backend sert l'API et les deux frontends en fichiers statiques.
MySQL n'est jamais exposé à l'extérieur (réseau Docker interne).

---

## 2. Les deux fichiers docker-compose

Le projet contient **deux** `docker-compose.yml` distincts :

| Fichier | Usage | Traefik | Ports exposés |
|---|---|---|---|
| `docker-compose.yml` (racine) | **PROD** | ✅ Oui | Aucun (Traefik route en HTTPS) |
| `backend/docker-compose.yml` | Dev local | ❌ Non | `3001:3001` direct |

⚠️ **En production, toujours utiliser celui de la racine.**

---

## 3. Prérequis sur le serveur

- Docker + docker-compose installés
- Traefik déjà en cours d'exécution sur le serveur
- Réseau Docker `traefik-network` existant
- DNS : `villageconnecte.voisilab.online` → IP du serveur
- Un certificat Let's Encrypt configuré côté Traefik (resolver `letsencrypt`)

Vérifier :
```bash
docker network ls | grep traefik-network
# Si absent :
docker network create traefik-network

docker ps | grep traefik
# Doit montrer le conteneur Traefik en route
```

---

## 4. Première installation

### 4.1 Cloner le projet
```bash
ssh prod@srv853989
cd ~
git clone git@github.com:BAKARY16/VillageConnecte.git "souleymane's app/VillageConnecte"
cd "souleymane's app/VillageConnecte"
```

### 4.2 Builder les frontends statiques
Traefik route vers le backend qui sert les builds React en statique.

```bash
# Admin
cd admin
npm install
npm run build
cd ..

# Portail captif
cd portail-captif
npm install
npm run build
cd ..
```

Les dossiers `admin/build/` et `portail-captif/build/` doivent exister avant de démarrer la stack.

### 4.3 Créer le fichier `.env` à la racine
```bash
nano .env
chmod 600 .env
```

Contenu :

```bash
# ─── Domaine ───────────────────────────────────────
DOMAIN=villageconnecte.voisilab.online

# ─── App ───────────────────────────────────────────
NODE_ENV=production
PORT=3001
JWT_SECRET=<remplacer par: openssl rand -base64 48>
JWT_EXPIRES_IN=24h
CORS_ORIGINS=https://villageconnecte.voisilab.online

# ─── MySQL (lus par le service "db" du compose) ────
MYSQL_ROOT_PASSWORD=<openssl rand -base64 24>
MYSQL_DATABASE=village_connecte
MYSQL_USER=vc_user
MYSQL_PASSWORD=<openssl rand -base64 24>

# ─── Variables miroir attendues par le backend ─────
# IMPORTANT : doivent etre identiques aux MYSQL_* ci-dessus
DB_USER=vc_user
DB_PASSWORD=<meme valeur que MYSQL_PASSWORD>
DB_NAME=village_connecte
```

Génération de secrets forts :
```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 24   # mots de passe DB
```

⚠️ **Ne jamais commiter le `.env`**. Vérifier qu'il est dans `.gitignore` :
```bash
grep -E "^\.env$" .gitignore || echo ".env" >> .gitignore
```

### 4.4 Démarrer la stack
```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

### 4.5 Vérifier le déploiement
```bash
# Healthcheck
curl https://villageconnecte.voisilab.online/health

# API
curl https://villageconnecte.voisilab.online/api/dashboard/kpis

# Dans un navigateur
#  → https://villageconnecte.voisilab.online/admin   (dashboard admin)
#  → https://villageconnecte.voisilab.online/        (portail captif)
```

---

## 5. Mises à jour ultérieures

```bash
cd ~/"souleymane's app/VillageConnecte"
git pull origin main

# Si les frontends ont change :
cd admin && npm run build && cd ..
cd portail-captif && npm run build && cd ..

# Recreer les conteneurs
docker compose up -d --build

# Verifier
docker compose ps
docker compose logs -f backend
```

---

## 6. Variables d'environnement complètes

Le backend supporte aussi ces variables (à ajouter au `.env` selon les besoins) :

### Paiement FedaPay
```bash
PAYMENT_GATEWAY=fedapay
FEDAPAY_TEST_MODE=false
FEDAPAY_ENVIRONMENT=live
FEDAPAY_SECRET_KEY=sk_live_xxx
FEDAPAY_API_KEY=pk_live_xxx
FEDAPAY_PUBLIC_KEY=pk_live_xxx
FEDAPAY_CHECKOUT_MODE=redirect
FEDAPAY_API_BASE=https://api.fedapay.com
BACKEND_PUBLIC_BASE_URL=https://villageconnecte.voisilab.online
```

### MikroTik (portail captif Wi-Fi)
```bash
MIKROTIK_ENABLED=true
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=api-user
MIKROTIK_PASSWORD=<secret>
MIKROTIK_PORT=8728
MIKROTIK_TIMEOUT_SECONDS=30
MIKROTIK_CONNECT_COOLDOWN_MS=60000
```

### Sessions et metrics
```bash
SESSION_EXPIRY_CHECK_MS=30000
METRICS_INGEST_TOKEN=<openssl rand -hex 32>
```

---

## 7. Administration de la base MySQL

phpMyAdmin n'est pas exposé sur Internet. Trois façons d'accéder à la DB :

### 7.1 Shell MySQL dans le conteneur
```bash
docker compose exec db mysql -uroot -p
# Mot de passe = MYSQL_ROOT_PASSWORD du .env
```

### 7.2 Tunnel SSH + client local (DBeaver, TablePlus, MySQL Workbench)
```bash
# Sur ta machine locale :
ssh -L 3307:127.0.0.1:3306 prod@srv853989

# Puis dans ton client MySQL :
#   Host: localhost
#   Port: 3307
#   User: root
#   Password: <MYSQL_ROOT_PASSWORD>
```

### 7.3 phpMyAdmin local via tunnel
Le compose racine définit phpMyAdmin sur `127.0.0.1:8081` (non exposé publiquement). Pour y accéder :
```bash
ssh -L 8081:127.0.0.1:8081 prod@srv853989
# puis ouvrir http://localhost:8081 dans le navigateur
```

---

## 8. Sauvegardes

### Sauvegarde manuelle
```bash
docker compose exec -T db mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" village_connecte \
  > backup_$(date +%F_%H-%M).sql
```

### Sauvegarde automatique (cron)
Ajouter au crontab du serveur (`crontab -e`) :
```cron
# Sauvegarde quotidienne a 3h du matin
0 3 * * * cd ~/"souleymane's app/VillageConnecte" && \
  docker compose exec -T db mysqldump -uroot -p"$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2)" \
  village_connecte > ~/backups/vc_$(date +\%F).sql 2>&1
```

### Restauration
```bash
cat backup_2026-05-05.sql | docker compose exec -T db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" village_connecte
```

---

## 9. Dépannage

### Port déjà alloué au démarrage
Symptôme :
```
Bind for 127.0.0.1:8080 failed: port is already allocated
```
→ Un autre service occupe le port. Identifier :
```bash
ss -tlnp | grep :8080
```
Soit changer le port dans le compose, soit retirer le service concerné (cf. la PR `fix/remove-phpmyadmin`).

### Le conteneur backend redémarre en boucle
```bash
docker compose logs --tail=50 backend
```
Causes fréquentes :
- `.env` manquant ou mal formé
- `DB_USER`/`DB_PASSWORD` ne correspondent pas à `MYSQL_USER`/`MYSQL_PASSWORD`
- Frontend non buildé (`admin/build/` ou `portail-captif/build/` absent)

### Traefik ne route pas vers le backend
- Vérifier que le réseau `traefik-network` est bien attaché : `docker inspect villageconnecte-backend | grep -A5 Networks`
- Vérifier les labels Traefik : `docker inspect villageconnecte-backend | grep -A20 Labels`
- Vérifier que `DOMAIN` dans `.env` correspond exactement au DNS configuré
- Vérifier les logs Traefik : `docker logs traefik 2>&1 | grep villageconnecte`

### MySQL refuse les connexions
- Si tu as changé `MYSQL_PASSWORD` après la première initialisation, MySQL ne le prend pas en compte (les `MYSQL_*` ne s'appliquent qu'à la première création du volume).
- Solutions :
  - Soit `docker compose down -v` (⚠️ supprime toutes les données puis recrée la base)
  - Soit `ALTER USER 'vc_user'@'%' IDENTIFIED BY 'nouveau_mdp';` dans le shell MySQL

### Certificat HTTPS non émis
- Vérifier que le domaine pointe bien vers le serveur : `dig villageconnecte.voisilab.online`
- Vérifier le resolver Traefik (label `traefik.http.routers.villageconnecte.tls.certresolver=letsencrypt`)
- Logs Traefik : `docker logs traefik 2>&1 | grep -i "letsencrypt\|acme"`

---

## 10. Sécurité — checklist production

- [ ] `.env` créé avec des secrets aléatoires (pas les valeurs par défaut du compose)
- [ ] `.env` en `chmod 600`, présent dans `.gitignore`
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGINS` limité au domaine de prod
- [ ] phpMyAdmin non exposé sur Internet (uniquement `127.0.0.1`)
- [ ] MySQL non exposé (pas de mapping `ports:` sur le service `db`)
- [ ] HTTPS actif via Traefik + Let's Encrypt
- [ ] Sauvegardes MySQL programmées
- [ ] Fail2ban / firewall actif sur le serveur
- [ ] FedaPay en mode `live` uniquement quand prêt à encaisser

---

## 11. Endpoints principaux

```
GET  /health                      → healthcheck
POST /api/auth/login              → connexion admin
POST /api/vouchers/validate       → validation voucher Wi-Fi
GET  /api/vouchers/status/:code   → statut d'un voucher
GET  /api/dashboard/kpis          → KPIs admin
GET  /api/bornes                  → liste des bornes Wi-Fi
GET  /api/agents                  → liste des agents
GET  /api/sessions                → sessions Wi-Fi en cours
GET  /api/transactions            → historique des paiements
GET  /api/alertes                 → alertes systeme
GET  /api/tarifs                  → tarifs actifs
```

---

## 12. Contacts et historique

- **Projet** : Village Connecté Dioradougou
- **Structure** : FabLab UVCI (Université Virtuelle de Côte d'Ivoire)
- **Domaine de production** : `https://villageconnecte.voisilab.online`
- **Repository** : `git@github.com:BAKARY16/VillageConnecte.git`
- **Serveur** : `srv853989`
- **Document créé le** : 2026-05-05
