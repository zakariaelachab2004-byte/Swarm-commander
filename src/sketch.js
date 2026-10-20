/**
 * ========================================================
 * sketch.js — SWARM COMMANDER // Wave-Based Survival Game
 * ========================================================
 * Projet Final Steering — Swarm Commander
 *
 * RÈGLE ABSOLUE : N'utilise QUE les 8 algorithmes de Steering
 * Behaviors étudiés, sans aucune IA externe (pas d'A*, pas de FSM complexe).
 *
 * Architecture du Jeu :
 *  - isPaused : Système complet de Pause / Reprise (touches [P] et [Échap]).
 *  - currentLevel : 1 à 5 (avec états de transition, victoire et défaite).
 *  - Joueur (Soucoupe Volante Antivirus) : Contrôlé à la souris avec 'Arrive' + 'ObstacleAvoidance'.
 *  - Tirs de Missiles (Clic Gauche) : Projectiles guidés avec 'Pursue' + 'ObstacleAvoidance'.
 *  - Onde EMP (Touche Espace) : Force tous les ennemis à activer 'Flee'.
 *
 * Progression par Vagues :
 *  - Niveau 1 : Ennemis utilisant 'Wander' + 'Seek'.
 *  - Niveau 2 : Traqueurs utilisant 'Pursue' + Clic Droit posant des Leurres avec 'Evade'.
 *  - Niveau 3 : Obstacles statiques + 'ObstacleAvoidance' + classe Path & 'PathFollowing'.
 *  - Niveau 4 : Essaim de 30 entités Boids avec 'Flocking' (Sep, Align, Coh) + 'Seek'.
 *  - Niveau 5 (Final) : Algorithme Génétique (ADN, Nourriture, Poison, Survie/Reproduction) + 'Wander'.
 *
 * Esthétique Rétro-Numérique :
 *  - Viseur Caméscope LCD (Sanyo Xacti VPC-S6 des années 2000).
 *  - Point clignotant 'REC', batterie Li-ion 3 barres, scanlines, glitchs cyan/rouge.
 * ========================================================
 */

// ── 1. État du Jeu & Progression ──────────────────────────
let currentLevel = 1;               // 1 à 5
let gameState = 'PLAYING';          // 'PLAYING' | 'WAVE_TRANSITION' | 'VICTORY' | 'GAME_OVER'
let isPaused = false;               // Variable globale de Pause / Reprise
let transitionMessage = '';

// Paliers de score RPG rééquilibrés pour des niveaux plus longs et gratifiants
const levelThresholds = [0, 2500, 7000, 15000, 26000, 40000];

// Quota d'éliminations requis par vague pour valider la transition
const levelKillQuotas = [0, 18, 24, 28, 34, 40];

// Gestionnaire du Bug Alpha (Mini-Boss apparaissant pour clore la vague)
let alphaBoss = null;
let alphaBossSpawned = false;
let alphaBossDefeated = false;

// Descriptions et briefings tactiques des vagues
const levelObjectives = {
  1: {
    nextDesc: "La vague 02 déploie des TRAQUEURS utilisant PURSUE (anticipation de trajectoire).\nContre-mesure : Déployez vos LEURRES (Clic Droit) pour les détourner avec EVADE !"
  },
  2: {
    nextDesc: "La vague 03 introduit des OBSTACLES et des PATROUILLES en PathFollowing.\nContre-mesure : Vos radars ObstacleAvoidance sont activés pour esquiver le décor !"
  },
  3: {
    nextDesc: "La vague 04 libère une horde de 30 BOIDS coordonnés (Séparation, Alignement, Cohésion).\nContre-mesure : Pressez [A] pour lancer votre escadron de drones en mode ATTAQUE !"
  },
  4: {
    nextDesc: "La vague 05 active la SÉLECTION NATURELLE. Des formes de vie à ADN mutants se reproduisent et fuient le poison.\nContre-mesure : Utilisez vos missiles et votre essaim pour purger l'écosystème !"
  },
  5: {
    nextDesc: "FÉLICITATIONS : SWARM COMMANDER ENTIÈREMENT VALIDÉ ! TOUS LES STEERING BEHAVIORS SONT MAÎTRISÉS !"
  }
};

// Ordres de commandement de l'Essaim Allié : 'FORMATION' (Suivi Leader) | 'ATTACK' (Pursue)
let swarmMode = 'FORMATION';

let score = 0;                      // Score cumulé
let totalKills = 0;                 // Ennemis abattus
let levelKills = 0;                 // Ennemis abattus dans la vague
let gameStartTime = 0;              // Début de partie en ms
let pausedTimeAcc = 0;              // Temps cumulé en pause
let screenGlitchTimer = 0;          // Secousse d'écran / aberration chromatique

let debugMode = false;
let sidebarCollapsed = false;

// ── 2. Entités Actives ─────────────────────────────────────
let joueur;                         // Le Joueur (Le Leader / Soucoupe Antivirus)
let essaimAllie = [];               // 20 Drones Alliés bleus subordonnés au Leader
let missiles = [];                  // Projectiles guidés (Clic Gauche)
let ennemis = [];                   // Tableau principal des ennemis du niveau
let leurres = [];                   // Leurres déployés au Clic Droit (Niveau 2)
let obstacles = [];                 // Obstacles statiques (Niveau 3+)
let chemin = null;                  // Circuit vectoriel Path (Niveau 3)
let food = [];                      // Nourriture verte (Niveau 5)
let poison = [];                    // Poison rouge (Niveau 5)
let particles = [];                 // Étincelles et débris d'explosions

// ── 3. Onde de Choc EMP (Espace - Force Flee) ─────────────
let ondeEMP = {
  active: false,
  x: 0,
  y: 0,
  radius: 0,
  maxRadius: 360,
  timer: 0,
  dureeMax: 160                     // ~2.7 secondes d'effet Flee
};

// ── 3.bis. Système Audio Procédural Retro-Arcade (Web Audio API) ──
let audioActif = true;              // Interrupteur général Son ON/OFF
let bgmIndex = 0;
let bgmTempoFrames = 9;             // Cadence des double-croches (~135 BPM)
let gameOverSoundPlayed = false;

// ── 4. Paramètres Physiques & Pondérations ─────────────────
const params = {
  // Joueur
  playerSpeed:       6.5,
  playerForce:       0.32,

  // Missiles
  missileSpeed:      11.0,
  missileForce:      0.85,

  // Ennemis
  hunterSpeed:       3.5,
  hunterPursueWeight:1.8,
  hunterWanderWeight:1.0,

  // Flocking (Niveau 4)
  swarmSepWeight:    2.2,
  swarmAlignWeight:  1.2,
  swarmCohWeight:    1.0,
  swarmSeekWeight:   0.45,

  // Évitement
  avoidWeight:       3.8,
  aheadDistance:     32,
  marge:             24
};

// ── 5. Setup p5.js ─────────────────────────────────────────
function setup() {
  try {
    const cnv = createCanvas(windowWidth, windowHeight);
    cnv.parent('canvas-container');
    colorMode(RGB);
    angleMode(RADIANS);

    // Désactivation du menu contextuel navigateur pour autoriser le clic droit
    window.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('contextmenu', e => e.preventDefault());

    gameStartTime = millis();

    // Initialisation de la GUI et des sliders
    initialiserDashboard();

    // Démarrage de la vague 1 et déploiement initial de l'Essaim Allié
    demarrerNiveau(1);
    initialiserEssaimAllie();
  } catch (err) {
    console.error('[SWARM COMMANDER CRITICAL SETUP ERROR]', err);
    afficherErreurFatale(err);
  }
}

function afficherErreurFatale(err) {
  const container = document.getElementById('canvas-container');
  if (container) {
    container.innerHTML = `
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                  background: #140810; border: 2px solid #ff3366; padding: 24px 32px; border-radius: 8px;
                  color: #fff; font-family: 'Share Tech Mono', monospace; z-index: 9999; max-width: 620px; text-align: center;
                  box-shadow: 0 0 30px rgba(255, 51, 102, 0.4);">
        <h2 style="color: #ff3366; margin-bottom: 12px; font-family: 'Press Start 2P', monospace; font-size: 14px;">⚠️ ERREUR SYSTÈME // INITIALISATION</h2>
        <p style="margin-bottom: 14px; color: #fca5a5; font-size: 13px;">${err.message || err}</p>
        <p style="font-size: 11px; opacity: 0.8; color: #94a3b8;">Consultez les détails dans la console développeur (Touche F12).</p>
      </div>
    `;
  }
}

// ── 6. Boucle Principale draw() ────────────────────────────
function draw() {
  // ── A. Secousse & Glitch Global d'Écran ──────────────────
  push();
  if (!isPaused && screenGlitchTimer > 0) {
    screenGlitchTimer--;
    translate(random(-6, 6), random(-3, 3));
  }

  // Fond d'écran LCD vintage (ardoise vert sombre liquide)
  background(11, 16, 14, 215);

  // Trame de scanlines et grille LCD
  dessinerGrilleLCD();

  // ── B. LOGIQUE DE MISE À JOUR (Active uniquement si !isPaused ET gameState === 'PLAYING') ──
  if (!isPaused && gameState === 'PLAYING') {
    // 1. Synchronisation des sliders
    synchroniserParametres();

    // 2. Physique de l'Onde EMP
    mettreAJourOndeEMP();

    // 3. Spawns continus d'ennemis cadencés tant que le palier de score n'est pas atteint
    gererSpawnsContinus();

    // 4. Spawns continus de l'écosystème génétique (Niveau 5)
    if (currentLevel === 5) {
      mettreAJourEcosystemeNiveau5();
    }

    // 5. Physique du Joueur (Arrive vers souris + Avoidance)
    mettreAJourJoueur();

    // 5.bis. Ordres & Physique de l'Essaim Allié (Suivi Leader Formation / Attaque Pursue)
    mettreAJourEssaimAllie();

    // 6. Physique des Leurres (Evade)
    mettreAJourLeurres();

    // 7. IA & Physique des Ennemis (Wander, Seek, Pursue, PathFollowing, Flocking, ADN)
    mettreAJourEnnemis();

    // 8. Guidage supersonique des Missiles (Pursue + Avoidance)
    mettreAJourMissiles();

    // 9. Résolution des Collisions & Éliminations
    resoudreCollisions();

    // 10. Physique des Particules d'explosion
    mettreAJourParticules();

    // 11. Télémétrie OSD Header & Chronomètre
    actualiserHUDHeader();

    // 12. Vérification de fin de vague / transition par palier de score
    verifierObjectifVague();

    // 13. Séquenceur d'Arpèges BGM Procédural (PolySynth)
    mettreAJourBGM();
  }

  // ── C. RENDU GRAPHIQUE CONTINU (Toujours affiché, même en Pause) ─
  // 1. Environnement (Circuit vectoriel Path & Obstacles)
  if (chemin && (currentLevel === 3 || currentLevel === 5)) {
    chemin.show(debugMode);
  }
  for (const obs of obstacles) {
    obs.show();
  }

  // 2. Particules de Nourriture & Poison (Niveau 5)
  if (currentLevel === 5) {
    dessinerNourritureEtPoison();
  }

  // 3. Anneaux d'onde EMP
  dessinerOndeEMP();

  // 4. Leurres holographiques
  for (const l of leurres) {
    l.show();
  }

  // 5. Ennemis de la vague active (avec traînées et halos néon)
  for (const e of ennemis) {
    e.show();
  }

  // 6. Missiles guidés & lignes laser de visée
  for (const m of missiles) {
    m.show();
    dessinerLigneGuidageMissile(m);
  }

  // 6.bis. Drones Alliés de l'Essaim (Bleu Cyan Formation / Rose Fuchsia Attaque)
  for (const d of essaimAllie) {
    d.show();
  }

  // 7. Le Joueur (Le Leader / Soucoupe Antivirus)
  if (joueur) {
    joueur.show();
    dessinerMireCurseur(createVector(mouseX, mouseY));
  }

  // 8. Particules d'explosion
  for (const p of particles) {
    p.show();
  }

  // 9. Viseur OSD LCD Caméscope Vintage (drawHUD)
  drawHUD();

  // 10. Écrans d'états (Transition de Niveau, Victoire ou Game Over)
  if (gameState === 'WAVE_TRANSITION') {
    dessinerTransitionNiveau();
  } else if (gameState === 'VICTORY') {
    dessinerEcranVictoire();
  } else if (gameState === 'GAME_OVER') {
    playGameOverSound();
    dessinerEcranGameOver();
  }

  // 11. Grand Écran de PAUSE Rétro-Numérique
  if (isPaused && gameState !== 'GAME_OVER') {
    dessinerEcranPause();
  }

  pop(); // Fin du contexte avec secousse
}

