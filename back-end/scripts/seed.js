/**
 * SEED — Village Connecté Dioradougou
 * Insère toutes les données initiales dans MySQL
 * Run: node scripts/seed.js
 */

require('dotenv').config({ path: '.env.example' });
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── Config DB ──────────────────────────────────────────
const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  database: process.env.DB_NAME     || 'village_connecte',
  user:     process.env.DB_USER     || 'vc_user',
  password: process.env.DB_PASSWORD || 'vc_secure_pass_2026',
  multipleStatements: true,
};

// ── Helpers ────────────────────────────────────────────
function genCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(d) {
  return new Date(Date.now() - d * 86400000);
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000);
}

// ── Seed data ──────────────────────────────────────────
async function seed() {
  console.log('🌱 Starting seed...');
  let conn;

  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL');

    // ── 1. Admin ─────────────────────────────────────
    console.log('  → Seeding admins...');
    const pwHash = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD || 'Admin2026!', 12);
    await conn.execute(`
      INSERT IGNORE INTO admins (nom, prenom, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `, ['Administrateur', 'Village Connecté', 'admin@village-connecte.ci', pwHash, 'superadmin']);

    // ── 2. Tarifs ─────────────────────────────────────
    console.log('  → Seeding tarifs...');
    await conn.execute(`
      INSERT IGNORE INTO tarifs (nom, slug, prix_fcfa, duree_heures, vitesse_mbps)
      VALUES
        ('Journalier',   'journalier',   200.00,  24,  5),
        ('Hebdomadaire', 'hebdomadaire', 1000.00, 168, 5),
        ('Mensuel',      'mensuel',      3000.00, 720, 5)
    `);

    // ── 3. Bornes (13 bornes Dioradougou) ────────────
    console.log('  → Seeding bornes...');
    const bornes = [
      ['B01','Est',           'Borne principale', '20W','4m','192.168.1.101','AA:BB:CC:01:02:03', 7.789,-7.871, 'online',  87,78,12,99.2],
      ['B02','Centre-Est',    'Répéteur',         '20W','4m','192.168.1.102','AA:BB:CC:01:02:04', 7.788,-7.875, 'online',  74,65, 8,98.7],
      ['B03','Sud',           'Répéteur',         '20W','4m','192.168.1.103','AA:BB:CC:01:02:05', 7.782,-7.878, 'online',  81,90, 6,99.8],
      ['B04','Centre-Sud',    'Nœud central',     '30W','6m','192.168.1.104','AA:BB:CC:01:02:06', 7.784,-7.880, 'online',  92,88,18,99.9],
      ['B05','Centre',        'Répéteur',         '20W','4m','192.168.1.105','AA:BB:CC:01:02:07', 7.785,-7.882, 'warning', 45,22, 3,95.1],
      ['B06','Centre-Ouest',  'Nœud central',     '30W','6m','192.168.1.106','AA:BB:CC:01:02:08', 7.785,-7.884, 'online',  89,76,15,99.5],
      ['B07','Nord-Ouest',    'Répéteur',         '20W','4m','192.168.1.107','AA:BB:CC:01:02:09', 7.790,-7.886, 'offline',  0, 0, 0,87.3],
      ['B08','Ouest (HUB)',   'HUB principal',    '50W','8m','192.168.1.108','AA:BB:CC:01:02:10', 7.786,-7.888, 'online',  98,95,24,100.0],
      ['B09','Sud-Ouest',     'Répéteur',         '20W','4m','192.168.1.109','AA:BB:CC:01:02:11', 7.783,-7.887, 'online',  71,68, 9,98.2],
      ['B10','Sud-Est',       'Répéteur',         '20W','4m','192.168.1.110','AA:BB:CC:01:02:12', 7.781,-7.879, 'online',  76,72, 7,98.9],
      ['B11','Nord-Centre',   'Répéteur',         '20W','4m','192.168.1.111','AA:BB:CC:01:02:13', 7.789,-7.883, 'online',  83,80,11,99.3],
      ['B12','Nord',          'Répéteur',         '20W','4m','192.168.1.112','AA:BB:CC:01:02:14', 7.792,-7.882, 'online',  69,58, 5,97.8],
      ['B13','Extrême-Nord',  'Répéteur',         '20W','4m','192.168.1.113','AA:BB:CC:01:02:15', 7.795,-7.881, 'warning', 38,18, 2,93.5],
    ];

    for (const b of bornes) {
      await conn.execute(`
        INSERT IGNORE INTO bornes
          (id,zone,type_borne,puissance_solaire,hauteur_mat,adresse_ip,adresse_mac,latitude,longitude,statut,signal_pct,batterie_pct,users_connectes,uptime_pct,derniere_vue)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
      `, b);
    }

    // ── 4. Agents ─────────────────────────────────────
    console.log('  → Seeding agents...');
    const agents = [
      ['AGT001','Koné Mamadou',     '+225 07 12 34 56','Centre / Est',        'actif','2024-01-15'],
      ['AGT002','Traoré Fatoumata', '+225 05 23 45 67','Sud / Centre-Sud',    'actif','2024-02-03'],
      ['AGT003','Coulibaly Ibrahim','+225 01 34 56 78','Ouest / Nord-Ouest',  'actif','2024-01-20'],
      ['AGT004','Diallo Aminata',   '+225 07 45 67 89','Nord / Nord-Centre',  'actif','2024-03-10'],
      ['AGT005','Bamba Seydou',     '+225 05 56 78 90','Centre / Centre-Ouest','inactif','2024-04-05'],
      ['AGT006','Ouattara Mariam',  '+225 01 67 89 01','Sud-Ouest / Sud',     'actif','2024-02-28'],
    ];

    for (const ag of agents) {
      await conn.execute(`
        INSERT IGNORE INTO agents (id,nom,telephone,zone,statut,date_recrutement)
        VALUES (?,?,?,?,?,?)
      `, ag);
    }

    // ── 5. Agent-Bornes ───────────────────────────────
    console.log('  → Seeding agent_bornes...');
    const agentBornes = [
      ['AGT001','B01'],['AGT001','B02'],['AGT001','B03'],
      ['AGT002','B03'],['AGT002','B04'],['AGT002','B10'],
      ['AGT003','B06'],['AGT003','B07'],['AGT003','B08'],
      ['AGT004','B11'],['AGT004','B12'],['AGT004','B13'],
      ['AGT005','B04'],['AGT005','B05'],['AGT005','B06'],
      ['AGT006','B09'],['AGT006','B03'],
    ];
    for (const [aid, bid] of agentBornes) {
      await conn.execute(
        'INSERT IGNORE INTO agent_bornes (agent_id,borne_id) VALUES (?,?)',
        [aid, bid]
      );
    }

    // ── 6. Vouchers (200 codes) ───────────────────────
    console.log('  → Seeding vouchers (200 codes)...');

    // Récupérer les IDs de tarifs
    const [tarifs] = await conn.execute('SELECT id, slug, prix_fcfa FROM tarifs');
    const tarifMap = {};
    tarifs.forEach(t => { tarifMap[t.slug] = { id: t.id, prix: parseFloat(t.prix_fcfa) }; });

    const agentIds   = agents.map(a => a[0]);
    const methodes   = ['orange_money','mtn','wave','moov','cash','cash','cash'];
    const statuts    = ['actif','actif','actif','utilise','utilise','expire'];
    const tarifSlugs = ['journalier','journalier','hebdomadaire','mensuel'];

    const generatedCodes = new Set();

    for (let i = 0; i < 200; i++) {
      let code;
      do { code = genCode(8); } while (generatedCodes.has(code));
      generatedCodes.add(code);

      const slug     = randomFrom(tarifSlugs);
      const tarif    = tarifMap[slug];
      const statut   = randomFrom(statuts);
      const agentId  = randomFrom(agentIds);
      const methode  = randomFrom(methodes);
      const createdAt = daysAgo(Math.floor(Math.random() * 30));
      const commission = tarif.prix * 0.12;
      const voucherId = uuidv4();

      let activatedAt = null;
      let expiresAt   = null;

      if (statut === 'utilise') {
        // Code activé dans le passé
        const dureeH = slug === 'journalier' ? 24 : slug === 'hebdomadaire' ? 168 : 720;
        activatedAt  = hoursAgo(Math.floor(Math.random() * dureeH * 2 + 1));
        expiresAt    = new Date(activatedAt.getTime() + dureeH * 3600000);
      } else if (statut === 'expire') {
        const dureeH = 24;
        activatedAt  = daysAgo(Math.floor(Math.random() * 10 + 3));
        expiresAt    = new Date(activatedAt.getTime() + dureeH * 3600000);
      }

      await conn.execute(`
        INSERT IGNORE INTO vouchers
          (id,code,tarif_id,statut,agent_id,methode_paiement,prix_vente,commission_agence,activated_at,expires_at,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `, [
        voucherId, code, tarif.id, statut, agentId, methode,
        tarif.prix, commission,
        activatedAt, expiresAt, createdAt
      ]);

      // Créer une transaction pour les codes utilisés ou actifs payés
      if (statut !== 'actif' || Math.random() > 0.3) {
        const txId  = uuidv4();
        const txRef = `TRX${Date.now().toString().slice(-8)}${Math.floor(Math.random()*1000)}`;
        const txStatut = statut === 'revoque' ? 'echec' : 'succes';
        const tel   = `+225 0${Math.floor(Math.random()*9)+1} ${String(Math.floor(Math.random()*9999999)).padStart(7,'0')}`;
        await conn.execute(`
          INSERT IGNORE INTO transactions
            (id,reference,voucher_id,agent_id,montant,methode,statut,telephone,created_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `, [txId, txRef, voucherId, agentId, tarif.prix, methode, txStatut, tel, createdAt]);
      }
    }

    // ── 7. Sessions actives (5 sessions) ─────────────
    console.log('  → Seeding sessions actives...');
    // Récupérer quelques vouchers actifs pour créer des sessions
    const [voucherActifs] = await conn.execute(
      "SELECT id FROM vouchers WHERE statut='actif' LIMIT 5"
    );

    const macAddrs = [
      '3C:22:FB:A1:B2:C3','7A:11:CC:D4:E5:F6',
      '9B:33:DD:55:66:77','D4:44:EE:88:99:AA','E5:55:FF:11:BB:CC'
    ];
    const borneIds = ['B08','B04','B01','B06','B08'];

    for (let i = 0; i < Math.min(voucherActifs.length, 5); i++) {
      const sessId   = uuidv4();
      const startedAt = hoursAgo(Math.floor(Math.random() * 3 + 1));
      const expiresAt = new Date(startedAt.getTime() + 24 * 3600000); // 24h
      await conn.execute(`
        INSERT IGNORE INTO sessions_actives
          (id,voucher_id,borne_id,mac_address,ip_address,started_at,expires_at,last_seen_at,statut)
        VALUES (?,?,?,?,?,?,?,NOW(),?)
      `, [
        sessId, voucherActifs[i].id, borneIds[i],
        macAddrs[i], `10.0.0.${40 + i}`,
        startedAt, expiresAt, 'active'
      ]);

      // Marquer le voucher comme en cours d'utilisation
      await conn.execute(`
        UPDATE vouchers SET
          statut='utilise',
          activated_at=?,
          expires_at=?,
          mac_utilisateur=?,
          ip_utilisateur=?,
          premiere_borne_id=?
        WHERE id=?
      `, [startedAt, expiresAt, macAddrs[i], `10.0.0.${40+i}`, borneIds[i], voucherActifs[i].id]);
    }

    // ── 8. Alertes ────────────────────────────────────
    console.log('  → Seeding alertes...');
    await conn.execute(`
      INSERT IGNORE INTO alertes (type_alerte,titre,message,borne_id,resolue,created_at) VALUES
        ('critical','Borne B07 hors ligne','La borne Nord-Ouest (B07) est déconnectée depuis 1h. Vérifier alimentation solaire.','B07',0,DATE_SUB(NOW(), INTERVAL 1 HOUR)),
        ('warning', 'Batterie faible — B13','Niveau batterie : 18%%. Autonomie estimée < 2h.','B13',0,DATE_SUB(NOW(), INTERVAL 10 MINUTE)),
        ('warning', 'Signal faible — B05','Signal borne Centre (B05) dégradé : -67 dBm.','B05',0,DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
        ('warning', 'Batterie faible — B05','Niveau batterie : 22%%.','B05',0,DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
        ('info',    'Pic de connexions B08','HUB principal : 24 utilisateurs simultanés.','B08',1,DATE_SUB(NOW(), INTERVAL 2 HOUR)),
        ('critical','Échec paiement CinetPay','3 transactions Orange Money échouées.',NULL,1,DATE_SUB(NOW(), INTERVAL 3 HOUR))
    `);

    console.log('✅ Seed completed successfully!');
    console.log('');
    console.log('📋 Credentials:');
    console.log('   Admin email   : admin@village-connecte.ci');
    console.log('   Admin password: Admin2026!');
    console.log('');
    console.log('🗄️  Database seeded:');
    console.log('   - 1 admin');
    console.log('   - 3 tarifs');
    console.log('   - 13 bornes');
    console.log('   - 6 agents');
    console.log('   - 200 vouchers');
    console.log('   - ~200 transactions');
    console.log('   - 5 sessions actives');
    console.log('   - 6 alertes');

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

seed();
