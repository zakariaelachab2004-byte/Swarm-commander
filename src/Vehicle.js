/**
 * ========================================================
 * Vehicle.js — Entité Physique Autonome, Missiles & Leurres
 * ========================================================
 * Projet Final Steering — Swarm Commander
 *
 * Rôles gérés dans le protocole de survie :
 *  1. 'focus'    : Joueur (Réticule d'autofocus vert fluo [ L ]) avec 'Arrive'
 *  2. 'missile'  : Projectiles guidés (Clic Gauche) avec 'Pursue'
 *  3. 'virus'    : Ennemis Niveau 1 avec 'Wander' + 'Seek'
 *  4. 'traqueur' : Ennemis Niveau 2 avec 'Pursue'
 *  5. 'leurre'   : Leurres déployés (Clic Droit Niveau 2) avec 'Evade'
 *  6. 'patroller': Ennemis Niveau 3 avec 'PathFollowing' + 'ObstacleAvoidance'
 *  7. 'boid'     : Essaim Niveau 4 avec 'Flocking' (Sep, Align, Coh) + 'Seek'
 *  8. 'genetic'  : Entités évolutives Niveau 5 avec ADN (Nourriture/Poison) + 'Wander'
 *
 * Effets visuels Caméscope Rétro LCD :
 *  - Traînée rémanente (history 10 positions avec opacité dégressive)
 *  - Glitch d'aberration chromatique (Séparation canaux Cyan / Rouge)
 *  - drawingContext.shadowBlur pour le halo néon LCD
 * ========================================================
 */

class Vehicle {
  static debug = false;