// ========================================================
// ── GESTIONNAIRE DE VAGUES (NIVEAUX 1 À 5) ──────────────
// ========================================================

/**
 * Initialise et lance un niveau spécifique de Swarm Commander.
 * @param {number} niveau
 */
function demarrerNiveau(niveau) {
  currentLevel = constrain(niveau, 1, 5);
  gameState = 'PLAYING';
  levelKills = 0;

  // Réinitialisation du Boss Alpha pour la nouvelle vague
  alphaBoss = null;
  alphaBossSpawned = false;
  alphaBossDefeated = false;

  gameOverSoundPlayed = false;
  bgmIndex = 0;

  // Réinitialisation des listes d'entités éphémères
  ennemis   = [];
  missiles  = [];
  leurres   = [];
  obstacles = [];
  chemin    = null;
  food      = [];
  poison    = [];

  // Création du Joueur au centre s'il n'existe pas encore
  if (!joueur) {
    joueur = new Vehicle(width / 2, height / 2);
    joueur.role      = 'focus';
    joueur.r         = 18;
    joueur.health    = 100;
    joueur.maxHealth = 100;
    joueur.maxSpeed  = params.playerSpeed;
    joueur.maxForce  = params.playerForce;
    joueur.behaviorManager = new BehaviorManager()
      .add('arrive', 1.0)
      .add('obstacleAvoidance', params.avoidWeight);
  } else {
    joueur.pos.set(width / 2, height / 2);
    joueur.vel.set(0, 0);
    // Réparation partielle de santé lors du passage à un nouveau niveau (+35 PV max 100)
    joueur.health = Math.min(joueur.maxHealth, joueur.health + 35);
  }

  // ── Maintien de l'Essaim Allié de 20 Drones ───────────────
  if (essaimAllie.length === 0) {
    initialiserEssaimAllie();
  } else {
    while (essaimAllie.length < 20) {
      const drone = new Vehicle(joueur.pos.x + random(-40, 40), joueur.pos.y + random(-40, 40));
      drone.role     = 'ally';
      drone.r        = 10;
      drone.maxSpeed = 5.8;
      drone.maxForce = 0.35;
      drone.behaviorManager = new BehaviorManager()
        .add('leaderfollowing',   2.4)
        .add('separation',        2.2)
        .add('obstacleAvoidance', params.avoidWeight)
        .add('pursue',            0.0);
      essaimAllie.push(drone);
    }
  }

  // ── Configuration de l'Environnement Spécifique au Niveau ─
  if (currentLevel === 3 || currentLevel === 5) {
    chemin = new Path(32, true);
    chemin.genererCircuit(width / 2, height / 2, width * 0.35, height * 0.32, 14);
  }

  if (currentLevel === 3) {
    obstacles = Obstacle.genererAleatoires(7, 34, 68, 110);
  } else if (currentLevel === 4) {
    obstacles = Obstacle.genererAleatoires(5, 30, 60, 120);
  } else if (currentLevel === 5) {
    obstacles = Obstacle.genererAleatoires(4, 32, 60, 130);
    for (let i = 0; i < 40; i++) {
      food.push(createVector(random(50, width - 50), random(50, height - 50)));
    }
    for (let i = 0; i < 18; i++) {
      poison.push(createVector(random(50, width - 50), random(50, height - 50)));
    }
  }

  // ── Spawns Initiaux d'Ennemis selon le Niveau ─────────────
  const nbInit = { 1: 12, 2: 10, 3: 10, 4: 30, 5: 16 };
  const compte = nbInit[currentLevel] || 10;

  for (let i = 0; i < compte; i++) {
    let v;
    if (currentLevel === 3 && chemin && chemin.points.length > 0) {
      const pt = chemin.points[i % chemin.points.length];
      v = new Vehicle(pt.x + random(-20, 20), pt.y + random(-20, 20));
    } else if (currentLevel === 4) {
      v = new Vehicle(width * 0.2 + random(-80, 80), height * 0.25 + random(-80, 80));
    } else {
      v = spawnEnnemiEnBordure();
    }
    configurerEnnemiSelonNiveau(v, currentLevel);
    ennemis.push(v);
  }

  // Mise à jour de l'état actif des boutons du sélecteur
  document.querySelectorAll('.level-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', idx + 1 === currentLevel);
  });

  // Aberration chromatique de transition
  declencherScreenGlitch(18);
}

/**
 * Configure les rôles, vitesses limites et comportements de steering
 * selon le niveau actif (utilise uniquement les 8 comportements étudiés).
 * @param {Vehicle} v
 * @param {number} niveau
 */
function configurerEnnemiSelonNiveau(v, niveau) {
  switch (niveau) {
    case 1: {
      // Niveau 1 : Ennemis utilisant Wander et Seek
      v.role     = 'virus';
      v.r        = 13;
      v.maxSpeed = params.hunterSpeed;
      v.maxForce = 0.22;
      v.behaviorManager = new BehaviorManager()
        .add('wander', params.hunterWanderWeight)
        .add('seek',   1.2)
        .add('flee',   0.0);
      break;
    }
    case 2: {
      // Niveau 2 : Traqueurs utilisant Pursue (prédiction de trajectoire)
      v.role     = 'traqueur';
      v.r        = 14;
      v.maxSpeed = params.hunterSpeed * 1.15;
      v.maxForce = 0.28;
      v.behaviorManager = new BehaviorManager()
        .add('pursue', params.hunterPursueWeight)
        .add('flee',   0.0);
      break;
    }
    case 3: {
      // Niveau 3 : Obstacles + PathFollowing + ObstacleAvoidance
      v.role     = 'patroller';
      v.r        = 13;
      v.maxSpeed = params.hunterSpeed * 1.05;
      v.maxForce = 0.26;
      v.behaviorManager = new BehaviorManager()
        .add('pathfollowing',     2.2)
        .add('obstacleAvoidance', params.avoidWeight)
        .add('seek',              0.35)
        .add('flee',              0.0);
      break;
    }
    case 4: {
      // Niveau 4 : Essaim Flocking (Separation, Alignment, Cohesion) + Seek
      v.role     = 'boid';
      v.r        = 10;
      v.maxSpeed = params.hunterSpeed * 1.1;
      v.maxForce = 0.24;
      v.behaviorManager = new BehaviorManager()
        .add('separation',        params.swarmSepWeight)
        .add('alignment',         params.swarmAlignWeight)
        .add('cohesion',          params.swarmCohWeight)
        .add('seek',              params.swarmSeekWeight)
        .add('obstacleAvoidance', params.avoidWeight)
        .add('flee',              0.0);
      break;
    }
    case 5: {
      // Niveau 5 : Algorithme Génétique + Nourriture & Poison + Wander
      v.role      = 'genetic';
      v.hasHealth = true;
      v.health    = 1.0;
      v.maxHealth = 1.0;
      v.r         = 13;
      v.maxSpeed  = 4.0;
      v.maxForce  = 0.22;
      v.behaviorManager = new BehaviorManager()
        .add('wander',            0.85)
        .add('obstacleAvoidance', 2.5)
        .add('flee',              0.0);
      break;
    }
  }
}

/**
 * Fait apparaître des ennemis en continu depuis les bords de l'écran
 * avec les comportements du niveau en cours tant que les objectifs de la vague ne sont pas remplis.
 */
function gererSpawnsContinus() {
  if (gameState !== 'PLAYING') return;

  const palierRequis = levelThresholds[currentLevel] || 40000;
  const quotaRequis  = levelKillQuotas[currentLevel] || 20;

  // Invocation du Boss Alpha dès que le joueur atteint 70% de la vague
  if (!alphaBossSpawned && (levelKills >= quotaRequis * 0.7 || score >= palierRequis * 0.7)) {
    faireApparaitreAlphaBoss();
  }

  // Si le palier et le quota sont atteints et le boss vaincu, stopper les nouveaux spawns
  if (score >= palierRequis && levelKills >= quotaRequis && (alphaBossDefeated || !alphaBoss)) return;

  // Limite max d'ennemis sur l'écran selon le niveau
  const maxParNiveau = { 1: 14, 2: 12, 3: 12, 4: 30, 5: 18 };
  const plafond = maxParNiveau[currentLevel] || 14;

  // Taux d'apparition cadencé : frameCount % 60 au niveau 1, accélérant progressivement aux niveaux supérieurs
  const baseCadence = Math.max(30, 60 - (currentLevel - 1) * 7);
  const intervalle = (ennemis.length === 0) ? 15 : baseCadence;

  if (frameCount % intervalle === 0 && ennemis.length < plafond) {
    let v;
    if (currentLevel === 3 && chemin && chemin.points.length > 0) {
      const pt = random(chemin.points);
      v = new Vehicle(pt.x + random(-25, 25), pt.y + random(-25, 25));
    } else {
      v = spawnEnnemiEnBordure();
    }
    configurerEnnemiSelonNiveau(v, currentLevel);
    ennemis.push(v);
  }
}

/**
 * Invoque le Boss Alpha doté d'une barre de vie et du comportement Pursue + ObstacleAvoidance.
 */
function faireApparaitreAlphaBoss() {
  if (alphaBossSpawned) return;
  alphaBossSpawned = true;
  alphaBossDefeated = false;
  declencherScreenGlitch(30);

  const b = spawnEnnemiEnBordure();
  b.role = 'boss';
  b.r = 22;
  b.maxSpeed = 3.6;
  b.maxForce = 0.35;
  b.health = 10 + currentLevel * 2.5;
  b.maxHealth = b.health;

  b.behaviorManager = new BehaviorManager()
    .add('pursue', 2.8)
    .add('obstacleAvoidance', 4.5);

  alphaBoss = b;
  ennemis.push(b);
}

function spawnEnnemiEnBordure() {
  let x, y;
  if (random(1) < 0.5) {
    x = random(1) < 0.5 ? -30 : width + 30;
    y = random(height);
  } else {
    x = random(width);
    y = random(1) < 0.5 ? -30 : height + 30;
  }
  return new Vehicle(x, y);
}

// ========================================================
// ── CONTRÔLES JOUEUR, PROJECTILES & ONDE EMP ────────────
// ========================================================

