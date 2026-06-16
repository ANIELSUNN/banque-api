const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Simulation de base de données
let comptes = [];
let nextId = 1;

// --- CRUD de base ---

// Récupérer tous les comptes
app.get('/api/comptes', (req, res) => {
  res.json(comptes);
});

// Récupérer un compte par ID
app.get('/api/comptes/:id', (req, res) => {
  const compte = comptes.find(c => c.id === parseInt(req.params.id));
  if (!compte) return res.status(404).json({ message: "Compte introuvable" });
  res.json(compte);
});

// Créer un compte
app.post('/api/comptes', (req, res) => {
  const { nom, solde } = req.body;
  const nouveauCompte = {
    id: nextId++,
    nom,
    solde: Number(solde) || 0,
    transactions: []
  };
  comptes.push(nouveauCompte);
  res.status(201).json(nouveauCompte);
});

// Mettre à jour un compte
app.put('/api/comptes/:id', (req, res) => {
  const compte = comptes.find(c => c.id === parseInt(req.params.id));
  if (!compte) return res.status(404).json({ message: "Compte introuvable" });
  compte.nom = req.body.nom ?? compte.nom;
  compte.solde = req.body.solde ?? compte.solde;
  res.json(compte);
});

// Supprimer un compte
app.delete('/api/comptes/:id', (req, res) => {
  comptes = comptes.filter(c => c.id !== parseInt(req.params.id));
  res.json({ message: "Compte supprimé" });
});

// --- Transactions ---

// Récupérer les transactions d’un compte
app.get('/api/comptes/:id/transactions', (req, res) => {
  const compte = comptes.find(c => c.id === parseInt(req.params.id));
  if (!compte) return res.status(404).json({ message: "Compte introuvable" });
  res.json(compte.transactions);
});

// Dépôt
app.post('/api/comptes/:id/depot', (req, res) => {
  const compte = comptes.find(c => c.id === parseInt(req.params.id));
  if (!compte) return res.status(404).json({ message: "Compte introuvable" });
  const montant = Number(req.body.montant);
  if (montant <= 0) return res.status(400).json({ message: "Montant invalide" });
  compte.solde += montant;
  compte.transactions.push({ type: "depot", montant, date: new Date() });
  res.json(compte);
});

// Retrait
app.post('/api/comptes/:id/retrait', (req, res) => {
  const compte = comptes.find(c => c.id === parseInt(req.params.id));
  if (!compte) return res.status(404).json({ message: "Compte introuvable" });
  const montant = Number(req.body.montant);
  if (montant <= 0 || montant > compte.solde) {
    return res.status(400).json({ message: "Montant invalide ou solde insuffisant" });
  }
  compte.solde -= montant;
  compte.transactions.push({ type: "retrait", montant, date: new Date() });
  res.json(compte);
});

// --- Lancement du serveur ---
app.listen(PORT, () => {
  console.log(`Serveur API lancé sur http://localhost:${PORT}`);
});
