# 🎚️ Guide des Niveaux de Log

## 🚀 Activation Rapide des Logs DEBUG

### Méthode 1 : Fichier .env (Permanent)
```env
LOG_LEVEL=0
```

### Méthode 2 : Ligne de Commande (Temporaire)

**PowerShell:**
```powershell
$env:LOG_LEVEL="0"; npm run dev
```

**CMD:**
```cmd
set LOG_LEVEL=0 && npm run dev
```

**Linux/Mac:**
```bash
LOG_LEVEL=0 npm run dev
```

## 📊 Niveaux de Log Disponibles

| Niveau | Valeur | Utilisation | Logs Affichés |
|--------|--------|-------------|---------------|
| **DEBUG** | 0 | Développement, debugging | Tout (DEBUG, INFO, SUCCESS, WARN, ERROR, FATAL) |
| **INFO** | 1 | Production normale | INFO, SUCCESS, WARN, ERROR, FATAL |
| **SUCCESS** | 2 | Production optimisée | SUCCESS, WARN, ERROR, FATAL |
| **WARN** | 3 | Surveillance des problèmes | WARN, ERROR, FATAL |
| **ERROR** | 4 | Erreurs uniquement | ERROR, FATAL |
| **FATAL** | 5 | Erreurs critiques uniquement | FATAL |

## 🎯 Recommandations par Environnement

### Développement Local
```env
LOG_LEVEL=0  # DEBUG - Voir tous les détails
LOG_JSON=false
```

**Avantages:**
- Voir toutes les opérations
- Débugger facilement
- Comprendre le flux d'exécution

### Staging/Test
```env
LOG_LEVEL=1  # INFO - Équilibre entre détails et bruit
LOG_JSON=true
```

**Avantages:**
- Logs structurés pour analyse
- Moins de bruit que DEBUG
- Toujours assez de détails

### Production
```env
LOG_LEVEL=1  # INFO - Opérations normales
LOG_JSON=true
```

**Avantages:**
- Performance optimale
- Logs parsables automatiquement
- Intégration avec outils de monitoring

### Production Optimisée
```env
LOG_LEVEL=2  # SUCCESS - Minimal
LOG_JSON=true
```

**Avantages:**
- Très peu de logs
- Performance maximale
- Uniquement les succès et problèmes

## 📝 Exemples de Logs par Niveau

### DEBUG (0)
```
[DEBUG] Loading environment variables
[DEBUG] Discord channels loaded { count: 3 }
[DEBUG] ChunkSplitter initialized { chunkSize: 8388608 }
[DEBUG] Chunk uploaded { chunkIndex: 1, channelId: "123..." }
[DEBUG] Hash calculated { hash: "a7f2b...", duration: 150 }
```

### INFO (1)
```
[INFO] Initializing database { provider: "mongodb" }
[INFO] Starting file upload { fileName: "test.txt", size: 1024 }
[INFO] Starting file download { fileId: "abc123" }
[INFO] GET /status - 200 (5ms)
```

### SUCCESS (2)
```
[SUCCESS] Configuration loaded successfully
[SUCCESS] Database initialized { provider: "mongodb", connectionTime: 1250 }
[SUCCESS] Discord Bot connected { username: "Bot#1234" }
[SUCCESS] File upload completed { fileId: "abc123", duration: 2500 }
```

### WARN (3)
```
[WARN] Queue size growing { queueSize: 15 }
[WARN] Rate limit hit { resetAfter: 1000 }
[WARN] File not found for deletion { fileId: "invalid" }
[WARN] Channel not found for chunk deletion
```

### ERROR (4)
```
[ERROR] Upload pipeline failed { fileName: "test.txt", duration: 2500 }
[ERROR] Chunk upload failed { chunkIndex: 5, fileName: "test.txt" }
[ERROR] MongoDB connection failed
[ERROR] Integrity verification failed - CORRUPTION DETECTED
```

### FATAL (5)
```
[FATAL] Configuration file missing { path: "/app/config.cfg" }
[FATAL] Database initialization failed { provider: "mongodb" }
[FATAL] System startup failed { duration: 1500 }
[FATAL] Uncaught exception
```

## 🔍 Filtrage des Logs

### Voir Uniquement un Niveau
```bash
# DEBUG uniquement
grep "\[DEBUG\]" logs/app.log

# INFO uniquement
grep "\[INFO\]" logs/app.log

# SUCCESS uniquement
grep "\[SUCCESS\]" logs/app.log

# WARN uniquement
grep "\[WARN\]" logs/app.log

# ERROR uniquement
grep "\[ERROR\]" logs/app.log

# FATAL uniquement
grep "\[FATAL\]" logs/app.log
```

### Voir Plusieurs Niveaux
```bash
# Erreurs et warnings
grep -E "\[ERROR\]|\[WARN\]" logs/app.log

# Problèmes critiques
grep -E "\[ERROR\]|\[FATAL\]" logs/app.log

# Succès et infos
grep -E "\[SUCCESS\]|\[INFO\]" logs/app.log
```

## 📊 Analyse des Logs DEBUG

### Voir les Opérations de Configuration
```bash
grep "\[DEBUG\].*configuration" logs/app.log
```

### Voir les Opérations de Chunks
```bash
grep "\[DEBUG\].*[Cc]hunk" logs/app.log
```

### Voir les Opérations de Hash
```bash
grep "\[DEBUG\].*[Hh]ash" logs/app.log
```

### Voir les Opérations de Database
```bash
grep "\[DEBUG\].*MongoDB\|JSON" logs/app.log
```

## 🎛️ Changer le Niveau en Cours d'Exécution

Le niveau de log est lu au démarrage. Pour changer :

1. Modifier `.env`
2. Redémarrer l'application

Ou utiliser la méthode programmatique (à ajouter si besoin) :
```typescript
import logger, { LogLevel } from './utils/logger.js';
logger.setLevel(LogLevel.DEBUG);
```

## 💡 Astuces

### Développement Actif
```env
LOG_LEVEL=0  # Tout voir
```

### Debugging d'un Problème Spécifique
```env
LOG_LEVEL=0  # Activer DEBUG
```
Puis filtrer :
```bash
tail -f logs/app.log | grep "upload"
```

### Performance Testing
```env
LOG_LEVEL=2  # Minimal
```
Pour ne pas impacter les performances avec trop de logs.

### Monitoring Production
```env
LOG_LEVEL=1  # INFO
LOG_JSON=true
```
Puis utiliser un outil comme Grafana Loki ou ELK Stack.

## 🚨 Attention

- **DEBUG en production** = Beaucoup de logs = Fichiers volumineux
- **Rotation automatique** à 10MB pour éviter les problèmes
- **Archives** conservées avec timestamp
- **Performance** légèrement impactée avec LOG_LEVEL=0

## ✅ Validation

Après avoir changé le niveau :

```bash
# Vérifier que DEBUG est actif
npm run dev

# Vous devriez voir :
[DEBUG] Loading environment variables
[DEBUG] Loading configuration file
[DEBUG] Discord channels loaded
# etc.
```

Si vous ne voyez pas les logs DEBUG :
1. Vérifier que `.env` contient `LOG_LEVEL=0`
2. Redémarrer l'application
3. Vérifier qu'il n'y a pas d'espace avant/après le `=`