/**
 * Met à jour la physique et cinématique du Joueur (Arrive + Avoidance).
 */
function mettreAJourJoueur() {
  if (!joueur) return;
  const cibleSouris = createVector(mouseX, mouseY);
  joueur.maxSpeed = params.playerSpeed;
  joueur.maxForce = params.playerForce;

  if (joueur.behaviorManager) {
    joueur.behaviorManager.applyAll(joueur, {
      target:            cibleSouris,
      rayonFreinage:     90,
      distanceArret:     0,
      obstacles:         obstacles,
      aheadDistance:     params.aheadDistance,
      marge:             params.marge
    });
  }
  joueur.update();
  joueur.edges();
}

/**
 * Initialise l'Essaim Allié de 20 Drones subordonnés au Leader (Joueur).
 */
function initialiserEssaimAllie() {
  essaimAllie = [];
  const nbAllies = 20;
  for (let i = 0; i < nbAllies; i++) {
    const angle = random(TWO_PI);
    const dist = random(30, 85);
    const px = joueur ? joueur.pos.x + cos(angle) * dist : width / 2 + cos(angle) * dist;
    const py = joueur ? joueur.pos.y + sin(angle) * dist : height / 2 + sin(angle) * dist;

    const drone = new Vehicle(px, py);
    drone.role     = 'ally';
    drone.r        = 10;
    drone.maxSpeed = 5.8;
    drone.maxForce = 0.35;

    // BehaviorManager configuré avec les algorithmes mathématiques de Reynolds :
    // - leaderfollowing (Arrive vers le point en arrière de la vitesse du Leader)
    // - separation (entre les 20 drones de l'essaim allié)
    // - obstacleAvoidance (radar ahead pour éviter le décor)
    // - pursue (interception prédictive des ennemis en mode ATTACK)
    drone.behaviorManager = new BehaviorManager()
      .add('leaderfollowing',   2.4)
      .add('separation',        2.2)
      .add('obstacleAvoidance', params.avoidWeight)
      .add('pursue',            0.0);

    essaimAllie.push(drone);
  }
}

/**
 * Met à jour le comportement et la cinématique des 20 Drones Alliés selon l'ordre actif.
 */
function mettreAJourEssaimAllie() {
  if (!joueur) return;

  // Si on est en mode ATTACK mais qu'aucun ennemi n'est présent, repli automatique en FORMATION
  if (swarmMode === 'ATTACK' && ennemis.length === 0) {
    basculerModeEssaim('FORMATION');
  }

  for (let i = 0; i < essaimAllie.length; i++) {
    const drone = essaimAllie[i];

    if (swarmMode === 'FORMATION') {
      // ── MODE FORMATION : Suivi de Leader (Reynolds) ───────
      // Cible le point situé en arrière du vecteur vitesse du Joueur avec Arrive + Separation
      drone.behaviorManager.setWeight('leaderfollowing', 2.4);
      drone.behaviorManager.setWeight('pursue',          0.0);
      drone.behaviorManager.setWeight('separation',      2.2);
      drone.behaviorManager.setWeight('obstacleAvoidance', params.avoidWeight);

      drone.behaviorManager.applyAll(drone, {
        leader:           joueur,
        distanceDerriere: 60,
        rayonFreinage:    80,
        voisins:          essaimAllie,
        distSeparation:   28,
        obstacles:        obstacles,
        aheadDistance:    params.aheadDistance,
        marge:            params.marge
      });

    } else if (swarmMode === 'ATTACK') {
      // ── MODE ATTAQUE : Pursue sur l'ennemi rouge le plus proche ─
      // Poids de Arrive mis à 0, Pursue très fort, Separation et ObstacleAvoidance maintenus
      drone.behaviorManager.setWeight('leaderfollowing', 0.0);
      drone.behaviorManager.setWeight('pursue',          3.8);
      drone.behaviorManager.setWeight('separation',      1.8);
      drone.behaviorManager.setWeight('obstacleAvoidance', params.avoidWeight);

      // Détection de l'ennemi le plus proche pour ce drone
      let plusProcheEnnemi = null;
      let dMin = Infinity;
      for (const e of ennemis) {
        const d = p5.Vector.dist(drone.pos, e.pos);
        if (d < dMin) {
          dMin = d;
          plusProcheEnnemi = e;
        }
      }

      drone.behaviorManager.applyAll(drone, {
        proie:            plusProcheEnnemi,
        predictionFrames: 14,
        voisins:          essaimAllie,
        distSeparation:   26,
        obstacles:        obstacles,
        aheadDistance:    params.aheadDistance,
        marge:            params.marge
      });
    }

    drone.update();
    drone.edges();
  }
}

/**
 * Bascule l'ordre de l'essaim allié entre 'FORMATION' et 'ATTACK'.
 * @param {'FORMATION'|'ATTACK'} mode
 */
function basculerModeEssaim(mode) {
  swarmMode = mode;
  playOrderSound(mode);
  declencherScreenGlitch(8);

  const elBadge = document.getElementById('badge-swarm-mode');
  const elHud = document.getElementById('hud-swarm-mode');
  const dotHud = document.getElementById('dot-swarm-mode');
  const btnForm = document.getElementById('btn-swarm-formation');
  const btnAtk = document.getElementById('btn-swarm-attack');

  if (swarmMode === 'FORMATION') {
    if (elBadge) {
      elBadge.textContent = 'FORMATION';
      elBadge.className = 'tag tag-cyan';
    }
    if (elHud) elHud.textContent = '[F] FORMATION';
    if (dotHud) dotHud.style.background = 'var(--lcd-cyan)';
    if (btnForm) btnForm.classList.add('active');
    if (btnAtk) btnAtk.classList.remove('active');
  } else {
    if (elBadge) {
      elBadge.textContent = 'ATTAQUE';
      elBadge.className = 'tag tag-red';
    }
    if (elHud) elHud.textContent = '[A] ATTAQUE';
    if (dotHud) dotHud.style.background = 'var(--lcd-pink)';
    if (btnForm) btnForm.classList.remove('active');
    if (btnAtk) btnAtk.classList.add('active');
  }
}

/**
 * Tirs à tête chercheuse (Clic Gauche) : Projectiles guidés avec 'Pursue'.
 */
function tirerMissiles() {
  if (isPaused || !joueur) return;
  playShootSound();

  let plusProche = null;
  let distMin = Infinity;

  if (ennemis.length > 0) {
    for (const e of ennemis) {
      const d = p5.Vector.dist(joueur.pos, e.pos);
      if (d < distMin) {
        distMin = d;
        plusProche = e;
      }
    }
  }

  const dir = plusProche
    ? p5.Vector.sub(plusProche.pos, joueur.pos).normalize()
    : p5.Vector.sub(createVector(mouseX, mouseY), joueur.pos).normalize();

  // Double salve supersonique
  for (let s = -1; s <= 1; s += 2) {
    const m = new Missile(joueur.pos.x, joueur.pos.y, plusProche);
    m.vel = dir.copy().rotate(s * 0.18).mult(m.maxSpeed);
    missiles.push(m);
  }

  joueur.applyForce(dir.copy().mult(-1.1));
}

/**
 * Déclenche l'onde EMP (Touche Espace) qui force les ennemis à utiliser 'Flee'.
 */
function declencherOndeEMP() {
  if (isPaused || !joueur) return;
  ondeEMP.active = true;
  ondeEMP.x = joueur.pos.x;
  ondeEMP.y = joueur.pos.y;
  ondeEMP.radius = 0;
  ondeEMP.timer = ondeEMP.dureeMax;

  declencherScreenGlitch(20);
  creerExplosion(joueur.pos.x, joueur.pos.y, color(0, 240, 255));
  playExplosionSound(true);
}

function mettreAJourOndeEMP() {
  if (!ondeEMP.active) return;
  ondeEMP.timer--;
  ondeEMP.radius = map(ondeEMP.timer, ondeEMP.dureeMax, 0, 0, ondeEMP.maxRadius);
  if (ondeEMP.timer <= 0) {
    ondeEMP.active = false;
  }
}

function dessinerOndeEMP() {
  if (!ondeEMP.active) return;
  push();
  noFill();
  const alphaVal = map(ondeEMP.timer, 0, ondeEMP.dureeMax, 0, 220);
  stroke(0, 240, 255, alphaVal);
  strokeWeight(2.5);
  drawingContext.shadowBlur = 14;
  drawingContext.shadowColor = color(0, 240, 255);
  circle(ondeEMP.x, ondeEMP.y, ondeEMP.radius * 2);

  stroke(255, 40, 80, alphaVal * 0.7);
  strokeWeight(1.5);
  circle(ondeEMP.x + 3, ondeEMP.y, (ondeEMP.radius * 2) - 8);
  pop();
}

/**
 * Gère le déploiement de Leurres au Clic Droit (Niveau 2).
 */
function poserLeurre() {
  if (isPaused || !joueur) return;
  const l = new Leurre(joueur.pos.x, joueur.pos.y);
  l.vel = p5.Vector.random2D().mult(3);
  leurres.push(l);
  creerExplosion(joueur.pos.x, joueur.pos.y, color(255, 183, 3));
}

function mettreAJourLeurres() {
  for (let i = leurres.length - 1; i >= 0; i--) {
    const l = leurres[i];
    l.lifeSpan--;
    if (l.behaviorManager) {
      let plusProche = null;
      let dMin = Infinity;
      const traqueurs = ennemis.filter(e => e.role === 'traqueur');
      for (const t of traqueurs) {
        const d = p5.Vector.dist(l.pos, t.pos);
        if (d < dMin) {
          dMin = d;
          plusProche = t;
        }
      }
      l.behaviorManager.applyAll(l, {
        menace:        plusProche,
        maxPrediction: 16,
        obstacles:     obstacles,
        aheadDistance: 25,
        marge:         18
      });
    }
    l.update();
    l.edges();
    if (l.isExpired()) {
      creerExplosion(l.pos.x, l.pos.y, color(255, 183, 3));
      leurres.splice(i, 1);
    }
  }
}

function mettreAJourMissiles() {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.lifeSpan--;
    m.actualiserCible(ennemis);

    if (m.behaviorManager) {
      m.behaviorManager.applyAll(m, {
        proie:            m.cible,
        predictionFrames: 14,
        obstacles:        obstacles,
        aheadDistance:    28,
        marge:            20
      });
    }
    m.update();
    if (m.isExpired()) {
      missiles.splice(i, 1);
    }
  }
}

function dessinerLigneGuidageMissile(m) {
  if (m.cible && ennemis.includes(m.cible)) {
    push();
    stroke(0, 240, 255, 80);
    strokeWeight(1);
    drawingContext.setLineDash([2, 4]);
    line(m.pos.x, m.pos.y, m.cible.pos.x, m.cible.pos.y);
    drawingContext.setLineDash([]);
    pop();
  }
}

// ========================================================
// ── GESTION DE LA POPULATION D'ENNEMIS ──────────────────
// ========================================================

