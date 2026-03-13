# Discord S3 Pro - Roadmap d'Évolution

Ce document sert de contexte opérationnel pour l'IA. Il retrace l'état actuel du système et les modules d'amélioration à implémenter.

## État Actuel du Système
- [cite_start]**Core**: Node.js avec `discord.js` et `express`.
- **Pipeline**: Chiffrement AES-256-GCM, compression GZIP et découpage en chunks.
- **Stockage**: Distribution sur plusieurs salons Discord (Channel Pool).
- **Registre actuel**: Fichier local `registry.json` (À migrer).

---

## Étapes d'Amélioration

### Étape 1 : Fondations, Sécurité & Migration DB 
- [ ] **Migration Database** : Remplacer `registry.json` par SQLite ou MongoDB pour une gestion robuste des métadonnées.
- [ ] **Sécurisation des Secrets** : Déplacer le `DISCORD_TOKEN` et l'`ENCRYPTION_KEY` vers des variables d'environnement système.
- [ ] **Clés Dérivées (KDF)** : Implémenter une clé de chiffrement unique par fichier au lieu d'une clé globale.

### Étape 2 : Performance du Pipeline
- [ ] **Parallélisation** : Envoyer plusieurs chunks simultanément dans le `storageEngine`.
- [ ] **Streaming Upload** : Support du `multipart/form-data` dans `routes.js` pour éviter de dépendre d'un chemin local `filePath`.
- [ ] **Optimisation Queue** : Passage à un algorithme "Token Bucket" pour le `queueManager`.

### Étape 3 : Résilience & Intégrité
- [ ] **Hashing Intégral** : Calculer et stocker le SHA-256 du fichier original pour vérification post-téléchargement.
- [ ] **Backup des Métadonnées** : Réplication automatique de la base de données sur un salon Discord dédié.
- [ ] **Auto-Retry** : Gestion des tentatives automatiques en cas d'échec d'upload d'un chunk.

### Étape 4 : Interface & Monitoring
- [ ] **WebSockets** : Suivi de la progression en temps réel pour le client.
- [ ] **Audit de Nettoyage** : Synchronisation stricte entre la DB et les messages Discord lors des suppressions.

---

## Instructions pour l'IA
Lorsqu'un module est demandé, se référer aux fichiers `src/core/`, `src/pipeline/` et `src/api/` fournis précédemment. Toujours mettre à jour ce fichier après une modification majeure de l'architecture.