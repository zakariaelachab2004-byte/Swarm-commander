/**
 * ========================================================
 * BehaviorManager.js — Gestionnaire & Bibliothèque d'Algorithmes
 * ========================================================
 * Projet Final Steering — Environnement Indépendant
 *
 * Implémente :
 *  1. Une classe BehaviorManager capable de stocker, pondérer,
 *     activer et désactiver des comportements pour une entité.
 *  2. L'ensemble des algorithmes mathématiques de steering extraits
 *     des dossiers de recherche du professeur (Dossiers 1 à 7) :
 *       - Seek (Dossier 1)
 *       - Flee (Dossier 2)
 *       - Pursue (Dossier 2)
 *       - Evade (Dossier 2 - Prédiction relative)
 *       - Arrive (Dossier 3 - Zone de décélération)
 *       - Wander (Dossier 4 - Cercle projeté & angle aléatoire)
 *       - Obstacle Avoidance (Dossier 6 - Vecteurs ahead & ahead2)
 *       - Flocking (Dossier 7 - Séparation 1/d², Alignement, Cohésion)
 * ========================================================
 */

class BehaviorManager {
  constructor() {
    /**
     * Dictionnaire des comportements enregistrés :
     * clé : nom du comportement (string)
     * valeur : { weight: number, enabled: boolean, calculate: Function }
     */
    this.behaviors = new Map();
  }

  // ── Gestion Dynamique des Comportements ──────────────────

  /**
   * Enregistre un comportement avec son poids initial et sa fonction de calcul.
   * @param {string}   nom        - Nom unique du comportement
   * @param {number}   weight     - Poids multiplicateur (ex: 1.0, 2.5)
   * @param {Function} calculate  - Fonction (vehicle, context) => p5.Vector
   * @returns {BehaviorManager}
   */
  add(nom, weight = 1.0, calculate = null) {
    this.behaviors.set(nom, {
      weight: weight,
      enabled: weight > 0,
      calculate: calculate
    });
    return this;
  }

  /**
   * Modifie le poids d'un comportement.
   * @param {string} nom
   * @param {number} weight
   */
  setWeight(nom, weight) {
    if (this.behaviors.has(nom)) {
      const entry = this.behaviors.get(nom);
      entry.weight = weight;
      entry.enabled = weight > 0;
    }
    return this;
  }

  /**
   * Récupère le poids actuel d'un comportement.
   * @param {string} nom
   * @returns {number}
   */
  getWeight(nom) {
    return this.behaviors.has(nom) ? this.behaviors.get(nom).weight : 0;
  }

  /**
   * Active ou désactive un comportement.
   * @param {string}  nom
   * @param {boolean} enabled
   */
  setEnabled(nom, enabled) {
    if (this.behaviors.has(nom)) {
      this.behaviors.get(nom).enabled = Boolean(enabled);
    }
    return this;
  }

  /**
   * Applique tous les comportements actifs au véhicule en sommant les forces pondérées.
   * Limite ensuite la force composite à vehicle.maxForce et l'applique au véhicule.
   * @param {Vehicle} vehicle   - Entité physique cible
   * @param {object}  context   - Données contextuelles (cibles, obstacles, voisins, etc.)
   */
  applyAll(vehicle, context = {}) {
    let forceTotale = createVector(0, 0);

    for (const [nom, config] of this.behaviors.entries()) {
      if (!config.enabled || config.weight === 0) continue;

      let force = null;

      // Si une fonction de calcul personnalisée a été enregistrée
      if (typeof config.calculate === 'function') {
        force = config.calculate(vehicle, context);
      } else {
        // Résolution automatique par correspondance avec les méthodes statiques
        force = BehaviorManager.evaluer(nom, vehicle, context);
      }

      if (force && force.magSq() > 0) {
        forceTotale.add(p5.Vector.mult(force, config.weight));
      }
    }

    // Limitation globale de la force composite
    forceTotale.limit(vehicle.maxForce);

    // Application physique
    vehicle.applyForce(forceTotale);
  }