  /**
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {number[]|null} [dna=null] - Génotype [poidsFood, poidsPoison, rayonFood, rayonPoison]
   */
  constructor(x, y, dna = null) {
    // ── Cinématique ──────────────────────────────────────
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, 3));
    this.acc = createVector(0, 0);

    // ── Limites Physiques ────────────────────────────────
    this.maxSpeed = 4.0;
    this.maxForce = 0.22;
    this.r        = 13;

    // ── Rôle & Couleur ───────────────────────────────────
    this.role    = 'default';
    this.couleur = color(70, 130, 255);

    // ── Gestionnaire de Comportements associé ────────────
    this.behaviorManager = new BehaviorManager();

    // ── Thème Rétro-Numérique : Traînée & Glitch ─────────
    this.history     = []; // 10 dernières positions
    this.maxHistory  = 10;
    this.glitchTimer = 0;  // Compteur actif d'aberration chromatique
    this.heading     = 0;  // Angle d'orientation mémorisé

    // ── Errance (Wander) ─────────────────────────────────
    this.wanderTheta = random(TWO_PI);

    // ── Points de Vie & Progression RPG (Joueur) ─────────
    this.health    = 100;
    this.maxHealth = 100;

    // ── Algorithme Génétique & Métabolisme (Dossier 8) ────
    this.hasHealth = false;
    if (dna) {
      this.dna = Vehicle.muterADN(dna);
    } else {
      this.dna = [
        random(-2.0, 2.0),   // dna[0] : Poids attirance nourriture
        random(-2.0, 2.0),   // dna[1] : Poids attirance/répulsion poison
        random(20, 130),     // dna[2] : Rayon perception nourriture
        random(20, 130)      // dna[3] : Rayon perception poison
      ];
    }
  }

  // ── Génétique & Reproduction ─────────────────────────────

  /**
   * Applique des mutations légères à l'ADN d'un parent.
   * @param {number[]} parentDna
   * @param {number} [taux=0.08]
   * @returns {number[]}
   */
  static muterADN(parentDna, taux = 0.08) {
    const copie = [...parentDna];
    if (random(1) < taux) copie[0] = constrain(copie[0] + random(-0.35, 0.35), -3.0, 3.0);
    if (random(1) < taux) copie[1] = constrain(copie[1] + random(-0.35, 0.35), -3.0, 3.0);
    if (random(1) < taux) copie[2] = constrain(copie[2] + random(-15, 15), 10, 180);
    if (random(1) < taux) copie[3] = constrain(copie[3] + random(-15, 15), 10, 180);
    return copie;
  }

  /**
   * Clone asexué avec mutation génétique.
   * @param {number} chance
   * @returns {Vehicle|null}
   */
  clone(chance = 0.0028) {
    if (this.hasHealth && this.health > 0.40 && random(1) < chance) {
      const enfant = new Vehicle(this.pos.x + random(-10, 10), this.pos.y + random(-10, 10), this.dna);
      enfant.hasHealth       = true;
      enfant.health          = 1.0;
      enfant.role            = 'genetic';
      enfant.maxSpeed        = this.maxSpeed;
      enfant.maxForce        = this.maxForce;
      enfant.r               = this.r;
      enfant.behaviorManager = this.behaviorManager;
      return enfant;
    }
    return null;
  }

  isDead() {
    return this.hasHealth && this.health <= 0;
  }

  /**
   * Recherche et consommation des paquets de nourriture ou de poison.
   * @param {p5.Vector[]} items
   * @param {number} nutrition
   * @param {number} perception
   * @param {number} [portee=8]
   * @returns {p5.Vector}
   */
  eat(items, nutrition, perception, portee = 8) {
    let plusProcheDist  = Infinity;
    let plusProcheIndex = -1;

    for (let i = items.length - 1; i >= 0; i--) {
      const d = p5.Vector.dist(this.pos, items[i]);
      if (d < portee) {
        items.splice(i, 1);
        if (this.hasHealth) {
          this.health = constrain(this.health + nutrition, 0, 2.5);
        }
      } else if (d < plusProcheDist && d < perception) {
        plusProcheDist  = d;
        plusProcheIndex = i;
      }
    }

    if (plusProcheIndex >= 0 && items[plusProcheIndex]) {
      return BehaviorManager.seek(this, items[plusProcheIndex]);
    }
    return createVector(0, 0);
  }

  /**
   * Répulsion douce aux bords de l'écran.
   * @param {number} [marge=35]
   * @returns {p5.Vector}
   */
  boundaries(marge = 35) {
    let desired = null;
    if (this.pos.x < marge) desired = createVector(this.maxSpeed, this.vel.y);
    else if (this.pos.x > width - marge) desired = createVector(-this.maxSpeed, this.vel.y);
    if (this.pos.y < marge) desired = createVector(this.vel.x, this.maxSpeed);
    else if (this.pos.y > height - marge) desired = createVector(this.vel.x, -this.maxSpeed);

    if (desired !== null) {
      desired.setMag(this.maxSpeed);
      const steer = p5.Vector.sub(desired, this.vel);
      steer.limit(this.maxForce * 1.5);
      return steer;
    }
    return createVector(0, 0);
  }

  // ── Cinématique & Déplacement ─────────────────────────────

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    // Décroissance continue de santé pour les entités génétiques
    if (this.hasHealth) {
      this.health -= 0.0032;
    }

    // Décompte de l'effet d'aberration chromatique
    if (this.glitchTimer > 0) {
      this.glitchTimer--;
    }

    // Historique des positions pour la traînée LCD
    this.history.push(this.pos.copy());
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Intégration d'Euler
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    if (this.vel.magSq() > 0.01) {
      this.heading = this.vel.heading();
    }
    this.pos.add(this.vel);
    this.acc.set(0, 0);
  }

  /**
   * Exécute les comportements, applique la physique et dessine.
   * @param {object} context
   */
  run(context = {}) {
    if (this.behaviorManager) {
      this.behaviorManager.applyAll(this, context);
    }
    this.update();
    this.edges();
    this.show();
  }

  glitch(duree = 16) {
    this.glitchTimer = duree;
  }

  /**
   * Réduit les points de vie de l'entité et déclenche un effet visuel glitch.
   * Si health <= 0, bascule la variable globale gameState en 'GAME_OVER'.
   * @param {number} amount
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.glitch(18);
    if (this.health <= 0) {
      if (typeof gameState !== 'undefined') {
        gameState = 'GAME_OVER';
      }
      if (typeof playGameOverSound === 'function') {
        playGameOverSound();
      }
    }
  }

  edges() {
    let teleported = false;
    if (this.pos.x > width + this.r)  { this.pos.x = -this.r; teleported = true; }
    if (this.pos.x < -this.r)         { this.pos.x = width + this.r; teleported = true; }
    if (this.pos.y > height + this.r) { this.pos.y = -this.r; teleported = true; }
    if (this.pos.y < -this.r)         { this.pos.y = height + this.r; teleported = true; }
    if (teleported) this.history = [];
  }

  // ── Rendu Rétro-Numérique LCD (Mission 4) ──────────────────

  /**
   * Dessine la traînée rémanente avec dégradé d'opacité vers le passé.
   * @param {p5.Color} couleurBase
   */
  showTrail(couleurBase) {
    if (this.history.length < 2) return;
    push();
    noFill();
    drawingContext.shadowBlur = 6;
    drawingContext.shadowColor = couleurBase;

    for (let i = 0; i < this.history.length - 1; i++) {
      const p1 = this.history[i];
      const p2 = this.history[i + 1];
      if (p5.Vector.dist(p1, p2) > 80) continue;

      const ratio = (i + 1) / this.history.length;
      const alphaVal = map(ratio, 0, 1, 15, 175);
      const epaisseur = map(ratio, 0, 1, 0.8, 2.0);

      stroke(red(couleurBase), green(couleurBase), blue(couleurBase), alphaVal);
      strokeWeight(epaisseur);
      line(p1.x, p1.y, p2.x, p2.y);
    }
    pop();
  }

  /**
   * Dessine la silhouette filaire ou stylisée selon le rôle de l'entité.
   * @param {p5.Color} teinte
   */
  drawContour(teinte) {
    // ── 1. LE JOUEUR : Soucoupe Volante Antivirus ───────────
    if (this.role === 'focus' || this.role === 'player') {
      // 1. Flamme de propulsion arrière (taille dynamique avec random)
      const vitesse = this.vel ? this.vel.mag() : 0;
      const propActive = vitesse > 0.2 || random(1) < 0.65;
      if (propActive) {
        const flammeLong = random(9, 19) * map(constrain(vitesse, 0, this.maxSpeed), 0, this.maxSpeed, 0.8, 1.6);
        const flammeLarg = random(4, 7);

        push();
        noStroke();
        // Flamme externe jaune/orange vive
        fill(255, 130, 20, 230);
        beginShape();
        vertex(-this.r * 0.92, -flammeLarg);
        vertex(-this.r * 0.92 - flammeLong, 0);
        vertex(-this.r * 0.92, flammeLarg);
        endShape(CLOSE);

        // Cœur de propulsion néon cyan / blanc
        fill(0, 255, 240, 250);
        beginShape();
        vertex(-this.r * 0.92, -flammeLarg * 0.45);
        vertex(-this.r * 0.92 - (flammeLong * 0.62), 0);
        vertex(-this.r * 0.92, flammeLarg * 0.45);
        endShape(CLOSE);
        pop();
      }

      // 2. Disque / Corps inférieur métallisé
      stroke(30, 60, 50);
      strokeWeight(1.5);
      fill(36, 52, 46); // gris métallisé sombre
      ellipse(0, 0, this.r * 2.3, this.r * 1.5);

      // 3. Anneau principal de la soucoupe (bordure néon vert/cyan dominante)
      stroke(teinte); // Vert fluo ou Cyan dominant
      strokeWeight(2.2);
      fill(22, 38, 32, 235);
      ellipse(0, 0, this.r * 2.05, this.r * 1.35);

      // 4. Diodes lumineuses antivirus rotatives autour du disque
      noStroke();
      fill(teinte);
      const nbDiodes = 6;
      const tDiodes = millis() * 0.005;
      for (let i = 0; i < nbDiodes; i++) {
        const a = (TWO_PI * i) / nbDiodes + tDiodes;
        const dx = cos(a) * (this.r * 0.82);
        const dy = sin(a) * (this.r * 0.50);
        circle(dx, dy, 2.8);
      }

      // 5. Dôme en verre du cockpit (bleu clair transparent sur le dessus)
      stroke(90, 225, 255, 230);
      strokeWeight(1.6);
      fill(100, 220, 255, 140); // Bleu clair transparent
      ellipse(this.r * 0.08, 0, this.r * 1.05, this.r * 0.92);

      // Reflet spéculaire blanc sur le dôme
      noStroke();
      fill(255, 255, 255, 200);
      ellipse(this.r * 0.26, -this.r * 0.20, this.r * 0.35, this.r * 0.18);

      // 6. Antenne scanner antivirus frontale
      stroke(teinte);
      strokeWeight(1.8);
      line(this.r * 0.65, 0, this.r * 1.35, 0);
      fill(teinte);
      circle(this.r * 1.35, 0, 3.5);

    // ── 2. LES MISSILES : Flèche Supersonique Guidée ───────
    } else if (this.role === 'missile') {
      stroke(teinte);
      strokeWeight(2.0);
      noFill();
      beginShape();
      vertex(this.r * 1.4, 0);
      vertex(-this.r, -this.r * 0.5);
      vertex(-this.r * 0.4, 0);
      vertex(-this.r, this.r * 0.5);
      endShape(CLOSE);
      point(0, 0);

    // ── 3. LES VIRUS (Niveau 1) : LE DIABLOTIN VIRAL (Evil Glitch Imp) ──
    } else if (this.role === 'virus') {
      const pulse = sin(millis() * 0.008 + this.pos.x) * 1.5;

      // A. Cornes Démoniaques Supérieures (courbées vers l'arrière)
      fill(255, 30, 60, 230);
      stroke(teinte);
      strokeWeight(1.6);
      // Corne gauche
      beginShape();
      vertex(-this.r * 0.1, -this.r * 0.65);
      vertex(-this.r * 0.9, -this.r * 1.4 - pulse);
      vertex(-this.r * 0.5, -this.r * 0.4);
      endShape(CLOSE);
      // Corne droite
      beginShape();
      vertex(-this.r * 0.1, this.r * 0.65);
      vertex(-this.r * 0.9, this.r * 1.4 + pulse);
      vertex(-this.r * 0.5, this.r * 0.4);
      endShape(CLOSE);

      // B. Crâne Démoniaque Arrondi et Sombre
      fill(32, 6, 14, 235);
      stroke(teinte);
      strokeWeight(2.0);
      circle(0, 0, (this.r * 1.8) + pulse);

      // C. Épines d'Aura Maléfique
      stroke(255, 60, 90, 180);
      strokeWeight(1.4);
      line(-this.r * 0.9, 0, -this.r * 1.4, 0);
      line(-this.r * 0.6, -this.r * 0.8, -this.r * 1.1, -this.r * 1.1);
      line(-this.r * 0.6, this.r * 0.8, -this.r * 1.1, this.r * 1.1);

      // D. Yeux Diaboliques Inclinés et Menaçants (Slanted Evil Eyes)
      noStroke();
      fill(255, 230, 0, 245); // Jaune vif diabolique
      // Œil gauche en amande inclinée
      beginShape();
      vertex(this.r * 0.45, -this.r * 0.22);
      vertex(this.r * 0.08, -this.r * 0.48);
      vertex(this.r * 0.15, -this.r * 0.18);
      endShape(CLOSE);
      // Œil droit en amande inclinée
      beginShape();
      vertex(this.r * 0.45, this.r * 0.22);
      vertex(this.r * 0.08, this.r * 0.48);
      vertex(this.r * 0.15, this.r * 0.18);
      endShape(CLOSE);

      // Pupilles verticales noires perçantes
      fill(10, 0, 0);
      ellipse(this.r * 0.25, -this.r * 0.30, 2.2, 4.5);
      ellipse(this.r * 0.25, this.r * 0.30, 2.2, 4.5);

      // Sourcils froncés en colère
      stroke(255, 30, 60);
      strokeWeight(1.8);
      line(this.r * 0.48, -this.r * 0.18, this.r * 0.05, -this.r * 0.52);
      line(this.r * 0.48, this.r * 0.18, this.r * 0.05, this.r * 0.52);

      // E. Bouche Sardonique avec Crocs Acérés (Sinister Jagged Grin)
      stroke(255, 40, 80);
      strokeWeight(1.5);
      fill(18, 2, 8); // Intérieur sombre de la bouche
      beginShape();
      vertex(this.r * 0.1, -this.r * 0.35);
      vertex(this.r * 0.48, 0);
      vertex(this.r * 0.1, this.r * 0.35);
      vertex(this.r * 0.22, 0);
      endShape(CLOSE);

      // Crocs triangulaires blancs acérés
      fill(255);
      noStroke();
      triangle(this.r * 0.15, -this.r * 0.25, this.r * 0.32, -this.r * 0.18, this.r * 0.22, -this.r * 0.10);
      triangle(this.r * 0.15, this.r * 0.25, this.r * 0.32, this.r * 0.18, this.r * 0.22, this.r * 0.10);
      triangle(this.r * 0.22, -this.r * 0.08, this.r * 0.40, 0, this.r * 0.22, this.r * 0.08);

    // ── 4. LES TRAQUEURS (Niveau 2) : LE FAUCHEUR CYBER-DÉMON (Predator Reaper) ─
    } else if (this.role === 'traqueur') {
      const pulse = sin(millis() * 0.01 + this.pos.y) * 2;

      // A. Cornes-Lames Incurvées Géantes de Faucheur
      fill(48, 6, 14, 240);
      stroke(255, 20, 50);
      strokeWeight(2.0);
      // Faux supérieure
      beginShape();
      vertex(this.r * 0.2, -this.r * 0.7);
      vertex(-this.r * 0.7, -this.r * 1.5 - pulse);
      vertex(-this.r * 1.3, -this.r * 1.0);
      vertex(-this.r * 0.5, -this.r * 0.3);
      endShape(CLOSE);
      // Faux inférieure
      beginShape();
      vertex(this.r * 0.2, this.r * 0.7);
      vertex(-this.r * 0.7, this.r * 1.5 + pulse);
      vertex(-this.r * 1.3, this.r * 1.0);
      vertex(-this.r * 0.5, this.r * 0.3);
      endShape(CLOSE);

      // B. Masque / Crâne Métallique Démoniaque Agressif
      fill(26, 4, 10, 245);
      stroke(teinte);
      strokeWeight(2.2);
      beginShape();
      vertex(this.r * 1.45, 0); // Museau pointu
      vertex(this.r * 0.4, -this.r * 0.7);
      vertex(-this.r * 0.8, -this.r * 0.5);
      vertex(-this.r * 0.3, 0);
      vertex(-this.r * 0.8, this.r * 0.5);
      vertex(this.r * 0.4, this.r * 0.7);
      endShape(CLOSE);

      // C. Fentes Oculaires Rouges Sinistres (Glowing Evil Eye Visor)
      noStroke();
      fill(255, 30, 60, 245);
      // Œil gauche incliné
      beginShape();
      vertex(this.r * 0.9, -this.r * 0.15);
      vertex(this.r * 0.3, -this.r * 0.42);
      vertex(this.r * 0.4, -this.r * 0.12);
      endShape(CLOSE);
      // Œil droit incliné
      beginShape();
      vertex(this.r * 0.9, this.r * 0.15);
      vertex(this.r * 0.3, this.r * 0.42);
      vertex(this.r * 0.4, this.r * 0.12);
      endShape(CLOSE);

      // Cœur de l'œil (jaune incandescent)
      fill(255, 230, 0);
      ellipse(this.r * 0.55, -this.r * 0.24, 2.5, 2.5);
      ellipse(this.r * 0.55, this.r * 0.24, 2.5, 2.5);

      // Troisième œil / capteur occulte au centre du front
      fill(255, 0, 70);
      ellipse(this.r * 0.1, 0, 4, 4);

      // D. Mandibules Prédatrices & Dents de Vampire
      stroke(255, 255, 255, 220);
      strokeWeight(1.8);
      // Croc avant gauche
      line(this.r * 1.0, -this.r * 0.2, this.r * 1.5, -this.r * 0.1);
      // Croc avant droit
      line(this.r * 1.0, this.r * 0.2, this.r * 1.5, this.r * 0.1);
      // Mandibules latérales
      stroke(255, 40, 70);
      line(this.r * 0.3, -this.r * 0.6, this.r * 0.8, -this.r * 0.45);
      line(this.r * 0.3, this.r * 0.6, this.r * 0.8, this.r * 0.45);

    // ── 5. LES LEURRES (Niveau 2 Clic Droit) : Losange Hologramme ─
    } else if (this.role === 'leurre') {
      stroke(teinte);
      strokeWeight(1.8);
      noFill();
      beginShape();
      vertex(this.r * 1.1, 0);
      vertex(0, -this.r * 1.1);
      vertex(-this.r * 1.1, 0);
      vertex(0, this.r * 1.1);
      endShape(CLOSE);
      // Impulsion radar hologramme
      const pulse = sin(millis() * 0.008) * 6;
      stroke(red(teinte), green(teinte), blue(teinte), 120);
      circle(0, 0, this.r * 1.8 + pulse);

    // ── 6. LES PATROUILLEURS (Niveau 3) : L'ŒIL CYCLOPE DÉMONIAQUE (Evil Eye Beholder) ─
    } else if (this.role === 'patroller') {
      const pulse = sin(millis() * 0.007 + this.pos.x) * 2;

      // A. Carapace à Pointes / Griffes Incurvées
      stroke(255, 170, 0);
      strokeWeight(1.8);
      fill(36, 18, 6, 235);
      circle(0, 0, (this.r * 2.1) + pulse);

      // 6 Pointes diaboliques autour de la coque
      const nbSpikes = 6;
      for (let i = 0; i < nbSpikes; i++) {
        const a = (TWO_PI * i) / nbSpikes + (millis() * 0.002);
        const sx1 = cos(a) * (this.r * 0.95);
        const sy1 = sin(a) * (this.r * 0.95);
        const sx2 = cos(a) * (this.r * 1.55 + pulse);
        const sy2 = sin(a) * (this.r * 1.55 + pulse);
        stroke(255, 80, 20);
        strokeWeight(2.0);
        line(sx1, sy1, sx2, sy2);
      }

      // B. Grand Œil Unique Cyclopéen Maléfique (Evil Eye)
      stroke(255, 40, 40);
      strokeWeight(1.6);
      fill(250, 230, 200); // Blanc de l'œil injecté de sang
      ellipse(this.r * 0.15, 0, this.r * 1.25, this.r * 0.95);

      // Veines rouges dans l'œil
      stroke(255, 0, 40, 150);
      strokeWeight(1.0);
      line(-this.r * 0.3, -this.r * 0.2, 0, -this.r * 0.1);
      line(-this.r * 0.3, this.r * 0.2, 0, this.r * 0.1);

      // Iris flamboyant rouge/or
      noStroke();
      fill(255, 30, 40);
      circle(this.r * 0.28, 0, this.r * 0.65);
      fill(255, 230, 0);
      circle(this.r * 0.32, 0, this.r * 0.35);

      // Pupille fente verticale sinistre
      fill(0);
      ellipse(this.r * 0.34, 0, 2.5, this.r * 0.55);

      // Paupière supérieure plissée menaçante
      stroke(255, 140, 0);
      strokeWeight(2.2);
      noFill();
      arc(this.r * 0.15, -this.r * 0.08, this.r * 1.3, this.r * 0.8, PI * 0.95, TWO_PI * 1.05);

      // C. Petite Bouche aux Crocs Aiguisés en Dessous
      fill(15, 4, 4);
      stroke(255, 50, 50);
      strokeWeight(1.2);
      arc(this.r * 0.1, this.r * 0.35, this.r * 0.7, this.r * 0.35, 0, PI);
      fill(255);
      noStroke();
      triangle(this.r * 0.0, this.r * 0.35, this.r * 0.1, this.r * 0.48, this.r * 0.2, this.r * 0.35);

    // ── 7. L'ESSAIM ALLIÉ (Drones Alliés) & L'ESSAIM BOIDS (Gargouilles de l'Abîme) ──
    } else if (this.role === 'ally' || this.role === 'swarmDrone') {
      stroke(teinte);
      strokeWeight(1.8);
      noFill();
      beginShape();
      vertex(this.r * 1.25, 0);
      vertex(-this.r * 0.75, -this.r * 0.65);
      vertex(-this.r * 0.25, 0);
      vertex(-this.r * 0.75, this.r * 0.65);
      endShape(CLOSE);
      // Noyau d'énergie du drone allié
      fill(red(teinte), green(teinte), blue(teinte), 200);
      circle(0, 0, 3.5);

    } else if (this.role === 'boid' || this.role === 'swarm' || this.role === 'data') {
      const battement = sin(millis() * 0.02 + this.pos.x * 0.08) * 6;

      // A. Ailes Démoniaques Épineuses Battantes
      fill(20, 10, 32, 230);
      stroke(teinte);
      strokeWeight(1.6);
      // Aile gauche
      beginShape();
      vertex(-this.r * 0.2, -this.r * 0.3);
      vertex(-this.r * 0.6, -this.r * 1.4 + battement);
      vertex(0, -this.r * 0.8 + battement * 0.6);
      vertex(this.r * 0.4, -this.r * 1.2 + battement);
      vertex(this.r * 0.3, -this.r * 0.2);
      endShape(CLOSE);
      // Aile droite
      beginShape();
      vertex(-this.r * 0.2, this.r * 0.3);
      vertex(-this.r * 0.6, this.r * 1.4 - battement);
      vertex(0, this.r * 0.8 - battement * 0.6);
      vertex(this.r * 0.4, this.r * 1.2 - battement);
      vertex(this.r * 0.3, this.r * 0.2);
      endShape(CLOSE);

      // B. Corps / Crâne Cornu d'Imp Ailé
      fill(36, 12, 45, 240);
      stroke(255, 0, 127);
      strokeWeight(1.8);
      beginShape();
      vertex(this.r * 1.2, 0); // Museau
      vertex(this.r * 0.2, -this.r * 0.5);
      vertex(-this.r * 0.8, -this.r * 0.6); // Corne gauche
      vertex(-this.r * 0.3, 0);
      vertex(-this.r * 0.8, this.r * 0.6);  // Corne droite
      vertex(this.r * 0.2, this.r * 0.5);
      endShape(CLOSE);

      // C. Yeux Lumineux Sinistres (Cyan / Fuchsia)
      noStroke();
      fill(0, 240, 255);
      circle(this.r * 0.4, -this.r * 0.2, 3);
      circle(this.r * 0.4, this.r * 0.2, 3);
      fill(255);
      circle(this.r * 0.48, -this.r * 0.2, 1.2);
      circle(this.r * 0.48, this.r * 0.2, 1.2);

      // D. Dents Minuscules de Piranha Démoniaque
      stroke(255);
      strokeWeight(1.0);
      line(this.r * 0.8, -this.r * 0.12, this.r * 1.1, 0);
      line(this.r * 0.8, this.r * 0.12, this.r * 1.1, 0);

    // ── 8. LES DRONES ÉVOLUTIFS (Niveau 5) : PARASITE MUTANT VORACE (Abomination Alien) ─
    } else if (this.role === 'genetic') {
      const pulse = sin(millis() * 0.008 + this.pos.x) * 2.5;

      // A. Tentacules Barbelés Ondulants à l'Arrière
      stroke(255, 40, 70, 200);
      strokeWeight(1.8);
      noFill();
      for (let k = -1; k <= 1; k += 2) {
        const tentWave = sin(millis() * 0.015 + k) * 4;
        beginShape();
        vertex(-this.r * 0.5, k * this.r * 0.4);
        vertex(-this.r * 1.1, k * this.r * 0.8 + tentWave);
        vertex(-this.r * 1.6, k * this.r * 0.4 - tentWave);
        endShape();
      }

      // B. Corps Organique Grotesque et Pulsant
      fill(28, 8, 18, 235);
      stroke(teinte);
      strokeWeight(2.2);
      circle(0, 0, (this.r * 1.9) + pulse);

      // Épines toxiques latérales
      stroke(255, 30, 80);
      strokeWeight(1.6);
      line(0, -this.r * 0.9, 0, -this.r * 1.3 - pulse);
      line(0, this.r * 0.9, 0, this.r * 1.3 + pulse);

      // C. Yeux Multiples Dérangés (3 yeux asymétriques diaboliques)
      noStroke();
      // Œil 1 (Haut)
      fill(255, 230, 0);
      circle(this.r * 0.2, -this.r * 0.35, 6);
      fill(0);
      circle(this.r * 0.24, -this.r * 0.35, 2.5);
      // Œil 2 (Bas)
      fill(255, 230, 0);
      circle(this.r * 0.2, this.r * 0.35, 6);
      fill(0);
      circle(this.r * 0.24, this.r * 0.35, 2.5);
      // Œil 3 (Grand Œil Central)
      fill(255, 40, 60);
      circle(this.r * 0.4, 0, 8);
      fill(255, 240, 100);
      circle(this.r * 0.44, 0, 4);
      fill(0);
      ellipse(this.r * 0.46, 0, 1.8, 5);

      // D. Bouche Béante Dévoreuse avec Dents Concentriques
      fill(12, 2, 6);
      stroke(255, 30, 60);
      strokeWeight(1.4);
      circle(-this.r * 0.1, 0, this.r * 0.7);

      // Dents en aiguilles
      fill(255);
      noStroke();
      const nbTeeth = 6;
      for (let t = 0; t < nbTeeth; t++) {
        const ang = (TWO_PI * t) / nbTeeth;
        const tx = -this.r * 0.1 + cos(ang) * (this.r * 0.25);
        const ty = sin(ang) * (this.r * 0.25);
        circle(tx, ty, 2);
      }

    // ── 9. BUG ALPHA (Mini-Boss de Vague) : LE GRAND DÉMON ALPHA (Titan des Ombres) ─
    } else if (this.role === 'boss' || this.role === 'alpha') {
      const pulse = sin(millis() * 0.009) * 3.5;

      // A. Cornes Diaboliques Démesurées de Titan
      fill(50, 4, 12, 245);
      stroke(255, 30, 60);
      strokeWeight(2.8);
      // Corne gauche colossale
      beginShape();
      vertex(this.r * 0.1, -this.r * 0.75);
      vertex(-this.r * 0.6, -this.r * 1.6 - pulse);
      vertex(-this.r * 1.5, -this.r * 1.4);
      vertex(-this.r * 0.6, -this.r * 0.4);
      endShape(CLOSE);
      // Corne droite colossale
      beginShape();
      vertex(this.r * 0.1, this.r * 0.75);
      vertex(-this.r * 0.6, this.r * 1.6 + pulse);
      vertex(-this.r * 1.5, this.r * 1.4);
      vertex(-this.r * 0.6, this.r * 0.4);
      endShape(CLOSE);

      // B. Crâne Blindé Cuirassé Noir & Magma
      fill(25, 4, 8, 250);
      stroke(255, 30, 60);
      strokeWeight(3.0);
      beginShape();
      vertex(this.r * 1.6, 0); // Mâchoire blindée avant
      vertex(this.r * 0.8, -this.r * 0.85);
      vertex(-this.r * 0.7, -this.r * 0.85);
      vertex(-this.r * 1.1, 0);
      vertex(-this.r * 0.7, this.r * 0.85);
      vertex(this.r * 0.8, this.r * 0.85);
      endShape(CLOSE);

      // C. Lignes d'Énergie Infernale Magma
      stroke(255, 200, 0, 220);
      strokeWeight(1.8);
      line(-this.r * 0.5, 0, this.r * 0.4, 0);
      line(-this.r * 0.2, -this.r * 0.5, this.r * 0.3, -this.r * 0.2);
      line(-this.r * 0.2, this.r * 0.5, this.r * 0.3, this.r * 0.2);

      // D. Yeux de Démon Incandescents et Furieux
      noStroke();
      fill(255, 230, 0); // Jaune incandescent
      // Œil gauche en biseau menaçant
      beginShape();
      vertex(this.r * 1.0, -this.r * 0.22);
      vertex(this.r * 0.35, -this.r * 0.45);
      vertex(this.r * 0.45, -this.r * 0.15);
      endShape(CLOSE);
      // Œil droit en biseau menaçant
      beginShape();
      vertex(this.r * 1.0, this.r * 0.22);
      vertex(this.r * 0.35, this.r * 0.45);
      vertex(this.r * 0.45, this.r * 0.15);
      endShape(CLOSE);

      // Pupilles rouge sang verticales
      fill(200, 0, 20);
      ellipse(this.r * 0.65, -this.r * 0.28, 3.2, 6.5);
      ellipse(this.r * 0.65, this.r * 0.28, 3.2, 6.5);

      // Sourcils en plaques blindées furieuses
      stroke(255, 20, 40);
      strokeWeight(2.5);
      line(this.r * 1.05, -this.r * 0.18, this.r * 0.25, -this.r * 0.55);
      line(this.r * 1.05, this.r * 0.18, this.r * 0.25, this.r * 0.55);

      // E. Grande Gueule Béante & Crocs Géants de Démon
      fill(12, 1, 4);
      stroke(255, 40, 70);
      strokeWeight(2.0);
      beginShape();
      vertex(this.r * 0.3, -this.r * 0.4);
      vertex(this.r * 1.25, 0);
      vertex(this.r * 0.3, this.r * 0.4);
      vertex(this.r * 0.55, 0);
      endShape(CLOSE);

      // Dents & Crocs de Vampire Monstrueux
      fill(255, 250, 240);
      noStroke();
      triangle(this.r * 0.45, -this.r * 0.32, this.r * 0.95, -this.r * 0.20, this.r * 0.65, -this.r * 0.12);
      triangle(this.r * 0.45, this.r * 0.32, this.r * 0.95, this.r * 0.20, this.r * 0.65, this.r * 0.12);
      triangle(this.r * 0.65, -this.r * 0.10, this.r * 1.15, 0, this.r * 0.65, this.r * 0.10);

      // Cœur réacteur de plasma au fond de la gorge
      fill(255, 230, 0, 230);
      circle(this.r * 0.5, 0, 7);

    // ── 10. DÉFAUT : Triangle ──────────────────────────────
    } else {
      stroke(teinte);
      strokeWeight(1.4);
      noFill();
      beginShape();
      vertex(this.r, 0);
      vertex(-this.r, -this.r * 0.6);
      vertex(-this.r * 0.4, 0);
      vertex(-this.r, this.r * 0.6);
      endShape(CLOSE);
    }
  }

  show() {
    // ── 1. Couleur de base selon le rôle ─────────────────
    let baseColor;
    if (this.role === 'focus' || this.role === 'player') {
      baseColor = color(57, 255, 20); // Vert fluo autofocus LCD
      this.showTrail(baseColor);
    } else if (this.role === 'missile') {
      baseColor = color(0, 240, 255); // Cyan supersonique
      this.showTrail(baseColor);
    } else if (this.role === 'virus') {
      baseColor = color(255, 40, 80); // Rouge néon menaçant
      this.showTrail(baseColor);
    } else if (this.role === 'traqueur') {
      baseColor = color(255, 30, 45); // Rouge vermillon
      this.showTrail(baseColor);
    } else if (this.role === 'leurre') {
      baseColor = color(255, 183, 3); // Ambre holographique
      this.showTrail(baseColor);
    } else if (this.role === 'patroller') {
      baseColor = color(245, 158, 11); // Ambre circuit
      this.showTrail(baseColor);
    } else if (this.role === 'ally' || this.role === 'swarmDrone') {
      // Teinte dynamique selon l'ordre du Leader (Bleu Cyan Formation / Rose Fuchsia Attaque)
      if (typeof swarmMode !== 'undefined' && swarmMode === 'ATTACK') {
        baseColor = color(255, 20, 147); // Rose néon d'attaque
      } else {
        baseColor = color(0, 220, 255);  // Bleu cyan formation
      }
      this.showTrail(baseColor);
    } else if (this.role === 'boid' || this.role === 'swarm' || this.role === 'data') {
      baseColor = color(56, 189, 248); // Bleu LCD
      this.showTrail(baseColor);
    } else if (this.role === 'genetic') {
      // Interpolation de couleur selon la santé (Vert fluo -> Rouge affamé)
      const ratio = constrain(this.health, 0, 1);
      baseColor = lerpColor(color(255, 40, 60), color(57, 255, 20), ratio);
      this.showTrail(baseColor);
    } else if (this.role === 'boss' || this.role === 'alpha') {
      baseColor = color(255, 30, 60); // Rouge vermillon incandescent
      this.showTrail(baseColor);
    } else {
      baseColor = this.couleur;
    }

    // ── 2. Rendu Debug ADN (Rayons de perception) ────────
    if (Vehicle.debug && this.role === 'genetic' && this.dna) {
      push();
      noFill();
      strokeWeight(1);
      // Rayon nourriture (Vert)
      stroke(57, 255, 20, 70);
      circle(this.pos.x, this.pos.y, this.dna[2] * 2);
      // Rayon poison (Rouge)
      stroke(255, 40, 60, 70);
      circle(this.pos.x, this.pos.y, this.dna[3] * 2);
      pop();
    }

    push();
    translate(this.pos.x, this.pos.y);

    // Orientation de l'entité (la soucoupe volante s'incline selon sa direction de déplacement)
    if (this.role !== 'leurre') {
      const headingAngle = (this.heading !== undefined) ? this.heading : this.vel.heading();
      rotate(headingAngle);
    }

    // Effet Néon LCD
    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = baseColor;

    // ── 3. Effet Glitch d'aberration chromatique ─────────
    if (this.glitchTimer > 0) {
      const shift = map(this.glitchTimer, 16, 0, 4.5, 1.5);
      const jitterY = random(-1.2, 1.2);

      // Canal Cyan décalé à gauche
      push();
      translate(-shift, jitterY);
      drawingContext.shadowColor = color(0, 240, 255);
      this.drawContour(color(0, 240, 255, 220));
      pop();

      // Canal Rouge décalé à droite
      push();
      translate(shift, -jitterY);
      drawingContext.shadowColor = color(255, 30, 60);
      this.drawContour(color(255, 30, 60, 220));
      pop();
    }

    // Silhouette principale
    this.drawContour(baseColor);

    pop();

    // ── 4. Barre de Vie Flottante (Joueur & Bug Alpha) ──
    if (this.role === 'focus' || this.role === 'player') {
      this.drawFloatingHealthBar();
    } else if (this.role === 'boss' || this.role === 'alpha') {
      this.drawBossHealthBar();
    }
  }

  /**
   * Dessine la barre de vie flottante au-dessus du Bug Alpha avec label tactique.
   */
  drawBossHealthBar() {
    push();
    translate(this.pos.x, this.pos.y);

    const barW = 58;
    const barH = 6;
    const barY = -this.r * 1.5 - 14;

    // Fond de jauge sombre
    noStroke();
    fill(15, 8, 12, 220);
    rect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2, 2);

    // Bordure néon
    stroke(255, 30, 60, 220);
    strokeWeight(1);
    noFill();
    rect(-barW / 2, barY, barW, barH, 2);

    // Progression de santé active
    const maxHP = this.maxHealth || 10;
    const ratio = constrain(this.health / maxHP, 0, 1);
    drawingContext.shadowBlur = 8;
    drawingContext.shadowColor = color(255, 30, 60);
    fill(ratio > 0.35 ? color(255, 30, 60) : color(255, 230, 0));
    noStroke();
    rect(-barW / 2 + 1, barY + 1, (barW - 2) * ratio, barH - 2, 1);

    // Étiquette ALPHA BOSS
    fill(255, 230, 0);
    textFont('Press Start 2P, monospace');
    textSize(6.5);
    textAlign(CENTER, BOTTOM);
    text('ALPHA BUG', 0, barY - 2);

    pop();
  }

  /**
   * Dessine la barre de vie flottante horizontale au-dessus de la soucoupe.
   * Fond rectangle rouge, rectangle de premier plan vert proportionnel à health / maxHealth.
   */
  drawFloatingHealthBar() {
    push();
    translate(this.pos.x, this.pos.y);
    // Non soumis à la rotation pour rester strictement horizontal

    const barW = 46;
    const barH = 5.5;
    const barY = -this.r * 1.5 - 12; // Juste au-dessus de la soucoupe
    const cornerR = 2;

    // Fond rouge (rectangle de fond)
    noStroke();
    fill(180, 25, 35, 210);
    rect(-barW / 2, barY, barW, barH, cornerR);

    // Premier plan vert (barre de vie active proportionnelle)
    const ratio = constrain(this.health / this.maxHealth, 0, 1);
    const fillW = barW * ratio;

    drawingContext.shadowBlur = 8;
    if (ratio > 0.5) {
      fill(57, 255, 20, 240); // Vert fluo
      drawingContext.shadowColor = color(57, 255, 20, 160);
    } else if (ratio > 0.25) {
      fill(255, 183, 3, 240); // Ambre avertissement
      drawingContext.shadowColor = color(255, 183, 3, 160);
    } else {
      fill(255, 40, 60, 240); // Rouge critique
      drawingContext.shadowColor = color(255, 40, 60, 190);
    }
    rect(-barW / 2, barY, fillW, barH, cornerR);

    // Bordure fine
    noFill();
    stroke(15, 35, 25, 220);
    strokeWeight(1);
    rect(-barW / 2, barY, barW, barH, cornerR);

    // Graduation centrale
    stroke(255, 255, 255, 60);
    strokeWeight(0.8);
    line(0, barY, 0, barY + barH);

    pop();
  }
}

