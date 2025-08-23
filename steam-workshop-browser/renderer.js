const gameList = document.getElementById("gameList");
const modList = document.getElementById("modList");
const gameSearchInput = document.getElementById("gameSearch");
const modSearchInput = document.getElementById("modSearch");

let currentAppId = null;
let currentMods = [];
let currentPage = 1;
let loading = false;
let steamApiKey = null;

// Cache pour améliorer les performances
let gamesCache = null;
let gamesCacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Initialisation - récupérer la clé API
async function init() {
  try {
    // Utiliser l'API exposée via preload.js au lieu de require direct
    const config = await window.electronAPI.getConfig();
    steamApiKey = config.steamApiKey;
    console.log("Configuration chargée, clé API:", steamApiKey ? "✓" : "✗");
  } catch (error) {
    console.error("Erreur lors du chargement de la config:", error);
  }
}

// --- RECHERCHE DE JEUX OPTIMISÉE ---
async function loadGamesCache() {
  const now = Date.now();

  // Utiliser le cache si il existe et n'est pas expiré
  if (gamesCache && (now - gamesCacheTimestamp) < CACHE_DURATION) {
    console.log("Utilisation du cache des jeux");
    return gamesCache;
  }

  console.log("Chargement de la liste des jeux Steam...");
  gameList.innerHTML = "<p>Chargement de la base de données Steam... (première fois seulement)</p>";

  try {
    const res = await fetch(`https://api.steampowered.com/ISteamApps/GetAppList/v2/`);
    const data = await res.json();

    if (data && data.applist && data.applist.apps) {
      // Filtrer les jeux avec des noms valides et trier par nom
      gamesCache = data.applist.apps
        .filter(game => game.name && game.name.trim().length > 0)
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

      gamesCacheTimestamp = now;
      console.log(`Cache des jeux créé: ${gamesCache.length} jeux`);
      return gamesCache;
    }
  } catch (error) {
    console.error("Erreur chargement liste jeux:", error);
    gameList.innerHTML = "<p class='error'>Erreur de connexion à Steam</p>";
  }

  return [];
}

async function searchGame() {
  const query = gameSearchInput.value.trim().toLowerCase();

  if (!query) {
    gameList.innerHTML = "<p>Tapez le nom d'un jeu pour commencer la recherche</p>";
    return;
  }

  if (query.length < 2) {
    gameList.innerHTML = "<p>Tapez au moins 2 caractères</p>";
    return;
  }

  if (!steamApiKey) {
    gameList.innerHTML = "<p class='error'>Clé API Steam non configurée</p>";
    return;
  }

  // Charger le cache si nécessaire
  const games = await loadGamesCache();
  if (!games || games.length === 0) return;

  console.log(`Recherche: "${query}" dans ${games.length} jeux`);

  // Recherche rapide dans le cache avec scoring
  const results = games
    .map(game => {
      const name = game.name.toLowerCase();
      let score = 0;

      // Score plus élevé si le nom commence par la recherche
      if (name.startsWith(query)) {
        score = 100;
      } else if (name.includes(query)) {
        score = 50;
      } else {
        // Recherche par mots séparés
        const queryWords = query.split(' ');
        const nameWords = name.split(' ');
        let wordMatches = 0;

        queryWords.forEach(queryWord => {
          if (nameWords.some(nameWord => nameWord.includes(queryWord))) {
            wordMatches++;
          }
        });

        if (wordMatches > 0) {
          score = wordMatches * 25;
        }
      }

      return { ...game, score };
    })
    .filter(game => game.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15); // Limiter à 15 résultats pour la performance

  gameList.innerHTML = "";

  if (results.length === 0) {
    gameList.innerHTML = "<p>Aucun jeu trouvé</p>";
    return;
  }

  console.log(`${results.length} jeux trouvés`);

  results.forEach((game) => {
    const div = document.createElement("div");
    div.className = "gameItem";
    div.innerHTML = `
      <span>${escapeHtml(game.name)}</span>
      <button onclick="loadMods(${game.appid}, '${escapeHtml(game.name)}')">Voir Mods</button>
    `;
    gameList.appendChild(div);
  });
}

// Debounce optimisé pour la recherche de jeux
let gameSearchTimeout;
gameSearchInput.addEventListener("input", () => {
  clearTimeout(gameSearchTimeout);
  gameSearchTimeout = setTimeout(searchGame, 200); // Réduit de 300 à 200ms
});

