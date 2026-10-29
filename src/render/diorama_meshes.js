/**
 * Bespoke 3D Sky Plaza, Central QQ Penguin Host & 4 Animated Miniature Game Island Dioramas
 * for QQ Game Hall 3D (QQ游戏大厅 3D — 童年四大经典合集).
 *
 * Built on Three.js r170 via relative path import (`../../vendor/three.module.min.js`).
 * Pure relative ES modules, metalness <= 0.20 for vibrant
 * child-friendly toy lighting across hardware GPUs and headless SwiftShader WebGL2.
 */

import * as THREE from '../../vendor/three.module.min.js';
import { CAROUSEL_RADIUS, GAME_CATALOG } from '../contracts/catalog.js';

const textureCache = new Map();

export function configureRendererPipeline(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

export function createStudioEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0xbae6fd);

  const geos = [];
  const mats = [];
  const addLightCard = (geo, hex, intensity, pos, lookOrigin = true) => {
    const color = new THREE.Color(hex).multiplyScalar(intensity);
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (lookOrigin) mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    geos.push(geo);
    mats.push(mat);
    return mesh;
  };

  addLightCard(new THREE.PlaneGeometry(16, 16), 0xffffff, 1.25, [0, 20, 6]);
  addLightCard(new THREE.PlaneGeometry(12, 9), 0xfff7ed, 1.05, [-12, 14, 10]);
  addLightCard(new THREE.PlaneGeometry(12, 9), 0xe0f2fe, 1.05, [12, 14, 10]);
  addLightCard(new THREE.PlaneGeometry(14, 9), 0xf472b6, 0.85, [-16, 6, -6]);
  addLightCard(new THREE.PlaneGeometry(14, 9), 0x38bdf8, 0.85, [16, 6, -6]);
  addLightCard(new THREE.PlaneGeometry(16, 9), 0xfacc15, 0.75, [0, 8, -18]);

  const floor = addLightCard(new THREE.CircleGeometry(24, 24), 0x7dd3fc, 0.65, [0, -10, 0], false);
  floor.rotation.x = -Math.PI * 0.5;

  const envRT = pmrem.fromScene(studio, 0.04);
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  pmrem.dispose();
  return envRT.texture;
}

export function createToyMaterial(hex, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    roughness: opts.roughness ?? 0.28,
    metalness: Math.min(0.18, opts.metalness ?? 0.04),
    clearcoat: opts.clearcoat ?? 0.45,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.22,
    emissive: new THREE.Color(opts.emissive ?? hex),
    emissiveIntensity: opts.emissiveIntensity !== undefined ? opts.emissiveIntensity * 0.35 : 0.02,
    map: opts.map || null,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1.0,
    side: opts.side ?? THREE.FrontSide,
  });
}

function getCanvasTexture(key, w, h, drawFn) {
  if (key && textureCache.has(key)) {
    return textureCache.get(key);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  if (key) textureCache.set(key, tex);
  return tex;
}

function createIslandSignTexture(entry) {
  return getCanvasTexture(`sign:${entry.id}`, 512, 160, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#f0f9ff');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 44);
    ctx.fill();

    ctx.lineWidth = 10;
    ctx.strokeStyle = entry.themeColor;
    ctx.stroke();

    ctx.fillStyle = entry.themeColor;
    ctx.beginPath();
    ctx.roundRect(26, 28, 108, h - 56, 26);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.badgeZh, 80, h * 0.5);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 50px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(entry.titleZh, 152, h * 0.44);

    ctx.fillStyle = '#475569';
    ctx.font = '800 22px "Nunito", "PingFang SC", sans-serif';
    ctx.fillText(entry.titleEn.slice(0, 28), 154, h * 0.77);
  });
}

function createMelonStripeTexture() {
  return getCanvasTexture('watermelon:stripes', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#14532d';
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x + 6, 0);
      for (let y = 0; y <= h; y += 16) {
        const jag = (y / 16) % 2 === 0 ? -4 : 4;
        ctx.lineTo(x + 10 + jag, y);
      }
      for (let y = h; y >= 0; y -= 16) {
        const jag = (y / 16) % 2 === 0 ? 4 : -4;
        ctx.lineTo(x + 22 + jag, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  });
}