/**
 * ========================================================
 * Classe Dérivée : Missile (Projectile Guidé Clic Gauche)
 * ========================================================
 */
class Missile extends Vehicle {
  constructor(x, y, cible = null) {
    super(x, y);
    this.role     = 'missile';
    this.r        = 7;
    this.maxSpeed = 11.0;
    this.maxForce = 0.85;
    this.lifeSpan = 200; // Durée de vol ~ 3.3s
    this.cible    = cible;

    this.behaviorManager = new BehaviorManager()
      .add('pursue', 3.2)
      .add('obstacleAvoidance', 3.6);
  }

  actualiserCible(ennemis) {
    if (this.cible && ennemis.includes(this.cible)) return;
    let distMin = Infinity;
    let plusProche = null;
    for (const ennemi of ennemis) {
      const d = p5.Vector.dist(this.pos, ennemi.pos);
      if (d < distMin) {
        distMin = d;
        plusProche = ennemi;
      }
    }
    this.cible = plusProche;
  }

  run(context = {}) {
    this.lifeSpan--;
    if (context.ennemis) this.actualiserCible(context.ennemis);

    if (this.behaviorManager) {
      const ctx = {
        proie:            this.cible,
        predictionFrames: 14,
        obstacles:        context.obstacles || [],
        aheadDistance:    28,
        marge:            20
      };
      this.behaviorManager.applyAll(this, ctx);
    }

    this.update();
    this.show();
  }