// --- RECHERCHE DE MODS OPTIMISÉE ---
async function loadMods(appId, gameName) {
  currentAppId = appId;
  currentMods = [];
  currentPage = 1;

  console.log(`Chargement mods pour: ${gameName} (${appId})`);
  modList.innerHTML = `<h3>${escapeHtml(gameName)}</h3><p>Chargement des mods...</p>`;

  // Charger plusieurs pages en parallèle pour commencer
  await loadModsBatch();
}

async function loadModsBatch() {
  if (loading || !currentAppId || !steamApiKey) return;

  loading = true;
  const startPage = currentPage;
  const BATCH_SIZE = 3; // Charger 3 pages en parallèle

  try {
    console.log(`Chargement batch pages ${startPage} à ${startPage + BATCH_SIZE - 1}`);

    // Créer plusieurs requêtes en parallèle
    const promises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const pageNum = startPage + i;
      promises.push(loadModsPage(pageNum));
    }

    const results = await Promise.allSettled(promises);
    let newMods = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        newMods = newMods.concat(result.value);
        console.log(`Page ${startPage + index}: ${result.value.length} mods`);
      }
    });

    if (newMods.length > 0) {
      currentMods = currentMods.concat(newMods);
      displayMods(currentMods);
      currentPage += BATCH_SIZE;
      console.log(`Total mods chargés: ${currentMods.length}`);
    } else if (currentMods.length === 0) {
      modList.innerHTML = "<p>Aucun mod trouvé pour ce jeu</p>";
    }

  } catch (error) {
    console.error("Erreur chargement batch mods:", error);
    if (currentMods.length === 0) {
      modList.innerHTML = "<p class='error'>Erreur lors du chargement des mods</p>";
    }
  }

  loading = false;
}

async function loadModsPage(pageNum) {
  try {
    // Utiliser différents paramètres de tri pour trouver plus de mods
    const sortOptions = [
      'trend', // Par défaut
      'mostrecent',
      'totaluniquesubscribers'
    ];

    const sortBy = sortOptions[Math.floor(Math.random() * sortOptions.length)];

    const res = await fetch(
      `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?` +
      `key=${steamApiKey}&appid=${currentAppId}&page=${pageNum}&numperpage=50&` +
      `return_metadata=true&return_previews=true&return_short_description=true&` +
      `return_tags=true&query_type=1&` +
      `filetype=0&` + // Tous types de fichiers
      `match_all_tags=false&` +
      `cache_max_age_seconds=0`, // Pas de cache pour avoir des résultats frais
      {
        timeout: 15000,
        headers: {
          'User-Agent': 'SteamWorkshopBrowser/1.0'
        }
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (data.response && data.response.publishedfiledetails) {
      const items = data.response.publishedfiledetails
        .filter(item => {
          // Filtrer les mods valides
          return item.title &&
                 item.publishedfileid &&
                 item.result === 1 && // Succès
                 item.visibility === 0; // Public
        })
        .map(item => ({
          title: item.title,
          id: item.publishedfileid,
          preview_url: item.preview_url || item.file_url || '',
          url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedfileid}`,
          description: item.short_description || item.file_description || '',
          tags: item.tags ? item.tags.map(tag => tag.tag).join(', ') : '',
          subscriptions: item.subscriptions || 0,
          file_size: item.file_size || 0
        }));

      console.log(`Page ${pageNum}: ${items.length} mods valides trouvés`);
      return items;
    }

    return [];
  } catch (error) {
    console.error(`Erreur page ${pageNum}:`, error);
    // Fallback: essayer avec des paramètres plus simples
    try {
      const fallbackRes = await fetch(
        `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?` +
        `key=${steamApiKey}&appid=${currentAppId}&page=${pageNum}&numperpage=30&` +
        `return_metadata=true`,
        { timeout: 10000 }
      );

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (fallbackData.response && fallbackData.response.publishedfiledetails) {
          return fallbackData.response.publishedfiledetails
            .filter(item => item.title && item.publishedfileid && item.result === 1)
            .map(item => ({
              title: item.title,
              id: item.publishedfileid,
              preview_url: item.preview_url || '',
              url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedfileid}`,
              description: item.short_description || ''
            }));
        }
      }
    } catch (fallbackError) {
      console.error(`Erreur fallback page ${pageNum}:`, fallbackError);
    }

    return [];
  }
}