function createHalfMelonCutTexture() {
  return getCanvasTexture('watermelon:halfcut', 256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.arc(cx, cy, 112, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.arc(cx, cy, 96, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const sx = cx + Math.cos(a) * 52;
      const sy = cy + Math.sin(a) * 52;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 5, 8, a + Math.PI * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function createAeroplaneBoardTexture() {
  return getCanvasTexture('aeroplane:board', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    // 4 Corner Hangar Pads (Red, Yellow, Blue, Green)
    const corners = [
      { x: 24, y: 312, color: '#ef4444' },
      { x: 312, y: 312, color: '#facc15' },
      { x: 312, y: 24, color: '#3b82f6' },
      { x: 24, y: 24, color: '#22c55e' },
    ];
    for (const c of corners) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, 176, 176, 24);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      for (const [ox, oy] of [[48, 48], [128, 48], [48, 128], [128, 128]]) {
        ctx.beginPath();
        ctx.arc(c.x + ox, c.y + oy, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Cross Home Stretch Lanes
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(228, 280, 56, 200);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(228, 32, 56, 200);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(32, 228, 200, 56);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(280, 228, 200, 56);

    // Dashed Fly-Across diagonal airways
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 6;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(140, 256);
    ctx.lineTo(256, 140);
    ctx.lineTo(372, 256);
    ctx.lineTo(256, 372);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Center Star Goal
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(256, 256, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
}

function createDiceFaceTexture(pipCount) {
  return getCanvasTexture(`dice:face:${pipCount}`, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    const isRed = pipCount === 1 || pipCount === 4;
    ctx.fillStyle = isRed ? '#ef4444' : '#1e293b';
    const r = pipCount === 1 ? 18 : 11;

    const layouts = {
      1: [[64, 64]],
      2: [[36, 36], [92, 92]],
      3: [[32, 32], [64, 64], [96, 96]],
      4: [[36, 36], [92, 36], [36, 92], [92, 92]],
      5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]],
      6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]],
    };
    for (const [px, py] of layouts[pipCount] || layouts[6]) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function tagSubtree(root, key, val) {
  root.traverse((node) => {
    node.userData[key] = val;
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

function createPlazaFloorTexture() {
  return getCanvasTexture('plaza:floor:starlight', 512, 512, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const radGrad = ctx.createRadialGradient(cx, cy, 24, cx, cy, 256);
    radGrad.addColorStop(0.0, '#38bdf8');
    radGrad.addColorStop(0.32, '#60a5fa');
    radGrad.addColorStop(0.68, '#818cf8');
    radGrad.addColorStop(1.0, '#6366f1');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle starlight compass spokes & rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 4;
    for (const r of [76, 148, 212, 244]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
      ctx.lineTo(cx + Math.cos(a) * 246, cy + Math.sin(a) * 246);
      ctx.stroke();
    }
  });
}

/**
 * Builds the Sky Plaza Base, Central Starlight Fountain, 4 Radiant Crystal Bridges,
 * and Decorative Sky Clouds / Starlight Pillars.
 */
export function createSkyPlazaStage() {
  const root = new THREE.Group();

  // 1. Main Sky Plaza Starlight Disc
  const floorTex = createPlazaFloorTexture();
  const mainDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(10.2, 10.8, 0.55, 48),
    createToyMaterial(0xffffff, { map: floorTex, roughness: 0.26, clearcoat: 0.5 })
  );
  mainDisc.position.y = -0.32;
  mainDisc.receiveShadow = true;
  root.add(mainDisc);

  // Golden Plaza Outer Rim Torus
  const outerGoldRim = new THREE.Mesh(
    new THREE.TorusGeometry(10.35, 0.16, 14, 64),
    createToyMaterial(0xfbbf24, { roughness: 0.18, metalness: 0.18, emissive: 0xf59e0b, emissiveIntensity: 0.16 })
  );
  outerGoldRim.rotation.x = Math.PI * 0.5;
  outerGoldRim.position.y = 0.02;
  root.add(outerGoldRim);

  // Decorative Starlight Compass Ring on Plaza Floor
  const innerTrackRing = new THREE.Mesh(
    new THREE.RingGeometry(CAROUSEL_RADIUS - 0.35, CAROUSEL_RADIUS + 0.35, 64),
    createToyMaterial(0xbae6fd, { roughness: 0.15, emissive: 0x38bdf8, emissiveIntensity: 0.25, side: THREE.DoubleSide })
  );
  innerTrackRing.rotation.x = -Math.PI * 0.5;
  innerTrackRing.position.y = 0.015;
  root.add(innerTrackRing);

  // Central Starlight Fountain Basin (2-tier crystal water pool)
  const basinOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.55, 0.36, 36),
    createToyMaterial(0xffffff, { roughness: 0.16, clearcoat: 0.9 })
  );
  basinOuter.position.y = 0.18;
  root.add(basinOuter);

  const basinWater = new THREE.Mesh(
    new THREE.CylinderGeometry(2.12, 2.12, 0.38, 36),
    createToyMaterial(0x38bdf8, { roughness: 0.10, clearcoat: 1.0, emissive: 0x0284c7, emissiveIntensity: 0.28 })
  );
  basinWater.position.y = 0.19;
  root.add(basinWater);

  const centerPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.38, 0.56, 32),
    createToyMaterial(0xfef3c7, { roughness: 0.18, emissive: 0xfbbf24, emissiveIntensity: 0.14 })
  );
  centerPedestal.position.y = 0.32;
  root.add(centerPedestal);

  const pedestalGoldHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1.26, 0.08, 12, 36),
    createToyMaterial(0xfbbf24, { roughness: 0.16, metalness: 0.18, emissive: 0xf59e0b, emissiveIntensity: 0.24 })
  );
  pedestalGoldHalo.rotation.x = Math.PI * 0.5;
  pedestalGoldHalo.position.y = 0.56;
  root.add(pedestalGoldHalo);

  // 12 Animated Fountain Water-Jet Droplets around the central Penguin Pedestal
  const fountainDrops = [];
  const dropGeo = new THREE.SphereGeometry(0.11, 12, 10);
  const dropMat = createToyMaterial(0x7dd3fc, { roughness: 0.08, clearcoat: 1.0, emissive: 0x38bdf8, emissiveIntensity: 0.35 });
  for (let i = 0; i < 12; i += 1) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    const angle = (i / 12) * Math.PI * 2;
    m.position.set(Math.cos(angle) * 1.65, 0.5, Math.sin(angle) * 1.65);
    root.add(m);
    fountainDrops.push({ mesh: m, angle, phaseOffset: i / 12 });
  }

  // 8 Pastel Arcade Lamp Pillars around the outer sky balcony
  const lampColors = [0x38bdf8, 0xf472b6, 0x22c55e, 0xfacc15];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = 9.75;
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);

    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.65, 14),
      createToyMaterial(0xffffff, { roughness: 0.2 })
    );
    col.position.y = 0.82;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 14),
      createToyMaterial(lampColors[i % lampColors.length], {
        roughness: 0.1,
        emissive: lampColors[i % lampColors.length],
        emissiveIntensity: 0.45,
      })
    );
    orb.position.y = 1.78;
    pillarGroup.add(col, orb);
    root.add(pillarGroup);
  }

  // Puff Sky Clouds floating around the distant horizon
  const cloudMat = createToyMaterial(0xffffff, { roughness: 0.35, emissive: 0xe0f2fe, emissiveIntensity: 0.18 });
  const cloudPositions = [
    [-11.5, 4.2, -9.5, 1.3],
    [11.8, 4.6, -8.8, 1.25],
    [-13.0, 3.2, 2.5, 1.1],
    [13.2, 3.5, 2.8, 1.15],
    [0.0, 5.4, -12.5, 1.45],
  ];
  const clouds = [];
  for (let i = 0; i < cloudPositions.length; i += 1) {
    const [cx, cy, cz, sc] = cloudPositions[i];
    const cg = new THREE.Group();
    cg.position.set(cx, cy, cz);
    cg.scale.setScalar(sc);
    const p0 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 12), cloudMat);
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), cloudMat);
    p1.position.set(-0.78, -0.12, 0.1);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.76, 12, 10), cloudMat);
    p2.position.set(0.82, -0.1, -0.08);
    cg.add(p0, p1, p2);
    root.add(cg);
    clouds.push({ group: cg, baseY: cy, phase: i * 1.3 });
  }

  return {
    root,
    fountainDrops,
    clouds,
    pedestalGoldHalo,
  };
}

