# Village Connecté — Backend API

**Node.js + MySQL + Docker** · Dioradougou · FabLab UVCI 🇨🇮

---

## ⚡ Démarrage rapide (3 commandes)

```bash
# 1. Cloner / extraire le projet backend
cd village-connecte-backend

# 2. Copier la configuration
cp .env.example .env

# 3. Lancer tout avec Docker
docker compose up --build -d
```

L'API sera disponible sur **http://localhost:3001**

---

## 🐳 Prérequis

| Outil | Version minimale | Vérifier |
|-------|-----------------|---------|
| Docker Desktop | 24+ | `docker --version` |
| Docker Compose | 2.x | `docker compose version` |
| (Optionnel) Node.js | 20+ | `node --version` |

---

## 📁 Structure du projet

```
village-connecte-backend/
├── src/
│   ├── server.js              ← Point d'entrée Express
│   ├── config/
│   │   └── database.js        ← Pool de connexions MySQL
│   ├── middleware/
│   │   ├── auth.js            ← JWT + protection routes
│   │   └── validate.js        ← Schémas Joi
│   ├── routes/
│   │   ├── auth.js            ← Login / Logout / Me
│   │   ├── vouchers.js        ← Validation + CRUD vouchers
│   │   └── api.js             ← Bornes, Agents, Sessions, KPIs...
│   ├── utils/
│   │   └── voucher.js         ← Génération codes, décompte temps
│   └── services/
│       ├── api.client.js      ← Service pour le dashboard Admin
│       └── portal.api.js      ← Service pour le portail captif
├── scripts/
│   ├── init.sql               ← Schéma MySQL complet (13 tables, 5 vues)
│   └── seed.js                ← Données initiales (bornes, agents, 200 vouchers)
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## 🚀 Commandes Docker essentielles

### Démarrer les services
```bash
docker compose up -d
# ou avec rebuild (après modification du code)
docker compose up --build -d
```

### Voir les logs en temps réel
```bash
# Tous les services
docker compose logs -f

# API seulement
docker compose logs -f api

# MySQL seulement
docker compose logs -f mysql
```

### Arrêter les services
```bash
docker compose down
# Arrêter ET supprimer les données (reset complet)
docker compose down -v
```

### Vérifier l'état des conteneurs
```bash
docker compose ps
```

### Relancer le seed manuellement
```bash
docker compose exec api node scripts/seed.js
```

### Accéder au shell MySQL
```bash
docker compose exec mysql mysql -u vc_user -pvc_secure_pass_2026 village_connecte
```

### Rebuild après modifications
```bash
docker compose up --build -d api
```

---

## 🌐 Services exposés

| Service | URL | Description |
|---------|-----|-------------|
| **API REST** | http://localhost:3001 | Backend principal |
| **phpMyAdmin** | http://localhost:8080 | Interface base de données |
| **MySQL** | localhost:3306 | Base de données directe |

### Connexion phpMyAdmin
- Serveur: mysql
- Utilisateur: `root`
- Mot de passe: `root_secure_pass_2026`

---

## 🔐 Authentification Admin

### Credentials par défaut
```
Email    : admin@village-connecte.ci
Password : Admin2026!
```

### Obtenir un token JWT
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@village-connecte.ci","password":"Admin2026!"}'
```