function mettreAJourEnnemis() {
  for (let i = ennemis.length - 1; i >= 0; i--) {
    const e = ennemis[i];

    // Onde EMP (Force Flee)
    if (ondeEMP.active) {
      const dOnde = p5.Vector.dist(e.pos, createVector(ondeEMP.x, ondeEMP.y));
      if (dOnde < ondeEMP.radius + 120) {
        const forceFlee = BehaviorManager.flee(e, createVector(ondeEMP.x, ondeEMP.y), 400);
        forceFlee.mult(4.8);
        e.applyForce(forceFlee);
        e.glitch(4);
      }
    }

    switch (e.role) {
      case 'virus': {
        if (e.behaviorManager) {
          e.behaviorManager.applyAll(e, {
            target:            joueur.pos,
            distanceCercle:    110,
            wanderRadius:      45,
            displaceRange:     0.25,
            obstacles:         obstacles
          });
        }
        e.update();
        e.edges();
        break;
      }

      case 'traqueur': {
        let ciblePrioritaire = joueur;
        let dMin = p5.Vector.dist(e.pos, joueur.pos);

        for (const l of leurres) {
          const dL = p5.Vector.dist(e.pos, l.pos);
          if (dL < dMin) {
            dMin = dL;
            ciblePrioritaire = l;
          }
        }

        if (e.behaviorManager) {
          e.behaviorManager.applyAll(e, {
            proie:            ciblePrioritaire,
            predictionFrames: 16,
            obstacles:        obstacles
          });
        }
        e.update();
        e.edges();
        break;
      }

      case 'patroller': {
        if (e.behaviorManager) {
          e.behaviorManager.applyAll(e, {
            path:              chemin,
            lookahead:         55,
            target:            joueur.pos,
            obstacles:         obstacles,
            aheadDistance:     params.aheadDistance,
            marge:             params.marge
          });
        }
        e.update();
        e.edges();
        break;
      }

      case 'boid': {
        if (e.behaviorManager) {
          e.behaviorManager.applyAll(e, {
            voisins:           ennemis,
            target:            joueur.pos,
            obstacles:         obstacles,
            distSeparation:    32,
            distAlignement:    50,
            distCohesion:      65,
            aheadDistance:     params.aheadDistance,
            marge:             params.marge
          });
        }
        e.update();
        e.edges();
        break;
      }

      case 'genetic': {
        const steerFood = e.eat(food, 0.28, e.dna[2]);
        steerFood.mult(e.dna[0]);

        const steerPoison = e.eat(poison, -0.80, e.dna[3]);
        steerPoison.mult(e.dna[1]);

        const steerBordures = e.boundaries(35);

        e.applyForce(steerFood);
        e.applyForce(steerPoison);
        e.applyForce(steerBordures);

        if (e.behaviorManager) {
          e.behaviorManager.applyAll(e, {
            distanceCercle: 100,
            wanderRadius:   40,
            displaceRange:  0.22,
            obstacles:      obstacles
          });
        }
        e.update();
        e.edges();

        const enfant = e.clone(0.0024);
        if (enfant && ennemis.length < 28) {
          ennemis.push(enfant);
        }

        if (e.isDead()) {
          food.push(e.pos.copy());
          creerExplosion(e.pos.x, e.pos.y, color(40, 245, 120));
          ennemis.splice(i, 1);
          score += 80;
          levelKills++;
          totalKills++;
          continue;
        }
        break;
      }

      case 'boss':
      case 'alpha': {
        // Le Boss Alpha utilise Pursue vers le joueur + ObstacleAvoidance (Reynolds)
        if (e.behaviorManager) {
          e.behaviorManager.applyAll(e, {
            proie:            joueur,
            predictionFrames: 18,
            obstacles:        obstacles,
            aheadDistance:    params.aheadDistance + 14,
            marge:            params.marge + 10
          });
        }
        e.update();
        e.edges();
        break;
      }
      default: {
        e.update();
        e.edges();
      }
    }
  }
}

function mettreAJourEcosystemeNiveau5() {
  if (random(1) < 0.12 && food.length < 60) {
    food.push(createVector(random(40, width - 40), random(40, height - 40)));
  }
  if (random(1) < 0.035 && poison.length < 25) {
    poison.push(createVector(random(40, width - 40), random(40, height - 40)));
  }
}

function dessinerNourritureEtPoison() {
  push();
  fill(57, 255, 20);
  stroke(20, 160, 60);
  strokeWeight(1);
  for (const f of food) {
    circle(f.x, f.y, 5);
  }

  fill(255, 40, 60);
  stroke(180, 20, 40);
  for (const p of poison) {
    circle(p.x, p.y, 5.5);
  }
  pop();
}

// ========================================================
// ── RÉSOLUTION DES COLLISIONS & TRANSITIONS ─────────────
// ========================================================

function resoudreCollisions() {
  // A. Missiles ⇄ Ennemis
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    let collision = false;

    for (let j = ennemis.length - 1; j >= 0; j--) {
      const e = ennemis[j];
      const d = p5.Vector.dist(m.pos, e.pos);

      if (d < m.r + e.r + 3) {
        creerExplosion(m.pos.x, m.pos.y, color(0, 240, 255));
        missiles.splice(i, 1);
        collision = true;
        playExplosionSound(e.role === 'boss' || e.role === 'alpha');

        if (e.role === 'boss' || e.role === 'alpha') {
          // Dégâts sur le Boss Alpha
          e.health = (e.health || 10) - 1.2;
          e.glitch(14);
          creerExplosion(e.pos.x, e.pos.y, color(255, 230, 0));
          declencherScreenGlitch(12);

          if (e.health <= 0) {
            for (let k = 0; k < 4; k++) {
              creerExplosion(e.pos.x + random(-15, 15), e.pos.y + random(-15, 15), color(255, 40, 80));
            }
            ennemis.splice(j, 1);
            score += 800;
            levelKills++;
            totalKills++;
            alphaBossDefeated = true;
            declencherScreenGlitch(24);
          }
        } else {
          // Ennemi standard
          creerExplosion(e.pos.x, e.pos.y, color(255, 40, 80));
          ennemis.splice(j, 1);
          score += 75; // Score calibré pour une progression maîtrisée
          levelKills++;
          totalKills++;
          declencherScreenGlitch(6);
        }
        break;
      }
    }
    if (collision) continue;
  }

  // B. Traqueurs ⇄ Leurres (Niveau 2)
  if (currentLevel === 2) {
    for (let i = leurres.length - 1; i >= 0; i--) {
      const l = leurres[i];
      for (let j = ennemis.length - 1; j >= 0; j--) {
        const t = ennemis[j];
        if (p5.Vector.dist(l.pos, t.pos) < l.r + t.r) {
          creerExplosion(l.pos.x, l.pos.y, color(255, 183, 3));
          leurres.splice(i, 1);
          t.glitch(12);
          break;
        }
      }
    }
  }

  // C. Ennemis ⇄ Obstacles
  for (const obs of obstacles) {
    for (const e of ennemis) {
      obs.checkCollision(e);
    }
  }

  // D. Ennemis ⇄ Joueur (Dégâts RPG, Explosion & Glitch)
  for (let j = ennemis.length - 1; j >= 0; j--) {
    const e = ennemis[j];
    const d = p5.Vector.dist(joueur.pos, e.pos);
    if (d < joueur.r + e.r) {
      playExplosionSound(true);
      if (e.role === 'boss' || e.role === 'alpha') {
        creerExplosion(joueur.pos.x, joueur.pos.y, color(255, 40, 80));
        joueur.takeDamage(18); // Dégâts plus sérieux du Boss
        joueur.glitch(22);
        declencherScreenGlitch(20);
        const repulse = p5.Vector.sub(joueur.pos, e.pos).normalize().mult(5.5);
        joueur.applyForce(repulse);
      } else {
        creerExplosion(e.pos.x, e.pos.y, color(255, 40, 80));
        ennemis.splice(j, 1);
        joueur.takeDamage(10);
        joueur.glitch(18);
        declencherScreenGlitch(16);
        const repulse = p5.Vector.sub(joueur.pos, e.pos).normalize().mult(3.5);
        joueur.applyForce(repulse);
      }

      if (gameState === 'GAME_OVER') {
        break;
      }
    }
  }

  // E. Drones Alliés de l'Essaim ⇄ Ennemis (Attaque & Interception)
  for (let i = essaimAllie.length - 1; i >= 0; i--) {
    const drone = essaimAllie[i];
    for (let j = ennemis.length - 1; j >= 0; j--) {
      const e = ennemis[j];
      const d = p5.Vector.dist(drone.pos, e.pos);
      if (d < drone.r + e.r + 2) {
        if (e.role === 'boss' || e.role === 'alpha') {
          e.health = (e.health || 10) - 0.7;
          e.glitch(12);
          creerExplosion(drone.pos.x, drone.pos.y, color(0, 240, 255));
          drone.applyForce(p5.Vector.random2D().mult(3.8));
          drone.glitch(12);

          if (e.health <= 0) {
            for (let k = 0; k < 4; k++) {
              creerExplosion(e.pos.x + random(-15, 15), e.pos.y + random(-15, 15), color(255, 40, 80));
            }
            playExplosionSound(true);
            ennemis.splice(j, 1);
            score += 800;
            levelKills++;
            totalKills++;
            alphaBossDefeated = true;
            declencherScreenGlitch(24);
          }
        } else {
          creerExplosion(e.pos.x, e.pos.y, color(255, 40, 80));
          creerExplosion(drone.pos.x, drone.pos.y, color(0, 240, 255));
          playExplosionSound(false);

          ennemis.splice(j, 1);
          score += 50; // Score équilibré
          levelKills++;
          totalKills++;
          declencherScreenGlitch(6);

          drone.applyForce(p5.Vector.random2D().mult(3.2));
          drone.glitch(12);
        }
        break;
      }
    }
  }
}

/**
 * Fonction globale pour infliger des dégâts au joueur et actualiser la santé.
 * @param {number} amount
 */
function takeDamage(amount) {
  if (joueur) {
    joueur.takeDamage(amount);
    if (joueur.health <= 0) {
      playGameOverSound();
    }
  }
}

/**
 * Vérifie si les conditions complètes de passage de niveau sont réunies :
 *  1. Score requis atteint
 *  2. Quota d'ennemis éliminés atteint
 *  3. Boss Alpha éliminé
 */
function verifierObjectifVague() {
  if (gameState !== 'PLAYING') return;

  const palierRequis = levelThresholds[currentLevel] || 40000;
  const quotaRequis  = levelKillQuotas[currentLevel] || 20;

  const scoreOk = score >= palierRequis;
  const killsOk = levelKills >= quotaRequis;
  const bossOk  = alphaBossDefeated || !alphaBoss || !ennemis.includes(alphaBoss);

  if (scoreOk && killsOk && bossOk) {
    declencherTransitionNiveau();
  }
}

function declencherTransitionNiveau() {
  declencherScreenGlitch(30);

  if (currentLevel < 5) {
    gameState = 'WAVE_TRANSITION';
    // Récompense de fin de vague : réparation de santé pour le joueur (+30 PV)
    if (joueur) {
      joueur.health = Math.min(joueur.maxHealth, joueur.health + 30);
    }
  } else {
    gameState = 'VICTORY';
  }
}

/**
 * Affiche l'écran interactif de transition de vague.
 * Donne le temps au joueur de souffler, de lire le briefing et de cliquer quand il est prêt.
 */