/**
 * Builds the Central 3D Classic QQ Penguin Host with Iconic Red Winter Scarf,
 * Waving Right Flipper, Golden Star Wand, and Expressive Glossy Eyes/Beak.
 */
export function createPenguinHostRig() {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const navyMat = createToyMaterial(0x1e293b, {
    roughness: 0.18,
    clearcoat: 0.85,
    emissive: 0x0f172a,
    emissiveIntensity: 0.15,
  });
  const whiteMat = createToyMaterial(0xffffff, {
    roughness: 0.16,
    clearcoat: 0.75,
    emissive: 0xf8fafc,
    emissiveIntensity: 0.12,
  });
  const scarfRedMat = createToyMaterial(0xef4444, {
    roughness: 0.22,
    clearcoat: 0.6,
    emissive: 0xdc2626,
    emissiveIntensity: 0.22,
  });
  const beakOrangeMat = createToyMaterial(0xf59e0b, {
    roughness: 0.16,
    clearcoat: 0.85,
    emissive: 0xd97706,
    emissiveIntensity: 0.2,
  });
  const goldMat = createToyMaterial(0xfacc15, {
    roughness: 0.16,
    metalness: 0.18,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.3,
  });

  // 1. Plump Torso + Head
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.78, 28, 24), navyMat);
  torso.scale.set(1.0, 1.18, 0.92);
  torso.position.y = 0.95;
  bodyPivot.add(torso);

  // 2. Snowy White Belly Patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.66, 24, 20), whiteMat);
  belly.scale.set(0.88, 0.98, 0.55);
  belly.position.set(0, 0.86, 0.44);
  bodyPivot.add(belly);

  // 3. Head Group (allows subtle head-tilt & lookAt)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0.05);
  bodyPivot.add(headGroup);

  // Eyes (White sclera + glossy dark pupils + catchlight dots)
  const pupilMat = createToyMaterial(0x0f172a, { roughness: 0.08, clearcoat: 1.0 });
  for (const dir of [-1, 1]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 14), whiteMat);
    sclera.scale.set(0.85, 1.15, 0.55);
    sclera.position.set(dir * 0.23, 0.12, 0.62);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), pupilMat);
    pupil.scale.set(0.85, 1.15, 0.6);
    pupil.position.set(dir * 0.21, 0.12, 0.69);

    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), whiteMat);
    catchlight.position.set(dir * 0.21 + 0.03, 0.17, 0.74);

    // Cute rosy cheeks
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      createToyMaterial(0xf472b6, { emissive: 0xec4899, emissiveIntensity: 0.25 })
    );
    cheek.scale.set(1.2, 0.7, 0.4);
    cheek.position.set(dir * 0.38, -0.02, 0.58);

    headGroup.add(sclera, pupil, catchlight, cheek);
  }

  // Plump Yellow-Orange Penguin Beak
  const upperBeak = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), beakOrangeMat);
  upperBeak.scale.set(1.35, 0.52, 0.95);
  upperBeak.position.set(0, -0.03, 0.68);
  headGroup.add(upperBeak);

  // Cute Golden Arcade Host Crown Cap on top of Penguin's head
  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.16, 16), goldMat);
  crownBase.position.set(0, 0.46, 0.02);
  const crownGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    createToyMaterial(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.4 })
  );
  crownGem.position.set(0, 0.58, 0.18);
  headGroup.add(crownBase, crownGem);

  // 4. Iconic Classic Red QQ Scarf (Neck Torus + Fluttering Scarf Tail)
  const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 16, 36), scarfRedMat);
  scarfRing.rotation.x = Math.PI * 0.5 + 0.08;
  scarfRing.position.set(0, 1.32, 0.06);
  bodyPivot.add(scarfRing);

  const scarfKnot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), scarfRedMat);
  scarfKnot.position.set(0.34, 1.24, 0.56);
  bodyPivot.add(scarfKnot);

  const scarfTailPivot = new THREE.Group();
  scarfTailPivot.position.set(0.36, 1.20, 0.58);
  const scarfTailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.56, 0.08), scarfRedMat);
  scarfTailMesh.position.set(0.05, -0.24, 0.04);
  const scarfTipGold = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.08, 0.09), goldMat);
  scarfTipGold.position.set(0.05, -0.50, 0.04);
  scarfTailPivot.add(scarfTailMesh, scarfTipGold);
  bodyPivot.add(scarfTailPivot);

  // 5. Waving Right Flipper Wing + Star Wand Left Flipper Wing
  const rightWingPivot = new THREE.Group();
  rightWingPivot.position.set(0.72, 1.15, 0.08);
  const rightWingMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), navyMat);
  rightWingMesh.scale.set(0.45, 1.45, 0.65);
  rightWingMesh.position.set(0.14, 0.24, 0);
  rightWingPivot.add(rightWingMesh);
  bodyPivot.add(rightWingPivot);

  const leftWingPivot = new THREE.Group();
  leftWingPivot.position.set(-0.72, 1.12, 0.08);
  const leftWingMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), navyMat);
  leftWingMesh.scale.set(0.45, 1.45, 0.65);
  leftWingMesh.position.set(-0.14, -0.18, 0.06);
  leftWingMesh.rotation.z = 0.38;

  // Golden Star Wand in left flipper
  const wandStick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.68, 10), goldMat);
  wandStick.position.set(-0.28, 0.08, 0.28);
  wandStick.rotation.z = 0.35;
  wandStick.rotation.x = 0.25;
  const wandStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), goldMat);
  wandStar.position.set(-0.40, 0.38, 0.36);
  leftWingPivot.add(leftWingMesh, wandStick, wandStar);
  bodyPivot.add(leftWingPivot);

  // 6. Webbed Orange Feet
  for (const dir of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), beakOrangeMat);
    foot.scale.set(1.05, 0.42, 1.38);
    foot.position.set(dir * 0.34, 0.12, 0.22);
    bodyPivot.add(foot);
  }

  // Invisible click/raycast cylinder around the Penguin Host
  const hitCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 2.4, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitCylinder.position.y = 1.2;
  root.add(hitCylinder);

  tagSubtree(root, 'isPenguinHost', true);

  let meshCount = 0;
  root.traverse((n) => {
    if (n.isMesh && n.material?.visible !== false) meshCount += 1;
  });

  return {
    root,
    bodyPivot,
    headGroup,
    rightWingPivot,
    leftWingPivot,
    scarfTailPivot,
    wandStar,
    meshCount,
  };
}

