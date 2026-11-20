import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  BeachTimeId,
  TROPICAL_COCKTAILS,
  computeLayerSlices,
  getGlassGeometrySpec,
  sipLiquidLevel,
} from '../../core/cocktailCatalog';
import {
  Ps1TextureSet,
  applyRadialPinwheelUvs,
  createPs1TextureSet,
} from '../../core/ps1Textures';
import { CocktailAudioEngine } from '../../core/retroAmbienceAudio';
import { Win2kIcon } from '../icons/Win2kIcons';
import { PixelCheckmark, PixelRadioDot } from '../icons/Win2kPixelGlyphs';

interface RoyalHawaiiAppProps {
  systemVolume?: number;
  systemMuted?: boolean;
  onUpdateTitle?: (title: string) => void;
  onClose: () => void;
}

const IS_SOFTWARE_GL = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

function applyVertexGradient(
  geometry: THREE.BufferGeometry,
  axis: 'x' | 'y' | 'z',
  lowHex: number,
  highHex: number
): void {
  const positions = geometry.attributes.position;
  if (!positions) return;

  const coordinateAt = (index: number) =>
    axis === 'x' ? positions.getX(index) : axis === 'y' ? positions.getY(index) : positions.getZ(index);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const coordinate = coordinateAt(i);
    min = Math.min(min, coordinate);
    max = Math.max(max, coordinate);
  }

  const low = new THREE.Color(lowHex);
  const high = new THREE.Color(highHex);
  const color = new THREE.Color();
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const t = THREE.MathUtils.clamp((coordinateAt(i) - min) / Math.max(0.001, max - min), 0, 1);
    color.lerpColors(low, high, t);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function disposeLoadedModel(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}

const PS1_DITHER_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Authentic 1999-2001 PS1/PS2 ordered Bayer 4x4 dithering + crisp 16-bit color depth post-pass
const PS1_DITHER_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform vec2 uTexelSize;
  uniform float uBloomStrength;
  varying vec2 vUv;

  float bayer4x4(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int idx = y * 4 + x;
    if (idx == 0) return 0.0 / 16.0;
    if (idx == 1) return 8.0 / 16.0;
    if (idx == 2) return 2.0 / 16.0;
    if (idx == 3) return 10.0 / 16.0;
    if (idx == 4) return 12.0 / 16.0;
    if (idx == 5) return 4.0 / 16.0;
    if (idx == 6) return 14.0 / 16.0;
    if (idx == 7) return 6.0 / 16.0;
    if (idx == 8) return 3.0 / 16.0;
    if (idx == 9) return 11.0 / 16.0;
    if (idx == 10) return 1.0 / 16.0;
    if (idx == 11) return 9.0 / 16.0;
    if (idx == 12) return 15.0 / 16.0;
    if (idx == 13) return 7.0 / 16.0;
    if (idx == 14) return 13.0 / 16.0;
    return 5.0 / 16.0;
  }

  vec3 highlight(vec2 uv) {
    vec3 sampleColor = texture2D(tDiffuse, uv).rgb;
    float luminance = dot(sampleColor, vec3(0.2126, 0.7152, 0.0722));
    return sampleColor * smoothstep(0.68, 0.92, luminance);
  }

  void main() {
    vec4 col = texture2D(tDiffuse, vUv);
    vec2 blurStep = uTexelSize * 3.0;
    vec3 bloom = (
      highlight(vUv + vec2(blurStep.x, 0.0)) +
      highlight(vUv - vec2(blurStep.x, 0.0)) +
      highlight(vUv + vec2(0.0, blurStep.y)) +
      highlight(vUv - vec2(0.0, blurStep.y))
    ) * 0.25;
    vec3 glow = col.rgb + bloom * uBloomStrength;
    vec2 px = floor(vUv * uResolution);
    float dither = (bayer4x4(px) - 0.5) / 36.0;
    vec3 quant = floor((glow + dither) * 36.0 + 0.5) / 36.0;
    gl_FragColor = vec4(clamp(quant, 0.0, 1.0), 1.0);
  }