function dessinerTransitionNiveau() {
  push();
  // Fond sombre rétro LCD
  fill(6, 14, 10, 230);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);

  const boxW = min(width - 40, 680);
  const boxH = 410;
  const boxX = width / 2 - boxW / 2;
  const boxY = height / 2 - boxH / 2;

  // Lueur néon verte / jaune
  drawingContext.shadowBlur = 24;
  drawingContext.shadowColor = color(57, 255, 20);

  // Cadre principal
  stroke(57, 255, 20, 220);
  strokeWeight(2.5);
  fill(10, 22, 16, 240);
  rect(boxX, boxY, boxW, boxH, 8);

  // Coins de visée rétro OSD
  const c = 22;
  stroke(255, 230, 0, 230);
  strokeWeight(3);
  line(boxX, boxY, boxX + c, boxY);
  line(boxX, boxY, boxX, boxY + c);
  line(boxX + boxW, boxY, boxX + boxW - c, boxY);
  line(boxX + boxW, boxY, boxX + boxW, boxY + c);
  line(boxX, boxY + boxH, boxX + c, boxY + boxH);
  line(boxX, boxY + boxH, boxX, boxY + boxH - c);
  line(boxX + boxW, boxY + boxH, boxX + boxW - c, boxY + boxH);
  line(boxX + boxW, boxY + boxH, boxX + boxW, boxY + boxH - c);

  // 1. Titre Victoire de Vague
  noStroke();
  textFont('Press Start 2P, VT323, monospace');
  fill(255, 230, 0);
  textSize(min(17, width * 0.038));
  textStyle(BOLD);
  text(`★ VAGUE 0${currentLevel} PURGÉE ! ★`, width / 2, boxY + 42);

  // 2. Statut et Récompense
  textFont('Share Tech Mono, monospace');
  fill(57, 255, 20);
  textSize(14);
  textStyle(NORMAL);
  text(`SCORE CUMULÉ : ${score} PTS   |   CIBLES VAGUE ÉLIMINÉES : ${levelKills}`, width / 2, boxY + 80);

  fill(0, 240, 255);
  textSize(13);
  text(`RÉPARATION DU COMMANDANT : +30 PV REÇUS (SANTÉ: ${joueur ? Math.round(joueur.health) : 100}/100 PV)`, width / 2, boxY + 106);

  // Ligne de séparation
  stroke(57, 255, 20, 90);
  strokeWeight(1);
  line(boxX + 30, boxY + 128, boxX + boxW - 30, boxY + 128);
  noStroke();

  // 3. Cadre Briefing Tactique du Prochain Niveau
  const nextLvl = currentLevel + 1;
  const infoLvl = levelObjectives[currentLevel];

  fill(16, 36, 26, 210);
  stroke(0, 240, 255, 160);
  strokeWeight(1.5);
  rect(boxX + 30, boxY + 144, boxW - 60, 150, 6);

  noStroke();
  textFont('Press Start 2P, monospace');
  fill(0, 240, 255);
  textSize(11);
  text(`ORDRE DE MISSION // NIVEAU 0${nextLvl}`, width / 2, boxY + 172);

  textFont('Share Tech Mono, monospace');
  fill(240, 250, 245);
  textSize(13);
  textAlign(CENTER, TOP);
  const descNext = infoLvl ? infoLvl.nextDesc : "Accédez à la phase suivante de la mission.";
  text(descNext, boxX + 45, boxY + 196, boxW - 90, 85);
  textAlign(CENTER, CENTER);

  // 4. Bouton Interactif "LANCER LE NIVEAU SUIVANT"
  const btnNextW = min(420, boxW - 80);
  const btnNextH = 48;
  const btnNextX = width / 2 - btnNextW / 2;
  const btnNextY = boxY + boxH - 74;

  const isHoverNext = mouseX >= btnNextX && mouseX <= btnNextX + btnNextW &&
                      mouseY >= btnNextY && mouseY <= btnNextY + btnNextH;

  drawingContext.shadowBlur = isHoverNext ? 26 : 14;
  drawingContext.shadowColor = color(57, 255, 20);
  stroke(57, 255, 20, isHoverNext ? 255 : 200);
  strokeWeight(isHoverNext ? 2.5 : 1.8);
  fill(isHoverNext ? color(36, 110, 60, 245) : color(20, 60, 36, 220));
  rect(btnNextX, btnNextY, btnNextW, btnNextH, 6);

  // Coins bouton
  const bc = 10;
  stroke(255, 230, 0, isHoverNext ? 255 : 180);
  strokeWeight(2);
  line(btnNextX, btnNextY, btnNextX + bc, btnNextY);
  line(btnNextX, btnNextY, btnNextX, btnNextY + bc);
  line(btnNextX + btnNextW, btnNextY, btnNextX + btnNextW - bc, btnNextY);
  line(btnNextX + btnNextW, btnNextY, btnNextX + btnNextW, btnNextY + bc);
  line(btnNextX, btnNextY + btnNextH, btnNextX + bc, btnNextY + btnNextH);
  line(btnNextX, btnNextY + btnNextH, btnNextX, btnNextY + btnNextH - bc);
  line(btnNextX + btnNextW, btnNextY + btnNextH, btnNextX + btnNextW - bc, btnNextY + btnNextH);
  line(btnNextX + btnNextW, btnNextY + btnNextH, btnNextX + btnNextW, btnNextY + btnNextH - bc);

  noStroke();
  textFont('Press Start 2P, monospace');
  drawingContext.shadowBlur = isHoverNext ? 18 : 6;
  drawingContext.shadowColor = isHoverNext ? color(255, 230, 0) : color(57, 255, 20);
  fill(isHoverNext ? color(255, 230, 0) : color(57, 255, 20));
  textSize(12);
  text(`▶ CONTINUER VERS NIV 0${nextLvl}`, width / 2, btnNextY + btnNextH / 2 + 1);

  // Note de bas d'écran
  textFont('Share Tech Mono, monospace');
  drawingContext.shadowBlur = 0;
  fill(160, 210, 190, 170);
  textSize(11);
  text('Cliquez sur le bouton ou appuyez sur [ESPACE] / [ENTRÉE] pour démarrer', width / 2, boxY + boxH - 12);

  pop();
}

/**
 * Lance le niveau suivant quand le joueur valide l'écran de transition.
 */
function passerAuNiveauSuivant() {
  if (gameState !== 'WAVE_TRANSITION') return;
  demarrerNiveau(currentLevel + 1);
}

function dessinerEcranVictoire() {
  push();
  fill(0, 0, 0, 200);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  textFont('Press Start 2P, VT323, monospace');

  fill(57, 255, 20);
  textSize(22);
  textStyle(BOLD);
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = color(57, 255, 20);
  text('★ VICTOIRE TOTALE ! ★', width / 2, height / 2 - 50);

  fill(0, 240, 255);
  textFont('Share Tech Mono, VT323, monospace');
  textSize(17);
  text(`SWARM COMMANDER : LES 5 NIVEAUX DE STEERING SONT VALIDÉS`, width / 2, height / 2);

  fill(255);
  textSize(15);
  text(`SCORE FINAL : ${score} PTS  |  KILLS : ${totalKills}`, width / 2, height / 2 + 38);

  fill(255, 183, 3);
  textSize(13);
  text('APPUYEZ SUR [R] POUR RECOMMENCER LA SIMULATION', width / 2, height / 2 + 80);
  pop();
}

/**
 * Affiche l'écran de pause avec halo néon rétro LCD et bouton interactif 'CONTINUER'.
 */
function dessinerEcranPause() {
  push();
  fill(8, 14, 11, 175);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);

  const boxW = min(width - 40, 560);
  const boxH = 220;
  const boxX = width / 2 - boxW / 2;
  const boxY = height / 2 - boxH / 2;

  // Lueur néon cyan
  drawingContext.shadowBlur = 25;
  drawingContext.shadowColor = color(0, 240, 255);

  // Cadre principal
  stroke(0, 240, 255, 220);
  strokeWeight(2);
  fill(12, 24, 20, 235);
  rect(boxX, boxY, boxW, boxH, 8);

  // Coins de visée OSD caméscope en vert fluo
  const c = 20;
  stroke(57, 255, 20, 240);
  strokeWeight(2.5);
  line(boxX, boxY, boxX + c, boxY);
  line(boxX, boxY, boxX, boxY + c);
  line(boxX + boxW, boxY, boxX + boxW - c, boxY);
  line(boxX + boxW, boxY, boxX + boxW, boxY + c);
  line(boxX, boxY + boxH, boxX + c, boxY + boxH);
  line(boxX, boxY + boxH, boxX, boxY + boxH - c);
  line(boxX + boxW, boxY + boxH, boxX + boxW - c, boxY + boxH);
  line(boxX + boxW, boxY + boxH, boxX + boxW, boxY + boxH - c);

  // 1. Titre PAUSE
  noStroke();
  textFont('Press Start 2P, VT323, monospace');
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = color(0, 240, 255);
  fill(0, 240, 255);
  textSize(24);
  textStyle(BOLD);
  text('❚❚ PAUSE', width / 2, boxY + 40);

  // 2. Télémétrie d'état
  textFont('Share Tech Mono, VT323, monospace');
  drawingContext.shadowBlur = 6;
  fill(180, 220, 205, 190);
  textSize(12);
  textStyle(NORMAL);
  text(`PROTOCOLE 0${currentLevel}/05  ·  SCORE: ${String(score).padStart(6, '0')}  ·  ESSAIM: ${swarmMode}`, width / 2, boxY + 76);

  // 3. Bouton CONTINUER Interactif (Clic souris ou Raccourcis)
  const btnResumeW = min(360, boxW - 60);
  const btnResumeH = 46;
  const btnResumeX = width / 2 - btnResumeW / 2;
  const btnResumeY = boxY + 104;

  const isHoverResume = mouseX >= btnResumeX && mouseX <= btnResumeX + btnResumeW &&
                        mouseY >= btnResumeY && mouseY <= btnResumeY + btnResumeH;

  drawingContext.shadowBlur = isHoverResume ? 28 : 14;
  drawingContext.shadowColor = color(57, 255, 20);
  stroke(57, 255, 20, isHoverResume ? 255 : 200);
  strokeWeight(isHoverResume ? 2.5 : 1.8);
  fill(isHoverResume ? color(32, 95, 52, 240) : color(18, 50, 32, 210));
  rect(btnResumeX, btnResumeY, btnResumeW, btnResumeH, 6);

  // Coins rétro sur le bouton Continuer
  const bc = 10;
  stroke(255, 230, 0, isHoverResume ? 255 : 180);
  strokeWeight(2);
  line(btnResumeX, btnResumeY, btnResumeX + bc, btnResumeY);
  line(btnResumeX, btnResumeY, btnResumeX, btnResumeY + bc);
  line(btnResumeX + btnResumeW, btnResumeY, btnResumeX + btnResumeW - bc, btnResumeY);
  line(btnResumeX + btnResumeW, btnResumeY, btnResumeX + btnResumeW, btnResumeY + bc);
  line(btnResumeX, btnResumeY + btnResumeH, btnResumeX + bc, btnResumeY + btnResumeH);
  line(btnResumeX, btnResumeY + btnResumeH, btnResumeX, btnResumeY + btnResumeH - bc);
  line(btnResumeX + btnResumeW, btnResumeY + btnResumeH, btnResumeX + btnResumeW - bc, btnResumeY + btnResumeH);
  line(btnResumeX + btnResumeW, btnResumeY + btnResumeH, btnResumeX + btnResumeW, btnResumeY + btnResumeH - bc);

  // Texte du Bouton Continuer
  noStroke();
  textFont('Press Start 2P, VT323, monospace');
  drawingContext.shadowBlur = isHoverResume ? 18 : 8;
  drawingContext.shadowColor = isHoverResume ? color(255, 230, 0) : color(57, 255, 20);
  fill(isHoverResume ? color(255, 230, 0) : color(57, 255, 20));
  textSize(13);
  textStyle(BOLD);
  text('▶ CONTINUER', width / 2, btnResumeY + btnResumeH / 2 + 1);

  // 4. Instructions secondaires
  textFont('Share Tech Mono, VT323, monospace');
  drawingContext.shadowBlur = 0;
  fill(160, 210, 190, 160);
  textSize(11);
  textStyle(NORMAL);
  text('Cliquez sur le bouton ou appuyez sur [P], [Échap] ou [Espace] pour reprendre', width / 2, boxY + 180);

  pop();
}

