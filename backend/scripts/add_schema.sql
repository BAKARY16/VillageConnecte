-- Ajout tables et vues manquantes pour le schéma SQL

-- Table parametres_reseau
CREATE TABLE IF NOT EXISTS parametres_reseau (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    valeur TEXT NOT NULL
);

-- Table parametres_branding
CREATE TABLE IF NOT EXISTS parametres_branding (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    valeur TEXT NOT NULL
);

-- Vue v_revenus_30j
CREATE OR REPLACE VIEW v_revenus_30j AS
SELECT date_trunc('day', t.date) AS jour, SUM(t.montant) AS revenus
FROM transactions t
WHERE t.date >= NOW() - INTERVAL '30 days'
GROUP BY jour
ORDER BY jour;

-- Vue v_connexions_24h
CREATE OR REPLACE VIEW v_connexions_24h AS
SELECT date_trunc('hour', s.date_connexion) AS heure, COUNT(*) AS connexions
FROM sessions s
WHERE s.date_connexion >= NOW() - INTERVAL '24 hours'
GROUP BY heure
ORDER BY heure;
