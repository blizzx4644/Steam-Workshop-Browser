const { contextBridge, ipcRenderer } = require('electron');

// Exposer les APIs nécessaires au contexte du renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Gestion de la clé API
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),
  
  // Gestion des mods
  downloadMod: (data) => ipcRenderer.invoke('download-mod', data),
  
  // Recherche de mods sur le serveur
  searchWorkshopMods: (data) => ipcRenderer.invoke('search-workshop-mods', data),
  
  // Gestion du dossier de mods
  chooseModFolder: () => ipcRenderer.invoke('choose-mod-folder'),
  
  // Récupération de la configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  // Ouvrir des liens externes
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // APIs SteamCMD - NOUVELLES
  downloadSteamCMD: () => ipcRenderer.invoke('download-steamcmd'),
  testSteamCMD: () => ipcRenderer.invoke('test-steamcmd'),
  browseSteamCMD: () => ipcRenderer.invoke('browse-steamcmd'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  continueWithoutSteamCMD: () => ipcRenderer.invoke('continue-without-steamcmd'),

  // Écouter les mises à jour de configuration
  onConfigUpdated: (callback) => ipcRenderer.on('config-updated', callback),
  removeConfigListener: (callback) => ipcRenderer.removeListener('config-updated', callback),

  // APIs pour les notifications
  requestNotificationPermission: async () => {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  }
});

// Pour la compatibilité avec le code existant (à supprimer progressivement)
window.ipcRenderer = {
  invoke: (channel, ...args) => {
    // Mapper les anciens appels vers les nouvelles APIs
    switch (channel) {
      case 'get-config':
        return window.electronAPI.getConfig();
      case 'save-api-key':
        return window.electronAPI.saveApiKey(...args);
      case 'download-mod':
        return window.electronAPI.downloadMod(...args);
      case 'search-workshop-mods':
        return window.electronAPI.searchWorkshopMods(...args);
      case 'choose-mod-folder':
        return window.electronAPI.chooseModFolder();
      case 'open-external':
        return window.electronAPI.openExternal(...args);
      // Nouveaux handlers SteamCMD
      case 'download-steamcmd':
        return window.electronAPI.downloadSteamCMD();
      case 'test-steamcmd':
        return window.electronAPI.testSteamCMD();
      case 'browse-steamcmd':
        return window.electronAPI.browseSteamCMD();
      case 'get-platform':
        return window.electronAPI.getPlatform();
      case 'continue-without-steamcmd':
        return window.electronAPI.continueWithoutSteamCMD();
      default:
        console.warn(`Canal IPC non supporté: ${channel}`);
        return Promise.reject(new Error(`Canal IPC non supporté: ${channel}`));
    }
  },
  on: (channel, callback) => {
    if (channel === 'config-updated') {
      return window.electronAPI.onConfigUpdated(callback);
    }
    console.warn(`Canal IPC on non supporté: ${channel}`);
  },
  removeListener: (channel, callback) => {
    if (channel === 'config-updated') {
      return window.electronAPI.removeConfigListener(callback);
    }
    console.warn(`Canal IPC removeListener non supporté: ${channel}`);
  }
};