  /**
   * Évalue un comportement standard par son nom.
   */
  static evaluer(nom, vehicle, ctx) {
    switch (nom.toLowerCase()) {
      case 'seek':
        return BehaviorManager.seek(vehicle, ctx.target || ctx.proie);
      case 'flee':
        return BehaviorManager.flee(vehicle, ctx.threat || ctx.menace, ctx.distanceDetection);
      case 'arrive':
        return BehaviorManager.arrive(vehicle, ctx.target, ctx.rayonFreinage, ctx.distanceArret);
      case 'pursue':
        return BehaviorManager.pursue(vehicle, ctx.proie || ctx.target, ctx.predictionFrames);
      case 'evade':
        return BehaviorManager.evade(vehicle, ctx.menace || ctx.threat, ctx.maxPrediction);
      case 'wander':
        return BehaviorManager.wander(vehicle, ctx.distanceCercle, ctx.wanderRadius, ctx.displaceRange);
      case 'avoid':
      case 'obstacleavoidance':
        return BehaviorManager.avoidObstacles(vehicle, ctx.obstacles, ctx.aheadDistance, ctx.marge);
      case 'pathfollowing':
      case 'path':
        return BehaviorManager.pathFollowing(vehicle, ctx.path || ctx.chemin, ctx.lookahead);
      case 'leaderfollowing':
      case 'followleader':
      case 'suivileader':
        return BehaviorManager.leaderFollowing(vehicle, ctx.leader, ctx.distanceDerriere, ctx.rayonFreinage);
      case 'separation':
        return BehaviorManager.separation(vehicle, ctx.voisins, ctx.distSeparation);
      case 'alignment':
        return BehaviorManager.alignment(vehicle, ctx.voisins, ctx.distAlignement);
      case 'cohesion':
        return BehaviorManager.cohesion(vehicle, ctx.voisins, ctx.distCohesion);
      case 'flock':
      case 'flocking':
        return BehaviorManager.flocking(vehicle, ctx.voisins, ctx);
      default:
        return createVector(0, 0);
    }
  }

  // ========================================================
  // ── LOGIQUE MATHÉMATIQUE EXTRAITE DES DOSSIERS (1 à 7) ──
  // ========================================================

  /**
   * 1. SEEK — Se diriger vers une cible (Dossier 1)
   * Formule : desired = (target - pos).setMag(maxSpeed) ; force = (desired - vel).limit(maxForce)
   */
  static seek(vehicle, target) {
    if (!target) return createVector(0, 0);
    const targetPos = target.pos || target;

    const desired = p5.Vector.sub(targetPos, vehicle.pos);
    if (desired.magSq() === 0) return createVector(0, 0);

    desired.setMag(vehicle.maxSpeed);
    const force = p5.Vector.sub(desired, vehicle.vel);
    force.limit(vehicle.maxForce);
    return force;
  }

  /**
   * 2. FLEE — Fuir une menace opposée (Dossier 2)
   * Formule : desired = (pos - target).setMag(maxSpeed) ; force = (desired - vel).limit(maxForce)
   */
  static flee(vehicle, target, distanceDetection = Infinity) {
    if (!target) return createVector(0, 0);
    const targetPos = target.pos || target;

    const d = p5.Vector.dist(vehicle.pos, targetPos);
    if (d > distanceDetection) return createVector(0, 0);

    const desired = p5.Vector.sub(vehicle.pos, targetPos);
    if (desired.magSq() === 0) return createVector(0, 0);

    desired.setMag(vehicle.maxSpeed);
    const force = p5.Vector.sub(desired, vehicle.vel);
    force.limit(vehicle.maxForce);
    return force;
  }