/**
 * Affiche l'écran de Game Over arcade 'GAME OVER! LES BUGS ONT GAGNÉ !'
 * avec des couleurs rétro vives (Jaune et Rose Fluo) et typographie arcade.
 */
function dessinerEcranGameOver() {
  push();
  // Fond sombre rétro teinté pourpre/rose
  fill(12, 4, 18, 225);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);

  const boxW = min(width - 40, 580);
  const boxH = 260;
  const boxX = width / 2 - boxW / 2;
  const boxY = height / 2 - boxH / 2;

  // Lueur néon rose fluo vive (#FF007F)
  drawingContext.shadowBlur = 28;
  drawingContext.shadowColor = color(255, 0, 127);

  // Cadre principal arcade rose fluo
  stroke(255, 0, 127, 230);
  strokeWeight(3);
  fill(22, 6, 28, 235);
  rect(boxX, boxY, boxW, boxH, 8);

  // Coins de visée néon jaune vif (#FFE600)
  const c = 22;
  stroke(255, 230, 0, 240);
  strokeWeight(3);
  line(boxX, boxY, boxX + c, boxY);
  line(boxX, boxY, boxX, boxY + c);
  line(boxX + boxW, boxY, boxX + boxW - c, boxY);
  line(boxX + boxW, boxY, boxX + boxW, boxY + c);
  line(boxX, boxY + boxH, boxX + c, boxY + boxH);
  line(boxX, boxY + boxH, boxX, boxY + boxH - c);
  line(boxX + boxW, boxY + boxH, boxX + boxW - c, boxY + boxH);
  line(boxX + boxW, boxY + boxH, boxX + boxW, boxY + boxH - c);

  // 1. Titre Arcade en Jaune Vif Fluo
  textFont('Press Start 2P, VT323, monospace');
  drawingContext.shadowBlur = 24;
  drawingContext.shadowColor = color(255, 230, 0);
  fill(255, 230, 0);
  textSize(min(28, width * 0.046));
  text('GAME OVER !', width / 2, height / 2 - 68);

  // 2. Sous-titre officiel Swarm Commander
  drawingContext.shadowBlur = 18;
  drawingContext.shadowColor = color(255, 20, 147);
  fill(255, 20, 147);
  textSize(min(13.5, width * 0.024));
  text('LE COMMANDANT EST TOMBÉ', width / 2, height / 2 - 28);

  // Ligne de séparation néon bicolore
  stroke(255, 0, 127, 100);
  strokeWeight(1.5);
  line(boxX + 24, height / 2 - 10, boxX + boxW - 24, height / 2 - 10);
  noStroke();

  // 3. Télémétrie finale arcade
  drawingContext.shadowBlur = 8;
  drawingContext.shadowColor = color(0, 240, 255);
  fill(255);
  textSize(min(11, width * 0.022));
  const scoreStr = String(score).padStart(6, '0');
  text(`SCORE FINAL : ${scoreStr} PTS`, width / 2, height / 2 + 14);

  fill(0, 240, 255);
  textSize(min(10, width * 0.020));
  text(`ENNEMIS BATTUS : ${totalKills}   |   NIVEAU : 0${currentLevel} / 05`, width / 2, height / 2 + 38);

  // 4. Invite clignotante de redémarrage (alternance Jaune vif / Rose fluo)
  const clignote = sin(millis() * 0.008) > 0;
  const colBlink = clignote ? color(255, 230, 0) : color(255, 20, 147);
  drawingContext.shadowBlur = 16;
  drawingContext.shadowColor = colBlink;
  fill(colBlink);
  textSize(min(10.5, width * 0.021));
  text('>> APPUYEZ SUR [R] POUR REJOUER <<', width / 2, height / 2 + 82);

  pop();
}

/**
 * Réinitialise complètement la partie (vie à 100, score à 0, niveau 1, vider tableaux).
 */
function reinitialiserPartie() {
  score = 0;
  totalKills = 0;
  levelKills = 0;
  gameStartTime = millis();
  isPaused = false;
  gameState = 'PLAYING';
  swarmMode = 'FORMATION';

  alphaBoss = null;
  alphaBossSpawned = false;
  alphaBossDefeated = false;

  gameOverSoundPlayed = false;
  bgmIndex = 0;

  if (joueur) {
    joueur.health    = 100;
    joueur.maxHealth = 100;
  }
  demarrerNiveau(1);
  initialiserEssaimAllie();
  actualiserBoutonsPause();
}

// ========================================================
// ── DESIGN RÉTRO LCD : drawHUD() (Caméra Vintage 2000s) ─
// ========================================================

function drawHUD() {
  push();

  // Scanlines très légères sur tout l'écran
  stroke(0, 10, 5, 22);
  strokeWeight(1);
  for (let y = 0; y < height; y += 3) {
    line(0, y, width, y);
  }

  // Déchirures horizontales lors du glitch de collision
  if (screenGlitchTimer > 0) {
    stroke(0, 240, 255, 130);
    strokeWeight(2);
    const tearY = random(height);
    line(0, tearY, width, tearY);
    stroke(255, 40, 60, 130);
    line(0, tearY + 4, width, tearY + 4);
  }

  // Bordures légèrement grisées & Coins LCD [  ]
  noFill();
  stroke(160, 185, 170, 45);
  strokeWeight(1.5);
  rect(16, 16, width - 32, height - 32);

  const cLen = 22;
  stroke(190, 225, 205, 100);
  strokeWeight(2);
  line(16, 16, 16 + cLen, 16);
  line(16, 16, 16, 16 + cLen);
  line(width - 16, 16, width - 16 - cLen, 16);
  line(width - 16, 16, width - 16, 16 + cLen);
  line(16, height - 16, 16 + cLen, height - 16);
  line(16, height - 16, 16, height - 16 - cLen);
  line(width - 16, height - 16, width - 16 - cLen, height - 16);
  line(width - 16, height - 16, width - 16, height - 16 - cLen);

  const margeR = (!sidebarCollapsed && width > 700) ? 375 : 45;

  // Point Rouge Clignotant 'REC' ou 'PAUSE'
  const recX = width - margeR - 100;
  const recY = 32;
  const isRecOn = floor(millis() / 500) % 2 === 0;

  if (isPaused) {
    noStroke();
    fill(255, 183, 3);
    circle(recX, recY, 10);
    fill(255, 183, 3);
    textFont('Share Tech Mono, Courier New, monospace');
    textSize(14);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text('PAUSE', recX + 13, recY);
  } else if (isRecOn) {
    noStroke();
    fill(255, 30, 45);
    circle(recX, recY, 11);
    stroke(255, 30, 45, 120);
    strokeWeight(2);
    noFill();
    circle(recX, recY, 17);
    fill(255);
    noStroke();
    textFont('Share Tech Mono, Courier New, monospace');
    textSize(14);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text('REC', recX + 13, recY);
  } else {
    noStroke();
    fill(85, 15, 20);
    circle(recX, recY, 9);
    fill(255, 255, 255, 130);
    noStroke();
    textFont('Share Tech Mono, Courier New, monospace');
    textSize(14);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text('REC', recX + 13, recY);
  }

  // Score affiché dans le bloc 'REC' avec objectif du palier
  const scoreStr = String(score).padStart(6, '0');
  const targetStr = String(levelThresholds[currentLevel] || 40000).padStart(6, '0');
  fill(isRecOn ? color(255, 235, 60) : color(220, 245, 225));
  textSize(14);
  textStyle(BOLD);
  text(`SCORE: ${scoreStr} / ${targetStr}`, recX + 64, recY);

  // Télémétrie secondaire Kills, Niveau & PV Joueur
  fill(180, 220, 205, 180);
  textSize(10.5);
  textStyle(NORMAL);
  const pvJoueur = joueur ? Math.max(0, Math.round(joueur.health)) : 100;
  const quota = levelKillQuotas[currentLevel] || 20;
  text(`PV: ${pvJoueur}/100 · VAGUE 0${currentLevel}/05 · KILLS: ${levelKills}/${quota}`, recX + 64, recY + 16);

  // Icône de Batterie LCD en Bas à Droite
  const battX = width - margeR - 15;
  const battY = height - 36;
  const battW = 34;
  const battH = 16;

  stroke(220, 240, 230, 200);
  strokeWeight(1.8);
  noFill();
  rect(battX, battY, battW, battH, 2);

  noStroke();
  fill(220, 240, 230, 200);
  rect(battX + battW + 1, battY + 4, 3, 8, 1);

  // 3 barres internes vertes
  fill(57, 255, 20, 210);
  rect(battX + 3, battY + 3, 7, 10, 1);
  rect(battX + 13, battY + 3, 7, 10, 1);
  rect(battX + 23, battY + 3, 7, 10, 1);

  fill(180, 220, 205, 180);
  textSize(10);
  textAlign(RIGHT, CENTER);
  text('BATT', battX - 8, battY + 8);

  // OSD d'Appareil Photo Vintage & Objectifs Actifs
  fill(200, 235, 215, 175);
  textAlign(LEFT, TOP);
  textSize(11.5);
  textStyle(BOLD);
  text(`📷 SWARM COMMANDER // NIVEAU 0${currentLevel} [COMMANDANT] · ESSAIM: ${swarmMode}`, 28, 26);

  fill(160, 205, 185, 140);
  textSize(10);
  textStyle(NORMAL);

  let statutBoss = '';
  if (alphaBoss && ennemis.includes(alphaBoss)) {
    statutBoss = `⚠️ BUG ALPHA ACTIF (${Math.max(0, Math.ceil(alphaBoss.health))} HP) !`;
  } else if (alphaBossDefeated) {
    statutBoss = `BUG ALPHA : NEUTRALISÉ ✓`;
  } else {
    const restant = Math.max(0, Math.round(quota * 0.7) - levelKills);
    statutBoss = restant > 0 ? `BUG ALPHA : DANS ${restant} KILLS` : `BUG ALPHA : EN APPROCHE...`;
  }

  text(`OBJECTIF : KILLS ${levelKills}/${quota} · SCORE ${scoreStr}/${targetStr} · ${statutBoss}`, 28, 42);

  // Alerte centrale clignotante quand le Boss Alpha est en chasse
  if (alphaBoss && ennemis.includes(alphaBoss)) {
    push();
    const flash = floor(millis() / 250) % 2 === 0;
    fill(flash ? color(255, 30, 60, 240) : color(255, 230, 0, 240));
    noStroke();
    textFont('Press Start 2P, monospace');
    textSize(10);
    textAlign(CENTER, TOP);
    text('⚠️ ALERTE : BUG ALPHA DÉTECTÉ // CIBLE PRIORITAIRE ⚠️', width / 2, 28);
    pop();
  }

  // Indicateur État Onde EMP & Ordres de l'Essaim
  fill(ondeEMP.active ? color(0, 240, 255) : color(180, 220, 200, 160));
  textAlign(LEFT, BOTTOM);
  textSize(10.5);
  const empTexte = ondeEMP.active
    ? `[ESPACE] ONDE EMP ACTIVE (${Math.round((ondeEMP.timer / ondeEMP.dureeMax) * 100)}%) — FORCES FLEE EN COURS`
    : `[ESPACE] ONDE EMP PRÊTE | [F] FORMATION | [A] ATTAQUE | [P] PAUSE / CONTINUER`;
  text(empTexte, 28, height - 26);

  pop();
}

