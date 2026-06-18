const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key-banque',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// --- Connexion à SQLite ---
const db = new sqlite3.Database('./banque.db', (err) => {
  if (err) {
    console.error("Erreur de connexion SQLite :", err.message);
  } else {
    console.log("Connecté à la base SQLite.");
  }
});

// Création des tables si elles n’existent pas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comptes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT,
      solde REAL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compte_id INTEGER,
      type TEXT,
      montant REAL,
      date TEXT,
      FOREIGN KEY(compte_id) REFERENCES comptes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT,
      email TEXT UNIQUE NOT NULL,
      mot_de_passe TEXT NOT NULL,
      date_creation TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// --- Inscription ---
app.post('/api/register', (req, res) => {
  const { nom, prenom, email, password, mot_de_passe } = req.body;
  const finalEmail = (email || '').trim();
  const finalNom = (nom || '').trim();
  const finalPrenom = (prenom || '').trim();
  const finalPassword = password || mot_de_passe;

  if (!finalEmail || !finalNom || !finalPassword) {
    return res.status(400).json({
      success: false,
      message: 'Nom, email et mot de passe sont requis'
    });
  }

  const hashedPassword = crypto.createHash('sha256').update(finalPassword).digest('hex');

  db.get('SELECT id FROM utilisateurs WHERE email = ?', [finalEmail], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (row) return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });

    db.run(
      'INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe) VALUES (?, ?, ?, ?)',
      [finalNom, finalPrenom || null, finalEmail, hashedPassword],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.status(201).json({
          success: true,
          message: 'Inscription réussie',
          userId: this.lastID
        });
      }
    );
  });
});

app.post('/register', (req, res) => {
  res.redirect(307, '/api/register');
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const finalEmail = (email || '').trim();

  if (!finalEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email et mot de passe requis'
    });
  }

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

  db.get(
    'SELECT id, nom, prenom, email, mot_de_passe FROM utilisateurs WHERE email = ?',
    [finalEmail],
    (err, user) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      if (!user) return res.status(401).json({ success: false, message: 'Email invalide' });

      const passwordMatches =
        user.mot_de_passe === password ||
        user.mot_de_passe === hashedPassword;

      if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
      }

      if (user.mot_de_passe === password) {
        db.run(
          'UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?',
          [hashedPassword, user.id],
          (updateErr) => {
            if (updateErr) {
              console.error('Erreur lors de la mise à jour du mot de passe:', updateErr.message);
            }
          }
        );
      }

      req.session.user = {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email
      };

      res.json({
        success: true,
        message: 'Connexion réussie',
        user: req.session.user
      });
    }
  );
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Déconnexion réussie' });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Non autorisé' });
  }

  res.json({ success: true, user: req.session.user });
});

// --- CRUD de base ---

// Récupérer tous les comptes
app.get('/api/comptes', (req, res) => {
  db.all("SELECT * FROM comptes", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Récupérer un compte par ID
app.get('/api/comptes/:id', (req, res) => {
  db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id], (err, row) => {
    if (!row) return res.status(404).json({ message: "Compte introuvable" });
    res.json(row);
  });
});

// Créer un compte
app.post('/api/comptes', (req, res) => {
  const { nom, solde } = req.body;
  db.run("INSERT INTO comptes (nom, solde) VALUES (?, ?)", [nom, solde || 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT * FROM comptes WHERE id = ?", [this.lastID], (err, row) => {
      res.status(201).json(row);
    });
  });
});

// Mettre à jour un compte
app.put('/api/comptes/:id', (req, res) => {
  const { nom, solde } = req.body;
  db.run("UPDATE comptes SET nom = ?, solde = ? WHERE id = ?", [nom, solde, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id], (err, row) => {
      res.json(row);
    });
  });
});

// Supprimer un compte
app.delete('/api/comptes/:id', (req, res) => {
  db.run("DELETE FROM comptes WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Compte supprimé" });
  });
});

// --- Transactions ---

// Récupérer les transactions d’un compte
app.get('/api/comptes/:id/transactions', (req, res) => {
  db.all("SELECT * FROM transactions WHERE compte_id = ?", [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Dépôt
app.post('/api/comptes/:id/depot', (req, res) => {
  const montant = Number(req.body.montant);
  if (montant <= 0) return res.status(400).json({ message: "Montant invalide" });

  db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id], (err, compte) => {
    if (!compte) return res.status(404).json({ message: "Compte introuvable" });

    const nouveauSolde = compte.solde + montant;
    db.run("UPDATE comptes SET solde = ? WHERE id = ?", [nouveauSolde, req.params.id]);
    db.run("INSERT INTO transactions (compte_id, type, montant, date) VALUES (?, ?, ?, ?)",
      [req.params.id, "depot", montant, new Date().toISOString()]);

    res.json({ ...compte, solde: nouveauSolde });
  });
});

// Retrait
app.post('/api/comptes/:id/retrait', (req, res) => {
  const montant = Number(req.body.montant);
  if (montant <= 0) return res.status(400).json({ message: "Montant invalide" });

  db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id], (err, compte) => {
    if (!compte) return res.status(404).json({ message: "Compte introuvable" });
    if (montant > compte.solde) return res.status(400).json({ message: "Solde insuffisant" });

    const nouveauSolde = compte.solde - montant;
    db.run("UPDATE comptes SET solde = ? WHERE id = ?", [nouveauSolde, req.params.id]);
    db.run("INSERT INTO transactions (compte_id, type, montant, date) VALUES (?, ?, ?, ?)",
      [req.params.id, "retrait", montant, new Date().toISOString()]);

    res.json({ ...compte, solde: nouveauSolde });
  });
});

// --- Lancement du serveur ---
app.listen(PORT, () => {
  console.log(`Serveur API lancé sur http://localhost:${PORT}`);
});
