# Steam Workshop Browser

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<img width="1904" height="1001" alt="Steam Workshop Browser1" src="https://github.com/user-attachments/assets/03abe862-a186-4266-a93f-4db544bd78b0" />


**Steam Workshop Browser** est une application Windows innovante qui révolutionne la façon dont vous gérez les mods Steam. Conçue pour les joueurs et les moddeurs, cette application vous permet de parcourir, télécharger et gérer les mods du Workshop Steam **sans avoir besoin d'installer les jeux correspondants**.

### 🎮 Pourquoi choisir Steam Workshop Browser ?

- **Accès complet** au catalogue du Workshop Steam sans lancer les jeux
- **Interface utilisateur moderne et intuitive** pour une navigation fluide
- **Téléchargement par lots** de vos mods favoris en quelques clics
- **Gestion simplifiée** de votre bibliothèque de mods
- **Mises à jour automatiques** pour rester à jour avec les dernières versions
- **Léger et rapide**, sans les surcharges du client Steam

Parfait pour les collectionneurs de mods, les testeurs, ou ceux qui veulent simplement explorer le contenu du Workshop sans encombrer leur disque dur avec des jeux inutiles.

## 📥 Téléchargement

Une version pré-compilée pour Windows est disponible dans la section [Releases](https://github.com/votre-utilisateur/steam-workshop-browser/releases) :

- Windows : `Steam Workshop Browser Setup 1.0.0.exe`

Cette version ne nécessite pas d'installation de Node.js ou de dépendances supplémentaires.

## Fonctionnalités

- 🔍 Recherche de mods par jeu et mots-clés
- ⬇️ Téléchargement et installation simplifiés des mods
- 🛠️ Gestion des clés API Steam
- 🔄 Mise à jour automatique des mods installés
- 🖥️ Interface utilisateur intuitive et moderne
- 🚀 Compatible avec Windows

## Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- [Node.js](https://nodejs.org/) (v16 ou supérieur)
- [npm](https://www.npmjs.com/) (généralement inclus avec Node.js)
- [Git](https://git-scm.com/)

## Installation

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/votre-utilisateur/steam-workshop-browser.git
   cd steam-workshop-browser
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

## Configuration

1. Lancez l'application en mode développement :
   ```bash
   npm start
   ```

2. À la première ouverture, vous devrez configurer :
   - Votre clé API Steam (obtenue sur [Steam API Key](https://steamcommunity.com/dev/apikey))
   - Le chemin d'installation de SteamCMD (téléchargé automatiquement si nécessaire)
   - Le dossier de destination pour les mods

## Utilisation

1. **Recherche de mods** :
   - Sélectionnez un jeu dans la liste déroulante
   - Utilisez la barre de recherche pour trouver des mods spécifiques
   - Parcourez les résultats avec la pagination

2. **Téléchargement de mods** :
   - Cliquez sur "Télécharger" à côté d'un mod
   - Suivez la progression dans la barre de téléchargement
   - Les mods sont automatiquement installés dans le dossier spécifié

3. **Gestion des mods** :
   - Affichez les détails d'un mod
   - Mettez à jour les mods obsolètes
   - Supprimez les mods inutiles

## Construction du projet

Pour créer une version exécutable :

```bash
# Pour Windows
npm run build-win
```

Les exécutables seront disponibles dans le dossier `dist/`.

## Sécurité

- Votre clé API Steam est stockée localement dans le dossier de configuration de l'application
- L'application n'envoie aucune donnée à des serveurs tiers
- Toutes les communications avec les serveurs Steam sont sécurisées en HTTPS

### Structure du projet

- `main.js` - Processus principal Electron
- `renderer.js` - Logique du rendu de l'interface
- `preload.js` - Pont entre le processus principal et le rendu
- `index.html` - Interface utilisateur principale
- `key.html` - Interface de configuration de la clé API
- `steamcmd-setup.html` - Assistant de configuration de SteamCMD

### Commandes utiles

```bash
# Lancer en mode développement
npm run dev

# Nettoyer le dossier de build
npm run clean

# Reconstruire complètement
npm run rebuild
```

## Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## Remerciements

- [Electron](https://www.electronjs.org/) - Pour le framework d'applications de bureau
- [Steam Web API](https://steamcommunity.com/dev) - Pour l'accès aux données du Workshop
- [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD) - Pour le téléchargement des mods