  /**
   * 3. ARRIVE — Arrivée avec zone de freinage progressive (Dossier 3)
   * Décélération inversement proportionnelle à la distance sous rayonFreinage.
   */
  static arrive(vehicle, target, rayonFreinage = 100, distanceArret = 0) {
    if (!target) return createVector(0, 0);
    const targetPos = target.pos || target;

    const desired = p5.Vector.sub(targetPos, vehicle.pos);
    const distance = desired.mag();
    if (distance === 0) return createVector(0, 0);

    // Ajustement proportionnel de la vitesse dans la zone tampon
    if (distance < rayonFreinage) {
      const vitesse = map(distance, distanceArret, rayonFreinage, 0, vehicle.maxSpeed);
      desired.setMag(constrain(vitesse, 0, vehicle.maxSpeed));
    } else {
      desired.setMag(vehicle.maxSpeed);
    }

    const force = p5.Vector.sub(desired, vehicle.vel);
    force.limit(vehicle.maxForce);
    return force;
  }

  /**
   * 4. PURSUE — Poursuite prédictive d'une proie en mouvement (Dossier 2)
   * Position future : P_future = P_cible + V_cible × T
   */
  static pursue(vehicle, target, predictionFrames = 15) {
    if (!target || !target.pos) return createVector(0, 0);

    const targetVel = target.vel ? target.vel.copy() : createVector(0, 0);
    const positionFuture = p5.Vector.add(
      target.pos,
      p5.Vector.mult(targetVel, predictionFrames)
    );

    return BehaviorManager.seek(vehicle, positionFuture);
  }

  /**
   * 5. EVADE — Évitement prédictif avec cinématique relative (Dossier 2)
   * Loi de prédiction relative de Reynolds basée sur le rapprochement maximal.
   */
  static evade(vehicle, threat, maxPrediction = 20) {
    if (!threat || !threat.pos) return createVector(0, 0);

    const relPos = p5.Vector.sub(threat.pos, vehicle.pos);
    const relVel = p5.Vector.sub(threat.vel || createVector(0, 0), vehicle.vel);
    const relSpeedSq = relVel.magSq();

    let prediction = 0;
    if (relSpeedSq > 0.0001) {
      prediction = -p5.Vector.dot(relPos, relVel) / relSpeedSq;
      prediction = constrain(prediction, 0, maxPrediction);
    }

    const threatFuture = p5.Vector.add(
      threat.pos,
      p5.Vector.mult(threat.vel || createVector(0, 0), prediction)
    );

    // Si le point de collision prédit est confondu, fuir la position actuelle
    if (p5.Vector.dist(vehicle.pos, threatFuture) < 0.0001) {
      return BehaviorManager.flee(vehicle, threat.pos);
    }

    return BehaviorManager.flee(vehicle, threatFuture);
  }

  /**
   * 6. WANDER — Déambulation organique par projection de cercle (Dossier 4)
   * Cercle devant le véhicule, point cible sur la circonférence avec perturbation angulaire.
   */
  static wander(vehicle, distanceCercle = 120, wanderRadius = 45, displaceRange = 0.25) {
    if (vehicle.wanderTheta === undefined) {
      vehicle.wanderTheta = random(TWO_PI);
    }

    // Déplacement aléatoire de l'angle theta
    vehicle.wanderTheta += random(-displaceRange, displaceRange);

    // Centre du cercle virtuel projeté en avant
    const centreCercle = vehicle.vel.copy();
    if (centreCercle.magSq() === 0) centreCercle.set(1, 0);
    centreCercle.setMag(distanceCercle);
    centreCercle.add(vehicle.pos);

    // Calcul du point sur le cercle selon l'orientation globale
    const theta = vehicle.wanderTheta + vehicle.vel.heading();
    const pointCercle = createVector(
      centreCercle.x + wanderRadius * cos(theta),
      centreCercle.y + wanderRadius * sin(theta)
    );

    // La force est dirigée du véhicule vers ce point
    const force = p5.Vector.sub(pointCercle, vehicle.pos);
    force.setMag(vehicle.maxForce);
    return force;
  }

