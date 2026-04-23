# Village Connecte - Admin Frontend

Interface React admin connectee a l'API backend avec des donnees reelles.

## Demarrage

1. Installer:
   - `cd admin`
   - `npm install`
2. Lancer:
   - `npm start`

Le dossier `admin` garde son propre `.env`, mais l'API est resolue automatiquement: `http://localhost:3001/api` en local et `/api` en production.

`npm start` et `npm run build` utilisent la meme logique d'API.

## Authentification

Utiliser un compte administrateur existant en base (creee en exploitation reelle ou via un seed manuel de test).

## Flux API consommes

- `POST /admin/auth/login`
- `GET /admin/bootstrap`
- CRUD bornes, agents
- generation / reactivation / suppression vouchers
- resolution alertes
- deconnexion sessions
