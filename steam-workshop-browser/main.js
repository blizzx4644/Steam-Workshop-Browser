const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const os = require("os");
const https = require("https");

// Configuration de sécurité
app.commandLine.appendSwitch('--disable-features', 'OutOfBlinkCors');

// Utiliser le dossier userData d'Electron pour la config
const configPath = app.isPackaged
  ? path.join(app.getPath('userData'), 'config.json')
  : path.join(__dirname, "config.json");

let mainWindow;
let keyWindow;
let steamcmdWindow;

// --- Utils ---
function readConfig() {
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      steamApiKey: null,
      modsPath: null,
      steamcmdPath: null
    };
    writeConfig(defaultConfig);
    return defaultConfig;
  }
  try {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log("Config lue:", { ...configData, steamApiKey: configData.steamApiKey ? "***" : null });
    return configData;
  } catch (error) {
    console.error("Erreur lecture config:", error);
    return {
      steamApiKey: null,
      modsPath: null,
      steamcmdPath: null
    };
  }
}

function writeConfig(data) {
  try {
    // Créer le dossier userData si il n'existe pas
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
    console.log("Config sauvegardée dans:", configPath);
  } catch (error) {
    console.error("Erreur écriture config:", error);
  }
}

// Détection automatique de SteamCMD AMÉLIORÉE
function findSteamCMD() {
  const possiblePaths = [];

  // NOUVEAU: Chemins dans l'application buildée
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath;
    const steamcmdInResources = path.join(resourcesPath, "steamcmd");

    if (os.platform() === 'win32') {
      possiblePaths.push(
        path.join(steamcmdInResources, "steamcmd.exe"),
        path.join(path.dirname(process.execPath), "resources", "steamcmd", "steamcmd.exe")
      );
    } else {
      possiblePaths.push(
        path.join(steamcmdInResources, "steamcmd.sh"),
        path.join(path.dirname(process.execPath), "resources", "steamcmd", "steamcmd.sh")
      );
    }
  }

  // Chemins en développement
  if (os.platform() === 'win32') {
    possiblePaths.push(
      path.join(__dirname, "steamcmd", "steamcmd.exe"),
      path.join(process.env.USERPROFILE || "", "steamcmd", "steamcmd.exe"),
      "C:\\steamcmd\\steamcmd.exe",
      "steamcmd.exe" // Dans le PATH
    );
  } else {
    possiblePaths.push(
      path.join(__dirname, "steamcmd", "steamcmd.sh"),
      path.join(os.homedir(), "steamcmd", "steamcmd.sh"),
      "/usr/local/bin/steamcmd",
      "/opt/steamcmd/steamcmd.sh",
      "steamcmd" // Dans le PATH
    );
  }

  // Vérifier chaque chemin
  for (const steamcmdPath of possiblePaths) {
    try {
      if (fs.existsSync(steamcmdPath)) {
        // Vérifier que le fichier est exécutable
        const stats = fs.statSync(steamcmdPath);
        if (stats.isFile()) {
          console.log("SteamCMD trouvé:", steamcmdPath);
          return steamcmdPath;
        }
      }
    } catch (error) {
      console.log(`Erreur vérification ${steamcmdPath}:`, error.message);
    }
  }

  console.log("SteamCMD non trouvé automatiquement");
  return null;
}

// NOUVEAU: Fonction pour préparer SteamCMD au premier lancement
async function prepareSteamCMD() {
  const steamcmdPath = findSteamCMD();

  if (!steamcmdPath) {
    return null;
  }

  // Sur Linux/Mac, s'assurer que le script est exécutable
  if (os.platform() !== 'win32' && steamcmdPath.endsWith('.sh')) {
    try {
      await fs.promises.chmod(steamcmdPath, '755');
    } catch (error) {
      console.warn("Impossible de définir les permissions exécutables:", error);
    }
  }

  return steamcmdPath;
}

// --- Fenêtres ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  mainWindow.loadFile("index.html");

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  createMenu();
}

function createKeyWindow() {
  keyWindow = new BrowserWindow({
    width: 450,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false
    },
    parent: mainWindow,
    modal: true,
    resizable: false,
    show: false,
    autoHideMenuBar: true
  });

  keyWindow.loadFile("key.html");

  keyWindow.once('ready-to-show', () => {
    keyWindow.show();
  });
}

