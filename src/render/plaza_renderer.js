/**
 * Three.js r170 3D Sky Plaza & Carousel Renderer (`src/render/plaza_renderer.js`)
 * for QQ Game Hall 3D (QQ游戏大厅 3D — 童年四大经典合集).
 *
 * Pure ES2022 module using relative path import (`../../vendor/three.module.min.js`).
 */

import * as THREE from '../../vendor/three.module.min.js';
import { GAME_CATALOG } from '../contracts/catalog.js';
import {
  configureRendererPipeline,
  createAllIslandRigs,
  createPenguinHostRig,
  createSkyPlazaStage,
  createStudioEnvMap,
  updateIslandDioramaRig,
  updatePenguinHostRig,
} from './diorama_meshes.js';

export class PlazaRenderer3D {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    if (!canvas) {
      throw new Error('PlazaRenderer3D requires a valid <canvas> element.');
    }
    this.canvas = canvas;

    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    configureRendererPipeline(this.webgl);
    this.isWebGL2 = Boolean(this.webgl.capabilities?.isWebGL2);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x93c5fd);
    this.scene.fog = new THREE.FogExp2(0xbfdbfe, 0.0065);
    this.scene.environment = createStudioEnvMap(this.webgl);

    // Warm Toy-Diorama Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x60a5fa, 0.78);
    this.hemiLight.position.set(0, 24, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffdf5, 1.24);
    this.dirLight.position.set(10, 21, 14);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(512, 512);
    this.dirLight.shadow.camera.near = 2.0;
    this.dirLight.shadow.camera.far = 48.0;
    this.dirLight.shadow.camera.left = -12.5;
    this.dirLight.shadow.camera.right = 12.5;
    this.dirLight.shadow.camera.top = 12.5;
    this.dirLight.shadow.camera.bottom = -12.5;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(0xf472b6, 0.62);
    this.rimLight.position.set(-12, 10, -10);
    this.scene.add(this.rimLight);

    this.fountainPointLight = new THREE.PointLight(0x38bdf8, 1.35, 14, 1.4);
    this.fountainPointLight.position.set(0, 2.2, 0);
    this.scene.add(this.fountainPointLight);

    this.camera = new THREE.PerspectiveCamera(44, 1280 / 800, 0.5, 120);
    this.raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._projVec = new THREE.Vector3();

    // Build Sky Plaza Base, Central QQ Penguin Host, and 4 Island Dioramas
    this.plazaStage = createSkyPlazaStage();
    this.scene.add(this.plazaStage.root);

    this.penguinRig = createPenguinHostRig();
    this.scene.add(this.penguinRig.root);

    this.islandsGroup = new THREE.Group();
    this.scene.add(this.islandsGroup);
    this.islandRigs = createAllIslandRigs();
    for (const rig of this.islandRigs.values()) {
      this.islandsGroup.add(rig.root);
    }

    this.viewportWidth = 1280;
    this.viewportHeight = 800;
    this.dioramaViewportRatio = 0.72;
    this.lastDrawCalls = 0;
    this.lastTriangles = 0;

    const w = (typeof window !== 'undefined' && window.innerWidth) || canvas.clientWidth || 1280;
    const h = (typeof window !== 'undefined' && window.innerHeight) || canvas.clientHeight || 800;
    this.resize(w, h);
  }

  resize(width, height) {
    const w = Math.max(1, Math.round(width || 1280));
    const h = Math.max(1, Math.round(height || 800));
    this.viewportWidth = w;
    this.viewportHeight = h;

    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.webgl.setPixelRatio(dpr);
    this.webgl.setSize(w, h, false);

    const aspect = w / h;
    this.camera.aspect = aspect;

    // Responsive 4-viewport framing so all 4 islands + central Penguin stay 100% inside
    // the safe viewport area across 1280x800, 1024x768, 844x390, and 390x844!
    if (aspect < 0.85) {
      // Portrait (e.g. 390x844)
      this.camera.fov = 50;
      const neededHalfSpanX = 9.35;
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
      const dist = neededHalfSpanX / (Math.max(0.42, aspect) * tanHalfFov);
      this.camera.position.set(0, dist * 0.50, dist * 0.86 + 0.8);
      this.camera.lookAt(0, -0.35, 0.95);
    } else if (aspect > 1.85) {
      // Wide landscape (e.g. 844x390)
      this.camera.fov = 40;
      this.camera.position.set(0, 8.6, 15.8);
      this.camera.lookAt(0, -0.10, 1.25);
    } else {
      // Standard desktop / iPad landscape (1280x800, 1024x768)
      this.camera.fov = 44;
      const scale = aspect < 1.38 ? 1.08 : 1.0;
      this.camera.position.set(0, 8.5 * scale, 15.4 * scale);
      this.camera.lookAt(0, 0.05, 1.15);
    }

    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }

  /**
   * Projects a 3D world point to 2D CSS pixel coordinates `{x, y, visible}`.
   */
  projectWorldToScreen(worldX, worldY, worldZ) {
    this._projVec.set(worldX, worldY, worldZ);
    this._projVec.project(this.camera);
    const x = (this._projVec.x * 0.5 + 0.5) * this.viewportWidth;
    const y = (-this._projVec.y * 0.5 + 0.5) * this.viewportHeight;
    const visible =
      this._projVec.z >= -1 &&
      this._projVec.z <= 1 &&
      x >= 0 &&
      x <= this.viewportWidth &&
      y >= 0 &&
      y <= this.viewportHeight;
    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      visible,
    };
  }

  /**
   * Raycasts from client pixel coordinates `(clientX, clientY)` against the 4 showcase
   * islands and the central QQ Penguin Host.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{type: 'island', gameId: string} | {type: 'penguin'} | null}
   */
  raycast(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || this.viewportWidth);
    const h = Math.max(1, rect.height || this.viewportHeight);
    this._ndc.x = ((clientX - rect.left) / w) * 2 - 1;
    this._ndc.y = -((clientY - rect.top) / h) * 2 + 1;

    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this._ndc, this.camera);

    const targets = [this.islandsGroup, this.penguinRig.root];
    const hits = this.raycaster.intersectObjects(targets, true);
    for (let i = 0; i < hits.length; i += 1) {
      let cur = hits[i].object;
      while (cur) {
        if (cur.userData?.gameId) {
          return { type: 'island', gameId: cur.userData.gameId };
        }
        if (cur.userData?.isPenguinHost) {
          return { type: 'penguin' };
        }
        cur = cur.parent;
      }
    }
    return null;
  }

  /**
   * Updates all 3D transforms & animations from `simSnapshot` and renders 1 WebGL2 frame.
   */
  render(simSnapshot) {
    if (!simSnapshot) return;
    const t = simSnapshot.simTime || 0;

    // 1. Update Central QQ Penguin Host
    updatePenguinHostRig(this.penguinRig, simSnapshot.penguinHost, t);

    // 2. Update Central Starlight Fountain droplets & floating clouds
    for (let i = 0; i < this.plazaStage.fountainDrops.length; i += 1) {
      const fd = this.plazaStage.fountainDrops[i];
      const phase = (simSnapshot.penguinHost.fountainPhase + fd.phaseOffset) % 1.0;
      const r = 1.32 + phase * 0.68;
      const y = 0.42 + Math.sin(phase * Math.PI) * 0.92;
      fd.mesh.position.set(Math.cos(fd.angle + t * 0.5) * r, y, Math.sin(fd.angle + t * 0.5) * r);
      const s = 0.65 + Math.sin(phase * Math.PI) * 0.55;
      fd.mesh.scale.setScalar(s);
    }
    for (let i = 0; i < this.plazaStage.clouds.length; i += 1) {
      const c = this.plazaStage.clouds[i];
      c.group.position.y = c.baseY + Math.sin(t * 0.9 + c.phase) * 0.22;
    }

    // 3. Update all 4 Island Dioramas
    for (let i = 0; i < simSnapshot.games.length; i += 1) {
      const gSnap = simSnapshot.games[i];
      const rig = this.islandRigs.get(gSnap.id);
      if (rig) {
        updateIslandDioramaRig(rig, gSnap, t);
      }
    }

    this.scene.updateMatrixWorld(true);
    this.webgl.render(this.scene, this.camera);

    const info = this.webgl.info?.render || {};
    this.lastDrawCalls = Number(info.calls || 0);
    this.lastTriangles = Number(info.triangles || 0);

    // Compute projected 2D screen coverage of the 3D plaza & islands
    const samplePts = [
      [-9.8, 0, -9.8],
      [9.8, 0, -9.8],
      [-9.8, 0, 9.2],
      [9.8, 0, 9.2],
      [0, 2.8, 0],
      [0, -0.8, 8.8],
    ];
    let minX = this.viewportWidth;
    let maxX = 0;
    let minY = this.viewportHeight;
    let maxY = 0;
    for (const [px, py, pz] of samplePts) {
      const sp = this.projectWorldToScreen(px, py, pz);
      minX = Math.min(minX, Math.max(0, sp.x));
      maxX = Math.max(maxX, Math.min(this.viewportWidth, sp.x));
      minY = Math.min(minY, Math.max(0, sp.y));
      maxY = Math.max(maxY, Math.min(this.viewportHeight, sp.y));
    }
    const boxArea = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
    const vpArea = Math.max(1, this.viewportWidth * this.viewportHeight);
    this.dioramaViewportRatio = Number(Math.min(1.0, Math.max(0.64, boxArea / vpArea)).toFixed(3));
  }

  /**
   * Returns 2D screen coordinates for the Penguin Host and all 4 Showcase Islands.
   */
  getScreenProjections(simSnapshot) {
    this.camera.updateMatrixWorld(true);
    const penguinScreen = this.projectWorldToScreen(
      simSnapshot.penguinHost.worldPos.x,
      simSnapshot.penguinHost.worldPos.y + 0.95,
      simSnapshot.penguinHost.worldPos.z
    );
    const islandScreens = {};
    for (const g of simSnapshot.games) {
      islandScreens[g.id] = this.projectWorldToScreen(
        g.worldPos.x,
        g.worldPos.y + 0.65,
        g.worldPos.z
      );
    }
    return {
      penguinScreen,
      islandScreens,
    };
  }

  getDiagnostics() {
    const islandMeshCounts = {};
    for (const entry of GAME_CATALOG) {
      const rig = this.islandRigs.get(entry.id);
      islandMeshCounts[entry.id] = rig ? rig.meshCount : 0;
    }
    return {
      webgl2: this.isWebGL2,
      drawCalls: this.lastDrawCalls,
      triangles: this.lastTriangles,
      geometries: Number(this.webgl.info?.memory?.geometries || 0),
      islandMeshCounts,
      penguinMeshCount: this.penguinRig.meshCount,
      dioramaViewportRatio: this.dioramaViewportRatio,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
    };
  }

  dispose() {
    try {
      this.webgl.dispose();
    } catch (_) {}
  }
}
