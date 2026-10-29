/**
 * Deterministic 60Hz Plaza, Carousel & 4-Island Miniature Diorama Simulation
 * for QQ Game Hall 3D (QQ游戏大厅 3D — 童年四大经典合集).
 *
 * Pure ES2022 module — zero DOM/WebGL coupling.
 */

import {
  CAROUSEL_RADIUS,
  FIXED_DT,
  GAME_BY_ID,
  GAME_CATALOG,
  resolveGameEntry,
} from '../contracts/catalog.js';

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;

function wrapAngleSigned(rad) {
  let a = (rad + Math.PI) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a - Math.PI;
}

export class PlazaSim {
  constructor(initialGameId = 'tang') {
    const startEntry = resolveGameEntry(initialGameId) || GAME_CATALOG[0];

    this.tick = 0;
    this.simTime = 0;
    this.selectedGameId = startEntry.id;
    this.selectedIndex = startEntry.index;

    // Carousel rotation angle in radians.
    // Island i sits at local angle baseAngle = i * (PI / 2).
    // World angle = baseAngle + carouselAngle.
    // Front-center showcase position is worldAngle === 0 (x = 0, z = +CAROUSEL_RADIUS).
    this.carouselAngle = -startEntry.baseAngle;
    this.targetCarouselAngle = -startEntry.baseAngle;
    this.angularVelocity = 0;
    this.isDragging = false;

    this.penguin = {
      worldPos: { x: 0, y: 0.55, z: 0 },
      waveAngle: 0.35,
      bounceY: 0,
      scarfFlutter: 0,
      lookAtAngle: 0,
      fountainPhase: 0,
      cheerTimer: 0.8,
      cheerCount: 1,
    };

    this._initDioramaStates();
    this._stepDioramas(0);
  }

  _initDioramaStates() {
    // 1. QQ Tang 3D miniature diorama state
    this.tangState = {
      miduo: { x: -0.45, z: 0.35, yaw: 0.4, bobY: 0, stridePhase: 0 },
      bubbles: [
        { id: 'b0', x: 0.0, z: 0.0, scaleXZ: 1.0, scaleY: 1.0, coreYaw: 0 },
        { id: 'b1', x: -0.68, z: -0.48, scaleXZ: 1.0, scaleY: 1.0, coreYaw: 1.2 },
        { id: 'b2', x: 0.68, z: 0.42, scaleXZ: 1.0, scaleY: 1.0, coreYaw: 2.4 },
      ],
      blastCrossScale: 0.2,
      blastActive: false,
      powerupSpinYaw: 0,
    };

    // 2. Synthetic Big Watermelon 3D miniature jar physics state
    this.watermelonState = {
      jarTiltZ: 0,
      mergePulse: 0,
      mergeCount: 0,
      evolutionRingYaw: 0,
      fruits: [
        { tier: 10, name: 'Big Watermelon', radius: 0.34, x: -0.14, y: 0.36, vx: 0.22, vy: 0.05, rotZ: 0.1, omega: 0.9 },
        { tier: 9, name: 'Half-Melon', radius: 0.27, x: 0.26, y: 0.32, vx: -0.25, vy: 0.18, rotZ: -0.3, omega: -1.2 },
        { tier: 7, name: 'Pineapple', radius: 0.22, x: -0.28, y: 0.78, vx: 0.31, vy: 0.12, rotZ: 0.2, omega: 1.5 },
        { tier: 6, name: 'Peach', radius: 0.19, x: 0.18, y: 0.76, vx: -0.28, vy: 0.24, rotZ: 0.0, omega: -1.6 },
        { tier: 2, name: 'Mandarin', radius: 0.15, x: 0.02, y: 1.05, vx: 0.36, vy: 0.30, rotZ: 0.4, omega: 2.1 },
        { tier: 1, name: 'Cherry', radius: 0.12, x: -0.18, y: 1.16, vx: -0.34, vy: 0.25, rotZ: -0.2, omega: -2.4 },
        { tier: 0, name: 'Grape', radius: 0.11, x: 0.22, y: 1.18, vx: 0.29, vy: 0.35, rotZ: 0.5, omega: 2.7 },
      ],
    };

    // 3. QQ Aeroplane Chess 3D miniature cross-board & biplanes state
    this.aeroplaneState = {
      dice: { y: 0.78, rotX: 0.4, rotY: 0.6, rotZ: 0.2, faceTop: 6 },
      runwayPulse: 0,
      planes: [
        { color: 'red', hex: 0xef4444, x: 0, y: 0.5, z: 0.95, yaw: 0, pitch: 0.1, bank: 0.28, propAngle: 0 },
        { color: 'yellow', hex: 0xfacc15, x: 0.95, y: 0.6, z: 0, yaw: HALF_PI, pitch: -0.08, bank: 0.28, propAngle: 1.5 },
        { color: 'blue', hex: 0x3b82f6, x: 0, y: 0.55, z: -0.95, yaw: Math.PI, pitch: 0.09, bank: 0.28, propAngle: 3.0 },
        { color: 'green', hex: 0x22c55e, x: -0.95, y: 0.62, z: 0, yaw: -HALF_PI, pitch: -0.06, bank: 0.28, propAngle: 4.5 },
      ],
    };

    // 4. QQ Bubble Dragon 3D miniature geared cannon & hex cluster state
    this.bubbledragonState = {
      cannonYaw: 0,
      gearAngle: 0,
      dragonBobY: 0,
      dragonWave: 0,
      shotProgress: 0.25,
      projectile: { x: 0, y: 0.48, z: 0.28, colorIndex: 0 },
      popPulse: 0,
      popCycleCount: 0,
      fallingDropY: 0,
    };
  }

