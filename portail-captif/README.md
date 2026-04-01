# Village Connecte - Portail Captif

Interface React du portail captif, branchee sur l'API backend.

## Demarrage

1. Copier `portail-captif/.env.example` vers `portail-captif/.env`
2. Installer:
   - `cd portail-captif`
   - `npm install`
3. Lancer:
   - `npm start`

Le portail consomme `REACT_APP_API_URL` (par defaut `http://localhost:3001/api`).

## API utilisee

- `GET /public/tarifs`
- `POST /captive/vouchers/validate`
- `POST /captive/sessions/activate`
- `POST /captive/sessions/:id/disconnect`
- `POST /captive/payments/initiate`
- `POST /captive/payments/status`

## Comportement voucher important

- Le decompte commence a l'activation.
- Le decompte continue meme si l'utilisateur se deconnecte.
- Tant que le voucher n'est pas expire, il peut se reconnecter.
