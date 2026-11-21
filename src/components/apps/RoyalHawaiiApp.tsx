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
import {
  bakeCounterLightmap,
  bakeGlassCausticTexture,
  bakePropRadiosityLightmap,
  bakeRetroStudioEnvMap,
  ensureUv1,
} from '../../core/retroRadiosityBaker';
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

// 1999 CG / PS2 Retro Post-Pass: Luminous radiosity lift + 4-tap highlight bloom + 4x4 ordered Bayer dithering
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
    return sampleColor * smoothstep(0.70, 0.94, luminance);
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
    vec3 lifted = pow(clamp(col.rgb, 0.0, 1.0), vec3(0.93));
    vec3 glow = lifted + bloom * uBloomStrength;
    vec2 px = floor(vUv * uResolution);
    float dither = (bayer4x4(px) - 0.5) / 48.0;
    vec3 quant = floor((glow + dither) * 48.0 + 0.5) / 48.0;
    gl_FragColor = vec4(clamp(quant, 0.0, 1.0), 1.0);
  }
`;

function createPs1PalmTree(textures: Ps1TextureSet, heightScale = 1, lean = 0.25): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshPhongMaterial({
    map: textures.palmBark,
    flatShading: true,
    shininess: 10,
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

  const cocoMat = new THREE.MeshPhongMaterial({ color: 0x734420, flatShading: true });
  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * Math.PI * 2;
    const coco = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 * heightScale, 0), cocoMat);
    coco.position.set(Math.cos(a) * 0.14, -0.06, Math.sin(a) * 0.14);
    crown.add(coco);
  }

  const frondMat = new THREE.MeshPhongMaterial({
    map: textures.palmFrond,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    flatShading: true,
    shininess: 16,
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

function createRetroTikiTorch(
  textures: Ps1TextureSet,
  phase: number,
  glowTexture: THREE.Texture
) {
  const root = new THREE.Group();

  const poleMat = new THREE.MeshPhongMaterial({
    map: textures.rattanMat,
    color: 0xc99652,
    flatShading: true,
    shininess: 14,
  });
  const ironMat = new THREE.MeshPhongMaterial({
    color: 0x4e3c2e,
    flatShading: true,
    shininess: 26,
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 7), poleMat);
  pole.position.y = 1.8;
  root.add(pole);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.34, 7), ironMat);
  cup.position.y = 3.72;
  root.add(cup);

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

  const jitter = (
    geometry: THREE.BufferGeometry,
    base: Float32Array,
    t: number,
    amplitude: number
  ) => {
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

function getCocktailCausticColor(presetId: string): number {
  if (presetId === 'blue-hawaii') return 0x3ef0ff;
  if (presetId === 'pina-colada') return 0xffe89e;
  if (presetId === 'hawaiian-hurricane') return 0xff5a68;
  return 0xffa63d; // royal-mai-tai warm amber-ruby refraction
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
  const [statusMessage, setStatusMessage] = useState<string>(firstPreset.nameZh);

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
    onUpdateTitleRef.current?.(`Royal Hawaii - ${activePreset.nameZh}`);
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
    scene.background = new THREE.Color(0x4eb8f0);
    scene.fog = new THREE.Fog(0x9be2fa, 18, 46);

    const width = Math.max(240, container.clientWidth || 560);
    const height = Math.max(180, container.clientHeight || 340);

    // Classic 1999 Telephoto Still-Life Lens (FOV 20° — balanced glassware, bar props & ocean vista)
    const camera = new THREE.PerspectiveCamera(20, width / height, 0.1, 88);
    camera.position.set(0, 4.62, 9.95);
    camera.lookAt(0, 1.16, 0);

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

    // PS2-era crisp 640px offscreen RenderTarget -> highlight bloom + luminous lift + 4x4 Bayer dither
    const ps1ResW = 640;
    const ps1ResH = Math.max(240, Math.min(448, Math.round((ps1ResW * height) / width)));
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
        uBloomStrength: { value: 0.14 },
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
            applyVertexGradient(mesh.geometry, 'y', 0xd6d6d6, 0xfff8e6);
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
              const std = material as THREE.MeshStandardMaterial;
              std.vertexColors = true;
              // Keep PBR props bright & coherent without global scene.environment
              if (typeof std.metalness === 'number') {
                std.metalness = Math.min(std.metalness, 0.15);
              }
              if (typeof std.roughness === 'number') {
                std.roughness = Math.max(std.roughness, 0.55);
              }
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
    // 0. PRE-BAKE 3-BOUNCE RADIOSITY LIGHTMAPS + GLASS CAUSTICS + STUDIO ENVMAPS
    // =========================================================================
    const counterLightMaps: Record<BeachTimeId, THREE.CanvasTexture> = {
      noon: bakeCounterLightmap('noon'),
      sunset: bakeCounterLightmap('sunset'),
      torch: bakeCounterLightmap('torch'),
    };
    const propLightMaps: Record<BeachTimeId, THREE.CanvasTexture> = {
      noon: bakePropRadiosityLightmap('noon'),
      sunset: bakePropRadiosityLightmap('sunset'),
      torch: bakePropRadiosityLightmap('torch'),
    };
    const studioEnvMaps: Record<BeachTimeId, THREE.CanvasTexture> = {
      noon: bakeRetroStudioEnvMap('noon'),
      sunset: bakeRetroStudioEnvMap('sunset'),
      torch: bakeRetroStudioEnvMap('torch'),
    };
    const causticTex = bakeGlassCausticTexture();

    // =========================================================================
    // 1. 1999 RETRO STILL-LIFE CG MULTI-BOUNCE LIGHTING RIG + BEACH FIRE LIGHT
    // =========================================================================
    const hemiLight = new THREE.HemisphereLight(0xd9f5ff, 0xa86f3e, 1.55);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff6dc, 1.95);
    sunLight.position.set(4.6, 7.6, 4.2);
    scene.add(sunLight);

    // Bounce 2: Ocean Horizon Turquoise/Coral Indirect Rim Light from behind the bar
    const oceanBounceLight = new THREE.DirectionalLight(0x68eeff, 1.05);
    oceanBounceLight.position.set(-3.2, 3.4, -5.2);
    scene.add(oceanBounceLight);

    // Bounce 3: Warm Mahogany Countertop Radiosity Up-Fill
    const counterUpFill = new THREE.PointLight(0xffcb8c, 1.35, 9.5, 1.2);
    counterUpFill.position.set(-0.3, 0.72, 2.35);
    scene.add(counterUpFill);

    const leftTorchLight = new THREE.PointLight(0xff9230, 1.2, 12, 1.3);
    leftTorchLight.position.set(-2.38, 2.32, -1.25);
    scene.add(leftTorchLight);

    const rightTorchLight = new THREE.PointLight(0xff9230, 1.2, 12, 1.3);
    rightTorchLight.position.set(2.38, 2.32, -1.25);
    scene.add(rightTorchLight);

    const beachFireLight = new THREE.PointLight(0xff7b32, 0.35, 10, 1.5);
    beachFireLight.position.set(2.65, -0.45, -6.4);
    scene.add(beachFireLight);

    // =========================================================================
    // 2. MAHOGANY BAR COUNTER + BAKED RADIOSITY + BAMBOO RELIEF + KENNEY PROPS
    // =========================================================================
    const barGroup = new THREE.Group();

    const counterTopGeo = ensureUv1(new THREE.BoxGeometry(8.2, 0.34, 3.4));
    const counterTopMat = new THREE.MeshPhongMaterial({
      map: textures.barWood,
      lightMap: counterLightMaps.noon,
      lightMapIntensity: 2.1,
      color: 0xffe2c7,
      emissive: 0x382012,
      flatShading: true,
      specular: 0xbd8d60,
      shininess: 34,
    });
    const counterTop = new THREE.Mesh(counterTopGeo, counterTopMat);
    counterTop.position.set(0, -0.17, 0.25);
    barGroup.add(counterTop);

    const counterApronMat = new THREE.MeshPhongMaterial({
      map: textures.barBamboo,
      bumpMap: textures.barRelief,
      bumpScale: 0.035,
      lightMap: propLightMaps.noon,
      lightMapIntensity: 1.55,
      color: 0xd9a278,
      emissive: 0x26150c,
      flatShading: true,
      shininess: 14,
    });
    const counterBody = new THREE.Mesh(
      ensureUv1(new THREE.BoxGeometry(7.9, 1.4, 3.1)),
      counterApronMat
    );
    counterBody.position.set(0, -1.04, 0.25);
    barGroup.add(counterBody);

    const bambooMat = new THREE.MeshPhongMaterial({
      map: textures.barBamboo,
      bumpMap: textures.barRelief,
      bumpScale: 0.025,
      lightMap: propLightMaps.noon,
      lightMapIntensity: 1.5,
      color: 0xf8d79c,
      emissive: 0x2c1d0c,
      flatShading: true,
      shininess: 24,
    });
    const backRail = new THREE.Mesh(
      ensureUv1(new THREE.CylinderGeometry(0.12, 0.12, 8.3, 7)),
      bambooMat
    );
    backRail.rotation.z = Math.PI / 2;
    backRail.position.set(0, -0.04, -1.42);
    barGroup.add(backRail);

    // Woven Golden Rattan Table Mat with Baked Multi-Bounce Radiosity
    const rattanMatMaterial = new THREE.MeshPhongMaterial({
      map: textures.rattanMat,
      lightMap: counterLightMaps.noon,
      lightMapIntensity: 1.75,
      color: 0xffe8be,
      emissive: 0x33200e,
      flatShading: true,
      shininess: 16,
    });
    const rattanBarMat = new THREE.Mesh(
      ensureUv1(new THREE.BoxGeometry(2.6, 0.025, 1.65)),
      rattanMatMaterial
    );
    rattanBarMat.position.set(0, 0.012, 0.04);
    barGroup.add(rattanBarMat);

    const coasterMat = new THREE.MeshPhongMaterial({
      map: textures.coaster,
      lightMap: propLightMaps.noon,
      lightMapIntensity: 1.55,
      color: 0xfff5db,
      emissive: 0x2b1d0d,
      flatShading: true,
      shininess: 18,
    });
    const coasterDisk = new THREE.Mesh(
      ensureUv1(new THREE.CylinderGeometry(0.75, 0.79, 0.04, 10)),
      coasterMat
    );
    coasterDisk.position.set(0, 0.038, 0);
    barGroup.add(coasterDisk);

    // Raytraced Colored Glass Refraction Caustic Projection Pool
    const causticMat = new THREE.MeshBasicMaterial({
      map: causticTex,
      color: getCocktailCausticColor(firstPreset.id),
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const causticPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.55), causticMat);
    causticPlane.rotation.x = -Math.PI / 2;
    causticPlane.position.set(-0.42, 0.06, -0.18);
    causticPlane.renderOrder = 2;
    barGroup.add(causticPlane);

    // Left Counter Prop: Carved Polynesian Tiki Idol illuminated by Baked Multi-Bounce Radiosity
    const totemSideMat = new THREE.MeshPhongMaterial({
      map: textures.barWood,
      lightMap: propLightMaps.noon,
      lightMapIntensity: 1.95,
      color: 0xd9ad82,
      emissive: 0x3a2517,
      flatShading: true,
      shininess: 20,
    });
    const totemFrontMat = new THREE.MeshPhongMaterial({
      map: textures.totemFront,
      lightMap: propLightMaps.noon,
      lightMapIntensity: 2.15,
      color: 0xfff0dc,
      emissive: 0x453020,
      flatShading: true,
      shininess: 26,
    });
    const totemMesh = new THREE.Mesh(ensureUv1(new THREE.BoxGeometry(0.56, 1.24, 0.44)), [
      totemSideMat,
      totemSideMat,
      totemSideMat,
      totemSideMat,
      totemFrontMat,
      totemFrontMat,
    ]);
    totemMesh.position.set(-1.58, 0.62, -0.44);
    totemMesh.rotation.y = 0.36;
    barGroup.add(totemMesh);

    // Right Counter Prop: Turned Koa-Wood Ice & Lime Dish with Studio Ice Reflections
    const dishGroup = new THREE.Group();
    const bowlMat = new THREE.MeshPhongMaterial({
      map: textures.barWood,
      lightMap: propLightMaps.noon,
      lightMapIntensity: 1.85,
      color: 0xf5ba80,
      emissive: 0x382010,
      flatShading: true,
      shininess: 30,
    });
    const bowl = new THREE.Mesh(ensureUv1(new THREE.CylinderGeometry(0.4, 0.25, 0.26, 8)), bowlMat);
    bowl.position.y = 0.13;
    dishGroup.add(bowl);

    const bowlIceMat = new THREE.MeshPhongMaterial({
      map: textures.ice,
      envMap: studioEnvMaps.noon,
      reflectivity: 0.55,
      combine: THREE.MixOperation,
      color: 0xe8fbff,
      flatShading: true,
      specular: 0xffffff,
      shininess: 96,
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
        shininess: 26,
      })
    );
    spareLime.position.set(-0.22, 0.28, 0.22);
    spareLime.rotation.set(0.65, 0.4, 0.35);
    dishGroup.add(spareLime);
    dishGroup.position.set(1.48, 0, -0.28);
    barGroup.add(dishGroup);

    // Curated Kenney CC0 Bar Props framed neatly along the telephoto counter wings (zero overlap!)
    loadKenneyModel('/models/pirate/bottle-rum.glb', barGroup, [-2.14, 0.02, -0.78], 0.72, 0.32);
    loadKenneyModel('/models/pirate/barrel.glb', barGroup, [-2.82, 0.02, -0.58], 0.84, 0.18);
    loadKenneyModel('/models/food/cocktail.glb', barGroup, [-2.74, 0.02, 0.22], 0.62, -0.2);
    loadKenneyModel('/models/holiday/lantern.glb', barGroup, [2.16, 0.02, -0.82], 0.64, -0.35);

    const fruitDressing = new THREE.Group();
    fruitDressing.position.set(2.28, 0.02, 0.18);
    barGroup.add(fruitDressing);
    loadKenneyModel('/models/food/pineapple.glb', fruitDressing, [0.22, 0, -0.28], 0.46, 0.4);
    loadKenneyModel('/models/food/orange.glb', fruitDressing, [-0.24, 0, 0.16], 0.28);
    loadKenneyModel('/models/food/lemon-half.glb', fruitDressing, [0.24, 0, 0.22], 0.26, -0.5);
    loadKenneyModel('/models/food/cherries.glb', fruitDressing, [-0.14, 0, -0.34], 0.24);
    loadKenneyModel('/models/food/coconut-half.glb', fruitDressing, [0.38, 0, -0.02], 0.31, 0.7);
    loadKenneyModel('/models/food/strawberry.glb', fruitDressing, [0.02, 0, 0.34], 0.22, 0.5);
    loadKenneyModel('/models/food/whipped-cream.glb', fruitDressing, [-0.36, 0, -0.14], 0.24, 0.35);

    // Flanking Standing Bamboo Tiki Torches with Layered Additive Flames & Glow Sprite
    const fireGlowTexture = createFlameGlowTexture();
    const leftTorch = createRetroTikiTorch(textures, 0.4, fireGlowTexture);
    leftTorch.root.position.set(-2.36, -1.78, -1.35);
    barGroup.add(leftTorch.root);

    const rightTorch = createRetroTikiTorch(textures, 3.6, fireGlowTexture);
    rightTorch.root.position.set(2.36, -1.78, -1.35);
    barGroup.add(rightTorch.root);

    scene.add(barGroup);

    // =========================================================================
    // 3. DYNAMIC ANGULAR PS1/PS2 OCEAN + WET SAND + SUN GLINTS + KENNEY COVE
    // =========================================================================
    const vistaGroup = new THREE.Group();

    const skyCylGeo = new THREE.CylinderGeometry(36, 36, 26, 20, 1, true);
    skyCylGeo.scale(-1, 1, 1);
    const skyCylMat = new THREE.MeshBasicMaterial({
      map: textures.skyNoon,
      fog: false,
    });
    const skyCyl = new THREE.Mesh(skyCylGeo, skyCylMat);
    skyCyl.position.set(0, 6.4, 0);
    skyCyl.rotation.y = Math.PI * 0.5;
    vistaGroup.add(skyCyl);

    const sandGeo = new THREE.PlaneGeometry(36, 7.5, 14, 4);
    sandGeo.rotateX(-Math.PI / 2);
    applyVertexGradient(sandGeo, 'z', 0xc9a882, 0xfff4d6);
    const sandMat = new THREE.MeshPhongMaterial({
      map: textures.sand,
      vertexColors: true,
      color: 0xfff5dc,
      flatShading: true,
      shininess: 10,
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
        opacity: 0.42,
        depthWrite: false,
        flatShading: true,
        shininess: 38,
      })
    );
    wetSand.position.set(0, -1.685, -6.0);
    vistaGroup.add(wetSand);

    // Dynamic Angular Faceted PS1/PS2 Ocean Water with Vertex Horizon Gradient
    const oceanGeo = new THREE.PlaneGeometry(58, 44, 34, 24);
    oceanGeo.rotateX(-Math.PI / 2);
    applyVertexGradient(oceanGeo, 'z', 0x90a8b8, 0xdcf4eb);
    const oceanBaseY = new Float32Array(oceanGeo.attributes.position.count);
    const oceanPos = oceanGeo.attributes.position;
    for (let i = 0; i < oceanPos.count; i++) {
      oceanBaseY[i] = oceanPos.getY(i);
    }

    const oceanMat = new THREE.MeshPhongMaterial({
      map: textures.ocean,
      color: 0x3ce4fa,
      specular: 0xe6feff,
      shininess: 78,
      emissive: 0x092c38,
      emissiveIntensity: 0.45,
      vertexColors: true,
      flatShading: true,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.set(0, -1.76, -21.5);
    vistaGroup.add(oceanMesh);

    const foamGeo = new THREE.PlaneGeometry(34, 0.48, 22, 2);
    foamGeo.rotateX(-Math.PI / 2);
    const foamPos = foamGeo.attributes.position;
    const foamBaseZ = new Float32Array(foamPos.count);
    for (let i = 0; i < foamPos.count; i++) {
      foamBaseZ[i] = foamPos.getZ(i);
    }
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xeafcff,
      transparent: true,
      opacity: 0.36,
    });
    const foamRibbon = new THREE.Mesh(foamGeo, foamMat);
    foamRibbon.position.set(0, -1.66, -6.2);
    vistaGroup.add(foamRibbon);

    // Animated Sun / Moon Glint Path Sparkling Across the Faceted Ocean Waves
    const glintCount = 48;
    const glintGeometry = new THREE.BufferGeometry();
    const glintPositions = new Float32Array(glintCount * 3);
    const glintColors = new Float32Array(glintCount * 3);
    const glintSeeds = new Float32Array(glintCount);
    const glintBaseX = new Float32Array(glintCount);
    const glintBaseZ = new Float32Array(glintCount);
    for (let i = 0; i < glintCount; i++) {
      const depth = i / (glintCount - 1);
      glintBaseX[i] = Math.sin(i * 12.9898) * (0.16 + depth * 1.15);
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

    // Swaying PS1 Palms + Distant Kenney Cove Palms, Rocks, Sailboat & Fire Basket
    const palmLeft = createPs1PalmTree(textures, 1.15, 0.3);
    palmLeft.position.set(-3.45, -1.65, -7.6);
    palmLeft.rotation.y = 0.45;
    vistaGroup.add(palmLeft);

    const palmRight = createPs1PalmTree(textures, 1.18, -0.28);
    palmRight.position.set(3.55, -1.65, -7.8);
    palmRight.rotation.y = -0.35;
    vistaGroup.add(palmRight);

    const leftKenneyPalm = loadKenneyModel(
      '/models/pirate/palm-bend.glb',
      vistaGroup,
      [-4.15, -1.68, -9.3],
      3.9,
      0.25
    );
    const rightKenneyPalm = loadKenneyModel(
      '/models/pirate/palm-straight.glb',
      vistaGroup,
      [4.2, -1.68, -9.5],
      3.8,
      -0.25
    );
    animatedModelPalms.push(leftKenneyPalm, rightKenneyPalm);
    loadKenneyModel('/models/pirate/rocks-sand-a.glb', vistaGroup, [-4.35, -1.7, -7.6], 1.65, 0.2);
    loadKenneyModel('/models/pirate/rocks-sand-b.glb', vistaGroup, [4.45, -1.7, -7.8], 1.55, -0.3);
    loadKenneyModel('/models/watercraft/boat-sail.glb', vistaGroup, [1.85, -1.42, -16.8], 2.05, 0.55);
    loadKenneyModel('/models/graveyard/fire-basket.glb', vistaGroup, [2.65, -1.68, -6.5], 1.05, 0.2);

    // Warm living ember glow sprite nested inside the beach fire basket
    const beachFireGlowMat = new THREE.SpriteMaterial({
      map: fireGlowTexture,
      color: 0xff8c30,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beachFireGlow = new THREE.Sprite(beachFireGlowMat);
    beachFireGlow.position.set(2.65, -0.86, -6.5);
    beachFireGlow.scale.set(0.85, 1.05, 1);
    vistaGroup.add(beachFireGlow);

    const awning = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 2.8),
      new THREE.MeshPhongMaterial({
        map: textures.thatch,
        color: 0xedd39d,
        flatShading: true,
        side: THREE.DoubleSide,
      })
    );
    awning.position.set(0, 4.45, -1.3);
    awning.rotation.x = 0.55;
    vistaGroup.add(awning);

    scene.add(vistaGroup);

    // =========================================================================
    // 4. 1999 CG RAYTRACED CRYSTAL GLASSWARE + CONDENSATION + SPECULAR STREAKS
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
    let activeEnvMaterials: THREE.MeshPhongMaterial[] = [];
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
      activeEnvMaterials = [];
      umbrellaSpinner = null;
      umbrellaPivot = null;
      strawPivot = null;
    };

    const rebuildDrink = () => {
      clearDrinkMeshes();
      const preset = presetRef.current;
      const spec = getGlassGeometrySpec(preset.glassShape);
      const segs = spec.radialSegments;
      const curEnvMap = studioEnvMaps[simRef.current.beachTime];

      causticMat.color.setHex(getCocktailCausticColor(preset.id));

      // 1. Luminous Backlit Multi-Layered Retro Liquid Volumes
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
        const baseCol = new THREE.Color(slice.layer.color).lerp(new THREE.Color(0xffffff), 0.1);
        const sliceMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.liquidPulp,
            color: baseCol,
            emissive: new THREE.Color(slice.layer.color).multiplyScalar(0.42),
            specular: 0xfffdf0,
            shininess: 68,
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

      // 2. Steady Faceted Drink Top Surface (Meniscus + Crystal Ice / Foam Swirl)
      drinkSurfaceGroup = new THREE.Group();
      const topLayer = preset.layers[preset.layers.length - 1];
      const topR = spec.radiusAtY(spec.cavityTopY) * 0.95;

      const meniscusGeo = track(new THREE.CircleGeometry(topR, segs));
      const meniscusMat = track(
        new THREE.MeshPhongMaterial({
          map: textures.liquidPulp,
          color: new THREE.Color(topLayer.color).lerp(new THREE.Color(0xffffff), 0.24),
          emissive: new THREE.Color(topLayer.color).multiplyScalar(0.32),
          specular: 0xffffff,
          shininess: 88,
          flatShading: true,
        })
      );
      const meniscus = new THREE.Mesh(meniscusGeo, meniscusMat);
      meniscus.rotation.x = -Math.PI / 2;
      meniscus.userData = { hitKind: 'drink' };
      drinkSurfaceGroup.add(meniscus);
      interactiveTargets.push(meniscus);

      if (preset.topStyle === 'coconut-cream-swirl') {
        const creamMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.liquidFoam,
            color: 0xfffff8,
            emissive: 0x3b362b,
            specular: 0xffffff,
            shininess: 36,
            flatShading: true,
          })
        );
        const tier1 = new THREE.Mesh(
          track(new THREE.CylinderGeometry(topR * 0.62, topR * 0.84, 0.16, 8)),
          creamMat
        );
        tier1.position.y = 0.08;
        const tier2 = new THREE.Mesh(
          track(new THREE.CylinderGeometry(topR * 0.34, topR * 0.6, 0.15, 8)),
          creamMat
        );
        tier2.position.y = 0.22;
        const peak = new THREE.Mesh(track(new THREE.ConeGeometry(topR * 0.34, 0.22, 8)), creamMat);
        peak.position.y = 0.39;
        peak.rotation.z = 0.12;
        drinkSurfaceGroup.add(tier1, tier2, peak);
      } else {
        const surfIceMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.ice,
            envMap: curEnvMap,
            reflectivity: 0.58,
            combine: THREE.MixOperation,
            color: 0xeefdff,
            specular: 0xffffff,
            shininess: 115,
            flatShading: true,
            transparent: true,
            opacity: 0.88,
          })
        );
        activeEnvMaterials.push(surfIceMat);
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

      // 3. Submerged Faceted Ice Cubes
      submergedIceGroup = new THREE.Group();
      const subIceMat = track(
        new THREE.MeshPhongMaterial({
          map: textures.ice,
          envMap: curEnvMap,
          reflectivity: 0.45,
          combine: THREE.MixOperation,
          color: 0xe4f9ff,
          specular: 0xffffff,
          shininess: 92,
          flatShading: true,
          transparent: true,
          opacity: 0.68,
        })
      );
      activeEnvMaterials.push(subIceMat);
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

      // 4. Cut-Crystal Glassware with Condensation Bump, Studio Reflection EnvMap, Rim & Specular Streaks
      const lathePts = spec.outerPoints.map((p) => new THREE.Vector2(p.r, p.y));
      const glassGeo = track(new THREE.LatheGeometry(lathePts, segs));
      const glassMat = track(
        new THREE.MeshPhongMaterial({
          map: textures.glassCrystal,
          bumpMap: textures.glassCondensation,
          bumpScale: 0.028,
          envMap: curEnvMap,
          reflectivity: 0.68,
          combine: THREE.MixOperation,
          color: 0xecfbff,
          specular: 0xffffff,
          shininess: 145,
          emissive: 0x102e3a,
          emissiveIntensity: 0.16,
          flatShading: true,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      );
      activeEnvMaterials.push(glassMat);
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.renderOrder = 4;
      glassMesh.userData = { hitKind: 'drink' };
      cocktailRoot.add(glassMesh);
      interactiveTargets.push(glassMesh);

      const shamGeo = track(
        new THREE.CylinderGeometry(spec.shamRadius, spec.shamRadius * 0.94, spec.shamHeight, segs)
      );
      const shamMat = track(
        new THREE.MeshPhongMaterial({
          map: textures.glassCrystal,
          bumpMap: textures.glassRelief,
          bumpScale: 0.035,
          envMap: curEnvMap,
          reflectivity: 0.62,
          combine: THREE.MixOperation,
          color: 0xd4f3fc,
          specular: 0xffffff,
          shininess: 120,
          flatShading: true,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        })
      );
      activeEnvMaterials.push(shamMat);
      const sham = new THREE.Mesh(shamGeo, shamMat);
      sham.position.y = spec.shamHeight * 0.5 + 0.01;
      sham.renderOrder = 3;
      cocktailRoot.add(sham);

      // Subtle Glass Rim Highlight & Two Soft Specular Streaks (replaces harsh wireframe edges)
      const rimY = spec.rimY;
      const rimR = spec.rimRadius;
      const rimPoints = Array.from({ length: segs }, (_, index) => {
        const angle = (index / segs) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * rimR, rimY, Math.sin(angle) * rimR);
      });
      const rimGeo = track(new THREE.BufferGeometry().setFromPoints(rimPoints));
      const rimMat = track(
        new THREE.LineBasicMaterial({
          color: 0xdaf8ff,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        })
      );
      const rimHighlight = new THREE.LineLoop(rimGeo, rimMat);
      rimHighlight.renderOrder = 5;
      cocktailRoot.add(rimHighlight);

      const streakMat = track(
        new THREE.MeshBasicMaterial({
          color: 0xe2f9ff,
          transparent: true,
          opacity: 0.13,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const streakHeight = rimY - spec.cavityBottomY;
      [
        {
          angle: 0.48,
          width: 0.042,
          height: streakHeight * 0.82,
          y: spec.cavityBottomY + streakHeight * 0.48,
        },
        {
          angle: -0.92,
          width: 0.026,
          height: streakHeight * 0.56,
          y: spec.cavityBottomY + streakHeight * 0.4,
        },
      ].forEach(({ angle, width: streakW, height: streakH, y }) => {
        const streak = new THREE.Mesh(track(new THREE.PlaneGeometry(streakW, streakH)), streakMat);
        streak.position.set(Math.sin(angle) * rimR * 0.96, y, Math.cos(angle) * rimR * 0.96);
        streak.rotation.y = angle;
        streak.renderOrder = 5;
        cocktailRoot.add(streak);
      });

      // 5. Classic Retro Garnishes
      if (preset.garnishes.includes('straw')) {
        strawPivot = new THREE.Group();
        const strawMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.straw,
            flatShading: true,
            shininess: 28,
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

      if (preset.garnishes.includes('umbrella')) {
        umbrellaPivot = new THREE.Group();
        umbrellaPivot.position.set(rimR * 0.24, rimY - 0.14, -0.08);
        umbrellaPivot.rotation.z = -0.36;
        umbrellaPivot.rotation.x = 0.1;

        const pickMat = track(
          new THREE.MeshPhongMaterial({ color: 0xedd090, flatShading: true })
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
            shininess: 22,
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

      if (preset.garnishes.includes('pineapple')) {
        const pineGeo = track(
          new THREE.CylinderGeometry(0.36, 0.36, 0.11, 5, 1, false, 0, Math.PI * 0.65)
        );
        const pineMat = track(
          new THREE.MeshPhongMaterial({
            map: textures.pineapple,
            color: 0xffdc55,
            emissive: 0x3b2806,
            flatShading: true,
            shininess: 32,
          })
        );
        const pine = new THREE.Mesh(pineGeo, pineMat);
        pine.position.set(rimR * 0.88, rimY + 0.03, 0.24);
        pine.rotation.set(Math.PI * 0.48, 0.4, -0.55);
        cocktailRoot.add(pine);
      }

      if (preset.garnishes.includes('mint-lime')) {
        const limeWheel = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.26, 0.26, 0.055, 8)),
          track(
            new THREE.MeshPhongMaterial({
              map: textures.lime,
              alphaTest: 0.42,
              emissive: 0x132b08,
              flatShading: true,
              shininess: 28,
            })
          )
        );
        limeWheel.position.set(-rimR * 0.86, rimY + 0.02, 0.28);
        limeWheel.rotation.set(Math.PI * 0.46, -0.35, 0.45);
        cocktailRoot.add(limeWheel);
      }

      if (preset.garnishes.includes('cherry')) {
        const cherryGroup = new THREE.Group();
        const cherryMat = track(
          new THREE.MeshPhongMaterial({
            color: 0xe61932,
            envMap: curEnvMap,
            reflectivity: 0.38,
            combine: THREE.MixOperation,
            specular: 0xffe0e6,
            shininess: 120,
            flatShading: true,
          })
        );
        activeEnvMaterials.push(cherryMat);
        const berry = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.115, 0)), cherryMat);
        const stem = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.011, 0.014, 0.3, 5)),
          track(new THREE.MeshPhongMaterial({ color: 0x458e2b, flatShading: true }))
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
      const cLm = counterLightMaps[mood];
      const pLm = propLightMaps[mood];
      const env = studioEnvMaps[mood];

      counterTopMat.lightMap = cLm;
      rattanMatMaterial.lightMap = cLm;
      counterApronMat.lightMap = pLm;
      bambooMat.lightMap = pLm;
      coasterMat.lightMap = pLm;
      totemSideMat.lightMap = pLm;
      totemFrontMat.lightMap = pLm;
      bowlMat.lightMap = pLm;
      bowlIceMat.envMap = env;
      activeEnvMaterials.forEach((m) => {
        m.envMap = env;
        m.needsUpdate = true;
      });
      [
        counterTopMat,
        rattanMatMaterial,
        counterApronMat,
        bambooMat,
        coasterMat,
        totemSideMat,
        totemFrontMat,
        bowlMat,
        bowlIceMat,
      ].forEach((m) => {
        m.needsUpdate = true;
      });

      if (mood === 'noon') {
        skyCylMat.map = textures.skyNoon;
        skyCylMat.color.setHex(0xffffff);
        scene.background = new THREE.Color(0x4eb8f0);
        scene.fog = new THREE.Fog(0x9be2fa, 18, 46);
        hemiLight.color.setHex(0xd9f5ff);
        hemiLight.groundColor.setHex(0xa86f3e);
        hemiLight.intensity = 1.55;
        sunLight.color.setHex(0xfff6dc);
        sunLight.intensity = 1.95;
        sunLight.position.set(4.6, 7.6, 4.2);
        oceanBounceLight.color.setHex(0x68eeff);
        oceanBounceLight.intensity = 1.05;
        counterUpFill.color.setHex(0xffcb8c);
        counterUpFill.intensity = 1.35;
        causticPlane.position.set(-0.46, 0.06, -0.22);
        causticPlane.rotation.z = 0.42;
        causticMat.opacity = 0.78;
        oceanMat.color.setHex(0x3ce4fa);
        oceanMat.specular.setHex(0xe6feff);
        oceanMat.emissive.setHex(0x092c38);
        oceanMat.emissiveIntensity = 0.45;
        sandMat.color.setHex(0xfff5dc);
        foamMat.color.setHex(0xf4feff);
      } else if (mood === 'sunset') {
        skyCylMat.map = textures.skySunset;
        skyCylMat.color.setHex(0xffe6d8);
        scene.background = new THREE.Color(0xcc6b52);
        scene.fog = new THREE.Fog(0xd88c72, 18, 46);
        hemiLight.color.setHex(0xffbe94);
        hemiLight.groundColor.setHex(0x7a4220);
        hemiLight.intensity = 1.35;
        sunLight.color.setHex(0xffa458);
        sunLight.intensity = 1.82;
        sunLight.position.set(-5.2, 3.6, 3.0);
        oceanBounceLight.color.setHex(0xff8e68);
        oceanBounceLight.intensity = 0.95;
        counterUpFill.color.setHex(0xffa85e);
        counterUpFill.intensity = 1.45;
        causticPlane.position.set(0.54, 0.06, -0.18);
        causticPlane.rotation.z = -0.35;
        causticMat.opacity = 0.82;
        oceanMat.color.setHex(0x6eb8cc);
        oceanMat.specular.setHex(0xffcf87);
        oceanMat.emissive.setHex(0x3c798c);
        oceanMat.emissiveIntensity = 0.95;
        sandMat.color.setHex(0xffd4a8);
        foamMat.color.setHex(0xffe9d4);
      } else {
        skyCylMat.map = textures.skySunset;
        skyCylMat.color.setHex(0x5a7bc2);
        scene.background = new THREE.Color(0x1e305a);
        scene.fog = new THREE.Fog(0x364f78, 15, 44);
        hemiLight.color.setHex(0x88abef);
        hemiLight.groundColor.setHex(0x693e22);
        hemiLight.intensity = 1.18;
        sunLight.color.setHex(0xb4d2ff);
        sunLight.intensity = 1.15;
        sunLight.position.set(2.8, 5.4, 2.8);
        oceanBounceLight.color.setHex(0x5aa4ea);
        oceanBounceLight.intensity = 0.88;
        counterUpFill.color.setHex(0xffae58);
        counterUpFill.intensity = 2.15;
        causticPlane.position.set(-0.26, 0.06, 0.22);
        causticPlane.rotation.z = 0.95;
        causticMat.opacity = 0.74;
        oceanMat.color.setHex(0x5c9dc2);
        oceanMat.specular.setHex(0xffc782);
        oceanMat.emissive.setHex(0x285678);
        oceanMat.emissiveIntensity = 1.05;
        sandMat.color.setHex(0xb29a8c);
        foamMat.color.setHex(0xc4e6ff);
      }

      sandMat.map = mood === 'noon' ? textures.sand : textures.wetSand;
      sandMat.needsUpdate = true;
      beachFireLight.intensity = mood === 'torch' ? 1.85 : mood === 'sunset' ? 0.85 : 0.24;
      postMat.uniforms.uBloomStrength.value = mood === 'torch' ? 0.28 : mood === 'sunset' ? 0.22 : 0.12;
      skyCylMat.needsUpdate = true;
    };

    sceneHandlesRef.current = {
      rebuildDrink,
      updateBeachLighting,
    };

    rebuildDrink();
    updateBeachLighting(simRef.current.beachTime);

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
      } else {
        simRef.current.stirEnergy = 1.0;
        audioRef.current?.playIceClink(2);
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
      const nextH = Math.max(240, Math.min(448, Math.round((ps1ResW * h) / w)));
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

      const causticPulse =
        (0.94 + Math.sin(elapsed * 2.4 + sim.stirPhase) * 0.06) * (0.45 + 0.55 * lvl);
      causticPlane.scale.set(causticPulse, causticPulse, 1);

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

      // Dynamic Angular Faceted PS1/PS2 Ocean Wave Swells
      for (let i = 0; i < oceanPos.count; i++) {
        const vx = oceanPos.getX(i);
        const vz = oceanPos.getZ(i);
        const waveA = Math.sin(vx * 0.38 + vz * 0.46 + elapsed * 2.0) * 0.34;
        const waveB = Math.cos(vx * 0.62 - vz * 0.36 - elapsed * 1.5) * 0.22;
        const ridge = (1.0 - Math.abs(Math.sin(vz * 0.56 + elapsed * 1.4 + vx * 0.16))) * 0.28;
        oceanPos.setY(i, oceanBaseY[i] + waveA + waveB + ridge);
      }
      oceanPos.needsUpdate = true;
      oceanGeo.computeVertexNormals();
      textures.ocean.offset.x = (elapsed * 0.038) % 1;
      textures.ocean.offset.y = (elapsed * 0.062) % 1;

      // Twinkling Ocean Sun / Moon Reflection Glints Riding the Wave Surface
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

      for (let i = 0; i < foamPos.count; i++) {
        const fx = foamPos.getX(i);
        const wash = Math.sin(elapsed * 1.55 + fx * 0.32) * 0.42;
        foamPos.setZ(i, foamBaseZ[i] + wash);
      }
      foamPos.needsUpdate = true;

      const pLeftCrown = palmLeft.userData.crown as THREE.Group | undefined;
      const pRightCrown = palmRight.userData.crown as THREE.Group | undefined;
      if (pLeftCrown) pLeftCrown.rotation.z = Math.sin(elapsed * 1.2) * 0.06;
      if (pRightCrown) pRightCrown.rotation.z = Math.cos(elapsed * 1.15) * 0.06;
      animatedModelPalms.forEach((palm, index) => {
        palm.rotation.z = Math.sin(elapsed * 0.85 + index * 1.7) * 0.025;
      });

      const torchScale = sim.beachTime === 'torch' ? 0.94 : sim.beachTime === 'sunset' ? 0.86 : 0.72;
      leftTorch.update(elapsed, torchScale);
      rightTorch.update(elapsed, torchScale);

      const flickA = Math.sin(elapsed * 11) * 0.16 + Math.cos(elapsed * 17) * 0.08;
      const flickB = Math.cos(elapsed * 10) * 0.16 + Math.sin(elapsed * 18) * 0.08;
      const baseTorchI = sim.beachTime === 'torch' ? 3.3 : sim.beachTime === 'sunset' ? 1.5 : 0.65;
      leftTorchLight.intensity = baseTorchI + flickA * baseTorchI * 0.35;
      rightTorchLight.intensity = baseTorchI + flickB * baseTorchI * 0.35;
      const beachFireBase = sim.beachTime === 'torch' ? 2.15 : sim.beachTime === 'sunset' ? 0.95 : 0.28;
      beachFireLight.intensity = beachFireBase * (0.92 + flickA * 0.18);
      const fireGlowBaseOpacity = sim.beachTime === 'torch' ? 0.82 : sim.beachTime === 'sunset' ? 0.58 : 0.24;
      beachFireGlowMat.opacity = fireGlowBaseOpacity + Math.max(0, flickA) * 0.14;
      beachFireGlow.scale.set(0.82 + flickB * 0.12, 1.02 + flickA * 0.18, 1);

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
      beachFireGlowMat.dispose();
      Object.values(counterLightMaps).forEach((t) => t.dispose());
      Object.values(propLightMaps).forEach((t) => t.dispose());
      Object.values(studioEnvMaps).forEach((t) => t.dispose());
      causticTex.dispose();
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
    setStatusMessage(preset.nameZh);
  };

  const handleSip = () => {
    if (liquidLevel <= 0.05) {
      audioRef.current?.playSip(true);
      setStatusMessage('已空杯');
      return;
    }
    const next = sipLiquidLevel(liquidLevel, 0.2);
    setLiquidLevel(next);
    simRef.current.stirEnergy = 0.4;
    audioRef.current?.playSip(next <= 0.1);
    setStatusMessage(next <= 0.1 ? '已空杯' : activePreset.nameZh);
  };

  const handleRefill = () => {
    setLiquidLevel(0.9);
    simRef.current.stirEnergy = 0.85;
    audioRef.current?.playPour();
    audioRef.current?.playIceClink(2);
    setStatusMessage(activePreset.nameZh);
  };

  const handleFlickUmbrella = () => {
    simRef.current.umbrellaSpinVel = 14.0;
    simRef.current.umbrellaTilt = 0.22;
    audioRef.current?.playUmbrellaFlick();
  };

  const moodLabel = beachTime === 'noon' ? '正午' : beachTime === 'sunset' ? '落日' : '夜火把';

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
                    {m === 'noon' ? '正午' : m === 'sunset' ? '落日' : '夜火把'}
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
                <span>音效</span>
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

      {/* Main 1999 CG / PS2 Telephoto 3D Viewport */}
      <div className="flex-1 min-h-0 p-1 flex flex-col">
        <div
          ref={canvasMountRef}
          data-testid="royal-hawaii-canvas"
          className="flex-1 min-h-[210px] win2k-sunken bg-[#10263A] relative overflow-hidden cursor-pointer"
        />
      </div>

      {/* Streamlined Single-Row Bar Control Strip */}
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
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center w-[88px] shrink-0 truncate">
          液位 {Math.round(liquidLevel * 100)}%
        </div>
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center w-[72px] shrink-0 truncate">
          {moodLabel}
        </div>
      </div>

      {showAbout && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/25"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="win2k-window bg-[#D4D0C8] w-[260px] p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="win2k-titlebar-active h-[20px] px-1.5 flex items-center justify-between text-white font-bold">
              <span>关于 Royal Hawaii</span>
              <button
                type="button"
                className="win2k-raised bg-[#D4D0C8] text-black w-[15px] h-[14px] flex items-center justify-center text-[10px]"
                onClick={() => setShowAbout(false)}
              >
                ×
              </button>
            </div>
            <div className="p-3 flex gap-3 items-center">
              <Win2kIcon kind="royal-hawaii" size={32} />
              <div className="space-y-1">
                <div className="font-bold">Royal Hawaii</div>
                <div className="text-[#404040]">版本 1.0</div>
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