  /**
   * Aligns targetCarouselAngle along the shortest signed angular path to place
   * `entry` at worldAngle = 0 (front-center showcase position).
   */
  _setTargetForEntry(entry, immediateNudge = false) {
    const desiredMod = -entry.baseAngle;
    const diff = wrapAngleSigned(desiredMod - this.targetCarouselAngle);
    this.targetCarouselAngle += diff;

    if (immediateNudge) {
      const curDiff = wrapAngleSigned(this.targetCarouselAngle - this.carouselAngle);
      if (Math.abs(curDiff) > 1e-4) {
        this.carouselAngle += curDiff * 0.22;
      }
    }
  }

  /**
   * Selects one of the 4 classic games by id, slug, hash, or index.
   * @param {string|number} idOrIndex
   * @param {object} [opts]
   * @returns {object}
   */
  selectGame(idOrIndex, opts = {}) {
    const entry = resolveGameEntry(idOrIndex);
    if (!entry) {
      return this.getSnapshot();
    }
    const changed = this.selectedGameId !== entry.id;
    this.selectedGameId = entry.id;
    this.selectedIndex = entry.index;
    this.isDragging = false;
    this._setTargetForEntry(entry, Boolean(opts.immediateNudge));

    if (opts.instantSnap) {
      this.carouselAngle = this.targetCarouselAngle;
      this.angularVelocity = 0;
    }

    if (changed || opts.cheer) {
      this.penguin.cheerTimer = 0.95;
      this.penguin.cheerCount += 1;
    }
    return this.getSnapshot();
  }

