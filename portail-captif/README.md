# Village Connecte - Portail Captif

Interface React du portail captif, branchee sur l'API backend.

## Demarrage

1. Installer:
   - `cd portail-captif`
   - `npm install`
2. Lancer:
   - `npm start`

Le dossier `portail-captif` garde son propre `.env`, mais l'API est resolue automatiquement: `http://localhost:3001/api` en local et `/api` en production.

`npm start` et `npm run build` utilisent la meme logique d'API.

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
