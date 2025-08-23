// Script simple de préparation avant build
const fs = require('fs');
const path = require('path');

console.log('🔧 Préparation du build...');

// 1. Créer le dossier steamcmd s'il n'existe pas
const steamcmdDir = path.join(__dirname, '..', 'steamcmd');
if (!fs.existsSync(steamcmdDir)) {
  fs.mkdirSync(steamcmdDir, { recursive: true });
  console.log('📁 Dossier steamcmd créé');
}

// 2. Vérifier si SteamCMD est présent
const platform = process.platform;
const steamcmdBinary = platform === 'win32' ? 'steamcmd.exe' : 'steamcmd.sh';
const steamcmdPath = path.join(steamcmdDir, steamcmdBinary);

if (fs.existsSync(steamcmdPath)) {
  console.log('✅ SteamCMD trouvé:', steamcmdPath);

  // Rendre exécutable sur Linux/Mac
  if (platform !== 'win32') {
    try {
      fs.chmodSync(steamcmdPath, '755');
      console.log('🔐 Permissions exécutables définies');
    } catch (error) {
      console.log('⚠️ Impossible de définir les permissions:', error.message);
    }
  }
} else {
  console.log('⚠️ SteamCMD non trouvé dans:', steamcmdPath);
  console.log('');
  console.log('📥 Pour inclure SteamCMD dans votre build:');
  console.log('   1. Téléchargez SteamCMD depuis https://steamcmd.net/');

  if (platform === 'win32') {
    console.log('   2. Extrayez steamcmd.exe dans le dossier steamcmd/');
  } else {
    console.log('   2. Extrayez steamcmd.sh dans le dossier steamcmd/');
  }

  console.log('   3. Relancez npm run build');
  console.log('');
  console.log('💡 Ou l\'application tentera une détection automatique au runtime');
}

// 3. Créer un config.json par défaut pour la distribution
const configPath = path.join(__dirname, '..', 'config.json');
const defaultConfig = {
  "steamApiKey": null,
  "modsPath": null,
  "steamcmdPath": null
};

// Créer ou réinitialiser le config pour la distribution
console.log('🧹 Préparation du config pour la distribution');
fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
console.log('✨ Config par défaut créé');

console.log('✅ Préparation terminée\n');