  /**
   * Rotates the carousel either by discrete island steps (when delta is an integer >= 1
   * and opts.mode !== 'radians') or by continuous radian delta (for 1:1 swipe/drag).
   *
   * @param {number} delta
   * @param {object} [opts]
   * @returns {object}
   */
  rotateCarousel(delta, opts = {}) {
    const num = Number(delta);
    if (!Number.isFinite(num) || num === 0) {
      return this.getSnapshot();
    }

    const forceRadians = opts && opts.mode === 'radians';
    const isDiscreteStep = !forceRadians && Number.isInteger(num) && Math.abs(num) >= 1 && Math.abs(num) <= 16;

    if (isDiscreteStep) {
      const count = GAME_CATALOG.length;
      const nextIdx = (((this.selectedIndex + num) % count) + count) % count;
      const nextEntry = GAME_CATALOG[nextIdx];
      this.selectedGameId = nextEntry.id;
      this.selectedIndex = nextEntry.index;
      // Rotate target angle in the exact requested step direction
      this.targetCarouselAngle -= num * HALF_PI;
      // Advance carouselAngle deterministically so callers inspecting immediately see movement
      const stepDiff = this.targetCarouselAngle - this.carouselAngle;
      this.carouselAngle += stepDiff * 0.28;
      this.angularVelocity = stepDiff * 3.5;
      this.penguin.cheerTimer = 0.85;
      this.penguin.cheerCount += 1;
      return this.getSnapshot();
    }

    // Continuous radian offset (swipe / drag / fractional delta)
    this.carouselAngle += num;
    this.angularVelocity = num / FIXED_DT;

    // Determine which island is now closest to front-center (worldAngle === 0)
    let bestEntry = GAME_CATALOG[0];
    let bestAbsAngle = Infinity;
    for (let i = 0; i < GAME_CATALOG.length; i += 1) {
      const g = GAME_CATALOG[i];
      const worldAngle = wrapAngleSigned(g.baseAngle + this.carouselAngle);
      const absA = Math.abs(worldAngle);
      if (absA < bestAbsAngle) {
        bestAbsAngle = absA;
        bestEntry = g;
      }
    }

    const changed = this.selectedGameId !== bestEntry.id;
    this.selectedGameId = bestEntry.id;
    this.selectedIndex = bestEntry.index;

    const desiredMod = -bestEntry.baseAngle;
    this.targetCarouselAngle = this.carouselAngle + wrapAngleSigned(desiredMod - this.carouselAngle);

    if (changed) {
      this.penguin.cheerTimer = 0.85;
      this.penguin.cheerCount += 1;
    }
    return this.getSnapshot();
  }

  setDragging(dragging) {
    this.isDragging = Boolean(dragging);
    if (!this.isDragging) {
      const entry = GAME_BY_ID[this.selectedGameId] || GAME_CATALOG[0];
      const desiredMod = -entry.baseAngle;
      this.targetCarouselAngle = this.carouselAngle + wrapAngleSigned(desiredMod - this.carouselAngle);
    }
  }

  triggerPenguinCheer() {
    this.penguin.cheerTimer = 1.25;
    this.penguin.cheerCount += 1;
  }

  /**
   * Advances simulation by 1 fixed timestep `dt` (default 1/60s).
   * @param {number} [dt]
   * @returns {object}
   */
  step(dt = FIXED_DT) {
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : FIXED_DT;
    this.tick += 1;
    this.simTime += safeDt;

    // 1. Carousel smooth spring-damper rotation toward targetCarouselAngle
    if (!this.isDragging) {
      const diff = this.targetCarouselAngle - this.carouselAngle;
      if (Math.abs(diff) < 0.0004 && Math.abs(this.angularVelocity) < 0.002) {
        this.carouselAngle = this.targetCarouselAngle;
        this.angularVelocity = 0;
      } else {
        const springK = 68.0;
        const damping = 14.5;
        const accel = springK * diff - damping * this.angularVelocity;
        this.angularVelocity += accel * safeDt;
        this.carouselAngle += this.angularVelocity * safeDt;
      }
    }

    // 2. Central QQ Penguin Host animation
    const t = this.simTime;
    if (this.penguin.cheerTimer > 0) {
      this.penguin.cheerTimer = Math.max(0, this.penguin.cheerTimer - safeDt);
    }
    const cheerBoost = this.penguin.cheerTimer > 0 ? 1.85 : 1.0;
    this.penguin.waveAngle = 0.42 + Math.sin(t * 6.4 * cheerBoost) * (0.48 * cheerBoost);
    this.penguin.bounceY =
      Math.abs(Math.sin(t * 3.8 * cheerBoost)) * (this.penguin.cheerTimer > 0 ? 0.22 : 0.08);
    this.penguin.scarfFlutter = Math.sin(t * 7.5) * 0.28 + Math.cos(t * 4.3) * 0.12;
    this.penguin.lookAtAngle = Math.sin(t * 1.6) * 0.24;
    this.penguin.fountainPhase = (t * 1.45) % 1.0;

    // 3. Step all 4 miniature 3D island dioramas
    this._stepDioramas(safeDt);

    return this.getSnapshot();
  }