function createSteamCmdWindow() {
  steamcmdWindow = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false
    },
    parent: mainWindow,
    modal: true,
    resizable: false,
    show: false,
    autoHideMenuBar: true
  });

  steamcmdWindow.loadFile("steamcmd-setup.html");

  steamcmdWindow.once('ready-to-show', () => {
    steamcmdWindow.show();
  });
}

function createMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Définir dossier Mods',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: 'Choisir le dossier de destination des mods'
            });

            if (!result.canceled) {
              const cfg = readConfig();
              cfg.modsPath = result.filePaths[0];
              writeConfig(cfg);
              mainWindow.webContents.send('config-updated', cfg);
            }
          }
        },
        {
          label: 'Configuration SteamCMD',
          click: () => createSteamCmdWindow() // Créer la fenêtre SteamCMD
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Outils',
      submenu: [
        {
          label: 'Reconfigurer clé API',
          click: () => createKeyWindow()
        },
        {
          label: 'Tester SteamCMD',
          click: async () => await testSteamCMD()
        },
        { type: 'separator' },
        {
          label: 'Actualiser',
          accelerator: 'F5',
          click: () => mainWindow.reload()
        },
        {
          label: 'Ouvrir DevTools',
          accelerator: process.platform === 'darwin' ? 'Cmd+Option+I' : 'F12',
          click: () => mainWindow.webContents.openDevTools()
        }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'À propos',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'À propos',
              message: 'Steam Workshop Browser',
              detail: `Version: ${app.getVersion()}\nAuteur: Blizz\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`
            });
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function testSteamCMD() {
  const steamcmdPath = await prepareSteamCMD();

  if (!steamcmdPath) {
    dialog.showErrorBox('SteamCMD non trouvé',
      'SteamCMD n\'a pas pu être localisé automatiquement.\n' +
      'Veuillez le configurer manuellement dans Fichier > Configuration SteamCMD');
    return;
  }

  const cmd = os.platform() === 'win32' ?
    `"${steamcmdPath}" +quit` :
    `chmod +x "${steamcmdPath}" && "${steamcmdPath}" +quit`;

  const child = exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
    if (err) {
      if (err.code === 'ETIMEDOUT') {
        dialog.showErrorBox('Timeout SteamCMD',
          'SteamCMD met trop de temps à répondre. Vérifiez votre installation.');
      } else {
        dialog.showErrorBox('Erreur SteamCMD',
          `Erreur lors du test de SteamCMD:\n${stderr || err.message}`);
      }
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Test réussi',
        message: 'SteamCMD fonctionne correctement !',
        detail: `Chemin: ${steamcmdPath}\nMode: ${app.isPackaged ? 'Production' : 'Développement'}`
      });
    }
  });
}

// --- Lancement ---
app.whenReady().then(async () => {
  console.log("Application démarrée, mode packageé:", app.isPackaged);
  console.log("Chemin config:", configPath);

  const cfg = readConfig();

  // NOUVEAU: Nettoyer le chemin SteamCMD s'il pointe vers un chemin de développement
  if (cfg.steamcmdPath && !fs.existsSync(cfg.steamcmdPath)) {
    console.log("Ancien chemin SteamCMD invalide, recherche automatique...");
    cfg.steamcmdPath = await prepareSteamCMD();
    if (cfg.steamcmdPath) {
      writeConfig(cfg);
    }
  }

  // CORRECTION: Vérifier si la clé API existe ET est valide
  if (!cfg.steamApiKey || cfg.steamApiKey === null || cfg.steamApiKey === "null" || typeof cfg.steamApiKey !== 'string' || cfg.steamApiKey.length !== 32) {
    console.log("Clé API manquante ou invalide, ouverture de la fenêtre de configuration");
    createKeyWindow();
  } else {
    console.log("Clé API trouvée, ouverture de la fenêtre principale");
    createMainWindow();
  }
});

// --- IPC Handlers ---

// IPC: récupérer la config AMÉLIORÉE
ipcMain.handle("get-config", async () => {
  const config = readConfig();

  // Auto-détecter SteamCMD s'il n'est pas configuré ou invalide
  if (!config.steamcmdPath || !fs.existsSync(config.steamcmdPath)) {
    config.steamcmdPath = await prepareSteamCMD();
    if (config.steamcmdPath) {
      writeConfig(config);
    }
  }

  return config;
});

