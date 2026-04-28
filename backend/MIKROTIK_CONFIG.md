# 🛠️ Configuration MikroTik Hotspot

## Vue d'ensemble

Cette intégration permet au backend de:
- ✅ Autoriser automatiquement les utilisateurs WiFi après validation d'un voucher
- ✅ Gérer les durées d'accès et déconnecter automatiquement à l'expiration
- ✅ Lister les utilisateurs actifs connectés
- ✅ Déconnecter manuellement les utilisateurs

---

## 🚀 Mise en ligne (voisilab.online)

Contexte de production:
- Backend/API public: https://villageconnecte.voisilab.online/api
- Admin: https://villageconnecte.voisilab.online/admin/
- Portail captif: pages HTML servies par le MikroTik (dossier hotspot), pas par le domaine public

Checklist rapide côté backend:

1. Utiliser un fichier `.env` de prod basé sur `backend/.env.production.example`
2. Vérifier au minimum:
  - `NODE_ENV=production`
  - `CORS_ORIGINS=https://villageconnecte.voisilab.online`
  - `BACKEND_PUBLIC_BASE_URL=https://villageconnecte.voisilab.online`
  - `BACKEND_BASE_URL=https://villageconnecte.voisilab.online/api`
  - `MIKROTIK_ENABLED=true`
3. Redémarrer le backend et vérifier:

```bash
curl https://villageconnecte.voisilab.online/health
curl https://villageconnecte.voisilab.online/api/public/tarifs
```

Checklist MikroTik quand on passe en ligne:

1. DNS/DHCP
  - Le DNS fourni aux clients WiFi doit pointer sur le MikroTik (IP LAN du routeur)
  - `allow-remote-requests=yes` activé

2. Hotspot profile
  - `html-directory=hotspot`
  - `login-by=http-pap,https`
  - `dns-name` cohérent avec le nom de domaine exposé aux clients (si certificat public)

3. Walled-garden (pré-auth)
  - Autoriser le domaine backend/public pour le portail MikroTik avant authentification:
    - `villageconnecte.voisilab.online`
  - Si le portail fait des appels XHR/fetch vers l'API online, ces appels doivent passer en pre-auth

4. Ne pas whitelister les domaines de détection captive des OS
  - Sinon Android/iOS/Windows pensent qu'Internet est déjà ouvert et n'affichent pas le portail.