export function updatePenguinHostRig(rig, penguinState, simTime) {
  if (!rig || !penguinState) return;
  rig.root.position.set(
    penguinState.worldPos.x,
    penguinState.worldPos.y,
    penguinState.worldPos.z
  );
  rig.rightWingPivot.rotation.z = -0.35 + penguinState.waveAngle;
  rig.rightWingPivot.rotation.x = Math.sin(simTime * 5.2) * 0.18;
  rig.leftWingPivot.rotation.z = Math.sin(simTime * 3.4) * 0.14;
  rig.scarfTailPivot.rotation.z = 0.18 + penguinState.scarfFlutter;
  rig.scarfTailPivot.rotation.x = Math.abs(penguinState.scarfFlutter) * 0.35;
  rig.headGroup.rotation.y = penguinState.lookAtAngle;
  rig.headGroup.rotation.z = Math.sin(simTime * 2.8) * 0.07;
  rig.wandStar.rotation.y = simTime * 3.2;
}

/**
 * Shared floating sky-island base pedestal with glowing selection halo & 3D Title Sign.
 */
function createIslandPedestalBase(entry) {
  const root = new THREE.Group();

  // Top grass/stage deck
  const topDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.28, 0.34, 36),
    createToyMaterial(0xffffff, { roughness: 0.18, clearcoat: 0.8 })
  );
  topDeck.position.y = -0.17;
  root.add(topDeck);

  // Colored theme rim
  const rimTorus = new THREE.Mesh(
    new THREE.TorusGeometry(2.20, 0.11, 14, 48),
    createToyMaterial(entry.pedestalHex, {
      roughness: 0.16,
      emissive: entry.pedestalHex,
      emissiveIntensity: 0.25,
    })
  );
  rimTorus.rotation.x = Math.PI * 0.5;
  rimTorus.position.y = -0.02;
  root.add(rimTorus);

  // Sculpted floating rock/crystal underside cone
  const underCrystal = new THREE.Mesh(
    new THREE.ConeGeometry(1.75, 0.42, 16),
    createToyMaterial(entry.rimHex, {
      roughness: 0.24,
      emissive: entry.pedestalHex,
      emissiveIntensity: 0.12,
    })
  );
  underCrystal.rotation.x = Math.PI;
  underCrystal.position.y = -0.45;
  root.add(underCrystal);

  // Glowing Golden Selection Halo Ring around base (pulsed when selected!)
  const selectionHalo = new THREE.Mesh(
    new THREE.TorusGeometry(2.42, 0.085, 14, 56),
    createToyMaterial(0xfacc15, {
      roughness: 0.14,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.45,
    })
  );
  selectionHalo.rotation.x = Math.PI * 0.5;
  selectionHalo.position.y = 0.04;
  root.add(selectionHalo);

  // 3D Title Nameplate Sign mounted cleanly at the front rim of the island above the plaza floor
  const signTex = createIslandSignTexture(entry);
  const signPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 0.56),
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
  );
  signPlate.position.set(0, 0.26, 2.15);
  signPlate.rotation.x = -0.42;
  root.add(signPlate);

  // Generous invisible raycast collider cylinder covering the entire island & diorama
  const collider = new THREE.Mesh(
    new THREE.CylinderGeometry(2.45, 2.45, 2.8, 20),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  collider.position.y = 0.95;
  root.add(collider);

  const dioramaMount = new THREE.Group();
  dioramaMount.position.y = 0.02;
  root.add(dioramaMount);

  return {
    root,
    dioramaMount,
    selectionHalo,
    signPlate,
  };
}

/**
 * Island 0: QQ Tang 3D (`tang`) — Candy Checkerboard Floor, 3 Bouncing Translucent Sugar
 * Bubbles with Swirl Cores, 4-Way Water Blast Cross, Candy Blocks & Chibi MiDuo!
 */