// ========================================================
// ── CONTRÔLE DE PAUSE & REPRISE (PAUSE / CONTINUER) ─────
// ========================================================

/**
 * Bascule l'état de pause du jeu ou force un état spécifique (true = pause, false = reprendre).
 * Met à jour dynamiquement les boutons du HUD supérieur, du sidebar et du canvas.
 * @param {boolean|null} forceState
 */
function basculerPause(forceState = null) {
  if (gameState === 'GAME_OVER') return;

  if (forceState !== null) {
    isPaused = Boolean(forceState);
  } else {
    isPaused = !isPaused;
  }

  actualiserBoutonsPause();
}
window.basculerPause = basculerPause;

/**
 * Met à jour le style visuel et le texte de tous les boutons Pause/Continuer (Header & Sidebar).
 */
function actualiserBoutonsPause() {
  const btnHeader = document.getElementById('btn-pause-header');
  const btnSidebar = document.getElementById('btn-pause-sidebar');

  if (btnHeader) {
    if (isPaused) {
      btnHeader.className = 'hud-pause-btn state-paused';
      btnHeader.innerHTML = '<span class="pause-btn-icon">▶</span><span class="pause-btn-text">CONTINUER</span>';
      btnHeader.setAttribute('title', 'Reprendre la partie [P] / [Échap] / [Espace]');
    } else {
      btnHeader.className = 'hud-pause-btn state-running';
      btnHeader.innerHTML = '<span class="pause-btn-icon">❚❚</span><span class="pause-btn-text">PAUSE</span>';
      btnHeader.setAttribute('title', 'Mettre en pause la simulation [P] / [Échap]');
    }
  }

  if (btnSidebar) {
    if (isPaused) {
      btnSidebar.className = 'sidebar-pause-btn state-paused';
      btnSidebar.innerHTML = `
        <span class="sidebar-pause-icon">▶</span>
        <span class="sidebar-pause-label">CONTINUER</span>
        <span class="sidebar-pause-sub">REPRENDRE LA PARTIE</span>
      `;
      btnSidebar.setAttribute('title', 'Reprendre la simulation [P] ou Clic');
    } else {
      btnSidebar.className = 'sidebar-pause-btn state-running';
      btnSidebar.innerHTML = `
        <span class="sidebar-pause-icon">❚❚</span>
        <span class="sidebar-pause-label">PAUSE</span>
        <span class="sidebar-pause-sub">[P] / [ÉCHAP]</span>
      `;
      btnSidebar.setAttribute('title', 'Suspendre la simulation [P] ou Clic');
    }
  }
}
window.actualiserBoutonsPause = actualiserBoutonsPause;

// ========================================================
// ── SYSTÈME AUDIO PROCÉDURAL RETRO-ARCADE (Web Audio API)
// ========================================================

// Gamme d'arpèges synthwave en Ré mineur
const bgmArpegesFreq = [
  73.42, 110.0, 146.83, 174.61, 220.0, 146.83, 174.61, 164.81, // D2, A2, D3, F3, A3, D3, F3, E3
  73.42, 87.31, 110.0, 146.83, 116.54, 146.83, 174.61, 220.0,  // D2, F2, A2, D3, Bb2, D3, F3, A3
  65.41, 98.0, 130.81, 164.81, 196.0, 130.81, 164.81, 146.83,  // C2, G2, C3, E3, G3, C3, E3, D3
  55.0, 82.41, 110.0, 138.59, 164.81, 110.0, 138.59, 164.81   // A1, E2, A2, C#3, E3, A2, C#3, E3
];

let globalAudioCtx = null;

function obtenirAudioContext() {
  if (!globalAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      globalAudioCtx = new AudioCtx();
    }
  }
  return globalAudioCtx;
}

function garantirAudioDemarre() {
  const ctx = obtenirAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

// Déverrouillage automatique au premier geste utilisateur sur la page
if (typeof window !== 'undefined') {
  ['click', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, () => garantirAudioDemarre(), { passive: true });
  });
}

/**
 * 1. Musique de Fond (BGM) : séquenceur d'arpèges rétro synthwave
 * Joue des double-croches en Ré mineur et se suspend automatiquement en pause.
 */
function mettreAJourBGM() {
  if (!audioActif || isPaused || gameState !== 'PLAYING') return;
  if (frameCount % bgmTempoFrames !== 0) return;

  const ctx = obtenirAudioContext();
  if (!ctx || ctx.state !== 'running') return;

  const freq = bgmArpegesFreq[bgmIndex];
  bgmIndex = (bgmIndex + 1) % bgmArpegesFreq.length;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  } catch (e) {}
}

/**
 * 2. Son de Tir (Missiles) : "Pew Pew" laser avec chute de fréquence rapide
 */
function playShootSound() {
  if (!audioActif) return;
  const ctx = obtenirAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(960, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);

    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {}
}

/**
 * 3. Son de Mort / Explosion (Glitch) : Bruit blanc percussif
 */
function playExplosionSound(isCritical = false) {
  if (!audioActif) return;
  const ctx = obtenirAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  try {
    const dur = isCritical ? 0.32 : 0.14;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = isCritical ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(isCritical ? 500 : 1200, ctx.currentTime);

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(isCritical ? 0.45 : 0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
  } catch (e) {}
}

/**
 * 4. Son d'Ordre UI : Bip numérique net (Formation / Attaque)
 */
function playOrderSound(mode = 'FORMATION') {
  if (!audioActif) return;
  const ctx = obtenirAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';

    const freq = (mode === 'ATTACK') ? 1200 : 880;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.055);
  } catch (e) {}
}

/**
 * 5. Son de Game Over : Descente lugubre
 */
function playGameOverSound() {
  if (!audioActif || gameOverSoundPlayed) return;
  gameOverSoundPlayed = true;

  const ctx = obtenirAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 1.4);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.4);
  } catch (e) {}
}

/**
 * Bascule générale Son Activé / Désactivé [M]
 */
function basculerAudio() {
  audioActif = !audioActif;
  const icon = document.getElementById('audio-icon');
  const text = document.getElementById('audio-text');
  const btn = document.getElementById('btn-audio-header');

  if (icon) icon.textContent = audioActif ? '🔊' : '🔇';
  if (text) text.textContent = audioActif ? 'SON' : 'MUET';
  if (btn) btn.classList.toggle('audio-muted', !audioActif);

  if (audioActif) {
    garantirAudioDemarre();
  }
}

window.basculerAudio = basculerAudio;
window.playShootSound = playShootSound;
window.playExplosionSound = playExplosionSound;
window.playOrderSound = playOrderSound;
window.playGameOverSound = playGameOverSound;
window.demarrerNiveau = demarrerNiveau;
window.reinitialiserPartie = reinitialiserPartie;

// ========================================================
// ── INTERACTION SOURIS & CLAVIER ────────────────────────
// ========================================================

function mousePressed() {
  // Déverrouillage audio au premier clic utilisateur (Autoplay Policy Navigateurs)
  garantirAudioDemarre();

  // 1. Écran de Transition entre Vagues : validation par clic sur le bouton "LANCER LE NIVEAU"
  if (gameState === 'WAVE_TRANSITION') {
    const boxW = min(width - 40, 680);
    const boxH = 410;
    const boxY = height / 2 - boxH / 2;
    const btnNextW = min(420, boxW - 80);
    const btnNextH = 48;
    const btnNextX = width / 2 - btnNextW / 2;
    const btnNextY = boxY + boxH - 74;

    if (mouseX >= btnNextX && mouseX <= btnNextX + btnNextW &&
        mouseY >= btnNextY && mouseY <= btnNextY + btnNextH) {
      passerAuNiveauSuivant();
    }
    return;
  }

  // 2. Écran de Game Over ou de Victoire Finale : seuls les boutons dédiés réagissent
  if (gameState === 'GAME_OVER' || gameState === 'VICTORY') return;

  // 3. Si le jeu est en PAUSE : vérifier UNIQUEMENT le clic sur le bouton interactif [ ▶ CONTINUER ]
  if (isPaused) {
    const boxW = min(width - 40, 560);
    const boxH = 220;
    const boxY = height / 2 - boxH / 2;
    const btnResumeW = min(360, boxW - 60);
    const btnResumeH = 46;
    const btnResumeX = width / 2 - btnResumeW / 2;
    const btnResumeY = boxY + 104;

    if (mouseX >= btnResumeX && mouseX <= btnResumeX + btnResumeW &&
        mouseY >= btnResumeY && mouseY <= btnResumeY + btnResumeH) {
      basculerPause(false);
    }
    return;
  }

  if (mouseY < 55) return;
  if (!sidebarCollapsed && mouseX > width - 360) return;

  // Clic Gauche : Salve de Missiles (Pursue)
  if (mouseButton === LEFT) {
    tirerMissiles();
  }

  // Clic Droit : Action selon le niveau
  if (mouseButton === RIGHT) {
    if (currentLevel === 2) {
      poserLeurre();
    } else {
      const rObs = random(32, 55);
      const nouvelObs = new Obstacle(mouseX, mouseY, rObs);
      nouvelObs.impactTimer = 16;
      obstacles.push(nouvelObs);
      creerExplosion(mouseX, mouseY, color(255, 184, 0));
    }
  }
}

function keyPressed() {
  // Déverrouillage audio au premier appui touche (Autoplay Policy Navigateurs)
  garantirAudioDemarre();

  // ── Interrupteur Audio Rétro [M] (Mute / Unmute) ──────────
  if (key === 'm' || key === 'M') {
    basculerAudio();
    return;
  }

  // ── 0. Écran de Transition entre Vagues : validation par Espace ou Entrée ──
  if (gameState === 'WAVE_TRANSITION') {
    if (key === ' ' || keyCode === ENTER || key === 'Enter') {
      passerAuNiveauSuivant();
    }
    return;
  }

  // ── 1. Écran de Game Over / Victoire : seule la touche 'R' redémarre la simulation ──
  if (gameState === 'GAME_OVER' || gameState === 'VICTORY') {
    if (key === 'r' || key === 'R') {
      reinitialiserPartie();
    }
    return;
  }

  // ── 2. Système de Pause / Reprise (Touche 'P' ou 'Escape') ─
  if (key === 'p' || key === 'P' || key === 'Escape' || keyCode === ESCAPE) {
    basculerPause();
    return;
  }

  // Si le jeu est en pause, autoriser aussi Espace ou Entrée pour continuer
  if (isPaused) {
    if (key === ' ' || keyCode === ENTER || key === 'Enter') {
      basculerPause(false);
      return;
    }
    if (key === 'r' || key === 'R') {
      basculerPause(false);
      reinitialiserPartie();
    }
    return;
  }

  // Touche R : Redémarrer la partie
  if (key === 'r' || key === 'R') {
    reinitialiserPartie();
    return;
  }

  // ── 3. Ordres de l'Essaim Allié : [F] Formation / [A] Attaque ──
  if (key === 'f' || key === 'F') {
    basculerModeEssaim('FORMATION');
    return;
  }
  if (key === 'a' || key === 'A') {
    basculerModeEssaim('ATTACK');
    return;
  }

  // Déclenchement de l'Onde de Choc EMP avec ESPACE (Force Flee)
  if (key === ' ' && !ondeEMP.active) {
    declencherOndeEMP();
  }

  // Tir alternatif au clavier
  if (key === 'e' || key === 'E') {
    tirerMissiles();
  }

  // Touches 1 à 5 : Accès direct aux Niveaux
  if (key >= '1' && key <= '5') {
    demarrerNiveau(Number(key));
  }

  // Touche D : Bascule Mode Debug
  if (key === 'd' || key === 'D') {
    debugMode = !debugMode;
    Vehicle.debug = debugMode;
    const btn = document.getElementById('btn-debug');
    if (btn) btn.classList.toggle('active', debugMode);
  }
}

