# 🎮 GLITCH PROTOCOL // Wave-Based Survival Game

> **Projet d'Intelligence Artificielle & Steering Behaviors**  
> Jeu de survie par vagues successives piloté **exclusivement par les 8 algorithmes de Steering Behaviors** (Craig Reynolds).  
> Esthétique **Interface Rétro-Numérique Caméscope LCD Vintage** (inspirée du Sanyo Xacti VPC-S6 des années 2000).

---

## 🚀 Déploiement Direct sur GitHub Pages

Ce projet est **100% autonome et prêt à être déployé** sans installation requise :
1. Créez un dépôt GitHub (ex: `glitch-protocol`).
2. Poussez le contenu de ce dossier (`Projet_Final_Steering`) sur votre branche `main`.
3. Rendez-vous dans **Settings** > **Pages** de votre dépôt GitHub.
4. Dans **Branch**, sélectionnez `main` et le dossier `/(root)`, puis cliquez sur **Save**.
5. Votre jeu est en ligne instantanément sur `https://<votre-pseudo>.github.io/<nom-du-repo>/` !

Pour tester en local :
- Ouvrez simplement [`index.html`](file:///C:/Users/fin%20tic/OneDrive/Desktop/steering/Projet_Final_Steering/index.html) dans un navigateur web ou utilisez **Live Server** dans VS Code.

---

## 📁 Arborescence Complète

```text
Projet_Final_Steering/
├── index.html                   ← Interface OSD vintage & dashboard temps réel
├── style.css                    ← Thème écran LCD vintage (Sanyo Xacti VPC-S6)
├── README.md                    ← Guide de jeu et progression par niveaux
├── libraries/
│   └── p5.min.js                ← Bibliothèque p5.js (avec fallback CDN automatique)
└── src/
    ├── BehaviorManager.js       ← Gestionnaire & Bibliothèque des 8 algorithmes mathématiques
    ├── Obstacle.js              ← Mires optiques statiques et détection d'impacts
    ├── Path.js                  ← Classe de chemin vectoriel (Dossier 5 : PathFollowing)
    ├── Vehicle.js               ← Véhicules autonomes, Missiles, Leurres, ADN & Traînée LCD
    └── sketch.js                ← Boucle de jeu par vagues, onde EMP, collisions & HUD
```

---

## 🕹️ Contrôles du Jeu

| Action | Commande | Algorithme & Effet en Jeu |
| :--- | :--- | :--- |
| **Déplacement du Joueur** | `Mouvement Souris` | La **Soucoupe Volante Antivirus** (orientée selon son vecteur vitesse) suit la souris avec **`Arrive`** + évite les obstacles. |
| **Tir de Missiles** | `Clic Gauche` (ou touche `[E]`) | Salve de missiles supersoniques guidés avec **`Pursue`** (verrouillage de la cible la plus proche) + **`ObstacleAvoidance`**. |
| **Pause / Reprise** | `Touche [P]` ou `[ÉCHAP]` | Suspend immédiatement toute la logique physique et d'évolution en affichant l'OSD PAUSE néon sans écran noir. |
| **Déploiement de Leurre** | `Clic Droit` (Niveau 2) | Déploie un leurre holographique utilisant activement **`Evade`** face aux Traqueurs pour sauver le joueur. |
| **Pose d'Obstacle** | `Clic Droit` (Niv 1, 3, 4, 5) | Place une mire optique statique forçant les ennemis à recalculer leur évitement. |
| **Onde de Choc EMP** | `Touche [ESPACE]` | Déclenche une onde de choc forçant tous les ennemis à activer le comportement **`Flee`** en catastrophe ! |
| **Changer de Niveau** | `Touches [1] à [5]` | Accès direct aux 5 niveaux pour démonstration et évaluation. |
| **Mode Debug** | `Touche [D]` | Affiche les radars d'anticipation, champs de vision et perception génétique. |
| **Recommencer** | `Touche [R]` | Relance la vague active à zéro. |
| **Dashboard Latéral** | `Bouton ◀ / ▶` | Ouvre le panneau cyber de contrôle des pondérations en temps réel. |

---

## 🌊 Les 5 Vagues du Protocole ('Glitch Protocol')

Le jeu repose **strictement sur les 8 comportements de steering** étudiés, sans aucune IA externe :

### 🔹 Niveau 1 : Le Réveil Viral
- **Ennemis** : 12 Virus rouges néon.
- **Comportements** : Combinaison simultanée de **`Wander`** (errance brownienne sur cercle de Reynolds) et **`Seek`** (attraction continue vers le joueur).

### 🔹 Niveau 2 : Traqueurs & Contre-Mesures
- **Ennemis** : 10 Traqueurs supersoniques en double chevron rouge.
- **Comportements** : **`Pursue`** avec anticipation vectorielle de la trajectoire future du joueur ($T = \frac{d}{v_{\text{max}}}$).
- **Contre-mesure active** : Le joueur utilise le **Clic Droit** pour déployer des **Leurres** qui utilisent le comportement **`Evade`** pour détourner l'attention des traqueurs !

### 🔹 Niveau 3 : Le Circuit de Patrouille & Obstacles
- **Environnement** : Apparition d'obstacles statiques néon sur la carte.
- **Classe `Path`** : Génération dynamique d'un circuit vectoriel complet.
- **Ennemis** : Patrouilleurs utilisant **`PathFollowing`** (projection scalaire Craig Reynolds avec lookahead) et **`ObstacleAvoidance`** prioritaire (raycast multi-rayons `ahead` et `ahead2`).

### 🔹 Niveau 4 : L'Essaim Coordonné (Boids)
- **Ennemis** : Essaim de **30 entités Boids** se déplaçant en banc coordonné.
- **Comportements** : Les 3 règles du **`Flocking`** de Reynolds :
  1. *Séparation* : Répulsion locale inversement proportionnelle au carré de la distance ($1/d^2$).
  2. *Alignement* : Harmonisation de la direction moyenne du groupe.
  3. *Cohésion* : Convergence vers le barycentre du groupe.
  + Faible **`Seek`** vers le joueur et **`ObstacleAvoidance`**.

### 🔹 Niveau 5 (Final) : Écosystème Évolutif & Mutation Génétique
- **Environnement** : Apparition continue de particules de **Nourriture** (vertes) et de **Poison** (rouges).
- **Entités Évolutives (ADN)** : Chaque individu possède un code génétique `dna` :
  - `dna[0]` : Poids d'attirance vers la nourriture.
  - `dna[1]` : Poids d'attirance / fuite du poison.
  - `dna[2]` : Rayon de détection de la nourriture.
  - `dna[3]` : Rayon de détection du poison.
- **Survie & Reproduction** : Les individus consomment les paquets, perdent de la vie au fil du temps (`health`), se reproduisent par clonage asexué avec **mutation génétique**, et meurent s'ils sont empoisonnés, tout en utilisant **`Wander`** pour explorer l'arène.
- **Victoire** : Purgez les organismes génétiques pour terminer le protocole !

---

## 🎨 Rendu Caméscope Rétro LCD (Années 2000)

- **HUD Viseur Caméra** : Point rouge clignotant **`● REC`**, score sur 6 chiffres, jauge batterie Li-ion à 3 barres vertes.
- **Focus AF** : Réticule de visée à 4 coins en angle droit `[ L ]` vert fluo remplaçant le triangle classique.
- **Rémanence LCD** : Traînée vectorielle des 10 positions précédentes avec atténuation d'opacité.
- **Aberration Chromatique Glitch** : Séparation dynamique des canaux Cyan (gauche) et Rouge (droite) lors des chocs, explosions et onde EMP.