  _stepDioramas(dt) {
    const t = this.simTime;

    // --- Island 0: QQ Tang 3D (Candy Bubble Arena) ---
    {
      const ts = this.tangState;
      const walkT = t * 2.1;
      const prevX = ts.miduo.x;
      const prevZ = ts.miduo.z;
      // Figure-8 patrol path around central candy bubble
      const nextX = Math.sin(walkT) * 0.72;
      const nextZ = Math.sin(walkT * 2.0) * 0.42;
      const dx = nextX - prevX;
      const dz = nextZ - prevZ;
      if (Math.hypot(dx, dz) > 0.0005) {
        ts.miduo.yaw = Math.atan2(dx, dz);
      }
      ts.miduo.x = nextX;
      ts.miduo.z = nextZ;
      ts.miduo.bobY = Math.abs(Math.sin(t * 8.5)) * 0.09;
      ts.miduo.stridePhase = t * 8.5;

      for (let i = 0; i < ts.bubbles.length; i += 1) {
        const b = ts.bubbles[i];
        const pulse = Math.sin(t * 5.2 + i * 1.7);
        b.scaleXZ = Number((1.0 + pulse * 0.14).toFixed(4));
        b.scaleY = Number((1.0 - pulse * 0.12).toFixed(4));
        b.coreYaw = Number(((t * 2.4 + i * 1.2) % TWO_PI).toFixed(4));
      }

      const blastCycle = (t * 0.85) % 1.0;
      ts.blastActive = blastCycle > 0.62;
      ts.blastCrossScale = ts.blastActive
        ? Number((0.35 + Math.sin(((blastCycle - 0.62) / 0.38) * Math.PI) * 0.95).toFixed(4))
        : 0.15;
      ts.powerupSpinYaw = Number(((t * 2.8) % TWO_PI).toFixed(4));
    }

    // --- Island 1: Synthetic Big Watermelon 3D (Crystal Jar Rigid-Body Bounce) ---
    {
      const ws = this.watermelonState;
      ws.jarTiltZ = Number((Math.sin(t * 2.2) * 0.045).toFixed(4));
      ws.evolutionRingYaw = Number(((t * 0.9) % TWO_PI).toFixed(4));

      const jarHalfW = 0.62;
      const jarFloorY = 0.06;
      const jarTopY = 1.48;
      const gravity = -3.6;
      const subDt = dt > 0 ? dt * 0.5 : 0;

      if (subDt > 0) {
        // Periodic gentle shake impulse so fruits keep tumbling & bouncing livelily
        const shakeWave = Math.sin(t * 3.1) * 1.15;

        for (let step = 0; step < 2; step += 1) {
          for (let i = 0; i < ws.fruits.length; i += 1) {
            const f = ws.fruits[i];
            f.vy += gravity * subDt;
            f.vx += shakeWave * 0.35 * subDt;
            f.x += f.vx * subDt;
            f.y += f.vy * subDt;
            f.rotZ = (f.rotZ + f.omega * subDt) % TWO_PI;

            // Floor bounce with lively restitution
            if (f.y - f.radius < jarFloorY) {
              f.y = jarFloorY + f.radius;
              f.vy = Math.max(0.85, Math.abs(f.vy) * 0.88);
              f.omega = -f.vx * 2.4;
            }
            if (f.y + f.radius > jarTopY) {
              f.y = jarTopY - f.radius;
              f.vy = -Math.abs(f.vy) * 0.65;
            }
            // Left/Right crystal jar walls
            if (f.x - f.radius < -jarHalfW) {
              f.x = -jarHalfW + f.radius;
              f.vx = Math.abs(f.vx) * 0.85 + 0.12;
              f.omega = -f.omega * 0.8;
            } else if (f.x + f.radius > jarHalfW) {
              f.x = jarHalfW - f.radius;
              f.vx = -Math.abs(f.vx) * 0.85 - 0.12;
              f.omega = -f.omega * 0.8;
            }
          }

          // Pairwise circle-circle elastic depenetration inside the miniature jar
          for (let i = 0; i < ws.fruits.length; i += 1) {
            for (let j = i + 1; j < ws.fruits.length; j += 1) {
              const a = ws.fruits[i];
              const b = ws.fruits[j];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.hypot(dx, dy) || 0.001;
              const minDist = a.radius + b.radius;
              if (dist < minDist) {
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;
                a.x -= nx * overlap * 0.5;
                a.y -= ny * overlap * 0.5;
                b.x += nx * overlap * 0.5;
                b.y += ny * overlap * 0.5;

                const rvx = b.vx - a.vx;
                const rvy = b.vy - a.vy;
                const vn = rvx * nx + rvy * ny;
                if (vn < 0) {
                  const imp = -1.75 * vn * 0.5;
                  a.vx -= imp * nx;
                  a.vy -= imp * ny;
                  b.vx += imp * nx;
                  b.vy += imp * ny;
                }
              }
            }
          }
        }
      }

      const prevCycle = Math.floor(((t - dt) * 0.75));
      const curCycle = Math.floor((t * 0.75));
      if (dt > 0 && curCycle > prevCycle) {
        ws.mergeCount += 1;
      }
      ws.mergePulse = Number((0.5 + 0.5 * Math.sin(t * 4.5)).toFixed(4));
    }

    // --- Island 2: QQ Aeroplane Chess 3D (4 Biplanes + Tumbling 3D Die) ---
    {
      const as = this.aeroplaneState;
      as.dice.y = Number((0.82 + Math.abs(Math.sin(t * 4.2)) * 0.28).toFixed(4));
      as.dice.rotX = Number(((t * 3.1) % TWO_PI).toFixed(4));
      as.dice.rotY = Number(((t * 4.3) % TWO_PI).toFixed(4));
      as.dice.rotZ = Number(((t * 2.5) % TWO_PI).toFixed(4));
      as.dice.faceTop = (Math.floor(t * 1.5) % 6) + 1;
      as.runwayPulse = Number((0.5 + 0.5 * Math.sin(t * 5.0)).toFixed(4));

      const orbitRadius = 1.02;
      for (let i = 0; i < as.planes.length; i += 1) {
        const p = as.planes[i];
        const theta = t * 1.85 + i * HALF_PI;
        p.x = Number((Math.cos(theta) * orbitRadius).toFixed(4));
        p.z = Number((Math.sin(theta) * orbitRadius).toFixed(4));
        // Parabolic "+4 Jump" hops around the perimeter
        const hopWave = Math.abs(Math.sin(theta * 2.0));
        p.y = Number((0.36 + hopWave * 0.28).toFixed(4));
        p.yaw = Number((-theta + Math.PI).toFixed(4));
        p.pitch = Number((Math.cos(theta * 2.0) * 0.18).toFixed(4));
        p.bank = 0.32;
        p.propAngle = Number(((t * 24.0 + i * 1.5) % TWO_PI).toFixed(4));
      }
    }

    // --- Island 3: QQ Bubble Dragon 3D (Geared Cannon + Popping Hex Cluster) ---
    {
      const bs = this.bubbledragonState;
      bs.cannonYaw = Number((Math.sin(t * 2.4) * 0.56).toFixed(4));
      bs.gearAngle = Number(((t * 3.6) % TWO_PI).toFixed(4));
      bs.dragonBobY = Number((Math.abs(Math.sin(t * 5.5)) * 0.11).toFixed(4));
      bs.dragonWave = Number((Math.sin(t * 6.8) * 0.42).toFixed(4));

      const prevShotCycle = Math.floor((t - dt) * 1.15);
      const curShotCycle = Math.floor(t * 1.15);
      if (dt > 0 && curShotCycle > prevShotCycle) {
        bs.popCycleCount += 1;
      }

      const prog = (t * 1.15) % 1.0;
      bs.shotProgress = Number(prog.toFixed(4));
      const aimAngle = Math.sin(curShotCycle * 1.7) * 0.45;
      // Wall-ricochet path from cannon (y=0.32, z=0.45) to top hex cluster (y=1.18, z=-0.35)
      let rawX = Math.sin(aimAngle) * prog * 1.15;
      if (rawX > 0.52) rawX = 1.04 - rawX;
      if (rawX < -0.52) rawX = -1.04 - rawX;
      bs.projectile.x = Number(rawX.toFixed(4));
      bs.projectile.y = Number((0.34 + prog * 0.88).toFixed(4));
      bs.projectile.z = Number((0.46 - prog * 0.82).toFixed(4));
      bs.projectile.colorIndex = Math.abs(curShotCycle) % 6;

      bs.popPulse = prog > 0.78 ? Number(((prog - 0.78) / 0.22).toFixed(4)) : 0;
      bs.fallingDropY = Number((1.05 - ((t * 1.6) % 0.85)).toFixed(4));
    }
  }

