import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// =========================================================
//  === CONFIGURATION & STATE ===
// =========================================================

const STATE = {
    mode: 0, // 0: None, 1-5: Modes
    width: window.innerWidth,
    height: window.innerHeight,
    // Z-Positions will be dynamic based on mode, but defaults:
    bgZ: -10
};

// =========================================================
//  === SCENE SETUP ===
// =========================================================

const bgCanvas = document.getElementById('bg_canvas');
const statusText = document.getElementById('status');
const videoElement = document.querySelector('.input_video');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, STATE.width / STATE.height, 0.1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: true, alpha: false });
renderer.setSize(STATE.width, STATE.height);
renderer.setPixelRatio(window.devicePixelRatio);

// --- Post Processing ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(STATE.width, STATE.height), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 2.0;
bloomPass.radius = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// =========================================================
//  === ASSETS & OBJECTS ===
// =========================================================

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// 1. Textured Background
const bgGeometry = new THREE.PlaneGeometry(1, 1, 128, 128);
const bgDiffuse = textureLoader.load('./bg_diffuse.png');
const bgDisplacement = textureLoader.load('./bg_displacement.png');
const bgMaterial = new THREE.MeshStandardMaterial({
    map: bgDiffuse,
    displacementMap: bgDisplacement,
    displacementScale: 2.0,
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.1
});
const bgPlane = new THREE.Mesh(bgGeometry, bgMaterial);
bgPlane.position.z = STATE.bgZ;
scene.add(bgPlane);

// 2. Light Catcher Background (Glossy Black)
const lightCatcherMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.1,
    metalness: 0.5
});
const lightCatcherPlane = new THREE.Mesh(bgGeometry, lightCatcherMaterial);
lightCatcherPlane.position.z = STATE.bgZ;
lightCatcherPlane.visible = false;
scene.add(lightCatcherPlane);

// 3. User Plane (Shader Material)
const userVideoCanvas = document.createElement('canvas');
userVideoCanvas.width = 1280;
userVideoCanvas.height = 720;
const userVideoCtx = userVideoCanvas.getContext('2d');
const userVideoTexture = new THREE.CanvasTexture(userVideoCanvas);
userVideoTexture.minFilter = THREE.LinearFilter;
userVideoTexture.magFilter = THREE.LinearFilter;

const userMaskCanvas = document.createElement('canvas');
userMaskCanvas.width = 1280;
userMaskCanvas.height = 720;
const userMaskCtx = userMaskCanvas.getContext('2d');
const userMaskTexture = new THREE.CanvasTexture(userMaskCanvas);
userMaskTexture.minFilter = THREE.LinearFilter;
userMaskTexture.magFilter = THREE.LinearFilter;

const userShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        map: { value: userVideoTexture },
        maskMap: { value: userMaskTexture }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D map;
        uniform sampler2D maskMap;
        varying vec2 vUv;
        void main() {
            vec4 color = texture2D(map, vUv);
            vec4 mask = texture2D(maskMap, vUv);
            // Use red channel of mask as alpha (assuming grayscale mask)
            gl_FragColor = vec4(color.rgb, mask.r);
        }
    `,
    transparent: true,
    side: THREE.DoubleSide
});

const userGeometry = new THREE.PlaneGeometry(1, 1);
const userPlane = new THREE.Mesh(userGeometry, userShaderMaterial);
userPlane.position.z = 0; // Default
scene.add(userPlane);

// 4. Neon Sign (model.gltf)
let neonModel = null;
let neonLight = null;
const neonMaterial = new THREE.MeshBasicMaterial({ color: 0xEB292D, wireframe: false });

loader.load('./model.gltf', (gltf) => {
    neonModel = gltf.scene;
    neonModel.traverse((child) => {
        if (child.isMesh) child.material = neonMaterial;
    });

    neonLight = new THREE.PointLight(0xEB292D, 2, 20);
    neonLight.position.set(0, 5, 0);
    neonModel.add(neonLight);

    neonModel.position.z = -5;
    scene.add(neonModel);
    fitObjectToScreen(neonModel, -5, 0.9);
}, undefined, (err) => console.error(err));

// 5. 3D Model (model.glb)
let mainModel = null;
loader.load('./model.glb', (gltf) => {
    mainModel = gltf.scene;
    mainModel.position.z = -3;
    mainModel.visible = false;
    scene.add(mainModel);
    fitObjectToScreen(mainModel, -3, 0.5);
}, undefined, (err) => console.error(err));


// =========================================================
//  === HELPERS ===
// =========================================================

function getVisiblePlaneSizeAtZ(z) {
    const distance = camera.position.z - z;
    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(vFOV / 2) * distance;
    const width = height * camera.aspect;
    return { width, height };
}

function fitPlanesToScreen() {
    // Fit BG Plane
    const bgSize = getVisiblePlaneSizeAtZ(STATE.bgZ);
    bgPlane.scale.set(bgSize.width, bgSize.height, 1);
    lightCatcherPlane.scale.set(bgSize.width, bgSize.height, 1);

    // Fit User Plane (Dynamic Z)
    const userSize = getVisiblePlaneSizeAtZ(userPlane.position.z);
    userPlane.scale.set(userSize.width, userSize.height, 1);
}

function fitObjectToScreen(object, z, widthPct) {
    if (!object) return;
    const originalScale = object.scale.clone();
    object.scale.set(1, 1, 1);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    object.scale.copy(originalScale);
    const visibleSize = getVisiblePlaneSizeAtZ(z);
    const scaleFactor = (visibleSize.width / size.x) * widthPct;
    object.scale.set(scaleFactor, scaleFactor, scaleFactor);
}

// =========================================================
//  === MODES ===
// =========================================================

function setMode(modeIndex) {
    STATE.mode = modeIndex;
    console.log("Switching to Mode:", modeIndex);

    // Reset Visibility
    if (bgPlane) bgPlane.visible = false;
    if (lightCatcherPlane) lightCatcherPlane.visible = false;
    if (neonModel) neonModel.visible = false;
    if (mainModel) mainModel.visible = false;
    if (userPlane) userPlane.visible = true;

    // Default Zs
    userPlane.position.z = 0;

    switch (modeIndex) {
        case 1: // TEXTURED BG AND NEON
            // BG -> Neon(-5) -> User(0)
            if (bgPlane) bgPlane.visible = true;
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = -5;
            }
            userPlane.position.z = 0;
            break;

        case 2: // ONLY NEON
            // Light Catcher -> User(-5) -> Neon(0)
            if (lightCatcherPlane) lightCatcherPlane.visible = true;
            userPlane.position.z = -5;
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = 0;
            }
            break;

        case 3: // NEON AND 3D MODEL
            // Neon(-5) -> User(0) -> 3D Model(+5)
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = -5;
            }
            userPlane.position.z = 0;
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = 5;
            }
            break;

        case 4: // ONLY 3D MODEL
            // Light Catcher -> 3D Model(-5) -> User(0)
            if (lightCatcherPlane) lightCatcherPlane.visible = true;
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = -5;
            }
            userPlane.position.z = 0;
            break;

        case 5: // 3D MODEL AND TEXTURED BG
            // BG -> 3D Model(-5) -> User(0)
            if (bgPlane) bgPlane.visible = true;
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = -5;
            }
            userPlane.position.z = 0;
            break;
    }

    // Re-fit planes and objects after Z change
    fitPlanesToScreen();
    if (neonModel) fitObjectToScreen(neonModel, neonModel.position.z, 0.9);
    if (mainModel) fitObjectToScreen(mainModel, mainModel.position.z, 0.5);
}

// =========================================================
//  === MEDIAPIPE LOGIC ===
// =========================================================

const smoothCanvas = document.createElement('canvas');
const smoothCtx = smoothCanvas.getContext('2d');
let isFirstFrame = true;
const MASK_SMOOTHING_ALPHA = 0.35;
const MASK_BLUR_PX = 3;

function onResults(results) {
    // Update canvas sizes
    if (userVideoCanvas.width !== results.image.width || userVideoCanvas.height !== results.image.height) {
        userVideoCanvas.width = results.image.width;
        userVideoCanvas.height = results.image.height;
        userMaskCanvas.width = results.image.width;
        userMaskCanvas.height = results.image.height;
        smoothCanvas.width = results.image.width;
        smoothCanvas.height = results.image.height;
        isFirstFrame = true;
    }

    // 1. Process Mask (Smoothing)
    if (isFirstFrame) {
        smoothCtx.drawImage(results.segmentationMask, 0, 0, smoothCanvas.width, smoothCanvas.height);
        isFirstFrame = false;
    } else {
        smoothCtx.globalCompositeOperation = 'source-over';
        smoothCtx.globalAlpha = MASK_SMOOTHING_ALPHA;
        smoothCtx.drawImage(results.segmentationMask, 0, 0, smoothCanvas.width, smoothCanvas.height);
        smoothCtx.globalAlpha = 1.0;
    }

    // 2. Draw Video to Texture Canvas (Mirrored)
    userVideoCtx.save();
    userVideoCtx.clearRect(0, 0, userVideoCanvas.width, userVideoCanvas.height);
    userVideoCtx.translate(userVideoCanvas.width, 0);
    userVideoCtx.scale(-1, 1);
    userVideoCtx.drawImage(results.image, 0, 0, userVideoCanvas.width, userVideoCanvas.height);
    userVideoCtx.restore();

    // 3. Draw Mask to Texture Canvas (Mirrored + Blur)
    userMaskCtx.save();
    userMaskCtx.clearRect(0, 0, userMaskCanvas.width, userMaskCanvas.height);
    userMaskCtx.translate(userMaskCanvas.width, 0);
    userMaskCtx.scale(-1, 1);
    userMaskCtx.filter = `blur(${MASK_BLUR_PX}px)`;
    userMaskCtx.drawImage(smoothCanvas, 0, 0, userMaskCanvas.width, userMaskCanvas.height);
    userMaskCtx.filter = 'none';
    userMaskCtx.restore();

    // 4. Update Textures
    if (userVideoTexture) userVideoTexture.needsUpdate = true;
    if (userMaskTexture) userMaskTexture.needsUpdate = true;

    if (statusText.innerText !== "System Active" && statusText.innerText !== "Tracking Active") {
        statusText.innerText = "Tracking Active";
    }
}

const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
});
selfieSegmentation.setOptions({ modelSelection: 1, selfieMode: false });
selfieSegmentation.onResults(onResults);

const mpCamera = new Camera(videoElement, {
    onFrame: async () => { await selfieSegmentation.send({ image: videoElement }); },
    width: 1280,
    height: 720
});
mpCamera.start();


// =========================================================
//  === ANIMATION LOOP ===
// =========================================================

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // Neon Flicker
    const flicker = Math.random() > 0.9 ? Math.random() * 0.5 : 0;
    const pulse = Math.sin(time * 2) * 0.1;

    bloomPass.strength = 2.0 + pulse + flicker;
    if (neonLight) neonLight.intensity = 2.0 + (pulse * 2) + (flicker * 3);

    // Model Animation
    if (mainModel && mainModel.visible) {
        mainModel.rotation.y = time * 0.5;
        mainModel.position.y = Math.sin(time) * 0.5;
    }

    composer.render();
}
animate();

// =========================================================
//  === EVENTS ===
// =========================================================

window.addEventListener('resize', () => {
    STATE.width = window.innerWidth;
    STATE.height = window.innerHeight;

    camera.aspect = STATE.width / STATE.height;
    camera.updateProjectionMatrix();

    renderer.setSize(STATE.width, STATE.height);
    composer.setSize(STATE.width, STATE.height);
    bloomPass.resolution.set(STATE.width, STATE.height);

    fitPlanesToScreen();
    // Re-fit models if needed
    if (neonModel) fitObjectToScreen(neonModel, neonModel.position.z, 0.9);
    if (mainModel) fitObjectToScreen(mainModel, mainModel.position.z, 0.5);
});

// Initial Fit
fitPlanesToScreen();

// UI Events
document.querySelectorAll('.mode-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
        const mode = index + 1;
        setMode(mode);
        document.getElementById('menu-overlay').classList.add('hidden');
        document.body.classList.add('menu-active');
    });
});

document.getElementById('back-to-menu').addEventListener('click', () => {
    document.getElementById('menu-overlay').classList.remove('hidden');
    document.body.classList.remove('menu-active');
});