// IPC: enregistrer clé API CORRIGÉ
ipcMain.handle("save-api-key", async (_event, key) => {
  try {
    if (!key || typeof key !== 'string' || key.length !== 32) {
      throw new Error("Clé API invalide");
    }

    if (!/^[A-F0-9]{32}$/i.test(key)) {
      throw new Error("Format de clé API invalide");
    }

    const cfg = readConfig();
    cfg.steamApiKey = key;
    writeConfig(cfg);

    console.log("Clé API sauvegardée avec succès");

    // Fermer la fenêtre de configuration
    if (keyWindow) {
      keyWindow.close();
      keyWindow = null;
    }

    // Créer la fenêtre principale si elle n'existe pas
    if (!mainWindow) {
      createMainWindow();
    } else {
      // Envoyer la mise à jour de config à la fenêtre existante
      mainWindow.webContents.send('config-updated', cfg);
    }

    return true;
  } catch (error) {
    console.error("Erreur sauvegarde clé API:", error);
    throw error;
  }
});

// IPC: choisir dossier mods
ipcMain.handle("choose-mod-folder", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Choisir le dossier de destination des mods"
  });

  if (res.canceled) return null;

  const cfg = readConfig();
  cfg.modsPath = res.filePaths[0];
  writeConfig(cfg);
  return cfg.modsPath;
});

// IPC: ouvrir lien externe
ipcMain.handle("open-external", async (_event, url) => {
  try {
    const urlObj = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    const allowedDomains = ['steamcommunity.com', 'store.steampowered.com'];

    if (allowedProtocols.includes(urlObj.protocol) &&
        allowedDomains.some(domain => urlObj.hostname.endsWith(domain))) {
      await shell.openExternal(url);
      return true;
    } else {
      throw new Error('URL non autorisée');
    }
  } catch (error) {
    console.error('Erreur ouverture URL:', error);
    throw error;
  }
});

// ===== NOUVEAUX IPC HANDLERS POUR STEAMCMD =====

// IPC: obtenir la plateforme
ipcMain.handle("get-platform", async () => {
  const platform = os.platform();
  switch (platform) {
    case 'win32': return 'Windows';
    case 'darwin': return 'macOS';
    case 'linux': return 'Linux';
    default: return platform;
  }
});

// IPC: télécharger SteamCMD automatiquement
ipcMain.handle("download-steamcmd", async () => {
  const platform = os.platform();

  // Créer le dossier steamcmd
  const steamcmdDir = path.join(__dirname, "steamcmd");
  if (!fs.existsSync(steamcmdDir)) {
    fs.mkdirSync(steamcmdDir, { recursive: true });
  }

  let downloadUrl;
  let filename;
  let extractCmd;

  if (platform === 'win32') {
    downloadUrl = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip';
    filename = 'steamcmd.zip';
    extractCmd = null; // Windows n'a pas de commande tar native
  } else {
    downloadUrl = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz';
    filename = 'steamcmd_linux.tar.gz';
    extractCmd = `tar -xzf "${path.join(steamcmdDir, filename)}" -C "${steamcmdDir}"`;
  }

  const downloadPath = path.join(steamcmdDir, filename);

  return new Promise((resolve) => {
    console.log("Téléchargement de SteamCMD depuis:", downloadUrl);

    const file = fs.createWriteStream(downloadPath);

    https.get(downloadUrl, (response) => {
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log("SteamCMD téléchargé avec succès");

        // Extraction
        if (platform === 'win32') {
          // Pour Windows, on suppose que le zip contient steamcmd.exe
          resolve({
            ok: true,
            path: path.join(steamcmdDir, 'steamcmd.exe'),
            message: "SteamCMD téléchargé. Veuillez extraire le fichier zip manuellement."
          });
        } else {
          // Pour Linux/Mac, extraire avec tar
          exec(extractCmd, (error) => {
            if (error) {
              console.error("Erreur extraction:", error);
              resolve({ ok: false, error: `Erreur d'extraction: ${error.message}` });
            } else {
              const steamcmdPath = path.join(steamcmdDir, 'steamcmd.sh');

              // Rendre exécutable
              try {
                fs.chmodSync(steamcmdPath, '755');
              } catch (chmodError) {
                console.warn("Impossible de rendre exécutable:", chmodError);
              }

              // Nettoyer le fichier tar
              try {
                fs.unlinkSync(downloadPath);
              } catch (unlinkError) {
                console.warn("Impossible de supprimer le fichier temporaire:", unlinkError);
              }

              // Mettre à jour la config
              const cfg = readConfig();
              cfg.steamcmdPath = steamcmdPath;
              writeConfig(cfg);

              resolve({ ok: true, path: steamcmdPath });
            }
          });
        }
      });
    }).on('error', (error) => {
      console.error("Erreur téléchargement:", error);
      resolve({ ok: false, error: error.message });
    });
  });
});