function buildTangIslandRig(entry) {
  const base = createIslandPedestalBase(entry);
  const mount = base.dioramaMount;

  // Candy Town checkerboard tiles (5x5 miniature grid)
  const tilePink = createToyMaterial(0xfbcfe8, { roughness: 0.2 });
  const tileCream = createToyMaterial(0xfff1f2, { roughness: 0.2 });
  const tileGeo = new THREE.BoxGeometry(0.56, 0.08, 0.56);
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      if (Math.hypot(r, c) > 2.6) continue;
      const tile = new THREE.Mesh(tileGeo, (r + c) % 2 === 0 ? tilePink : tileCream);
      tile.position.set(c * 0.58, 0.04, r * 0.58);
      mount.add(tile);
    }
  }

  // 4 Candy Soft Blocks at corners of miniature arena
  const blockMat = createToyMaterial(0xf472b6, { emissive: 0xdb2777, emissiveIntensity: 0.18 });
  const icingMat = createToyMaterial(0xffffff, { roughness: 0.15 });
  const cornerCoords = [
    [-1.12, -0.82],
    [1.12, -0.82],
    [-1.12, 0.82],
    [1.12, 0.82],
  ];
  for (const [bx, bz] of cornerCoords) {
    const blk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.46), blockMat);
    blk.position.set(bx, 0.25, bz);
    const icing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.10, 0.48), icingMat);
    icing.position.set(bx, 0.46, bz);
    mount.add(blk, icing);
  }

  // 3 Bouncing Translucent Sugar Bubbles + Inner Candy Swirl Cores
  const bubbleShellMat = createToyMaterial(0x38bdf8, {
    roughness: 0.08,
    clearcoat: 1.0,
    emissive: 0x0284c7,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.76,
  });
  const coreStarMat = createToyMaterial(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.45 });
  const bubbleMeshes = [];

  for (let i = 0; i < 3; i += 1) {
    const bg = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 22, 18), bubbleShellMat);
    shell.position.y = 0.36;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), coreStarMat);
    core.position.y = 0.36;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.035, 10, 24),
      createToyMaterial(0xffffff, { emissive: 0x38bdf8, emissiveIntensity: 0.3 })
    );
    ring.position.y = 0.36;
    bg.add(shell, core, ring);
    mount.add(bg);
    bubbleMeshes.push({ group: bg, shell, core, ring });
  }

  // 4-Way Water Blast Cross Beams radiating from center bubble
  const blastGroup = new THREE.Group();
  blastGroup.position.set(0, 0.24, 0);
  const beamMat = createToyMaterial(0x67e8f9, {
    roughness: 0.1,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.45,
  });
  const beamX = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.1, 14), beamMat);
  beamX.rotation.z = Math.PI * 0.5;
  const beamZ = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.1, 14), beamMat);
  beamZ.rotation.x = Math.PI * 0.5;
  blastGroup.add(beamX, beamZ);
  mount.add(blastGroup);

  // Chibi MiDuo Character (Green Pom-Pom Helmet, Goggles, Peach Head, Red Shirt)
  const miduoGroup = new THREE.Group();
  const helmetMat = createToyMaterial(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.2 });
  const skinMat = createToyMaterial(0xffd8bc, { roughness: 0.25 });
  const shirtMat = createToyMaterial(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 0.18 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.30, 14), shirtMat);
  body.position.y = 0.24;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 16), skinMat);
  head.position.y = 0.54;
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    helmetMat
  );
  helmet.position.y = 0.56;
  const pomPom = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    createToyMaterial(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.35 })
  );
  pomPom.position.set(0, 0.85, 0);

  // MiDuo cute eyes
  const eyeMat = createToyMaterial(0x1e293b, { roughness: 0.1 });
  for (const dir of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), eyeMat);
    eye.position.set(dir * 0.085, 0.52, 0.22);
    miduoGroup.add(eye);
  }
  miduoGroup.add(body, head, helmet, pomPom);
  mount.add(miduoGroup);

  return {
    ...base,
    id: 'tang',
    bubbleMeshes,
    blastGroup,
    miduoGroup,
  };
}

/**
 * Island 1: Synthetic Big Watermelon 3D (`watermelon`) — Warm Wood Tabletop, Evolution Ring,
 * Translucent Bevelled Crystal Glass Jar, and 7 Tumbling Bespoke 3D Fruits!
 */