**Réponse:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": 1,
    "nom": "Administrateur",
    "prenom": "Village Connecté",
    "email": "admin@village-connecte.ci",
    "role": "superadmin"
  }
}
```

### Utiliser le token
```bash
# Ajouter dans le header de toutes les requêtes admin:
Authorization: Bearer <votre_token>
```

---

## 📚 Documentation API complète

### ── SANTÉ / MONITORING ──────────────────────────

```
GET  /health
```
**Réponse:**
```json
{ "status": "ok", "database": "connected", "uptime": 42 }
```

---

### ── AUTHENTIFICATION ────────────────────────────

```
POST /api/auth/login
POST /api/auth/logout          [AUTH]
GET  /api/auth/me              [AUTH]
PUT  /api/auth/password        [AUTH]
```

**POST /api/auth/login**
```json
// Body
{ "email": "admin@village-connecte.ci", "password": "Admin2026!" }
```

---

### ── PORTAIL CAPTIF (sans authentification) ──────

#### Valider un code voucher
```
POST /api/vouchers/validate
```
```json
// Body
{
  "code":       "ABC12345",
  "mac":        "AA:BB:CC:DD:EE:FF",
  "borne_id":   "B08",
  "ip_address": "10.0.0.45"
}
```
**Réponse succès (première activation):**
```json
{
  "success": true,
  "reconnection": false,
  "message": "Code activé avec succès. Connexion WiFi autorisée.",
  "voucher": {
    "code": "ABC12345",
    "tarif": "Journalier",
    "tarif_slug": "journalier",
    "duree_heures": 24,
    "prix": 200,
    "vitesse_mbps": 5,
    "activated_at": "2026-03-31T10:00:00.000Z",
    "expires_at":   "2026-04-01T10:00:00.000Z",
    "secondes_restantes": 86400
  }
}
```
**⚡ Logique décompte persistant:** Le compte à rebours commence à l'activation et continue même si l'utilisateur se déconnecte. Si le même code est resaisi avant expiration → `reconnection: true`.

**Règle métier importante:** Un voucher généré mais jamais saisi dans le portail n'a pas de date d'expiration définie (`activated_at = NULL`, `expires_at = NULL`). L'expiration est calculée uniquement au moment de la première validation du code sur le portail captif.

**Erreurs possibles:**
```json
{ "success": false, "error": "Code invalide ou introuvable.", "code_error": "NOT_FOUND" }
{ "success": false, "error": "Ce code est expiré.",           "code_error": "EXPIRED"    }
{ "success": false, "error": "Ce code a été révoqué.",        "code_error": "REVOKED"    }
```

#### Vérifier le statut d'un voucher
```
GET /api/vouchers/status/:code
```
```bash
curl http://localhost:3001/api/vouchers/status/ABC12345
```
**Réponse:**
```json
{
  "success": true,
  "code": "ABC12345",
  "statut": "utilise",
  "tarif": "Journalier",
  "activated_at": "2026-03-31T10:00:00.000Z",
  "expires_at":   "2026-04-01T10:00:00.000Z",
  "secondes_restantes": 72000
}
```

#### Heartbeat session (maintien connexion)
```
POST /api/sessions/heartbeat
```
```json
{ "mac": "AA:BB:CC:DD:EE:FF", "borne_id": "B08" }
```
**Réponse:**
```json
{
  "success": true,
  "authorized": true,
  "secondes_restantes": 71500,
  "expires_at": "2026-04-01T10:00:00.000Z"
}
```

#### Récupérer les tarifs
```
GET /api/tarifs
```
**Réponse:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "nom": "Journalier",   "slug": "journalier",   "prix_fcfa": 200,  "duree_heures": 24,  "vitesse_mbps": 5 },
    { "id": 2, "nom": "Hebdomadaire", "slug": "hebdomadaire", "prix_fcfa": 1000, "duree_heures": 168, "vitesse_mbps": 5 },
    { "id": 3, "nom": "Mensuel",      "slug": "mensuel",      "prix_fcfa": 3000, "duree_heures": 720, "vitesse_mbps": 5 }
  ]
}
```

---

### ── ADMIN — VOUCHERS ─────────────────────────────

```
GET  /api/vouchers              [AUTH] ?page=1&limit=20&statut=actif&type=journalier&search=
POST /api/vouchers/generate     [AUTH]
GET  /api/vouchers/stats/summary [AUTH]
DELETE /api/vouchers/:id        [AUTH]
```

**POST /api/vouchers/generate**
```json
{
  "tarif_slug": "journalier",
  "quantite":   50,
  "agent_id":   "AGT001",
  "methode":    "cash"
}
```
**Réponse:**
```json
{
  "success": true,
  "message": "50 voucher(s) journalier(s) générés avec succès.",
  "count": 50,
  "vouchers": [
    { "id": "uuid", "code": "AB3K9XP2", "tarif_slug": "journalier", "prix": 200 },
    ...
  ]
}
```

---

### ── ADMIN — BORNES ───────────────────────────────

```
GET    /api/bornes              [AUTH]
GET    /api/bornes/:id          [AUTH]
POST   /api/bornes              [AUTH]
PUT    /api/bornes/:id          [AUTH]
PATCH  /api/bornes/:id/status   [AUTH]
DELETE /api/bornes/:id          [AUTH]
```