// IPC: localiser SteamCMD manuellement
ipcMain.handle("browse-steamcmd", async () => {
  const result = await dialog.showOpenDialog(mainWindow || steamcmdWindow, {
    properties: ['openFile'],
    title: 'Localiser SteamCMD',
    filters: [
      { name: 'SteamCMD', extensions: ['exe', 'sh'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const steamcmdPath = result.filePaths[0];

    // Mettre à jour la config
    const cfg = readConfig();
    cfg.steamcmdPath = steamcmdPath;
    writeConfig(cfg);

    return steamcmdPath;
  }

  return null;
});

// IPC: tester SteamCMD
ipcMain.handle("test-steamcmd", async () => {
  const cfg = readConfig();
  const steamcmdPath = cfg.steamcmdPath;

  if (!steamcmdPath || !fs.existsSync(steamcmdPath)) {
    return { ok: false, error: "SteamCMD non trouvé" };
  }

  return new Promise((resolve) => {
    const cmd = os.platform() === 'win32' ?
      `"${steamcmdPath}" +quit` :
      `chmod +x "${steamcmdPath}" && "${steamcmdPath}" +quit`;

    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 'ETIMEDOUT') {
          resolve({ ok: false, error: "Timeout - SteamCMD met trop de temps à répondre" });
        } else {
          resolve({ ok: false, error: stderr || error.message });
        }
      } else {
        resolve({ ok: true });
      }
    });
  });
});

// IPC: continuer sans SteamCMD
ipcMain.handle("continue-without-steamcmd", async () => {
  if (steamcmdWindow) {
    steamcmdWindow.close();
    steamcmdWindow = null;
  }
  return true;
});

