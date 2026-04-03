# Village Connecte - Admin Frontend

Interface React admin connectee a l'API backend (plus de donnees mockees pour l'etat principal).

## Demarrage

1. Installer:
   - `cd admin`
   - `npm install`
2. Lancer:
   - `npm start`

Le dossier `admin` garde son propre `.env`, mais l'API est resolue automatiquement: `http://localhost:3001/api` en local et `/api` en production.

`npm start` et `npm run build` utilisent la meme logique d'API.

## Auth de demo (seed backend)

- Identifiant: `admin`
- Mot de passe: `admin123`

## Flux API consommes

- `POST /admin/auth/login`
- `GET /admin/bootstrap`
- CRUD bornes, agents
- generation / reactivation / suppression vouchers
- resolution alertes
- deconnexion sessions
