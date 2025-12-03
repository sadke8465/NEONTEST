import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
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

const camera = new THREE.PerspectiveCamera(45, STATE.width / STATE.height, 0.1, 1000);
camera.position.set(0, 0, 15); // Move camera further back to see more
console.log('Camera initialized at position:', camera.position.z);

const renderer = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: true, alpha: false });
renderer.setSize(STATE.width, STATE.height);
renderer.setPixelRatio(window.devicePixelRatio);

// --- Post Processing ---
// --- Post Processing (Selective Bloom) ---
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(STATE.width, STATE.height), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 1.5; // Restore strength for neon
bloomPass.radius = 0.5;

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

const mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
        uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: bloomComposer.renderTarget2.texture }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform sampler2D baseTexture;
            uniform sampler2D bloomTexture;
            varying vec2 vUv;
            void main() {
                gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
            }
        `,
        defines: {}
    }), "baseTexture"
);
mixPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(renderScene);
finalComposer.addPass(mixPass);
const outputPass = new OutputPass();
finalComposer.addPass(outputPass);

// Selective Bloom Helpers
const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
const materials = {};

function darkenNonBloomed(obj) {
    if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
        materials[obj.uuid] = obj.material;
        obj.material = darkMaterial;
    }
}

function restoreMaterial(obj) {
    if (materials[obj.uuid]) {
        obj.material = materials[obj.uuid];
        delete materials[obj.uuid];
    }
}

const bloomLayer = new THREE.Layers();
bloomLayer.set(1); // Layer 1 is for blooming objects

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
let userVideoTexture = new THREE.CanvasTexture(userVideoCanvas);
userVideoTexture.minFilter = THREE.LinearFilter;
userVideoTexture.magFilter = THREE.LinearFilter;

const userMaskCanvas = document.createElement('canvas');
userMaskCanvas.width = 1280;
userMaskCanvas.height = 720;
const userMaskCtx = userMaskCanvas.getContext('2d');
let userMaskTexture = new THREE.CanvasTexture(userMaskCanvas);
userMaskTexture.minFilter = THREE.LinearFilter;
userMaskTexture.magFilter = THREE.LinearFilter;

const DEBUG_MODE = false; // Set to true to see raw video without masking
const TEST_MODE = false; // Set to true to show solid color (ignores textures entirely)

console.log('=== SHADER MODES ===');
console.log('DEBUG_MODE:', DEBUG_MODE);
console.log('TEST_MODE:', TEST_MODE);
console.log('Version: 2024-12-03-23:34');

const userShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        map: { value: userVideoTexture },
        maskMap: { value: userMaskTexture },
        debugMode: { value: DEBUG_MODE },
        testMode: { value: TEST_MODE }
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
        uniform bool debugMode;
        uniform bool testMode;
        varying vec2 vUv;
        void main() {
            if (testMode) {
                // TEST MODE: Show solid bright green to verify plane is rendering
                gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
                return;
            }
            
            vec4 color = texture2D(map, vUv);
            
            if (debugMode) {
                // Debug: bright magenta background to verify plane is rendering
                // If texture is black/empty, you'll see magenta
                // If texture is working, you'll see the video
                vec3 debugColor = color.rgb;
                if (length(color.rgb) < 0.1) {
                    debugColor = vec3(1.0, 0.0, 1.0); // Magenta if texture is black
                }
                gl_FragColor = vec4(debugColor, 1.0); // Full opacity in debug
            } else {
                vec4 mask = texture2D(maskMap, vUv);
                // Use red channel of mask as alpha (assuming grayscale mask)
                gl_FragColor = vec4(color.rgb, mask.r);
            }
        }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false
});

const userGeometry = new THREE.PlaneGeometry(1, 1);
const userPlane = new THREE.Mesh(userGeometry, userShaderMaterial);
userPlane.position.z = 0; // Default
userPlane.renderOrder = 1; // Ensure it sorts correctly with transparency
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

    // Enable bloom for Neon
    neonModel.traverse((child) => {
        child.layers.enable(1);
    });

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
    if (bgPlane) {
        const bgSize = getVisiblePlaneSizeAtZ(STATE.bgZ);
        bgPlane.scale.set(bgSize.width, bgSize.height, 1);
    }
    if (lightCatcherPlane) {
        const lcSize = getVisiblePlaneSizeAtZ(STATE.bgZ);
        lightCatcherPlane.scale.set(lcSize.width, lcSize.height, 1);
    }

    // Fit User Plane (Dynamic Z)
    if (userPlane) {
        const userSize = getVisiblePlaneSizeAtZ(userPlane.position.z);
        // Prevent zero scale
        const safeWidth = Math.max(userSize.width, 0.1);
        const safeHeight = Math.max(userSize.height, 0.1);
        userPlane.scale.set(safeWidth, safeHeight, 1);
    }
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

    // 1. Reset Visibility & Defaults
    if (bgPlane) bgPlane.visible = false;
    if (lightCatcherPlane) lightCatcherPlane.visible = false;
    if (neonModel) neonModel.visible = false;
    if (mainModel) mainModel.visible = false;

    // User plane always visible by default, unless specific mode hides it (none do)
    if (userPlane) {
        userPlane.visible = true;
        userPlane.renderOrder = 1; // Standard
    }

    // 2. Apply Mode Logic
    switch (modeIndex) {
        case 1: // TEXTURED BG AND NEON
            // Deepest → Textured BG plane (visible)
            // Middle → Neon sign (behind user)
            // Nearest → User plane (visible)
            if (bgPlane) {
                bgPlane.visible = true;
                bgPlane.position.z = STATE.bgZ; // -10
            }
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = -5;
            }
            if (userPlane) {
                userPlane.position.z = 0;
            }
            break;

        case 2: // ONLY NEON
            // Deepest → Transparent light catcher (visible)
            // Middle → User plane (behind neon sign)
            // Nearest → Neon sign (visible)
            if (lightCatcherPlane) {
                lightCatcherPlane.visible = true;
                lightCatcherPlane.position.z = STATE.bgZ; // -10
            }
            if (userPlane) {
                userPlane.position.z = -5;
            }
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = 0;
            }
            break;

        case 3: // NEON AND 3D MODEL
            // Deepest → Neon sign (behind user)
            // Middle → User plane (visible)
            // Nearest → 3D model (visible, rotating in front of user)
            if (neonModel) {
                neonModel.visible = true;
                neonModel.position.z = -5;
            }
            if (userPlane) {
                userPlane.position.z = 0;
            }
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = 5; // Closer to camera (10)
            }
            break;

        case 4: // ONLY 3D MODEL
            // Deepest → Transparent light catcher
            // Middle → 3D model (rotating behind user)
            // Nearest → User plane
            if (lightCatcherPlane) {
                lightCatcherPlane.visible = true;
                lightCatcherPlane.position.z = STATE.bgZ;
            }
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = -5;
            }
            if (userPlane) {
                userPlane.position.z = 0;
            }
            break;

        case 5: // 3D MODEL AND TEXTURED BG
            // Deepest → Textured BG
            // Middle → 3D model (behind user)
            // Nearest → User plane
            if (bgPlane) {
                bgPlane.visible = true;
                bgPlane.position.z = STATE.bgZ;
            }
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.z = -5;
            }
            if (userPlane) {
                userPlane.position.z = 0;
            }
            break;
    }

    // 3. Re-fit planes and objects
    fitPlanesToScreen();

    // Fit objects if they are visible
    if (neonModel && neonModel.visible) {
        fitObjectToScreen(neonModel, neonModel.position.z, 0.9);
    }
    if (mainModel && mainModel.visible) {
        fitObjectToScreen(mainModel, mainModel.position.z, 0.5);
    }
}

// =========================================================
//  === MEDIAPIPE LOGIC ===
// =========================================================

// Removed smoothCanvas and tempMaskCanvas to prevent ghosting
// We will draw directly to the textures

let isFirstFrame = true;

function onResults(results) {
    // Update canvas sizes on first frame or when dimensions change
    // Update canvas sizes on first frame or when dimensions change
    if (userVideoCanvas.width !== results.image.width || userVideoCanvas.height !== results.image.height) {
        console.log('Resizing canvas dimensions to:', results.image.width, 'x', results.image.height);

        userVideoCanvas.width = results.image.width;
        userVideoCanvas.height = results.image.height;
        userMaskCanvas.width = results.image.width;
        userMaskCanvas.height = results.image.height;
        // smoothCanvas/tempMaskCanvas removed

        // Recreate textures to match new dimensions
        if (userVideoTexture) userVideoTexture.dispose();
        if (userMaskTexture) userMaskTexture.dispose();

        userVideoTexture = new THREE.CanvasTexture(userVideoCanvas);
        userVideoTexture.minFilter = THREE.LinearFilter;
        userVideoTexture.magFilter = THREE.LinearFilter;

        userMaskTexture = new THREE.CanvasTexture(userMaskCanvas);
        userMaskTexture.minFilter = THREE.LinearFilter;
        userMaskTexture.magFilter = THREE.LinearFilter;

        // Update material uniforms
        if (userShaderMaterial) {
            userShaderMaterial.uniforms.map.value = userVideoTexture;
            userShaderMaterial.uniforms.maskMap.value = userMaskTexture;
            userShaderMaterial.needsUpdate = true;
        }

        isFirstFrame = true;
    }

    // 1. Draw Video to Texture Canvas (Mirrored)
    userVideoCtx.save();
    userVideoCtx.clearRect(0, 0, userVideoCanvas.width, userVideoCanvas.height);
    userVideoCtx.translate(userVideoCanvas.width, 0);
    userVideoCtx.scale(-1, 1);
    userVideoCtx.drawImage(results.image, 0, 0, userVideoCanvas.width, userVideoCanvas.height);
    userVideoCtx.restore();

    // 2. Draw Mask to Texture Canvas (Mirrored + Blur)
    // Direct draw, no smoothing
    userMaskCtx.save();
    userMaskCtx.clearRect(0, 0, userMaskCanvas.width, userMaskCanvas.height);
    userMaskCtx.translate(userMaskCanvas.width, 0);
    userMaskCtx.scale(-1, 1);
    // Optional: Keep a slight blur for edge softness, but no temporal smoothing
    userMaskCtx.filter = 'blur(2px)';
    userMaskCtx.drawImage(results.segmentationMask, 0, 0, userMaskCanvas.width, userMaskCanvas.height);
    userMaskCtx.filter = 'none';
    userMaskCtx.restore();

    // 4. Update Textures
    if (userVideoTexture) userVideoTexture.needsUpdate = true;
    if (userMaskTexture) userMaskTexture.needsUpdate = true;

    // Debug logging (remove after fixing)
    if (Math.random() < 0.02) { // Log occasionally to avoid spam
        console.log('MediaPipe frame received:', results.image.width, 'x', results.image.height);
        console.log('User plane visible:', userPlane.visible);
        console.log('User plane position:', userPlane.position.z);
        console.log('User plane scale:', userPlane.scale.x, userPlane.scale.y);
    }

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

    // Reduced base strength for bloom to prevent blowout
    bloomPass.strength = 0.8 + (pulse * 0.2) + (flicker * 0.2);
    if (neonLight) neonLight.intensity = 2.0 + (pulse * 2) + (flicker * 3);

    // Model Animation
    if (mainModel && mainModel.visible) {
        mainModel.rotation.y = time * 0.5;
        mainModel.position.y = Math.sin(time) * 0.5;
    }

    // Selective Bloom Rendering

    // 1. Render Bloom (Darken non-bloomed objects)
    scene.traverse(darkenNonBloomed);
    bloomComposer.render();
    scene.traverse(restoreMaterial);

    // 2. Render Final Scene (Mix bloom)
    finalComposer.render();
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
    bloomComposer.setSize(STATE.width, STATE.height);
    finalComposer.setSize(STATE.width, STATE.height);
    bloomPass.resolution.set(STATE.width, STATE.height);

    fitPlanesToScreen();
    // Re-fit models if needed
    if (neonModel) fitObjectToScreen(neonModel, neonModel.position.z, 0.9);
    if (mainModel) fitObjectToScreen(mainModel, mainModel.position.z, 0.5);
});

// Initial Fit
fitPlanesToScreen();

// Start in Mode 1 by default so user sees something immediately
setTimeout(() => {
    console.log('Auto-starting Mode 1');
    setMode(1);
}, 500);

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