// IPC: recherche avancée de mods
ipcMain.handle("search-workshop-mods", async (_event, { appId, searchTerms, page = 1 }) => {
  const cfg = readConfig();
  if (!cfg.steamApiKey) {
    return { ok: false, error: "Clé API Steam non configurée. Allez dans Outils > Reconfigurer clé API" };
  }

  try {
    if (!appId || typeof appId !== 'number' || appId <= 0) {
      throw new Error('AppID invalide');
    }
    if (page && (typeof page !== 'number' || page <= 0)) {
      throw new Error('Numéro de page invalide');
    }

    const baseUrl = 'https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/';
    const params = new URLSearchParams({
      key: cfg.steamApiKey,
      appid: appId.toString(),
      page: page.toString(),
      numperpage: '50',
      return_metadata: 'true',
      return_previews: 'true',
      return_short_description: 'true',
      return_tags: 'true'
    });

    if (searchTerms && typeof searchTerms === 'string' && searchTerms.trim()) {
      params.append('search_text', searchTerms.trim());
    }

    const response = await fetch(`${baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Erreur API Steam: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.response && data.response.publishedfiledetails) {
      return {
        ok: true,
        mods: data.response.publishedfiledetails.filter(item =>
          item.title && item.publishedfileid && item.result === 1
        ),
        total: data.response.total || 0
      };
    }

    return { ok: true, mods: [], total: 0 };
  } catch (error) {
    console.error("Erreur recherche mods:", error);
    return { ok: false, error: error.message };
  }
});

// IPC: télécharger mod via SteamCMD AMÉLIORÉ
ipcMain.handle("download-mod", async (_event, { appId, modId }) => {
  const cfg = readConfig();

  if (!appId || !modId) {
    return { ok: false, error: "AppID et ModID requis" };
  }

  if (!cfg.modsPath) {
    return { ok: false, error: "Dossier mods non défini. Allez dans Fichier > Définir dossier Mods" };
  }

  // NOUVEAU: Utiliser prepareSteamCMD pour une meilleure détection
  let steamcmdPath = await prepareSteamCMD();

  if (!steamcmdPath) {
    return {
      ok: false,
      error: "SteamCMD non trouvé. Veuillez le télécharger ou le configurer dans Fichier > Configuration SteamCMD"
    };
  }

  return new Promise((resolve) => {
    console.log("Téléchargement mod:", { appId, modId, steamcmdPath, isPackaged: app.isPackaged });

    const args = [
      '+login', 'anonymous',
      '+workshop_download_item', appId.toString(), modId.toString(),
      '+quit'
    ];

    // NOUVEAU: Options améliorées pour le spawn
    const spawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(steamcmdPath),
      env: { ...process.env } // Hériter de l'environnement parent
    };

    // Sur Windows, éviter les problèmes de chemins avec des espaces
    if (os.platform() === 'win32' && steamcmdPath.includes(' ')) {
      spawnOptions.shell = true;
    }

    const steamcmdProcess = spawn(steamcmdPath, args, spawnOptions);

    let stdout = '';
    let stderr = '';

    steamcmdProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('SteamCMD stdout:', data.toString().trim());
    });

    steamcmdProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('SteamCMD stderr:', data.toString().trim());
    });

    steamcmdProcess.on('close', (code) => {
      console.log(`SteamCMD terminé avec le code: ${code}`);

      if (code !== 0 && !stdout.includes('Success') && !stdout.includes('success')) {
        return resolve({
          ok: false,
          error: `Erreur SteamCMD (code ${code}): ${stderr || "Échec du téléchargement"}`
        });
      }

      // NOUVEAU: Chemins de recherche améliorés
      const steamcmdDir = path.dirname(steamcmdPath);
      const possiblePaths = [
        path.join(steamcmdDir, "steamapps", "workshop", "content", appId.toString(), modId.toString()),
        path.join(__dirname, "steamapps", "workshop", "content", appId.toString(), modId.toString()),
        // Pour l'application packagée
        path.join(process.resourcesPath, "steamcmd", "steamapps", "workshop", "content", appId.toString(), modId.toString()),
        // Dossier AppData sur Windows
        path.join(os.homedir(), "AppData", "Local", "SteamCMD", "steamapps", "workshop", "content", appId.toString(), modId.toString())
      ];

      let workshopPath = null;
      for (const testPath of possiblePaths) {
        try {
          if (fs.existsSync(testPath)) {
            workshopPath = testPath;
            console.log("Mod trouvé dans:", testPath);
            break;
          }
        } catch (error) {
          console.log(`Erreur vérification ${testPath}:`, error.message);
        }
      }

      if (!workshopPath) {
        return resolve({
          ok: false,
          error: "Le mod n'a pas été téléchargé correctement. Vérifiez que le mod existe et est accessible anonymement."
        });
      }

      const targetPath = path.join(cfg.modsPath, `${appId}_${modId}`);

      fs.cp(workshopPath, targetPath, { recursive: true }, (cpErr) => {
        if (cpErr) {
          console.error("Erreur copie:", cpErr);
          return resolve({ ok: false, error: `Erreur de copie: ${cpErr.message}` });
        }

        // Nettoyage optionnel du fichier temporaire
        fs.rm(workshopPath, { recursive: true, force: true }, (rmErr) => {
          if (rmErr) {
            console.log("Attention: impossible de supprimer le fichier temporaire:", rmErr);
          }
          resolve({ ok: true, path: targetPath });
        });
      });
    });

    steamcmdProcess.on('error', (error) => {
      console.error("Erreur lancement SteamCMD:", error);
      resolve({ ok: false, error: `Impossible de lancer SteamCMD: ${error.message}` });
    });

    // Timeout de sécurité (10 minutes pour les gros mods)
    setTimeout(() => {
      steamcmdProcess.kill();
      resolve({ ok: false, error: "Timeout: le téléchargement a pris trop de temps" });
    }, 10 * 60 * 1000);
  });
});

// --- Gestion de fermeture ---
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const cfg = readConfig();
    if (!cfg.steamApiKey || cfg.steamApiKey === null || cfg.steamApiKey === "null" || typeof cfg.steamApiKey !== 'string' || cfg.steamApiKey.length !== 32) {
      createKeyWindow();
    } else {
      createMainWindow();
    }
  }
});

// Gestion de la sécurité
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
});

app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (url !== contents.getURL()) {
      event.preventDefault();
    }
  });
});