  /**
   * 7. OBSTACLE AVOIDANCE — Évitement d'obstacles avec anticipation radar (Dossier 6)
   * Utilise un double vecteur d'anticipation (ahead et ahead2 à mi-distance).
   */
  static avoidObstacles(vehicle, obstacles, aheadDistance = 32, marge = 24) {
    if (!obstacles || obstacles.length === 0 || vehicle.vel.magSq() === 0) {
      return createVector(0, 0);
    }

    // Vecteur ahead (regarde en avant) et ahead2 (mi-portée)
    const ahead = vehicle.vel.copy().setMag(aheadDistance * (vehicle.vel.mag() || 1));
    const ahead2 = ahead.copy().mult(0.5);

    const pointAhead1 = p5.Vector.add(vehicle.pos, ahead);
    const pointAhead2 = p5.Vector.add(vehicle.pos, ahead2);

    // Recherche de l'obstacle le plus proche sur la trajectoire
    let plusProcheObs = null;
    let distMin = Infinity;

    for (const obs of obstacles) {
      const d1 = p5.Vector.dist(pointAhead1, obs.pos);
      const d2 = p5.Vector.dist(pointAhead2, obs.pos);
      const dCentre = p5.Vector.dist(vehicle.pos, obs.pos);
      const d = min(d1, min(d2, dCentre));

      if (d < distMin) {
        distMin = d;
        plusProcheObs = obs;
      }
    }

    if (!plusProcheObs) return createVector(0, 0);

    const dAhead1 = p5.Vector.dist(pointAhead1, plusProcheObs.pos);
    const dAhead2 = p5.Vector.dist(pointAhead2, plusProcheObs.pos);
    const pointCritique = (dAhead2 < dAhead1) ? pointAhead2 : pointAhead1;
    const distanceImpact = min(dAhead1, dAhead2);

    // Vérification de risque de collision avec la zone tampon
    const rayonZone = plusProcheObs.r + vehicle.r + marge;

    if (distanceImpact < rayonZone) {
      // Force de répulsion : vecteur radial partant du centre de l'obstacle vers la tête du véhicule
      let avoidance = p5.Vector.sub(pointCritique, plusProcheObs.pos);
      if (avoidance.magSq() === 0) {
        avoidance = p5.Vector.random2D();
      }
      avoidance.setMag(vehicle.maxSpeed);

      const steer = p5.Vector.sub(avoidance, vehicle.vel);
      steer.limit(vehicle.maxForce * 1.5); // Priorité à la survie
      return steer;
    }

    return createVector(0, 0);
  }

  /**
   * 7.5. PATH FOLLOWING — Suivi de chemin par projection scalaire (Dossier 5)
   * Calcule le point lookahead sur le segment le plus proche et applique Seek si hors couloir.
   */
  static pathFollowing(vehicle, path, lookahead = 55) {
    if (!path || !path.points || path.points.length < 2) return createVector(0, 0);
    const res = path.calculerCible(vehicle, lookahead);
    if (!res || !res.dehors || !res.cible) return createVector(0, 0);
    return BehaviorManager.seek(vehicle, res.cible);
  }

  /**
   * 7.6 LEADER FOLLOWING — Suivi de Leader (Craig Reynolds)
   * Calcule un point cible situé en arrière du vecteur vitesse du Leader
   * et applique le comportement Arrive vers ce point.
   * @param {Vehicle} vehicle - L'entité suiveuse (Drone allié)
   * @param {Vehicle} leader  - Le Leader suivi (Joueur)
   * @param {number}  [distanceDerriere=55] - Distance de décrochage arrière
   * @param {number}  [rayonFreinage=75]    - Rayon de décélération Arrive
   * @returns {p5.Vector}
   */
  static leaderFollowing(vehicle, leader, distanceDerriere = 55, rayonFreinage = 75) {
    if (!leader || !leader.pos) return createVector(0, 0);

    // Calcul du point en arrière du vecteur vitesse du Leader
    let tv;
    if (leader.vel && leader.vel.magSq() > 0.05) {
      tv = leader.vel.copy().setMag(-distanceDerriere);
    } else {
      const heading = (leader.heading !== undefined) ? leader.heading : 0;
      tv = p5.Vector.fromAngle(heading + PI).mult(distanceDerriere);
    }

    const pointDerriere = p5.Vector.add(leader.pos, tv);
    return BehaviorManager.arrive(vehicle, pointDerriere, rayonFreinage, 0);
  }

