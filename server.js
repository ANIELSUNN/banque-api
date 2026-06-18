const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 📌 Connexion à SQLite
let db;
(async () => {
  db = await open({
    filename: "./banque.db",
    driver: sqlite3.Database,
  });

  // Création des tables si elles n'existent pas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS comptes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      solde REAL DEFAULT 0,
      date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compte_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('depot','retrait')),
      montant REAL NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (compte_id) REFERENCES comptes(id)
    );
  `);
})();

// --- CRUD Comptes ---

// Récupérer tous les comptes
app.get("/api/comptes", async (req, res) => {
  const comptes = await db.all("SELECT * FROM comptes");
  res.json(comptes);
});

// Récupérer un compte par ID
app.get("/api/comptes/:id", async (req, res) => {
  const compte = await db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id]);
  if (!compte) return res.status(404).json({ message: "Compte introuvable" });
  res.json(compte);
});

// Créer un compte
app.post("/api/comptes", async (req, res) => {
  const { nom, solde } = req.body;
  const result = await db.run("INSERT INTO comptes (nom, solde) VALUES (?, ?)", [nom, solde || 0]);
  const compte = await db.get("SELECT * FROM comptes WHERE id = ?", [result.lastID]);
  res.status(201).json(compte);
});

// Supprimer un compte
app.delete("/api/comptes/:id", async (req, res) => {
  await db.run("DELETE FROM comptes WHERE id = ?", [req.params.id]);
  res.json({ message: "Compte supprimé" });
});

// --- Transactions ---

// Récupérer les transactions d’un compte
app.get("/api/comptes/:id/transactions", async (req, res) => {
  const transactions = await db.all("SELECT * FROM transactions WHERE compte_id = ?", [req.params.id]);
  res.json(transactions);
});

// Dépôt
app.post("/api/comptes/:id/depot", async (req, res) => {
  const { montant } = req.body;
  const compte = await db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id]);
  if (!compte) return res.status(404).json({ message: "Compte introuvable" });
  if (montant <= 0) return res.status(400).json({ message: "Montant invalide" });

  const nouveauSolde = compte.solde + montant;
  await db.run("UPDATE comptes SET solde = ? WHERE id = ?", [nouveauSolde, req.params.id]);
  await db.run("INSERT INTO transactions (compte_id, type, montant) VALUES (?, 'depot', ?)", [req.params.id, montant]);

  const updated = await db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id]);
  res.json(updated);
});

// Retrait
app.post("/api/comptes/:id/retrait", async (req, res) => {
  const { montant } = req.body;
  const compte = await db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id]);
  if (!compte) return res.status(404).json({ message: "Compte introuvable" });
  if (montant <= 0 || montant > compte.solde) {
    return res.status(400).json({ message: "Montant invalide ou solde insuffisant" });
  }

  const nouveauSolde = compte.solde - montant;
  await db.run("UPDATE comptes SET solde = ? WHERE id = ?", [nouveauSolde, req.params.id]);
  await db.run("INSERT INTO transactions (compte_id, type, montant) VALUES (?, 'retrait', ?)", [req.params.id, montant]);

  const updated = await db.get("SELECT * FROM comptes WHERE id = ?", [req.params.id]);
  res.json(updated);
});

// --- Lancement du serveur ---
app.listen(PORT, () => {
  console.log(`🚀 Serveur API lancé sur http://localhost:${PORT}`);
});
