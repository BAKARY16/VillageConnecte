# Village Connecte - Admin Frontend

Interface React admin connectee a l'API backend (plus de donnees mockees pour l'etat principal).

## Demarrage

1. Copier `admin/.env.example` vers `admin/.env`
2. Installer:
   - `cd admin`
   - `npm install`
3. Lancer:
   - `npm start`

Le front admin attend l'API sur `REACT_APP_API_URL` (par defaut `http://localhost:5000/api`).

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
