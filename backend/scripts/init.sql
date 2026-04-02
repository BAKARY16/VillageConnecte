-- =====================================================
-- VILLAGE CONNECTÉ DIORADOUGOU — SCHÉMA COMPLET
-- MySQL 8.0 · UTF8MB4 · InnoDB
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = 'Africa/Abidjan';

-- ── Supprimer les tables existantes (ordre inverse FK) ──
DROP TABLE IF EXISTS sessions_actives;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS agent_bornes;
DROP TABLE IF EXISTS agents;
DROP TABLE IF EXISTS bornes;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS revoked_tokens;
DROP TABLE IF EXISTS alertes;
DROP TABLE IF EXISTS tarifs;
DROP TABLE IF EXISTS parametres_branding;
DROP TABLE IF EXISTS parametres_reseau;

-- =====================================================
-- TABLE: admins
-- =====================================================
CREATE TABLE admins (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100)  NOT NULL,
  prenom        VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('superadmin','admin','viewer') NOT NULL DEFAULT 'admin',
  actif         TINYINT(1)    NOT NULL DEFAULT 1,
  derniere_connexion DATETIME NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_actif (actif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: revoked_tokens
-- =====================================================
CREATE TABLE revoked_tokens (
  jti           VARCHAR(64)   NOT NULL PRIMARY KEY,
  admin_id      INT UNSIGNED  NULL,
  reason        VARCHAR(50)   NOT NULL DEFAULT 'logout',
  expires_at    DATETIME      NOT NULL,
  revoked_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_revoked_tokens_expires_at (expires_at),
  INDEX idx_revoked_tokens_admin_id (admin_id),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: bornes
-- =====================================================
CREATE TABLE bornes (
  id            VARCHAR(10)   NOT NULL PRIMARY KEY,  -- ex: B01
  zone          VARCHAR(100)  NOT NULL,
  type_borne    ENUM('Répéteur','Nœud central','Borne principale','HUB principal') NOT NULL DEFAULT 'Répéteur',
  puissance_solaire VARCHAR(10) NOT NULL DEFAULT '20W',
  hauteur_mat   VARCHAR(10)   NOT NULL DEFAULT '4m',
  adresse_ip    VARCHAR(45)   NULL,
  adresse_mac   VARCHAR(17)   NULL,
  latitude      DECIMAL(10,7) NULL,
  longitude     DECIMAL(10,7) NULL,
  statut        ENUM('online','offline','warning') NOT NULL DEFAULT 'offline',
  signal_pct    TINYINT UNSIGNED NOT NULL DEFAULT 0,      -- 0-100
  batterie_pct  TINYINT UNSIGNED NOT NULL DEFAULT 0,      -- 0-100
  users_connectes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  uptime_pct    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  derniere_vue  DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_statut (statut),
  INDEX idx_mac (adresse_mac)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: agents
-- =====================================================
CREATE TABLE agents (
  id            VARCHAR(20)   NOT NULL PRIMARY KEY,   -- ex: AGT001
  nom           VARCHAR(200)  NOT NULL,
  telephone     VARCHAR(30)   NOT NULL,
  zone          VARCHAR(150)  NULL,
  statut        ENUM('actif','inactif') NOT NULL DEFAULT 'actif',
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  date_recrutement DATE        NOT NULL DEFAULT (CURRENT_DATE),
  solde_commission DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_statut (statut),
  INDEX idx_tel (telephone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: agent_bornes (affectation agent → bornes)
-- =====================================================
CREATE TABLE agent_bornes (
  agent_id      VARCHAR(20)   NOT NULL,
  borne_id      VARCHAR(10)   NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id, borne_id),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (borne_id) REFERENCES bornes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: tarifs
-- =====================================================
CREATE TABLE tarifs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(50)   NOT NULL,              -- Journalier, Hebdomadaire, Mensuel
  slug          VARCHAR(30)   NOT NULL UNIQUE,       -- journalier, hebdomadaire, mensuel
  prix_fcfa     DECIMAL(10,2) NOT NULL,
  duree_heures  SMALLINT UNSIGNED NOT NULL,          -- 24, 168, 720
  vitesse_mbps  TINYINT UNSIGNED NOT NULL DEFAULT 5,
  actif         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: vouchers
-- =====================================================
CREATE TABLE vouchers (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,  -- UUID
  code          VARCHAR(12)   NOT NULL UNIQUE,       -- ex: ABC12345 (alphanumérique)
  tarif_id      INT UNSIGNED  NOT NULL,
  statut        ENUM('actif','utilise','expire','revoque') NOT NULL DEFAULT 'actif',
  agent_id      VARCHAR(20)   NULL,                  -- agent qui a vendu
  methode_paiement ENUM('orange_money','mtn','wave','moov','cash','admin') NOT NULL DEFAULT 'cash',
  cinetpay_ref  VARCHAR(100)  NULL,                  -- ref paiement Mobile Money
  prix_vente    DECIMAL(10,2) NOT NULL,
  commission_agence DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Activation
  premiere_borne_id VARCHAR(10) NULL,                -- borne où le code a été activé
  mac_utilisateur   VARCHAR(17) NULL,                -- MAC du device qui l'a utilisé
  ip_utilisateur    VARCHAR(45) NULL,
  activated_at      DATETIME   NULL,                 -- heure exacte d'activation
  expires_at        DATETIME   NULL,                 -- calculé: activated_at + duree

  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (tarif_id)   REFERENCES tarifs(id),
  FOREIGN KEY (agent_id)   REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (premiere_borne_id) REFERENCES bornes(id) ON DELETE SET NULL,

  INDEX idx_code (code),
  INDEX idx_statut (statut),
  INDEX idx_agent (agent_id),
  INDEX idx_mac (mac_utilisateur),
  INDEX idx_expires (expires_at),
  INDEX idx_activated (activated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: sessions_actives
-- =====================================================
CREATE TABLE sessions_actives (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,  -- UUID
  voucher_id    VARCHAR(36)   NOT NULL,
  borne_id      VARCHAR(10)   NOT NULL,
  mac_address   VARCHAR(17)   NOT NULL,
  ip_address    VARCHAR(45)   NOT NULL,
  started_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME      NOT NULL,
  last_seen_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_mb_down  DECIMAL(10,3) NOT NULL DEFAULT 0,
  data_mb_up    DECIMAL(10,3) NOT NULL DEFAULT 0,
  statut        ENUM('active','terminee','expiree','forcee') NOT NULL DEFAULT 'active',

  FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  FOREIGN KEY (borne_id)   REFERENCES bornes(id) ON DELETE CASCADE,

  INDEX idx_mac (mac_address),
  INDEX idx_borne (borne_id),
  INDEX idx_statut (statut),
  INDEX idx_expires (expires_at),
  INDEX idx_voucher (voucher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: transactions
-- =====================================================
CREATE TABLE transactions (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  reference     VARCHAR(50)   NOT NULL UNIQUE,       -- ref interne
  voucher_id    VARCHAR(36)   NULL,
  agent_id      VARCHAR(20)   NULL,
  montant       DECIMAL(10,2) NOT NULL,
  methode       ENUM('orange_money','mtn','wave','moov','cash','admin') NOT NULL,
  statut        ENUM('succes','echec','en_attente','rembourse') NOT NULL DEFAULT 'en_attente',
  telephone     VARCHAR(30)   NULL,
  cinetpay_transaction_id VARCHAR(100) NULL,
  cinetpay_data JSON          NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id)   REFERENCES agents(id) ON DELETE SET NULL,

  INDEX idx_ref (reference),
  INDEX idx_statut (statut),
  INDEX idx_agent (agent_id),
  INDEX idx_methode (methode),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: alertes
-- =====================================================
CREATE TABLE alertes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_alerte   ENUM('critical','warning','info') NOT NULL,
  titre         VARCHAR(200)  NOT NULL,
  message       TEXT          NOT NULL,
  borne_id      VARCHAR(10)   NULL,
  resolue       TINYINT(1)    NOT NULL DEFAULT 0,
  resolue_at    DATETIME      NULL,
  resolue_par   INT UNSIGNED  NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (borne_id)    REFERENCES bornes(id) ON DELETE SET NULL,
  FOREIGN KEY (resolue_par) REFERENCES admins(id) ON DELETE SET NULL,

  INDEX idx_resolue (resolue),
  INDEX idx_borne (borne_id),
  INDEX idx_type (type_alerte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: parametres_reseau
-- =====================================================
CREATE TABLE parametres_reseau (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100)  NOT NULL UNIQUE,
  valeur        TEXT          NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: parametres_branding
-- =====================================================
CREATE TABLE parametres_branding (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100)  NOT NULL UNIQUE,
  valeur        TEXT          NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue: Statistiques agent avec revenus du mois
CREATE OR REPLACE VIEW v_agent_stats AS
SELECT
  a.id,
  a.nom,
  a.telephone,
  a.zone,
  a.statut,
  a.commission_pct,
  COUNT(DISTINCT v.id) AS total_vouchers,
  COALESCE(SUM(v.prix_vente), 0) AS revenus_total,
  COALESCE(SUM(CASE WHEN MONTH(v.created_at) = MONTH(CURRENT_DATE) AND YEAR(v.created_at) = YEAR(CURRENT_DATE) THEN v.prix_vente ELSE 0 END), 0) AS revenus_mois,
  COALESCE(SUM(CASE WHEN MONTH(v.created_at) = MONTH(CURRENT_DATE) AND YEAR(v.created_at) = YEAR(CURRENT_DATE) THEN 1 ELSE 0 END), 0) AS vouchers_mois,
  COALESCE(SUM(CASE WHEN MONTH(v.created_at) = MONTH(CURRENT_DATE) AND YEAR(v.created_at) = YEAR(CURRENT_DATE) THEN v.commission_agence ELSE 0 END), 0) AS commission_mois
FROM agents a
LEFT JOIN vouchers v ON v.agent_id = a.id AND v.statut != 'revoque'
GROUP BY a.id;

-- Vue: Vouchers avec infos tarif et agent
CREATE OR REPLACE VIEW v_vouchers_detail AS
SELECT
  v.id,
  v.code,
  v.statut,
  v.methode_paiement,
  v.prix_vente,
  v.commission_agence,
  v.mac_utilisateur,
  v.ip_utilisateur,
  v.activated_at,
  v.expires_at,
  v.created_at,
  t.nom        AS tarif_nom,
  t.slug       AS tarif_slug,
  t.duree_heures,
  t.prix_fcfa  AS tarif_prix,
  a.nom        AS agent_nom,
  a.id         AS agent_id,
  b.zone       AS borne_zone
FROM vouchers v
JOIN  tarifs t ON t.id = v.tarif_id
LEFT JOIN agents a ON a.id = v.agent_id
LEFT JOIN bornes b ON b.id = v.premiere_borne_id;

-- Vue: Sessions actives avec détails
CREATE OR REPLACE VIEW v_sessions_actives AS
SELECT
  s.id,
  s.mac_address,
  s.ip_address,
  s.started_at,
  s.expires_at,
  s.last_seen_at,
  s.data_mb_down,
  s.data_mb_up,
  s.statut,
  TIMESTAMPDIFF(SECOND, NOW(), s.expires_at) AS secondes_restantes,
  v.code           AS voucher_code,
  t.nom            AS tarif_nom,
  t.slug           AS tarif_slug,
  b.id             AS borne_id,
  b.zone           AS borne_zone
FROM sessions_actives s
JOIN vouchers v ON v.id = s.voucher_id
JOIN tarifs   t ON t.id = v.tarif_id
JOIN bornes   b ON b.id = s.borne_id
WHERE s.statut = 'active' AND s.expires_at > NOW();

-- Vue: KPIs dashboard
CREATE OR REPLACE VIEW v_kpis AS
SELECT
  (SELECT COUNT(*) FROM sessions_actives WHERE statut='active' AND expires_at > NOW()) AS sessions_actives,
  (SELECT COALESCE(SUM(montant),0) FROM transactions WHERE statut='succes' AND DATE(created_at)=CURDATE()) AS revenus_jour,
  (SELECT COALESCE(SUM(montant),0) FROM transactions WHERE statut='succes' AND YEARWEEK(created_at)=YEARWEEK(CURDATE())) AS revenus_semaine,
  (SELECT COALESCE(SUM(montant),0) FROM transactions WHERE statut='succes' AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())) AS revenus_mois,
  (SELECT COUNT(*) FROM vouchers WHERE DATE(created_at)=CURDATE()) AS vouchers_jour,
  (SELECT COUNT(*) FROM agents WHERE statut='actif') AS agents_actifs,
  (SELECT COUNT(*) FROM bornes WHERE statut='online') AS bornes_online,
  (SELECT COUNT(*) FROM bornes WHERE statut='offline') AS bornes_offline,
  (SELECT COUNT(*) FROM alertes WHERE resolue=0) AS alertes_actives;

SET FOREIGN_KEY_CHECKS = 1;
