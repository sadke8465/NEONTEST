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
    userZ: 0,
    neonZ: -5,
    bgZ: -10,
    modelFrontZ: 3,
    modelBackZ: -3
};

// =========================================================
//  === SCENE SETUP ===
// =========================================================

const bgCanvas = document.getElementById('bg_canvas');
const statusText = document.getElementById('status');
const videoElement = document.createElement('video'); // Offscreen video
videoElement.autoplay = true;
videoElement.playsInline = true;

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
const bgGeometry = new THREE.PlaneGeometry(1, 1, 128, 128); // Size will be scaled
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

// 3. User Plane
// We will update this texture from the canvas that MediaPipe draws to
const userCanvas = document.createElement('canvas');
userCanvas.width = 1280;
userCanvas.height = 720;
const userCtx = userCanvas.getContext('2d');
const userTexture = new THREE.CanvasTexture(userCanvas);
userTexture.minFilter = THREE.LinearFilter;
userTexture.magFilter = THREE.LinearFilter;
userTexture.format = THREE.RGBAFormat;

const userMaterial = new THREE.MeshBasicMaterial({
    map: userTexture,
    transparent: true,
    side: THREE.DoubleSide
});
const userGeometry = new THREE.PlaneGeometry(1, 1);
const userPlane = new THREE.Mesh(userGeometry, userMaterial);
userPlane.position.z = STATE.userZ;
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
    
    // Attach Light
    neonLight = new THREE.PointLight(0xEB292D, 2, 20);
    neonLight.position.set(0, 5, 0);
    neonModel.add(neonLight);
    
    neonModel.position.z = STATE.neonZ;
    scene.add(neonModel);
    fitObjectToScreen(neonModel, STATE.neonZ, 0.9); // Initial fit
}, undefined, (err) => console.error(err));

// 5. 3D Model (model.glb)
let mainModel = null;
loader.load('./model.glb', (gltf) => {
    mainModel = gltf.scene;
    // Keep original materials for the 3D model
    mainModel.position.z = STATE.modelBackZ;
    mainModel.visible = false;
    scene.add(mainModel);
    fitObjectToScreen(mainModel, STATE.modelBackZ, 0.5); // Smaller scale
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

    // Fit User Plane
    const userSize = getVisiblePlaneSizeAtZ(STATE.userZ);
    userPlane.scale.set(userSize.width, userSize.height, 1);
}

function fitObjectToScreen(object, z, widthPct) {
    if (!object) return;
    
    // Reset transforms to measure
    const originalScale = object.scale.clone();
    object.scale.set(1, 1, 1);
    object.updateMatrixWorld(true);
    
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Restore scale
    object.scale.copy(originalScale);
    
    const visibleSize = getVisiblePlaneSizeAtZ(z);
    
    // Scale to match target width percentage
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
    if (userPlane) userPlane.visible = true; // User always visible

    switch (modeIndex) {
        case 1: // TEXTURED BG AND NEON
            if (bgPlane) bgPlane.visible = true;
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = STATE.neonZ; // Behind User
            }
            break;
        case 2: // ONLY NEON
            if (lightCatcherPlane) lightCatcherPlane.visible = true;
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = STATE.neonZ; // Behind User
            }
            break;
        case 3: // NEON AND 3D MODEL
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = STATE.neonZ; // Behind User
            }
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = STATE.modelFrontZ; // Front of User
            }
            break;
        case 4: // ONLY 3D MODEL
            if (lightCatcherPlane) lightCatcherPlane.visible = true;
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = STATE.modelBackZ; // Behind User
            }
            break;
        case 5: // 3D MODEL AND TEXTURED BG
            if (bgPlane) bgPlane.visible = true;
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = STATE.modelBackZ; // Behind User
            }
            break;
    }
}

// =========================================================
//  === MEDIAPIPE LOGIC ===
// =========================================================

// Offscreen smoothing canvas
const smoothCanvas = document.createElement('canvas');
const smoothCtx = smoothCanvas.getContext('2d');
let isFirstFrame = true;
const MASK_BLUR_PX = 3;
const MASK_SMOOTHING_ALPHA = 0.35;

function onResults(results) {
    // Update canvas sizes if needed
    if (userCanvas.width !== results.image.width || userCanvas.height !== results.image.height) {
        userCanvas.width = results.image.width;
        userCanvas.height = results.image.height;
        smoothCanvas.width = results.image.width;
        smoothCanvas.height = results.image.height;
        isFirstFrame = true;
    }

    // 1. Smoothing
    if (isFirstFrame) {
        smoothCtx.drawImage(results.segmentationMask, 0, 0, smoothCanvas.width, smoothCanvas.height);
        isFirstFrame = false;
    } else {
        smoothCtx.globalCompositeOperation = 'source-over';
        smoothCtx.globalAlpha = MASK_SMOOTHING_ALPHA;
        smoothCtx.drawImage(results.segmentationMask, 0, 0, smoothCanvas.width, smoothCanvas.height);
        smoothCtx.globalAlpha = 1.0;
    }

    // 2. Draw to User Canvas
    userCtx.save();
    userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);

    // Mirror
    userCtx.translate(userCanvas.width, 0);
    userCtx.scale(-1, 1);

    // Draw Mask
    userCtx.filter = `blur(${MASK_BLUR_PX}px)`;
    userCtx.drawImage(smoothCanvas, 0, 0, userCanvas.width, userCanvas.height);
    userCtx.filter = 'none';

    // Composite Video
    userCtx.globalCompositeOperation = 'source-in';
    userCtx.drawImage(results.image, 0, 0, userCanvas.width, userCanvas.height);

    userCtx.restore();

    // 3. Update Texture
    if (userTexture) userTexture.needsUpdate = true;
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
        mainModel.rotation.y = time * 0.5; // Rotate Y
        mainModel.position.y = Math.sin(time) * 0.5; // Float up/down
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
