# 🎮 SWARM COMMANDER // Tactical Wave-Based Survival Game

> **Projet d'Intelligence Artificielle & Steering Behaviors (Master IA2)**  
> Jeu de survie tactique piloté **exclusivement par les 8 algorithmes de Steering Behaviors** (Craig Reynolds).  
> Esthétique **Interface Rétro-Numérique Caméscope LCD Vintage** (inspirée du Sanyo Xacti VPC-S6).

---

## 🚀 Accès Rapide / Déploiement

Ce projet est 100% autonome et déployé publiquement.  
**Jouer en ligne directement :** [https://zakariaelachab2004-byte.github.io/Swarm-commander/](https://zakariaelachab2004-byte.github.io/Swarm-commander/)

Pour tester en local : Ouvrez simplement `index.html` avec Live Server dans VS Code.

---

## 📁 Arborescence Complète

Projet_Final_Steering/
├── index.html                 ← Interface OSD vintage & dashboard temps réel
├── style.css                  ← Thème écran LCD vintage (Sanyo Xacti VPC-S6)
├── README.md                  ← Guide de jeu, progression et justification technique
├── libraries/
│   ├── p5.min.js              ← Bibliothèque graphique
│   └── p5.sound.min.js        ← Génération audio procédurale (oscillateurs/bruit)
└── src/
    ├── BehaviorManager.js     ← Gestionnaire de pondération dynamique des 8 algorithmes
    ├── Obstacle.js            ← Mires optiques statiques et détection d'impacts
    ├── Path.js                ← Classe de chemin vectoriel (Dossier 5)
    ├── Vehicle.js             ← Entités, Essaim Allié, Ennemis, ADN & Traînée LCD
    └── sketch.js              ← Boucle de jeu, audio procédural, collisions & HUD

---

## 🕹️ Contrôles du Commandant (Joueur)

| Action | Commande | Algorithme & Effet en Jeu |
| :--- | :--- | :--- |
| **Déplacement du Boss** | `Mouvement Souris` | Le Noyau Commandant suit la souris en douceur avec **`Arrive`** + évite les obstacles. |
| **Ordre : FORMATION** | `Touche [F]` | L'essaim bleu allié passe en **Suivi de Leader** : ils se placent derrière le joueur (`Arrive`) en gardant leurs distances (`Separation`). |
| **Ordre : ATTAQUE** | `Touche [A]` | Le `BehaviorManager` de l'essaim annule l'attraction au joueur et active **`Pursue`** (avec force maximale) vers l'ennemi le plus proche. |
| **Tir de Missiles** | `Clic Gauche` | Tir de projectiles autonomes guidés avec **`Pursue`** (anticipation de la cible) + **`ObstacleAvoidance`**. |
| **Pose d'Obstacle** | `Clic Droit` | Place une mire optique statique forçant les ennemis à recalculer leur évitement. |
| **Onde de Choc EMP** | `Touche [ESPACE]` | Déclenche une onde forçant tous les ennemis à activer **`Flee`** en panique. |
| **Pause / Reprise** | `Touche [P] ou [ÉCHAP]` | Suspend immédiatement la physique du jeu, la musique et l'évolution génétique. |

---

## 🌊 Les 5 Vagues de Survie (Démonstration des Algorithmes)

Le jeu valide **strictement les 8 dossiers de comportements** étudiés en cours :

### 🔹 Niveau 1 : L'Infection Basique
- **Comportements** : Combinaison simultanée de **`Wander`** (errance aléatoire fluide sur cercle de Reynolds) et **`Seek`** (attraction continue vers le joueur).

### 🔹 Niveau 2 : Traqueurs & Anticipation
- **Comportements** : **`Pursue`** avec anticipation vectorielle de la trajectoire future du joueur.
- **Contre-mesure active** : Déploiement de leurres utilisant **`Evade`** face aux Traqueurs pour les éloigner du Commandant.

### 🔹 Niveau 3 : Pare-feu & Patrouilles
- **Comportements** : Des patrouilleurs ennemis utilisent **`PathFollowing`** (projection scalaire) pour suivre un circuit vectoriel (`Path`). Tous les véhicules activent **`ObstacleAvoidance`** (raycast `ahead`) pour esquiver les pare-feu statiques générés sur la carte.

### 🔹 Niveau 4 : L'Essaim Ennemi (Boids)
- **Comportements** : Déploiement massif appliquant les 3 règles du **`Flocking`** (Séparation, Alignement, Cohésion) + un léger **`Seek`** vers le joueur, créant un mouvement organique complexe.

### 🔹 Niveau 5 (Final) : Écosystème Évolutif & Mutation Génétique
- **Comportements (Dossier 8)** : Des particules de Nourriture (vertes) et de Poison (rouges) apparaissent. Les virus possèdent un **ADN** (poids d'attraction/répulsion et rayons de perception). Ils se reproduisent par clonage avec mutation, meurent s'ils sont empoisonnés, et utilisent **`Wander`** pour explorer. L'évolution se fait en temps réel !

---

## 🧠 MON EXPÉRIENCE TECHNIQUE (Architecture & Choix)

Afin de répondre aux exigences du cahier des charges, j'ai pris la décision de ne pas rendre 8 dossiers séparés, mais de fusionner l'intégralité des concepts mathématiques de Craig Reynolds au sein d'une seule architecture applicative orientée objet.

**Le `BehaviorManager` :** 
Le cœur de mon architecture réside dans la classe `BehaviorManager`. Plutôt que de coder des comportements "en dur" dans la boucle principale, ce manager permet d'attribuer dynamiquement des pondérations à plusieurs forces simultanément pour une même entité. Par exemple, un drone allié en mode "Attaque" combine `Pursue` (poids fort), `ObstacleAvoidance` (poids critique pour la survie) et `Separation` (poids moyen pour ne pas s'écraser avec ses alliés). 

**Gameplay Émergent :**
Grâce à ce système de pondération dynamique et au basculement d'états (Touches F et A), j'ai pu créer une mécanique de **Suivi de Leader** interactive. Les algorithmes d'IA ne servent plus seulement à faire des démonstrations visuelles isolées, ils deviennent les règles physiques tangibles d'un véritable jeu de stratégie en temps réel, garantissant qu'aucune IA "hors-programme" n'est utilisée pour la navigation.

**Audio Procédural :**
L'ambiance sonore du jeu ne repose sur aucun fichier audio (MP3/WAV) externe. J'ai utilisé la bibliothèque `p5.sound` pour synthétiser les effets audio procéduralement à l'aide d'oscillateurs (`p5.Oscillator`), d'enveloppes et de générateurs de bruit blanc (`p5.Noise`), renforçant l'aspect "programme informatique autonome" de ce projet.

---

## 🎨 Rendu Caméscope Rétro LCD (Années 2000)

- **HUD Viseur Caméra** : Point rouge clignotant **`● REC`**, score sur 6 chiffres, jauge de vie à barres.
- **Focus AF** : Design de "Soucoupe Volante Antivirus" pour le Commandant, s'inclinant dynamiquement selon son vecteur vitesse.
- **Rémanence LCD** : Traînée vectorielle des positions précédentes avec atténuation d'opacité.
- **Aberration Chromatique Glitch** : Séparation dynamique des canaux RGB lors des chocs, explosions et ondes de choc EMP.