  isExpired() {
    return this.lifeSpan <= 0;
  }
}

/**
 * ========================================================
 * Classe Dérivée : Leurre (Déployé au Clic Droit Niveau 2)
 * ========================================================
 */
class Leurre extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.role     = 'leurre';
    this.r        = 12;
    this.maxSpeed = 5.2;
    this.maxForce = 0.35;
    this.lifeSpan = 320; // Actif pendant ~5.3 secondes

    // Utilise activement 'Evade' pour fuir les traqueurs
    this.behaviorManager = new BehaviorManager()
      .add('evade', 3.8)
      .add('obstacleAvoidance', 2.5);
  }

  run(context = {}) {
    this.lifeSpan--;
    if (this.behaviorManager) {
      // Évitement de la menace la plus proche parmi les traqueurs
      let plusProche = null;
      let dMin = Infinity;
      if (context.traqueurs) {
        for (const t of context.traqueurs) {
          const d = p5.Vector.dist(this.pos, t.pos);
          if (d < dMin) {
            dMin = d;
            plusProche = t;
          }
        }
      }

      const ctx = {
        menace:        plusProche,
        maxPrediction: 16,
        obstacles:     context.obstacles || [],
        aheadDistance: 25,
        marge:         18
      };
      this.behaviorManager.applyAll(this, ctx);
    }

    this.update();
    this.edges();
    this.show();
  }

  isExpired() {
    return this.lifeSpan <= 0;
  }
}
