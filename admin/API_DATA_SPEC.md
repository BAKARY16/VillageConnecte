# Spécification des Données API — Plateforme Admin Village Connecté

Ce document recense toutes les entités, champs et structures de données nécessaires pour le backend/API de la plateforme admin. Il sert de référence pour la conception de la base de données et des endpoints API.

---

## 1. Bornes WiFi (/bornes)
- id (string)
- zone (string)
- type (string) — ex: "Répéteur", "Borne principale", "Nœud central", "HUB principal"
- solaire (string) — ex: "20W", "30W", "50W"
- mat (string) — ex: "4m", "6m", "8m"
- alimentation (string) — ex: "220V (secteur)", "solaire"
- rechargeable (string) — "oui" ou "non"
- status (string) — "online", "offline", "warning"
- signal (number, %)
- batterie (number, %)
- users (number)
- uptime (number, %)
- ip (string)
- mac (string)
- lastSeen (datetime)
- lat (number)
- lng (number)

## 2. Agents (/agents)
- id (string)
- nom (string)
- email (string)
- telephone (string)
- zone (string)
- bornes (array of string, id des bornes)
- status (string) — "actif", "inactif"
- dateRecrutement (date)
- commission (number, %)
- vouchersCeMois (number)
- revenusCeMois (number, FCFA)
- revenusTotal (number, FCFA)
- historiqueVentes (array: { jour, ventes, revenus })
- avatar (string)
- color (string, hex)

## 3. Vouchers (/vouchers)
- id (string)
- code (string)
- type (string) — "journalier", "hebdomadaire", "mensuel"
- prix (number, FCFA)
- statut (string) — "actif", "utilisé", "expiré"
- agentId (string/null)
- agentNom (string)
- bornePremierUsage (string/null)
- dateCreation (date)
- dateExpiration (date)
- macUtilisateur (string/null)
- paymentMethod (string) — "Cash", "Orange Money", "MTN", "Wave", "Moov"

## 4. Transactions (/transactions)
- id (string)
- voucherId (string)
- montant (number, FCFA)
- methode (string) — "Orange Money", "MTN", "Wave", "Moov", "Cash"
- statut (string) — "succès", "échoué", "en attente"
- telephone (string)
- agentId (string)
- agentNom (string)
- borneId (string)
- date (date)
- cinetpayRef (string)

## 5. Sessions actives (/sessions)
- id (string)
- mac (string)
- ip (string)
- borneId (string)
- borneZone (string)
- voucherCode (string)
- typePass (string) — "journalier", "hebdomadaire", "mensuel"
- heureConnexion (datetime)
- dureeRestante (number, secondes)
- debitDown (number, Mbps)
- debitUp (number, Mbps)
- dataTotal (number, Mo)

## 6. Alertes (/alertes)
- id (string)
- type (string) — "critical", "warning", "info"
- titre (string)
- message (string)
- date (datetime)
- resolue (bool)
- borneId (string/null)

## 7. KPI & Statistiques (/kpi)
- usersConnectes (number)
- revenusJour (number, FCFA)
- revenusHier (number, FCFA)
- vouchersDuJour (number)
- agentsActifs (number)
- bornesActives (number)
- bornesTotal (number)
- bornesOffline (number)
- uptimeGlobal (number, %)
- alertesActives (number)


## 8. Tarifs (/tarifs)
- id (string)
- type (string) — "journalier", "hebdomadaire", "mensuel"
- prix (number, FCFA)
- duree (number, jours)

## 9. Commandes de Vouchers (/voucher-commands)
- id (string)
- agentId (string)
- agentNom (string)
- type (string) — "journalier", "hebdomadaire", "mensuel"
- count (number)
- totalValue (number, FCFA)
- paymentMethod (string)
- dateCreated (datetime)
- status (string) — "complétée", "en attente", "échouée"
- voucherIds (array of string)

## 10. Statistiques Trafic & Revenus (/stats)
- trafic24h (array: { heure (string), download (number, Mo), upload (number, Mo), users (number) })
- revenus30j (array: { date (string), journalier (number), hebdomadaire (number), mensuel (number), total (number), connexions (number) })

## 11. Utilisateurs Admin (/users)
- id (string)
- nom (string)
- prenom (string)
- email (string)
- motDePasse (string, hashé)
- role (string) — "superadmin", "admin", "agent"
- avatar (string)

---


### Notes complémentaires
- Tous les champs sont à adapter selon les besoins réels du front et les contraintes du backend.
- Prévoir la pagination, la recherche et les filtres sur les endpoints principaux (bornes, agents, vouchers, transactions, commandes, utilisateurs).
- Les endpoints doivent permettre la création, modification, suppression et consultation des entités ci-dessus.
- Pour les statistiques, prévoir des endpoints paramétrables (par période, par type, etc.).
- Pour toute question ou précision, se référer au code front ou demander au responsable produit.

---

Document généré automatiquement à partir du code front (mars 2026).