5. API RouterOS
  - Vérifier l'utilisateur API (`api-user`) et le port (8728 ou 8729)
  - Vérifier la connectivité backend -> MikroTik en LAN/VPN privé (jamais exposer l'API RouterOS sur Internet)

6. Test de bout en bout
  - Générer un voucher depuis l'admin
  - Vérifier qu'il apparaît dans `/ip/hotspot/user`
  - Se connecter en client WiFi, valider le code, vérifier l'accès Internet et la page status

## Prérequis

1. **MikroTik RouterOS** (version 6.48+)
2. **Accès SSH ou interface Web** du MikroTik
3. **Profil Hotspot activé** sur le MikroTik
4. **Utilisateur API créé** sur le MikroTik

---

## 📋 Configuration MikroTik (Étapes)

### 1️⃣ Créer un utilisateur API

Accédez à la console MikroTik (SSH ou interface Web) et créez un utilisateur API:

```bash
/user add name=api-user password=MdPSuperSecurise group=full
```

### 2️⃣ Vérifier le Hotspot

Assurez-vous que le Hotspot est activé:

```bash
/ip hotspot profile print
/ip hotspot print
```

Si le hotspot n'existe pas, le créer:

```bash
/ip hotspot setup
# Répondre oui aux questions, utiliser l'interface de données
```

### 3️⃣ Configurer le serveur Hotspot

Vérifier que le serveur RADIUS ou la validation d'accès est bien con figurée:

```bash
/ip hotspot server profile print
```

### 4️⃣ Redirection automatique et HTTPS fiable

Pour que les telephones ouvrent automatiquement le portail captif, il faut distinguer deux sujets:

1. **Ouverture automatique du portail**
  - Elle depend surtout de la detection captive des OS (Android, iPhone, Windows), pas du backend.
  - Le Hotspot MikroTik doit bien intercepter les requetes HTTP de detection et servir `login.html` / `redirect.html`.
  - Le fallback le plus compatible reste un portail Hotspot joignable en **HTTP** sur l'IP/nom local du MikroTik.

2. **HTTPS sans alerte de securite**
  - Il n'existe pas de certificat local capable de "rassurer" proprement les appareils s'il n'est pas emis par une **autorite de confiance publique**.
  - Un certificat auto-signe ou local ne supprimera pas les alertes sur iPhone/Android/PC.
  - La bonne solution est d'utiliser un **nom de domaine** stable (ex: `wifi.village-connecte.ci`) avec un **certificat public valide** importe dans MikroTik.

Exemple de configuration Hotspot avec certificat valide:

```bash
/ip hotspot profile set [find default=yes] \
  dns-name=wifi.village-connecte.ci \
  hotspot-address=10.5.50.253 \
  login-by=http-pap,https \
  ssl-certificate=wifi-village-connecte
```

Points importants:
- `dns-name` doit correspondre exactement au nom du certificat.
- Le certificat doit etre emis par une CA reconnue publiquement.
- Le nom de domaine doit resoudre vers l'adresse du portail captive cote clients.
- Si certains appareils supportent mal HTTPS en pre-auth, garder **HTTP actif** en plus de HTTPS reste la configuration la plus robuste.

En pratique:
- **HTTP** sert a capter et ouvrir automatiquement le portail.
- **HTTPS** sert a rassurer les appareils compatibles, mais seulement avec un vrai certificat public.
- On ne cherche pas a contourner la verification TLS: on fournit une chaine de confiance valide.

### 5️⃣ Ouvrir automatiquement le portail des la connexion WiFi

Objectif: l'utilisateur se connecte simplement au SSID, puis l'appareil ouvre tout seul l'assistant captif ou affiche la page de login, sans taper l'URL manuellement.

Important:
- On ne peut pas **forcer 100%** des appareils a ouvrir une fenetre captive, car iPhone, Android et Windows decident eux-memes d'ouvrir ou non leur mini-navigateur.
- En revanche, on peut configurer MikroTik pour que le comportement soit correct et automatique sur la grande majorite des appareils.

Configuration minimale recommandee:

```bash
# 1. Le routeur doit repondre au DNS des clients
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8

# 2. Le DHCP doit donner le MikroTik comme DNS aux clients WiFi
/ip dhcp-server network set [find] dns-server=10.5.50.253 gateway=10.5.50.253

# 3. Le profil hotspot doit avoir un dns-name et accepter HTTP
/ip hotspot profile set [find default=yes] \
  hotspot-address=10.5.50.253 \
  dns-name=wifi.village-connecte.ci \
  login-by=http-pap,https \
  html-directory=hotspot

# 4. Verifier que le serveur hotspot est bien actif sur le bridge/interface WiFi
/ip hotspot print
/ip hotspot set [find] profile=default

# 5. NAT sortant Internet
/ip firewall nat add chain=srcnat action=masquerade out-interface-list=WAN
```

Verification importante:
- Ne pas mettre en walled-garden les domaines de detection captive des OS (`connectivitycheck`, `msftconnecttest`, `captive.apple.com`, `generate_204`).
- Si ces domaines passent librement, le telephone peut croire qu'Internet fonctionne deja et ne pas ouvrir le portail.

Comportement attendu:
- le client rejoint le SSID WiFi
- l'OS tente une URL de detection captive
- MikroTik intercepte la requete HTTP
- le portail `login.html` s'ouvre automatiquement ou le mini-browser captive apparait

Si certains appareils n'ouvrent toujours pas automatiquement:
- verifier que leur premiere requete n'est pas forcee en HTTPS uniquement
- garder `http-pap` actif dans `login-by`
- conserver une page `redirect.html` fonctionnelle dans le dossier hotspot
- verifier que les clients recoivent bien le DNS du MikroTik via DHCP

### Script pret a importer

Un script RouterOS reutilisable est disponible dans [backend/scripts/mikrotik-hotspot-autoredirect.rsc](backend/scripts/mikrotik-hotspot-autoredirect.rsc).

Usage recommande:

1. Adapter en tete du script:
  - `bridgeName`
  - `wanList`
  - `hotspotServer`
  - `hotspotAddress`
  - `hotspotCidr`
  - `backendApiIp`

2. Importer sur le MikroTik:

```bash
/import file-name=mikrotik-hotspot-autoredirect.rsc
```

3. Verifier ensuite:

```bash
/ip hotspot profile print detail
/ip hotspot walled-garden ip print
/ip dhcp-server network print detail
/ip dns print
```

Cette variante est la moins couteuse et la plus robuste:
- **HTTP** reste le mecanisme principal pour ouvrir automatiquement le portail captif.
- **HTTPS autosigne** peut rester active, mais ne doit pas etre le prerequis du flux captive.

---

## ⚙️ Configuration Backend

### 1️⃣ Ajouter les variables `.env`

Éditer `backend/.env`:

```env
# =============================================
# MIKROTIK HOTSPOT CONFIGURATION
# =============================================
MIKROTIK_ENABLED=true
MIKROTIK_HOST=192.168.88.1    # IP du MikroTik
MIKROTIK_USER=api-user
MIKROTIK_PASSWORD=MdPSuperSecurise
MIKROTIK_PORT=8728            # Port API (8729 si SSL/TLS)
```

### 2️⃣ Installer les dépendances

```bash
cd backend
npm install node-routeros
```

### 3️⃣ Vérifier l'injection Docker Compose

Si vous lancez l'API avec Docker Compose, assurez-vous que les variables MikroTik sont bien passées au service `api`:

```env
MIKROTIK_ENABLED=true
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=api-user
MIKROTIK_PASSWORD=MdPSuperSecurise
MIKROTIK_PORT=8728
SESSION_EXPIRY_CHECK_MS=30000
```

Le portail captif appelle ensuite le backend, et le backend envoie les ordres RouterOS au MikroTik (login, autorisation, déconnexion à l'expiration).

### 4️⃣ Redémarrer le backend

```bash
docker compose restart api
# ou
npm start
```

---

## 🧪 Tests

### Test 1: Vérifier la connexion

```bash
curl -X GET http://localhost:3001/api/mikrotik/test \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Réponse attendue:
```json
{
  "success": true,
  "connected": true,
  "enabled": true,
  "host": "192.168.88.1",
  "message": "Connecté au MikroTik ✅"
}
```

### Test 2: Lister les utilisateurs actifs

```bash
curl -X GET http://localhost:3001/api/mikrotik/users \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### Test 3: Valider un voucher (autorisation automatique)

```bash
curl -X POST http://localhost:3001/api/vouchers/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ABC12345",
    "mac": "AA:BB:CC:DD:EE:FF",
    "ip_address": "10.0.0.100",
    "borne_id": "B01"
  }'
```

Réponse:
```json
{
  "success": true,
  "reconnection": false,
  "message": "Code activé avec succès. Connexion WiFi autorisée.",
  "voucher": { /* ... */ },
  "mikrotik": {
    "success": true,
    "mikrotik": true,
    "mac": "AA:BB:CC:DD:EE:FF",
    "ip": "10.0.0.100",
    "message": "Utilisateur autorisé sur MikroTik"
  }
}
```

---

## 📚 Routes API MikroTik

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/mikrotik/test` | Tester la connexion |
| `GET` | `/api/mikrotik/users` | Lister utilisateurs actifs hotspot |
| `POST` | `/api/mikrotik/authorize` | Autoriser manuellement un client |
| `GET` | `/api/mikrotik/user/:mac` | Info utilisateur par MAC |
| `DELETE` | `/api/mikrotik/disconnect/:id` | Déconnecter par ID session |
| `DELETE` | `/api/mikrotik/disconnect-mac/:mac` | Déconnecter par MAC |
| `GET` | `/api/mikrotik/expiration/stats` | Stats expirations |
| `POST` | `/api/mikrotik/profiles/sync` | Synchroniser profils (tarifs → MikroTik) |
| `POST` | `/api/mikrotik/vouchers/sync` | Pousser tous les vouchers actifs vers MikroTik |
| `DELETE` | `/api/mikrotik/vouchers/:code` | Supprimer manuellement un user hotspot |

---

## 🔑 Gestion des utilisateurs hotspot (vouchers)

### Principe de fonctionnement

Chaque voucher est représenté par un utilisateur dans la liste `/ip/hotspot/user` du MikroTik :

| Champ MikroTik | Valeur |
|---|---|
| `name` | Code voucher en majuscules (ex: `AB3F7K2P`) |
| `password` | Idem (code = username = password) |
| `profile` | `vc-journalier`, `vc-hebdomadaire` ou `vc-mensuel` |
| `limit-uptime` | Durée du tarif (ex: `24h0m0s` pour journalier) |

### Cycle de vie automatique

```
Achat / Génération admin
        │
        ▼
 createHotspotUser()  ← Backend créé le user sur MikroTik
        │
        ▼
 Utilisateur se connecte au portail captif
        │
        ▼
 authorizeUser()  ← Backend force-login via /ip/hotspot/active/login
 (ou CHAP form fallback depuis le portail)
        │
        ▼
 Session active → polling /sessions/:id/status
        │
        ▼
 À l'expiration: deleteHotspotUser()  ← Backend supprime le user
              + disconnectUserByMac()  ← Ferme la session active
```

### Profils de bande passante

Les profils sont créés automatiquement avec le format `vc-<slug>` :
- `vc-journalier`  → ex: 5 Mbps down/up
- `vc-hebdomadaire` → ex: 10 Mbps down/up
- `vc-mensuel` → ex: 20 Mbps down/up

Synchroniser les profils manuellement (après changement de tarif) :

```bash
curl -X POST http://localhost:3001/api/mikrotik/profiles/sync \
  -H "Authorization: Bearer <JWT>"
```

### Synchronisation initiale (premier démarrage)

Si des vouchers ont été créés avant que le backend soit connecté au MikroTik :

```bash
# 1. Synchro des profils
curl -X POST http://localhost:3001/api/mikrotik/profiles/sync \
  -H "Authorization: Bearer <JWT>"

# 2. Synchro de tous les vouchers actifs
curl -X POST http://localhost:3001/api/mikrotik/vouchers/sync \
  -H "Authorization: Bearer <JWT>"
```

---

## 🌐 Connectivité backend ↔ MikroTik

### Avec câble ethernet (mode développement)

Le PC de développement est branché directement au MikroTik.
- MikroTik attribue une IP au PC (ex: `192.168.1.128`)
- Backend accède au MikroTik sur `MIKROTIK_HOST=192.168.1.158`

### Sans câble ethernet (mode WiFi / production)

Pour garder la communication **après débranchement du câble** :

1. **Configurer l'IP bridge MikroTik** (fixe sur toutes les interfaces) :
   ```bash
   # Sur MikroTik (SSH ou terminal)
   /ip address add address=192.168.88.1/24 interface=bridge
   ```

2. **Connecter le PC au réseau WiFi du MikroTik** (l'AP management)
   - Le PC obtient un IP sur `192.168.88.x`
   - Le MikroTik est accessible sur `192.168.88.1`

3. **Mettre à jour `.env`** :
   ```env
   MIKROTIK_HOST=192.168.88.1
   ```

4. **Donner une IP statique au PC backend** pour que `VC_API_BASE` dans le portail captif reste fixe :
   - Via DHCP statique sur MikroTik : `/ip dhcp-server lease add mac-address=XX:XX:XX:XX:XX:XX address=192.168.88.5`
   - Mettre à jour `login.html` : `window.VC_API_BASE = 'http://192.168.88.5:3001'`

### Réseau de production recommandé

```
[Internet] ──── [MikroTik] ──── [WiFi clients]
                     │
                     │ (bridge 192.168.88.0/24)
                     │
               [PC Backend :3001]
               MIKROTIK_HOST=192.168.88.1
```

---

## 🔓 Walled Garden — OBLIGATOIRE pour le portail captif

> **C'est probablement la raison principale pour laquelle "rien ne marche".**

Avant authentification, MikroTik **bloque tout le trafic** des clients WiFi, sauf :
- La page de login (servie par MikroTik lui-même)
- Les IP dans la liste **walled garden**

Si le backend est à `192.168.1.128:3001`, les clients non-authentifiés ne peuvent **pas** l'atteindre. Les appels `fetch()` depuis `login.html` échouent silencieusement ou en timeout.

### Solution : ajouter le backend au walled garden

Sur le terminal MikroTik (SSH ou Winbox → Terminal) :

```bash
# Autoriser l'accès au backend AVANT authentification
/ip hotspot walled-garden ip add action=accept dst-address=192.168.1.128 dst-port=3001 comment="VC Backend API"

# Vérifier
/ip hotspot walled-garden ip print
```

Si le backend est à une autre IP (ex: `192.168.88.5`) :

```bash
/ip hotspot walled-garden ip add action=accept dst-address=192.168.88.5 dst-port=3001 comment="VC Backend API"
```

### Vérifier que ça fonctionne

Depuis un téléphone connecté au WiFi hotspot **mais non authentifié**, ouvrir un navigateur et tester :

```
http://192.168.1.128:3001/health
```

→ Si la réponse contient `"status": "ok"`, le walled garden est bien configuré.  
→ Si timeout ou erreur, ajouter l'IP au walled garden comme ci-dessus.

---

## ⏰ Gestion d'expiration automatique

Le backend vérifie toutes les 30 secondes (configurable) si des sessions MikroTik doivent être fermées:

- Chaque session est associée à un voucher avec une durée d'accès
- À l'expiration, le backend:
  1. Marque la session comme expirée en DB
  2. Déconnecte l'utilisateur du hotspot MikroTik
  3. Libère les ressources WiFi

Variable de configuration (optionnelle):
```env
SESSION_EXPIRY_CHECK_MS=30000  # Vérification toutes les 30 secondes
```

---

## 🔒 Sécurité

### Points importants

1. **Port API**: Le port 8728 est **non-sécurisé**. Utiliser le VLAN ou le pare-feu pour restricter l'accès
2. **Mot de passe API**: Utiliser un mot de passe fort et unique
3. **Permissions**: L'utilisateur API ne doit avoir que les perms nécessaires (hotspot)

### Sécurisation supplémentaire (optionnel)

Créer un utilisateur avec permissions limitées:

```bash
/user group add name=hotspot-api
/user/permission add name=hotspot-login group=hotspot-api
/user add name=api-user password=<STRONG_PASS> group=hotspot-api
```

---

## 🐛 Dépannage

### Erreur: "Connexion refusée"

- Vérifier que le MikroTik est accessible via le réseau
- Vérifier l'IP dans `MIKROTIK_HOST`
- Vérifier que le port 8728 n'est pas bloqué par un firewall

### Erreur: "Identifiants invalides"

- Vérifier `MIKROTIK_USER` et `MIKROTIK_PASSWORD`
- Vérifier que l'utilisateur API a bien été créé sur MikroTik

### Utilisateurs ne sont pas autorisés

- Vérifier que le Hotspot est activé sur le MikroTik
- Vérifier les logs MikroTik: `/system/logging`
- Tester manuellement: `/ip/hotspot/active/print`

### Sessions ne sont pas fermées à l'expiration

- Vérifier que `SESSION_EXPIRY_CHECK_MS` n'est pas trop élevé
- Vérifier les logs backend: `docker compose logs api`
- Vérifier que `MIKROTIK_ENABLED=true`

---

## 📖 Ressources

- [MikroTik API Documentation](https://wiki.mikrotik.com/wiki/Manual:API)
- [MikroTik Hotspot Documentation](https://wiki.mikrotik.com/wiki/Manual:IP/Hotspot)
- [node-routeros GitHub](https://github.com/mikrotik-api/node-routeros)

---

## ✅ Checklist déploiement

- [ ] MikroTik routeur opérationnel avec Hotspot activé
- [ ] Utilisateur API créé sur MikroTik (`/user add name=api-user group=full`)
- [ ] Port API 8728 accessible depuis le backend
- [ ] Variables `.env` configurées (`MIKROTIK_ENABLED`, `MIKROTIK_HOST`, etc.)
- [ ] Dépendances npm installées (`npm install`)
- [ ] Test de connexion réussi : `GET /api/mikrotik/test`
- [ ] Profils synchronisés : `POST /api/mikrotik/profiles/sync`
- [ ] Vouchers existants synchronisés : `POST /api/mikrotik/vouchers/sync`
- [ ] Test d'achat depuis portail captif → utilisateur créé dans `/ip/hotspot/user`
- [ ] Test d'activation → session active sur MikroTik
- [ ] Test d'expiration → utilisateur supprimé de MikroTik automatiquement
- [ ] Logs backend vérifiés pour erreurs (`docker compose logs api` ou console)
