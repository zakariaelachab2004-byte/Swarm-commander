/**
 * ========================================================
 * Obstacle.js — Mire Optique & Obstacle Statique
 * ========================================================
 * Projet Final Steering — Environnement Indépendant
 *
 * Représente un obstacle circulaire statique placé sur la carte
 * ou déployé dynamiquement par le joueur lors d'un clic droit.
 *
 * Équipé d'une détection d'impact pour déclencher le glitch
 * d'aberration chromatique rétro-numérique.
 * ========================================================
 */

class Obstacle {
  /**
   * @param {number} x        Position X
   * @param {number} y        Position Y
   * @param {number} r        Rayon de l'obstacle
   * @param {string} couleur  Couleur du contour néon LCD
   */
  constructor(x, y, r = 40, couleur = '#ff9f1c') {
    this.pos         = createVector(x, y);
    this.r           = r;
    this.couleur     = couleur;
    this.impactTimer = 0; // Animation de flash / aberration lors d'une collision
  }

  /**
   * Génère une liste d'obstacles aléatoires éloignés des bords.
   * @param {number} n     Nombre d'obstacles
   * @param {number} rMin  Rayon minimum
   * @param {number} rMax  Rayon maximum
   * @param {number} marge Distance minimale aux bords
   * @returns {Obstacle[]}
   */
  static genererAleatoires(n = 6, rMin = 28, rMax = 65, marge = 90) {
    const liste = [];
    const teintes = ['#ff9f1c', '#00f0ff', '#ff3366', '#39ff14', '#c084fc'];
    for (let i = 0; i < n; i++) {
      const r = random(rMin, rMax);
      const x = random(marge + r, width  - marge - r);
      const y = random(marge + r, height - marge - r);
      liste.push(new Obstacle(x, y, r, random(teintes)));
    }
    return liste;
  }

  /**
   * Détecte si un véhicule entre en collision avec l'obstacle
   * et déclenche l'aberration chromatique (glitch).
   * @param {Vehicle} vehicle
   * @returns {boolean}
   */
  checkCollision(vehicle) {
    if (!vehicle || !vehicle.pos) return false;
    const d = p5.Vector.dist(this.pos, vehicle.pos);
    const distCollision = this.r + vehicle.r;

    if (d < distCollision) {
      // Déclenche le glitch sur le véhicule
      if (typeof vehicle.glitch === 'function') {
        vehicle.glitch(20);
      }
      this.impactTimer = 14; // Déclenche le flash sur l'obstacle
      return true;
    }
    return false;
  }

  /**
   * Dessine l'obstacle avec l'esthétique d'une mire optique LCD vintage.
   */
  show() {
    push();
    translate(this.pos.x, this.pos.y);

    const isGlitching = this.impactTimer > 0;
    if (isGlitching) {
      this.impactTimer--;
    }

    // ── Effet de Glitch Chromatique lors d'un choc ─────────
    if (isGlitching) {
      const shift = 5;
      noFill();
      strokeWeight(1.8);

      // Canal Cyan décalé à gauche
      stroke(0, 240, 255, 200);
      circle(-shift, 0, this.r * 2);

      // Canal Rouge décalé à droite
      stroke(255, 40, 60, 200);
      circle(shift, 0, this.r * 2);
    }

    // ── Rendu Rétro Néon / HUD Caméra ──────────────────────
    // Effet Néon via drawingContext.shadowBlur
    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = this.couleur;

    // Corps principal wireframe
    noFill();
    stroke(this.couleur);
    strokeWeight(1.8);
    circle(0, 0, this.r * 2);

    // Cercle intérieur technique en pointillés
    drawingContext.shadowBlur = 0; // Pas de flou pour la trame fine
    stroke(this.couleur);
    strokeWeight(1);
    drawingContext.setLineDash([4, 4]);
    circle(0, 0, this.r * 1.3);
    drawingContext.setLineDash([]); // Rétablissement du tracé plein

    // 4 encoches de visée optique aux points cardinaux (0, 90, 180, 270 deg)
    const tick = 6;
    stroke(this.couleur);
    strokeWeight(1.5);
    line(this.r - tick, 0, this.r + tick, 0);
    line(-this.r - tick, 0, -this.r + tick, 0);
    line(0, this.r - tick, 0, this.r + tick);
    line(0, -this.r - tick, 0, -this.r + tick);

    // Croix centrale LCD (+)
    stroke(255, 180);
    strokeWeight(1.2);
    line(-4, 0, 4, 0);
    line(0, -4, 0, 4);

    // Label technique rétro
    noStroke();
    fill(200, 230, 215, 140);
    textFont('Courier New, monospace');
    textSize(9);
    textAlign(CENTER, CENTER);
    text(`R${Math.round(this.r)}`, 0, this.r * 0.5);

    pop();
  }
}