**GET /api/bornes** — Liste toutes les bornes avec leurs métriques live

**PATCH /api/bornes/B08/status**
```json
{
  "statut":          "online",
  "signal_pct":      95,
  "batterie_pct":    88,
  "users_connectes": 22
}
```

---

### ── ADMIN — AGENTS ───────────────────────────────

```
GET    /api/agents              [AUTH]
GET    /api/agents/:id          [AUTH]
POST   /api/agents              [AUTH]
PUT    /api/agents/:id          [AUTH]
DELETE /api/agents/:id          [AUTH]
```

**POST /api/agents**
```json
{
  "nom":          "Koné Mamadou",
  "telephone":    "+225 07 12 34 56",
  "zone":         "Centre / Est",
  "statut":       "actif",
  "commission_pct": 12,
  "bornes":       ["B01", "B02", "B03"]
}
```

---

### ── ADMIN — SESSIONS ACTIVES ────────────────────

```
GET    /api/sessions            [AUTH]
DELETE /api/sessions/:id        [AUTH]
```

---

### ── ADMIN — TRANSACTIONS ────────────────────────

```
GET /api/transactions           [AUTH] ?page=1&limit=20&statut=succes&agent_id=
GET /api/transactions/analytics [AUTH]
```

---

### ── ADMIN — DASHBOARD ───────────────────────────

```
GET /api/dashboard/kpis         [AUTH]
GET /api/dashboard/revenus      [AUTH] ?days=30
GET /api/dashboard/connexions   [AUTH]
```

**GET /api/dashboard/kpis**
```json
{
  "success": true,
  "data": {
    "sessions_actives": 127,
    "revenus_jour":     48600,
    "revenus_semaine":  287400,
    "revenus_mois":     1243000,
    "vouchers_jour":    243,
    "agents_actifs":    5,
    "bornes_online":    11,
    "bornes_offline":   1,
    "alertes_actives":  4,
    "revenus_hier":     45200,
    "bornes_total":     13
  }
}
```

---

### ── ADMIN — ALERTES ─────────────────────────────

```
GET   /api/alertes              [AUTH] ?resolue=false
POST  /api/alertes              [AUTH]
PATCH /api/alertes/:id/resolve  [AUTH]
```

---

### ── ADMIN — TARIFS ──────────────────────────────

```
GET /api/tarifs                 (public)
PUT /api/tarifs/:id             [AUTH]
```

---

## 🔗 Connecter les frontends au backend

### Dashboard Admin (village-connecte-admin)

1. Créer le fichier `.env` dans `village-connecte-admin/`:
```env
REACT_APP_API_URL=http://localhost:3001
```

2. Copier `src/services/api.client.js` → `village-connecte-admin/src/services/api.js`

3. Dans `AppContext.js`, remplacer les imports mockData par les appels API:
```js
import { dashboardAPI, bornesAPI, agentsAPI, vouchersAPI, sessionsAPI, alertesAPI } from './services/api';

// Exemple: charger les bornes au démarrage
useEffect(() => {
  bornesAPI.list().then(res => setBornes(res.data));
}, []);
```

4. Pour le login, remplacer la fonction mock:
```js
const login = async (credentials) => {
  try {
    const res = await authAPI.login(credentials.username, credentials.password);
    if (res.success) {
      localStorage.setItem('vc_token', res.token);
      setUser(res.admin);
      return true;
    }
  } catch (e) {
    return false;
  }
};
```

### Portail Captif (village-connecte-portal)

1. Créer `.env` dans `village-connecte-portal/`:
```env
REACT_APP_API_URL=http://localhost:3001
```

2. Copier `src/services/portal.api.js` → `village-connecte-portal/src/services/api.js`

3. Dans `PortalContext.js`, remplacer `validateVoucher`:
```js
import { validateVoucher as apiValidate } from './services/api';

const validateVoucher = async (code) => {
  const result = await apiValidate({
    code,
    mac: getMacAddress(),   // à implémenter
    borneId: 'B08',         // injecté par nodogsplash
  });
  return result;
};
```

---

## 🔒 Sécurité