  /**
   * Computes current world positions and orientations for all 4 islands and returns
   * a serializable snapshot.
   */
  getSnapshot() {
    const islandAngles = {};
    const games = GAME_CATALOG.map((g) => {
      const worldAngle = wrapAngleSigned(g.baseAngle + this.carouselAngle);
      islandAngles[g.id] = Number(worldAngle.toFixed(4));

      const x = Math.sin(worldAngle) * CAROUSEL_RADIUS;
      const z = Math.cos(worldAngle) * CAROUSEL_RADIUS;
      const frontProximity = Math.max(0, Math.cos(worldAngle)); // 1.0 when at front-center
      const y = 0.18 + frontProximity * 0.26 + Math.sin(this.simTime * 2.2 + g.index * 1.4) * 0.06;
      const scale = 0.94 + frontProximity * 0.24;

      let dioramaState = null;
      if (g.id === 'tang') dioramaState = this.tangState;
      else if (g.id === 'watermelon') dioramaState = this.watermelonState;
      else if (g.id === 'aeroplane') dioramaState = this.aeroplaneState;
      else if (g.id === 'bubbledragon') dioramaState = this.bubbledragonState;

      return {
        id: g.id,
        index: g.index,
        slug: g.slug,
        hash: g.hash,
        titleZh: g.titleZh,
        titleEn: g.titleEn,
        subtitleZh: g.subtitleZh,
        badgeZh: g.badgeZh,
        liveUrl: g.liveUrl,
        repoUrl: g.repoUrl,
        themeColor: g.themeColor,
        accentColor: g.accentColor,
        dioramaSummary: g.dioramaSummary,
        isSelected: g.id === this.selectedGameId,
        worldAngle: Number(worldAngle.toFixed(4)),
        worldPos: {
          x: Number(x.toFixed(4)),
          y: Number(y.toFixed(4)),
          z: Number(z.toFixed(4)),
        },
        scale: Number(scale.toFixed(4)),
        dioramaState,
      };
    });

    const selectedEntry = GAME_BY_ID[this.selectedGameId] || GAME_CATALOG[0];

    return {
      tick: this.tick,
      simTime: Number(this.simTime.toFixed(4)),
      selectedGameId: this.selectedGameId,
      selectedIndex: this.selectedIndex,
      selectedGame: {
        id: selectedEntry.id,
        index: selectedEntry.index,
        slug: selectedEntry.slug,
        hash: selectedEntry.hash,
        titleZh: selectedEntry.titleZh,
        titleEn: selectedEntry.titleEn,
        subtitleZh: selectedEntry.subtitleZh,
        badgeZh: selectedEntry.badgeZh,
        liveUrl: selectedEntry.liveUrl,
        repoUrl: selectedEntry.repoUrl,
        themeColor: selectedEntry.themeColor,
        accentColor: selectedEntry.accentColor,
      },
      carousel: {
        angle: Number(this.carouselAngle.toFixed(4)),
        targetAngle: Number(this.targetCarouselAngle.toFixed(4)),
        angularVelocity: Number(this.angularVelocity.toFixed(4)),
        isDragging: this.isDragging,
        radius: CAROUSEL_RADIUS,
        islandAngles,
      },
      penguinHost: {
        worldPos: {
          x: 0,
          y: Number((0.55 + this.penguin.bounceY).toFixed(4)),
          z: 0,
        },
        waveAngle: Number(this.penguin.waveAngle.toFixed(4)),
        bounceY: Number(this.penguin.bounceY.toFixed(4)),
        scarfFlutter: Number(this.penguin.scarfFlutter.toFixed(4)),
        lookAtAngle: Number(this.penguin.lookAtAngle.toFixed(4)),
        fountainPhase: Number(this.penguin.fountainPhase.toFixed(4)),
        cheerTimer: Number(this.penguin.cheerTimer.toFixed(4)),
        cheerCount: this.penguin.cheerCount,
      },
      games,
    };
  }
}
