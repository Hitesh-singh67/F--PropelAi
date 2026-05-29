// PROPELAI 3D ENGINE — HOLOGRAM VIEWPORT & BACKGROUND DATA FLOWS

let scene, camera, renderer, controls;
let buildingGroup, bgParticles;
const particleCount = 100;
let upwardParticlesGeometry, upwardParticlesMesh;
const upwardParticleCount = 40;

window.addEventListener('DOMContentLoaded', () => {
  init3D();
  animate();
});

function init3D() {
  const container = document.getElementById('hero-canvas-container');
  if (!container) return;

  // 1. SCENE & FOG
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.04);

  // 2. CAMERA
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0.8, 5.0);

  // 3. RENDERER
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 4. LIGHTS
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x22d3ee, 1.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  const blueLight = new THREE.PointLight(0x6366f1, 2, 10);
  blueLight.position.set(-2, 1, 2);
  scene.add(blueLight);

  // 5. BUILDING GROUP SETUP
  buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  // Create Hologram Building
  createHologramTower();

  // Create Upward Particle Stream
  createUpwardDataStreams();

  // Create Background Particle Drift
  createBackgroundParticles();

  // 6. ORBIT CONTROLS
  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.4, 0); // look at the middle of the skyscraper
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false; // keep layout focus
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 3; // restrict vertical orbit
    controls.maxPolarAngle = Math.PI / 1.8;
  }

  // 7. WINDOW RESIZE HANDLER
  window.addEventListener('resize', onWindowResize);
}

/* =========================================================================
   BUILD HOLOGRAPHIC SKYSCRAPER MODEL
   ========================================================================= */
function createHologramTower() {
  // Color Palettes
  const cyanColor = 0x22d3ee;
  const indigoColor = 0x6366f1;

  // Material settings
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: indigoColor,
    wireframe: true,
    transparent: true,
    opacity: 0.18
  });

  const solidGlassMaterial = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide
  });

  const glowingCoreMaterial = new THREE.MeshBasicMaterial({
    color: cyanColor,
    wireframe: true,
    transparent: true,
    opacity: 0.4
  });

  // A. Inner Core cylinder (glowing active reactor)
  const coreGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.5, 8);
  const coreMesh = new THREE.Mesh(coreGeo, glowingCoreMaterial);
  coreMesh.position.y = 0.55;
  buildingGroup.add(coreMesh);

  // B. Outer Segment Floor Slabs
  const slabLevels = 6;
  const heightSpacing = 0.4;
  for (let i = 0; i < slabLevels; i++) {
    const width = 0.9 - (i * 0.08); // tapering upwards
    const thickness = 0.04;
    const slabGeo = new THREE.BoxGeometry(width, thickness, width);
    const slabMesh = new THREE.Mesh(slabGeo, solidGlassMaterial);
    slabMesh.position.y = -0.5 + (i * heightSpacing);
    buildingGroup.add(slabMesh);

    // Add glowing cyan borders for slabs
    const edgeGeo = new THREE.EdgesGeometry(slabGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: cyanColor, transparent: true, opacity: 0.5 });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeLines.position.y = slabMesh.position.y;
    buildingGroup.add(edgeLines);
  }

  // C. Vertical Core Pillar Structure (tapered wireframe skeleton)
  const pGeometry = new THREE.CylinderGeometry(0.4, 0.85, 2.5, 4);
  const skeletonMesh = new THREE.Mesh(pGeometry, wireMaterial);
  skeletonMesh.position.y = 0.55;
  buildingGroup.add(skeletonMesh);

  // D. Levitating Tech Rings around building
  const torusMat1 = new THREE.MeshBasicMaterial({ color: cyanColor, wireframe: true, transparent: true, opacity: 0.6 });
  const torusMat2 = new THREE.MeshBasicMaterial({ color: indigoColor, wireframe: true, transparent: true, opacity: 0.6 });

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.02, 8, 36), torusMat1);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = -0.8;
  buildingGroup.add(ring1);
  buildingGroup.userData.ring1 = ring1; // store reference to spin separately

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.015, 6, 24), torusMat2);
  ring2.rotation.x = Math.PI / 2.2;
  ring2.position.y = 0.8;
  buildingGroup.add(ring2);
  buildingGroup.userData.ring2 = ring2;
}

/* =========================================================================
   3D EMITTING DATA SYSTEMS (UPWARD PARTICLES)
   ========================================================================= */
function createUpwardDataStreams() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(upwardParticleCount * 3);
  const speeds = [];

  for (let i = 0; i < upwardParticleCount; i++) {
    // Spread particles in a ring around the building core
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.2 + Math.random() * 0.4;
    positions[i * 3] = Math.cos(angle) * radius; // X
    positions[i * 3 + 1] = -0.8 + Math.random() * 2.5; // Y
    positions[i * 3 + 2] = Math.sin(angle) * radius; // Z

    speeds.push(0.01 + Math.random() * 0.015);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.userData = { speeds };

  const material = new THREE.PointsMaterial({
    color: 0x22d3ee,
    size: 0.05,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  upwardParticlesMesh = new THREE.Points(geometry, material);
  buildingGroup.add(upwardParticlesMesh);
  upwardParticlesGeometry = geometry;
}

/* =========================================================================
   3D BACKGROUND PARTICLE SYSTEM
   ========================================================================= */
function createBackgroundParticles() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 15; // X
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10; // Y
    positions[i * 3 + 2] = (Math.random() - 0.8) * 8; // Z (placed mostly in back)
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x6366f1,
    size: 0.04,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending
  });

  bgParticles = new THREE.Points(geometry, material);
  scene.add(bgParticles);
}

/* =========================================================================
   ANIMATION LOOP
   ========================================================================= */
function animate() {
  requestAnimationFrame(animate);

  const time = Date.now() * 0.001;

  // 1. Slow building levitation & rotation
  if (buildingGroup) {
    buildingGroup.rotation.y = time * 0.12;
    buildingGroup.position.y = Math.sin(time * 1.5) * 0.08;

    // Spin counter-rotating rings
    if (buildingGroup.userData.ring1) {
      buildingGroup.userData.ring1.rotation.z = -time * 0.4;
    }
    if (buildingGroup.userData.ring2) {
      buildingGroup.userData.ring2.rotation.z = time * 0.6;
    }
  }

  // 2. Animate upward data particles
  if (upwardParticlesMesh && upwardParticlesGeometry) {
    const positions = upwardParticlesGeometry.attributes.position.array;
    const speeds = upwardParticlesGeometry.userData.speeds;

    for (let i = 0; i < upwardParticleCount; i++) {
      positions[i * 3 + 1] += speeds[i]; // Move particle up (Y)

      // If it passes tower height, reset back to base
      if (positions[i * 3 + 1] > 1.8) {
        positions[i * 3 + 1] = -0.8;
      }
    }
    upwardParticlesGeometry.attributes.position.needsUpdate = true;
  }

  // 3. Background drift
  if (bgParticles) {
    bgParticles.rotation.y = time * 0.015;
    bgParticles.rotation.x = Math.sin(time * 0.05) * 0.05;
  }

  // 4. Update Orbit Controls
  if (controls) {
    controls.update();
  }

  // 5. Render
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/* =========================================================================
   UTILITIES
   ========================================================================= */
function onWindowResize() {
  const container = document.getElementById('hero-canvas-container');
  if (!container || !renderer || !camera) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
}