function buildWatermelonIslandRig(entry) {
  const base = createIslandPedestalBase(entry);
  const mount = base.dioramaMount;

  // Honey-wood tabletop disc
  const woodDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(1.78, 1.86, 0.12, 32),
    createToyMaterial(0xfbbf24, { roughness: 0.28, emissive: 0xd97706, emissiveIntensity: 0.12 })
  );
  woodDeck.position.y = 0.06;
  mount.add(woodDeck);

  // Evolution Chain Ring of miniature fruit gems around the jar base
  const evoRingGroup = new THREE.Group();
  evoRingGroup.position.y = 0.16;
  const evoColors = [0x9333ea, 0xef4444, 0xf97316, 0xfacc15, 0x84cc16, 0xf43f5e, 0xfb7185, 0xeab308, 0x16a34a];
  for (let i = 0; i < evoColors.length; i += 1) {
    const a = (i / evoColors.length) * Math.PI * 2;
    const gem = new THREE.Mesh(
      new THREE.SphereGeometry(0.09 + i * 0.008, 12, 10),
      createToyMaterial(evoColors[i], { emissive: evoColors[i], emissiveIntensity: 0.22 })
    );
    gem.position.set(Math.cos(a) * 1.42, 0.05, Math.sin(a) * 1.42);
    evoRingGroup.add(gem);
  }
  mount.add(evoRingGroup);

  // Crystal Glass Jar Container Group
  const jarGroup = new THREE.Group();
  jarGroup.position.y = 0.12;
  mount.add(jarGroup);

  // Jar Left/Right/Back bevelled crystal pillars & rim so interior 3D fruits are 100% sharp!
  const crystalMat = createToyMaterial(0xe0f2fe, {
    roughness: 0.08,
    clearcoat: 1.0,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.42,
  });
  const wallGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.56, 12);
  for (const sx of [-0.72, 0.72]) {
    const post = new THREE.Mesh(wallGeo, crystalMat);
    post.position.set(sx, 0.78, 0);
    jarGroup.add(post);
  }
  const jarRimTop = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.055, 12, 36),
    createToyMaterial(0xf43f5e, { emissive: 0xe11d48, emissiveIntensity: 0.35 })
  );
  jarRimTop.rotation.x = Math.PI * 0.5;
  jarRimTop.position.y = 1.55;
  const jarRimBot = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.065, 12, 36),
    createToyMaterial(0xfbbf24, { emissive: 0xd97706, emissiveIntensity: 0.25 })
  );
  jarRimBot.rotation.x = Math.PI * 0.5;
  jarRimBot.position.y = 0.05;
  jarGroup.add(jarRimTop, jarRimBot);

  // 7 Bespoke 3D Fruits inside the Jar (matching watermelonState.fruits)
  const stripeTex = createMelonStripeTexture();
  const halfCutTex = createHalfMelonCutTexture();
  const fruitSpec = [
    { tier: 10, radius: 0.34, hex: 0x22c55e, map: stripeTex, crown: 'vine' },
    { tier: 9, radius: 0.27, hex: 0xfb7185, map: halfCutTex, crown: 'leaf' },
    { tier: 7, radius: 0.22, hex: 0xfacc15, map: null, crown: 'pineapple' },
    { tier: 6, radius: 0.19, hex: 0xf472b6, map: null, crown: 'leaf' },
    { tier: 2, radius: 0.15, hex: 0xf97316, map: null, crown: 'leaf' },
    { tier: 1, radius: 0.12, hex: 0xef4444, map: null, crown: 'stem' },
    { tier: 0, radius: 0.11, hex: 0x9333ea, map: null, crown: 'none' },
  ];

  const fruitMeshes = [];
  const leafMat = createToyMaterial(0x16a34a, { emissive: 0x15803d, emissiveIntensity: 0.22 });
  const eyeDarkMat = createToyMaterial(0x0f172a, { roughness: 0.1 });

  for (let i = 0; i < fruitSpec.length; i += 1) {
    const sp = fruitSpec[i];
    const fg = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(sp.radius, 20, 16),
      createToyMaterial(sp.hex, {
        map: sp.map,
        roughness: 0.16,
        clearcoat: 0.85,
        emissive: sp.hex,
        emissiveIntensity: 0.14,
      })
    );
    fg.add(sphere);

    // Cute glossy eyes on the front (+Z) of each 3D fruit
    for (const dir of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(sp.radius * 0.16, 10, 8), eyeDarkMat);
      eye.position.set(dir * sp.radius * 0.34, sp.radius * 0.12, sp.radius * 0.90);
      fg.add(eye);
    }

    // Bespoke 3D crown / leaf / stem detail
    if (sp.crown === 'pineapple') {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(sp.radius * 0.55, sp.radius * 0.8, 7), leafMat);
      crown.position.y = sp.radius * 1.15;
      fg.add(crown);
    } else if (sp.crown === 'vine' || sp.crown === 'leaf') {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(sp.radius * 0.28, 10, 8), leafMat);
      leaf.scale.set(1.5, 0.45, 0.8);
      leaf.position.set(0.04, sp.radius * 1.02, 0);
      fg.add(leaf);
    } else if (sp.crown === 'stem') {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, sp.radius * 0.9, 8),
        leafMat
      );
      stem.position.y = sp.radius * 1.25;
      fg.add(stem);
    }

    jarGroup.add(fg);
    fruitMeshes.push(fg);
  }

  // Golden Watermelon Merge Sparkle Halo above jar
  const mergeSparkleRing = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    createToyMaterial(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.55 })
  );
  mergeSparkleRing.position.set(0, 1.72, 0);
  jarGroup.add(mergeSparkleRing);

  return {
    ...base,
    id: 'watermelon',
    evoRingGroup,
    jarGroup,
    fruitMeshes,
    mergeSparkleRing,
  };
}

/**
 * Island 2: QQ Aeroplane Chess 3D (`aeroplane`) — 4-Color Cross Board, 4 Bespoke 3D Biplanes
 * with Spinning Propellers & Pilot Heads, and a Central Tumbling 3D Spotted Die!
 */
function buildAeroplaneIslandRig(entry) {
  const base = createIslandPedestalBase(entry);
  const mount = base.dioramaMount;

  // Cross-Board Tabletop Slab with baked 4-color Ludo/Aeroplane texture
  const boardTex = createAeroplaneBoardTexture();
  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.14, 2.45),
    createToyMaterial(0xffffff, { map: boardTex, roughness: 0.2 })
  );
  boardMesh.position.y = 0.08;
  mount.add(boardMesh);

  // 4 Corner Hangar Launch Rings
  const cornerSpecs = [
    [-0.85, 0.85, 0xef4444],
    [0.85, 0.85, 0xfacc15],
    [0.85, -0.85, 0x3b82f6],
    [-0.85, -0.85, 0x22c55e],
  ];
  for (const [cx, cz, hex] of cornerSpecs) {
    const pad = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.04, 10, 24),
      createToyMaterial(hex, { emissive: hex, emissiveIntensity: 0.3 })
    );
    pad.rotation.x = Math.PI * 0.5;
    pad.position.set(cx, 0.17, cz);
    mount.add(pad);
  }

  // Central Crystal Dice Pedestal + Tumbling 6-Face 3D Die
  const diceMats = [
    createToyMaterial(0xffffff, { map: createDiceFaceTexture(1) }),
    createToyMaterial(0xffffff, { map: createDiceFaceTexture(6) }),
    createToyMaterial(0xffffff, { map: createDiceFaceTexture(2) }),
    createToyMaterial(0xffffff, { map: createDiceFaceTexture(5) }),
    createToyMaterial(0xffffff, { map: createDiceFaceTexture(3) }),
    createToyMaterial(0xffffff, { map: createDiceFaceTexture(4) }),
  ];
  const diceMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), diceMats);
  diceMesh.position.set(0, 0.85, 0);
  mount.add(diceMesh);

  // 4 Colored 3D Toy Biplanes with Fuselage, Double Wings, Tailfin, Pilot Head & Spinning Propeller
  const planeColors = [0xef4444, 0xfacc15, 0x3b82f6, 0x22c55e];
  const whiteTrimMat = createToyMaterial(0xffffff, { roughness: 0.18 });
  const pilotMat = createToyMaterial(0xffd8bc, { roughness: 0.22 });
  const propMat = createToyMaterial(0xfbbf24, { emissive: 0xd97706, emissiveIntensity: 0.3 });

  const planeRigs = [];
  for (let i = 0; i < 4; i += 1) {
    const pg = new THREE.Group();
    const bodyMat = createToyMaterial(planeColors[i], {
      roughness: 0.18,
      clearcoat: 0.85,
      emissive: planeColors[i],
      emissiveIntensity: 0.2,
    });

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.52, 14), bodyMat);
    fuselage.rotation.x = Math.PI * 0.5;
    const noseCone = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), whiteTrimMat);
    noseCone.position.z = 0.26;

    const topWing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.16), bodyMat);
    topWing.position.set(0, 0.10, 0.04);
    const botWing = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.035, 0.15), whiteTrimMat);
    botWing.position.set(0, -0.05, 0.04);

    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.14), bodyMat);
    tailFin.position.set(0, 0.09, -0.22);

    const pilotHead = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), pilotMat);
    pilotHead.position.set(0, 0.12, -0.04);

    const propBlade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.02), propMat);
    propBlade.position.set(0, 0, 0.33);

    pg.add(fuselage, noseCone, topWing, botWing, tailFin, pilotHead, propBlade);
    mount.add(pg);
    planeRigs.push({ group: pg, propBlade });
  }

  return {
    ...base,
    id: 'aeroplane',
    diceMesh,
    planeRigs,
  };
}