  /**
   * 8.1 FLOCKING : SÉPARATION (Dossier 7)
   * Répulsion inversement proportionnelle au carré de la distance (1/d²).
   */
  static separation(vehicle, boids, perceptionRadius = 35) {
    if (!boids || boids.length === 0) return createVector(0, 0);

    let steer = createVector(0, 0);
    let total = 0;

    for (const other of boids) {
      const d = p5.Vector.dist(vehicle.pos, other.pos);
      if (other !== vehicle && d > 0 && d < perceptionRadius) {
        const diff = p5.Vector.sub(vehicle.pos, other.pos);
        diff.div(d * d); // Loi en 1/d² de Craig Reynolds
        steer.add(diff);
        total++;
      }
    }

    if (total > 0) {
      steer.div(total);
      steer.setMag(vehicle.maxSpeed);
      steer.sub(vehicle.vel);
      steer.limit(vehicle.maxForce);
    }

    return steer;
  }

  /**
   * 8.2 FLOCKING : ALIGNEMENT (Dossier 7)
   * Calcule la moyenne des vitesses des voisins proches.
   */
  static alignment(vehicle, boids, perceptionRadius = 50) {
    if (!boids || boids.length === 0) return createVector(0, 0);

    let steer = createVector(0, 0);
    let total = 0;

    for (const other of boids) {
      const d = p5.Vector.dist(vehicle.pos, other.pos);
      if (other !== vehicle && d > 0 && d < perceptionRadius) {
        steer.add(other.vel);
        total++;
      }
    }

    if (total > 0) {
      steer.div(total);
      steer.setMag(vehicle.maxSpeed);
      steer.sub(vehicle.vel);
      steer.limit(vehicle.maxForce);
    }

    return steer;
  }

  /**
   * 8.3 FLOCKING : COHÉSION (Dossier 7)
   * Se dirige vers le centre de masse des voisins proches.
   */
  static cohesion(vehicle, boids, perceptionRadius = 60) {
    if (!boids || boids.length === 0) return createVector(0, 0);

    let centreDeMasse = createVector(0, 0);
    let total = 0;

    for (const other of boids) {
      const d = p5.Vector.dist(vehicle.pos, other.pos);
      if (other !== vehicle && d > 0 && d < perceptionRadius) {
        centreDeMasse.add(other.pos);
        total++;
      }
    }

    if (total > 0) {
      centreDeMasse.div(total);
      return BehaviorManager.seek(vehicle, centreDeMasse);
    }

    return createVector(0, 0);
  }

  /**
   * 8.4 FLOCKING COMBINÉ (Dossier 7)
   * Somme pondérée : w_sep * Sep + w_align * Align + w_coh * Coh
   */
  static flocking(vehicle, boids, weights = {}) {
    const wSep   = weights.wSep   || 2.0;
    const wAlign = weights.wAlign || 1.2;
    const wCoh   = weights.wCoh   || 1.0;

    const rSep   = weights.distSeparation || 32;
    const rAlign = weights.distAlignement || 50;
    const rCoh   = weights.distCohesion   || 65;

    const fSep   = BehaviorManager.separation(vehicle, boids, rSep).mult(wSep);
    const fAlign = BehaviorManager.alignment(vehicle, boids, rAlign).mult(wAlign);
    const fCoh   = BehaviorManager.cohesion(vehicle, boids, rCoh).mult(wCoh);

    const force = p5.Vector.add(fSep, fAlign).add(fCoh);
    force.limit(vehicle.maxForce);
    return force;
  }
}