// ========================================================
// ── EFFETS VISUELS & PARTICULES ─────────────────────────
// ========================================================

class ParticuleRetro {
  constructor(x, y, col) {
    this.pos      = createVector(x, y);
    this.vel      = p5.Vector.random2D().mult(random(2, 6));
    this.couleur  = col;
    this.lifeSpan = random(16, 28);
    this.maxLife  = this.lifeSpan;
    this.taille   = random(3, 6);
  }

  update() {
    this.pos.add(this.vel);
    this.vel.mult(0.94);
    this.lifeSpan--;
  }

  show() {
    push();
    const alphaVal = map(this.lifeSpan, 0, this.maxLife, 0, 255);
    stroke(red(this.couleur), green(this.couleur), blue(this.couleur), alphaVal);
    strokeWeight(1.5);
    noFill();
    line(this.pos.x - this.taille, this.pos.y, this.pos.x + this.taille, this.pos.y);
    line(this.pos.x, this.pos.y - this.taille, this.pos.x, this.pos.y + this.taille);
    pop();
  }

  isDead() {
    return this.lifeSpan <= 0;
  }
}

function creerExplosion(x, y, col) {
  for (let i = 0; i < 10; i++) {
    particles.push(new ParticuleRetro(x, y, col));
  }
}

function mettreAJourParticules() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.isDead()) particles.splice(i, 1);
  }
}

function declencherScreenGlitch(duree = 14) {
  screenGlitchTimer = duree;
}

function dessinerGrilleLCD() {
  push();
  stroke(120, 160, 140, 14);
  strokeWeight(1);
  const pas = 64;
  for (let x = 0; x < width; x += pas)  line(x, 0, x, height);
  for (let y = 0; y < height; y += pas) line(0, y, width, y);
  pop();
}

function dessinerMireCurseur(pos) {
  const t = millis() * 0.003;
  const pulse = sin(t) * 3;
  push();
  translate(pos.x, pos.y);
  noFill();
  stroke(57, 255, 20, 140);
  strokeWeight(1.2);
  circle(0, 0, 22 + pulse);
  line(-14, 0, -6, 0);
  line(6, 0, 14, 0);
  line(0, -14, 0, -6);
  line(0, 6, 0, 14);
  pop();
}

// ========================================================
// ── TÉLÉMÉTRIE HEADER & DASHBOARD CYBER ─────────────────
// ========================================================

function actualiserHUDHeader() {
  const elLevel = document.getElementById('hud-level-val');
  const elEnemies = document.getElementById('hud-enemies-count');
  const elScore = document.getElementById('hud-score-val');
  const elPlayer = document.getElementById('hud-player-status');
  const elSwarm = document.getElementById('hud-swarm-mode');
  const dotSwarm = document.getElementById('dot-swarm-mode');
  const elFps = document.getElementById('tele-fps');
  const elTime = document.getElementById('tele-time');

  if (elLevel) elLevel.textContent = `0${currentLevel} / 05`;
  if (elEnemies) elEnemies.textContent = `${ennemis.length} ENNEMIS`;
  if (elPlayer) {
    const pv = joueur ? Math.max(0, Math.round(joueur.health)) : 100;
    elPlayer.textContent = `${pv} / 100 PV`;
  }
  if (elScore) {
    const palier = levelThresholds[currentLevel] || 40000;
    elScore.textContent = `${String(score).padStart(6, '0')} / ${String(palier).padStart(6, '0')}`;
  }
  if (elSwarm) {
    elSwarm.textContent = (swarmMode === 'FORMATION') ? '[F] FORMATION' : '[A] ATTAQUE';
  }
  if (dotSwarm) {
    dotSwarm.style.background = (swarmMode === 'FORMATION') ? 'var(--lcd-cyan)' : 'var(--lcd-pink)';
  }
  if (elFps) elFps.textContent = Math.round(frameRate());

  if (elTime) {
    const secTotal = Math.floor((millis() - gameStartTime) / 1000);
    const m = String(Math.floor(secTotal / 60)).padStart(2, '0');
    const s = String(secTotal % 60).padStart(2, '0');
    elTime.textContent = `${m}:${s}`;
  }
}

function synchroniserParametres() {
  if (joueur) {
    joueur.maxSpeed = params.playerSpeed;
    joueur.maxForce = params.playerForce;
    joueur.behaviorManager.setWeight('obstacleAvoidance', params.avoidWeight);
  }

  for (const e of ennemis) {
    if (e.role === 'virus') {
      e.behaviorManager.setWeight('wander', params.hunterWanderWeight);
      e.behaviorManager.setWeight('seek',   params.hunterPursueWeight);
    } else if (e.role === 'traqueur') {
      e.maxSpeed = params.hunterSpeed * 1.15;
      e.behaviorManager.setWeight('pursue', params.hunterPursueWeight);
    } else if (e.role === 'patroller') {
      e.behaviorManager.setWeight('obstacleAvoidance', params.avoidWeight);
    } else if (e.role === 'boid') {
      e.behaviorManager.setWeight('separation',        params.swarmSepWeight);
      e.behaviorManager.setWeight('alignment',         params.swarmAlignWeight);
      e.behaviorManager.setWeight('cohesion',          params.swarmCohWeight);
      e.behaviorManager.setWeight('seek',              params.swarmSeekWeight);
      e.behaviorManager.setWeight('obstacleAvoidance', params.avoidWeight);
    }
  }
}

function initialiserDashboard() {
  lierCurseur('slider-player-speed', 'val-player-speed', v => params.playerSpeed = v, 1);
  lierCurseur('slider-player-force', 'val-player-force', v => params.playerForce = v, 2);

  lierCurseur('slider-hunter-pursue', 'val-hunter-pursue', v => params.hunterPursueWeight = v, 1);
  lierCurseur('slider-hunter-wander', 'val-hunter-wander', v => params.hunterWanderWeight = v, 1);
  lierCurseur('slider-hunter-speed',  'val-hunter-speed',  v => params.hunterSpeed = v, 1);

  lierCurseur('slider-swarm-sep',      'val-swarm-sep',      v => params.swarmSepWeight = v, 1);
  lierCurseur('slider-swarm-align',    'val-swarm-align',    v => params.swarmAlignWeight = v, 1);
  lierCurseur('slider-swarm-cohesion', 'val-swarm-cohesion', v => params.swarmCohWeight = v, 1);

  lierCurseur('slider-avoid-weight', 'val-avoid-weight', v => params.avoidWeight = v, 1);

  const btnEmp = document.getElementById('btn-trigger-emp');
  if (btnEmp) {
    btnEmp.addEventListener('click', () => declencherOndeEMP());
  }

  const btnEnemy = document.getElementById('btn-spawn-enemy');
  if (btnEnemy) {
    btnEnemy.addEventListener('click', () => {
      const e = spawnEnnemiEnBordure();
      if (currentLevel === 1) {
        e.role = 'virus';
        e.behaviorManager.add('wander', params.hunterWanderWeight).add('seek', 1.2);
      } else if (currentLevel === 2) {
        e.role = 'traqueur';
        e.behaviorManager.add('pursue', params.hunterPursueWeight);
      } else if (currentLevel === 3) {
        e.role = 'patroller';
        e.behaviorManager.add('pathfollowing', 2.0).add('obstacleAvoidance', params.avoidWeight);
      } else if (currentLevel === 4) {
        e.role = 'boid';
        e.behaviorManager.add('separation', params.swarmSepWeight)
          .add('alignment', params.swarmAlignWeight)
          .add('cohesion', params.swarmCohWeight)
          .add('seek', params.swarmSeekWeight);
      } else {
        e.role = 'genetic';
        e.hasHealth = true;
        e.behaviorManager.add('wander', 0.85);
      }
      ennemis.push(e);
    });
  }

  const btnDecoy = document.getElementById('btn-spawn-decoy');
  if (btnDecoy) {
    btnDecoy.addEventListener('click', () => poserLeurre());
  }

  const btnObs = document.getElementById('btn-spawn-obs');
  if (btnObs) {
    btnObs.addEventListener('click', () => {
      obstacles.push(new Obstacle(random(80, width - 80), random(80, height - 80), random(32, 60)));
    });
  }

  const btnDebug = document.getElementById('btn-debug');
  if (btnDebug) {
    btnDebug.addEventListener('click', () => {
      debugMode = !debugMode;
      Vehicle.debug = debugMode;
      btnDebug.classList.toggle('active', debugMode);
    });
  }

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => reinitialiserPartie());
  }

  // ── Contrôles Pause / Continuer & Audio (Header & Sidebar) ───
  const btnAudioHeader = document.getElementById('btn-audio-header');
  if (btnAudioHeader) {
    btnAudioHeader.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      garantirAudioDemarre();
      basculerAudio();
    });
  }

  const btnPauseHeader = document.getElementById('btn-pause-header');
  if (btnPauseHeader) {
    btnPauseHeader.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      basculerPause();
    });
  }

  const btnPauseSidebar = document.getElementById('btn-pause-sidebar');
  if (btnPauseSidebar) {
    btnPauseSidebar.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      basculerPause();
    });
  }

  actualiserBoutonsPause();

  const btnSwarmForm = document.getElementById('btn-swarm-formation');
  if (btnSwarmForm) {
    btnSwarmForm.addEventListener('click', () => basculerModeEssaim('FORMATION'));
  }

  const btnSwarmAtk = document.getElementById('btn-swarm-attack');
  if (btnSwarmAtk) {
    btnSwarmAtk.addEventListener('click', () => basculerModeEssaim('ATTACK'));
  }

  const sidebar = document.getElementById('cyber-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebarCollapsed = !sidebarCollapsed;
      sidebar.classList.toggle('collapsed', sidebarCollapsed);
      toggleBtn.textContent = sidebarCollapsed ? '▶' : '◀';
    });
  }
}

function lierCurseur(sliderId, valueId, callback, decimals = 1, suffix = '') {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(valueId);
  if (!slider || !display) return;

  const update = () => {
    const val = parseFloat(slider.value);
    callback(val);
    display.textContent = val.toFixed(decimals) + suffix;
  };
  slider.addEventListener('input', update);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (chemin && (currentLevel === 3 || currentLevel === 5)) {
    chemin.genererCircuit(width / 2, height / 2, width * 0.35, height * 0.32, 14);
  }
}