/**
 * Island 3: QQ Bubble Dragon 3D (`bubbledragon`) — Crystal Arcade Frame, 5 Bonus Cauldrons,
 * Geared Brass Bubble Cannon, Chibi Green Bubble Dragon, and Rainbow Hex Bubble Cluster!
 */
function buildBubbleDragonIslandRig(entry) {
  const base = createIslandPedestalBase(entry);
  const mount = base.dioramaMount;

  // Arcade Stage Floor & Crystal Side Rails
  const stageFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.82, 0.10, 32),
    createToyMaterial(0xf3e8ff, { roughness: 0.2 })
  );
  stageFloor.position.y = 0.05;
  mount.add(stageFloor);

  const railMat = createToyMaterial(0xa855f7, { emissive: 0x7e22ce, emissiveIntensity: 0.25 });
  for (const sx of [-1.18, 1.18]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.65, 12), railMat);
    rail.position.set(sx, 0.85, -0.25);
    mount.add(rail);
  }
  const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.48, 12), railMat);
  topBar.rotation.z = Math.PI * 0.5;
  topBar.position.set(0, 1.66, -0.25);
  mount.add(topBar);

  // 5 Glowing Bonus Cauldrons along front edge
  const cauldronHexes = [0x38bdf8, 0x22c55e, 0xfacc15, 0x22c55e, 0x38bdf8];
  for (let i = 0; i < 5; i += 1) {
    const cx = (i - 2) * 0.44;
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.12, 0.18, 14),
      createToyMaterial(cauldronHexes[i], { emissive: cauldronHexes[i], emissiveIntensity: 0.3 })
    );
    pot.position.set(cx, 0.16, 0.92);
    mount.add(pot);
  }

  // Geared Brass-and-Candy Bubble Launcher Cannon at front-center
  const cannonPivot = new THREE.Group();
  cannonPivot.position.set(0, 0.26, 0.48);
  mount.add(cannonPivot);

  const goldBrassMat = createToyMaterial(0xfbbf24, { roughness: 0.18, metalness: 0.18, emissive: 0xd97706, emissiveIntensity: 0.24 });
  const barrelMat = createToyMaterial(0xec4899, { roughness: 0.16, clearcoat: 0.9, emissive: 0xdb2777, emissiveIntensity: 0.22 });

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.58, 18), barrelMat);
  barrel.position.set(0, 0.22, -0.10);
  barrel.rotation.x = -0.62;
  const muzzleRim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 10, 20), goldBrassMat);
  muzzleRim.position.set(0, 0.44, -0.26);
  muzzleRim.rotation.x = Math.PI * 0.5 - 0.62;

  const leftGear = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 12), goldBrassMat);
  leftGear.rotation.y = Math.PI * 0.5;
  leftGear.position.set(-0.22, 0.12, 0);
  const rightGear = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 12), goldBrassMat);
  rightGear.rotation.y = Math.PI * 0.5;
  rightGear.position.set(0.22, 0.12, 0);

  cannonPivot.add(barrel, muzzleRim, leftGear, rightGear);

  // Cute Green Chibi Bubble Dragon Crew beside the Cannon
  const dragonGroup = new THREE.Group();
  dragonGroup.position.set(-0.66, 0.12, 0.48);
  const dragonGreenMat = createToyMaterial(0x22c55e, { emissive: 0x16a34a, emissiveIntensity: 0.2 });
  const dragonBellyMat = createToyMaterial(0xfef08a, { roughness: 0.2 });
  const crestOrangeMat = createToyMaterial(0xf97316, { emissive: 0xea580c, emissiveIntensity: 0.28 });

  const dBody = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), dragonGreenMat);
  dBody.position.y = 0.22;
  const dBelly = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), dragonBellyMat);
  dBelly.position.set(0, 0.21, 0.10);
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), dragonGreenMat);
  dHead.position.set(0, 0.48, 0.04);
  const dCrest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), crestOrangeMat);
  dCrest.position.set(0, 0.70, -0.02);
  dragonGroup.add(dBody, dBelly, dHead, dCrest);
  mount.add(dragonGroup);

  // Suspended Rainbow Hex-Grid Bubble Cluster at Top of Frame (3 rows of glossy bubbles)
  const hexColors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7];
  const hexBubbleMaterials = hexColors.map((hex) =>
    createToyMaterial(hex, { roughness: 0.1, clearcoat: 1.0, emissive: hex, emissiveIntensity: 0.28 })
  );
  const hexClusterGroup = new THREE.Group();
  mount.add(hexClusterGroup);

  const hexBubbles = [];
  for (let row = 0; row < 3; row += 1) {
    const cols = row % 2 === 0 ? 6 : 5;
    for (let col = 0; col < cols; col += 1) {
      const bx = (col - (cols - 1) * 0.5) * 0.34;
      const by = 1.46 - row * 0.29;
      const bz = -0.25;
      const mat = hexBubbleMaterials[(row * 2 + col) % hexBubbleMaterials.length];
      const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 14), mat);
      bMesh.position.set(bx, by, bz);
      hexClusterGroup.add(bMesh);
      hexBubbles.push({ mesh: bMesh, baseY: by, row, col });
    }
  }

  // Animated Flying Projectile Bubble + Pop Starburst Ring
  const projectileMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 14),
    hexBubbleMaterials[0]
  );
  mount.add(projectileMesh);

  const popBurstRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.045, 10, 24),
    createToyMaterial(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.55 })
  );
  popBurstRing.position.set(0, 1.15, -0.18);
  mount.add(popBurstRing);

  return {
    ...base,
    id: 'bubbledragon',
    cannonPivot,
    leftGear,
    rightGear,
    dragonGroup,
    hexBubbles,
    hexBubbleMaterials,
    projectileMesh,
    popBurstRing,
  };
}

