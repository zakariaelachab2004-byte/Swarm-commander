/**
 * ========================================================
 * Path.js — Classe de Chemin Vectoriel & Suivi (Path Following)
 * ========================================================
 * Projet Final Steering — Swarm Commander
 *
 * Implémente la classe Path selon l'algorithme de Craig Reynolds (Dossier 5) :
 *  1. Représentation d'un chemin sous forme de segments orientés entre points de contrôle.
 *  2. Projection scalaire (dot product) d'un véhicule sur le segment le plus proche.
 *  3. Détection de déviation (sortie du couloir de tolérance radius).
 *  4. Calcul du point 'lookahead' cible en avant sur le segment pour la force de Seek.
 *  5. Rendu graphique dans le thème Caméra Rétro LCD (pointillés néon et bornes).
 * ========================================================
 */

class Path {
  /**
   * @param {number}  radius - Demi-largeur du couloir de tolérance (px)
   * @param {boolean} loop   - Chemin fermé en boucle (true) ou ouvert (false)
   */
  constructor(radius = 28, loop = true) {
    /** @type {p5.Vector[]} Points de contrôle ordonnés */
    this.points = [];
    /** Zone de tolérance avant déclenchement de la force de correction */
    this.radius = radius;
    /** Indique si le dernier point boucle vers le premier */
    this.loop   = loop;
  }

  // ── Construction du Chemin ────────────────────────────────

  /**
   * Ajoute un point de contrôle (coordonnées ou p5.Vector).
   * @param {number|p5.Vector} x
   * @param {number} [y]
   * @returns {Path}
   */
  addPoint(x, y) {
    if (x instanceof p5.Vector) {
      this.points.push(x.copy());
    } else {
      this.points.push(createVector(x, y));
    }
    return this;
  }

  /**
   * Génère un circuit bouclé optimisé pour la scène de jeu.
   * @param {number} cx - Centre X
   * @param {number} cy - Centre Y
   * @param {number} rx - Rayon horizontal
   * @param {number} ry - Rayon vertical
   * @param {number} [nbPoints=12] - Nombre de points de contrôle
   * @returns {Path}
   */
  genererCircuit(cx, cy, rx, ry, nbPoints = 12) {
    this.points = [];
    for (let i = 0; i < nbPoints; i++) {
      const angle = (TWO_PI * i) / nbPoints;
      // Légère modulation pour un tracé organique non parfaitement elliptique
      const modulation = 1 + 0.12 * sin(angle * 3);
      const x = cx + cos(angle) * rx * modulation;
      const y = cy + sin(angle) * ry * modulation;
      this.points.push(createVector(x, y));
    }
    this.loop = true;
    return this;
  }

  /**
   * Génère un circuit en forme de "8" (lemniscate) centré sur l'écran.
   * @param {number} cx
   * @param {number} cy
   * @param {number} w
   * @param {number} h
   * @param {number} [nbPoints=20]
   * @returns {Path}
   */
  genererHuit(cx, cy, w, h, nbPoints = 20) {
    this.points = [];
    for (let i = 0; i < nbPoints; i++) {
      const t = (TWO_PI * i) / nbPoints;
      const scale = 2 / (3 - cos(2 * t));
      const x = cx + scale * cos(t) * w;
      const y = cy + (scale * sin(2 * t) / 2) * h;
      this.points.push(createVector(x, y));
    }
    this.loop = true;
    return this;
  }

  // ── Mathématiques de Projection (Craig Reynolds) ──────────

  get nbSegments() {
    if (this.points.length < 2) return 0;
    return this.loop ? this.points.length : this.points.length - 1;
  }

  getSegment(i) {
    const n = this.points.length;
    const a = this.points[i % n];
    const b = this.points[(i + 1) % n];
    return { a, b };
  }

  /**
   * Projection scalaire d'un point P sur le segment [A, B].
   * Formule : projection = A + normalize(B - A) * dot(P - A, normalize(B - A))
   * @param {p5.Vector} P
   * @param {p5.Vector} A
   * @param {p5.Vector} B
   */
  static projeterSurSegment(P, A, B) {
    const v1 = p5.Vector.sub(P, A);
    const v2 = p5.Vector.sub(B, A);
    v2.normalize();
    const sp = v1.dot(v2); // Produit scalaire
    const projection = p5.Vector.add(A, p5.Vector.mult(v2, sp));
    return {
      point: projection,
      sp: sp,
      longueur: p5.Vector.dist(A, B)
    };
  }