| Mesure | Détail |
|--------|--------|
| **JWT** | Tokens signés HS256, expiration 24h |
| **bcrypt** | Mots de passe hashés (cost=12) |
| **Helmet** | Headers HTTP sécurisés |
| **Rate limiting** | 200 req/15min global, 10 tentatives login, 30 validations/min |
| **CORS** | Origins whitelist configurable |
| **Validation Joi** | Toutes les entrées validées |
| **SQL Paramétré** | Protection injection SQL (mysql2 prepared statements) |
| **Docker non-root** | API tourne en user `nodeuser` (UID 1001) |

---

## 🗄️ Structure de la base de données

| Table | Description |
|-------|-------------|
| `admins` | Comptes administrateurs |
| `bornes` | 13 bornes WiFi mesh |
| `agents` | Agents locaux |
| `agent_bornes` | Affectation agents ↔ bornes |
| `tarifs` | 3 formules (200/1000/3000 FCFA) |
| `vouchers` | Codes d'accès générés |
| `sessions_actives` | Sessions WiFi en cours |
| `transactions` | Paiements Mobile Money |
| `alertes` | Incidents réseau |

**Vues:**
- `v_kpis` — Indicateurs temps réel
- `v_agent_stats` — Stats agents + commissions
- `v_vouchers_detail` — Vouchers avec tarif + agent
- `v_sessions_actives` — Sessions actives + temps restant
- `v_revenus_30j` — Revenus 30 derniers jours

---

## ⚙️ Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3001` | Port de l'API |
| `DB_HOST` | `mysql` | Hôte MySQL (nom du service Docker) |
| `DB_NAME` | `village_connecte` | Nom de la base |
| `DB_USER` | `vc_user` | Utilisateur MySQL |
| `DB_PASSWORD` | `vc_secure_pass_2026` | Mot de passe MySQL |
| `JWT_SECRET` | *(voir .env.example)* | **À changer en production!** |
| `JWT_EXPIRES_IN` | `24h` | Durée des tokens |
| `CORS_ORIGINS` | `localhost:3000,3002` | Origins autorisées |

---

## 🧪 Tester l'API avec cURL

```bash
# Health check
curl http://localhost:3001/health

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@village-connecte.ci","password":"Admin2026!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Lister les vouchers
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/vouchers

# Générer 10 vouchers journaliers
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3001/api/vouchers/generate \
  -d '{"tarif_slug":"journalier","quantite":10,"agent_id":"AGT001"}'

# Valider un code (portail captif)
curl -X POST http://localhost:3001/api/vouchers/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"ABC12345","mac":"AA:BB:CC:DD:EE:FF","borne_id":"B08"}'

# KPIs dashboard
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/dashboard/kpis

# Alertes actives
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/alertes?resolue=false"
```

---

## 🐛 Dépannage

### L'API ne démarre pas
```bash
# Vérifier les logs
docker compose logs api

# Vérifier que MySQL est prêt
docker compose logs mysql | grep "ready for connections"
```

### Erreur de connexion à la DB
```bash
# Tester la connexion MySQL directement
docker compose exec mysql mysql -u vc_user -pvc_secure_pass_2026 -e "SHOW TABLES;" village_connecte
```

### Réinitialiser complètement
```bash
docker compose down -v          # Supprime les volumes
docker compose up --build -d    # Recrée tout
```

### Port déjà utilisé
```bash
# Changer le port dans .env
PORT=3002
# Et dans docker-compose.yml: "3002:3001"
```

---

## 📱 Intégration OpenWrt / nodogsplash (production)

Sur la borne HUB (B08), configurer nodogsplash pour utiliser l'API:

```bash
# /etc/config/nodogsplash
config nodogsplash
  option GatewayInterface  wlan0
  option GatewayPort       2050
  option GatewayName       "Village Connecté Dioradougou"
  option AuthDir           /tmp/ndsauth
  option PreAuthIdleTimeout 30
  option ClientIdleTimeout  10
  option RedirectURL        http://192.168.1.108/portal
```

Le portail captif (`REACT_APP_API_URL=http://192.168.1.108:3001`) interroge directement l'API qui tourne sur le HUB.

---

*© 2026 FabLab UVCI — Village Connecté Dioradougou*