/**
 * Factory creating all 4 Island Rigs mapped by game ID.
 */
export function createAllIslandRigs() {
  const rigs = new Map();
  for (const entry of GAME_CATALOG) {
    let rig = null;
    if (entry.id === 'tang') rig = buildTangIslandRig(entry);
    else if (entry.id === 'watermelon') rig = buildWatermelonIslandRig(entry);
    else if (entry.id === 'aeroplane') rig = buildAeroplaneIslandRig(entry);
    else if (entry.id === 'bubbledragon') rig = buildBubbleDragonIslandRig(entry);

    tagSubtree(rig.root, 'gameId', entry.id);

    let meshCount = 0;
    rig.root.traverse((n) => {
      if (n.isMesh && n.material?.visible !== false) meshCount += 1;
    });
    rig.meshCount = meshCount;
    rigs.set(entry.id, rig);
  }
  return rigs;
}

/**
 * Updates an individual island's world transform, selection halo, and bespoke 3D diorama
 * meshes from the current simulation snapshot.
 */
export function updateIslandDioramaRig(rig, gameSnap, simTime) {
  if (!rig || !gameSnap) return;

  rig.root.position.set(gameSnap.worldPos.x, gameSnap.worldPos.y, gameSnap.worldPos.z);
  rig.root.scale.setScalar(gameSnap.scale);

  // Orient island toward camera while keeping subtle showcase angle
  rig.root.rotation.y = gameSnap.worldAngle * 0.18;

  // Selection halo pulse & 3D signPlate visibility (front-selected island uses the main HUD card)
  rig.selectionHalo.visible = true;
  if (rig.signPlate) {
    rig.signPlate.visible = !gameSnap.isSelected;
  }
  const haloScale = gameSnap.isSelected ? 1.04 + Math.sin(simTime * 5.5) * 0.04 : 0.92;
  rig.selectionHalo.scale.setScalar(haloScale);
  rig.selectionHalo.material.emissiveIntensity = gameSnap.isSelected ? 0.65 : 0.15;

  const ds = gameSnap.dioramaState;
  if (!ds) return;

  if (rig.id === 'tang') {
    for (let i = 0; i < rig.bubbleMeshes.length; i += 1) {
      const bm = rig.bubbleMeshes[i];
      const bs = ds.bubbles[i];
      if (!bs) continue;
      bm.group.position.set(bs.x, 0, bs.z);
      bm.shell.scale.set(bs.scaleXZ, bs.scaleY, bs.scaleXZ);
      bm.core.rotation.y = bs.coreYaw;
      bm.ring.rotation.z = bs.coreYaw;
    }
    rig.blastGroup.scale.set(ds.blastCrossScale, 1, ds.blastCrossScale);
    rig.blastGroup.visible = Boolean(ds.blastActive);
    rig.miduoGroup.position.set(ds.miduo.x, ds.miduo.bobY, ds.miduo.z);
    rig.miduoGroup.rotation.y = ds.miduo.yaw;
  } else if (rig.id === 'watermelon') {
    rig.jarGroup.rotation.z = ds.jarTiltZ;
    rig.evoRingGroup.rotation.y = ds.evolutionRingYaw;
    for (let i = 0; i < rig.fruitMeshes.length; i += 1) {
      const fm = rig.fruitMeshes[i];
      const fs = ds.fruits[i];
      if (!fs) continue;
      fm.position.set(fs.x, fs.y, 0);
      fm.rotation.z = fs.rotZ;
    }
    const sp = 0.75 + ds.mergePulse * 0.55;
    rig.mergeSparkleRing.scale.setScalar(sp);
    rig.mergeSparkleRing.rotation.y = simTime * 3.8;
  } else if (rig.id === 'aeroplane') {
    rig.diceMesh.position.y = ds.dice.y;
    rig.diceMesh.rotation.set(ds.dice.rotX, ds.dice.rotY, ds.dice.rotZ);
    for (let i = 0; i < rig.planeRigs.length; i += 1) {
      const pr = rig.planeRigs[i];
      const ps = ds.planes[i];
      if (!ps) continue;
      pr.group.position.set(ps.x, ps.y, ps.z);
      pr.group.rotation.set(ps.pitch, ps.yaw, ps.bank);
      pr.propBlade.rotation.z = ps.propAngle;
    }
  } else if (rig.id === 'bubbledragon') {
    rig.cannonPivot.rotation.y = ds.cannonYaw;
    rig.leftGear.rotation.z = ds.gearAngle;
    rig.rightGear.rotation.z = -ds.gearAngle;
    rig.dragonGroup.position.y = 0.12 + ds.dragonBobY;
    rig.dragonGroup.rotation.z = ds.dragonWave * 0.25;

    rig.projectileMesh.position.set(ds.projectile.x, ds.projectile.y, ds.projectile.z);
    const matIdx = ds.projectile.colorIndex % rig.hexBubbleMaterials.length;
    rig.projectileMesh.material = rig.hexBubbleMaterials[matIdx];

    const popScale = ds.popPulse > 0 ? 0.6 + ds.popPulse * 1.15 : 0.01;
    rig.popBurstRing.scale.setScalar(popScale);
    rig.popBurstRing.visible = ds.popPulse > 0;
  }
}