  /**
   * Calcule le point cible "lookahead" et détermine si le véhicule est hors du couloir.
   * @param {Vehicle} vehicle
   * @param {number}  [lookahead=55] - Distance d'anticipation sur le segment
   * @returns {{ cible: p5.Vector|null, dehors: boolean, projection: p5.Vector|null, distance: number }}
   */
  calculerCible(vehicle, lookahead = 55) {
    if (this.points.length < 2) {
      return { cible: null, dehors: false, projection: null, distance: 0 };
    }

    let meilleureDistance = Infinity;
    let meilleurProjete   = null;
    let meilleurSegIdx    = 0;
    let meilleureSp       = 0;
    let meilleureLong     = 0;

    // Parcours de tous les segments pour trouver la projection la plus proche
    for (let i = 0; i < this.nbSegments; i++) {
      const { a, b } = this.getSegment(i);
      const { point, sp, longueur } = Path.projeterSurSegment(vehicle.pos, a, b);

      // Clamp sur le segment physique
      const spClamped = constrain(sp, 0, longueur);
      const dirSeg = p5.Vector.sub(b, a).normalize();
      const projete = p5.Vector.add(a, p5.Vector.mult(dirSeg, spClamped));
      const dist = p5.Vector.dist(vehicle.pos, projete);

      if (dist < meilleureDistance) {
        meilleureDistance = dist;
        meilleurProjete   = projete;
        meilleurSegIdx    = i;
        meilleureSp       = spClamped;
        meilleureLong     = longueur;
      }
    }

    // Le véhicule dévie s'il est au-delà du rayon du couloir
    const dehors = meilleureDistance > this.radius;

    // Calcul du point lookahead (en avance de phase)
    const { a: segA, b: segB } = this.getSegment(meilleurSegIdx);
    const dirSeg = p5.Vector.sub(segB, segA).normalize();
    const distLookahead = meilleureSp + lookahead;

    let cible;
    if (distLookahead <= meilleureLong) {
      cible = p5.Vector.add(segA, p5.Vector.mult(dirSeg, distLookahead));
    } else {
      // Dépassement sur le segment suivant
      const suivant = (meilleurSegIdx + 1) % this.nbSegments;
      const { a: sA, b: sB } = this.getSegment(suivant);
      const reste = distLookahead - meilleureLong;
      const dirSuiv = p5.Vector.sub(sB, sA).normalize();
      cible = p5.Vector.add(sA, p5.Vector.mult(dirSuiv, constrain(reste, 0, p5.Vector.dist(sA, sB))));
    }

    return {
      cible: cible,
      dehors: dehors,
      projection: meilleurProjete,
      distance: meilleureDistance
    };
  }

  // ── Affichage Rétro-Numérique ──────────────────────────────

  /**
   * Dessine le circuit et son couloir avec un style LCD vintage.
   * @param {boolean} [showRadius=true]
   */
  show(showRadius = true) {
    if (this.points.length < 2) return;

    push();

    // 1. Couloir de tolérance (halo très discret)
    if (showRadius) {
      noFill();
      stroke(0, 240, 255, 18);
      strokeWeight(this.radius * 2);
      this._tracerLigne();
    }

    // 2. Ligne centrale en tirets rétro LCD
    stroke(0, 240, 255, 140);
    strokeWeight(1.8);
    drawingContext.shadowBlur = 6;
    drawingContext.shadowColor = color(0, 240, 255);
    drawingContext.setLineDash([10, 8]);
    this._tracerLigne();
    drawingContext.setLineDash([]);

    // 3. Nœuds de contrôle (cercles filaires de données)
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      stroke(57, 255, 20, 200);
      strokeWeight(1.4);
      noFill();
      circle(p.x, p.y, 8);
      fill(57, 255, 20, 160);
      circle(p.x, p.y, 2.5);
    }

    pop();
  }

  _tracerLigne() {
    beginShape();
    for (const p of this.points) {
      vertex(p.x, p.y);
    }
    if (this.loop) {
      vertex(this.points[0].x, this.points[0].y);
    }
    endShape();
  }
}