function displayMods(mods) {
  // Garder le titre du jeu s'il existe
  const existingTitle = modList.querySelector('h3');
  modList.innerHTML = "";

  if (existingTitle) {
    modList.appendChild(existingTitle);
  }

  if (mods.length === 0) {
    modList.innerHTML += "<p>Aucun mod trouvé</p>";
    return;
  }

  // Utilisation de DocumentFragment pour améliorer les performances
  const fragment = document.createDocumentFragment();

  mods.forEach((mod) => {
    const div = document.createElement("div");
    div.className = "modItem";
    div.innerHTML = `
      <img src="${mod.preview_url}"
           onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Pas d&apos;image</text></svg>'" />
      <span class="modTitle">${escapeHtml(mod.title)}</span>
      <div class="modButtons">
        <button onclick="openWorkshop('${mod.url}')">Workshop</button>
        <button onclick="downloadMod(${currentAppId}, '${mod.id}')">Installer</button>
      </div>
    `;
    fragment.appendChild(div);
  });

  modList.appendChild(fragment);
}

// Scroll infini optimisé
let scrollTimeout;
modList.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    if (modList.scrollTop + modList.clientHeight >= modList.scrollHeight - 100) {
      if (!loading && currentAppId) {
        loadModsBatch();
      }
    }
  }, 100);
});

// Recherche de mods avancée (recherche serveur si pas de résultats locaux)
let modSearchTimeout;
modSearchInput.addEventListener("input", () => {
  clearTimeout(modSearchTimeout);
  modSearchTimeout = setTimeout(async () => {
    const query = modSearchInput.value.toLowerCase().trim();

    if (!query) {
      displayMods(currentMods);
      return;
    }

    console.log(`Recherche: "${query}" dans ${currentMods.length} mods locaux`);

    // Recherche locale d'abord
    const filteredMods = currentMods.filter(mod =>
      mod.title.toLowerCase().includes(query) ||
      (mod.description && mod.description.toLowerCase().includes(query)) ||
      (mod.tags && mod.tags.toLowerCase().includes(query))
    );

    console.log(`${filteredMods.length} mods trouvés localement`);

    // Si peu de résultats locaux et qu'on a assez de mods chargés, faire une recherche serveur
    if (filteredMods.length < 5 && currentMods.length > 100 && steamApiKey && currentAppId) {
      try {
        modList.innerHTML += "<p style='text-align:center; color:#999;'>Recherche étendue sur le serveur...</p>";

        const serverResults = await window.electronAPI.searchWorkshopMods({
          appId: currentAppId,
          searchTerms: query,
          page: 1
        });

        if (serverResults.ok && serverResults.mods.length > 0) {
          const serverMods = serverResults.mods.map(item => ({
            title: item.title,
            id: item.publishedfileid,
            preview_url: item.preview_url || '',
            url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedfileid}`,
            description: item.short_description || '',
            tags: item.tags ? item.tags.map(tag => tag.tag).join(', ') : '',
            isServerResult: true
          }));

          // Combiner résultats locaux et serveur
          const combinedResults = [...filteredMods];
          serverMods.forEach(serverMod => {
            if (!combinedResults.find(localMod => localMod.id === serverMod.id)) {
              combinedResults.push(serverMod);
            }
          });

          console.log(`${serverMods.length} mods supplémentaires trouvés sur le serveur`);
          displayMods(combinedResults);
          return;
        }
      } catch (error) {
        console.error("Erreur recherche serveur:", error);
      }
    }

    displayMods(filteredMods);
  }, 300);
});

// Fonctions utilitaires
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function openWorkshop(url) {
  try {
    await window.electronAPI.openExternal(url);
  } catch (error) {
    console.error("Erreur ouverture workshop:", error);
  }
}

async function downloadMod(appId, modId) {
  try {
    const button = event.target;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Installation...";

    const res = await window.electronAPI.downloadMod({ appId, modId });

    if (res.ok) {
      button.textContent = "Installé ✓";
      button.style.background = "#28a745";

      // Afficher notification
      if (window.Notification && Notification.permission === "granted") {
        new Notification("Mod installé", {
          body: `Mod installé dans: ${res.path}`,
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzI4YTc0NSIvPjxwYXRoIGQ9Ik0xMiAxNkwxNSAyMEwyMSAxMyIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+"
        });
      }
    } else {
      alert("Erreur : " + res.error);
      button.disabled = false;
      button.textContent = originalText;
    }
  } catch (error) {
    console.error("Erreur téléchargement:", error);
    alert("Erreur inattendue lors du téléchargement");
    event.target.disabled = false;
    event.target.textContent = "Installer";
  }
}

// Exposer les fonctions au scope global
window.loadMods = loadMods;
window.downloadMod = downloadMod;
window.openWorkshop = openWorkshop;

// Initialiser l'application
init();