`;

function createPs1PalmTree(textures: Ps1TextureSet, heightScale = 1, lean = 0.25): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshPhongMaterial({
    map: textures.palmBark,
    flatShading: true,
    shininess: 8,
  });

  const segs = 6;
  let curX = 0;
  let curY = 0;
  for (let i = 0; i < segs; i++) {
    const segH = 0.72 * heightScale;
    const rBot = (0.21 - i * 0.018) * heightScale;
    const rTop = (0.185 - i * 0.018) * heightScale;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH, 6), trunkMat);
    const tilt = lean * (i / segs);
    cyl.position.set(curX + Math.sin(tilt) * segH * 0.5, curY + segH * 0.5, 0);
    cyl.rotation.z = -tilt;
    tree.add(cyl);
    curX += Math.sin(tilt) * segH;
    curY += Math.cos(tilt) * segH * 0.96;
  }

  const crown = new THREE.Group();
  crown.position.set(curX, curY, 0);

  // Cluster of low-poly coconuts under fronds
  const cocoMat = new THREE.MeshPhongMaterial({ color: 0x5c3418, flatShading: true });
  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * Math.PI * 2;
    const coco = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 * heightScale, 0), cocoMat);
    coco.position.set(Math.cos(a) * 0.14, -0.06, Math.sin(a) * 0.14);
    crown.add(coco);
  }

  // Faceted arched PS1 frond planes with alpha-keyed frond texture
  const frondMat = new THREE.MeshPhongMaterial({
    map: textures.palmFrond,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    flatShading: true,
    shininess: 14,
  });

  const frondGeo = new THREE.PlaneGeometry(0.76 * heightScale, 2.25 * heightScale, 1, 4);
  const fPos = frondGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const fy = fPos.getY(i);
    const t = (fy + 1.125 * heightScale) / (2.25 * heightScale);
    fPos.setZ(i, -t * t * 0.68 * heightScale);
    fPos.setX(i, fPos.getX(i) * (1 - t * 0.45));
  }
  frondGeo.translate(0, 1.1 * heightScale, 0);
  frondGeo.computeVertexNormals();

  const frondCount = 7;
  for (let f = 0; f < frondCount; f++) {
    const ang = (f / frondCount) * Math.PI * 2;
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.rotation.y = ang;
    frond.rotation.x = 1.08 + (f % 2) * 0.16;
    crown.add(frond);
  }

  tree.add(crown);
  tree.userData.crown = crown;
  return tree;
}

function createFlameGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (context) {
    const glow = context.createRadialGradient(16, 16, 1, 16, 16, 16);
    glow.addColorStop(0, 'rgba(255,239,170,0.92)');
    glow.addColorStop(0.3, 'rgba(255,137,42,0.58)');
    glow.addColorStop(1, 'rgba(255,92,18,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 32, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRetroTikiTorch(textures: Ps1TextureSet, phase: number, glowTexture: THREE.Texture) {
  const root = new THREE.Group();

  const poleMat = new THREE.MeshPhongMaterial({
    map: textures.rattanMat,
    color: 0xb88648,
    flatShading: true,
    shininess: 12,
  });
  const ironMat = new THREE.MeshPhongMaterial({
    color: 0x3b2c22,
    flatShading: true,
    shininess: 22,
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 7), poleMat);
  pole.position.y = 1.8;
  root.add(pole);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.34, 7), ironMat);
  cup.position.y = 3.72;
  root.add(cup);

  // Retro multi-shell faceted low-poly flame (outer orange + inner golden core + ember spark)
  const flameGroup = new THREE.Group();
  flameGroup.position.y = 3.92;

  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff7625,
    transparent: true,
    opacity: 0.84,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xffc84c,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreFlameMat = new THREE.MeshBasicMaterial({
    color: 0xfff4c5,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerFlameGeo = new THREE.ConeGeometry(0.145, 0.5, 6, 2, true);
  const innerFlameGeo = new THREE.ConeGeometry(0.084, 0.34, 5, 2, true);
  const coreFlameGeo = new THREE.ConeGeometry(0.041, 0.18, 4, 1, true);
  const outerFlame = new THREE.Mesh(outerFlameGeo, outerFlameMat);
  outerFlame.position.y = 0.26;
  const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
  innerFlame.position.y = 0.2;
  const coreFlame = new THREE.Mesh(coreFlameGeo, coreFlameMat);
  coreFlame.position.y = 0.16;
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xff8c34,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowSprite = new THREE.Sprite(glowMaterial);
  glowSprite.position.y = 0.28;
  glowSprite.scale.set(0.62, 0.9, 1);
  flameGroup.add(glowSprite, outerFlame, innerFlame, coreFlame);
  root.add(flameGroup);
  const jitter = (geometry: THREE.BufferGeometry, base: Float32Array, t: number, amplitude: number) => {
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const offset = i * 3;
      const rise = THREE.MathUtils.clamp((base[offset + 1] + 0.25) / 0.5, 0, 1);
      positions.setXYZ(
        i,
        base[offset] + Math.sin(t + i * 1.71) * amplitude * rise,
        base[offset + 1] + Math.sin(t * 1.37 + i * 0.83) * amplitude * 0.35,
        base[offset + 2] + Math.cos(t * 0.91 + i * 1.23) * amplitude * rise
      );
    }
    positions.needsUpdate = true;
  };
  const outerBase = Float32Array.from(outerFlameGeo.attributes.position.array as ArrayLike<number>);
  const innerBase = Float32Array.from(innerFlameGeo.attributes.position.array as ArrayLike<number>);

  const update = (elapsed: number, scale = 1) => {
    const t = elapsed * 8.5 + phase;
    const hStretch = 0.91 + Math.sin(t) * 0.13 + Math.cos(t * 1.7) * 0.06;
    const swayX = Math.sin(t * 0.85) * 0.1;
    const swayZ = Math.cos(t * 0.72) * 0.08;
    flameGroup.scale.set(scale, scale * hStretch, scale);
    flameGroup.rotation.set(swayZ, elapsed * 1.6 + phase, swayX);
    jitter(outerFlameGeo, outerBase, t, 0.014);
    jitter(innerFlameGeo, innerBase, t + 0.7, 0.008);
    glowSprite.scale.set(0.58 + Math.sin(t) * 0.04, 0.86 + Math.cos(t * 1.4) * 0.06, 1);
    glowMaterial.opacity = 0.4 + Math.max(0, Math.sin(t * 1.3)) * 0.08;
  };

  return { root, update };
}

export const RoyalHawaiiApp: React.FC<RoyalHawaiiAppProps> = ({
  systemVolume = 75,
  systemMuted = false,
  onUpdateTitle,
  onClose,
}) => {
  const firstPreset = TROPICAL_COCKTAILS[0];
  const [selectedPresetId, setSelectedPresetId] = useState<string>(firstPreset.id);
  const [liquidLevel, setLiquidLevel] = useState<number>(0.88);
  const [beachTime, setBeachTime] = useState<BeachTimeId>('noon');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [openMenu, setOpenMenu] = useState<'drink' | 'scene' | 'help' | null>(null);
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    '皇家迈泰 · 经典 PS1/PS2 硬朗折面建模与动态棱角海浪，点击酒杯或纸伞互动'
  );

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<CocktailAudioEngine | null>(null);
  const onUpdateTitleRef = useRef(onUpdateTitle);
  onUpdateTitleRef.current = onUpdateTitle;

  const activePreset = useMemo(
    () => TROPICAL_COCKTAILS.find((c) => c.id === selectedPresetId) ?? TROPICAL_COCKTAILS[0],
    [selectedPresetId]
  );

  const simRef = useRef({
    liquidLevelCurr: 0.88,
    liquidLevelTarget: 0.88,
    umbrellaSpinVel: 0,
    umbrellaAngle: 0,
    umbrellaTilt: 0,
    stirEnergy: 0,
    stirPhase: 0,
    beachTime: 'noon' as BeachTimeId,
  });
  simRef.current.liquidLevelTarget = liquidLevel;
  simRef.current.beachTime = beachTime;

  const presetRef = useRef(activePreset);
  presetRef.current = activePreset;

  const sceneHandlesRef = useRef<{
    rebuildDrink: () => void;
    updateBeachLighting: (mood: BeachTimeId) => void;
  } | null>(null);

  useEffect(() => {
    onUpdateTitleRef.current?.(`Royal Hawaii 3D - ${activePreset.nameZh} (${activePreset.nameEn})`);
  }, [activePreset]);

  useEffect(() => {
    const engine = new CocktailAudioEngine();
    audioRef.current = engine;
    engine.syncVolume(systemVolume, systemMuted, soundEnabled);
    return () => {
      engine.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.syncVolume(systemVolume, systemMuted, soundEnabled);
  }, [systemVolume, systemMuted, soundEnabled]);

  useEffect(() => {
    audioRef.current?.setBeachMood(beachTime);
    sceneHandlesRef.current?.updateBeachLighting(beachTime);
  }, [beachTime]);

  useEffect(() => {
    sceneHandlesRef.current?.rebuildDrink();
  }, [selectedPresetId]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    let disposed = false;
    const loadedModelRoots: THREE.Group[] = [];
    const animatedModelPalms: THREE.Group[] = [];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3caae8);
    scene.fog = new THREE.Fog(0x7fd8f5, 14, 38);

    const width = Math.max(240, container.clientWidth || 560);
    const height = Math.max(180, container.clientHeight || 340);

    const camera = new THREE.PerspectiveCamera(27, width / height, 0.1, 75);
    camera.position.set(0, 3.45, 6.3);
    camera.lookAt(0, 1.65, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(1);
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.imageRendering = 'pixelated';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Authentic PS1/PS2 low-res offscreen RenderTarget -> Bayer 4x4 ordered-dither pass
    const ps1ResW = 640;
    const ps1ResH = Math.max(220, Math.min(448, Math.round((ps1ResW * height) / width)));
    const ps1Target = new THREE.WebGLRenderTarget(ps1ResW, ps1ResH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
    });
    ps1Target.texture.generateMipmaps = false;

    const postScene = new THREE.Scene();
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: ps1Target.texture },
        uResolution: { value: new THREE.Vector2(ps1ResW, ps1ResH) },
        uTexelSize: { value: new THREE.Vector2(1 / ps1ResW, 1 / ps1ResH) },
        uBloomStrength: { value: 0.16 },
      },
      vertexShader: PS1_DITHER_VERT,
      fragmentShader: PS1_DITHER_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
    postScene.add(postQuad);

    const textures = createPs1TextureSet();
    const gltfLoader = new GLTFLoader();
    const loadKenneyModel = (
      url: string,
      parent: THREE.Object3D,
      position: [number, number, number],
      targetSize: number,
      rotationY = 0
    ): THREE.Group => {
      const anchor = new THREE.Group();
      anchor.position.set(...position);
      anchor.rotation.y = rotationY;
      parent.add(anchor);
      loadedModelRoots.push(anchor);

      gltfLoader.load(
        url,
        ({ scene: model }) => {
          if (disposed) {
            disposeLoadedModel(model);
            return;
          }
          model.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(model);
          const size = bounds.getSize(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          if (maxSize > 0) model.scale.setScalar(targetSize / maxSize);
          model.updateMatrixWorld(true);
          const fittedBounds = new THREE.Box3().setFromObject(model);
          model.position.x -= (fittedBounds.min.x + fittedBounds.max.x) * 0.5;
          model.position.y -= fittedBounds.min.y;
          model.position.z -= (fittedBounds.min.z + fittedBounds.max.z) * 0.5;

          model.traverse((object) => {
            if (!(object as THREE.Mesh).isMesh) return;
            const mesh = object as THREE.Mesh;
            applyVertexGradient(mesh.geometry, 'y', 0xd0d0d0, 0xfff7df);
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
              (material as THREE.MeshStandardMaterial).vertexColors = true;
              material.needsUpdate = true;
            });
          });
          anchor.add(model);
        },
        undefined,
        () => undefined
      );

      return anchor;
    };

    // =========================================================================
    // 1. RETRO DIRECT3D / PS2 LIGHTING RIG
    // =========================================================================
    const hemiLight = new THREE.HemisphereLight(0xbbeeff, 0x6b3e1e, 1.05);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1c9, 1.45);
    sunLight.position.set(4.5, 7.2, 4.4);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x70ecff, 0.55);
    rimLight.position.set(-4.5, 3.2, -2.5);
    scene.add(rimLight);

    const leftTorchLight = new THREE.PointLight(0xff8424, 1.1, 11, 1.4);
    leftTorchLight.position.set(-2.65, 2.35, -1.25);
    scene.add(leftTorchLight);

    const rightTorchLight = new THREE.PointLight(0xff8424, 1.1, 11, 1.4);
    rightTorchLight.position.set(2.65, 2.35, -1.25);
    scene.add(rightTorchLight);
    const beachFireLight = new THREE.PointLight(0xff7b32, 0.4, 9, 1.6);
    beachFireLight.position.set(3.45, -0.45, -6.4);
    scene.add(beachFireLight);

    // =========================================================================
    // 2. RETRO MAHOGANY TIKI BAR COUNTERTOP + RATTAN MAT + CARVED TIKI PROPS
    // =========================================================================
    const barGroup = new THREE.Group();

    const counterTopMat = new THREE.MeshPhongMaterial({
      map: textures.barWood,
      flatShading: true,
      specular: 0x6b4528,
      shininess: 22,
    });
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.34, 3.4), counterTopMat);
    counterTop.position.set(0, -0.17, 0.25);
    barGroup.add(counterTop);

    const counterApronMat = new THREE.MeshPhongMaterial({
      map: textures.barBamboo,
      bumpMap: textures.barRelief,
      bumpScale: 0.035,
      color: 0x996540,
      flatShading: true,
      shininess: 10,
    });
    const counterBody = new THREE.Mesh(new THREE.BoxGeometry(7.9, 1.4, 3.1), counterApronMat);
    counterBody.position.set(0, -1.04, 0.25);
    barGroup.add(counterBody);

    // Bamboo edge rails (7-sided chunky retro cylinders)
    const bambooMat = new THREE.MeshPhongMaterial({
      map: textures.barBamboo,
      bumpMap: textures.barRelief,
      bumpScale: 0.025,
      color: 0xe6b872,
      flatShading: true,
      shininess: 18,
    });
    const backRail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.3, 7), bambooMat);
    backRail.rotation.z = Math.PI / 2;
    backRail.position.set(0, -0.04, -1.42);
    barGroup.add(backRail);

    // Woven golden rattan table mat + braided octagonal coaster
    const rattanBarMat = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.025, 1.65),
      new THREE.MeshPhongMaterial({ map: textures.rattanMat, flatShading: true, shininess: 10 })
    );
    rattanBarMat.position.set(0, 0.012, 0.04);
    barGroup.add(rattanBarMat);

    const coasterDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.79, 0.04, 10),
      new THREE.MeshPhongMaterial({
        map: textures.coaster,
        color: 0xffe5b8,
        flatShading: true,
        shininess: 12,
      })
    );
    coasterDisk.position.set(0, 0.038, 0);
    barGroup.add(coasterDisk);

    // Left Counter Prop: Carved Polynesian Tiki Idol
    const totemSideMat = new THREE.MeshPhongMaterial({
      map: textures.barWood,
      color: 0x7a5438,
      flatShading: true,
    });
    const totemFrontMat = new THREE.MeshPhongMaterial({
      map: textures.totemFront,
      flatShading: true,
    });
    const totemMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.24, 0.44), [
      totemSideMat,
      totemSideMat,
      totemSideMat,
      totemSideMat,
      totemFrontMat,
      totemFrontMat,
    ]);
    totemMesh.position.set(-1.72, 0.62, -0.45);
    totemMesh.rotation.y = 0.34;
    barGroup.add(totemMesh);

    // Right Counter Prop: Turned Koa-Wood Ice & Lime Dish (chunky PS1 low-poly)
    const dishGroup = new THREE.Group();
    const bowlMat = new THREE.MeshPhongMaterial({
      map: textures.barWood,
      color: 0xc9854c,
      flatShading: true,
      shininess: 22,
    });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.25, 0.26, 8), bowlMat);
    bowl.position.y = 0.13;
    dishGroup.add(bowl);

    const bowlIceMat = new THREE.MeshPhongMaterial({
      map: textures.ice,
      color: 0xdff8ff,
      flatShading: true,
      specular: 0xffffff,
      shininess: 70,
    });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.17), bowlIceMat);
      cube.position.set(Math.cos(a) * 0.13, 0.28 + (k % 2) * 0.05, Math.sin(a) * 0.13);
      cube.rotation.set(k * 0.4, k * 0.7, 0.3);
      dishGroup.add(cube);
    }
    const spareLime = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.05, 8),
      new THREE.MeshPhongMaterial({
        map: textures.lime,
        alphaTest: 0.4,
        flatShading: true,
      })
    );
    spareLime.position.set(-0.22, 0.28, 0.22);
    spareLime.rotation.set(0.65, 0.4, 0.35);
    dishGroup.add(spareLime);
    dishGroup.position.set(1.66, 0, -0.32);
    barGroup.add(dishGroup);

    loadKenneyModel('/models/food/cocktail.glb', barGroup, [-2.82, 0.03, -0.55], 0.9, -0.2);
    loadKenneyModel('/models/pirate/barrel.glb', barGroup, [-3.48, 0.02, -0.52], 0.88);
    loadKenneyModel('/models/pirate/bottle-rum.glb', barGroup, [3.48, 0.03, -0.62], 0.72, 0.3);
    loadKenneyModel('/models/holiday/lantern.glb', barGroup, [3.55, 0.03, 0.62], 0.66, -0.35);

    const fruitDressing = new THREE.Group();
    fruitDressing.position.set(2.75, 0.02, -0.05);
    barGroup.add(fruitDressing);
    loadKenneyModel('/models/food/pineapple.glb', fruitDressing, [0, 0, -0.18], 0.48, 0.4);
    loadKenneyModel('/models/food/orange.glb', fruitDressing, [-0.38, 0, 0.18], 0.32);
    loadKenneyModel('/models/food/lemon-half.glb', fruitDressing, [0.36, 0, 0.21], 0.3, -0.5);
    loadKenneyModel('/models/food/cherries.glb', fruitDressing, [-0.2, 0, -0.45], 0.27);
    loadKenneyModel('/models/food/coconut-half.glb', fruitDressing, [0.36, 0, -0.4], 0.34, 0.7);
    loadKenneyModel('/models/food/strawberry.glb', fruitDressing, [0.1, 0, 0.43], 0.24, 0.5);
    loadKenneyModel('/models/food/whipped-cream.glb', fruitDressing, [-0.52, 0, -0.12], 0.28, 0.35);

    // Flanking Retro Standing Bamboo Tiki Torches
    const fireGlowTexture = createFlameGlowTexture();
    const leftTorch = createRetroTikiTorch(textures, 0.4, fireGlowTexture);
    leftTorch.root.position.set(-2.55, -1.78, -1.35);
    barGroup.add(leftTorch.root);

    const rightTorch = createRetroTikiTorch(textures, 3.6, fireGlowTexture);
    rightTorch.root.position.set(2.55, -1.78, -1.35);
    barGroup.add(rightTorch.root);

    scene.add(barGroup);

    // =========================================================================
    // 3. DYNAMIC ANGULAR PS1/PS2 RIPPLING OCEAN + CORAL SAND + SWAYING PALMS
    // =========================================================================
    const vistaGroup = new THREE.Group();

    const skyCylGeo = new THREE.CylinderGeometry(34, 34, 24, 20, 1, true);
    skyCylGeo.scale(-1, 1, 1);
    const skyCylMat = new THREE.MeshBasicMaterial({
      map: textures.skyNoon,
      fog: false,
    });
    const skyCyl = new THREE.Mesh(skyCylGeo, skyCylMat);
    skyCyl.position.set(0, 6.2, 0);
    skyCyl.rotation.y = Math.PI * 0.5;
    vistaGroup.add(skyCyl);

    // Coral Sand Beach with Newly Generated Shells & Pebbles Texture
    const sandGeo = new THREE.PlaneGeometry(36, 7.5, 14, 4);
    sandGeo.rotateX(-Math.PI / 2);
    applyVertexGradient(sandGeo, 'z', 0xc3a17a, 0xfff0cd);
    const sandMat = new THREE.MeshPhongMaterial({
      map: textures.sand,
      vertexColors: true,
      flatShading: true,
      shininess: 8,
    });
    const sandBeach = new THREE.Mesh(sandGeo, sandMat);
    sandBeach.position.set(0, -1.72, -4.6);
    vistaGroup.add(sandBeach);

    const wetSandGeo = new THREE.PlaneGeometry(36, 0.92, 18, 2);
    wetSandGeo.rotateX(-Math.PI / 2);
    const wetSand = new THREE.Mesh(
      wetSandGeo,
      new THREE.MeshPhongMaterial({
        map: textures.wetSand,
        color: 0xdac6a3,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        flatShading: true,
        shininess: 38,
      })
    );
    wetSand.position.set(0, -1.685, -6.0);
    vistaGroup.add(wetSand);

    // DYNAMIC ANGULAR FACETED PS1/PS2 OCEAN WATER (Wave Vertex Displacement + Flat Facet Specular!)
    const oceanGeo = new THREE.PlaneGeometry(56, 42, 34, 24);
    oceanGeo.rotateX(-Math.PI / 2);
    applyVertexGradient(oceanGeo, 'z', 0x879ba7, 0xd4eee0);
    const oceanBaseY = new Float32Array(oceanGeo.attributes.position.count);
    const oceanPos = oceanGeo.attributes.position;
    for (let i = 0; i < oceanPos.count; i++) {
      oceanBaseY[i] = oceanPos.getY(i);
    }

    const oceanMat = new THREE.MeshPhongMaterial({
      map: textures.ocean,
      color: 0x38dcf5,
      specular: 0xd8fcff,
      shininess: 64,
      emissive: 0x082c38,
      vertexColors: true,
      flatShading: true,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.set(0, -1.76, -21.5);
    vistaGroup.add(oceanMesh);

    // Angular Animated Shoreline Surf Foam Ribbon washing over wet sand
    const foamGeo = new THREE.PlaneGeometry(34, 0.42, 22, 2);
    foamGeo.rotateX(-Math.PI / 2);
    const foamPos = foamGeo.attributes.position;
    const foamBaseZ = new Float32Array(foamPos.count);
    for (let i = 0; i < foamPos.count; i++) {
      foamBaseZ[i] = foamPos.getZ(i);
    }
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xc8e8e7,
      transparent: true,
      opacity: 0.18,
    });
    const foamRibbon = new THREE.Mesh(foamGeo, foamMat);
    foamRibbon.position.set(0, -1.66, -6.2);
    vistaGroup.add(foamRibbon);

    const glintCount = 48;
    const glintGeometry = new THREE.BufferGeometry();
    const glintPositions = new Float32Array(glintCount * 3);
    const glintColors = new Float32Array(glintCount * 3);
    const glintSeeds = new Float32Array(glintCount);
    const glintBaseX = new Float32Array(glintCount);
    const glintBaseZ = new Float32Array(glintCount);
    for (let i = 0; i < glintCount; i++) {
      const depth = i / (glintCount - 1);
      glintBaseX[i] = Math.sin(i * 12.9898) * (0.16 + depth * 1.2);
      glintBaseZ[i] = -7.2 - depth * 25;
      glintSeeds[i] = i * 2.39996;
      glintPositions[i * 3] = glintBaseX[i];
      glintPositions[i * 3 + 1] = -1.72;
      glintPositions[i * 3 + 2] = glintBaseZ[i];
    }
    glintGeometry.setAttribute('position', new THREE.BufferAttribute(glintPositions, 3));
    glintGeometry.setAttribute('color', new THREE.BufferAttribute(glintColors, 3));
    const glintPositionAttr = glintGeometry.attributes.position as THREE.BufferAttribute;
    const glintColorAttr = glintGeometry.attributes.color as THREE.BufferAttribute;
    const glintTint = new THREE.Color();
    glintGeometry.computeBoundingSphere();
    const sunGlints = new THREE.Points(
      glintGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.16,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sunGlints.frustumCulled = false;
    vistaGroup.add(sunGlints);

    const palmLeft = createPs1PalmTree(textures, 1.15, 0.3);
    palmLeft.position.set(-3.55, -1.65, -7.4);
    palmLeft.rotation.y = 0.45;
    vistaGroup.add(palmLeft);

    const palmRight = createPs1PalmTree(textures, 1.18, -0.28);
    palmRight.position.set(3.55, -1.65, -7.7);
    palmRight.rotation.y = -0.35;
    vistaGroup.add(palmRight);

    const leftKenneyPalm = loadKenneyModel(
      '/models/pirate/palm-bend.glb',
      vistaGroup,
      [-4.7, -1.68, -9.3],
      3.9,
      0.25
    );
    const rightKenneyPalm = loadKenneyModel(
      '/models/pirate/palm-straight.glb',
      vistaGroup,
      [4.7, -1.68, -9.5],
      3.8,
      -0.25
    );
    animatedModelPalms.push(leftKenneyPalm, rightKenneyPalm);
    loadKenneyModel('/models/pirate/rocks-sand-a.glb', vistaGroup, [-5.15, -1.7, -7.6], 1.7, 0.2);
    loadKenneyModel('/models/pirate/rocks-sand-b.glb', vistaGroup, [5.15, -1.7, -7.8], 1.55, -0.3);
    loadKenneyModel('/models/watercraft/boat-sail.glb', vistaGroup, [3.25, -1.3, -23.2], 2.35, 0.55);
    loadKenneyModel('/models/graveyard/fire-basket.glb', vistaGroup, [3.5, -1.68, -6.5], 1.15, 0.2);

    // Overhead Tiki Hut Thatch Awning
    const awning = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 2.8),
      new THREE.MeshPhongMaterial({
        map: textures.thatch,
        flatShading: true,
        side: THREE.DoubleSide,
      })
    );
    awning.position.set(0, 4.35, -1.3);
    awning.rotation.x = 0.55;
    vistaGroup.add(awning);

    scene.add(vistaGroup);

    // =========================================================================
    // 4. RESTORED AUTHENTIC PS1/PS2 FACETED COCKTAIL GLASS & RICHLY TEXTURED DRINK
    // =========================================================================
    const cocktailRoot = new THREE.Group();
    cocktailRoot.position.set(0, 0.058, 0);
    scene.add(cocktailRoot);

    let liquidBodyGroup = new THREE.Group();
    let drinkSurfaceGroup = new THREE.Group();
    let submergedIceGroup = new THREE.Group();
    let umbrellaSpinner: THREE.Group | null = null;
    let umbrellaPivot: THREE.Group | null = null;
    let strawPivot: THREE.Group | null = null;
    let interactiveTargets: THREE.Object3D[] = [];
    const disposableDrinkResources: Array<{ dispose: () => void }> = [];

    const track = <T extends { dispose: () => void }>(res: T): T => {
      disposableDrinkResources.push(res);
      return res;
    };

    const clearDrinkMeshes = () => {
      while (cocktailRoot.children.length > 0) {
        cocktailRoot.remove(cocktailRoot.children[0]);
      }
      while (disposableDrinkResources.length > 0) {
        disposableDrinkResources.pop()?.dispose();
      }
      interactiveTargets = [];
      umbrellaSpinner = null;
      umbrellaPivot = null;
      strawPivot = null;
    };

    const rebuildDrink = () => {
      clearDrinkMeshes();
      const preset = presetRef.current;
      const spec = getGlassGeometrySpec(preset.glassShape);
      const segs = spec.radialSegments;

      // 1. Multi-layered Faceted Retro Liquid Volumes textured with newly generated `liquidPulp`
      liquidBodyGroup = new THREE.Group();
      const fullSlices = computeLayerSlices(
        preset.layers,
        1.0,
        spec.cavityBottomY,
        spec.cavityTopY
      );

      fullSlices.forEach((slice, idx) => {
        const y0 = slice.yBottom;
        const y1 = slice.yTop;
        const h = Math.max(0.02, y1 - y0);
        const r0 = spec.radiusAtY(y0) * 0.96;
        const r1 = spec.radiusAtY(y1) * 0.96;
        const rMid = spec.radiusAtY((y0 + y1) * 0.5) * 0.96;

        const pts = [
          new THREE.Vector2(Math.max(0.01, r0), 0),
          new THREE.Vector2(Math.max(0.01, rMid), h * 0.5),
          new THREE.Vector2(Math.max(0.01, r1), h),
        ];
        const sliceGeo = track(new THREE.LatheGeometry(pts, segs));
        const sliceMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.liquidPulp,
            color: new THREE.Color(slice.layer.color),
            emissive: new THREE.Color(slice.layer.color).multiplyScalar(0.28),
            specular: 0xfff8e6,
            shininess: 52,
            flatShading: true,
            transparent: slice.layer.opacity < 0.98,
            opacity: slice.layer.opacity,
          })
        );
        const mesh = new THREE.Mesh(sliceGeo, sliceMat);
        mesh.position.y = y0;
        mesh.userData = { hitKind: 'drink' };
        liquidBodyGroup.add(mesh);
        interactiveTargets.push(mesh);

        // Bottom cap on first slice
        if (idx === 0) {
          const botCap = new THREE.Mesh(
            track(new THREE.CircleGeometry(r0, segs)),
            sliceMat
          );
          botCap.rotation.x = Math.PI / 2;
          botCap.position.y = y0 + 0.002;
          liquidBodyGroup.add(botCap);
        }
      });
      cocktailRoot.add(liquidBodyGroup);

      // 2. Steady Faceted Drink Top Surface (Meniscus + Low-Poly Ice Cubes / Retro Cream Swirl)
      drinkSurfaceGroup = new THREE.Group();
      const topLayer = preset.layers[preset.layers.length - 1];
      const topR = spec.radiusAtY(spec.cavityTopY) * 0.95;

      const meniscusGeo = track(new THREE.CircleGeometry(topR, segs));
      const meniscusMat = track(
        new THREE.MeshPhongMaterial({
          map: textures.liquidPulp,
          color: new THREE.Color(topLayer.color).lerp(new THREE.Color(0xffffff), 0.16),
          specular: 0xffffff,
          shininess: 68,
          flatShading: true,
        })
      );
      const meniscus = new THREE.Mesh(meniscusGeo, meniscusMat);
      meniscus.rotation.x = -Math.PI / 2;
      meniscus.userData = { hitKind: 'drink' };
      drinkSurfaceGroup.add(meniscus);
      interactiveTargets.push(meniscus);

      // Sculpted steady low-poly surface toppings (ZERO clipping, ZERO vertex-snap jitter!)
      if (preset.topStyle === 'coconut-cream-swirl') {
        const creamMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.liquidFoam,
            color: 0xfffdf5,
            specular: 0xffffff,
            shininess: 30,
            flatShading: true,
          })
        );
        const tier1 = new THREE.Mesh(track(new THREE.CylinderGeometry(topR * 0.62, topR * 0.84, 0.16, 8)), creamMat);
        tier1.position.y = 0.08;
        const tier2 = new THREE.Mesh(track(new THREE.CylinderGeometry(topR * 0.34, topR * 0.60, 0.15, 8)), creamMat);
        tier2.position.y = 0.22;
        const peak = new THREE.Mesh(track(new THREE.ConeGeometry(topR * 0.34, 0.22, 8)), creamMat);
        peak.position.y = 0.39;
        peak.rotation.z = 0.12;
        drinkSurfaceGroup.add(tier1, tier2, peak);
      } else {
        // Chunky faceted PS1 crystal ice chunks resting cleanly on meniscus
        const surfIceMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.ice,
            color: 0xe6fbff,
            specular: 0xffffff,
            shininess: 92,
            flatShading: true,
            transparent: true,
            opacity: 0.86,
          })
        );
        const iceCount = preset.defaultIceCount;
        for (let i = 0; i < iceCount; i++) {
          const ang = (i / iceCount) * Math.PI * 2 + 0.35;
          const dist = topR * (i === 0 ? 0.12 : 0.44);
          const cubeGeo = track(new THREE.BoxGeometry(0.21, 0.16, 0.21));
          const cube = new THREE.Mesh(cubeGeo, surfIceMat);
          cube.position.set(Math.cos(ang) * dist, 0.04 + (i % 2) * 0.03, Math.sin(ang) * dist);
          cube.rotation.set(0.22 * (i + 1), ang, 0.18 * (i % 3));
          drinkSurfaceGroup.add(cube);
        }
      }
      cocktailRoot.add(drinkSurfaceGroup);

      // 3. Submerged Faceted Ice Cubes visible through translucent crystal glass walls
      submergedIceGroup = new THREE.Group();
      const subIceMat = track(
        new THREE.MeshPhongMaterial({
          map: textures.ice,
          color: 0xdaf6ff,
          specular: 0xffffff,
          shininess: 80,
          flatShading: true,
          transparent: true,
          opacity: 0.65,
        })
      );
      for (let i = 0; i < 4; i++) {
        const geo = track(new THREE.BoxGeometry(0.18, 0.18, 0.18));
        const mesh = new THREE.Mesh(geo, subIceMat);
        mesh.rotation.set(i * 0.6, i * 0.9, 0.4);
        mesh.userData = {
          baseAngle: (i / 4) * Math.PI * 2 + 0.5,
          radialFrac: 0.56,
          depthOffset: 0.24 + i * 0.16,
        };
        submergedIceGroup.add(mesh);
      }
      cocktailRoot.add(submergedIceGroup);

      // 4. Hard-Faceted PS1/PS2 Cut-Crystal Glassware mapped with newly generated `glassCrystal`
      const lathePts = spec.outerPoints.map((p) => new THREE.Vector2(p.r, p.y));
      const glassGeo = track(new THREE.LatheGeometry(lathePts, segs));
      const glassMat = track(
        new THREE.MeshPhongMaterial({
          map: textures.glassCrystal,
          bumpMap: textures.glassCondensation,
          bumpScale: 0.028,
          color: 0xdff7ff,
          specular: 0xffffff,
          shininess: 110,
          emissive: 0x102e3a,
          emissiveIntensity: 0.18,
          flatShading: true,
          transparent: true,
          opacity: 0.26,
          depthWrite: false,
        })
      );
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.renderOrder = 4;
      glassMesh.userData = { hitKind: 'drink' };
      cocktailRoot.add(glassMesh);
      interactiveTargets.push(glassMesh);

      // Thick faceted crystal sham base so glass feels solid & authentic
      const shamGeo = track(
        new THREE.CylinderGeometry(spec.shamRadius, spec.shamRadius * 0.94, spec.shamHeight, segs)
      );
      const shamMat = track(
        new THREE.MeshPhongMaterial({
          map: textures.glassCrystal,
          bumpMap: textures.glassRelief,
          bumpScale: 0.035,
          color: 0xc2e9f5,
          specular: 0xffffff,
          shininess: 95,
          flatShading: true,
          transparent: true,
          opacity: 0.44,
          depthWrite: false,
        })
      );
      const sham = new THREE.Mesh(shamGeo, shamMat);
      sham.position.y = spec.shamHeight * 0.5 + 0.01;
      sham.renderOrder = 3;
      cocktailRoot.add(sham);

      // Subtle glass rim and specular streaks
      const rimY = spec.rimY;
      const rimR = spec.rimRadius;
      const rimPoints = Array.from({ length: segs }, (_, index) => {
        const angle = (index / segs) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * rimR, rimY, Math.sin(angle) * rimR);
      });
      const rimGeo = track(new THREE.BufferGeometry().setFromPoints(rimPoints));
      const rimMat = track(
        new THREE.LineBasicMaterial({
          color: 0xc9f1f7,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        })
      );
      const rimHighlight = new THREE.LineLoop(rimGeo, rimMat);
      rimHighlight.renderOrder = 5;
      cocktailRoot.add(rimHighlight);

      const streakMat = track(
        new THREE.MeshBasicMaterial({
          color: 0xd9f5fa,
          transparent: true,
          opacity: 0.11,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const streakHeight = rimY - spec.cavityBottomY;
      [
        { angle: 0.48, width: 0.04, height: streakHeight * 0.82, y: spec.cavityBottomY + streakHeight * 0.48 },
        { angle: -0.92, width: 0.026, height: streakHeight * 0.56, y: spec.cavityBottomY + streakHeight * 0.4 },
      ].forEach(({ angle, width, height, y }) => {
        const streak = new THREE.Mesh(track(new THREE.PlaneGeometry(width, height)), streakMat);
        streak.position.set(Math.sin(angle) * rimR * 0.96, y, Math.cos(angle) * rimR * 0.96);
        streak.rotation.y = angle;
        streak.renderOrder = 5;
        cocktailRoot.add(streak);
      });

      // 5. Classic Retro Garnishes (Floral Hibiscus Paper Umbrella, Striped Bent Straw, Pineapple Wedge, Lime, Cherry)

      // Striped bent retro drinking straw
      if (preset.garnishes.includes('straw')) {
        strawPivot = new THREE.Group();
        const strawMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.straw,
            flatShading: true,
            shininess: 24,
          })
        );
        const lowerStraw = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.036, 0.036, rimY - spec.cavityBottomY + 0.52, 6)),
          strawMat
        );
        lowerStraw.position.set(0, (rimY + spec.cavityBottomY) * 0.5 + 0.16, 0);
        const upperStraw = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.036, 0.036, 0.56, 6)),
          strawMat
        );
        upperStraw.position.set(-0.18, rimY + 0.5, 0);
        upperStraw.rotation.z = 0.62;
        strawPivot.add(lowerStraw, upperStraw);
        strawPivot.position.set(-rimR * 0.34, 0, -0.08);
        strawPivot.rotation.z = 0.15;
        cocktailRoot.add(strawPivot);
      }

      // 12-Panel Pleated Hawaiian Hibiscus Floral Paper Umbrella (`textures.umbrella`)
      if (preset.garnishes.includes('umbrella')) {
        umbrellaPivot = new THREE.Group();
        umbrellaPivot.position.set(rimR * 0.24, rimY - 0.14, -0.08);
        umbrellaPivot.rotation.z = -0.36;
        umbrellaPivot.rotation.x = 0.1;

        const pickMat = track(
          new THREE.MeshPhongMaterial({ color: 0xe2be78, flatShading: true })
        );
        const stick = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.018, 0.018, 1.38, 6)),
          pickMat
        );
        stick.position.y = 0.28;
        umbrellaPivot.add(stick);

        umbrellaSpinner = new THREE.Group();
        umbrellaSpinner.position.y = 0.88;

        const canopyGeo = track(new THREE.ConeGeometry(0.68, 0.28, 12, 1, true));
        applyRadialPinwheelUvs(canopyGeo, 0.28);
        const canopyMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.umbrella,
            side: THREE.DoubleSide,
            flatShading: true,
            shininess: 18,
          })
        );
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.userData = { hitKind: 'umbrella' };
        umbrellaSpinner.add(canopy);
        interactiveTargets.push(canopy);

        const finial = new THREE.Mesh(
          track(new THREE.ConeGeometry(0.05, 0.09, 6)),
          pickMat
        );
        finial.position.y = 0.16;
        umbrellaSpinner.add(finial);

        umbrellaPivot.add(umbrellaSpinner);
        cocktailRoot.add(umbrellaPivot);
      }

      // Chunky Low-Poly Golden Pineapple Wedge Perched on Right Rim
      if (preset.garnishes.includes('pineapple')) {
        const pineGeo = track(new THREE.CylinderGeometry(0.36, 0.36, 0.11, 5, 1, false, 0, Math.PI * 0.65));
        const pineMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.pineapple,
            color: 0xffd142,
            flatShading: true,
            shininess: 28,
          })
        );
        const pine = new THREE.Mesh(pineGeo, pineMat);
        pine.position.set(rimR * 0.88, rimY + 0.03, 0.24);
        pine.rotation.set(Math.PI * 0.48, 0.4, -0.55);
        cocktailRoot.add(pine);
      }

      // Crisp Alpha-Keyed Pixel Lime Wheel on Left Rim
      if (preset.garnishes.includes('mint-lime')) {
        const limeWheel = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.26, 0.26, 0.055, 8)),
          track(
            new THREE.MeshPhongMaterial({
              map: textures.lime,
              alphaTest: 0.42,
              flatShading: true,
              shininess: 24,
            })
          )
        );
        limeWheel.position.set(-rimR * 0.86, rimY + 0.02, 0.28);
        limeWheel.rotation.set(Math.PI * 0.46, -0.35, 0.45);
        cocktailRoot.add(limeWheel);
      }

      // Glossy Faceted Maraschino Cherry + Stem
      if (preset.garnishes.includes('cherry')) {
        const cherryGroup = new THREE.Group();
        const cherryMat = track(
          new THREE.MeshPhongMaterial({
            color: 0xd9142c,
            specular: 0xffd6dd,
            shininess: 96,
            flatShading: true,
          })
        );
        const berry = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.115, 0)), cherryMat);
        const stem = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.011, 0.014, 0.3, 5)),
          track(new THREE.MeshPhongMaterial({ color: 0x3b7a24, flatShading: true }))
        );
        stem.position.set(0.04, 0.19, 0);
        stem.rotation.z = -0.32;
        cherryGroup.add(berry, stem);
        cherryGroup.position.set(
          preset.topStyle === 'coconut-cream-swirl' ? 0.05 : rimR * 0.46,
          preset.topStyle === 'coconut-cream-swirl' ? spec.cavityTopY + 0.36 : rimY + 0.08,
          0.26
        );
        cocktailRoot.add(cherryGroup);
      }
    };

    const updateBeachLighting = (mood: BeachTimeId) => {
      if (mood === 'noon') {
        skyCylMat.map = textures.skyNoon;
        skyCylMat.color.setHex(0xffffff);
        scene.background = new THREE.Color(0x3baae8);
        scene.fog = new THREE.Fog(0x7fd8f5, 14, 38);
        hemiLight.color.setHex(0xbbeeff);
        hemiLight.groundColor.setHex(0x7a4b24);
        hemiLight.intensity = 1.05;
        sunLight.color.setHex(0xfff1c9);
        sunLight.intensity = 1.45;
        sunLight.position.set(4.5, 7.2, 4.4);
        oceanMat.color.setHex(0x28d6f0);
        oceanMat.specular.setHex(0xc8fbff);
        oceanMat.emissive.setHex(0x09252c);
        oceanMat.emissiveIntensity = 0.45;
        sandMat.color.setHex(0xfff0cc);
        foamMat.color.setHex(0xeefcff);
      } else if (mood === 'sunset') {
        skyCylMat.map = textures.skySunset;
        skyCylMat.color.setHex(0xffdfd0);
        scene.background = new THREE.Color(0xb85846);
        scene.fog = new THREE.Fog(0xc18170, 18, 46);
        hemiLight.color.setHex(0xffad7d);
        hemiLight.groundColor.setHex(0x4d2a16);
        hemiLight.intensity = 0.92;
        sunLight.color.setHex(0xff8e42);
        sunLight.intensity = 1.38;
        sunLight.position.set(-4.8, 3.2, 2.5);
        oceanMat.color.setHex(0x83c3d6);
        oceanMat.specular.setHex(0xffcf87);
        oceanMat.emissive.setHex(0x4b8ea2);
        oceanMat.emissiveIntensity = 1.45;
        sandMat.color.setHex(0xffc796);
        foamMat.color.setHex(0xffe2cc);
      } else {
        skyCylMat.map = textures.skySunset;
        skyCylMat.color.setHex(0x3f548c);
        scene.background = new THREE.Color(0x131d38);
        scene.fog = new THREE.Fog(0x435a73, 12, 42);
        hemiLight.color.setHex(0x4c6aa8);
        hemiLight.groundColor.setHex(0x2e1b0f);
        hemiLight.intensity = 0.82;
        sunLight.color.setHex(0x7ca6ff);
        sunLight.intensity = 0.7;
        sunLight.position.set(2.5, 5.0, 2.5);
        oceanMat.color.setHex(0x7bb0cc);
        oceanMat.specular.setHex(0xffbd79);
        oceanMat.emissive.setHex(0x2f6383);
        oceanMat.emissiveIntensity = 1.35;
        sandMat.color.setHex(0x7d6c64);
        foamMat.color.setHex(0x9acae6);
      }
      sandMat.map = mood === 'noon' ? textures.sand : textures.wetSand;
      sandMat.needsUpdate = true;
      beachFireLight.intensity = mood === 'torch' ? 1.8 : mood === 'sunset' ? 0.85 : 0.24;
      postMat.uniforms.uBloomStrength.value = mood === 'torch' ? 0.3 : mood === 'sunset' ? 0.24 : 0.12;
      skyCylMat.needsUpdate = true;
    };

    sceneHandlesRef.current = {
      rebuildDrink,
      updateBeachLighting,
    };

    rebuildDrink();
    updateBeachLighting(simRef.current.beachTime);

    // Direct click raycasting on umbrella or cocktail glass (NO camera rotation!)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const onPointerClick = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactiveTargets, false);
      if (hits.length === 0) return;

      const kind = hits[0].object.userData?.hitKind;
      if (kind === 'umbrella') {
        simRef.current.umbrellaSpinVel = 13.5;
        simRef.current.umbrellaTilt = 0.2;
        audioRef.current?.playUmbrellaFlick();
        setStatusMessage('拨动了扶桑花纸伞 · 十二折伞面随海风旋转');
      } else {
        simRef.current.stirEnergy = 1.0;
        audioRef.current?.playIceClink(2);
        setStatusMessage('轻晃了折面水晶杯 · 冰块清脆碰撞');
      }
    };

    renderer.domElement.addEventListener('click', onPointerClick);

    const renderPs1Pass = () => {
      renderer.setRenderTarget(ps1Target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    };

    let lastW = width;
    let lastH = height;
    const resizeObs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(200, Math.floor(entry.contentRect.width));
      const h = Math.max(150, Math.floor(entry.contentRect.height));
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      const nextH = Math.max(220, Math.min(448, Math.round((ps1ResW * h) / w)));
      ps1Target.setSize(ps1ResW, nextH);
      postMat.uniforms.uResolution.value.set(ps1ResW, nextH);
      postMat.uniforms.uTexelSize.value.set(1 / ps1ResW, 1 / nextH);
      renderPs1Pass();
    });
    resizeObs.observe(container);

    const startMs = performance.now();
    let prevMs = startMs;
    let frameId = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 85);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 85);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min(0.08, Math.max(0.001, (nowMs - prevMs) / 1000));
      const elapsed = (nowMs - startMs) / 1000;
      prevMs = nowMs;

      const sim = simRef.current;
      const spec = getGlassGeometrySpec(presetRef.current.glassShape);

      sim.liquidLevelCurr = THREE.MathUtils.damp(
        sim.liquidLevelCurr,
        sim.liquidLevelTarget,
        6.5,
        dt
      );
      const lvl = Math.max(0.04, sim.liquidLevelCurr);
      const surfY = spec.cavityBottomY + (spec.cavityTopY - spec.cavityBottomY) * lvl;
      const surfRadius = spec.radiusAtY(surfY);
      const topRefRadius = Math.max(0.2, spec.radiusAtY(spec.cavityTopY));
      const rScale = Math.max(0.4, surfRadius / topRefRadius);

      liquidBodyGroup.position.y = spec.cavityBottomY * (1 - lvl);
      liquidBodyGroup.scale.set(rScale, lvl, rScale);

      sim.stirEnergy = THREE.MathUtils.damp(sim.stirEnergy, 0, 2.4, dt);
      if (sim.stirEnergy > 0.002) {
        sim.stirPhase += dt * (1.2 + sim.stirEnergy * 6.0);
      }

      drinkSurfaceGroup.position.y = surfY + 0.004;
      drinkSurfaceGroup.scale.set(rScale, Math.max(0.6, 0.72 + 0.28 * lvl), rScale);
      drinkSurfaceGroup.rotation.y = sim.stirPhase * 0.32;

      submergedIceGroup.children.forEach((chunk) => {
        const { baseAngle, radialFrac, depthOffset } = chunk.userData as {
          baseAngle: number;
          radialFrac: number;
          depthOffset: number;
        };
        const a = baseAngle + sim.stirPhase * 0.6;
        const targetY = Math.max(spec.cavityBottomY + 0.14, surfY - depthOffset);
        const r = spec.radiusAtY(targetY) * radialFrac * 0.68;
        chunk.position.set(Math.cos(a) * r, targetY, Math.sin(a) * r);
        chunk.visible = surfY - spec.cavityBottomY > 0.28;
      });

      if (strawPivot) {
        strawPivot.rotation.y = Math.sin(sim.stirPhase * 2.0) * sim.stirEnergy * 0.14;
      }

      if (umbrellaPivot && umbrellaSpinner) {
        sim.umbrellaAngle += sim.umbrellaSpinVel * dt;
        sim.umbrellaSpinVel = THREE.MathUtils.damp(sim.umbrellaSpinVel, 0, 2.4, dt);
        sim.umbrellaTilt = THREE.MathUtils.damp(sim.umbrellaTilt, 0, 5.0, dt);
        umbrellaSpinner.rotation.y = sim.umbrellaAngle;
        umbrellaPivot.rotation.z = -0.36 + Math.sin(elapsed * 12) * sim.umbrellaTilt;
      }

      // Dynamic Angular Faceted PS1/PS2 Ocean Wave Swells (Crisp moving polygonal ridges!)
      for (let i = 0; i < oceanPos.count; i++) {
        const vx = oceanPos.getX(i);
        const vz = oceanPos.getZ(i);
        const waveA = Math.sin(vx * 0.38 + vz * 0.46 + elapsed * 2.0) * 0.34;
        const waveB = Math.cos(vx * 0.62 - vz * 0.36 - elapsed * 1.5) * 0.22;
        // Sharpened angular crest harmonic for unmistakable PS1/PS2 faceted water ridges
        const ridge = (1.0 - Math.abs(Math.sin(vz * 0.56 + elapsed * 1.4 + vx * 0.16))) * 0.28;
        oceanPos.setY(i, oceanBaseY[i] + waveA + waveB + ridge);
      }
      oceanPos.needsUpdate = true;
      oceanGeo.computeVertexNormals();
      textures.ocean.offset.x = (elapsed * 0.038) % 1;
      textures.ocean.offset.y = (elapsed * 0.062) % 1;

      const glintStrength = sim.beachTime === 'noon' ? 0.92 : sim.beachTime === 'sunset' ? 1.8 : 1.5;
      for (let i = 0; i < glintCount; i++) {
        glintTint.setHex(
          sim.beachTime === 'sunset'
            ? 0xffc57e
            : sim.beachTime === 'torch'
              ? i % 4 === 0
                ? 0xffac55
                : 0x8bc9eb
              : 0xfff4c6
        );
        const x = glintBaseX[i] + Math.sin(elapsed * 0.42 + glintSeeds[i]) * 0.12;
        const localZ = glintBaseZ[i] - oceanMesh.position.z;
        const waveA = Math.sin(x * 0.38 + localZ * 0.46 + elapsed * 2.0) * 0.34;
        const waveB = Math.cos(x * 0.62 - localZ * 0.36 - elapsed * 1.5) * 0.22;
        const ridge = (1.0 - Math.abs(Math.sin(localZ * 0.56 + elapsed * 1.4 + x * 0.16))) * 0.28;
        const twinkle = Math.max(0, Math.sin(elapsed * 3.2 + glintSeeds[i])) ** 7;
        const brightness = glintStrength * (0.48 + twinkle * 0.52);
        glintPositionAttr.setXYZ(
          i,
          x,
          oceanMesh.position.y + waveA + waveB + ridge + 0.045,
          glintBaseZ[i]
        );
        glintColorAttr.setXYZ(
          i,
          glintTint.r * brightness,
          glintTint.g * brightness,
          glintTint.b * brightness
        );
      }
      glintPositionAttr.needsUpdate = true;
      glintColorAttr.needsUpdate = true;

      // Animated angular shoreline surf foam washing onto coral beach
      for (let i = 0; i < foamPos.count; i++) {
        const fx = foamPos.getX(i);
        const wash = Math.sin(elapsed * 1.55 + fx * 0.32) * 0.42;
        foamPos.setZ(i, foamBaseZ[i] + wash);
      }
      foamPos.needsUpdate = true;

      // Gentle sea-breeze palm frond sway
      const pLeftCrown = palmLeft.userData.crown as THREE.Group | undefined;
      const pRightCrown = palmRight.userData.crown as THREE.Group | undefined;
      if (pLeftCrown) pLeftCrown.rotation.z = Math.sin(elapsed * 1.2) * 0.06;
      if (pRightCrown) pRightCrown.rotation.z = Math.cos(elapsed * 1.15) * 0.06;
      animatedModelPalms.forEach((palm, index) => {
        palm.rotation.z = Math.sin(elapsed * 0.85 + index * 1.7) * 0.025;
      });

      // Dynamic Retro Low-Poly Tiki Torch Flames & Warm Flicker Lights
      const torchScale = sim.beachTime === 'torch' ? 0.9 : sim.beachTime === 'sunset' ? 0.82 : 0.68;
      leftTorch.update(elapsed, torchScale);
      rightTorch.update(elapsed, torchScale);

      const flickA = Math.sin(elapsed * 11) * 0.16 + Math.cos(elapsed * 17) * 0.08;
      const flickB = Math.cos(elapsed * 10) * 0.16 + Math.sin(elapsed * 18) * 0.08;
      const baseTorchI = sim.beachTime === 'torch' ? 2.4 : sim.beachTime === 'sunset' ? 1.25 : 0.45;
      leftTorchLight.intensity = baseTorchI + flickA * baseTorchI * 0.4;
      rightTorchLight.intensity = baseTorchI + flickB * baseTorchI * 0.4;
      const beachFireBase = sim.beachTime === 'torch' ? 1.8 : sim.beachTime === 'sunset' ? 0.85 : 0.24;
      beachFireLight.intensity = beachFireBase * (0.92 + flickA * 0.18);

      renderPs1Pass();

      if (IS_SOFTWARE_GL) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    renderPs1Pass();
    if (IS_SOFTWARE_GL) {
      afterDraw(tick);
    } else {
      frameId = window.requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      if (IS_SOFTWARE_GL) {
        window.clearTimeout(frameId);
      } else {
        window.cancelAnimationFrame(frameId);
      }
      resizeObs.disconnect();
      renderer.domElement.removeEventListener('click', onPointerClick);
      clearDrinkMeshes();
      loadedModelRoots.forEach(disposeLoadedModel);
      [leftTorch.root, rightTorch.root].forEach((torchRoot) =>
        torchRoot.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          } else if (object instanceof THREE.Sprite) {
            object.material.dispose();
          }
        })
      );
      fireGlowTexture.dispose();
      sceneHandlesRef.current = null;
      ps1Target.dispose();
      postMat.dispose();
      postQuad.geometry.dispose();
      glintGeometry.dispose();
      (sunGlints.material as THREE.Material).dispose();
      textures.dispose();
      renderer.dispose();
    };
  }, []);

  const handleSelectCocktail = (id: string) => {
    const preset = TROPICAL_COCKTAILS.find((c) => c.id === id);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setLiquidLevel(0.88);
    simRef.current.stirEnergy = 0.65;
    audioRef.current?.playPour();
    audioRef.current?.playIceClink(2);
    setStatusMessage(`已呈上 ${preset.nameZh} (${preset.abvLabel}) · ${preset.flavorNote}`);
  };

  const handleSip = () => {
    if (liquidLevel <= 0.05) {
      audioRef.current?.playSip(true);
      setStatusMessage('酒杯已经喝空啦 · 请点击「续酒」');
      return;
    }
    const next = sipLiquidLevel(liquidLevel, 0.2);
    setLiquidLevel(next);
    simRef.current.stirEnergy = 0.4;
    audioRef.current?.playSip(next <= 0.1);
    setStatusMessage(
      next <= 0.1
        ? '啜饮至杯底 · 可随时点击「续酒」'
        : `啜饮了一口 ${activePreset.nameZh} · 剩余酒液 ${Math.round(next * 100)}%`
    );
  };

  const handleRefill = () => {
    setLiquidLevel(0.9);
    simRef.current.stirEnergy = 0.85;
    audioRef.current?.playPour();
    audioRef.current?.playIceClink(2);
    setStatusMessage(`已续满 ${activePreset.nameZh} · 折面水晶杯重现清凉层次`);
  };

  const handleFlickUmbrella = () => {
    simRef.current.umbrellaSpinVel = 14.0;
    simRef.current.umbrellaTilt = 0.22;
    audioRef.current?.playUmbrellaFlick();
    setStatusMessage('拨动了扶桑花纸伞 · 十二折伞面随海风旋转');
  };

  const moodLabel = beachTime === 'noon' ? '晴朗正午' : beachTime === 'sunset' ? '金红落日' : '夏夜火把';

  return (
    <div
      className="flex flex-col w-full h-full bg-[#D4D0C8] select-none relative text-[11px]"
      onClick={() => openMenu && setOpenMenu(null)}
    >
      {/* Classic Win2K Menu Bar */}
      <div className="h-[20px] flex items-center px-1 border-b border-[#808080] bg-[#D4D0C8] gap-0.5 shrink-0 z-20">
        <div className="relative">
          <button
            type="button"
            className={`px-2 py-0.5 ${
              openMenu === 'drink' ? 'bg-[#0A246A] text-white' : 'hover:bg-[#0A246A] hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'drink' ? null : 'drink');
            }}
          >
            酒单(<u>D</u>)
          </button>
          {openMenu === 'drink' && (
            <div className="absolute left-0 top-full w-[176px] win2k-raised bg-[#D4D0C8] py-0.5 z-50">
              {TROPICAL_COCKTAILS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-2 py-1 hover:bg-[#0A246A] hover:text-white flex items-center gap-1.5"
                  onClick={() => {
                    handleSelectCocktail(c.id);
                    setOpenMenu(null);
                  }}
                >
                  <span className="w-3 inline-flex items-center justify-center">
                    {selectedPresetId === c.id && <PixelRadioDot />}
                  </span>
                  <span>{c.nameZh}</span>
                </button>
              ))}
              <div className="my-0.5 border-t border-[#808080] border-b border-white" />
              <button
                type="button"
                className="w-full text-left px-5 py-1 hover:bg-[#0A246A] hover:text-white"
                onClick={onClose}
              >
                退出(X)
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`px-2 py-0.5 ${
              openMenu === 'scene' ? 'bg-[#0A246A] text-white' : 'hover:bg-[#0A246A] hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'scene' ? null : 'scene');
            }}
          >
            场景(<u>V</u>)
          </button>
          {openMenu === 'scene' && (
            <div className="absolute left-0 top-full w-[176px] win2k-raised bg-[#D4D0C8] py-0.5 z-50">
              {(['noon', 'sunset', 'torch'] as BeachTimeId[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="w-full text-left px-2 py-1 hover:bg-[#0A246A] hover:text-white flex items-center gap-1.5"
                  onClick={() => {
                    setBeachTime(m);
                    setOpenMenu(null);
                  }}
                >
                  <span className="w-3 inline-flex items-center justify-center">
                    {beachTime === m && <PixelRadioDot />}
                  </span>
                  <span>
                    {m === 'noon' ? '晴朗正午海滩' : m === 'sunset' ? '金红落日湾' : '夏夜海滩火把'}
                  </span>
                </button>
              ))}
              <div className="my-0.5 border-t border-[#808080] border-b border-white" />
              <button
                type="button"
                className="w-full text-left px-2 py-1 hover:bg-[#0A246A] hover:text-white flex items-center gap-1.5"
                onClick={() => {
                  setSoundEnabled((v) => !v);
                  setOpenMenu(null);
                }}
              >
                <span className="w-3 inline-flex items-center justify-center">
                  {soundEnabled && <PixelCheckmark />}
                </span>
                <span>海浪与冰块音效</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`px-2 py-0.5 ${
              openMenu === 'help' ? 'bg-[#0A246A] text-white' : 'hover:bg-[#0A246A] hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'help' ? null : 'help');
            }}
          >
            帮助(<u>H</u>)
          </button>
          {openMenu === 'help' && (
            <div className="absolute left-0 top-full w-[164px] win2k-raised bg-[#D4D0C8] py-0.5 z-50">
              <button
                type="button"
                className="w-full text-left px-3 py-1 hover:bg-[#0A246A] hover:text-white"
                onClick={() => {
                  setShowAbout(true);
                  setOpenMenu(null);
                }}
              >
                关于 Royal Hawaii...
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Retro PS1/PS2 3D Viewport (Fixed Elevated View, Click-Interactive) */}
      <div className="flex-1 min-h-0 p-1 flex flex-col">
        <div
          ref={canvasMountRef}
          data-testid="royal-hawaii-canvas"
          className="flex-1 min-h-[210px] win2k-sunken bg-[#10263A] relative overflow-hidden cursor-pointer"
        />
      </div>

      {/* Streamlined Single-Row Bar Control Strip (NO camera rotation controls!) */}
      <div className="px-1 pb-1 pt-0.5 bg-[#D4D0C8] shrink-0">
        <div className="flex items-center gap-0.5 flex-nowrap overflow-x-auto">
          {TROPICAL_COCKTAILS.map((c) => {
            const active = selectedPresetId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`px-1.5 py-0.5 whitespace-nowrap ${
                  active ? 'win2k-sunken bg-[#EAE6DE] font-bold' : 'win2k-raised bg-[#D4D0C8]'
                }`}
                onClick={() => handleSelectCocktail(c.id)}
              >
                {c.nameZh}
              </button>
            );
          })}

          <div className="w-[1px] h-[16px] bg-[#808080] border-r border-white mx-0.5 shrink-0" />

          {(['noon', 'sunset', 'torch'] as BeachTimeId[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`px-1.5 py-0.5 whitespace-nowrap ${
                beachTime === m ? 'win2k-sunken bg-[#EAE6DE] font-bold' : 'win2k-raised bg-[#D4D0C8]'
              }`}
              onClick={() => setBeachTime(m)}
            >
              {m === 'noon' ? '正午' : m === 'sunset' ? '落日' : '夜火把'}
            </button>
          ))}

          <div className="w-[1px] h-[16px] bg-[#808080] border-r border-white mx-0.5 shrink-0" />

          <button
            type="button"
            className="win2k-raised bg-[#D4D0C8] px-1.5 py-0.5 whitespace-nowrap active:win2k-sunken"
            onClick={handleFlickUmbrella}
          >
            拨纸伞
          </button>

          <button
            type="button"
            className="win2k-raised bg-[#D4D0C8] px-1.5 py-0.5 whitespace-nowrap active:win2k-sunken"
            onClick={handleSip}
          >
            啜饮
          </button>

          <button
            type="button"
            className="win2k-raised bg-[#D4D0C8] px-1.5 py-0.5 whitespace-nowrap active:win2k-sunken"
            onClick={handleRefill}
          >
            续酒
          </button>
        </div>
      </div>

      {/* Classic Win2K Sunken Status Bar */}
      <div className="h-[20px] flex items-center gap-1 px-1 pb-0.5 bg-[#D4D0C8] shrink-0">
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center flex-1 truncate">
          {statusMessage}
        </div>
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center w-[98px] shrink-0 truncate">
          液位 {Math.round(liquidLevel * 100)}%
        </div>
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center w-[112px] shrink-0 truncate">
          {moodLabel} · PS1/2 3D
        </div>
      </div>

      {showAbout && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/25"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="win2k-window bg-[#D4D0C8] w-[320px] p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="win2k-titlebar-active h-[20px] px-1.5 flex items-center justify-between text-white font-bold">
              <span>关于 Royal Hawaii 3D</span>
              <button
                type="button"
                className="win2k-raised bg-[#D4D0C8] text-black w-[15px] h-[14px] flex items-center justify-center text-[10px]"
                onClick={() => setShowAbout(false)}
              >
                ×
              </button>
            </div>
            <div className="p-3 flex gap-3 items-start">
              <Win2kIcon kind="royal-hawaii" size={32} />
              <div className="space-y-1.5 leading-relaxed">
                <div className="font-bold">Royal Hawaii 3D Lounge (Build 2000.4)</div>
                <div>经典 PS1/PS2 硬朗低多边形折面引擎 · 16-bit Bayer 抖动</div>
                <div className="text-[#404040]">
                  收录 4 款经典热带鸡尾酒、高角度固定观景吧台视角、全套千禧年像素贴图与动态棱角起伏海浪。
                </div>
              </div>
            </div>
            <div className="px-3 pb-2.5 flex justify-end">
              <button
                type="button"
                className="win2k-raised bg-[#D4D0C8] px-5 py-1"
                onClick={() => setShowAbout(false)}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
