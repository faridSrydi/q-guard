/**
 * Q-GUARD Hero 3D - Floating Reefer Container & Device Viewport
 * Powered by Three.js (WebGL)
 * 
 * Aesthetic: Seamless & Borderless, Floating in space with subtle ambient contact shadow.
 * Interaction: Drag / Touch to rotate 360°, auto-hover idle breathing animation.
 */

export function initHero3D() {
  const modelViewer = document.getElementById('hero-model-viewer');
  if (modelViewer) {
    console.log('[Hero 3D] Menggunakan Google Model Viewer untuk q_guard_3d_model.glb');
    modelViewer.addEventListener('load', () => {
      console.log('[Hero 3D] Model 3D q_guard_3d_model.glb berhasil dimuat via Google Model Viewer');
    });
    modelViewer.addEventListener('error', (err) => {
      console.warn('[Hero 3D] Google Model Viewer error:', err);
    });
    return;
  }

  const containerEl = document.getElementById('hero-3d-container');
  if (!containerEl) return;

  // Pastikan Three.js sudah tersedia dari window.THREE (CDN)
  if (typeof THREE === 'undefined') {
    console.warn('[Hero 3D] Three.js belum dimuat. Mencoba memuat Three.js secara dinamis...');
    if (!window.__three_loading) {
      window.__three_loading = true;
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
      script.onload = () => {
        console.log('[Hero 3D] Three.js berhasil dimuat via dynamic CDN');
        initHero3D();
      };
      script.onerror = () => {
        console.warn('[Hero 3D] CDN primer gagal, beralih ke unpkg...');
        const fallback = document.createElement('script');
        fallback.src = 'https://unpkg.com/three@0.128.0/build/three.min.js';
        fallback.onload = () => initHero3D();
        document.head.appendChild(fallback);
      };
      document.head.appendChild(script);
    } else {
      setTimeout(initHero3D, 200);
    }
    return;
  }

  // Cegah inisialisasi ganda jika canvas sudah aktif
  if (containerEl.__three_active) return;
  containerEl.__three_active = true;

  // Bersihkan konten lama jika ada
  containerEl.innerHTML = '';

  const width = containerEl.clientWidth || 540;
  const height = containerEl.clientHeight || 460;

  // 1. Scene, Camera, Renderer
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(5.2, 2.7, 5.4);
  camera.lookAt(0, 0.15, 0); // KRUSIAL: Arahkan fokus kamera tepat ke tengah kontainer

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true, // 100% Seamless & Borderless (Menyatu dengan canvas latar)
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Pastikan style canvas responsif penuh & tidak memicu scroll gestur sentuh
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';
  containerEl.appendChild(renderer.domElement);

  // 2. Lighting System (Natural Soft Studio Lighting)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(6, 9, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 25;
  keyLight.shadow.bias = -0.001;
  scene.add(keyLight);

  // Rim Light (Aksen Dingin Cold-Chain Cyan)
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
  rimLight.position.set(-6, 4, -5);
  scene.add(rimLight);

  // Warm Bounce Light dari bawah
  const bounceLight = new THREE.DirectionalLight(0xf1f5f9, 0.4);
  bounceLight.position.set(0, -5, 2);
  scene.add(bounceLight);

  // 3. Root Pivot Group (Untuk efek melayang dan rotasi interaktif)
  const floatingGroup = new THREE.Group();
  scene.add(floatingGroup);

  // 4. Bayangan Dasar Melayang (Soft Contact Shadow Plane)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const shadowCtx = shadowCanvas.getContext('2d');
  const gradient = shadowCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
  gradient.addColorStop(0.35, 'rgba(15, 23, 42, 0.12)');
  gradient.addColorStop(0.7, 'rgba(15, 23, 42, 0.03)');
  gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
  shadowCtx.fillStyle = gradient;
  shadowCtx.fillRect(0, 0, 256, 256);

  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(6.5, 4.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.55;
  scene.add(shadowPlane);

  // =========================================================================
  // 5. MODEL 3D KONTAINER REEFER DENGAN CUTAWAY TRANSPARAN
  // =========================================================================
  const reeferGroup = new THREE.Group();
  floatingGroup.add(reeferGroup);

  // Dimensi Kontainer
  const cLen = 4.8;
  const cHeight = 2.4;
  const cWidth = 2.2;

  // Material Dinding Kontainer (Putih / Off-White Khas Reefer Container Maritim)
  const reeferWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.15
  });

  const reeferInnerMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
    metalness: 0.2,
    side: THREE.BackSide
  });

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7,
    metalness: 0.4
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Aksen Biru Barantin pada Rangka Sudut
    roughness: 0.4,
    metalness: 0.3
  });

  // A. Lantai Kontainer (T-Bar Industrial Grating Floor)
  const floorGeo = new THREE.BoxGeometry(cLen, 0.12, cWidth);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = -cHeight / 2;
  floorMesh.receiveShadow = true;
  reeferGroup.add(floorMesh);

  // B. Dinding Belakang (Solid)
  const backWallGeo = new THREE.BoxGeometry(cLen, cHeight, 0.08);
  const backWallMesh = new THREE.Mesh(backWallGeo, reeferWhiteMat);
  backWallMesh.position.set(0, 0, -cWidth / 2);
  backWallMesh.castShadow = true;
  backWallMesh.receiveShadow = true;
  reeferGroup.add(backWallMesh);

  // Corrugation Ribs di Dinding Belakang
  for (let x = -cLen / 2 + 0.3; x < cLen / 2 - 0.2; x += 0.35) {
    const ribGeo = new THREE.BoxGeometry(0.12, cHeight - 0.2, 0.04);
    const ribMesh = new THREE.Mesh(ribGeo, reeferWhiteMat);
    ribMesh.position.set(x, 0, -cWidth / 2 - 0.03);
    reeferGroup.add(ribMesh);
  }

  // C. Dinding Kiri (Mesin Pendingin Reefer Unit)
  const coolingUnitGeo = new THREE.BoxGeometry(0.18, cHeight, cWidth);
  const coolingUnitMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.4,
    metalness: 0.3
  });
  const coolingUnitMesh = new THREE.Mesh(coolingUnitGeo, coolingUnitMat);
  coolingUnitMesh.position.set(-cLen / 2, 0, 0);
  reeferGroup.add(coolingUnitMesh);

  // Kipas Pendingin / Grille
  const fanVentGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.05, 24);
  const fanVentMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const fanVentMesh = new THREE.Mesh(fanVentGeo, fanVentMat);
  fanVentMesh.rotation.z = Math.PI / 2;
  fanVentMesh.position.set(-cLen / 2 + 0.1, 0.35, 0);
  reeferGroup.add(fanVentMesh);

  // D. Atap Kontainer (Sebagian Cutaway / Semi-Transparan)
  const roofGeo = new THREE.BoxGeometry(cLen, 0.08, cWidth * 0.45);
  const roofMesh = new THREE.Mesh(roofGeo, reeferWhiteMat);
  roofMesh.position.set(0, cHeight / 2, -cWidth * 0.28);
  reeferGroup.add(roofMesh);

  // E. Rangka Baja Penguat (Corner Castings & Pillars)
  const cornerPillarGeo = new THREE.BoxGeometry(0.14, cHeight + 0.1, 0.14);
  const corners = [
    [-cLen / 2, 0, -cWidth / 2],
    [cLen / 2, 0, -cWidth / 2],
    [-cLen / 2, 0, cWidth / 2],
    [cLen / 2, 0, cWidth / 2]
  ];
  corners.forEach(([cx, cy, cz]) => {
    const pillar = new THREE.Mesh(cornerPillarGeo, frameMat);
    pillar.position.set(cx, cy, cz);
    pillar.castShadow = true;
    reeferGroup.add(pillar);
  });

  // F. Pintu Kanan Kontainer (Terbuka Sedikit / Ajar untuk Cutaway View)
  const doorGeo = new THREE.BoxGeometry(0.08, cHeight, cWidth * 0.48);
  const doorMesh = new THREE.Mesh(doorGeo, reeferWhiteMat);
  doorMesh.position.set(cLen / 2 + 0.25, 0, cWidth / 2 + 0.2);
  doorMesh.rotation.y = -Math.PI / 3.5; // Terbuka miring
  doorMesh.castShadow = true;
  reeferGroup.add(doorMesh);

  // Segel Magnetik Pintu MC-38
  const doorSensorGeo = new THREE.BoxGeometry(0.05, 0.2, 0.05);
  const doorSensorMat = new THREE.MeshStandardMaterial({ color: 0xef4444 }); // Merah sensor pintu
  const doorSensor = new THREE.Mesh(doorSensorGeo, doorSensorMat);
  doorSensor.position.set(cLen / 2, 0.4, cWidth / 2 - 0.05);
  reeferGroup.add(doorSensor);

  // =========================================================================
  // 6. PALET KARGO BEKU (FROZEN FISH / PHARMA PAYLOAD)
  // =========================================================================
  const cargoGroup = new THREE.Group();
  reeferGroup.add(cargoGroup);

  const palletMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 }); // Kayu
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 }); // Karton beku biru
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.75
  });

  // Buat 2 susun palet kargo
  const palletPositions = [-0.6, 0.9];
  palletPositions.forEach((px) => {
    // Palet kayu dasar
    const palletGeo = new THREE.BoxGeometry(1.1, 0.1, 1.3);
    const pallet = new THREE.Mesh(palletGeo, palletMat);
    pallet.position.set(px, -cHeight / 2 + 0.12, -0.15);
    pallet.receiveShadow = true;
    cargoGroup.add(pallet);

    // Tumpukan boks kargo beku
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const boxGeo = new THREE.BoxGeometry(0.48, 0.4, 0.58);
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set(
          px - 0.25 + c * 0.52,
          -cHeight / 2 + 0.38 + r * 0.42,
          -0.42 + c * 0.05
        );
        box.castShadow = true;
        cargoGroup.add(box);
      }
    }
  });

  // Lapisan Es di atas kargo (Tempat Probe T1)
  const iceSheetGeo = new THREE.BoxGeometry(1.1, 0.06, 1.2);
  const iceSheet = new THREE.Mesh(iceSheetGeo, iceMat);
  iceSheet.position.set(-0.6, -cHeight / 2 + 1.25, -0.15);
  cargoGroup.add(iceSheet);

  // =========================================================================
  // 7. PERANGKAT Q-GUARD (CASING ABU-ABU TERANG, VERTIKAL, TFT SCREEN, KABEL)
  // =========================================================================
  const deviceGroup = new THREE.Group();
  // Posisi di dinding dalam kontainer dekat bukaan agar jelas terlihat
  deviceGroup.position.set(0.65, 0.25, -cWidth / 2 + 0.25);
  deviceGroup.rotation.y = 0.2; // Sedikit menghadap ke arah kamera
  reeferGroup.add(deviceGroup);

  // A. Casing Utama Abu-Abu Terang (Memanjang ke atas / Taller than wide)
  const dWidth = 0.65;
  const dHeight = 1.05;
  const dDepth = 0.22;
  const casingGeo = new THREE.BoxGeometry(dWidth, dHeight, dDepth);
  const casingMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, // Casing abu-abu terang industri
    roughness: 0.3,
    metalness: 0.15
  });
  const casingMesh = new THREE.Mesh(casingGeo, casingMat);
  casingMesh.castShadow = true;
  deviceGroup.add(casingMesh);

  // Bezel Layar
  const bezelGeo = new THREE.BoxGeometry(dWidth * 0.88, dHeight * 0.55, 0.03);
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
  bezelMesh.position.set(0, 0.16, dDepth / 2 + 0.01);
  deviceGroup.add(bezelMesh);

  // B. Layar LCD TFT Aktif (Dengan Glow Telemetri)
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 256;
  screenCanvas.height = 192;
  const sCtx = screenCanvas.getContext('2d');

  // Gambar UI Miniatur Q-GUARD pada canvas layar
  sCtx.fillStyle = '#081426';
  sCtx.fillRect(0, 0, 256, 192);

  // Navbar atas
  sCtx.fillStyle = '#0284c7';
  sCtx.fillRect(0, 0, 256, 26);
  sCtx.fillStyle = '#ffffff';
  sCtx.font = 'bold 13px sans-serif';
  sCtx.fillText('Q-GUARD • BEKU -18C', 10, 18);

  // Angka Suhu Utama (T2)
  sCtx.fillStyle = '#10b981'; // Hijau aman
  sCtx.font = 'bold 44px monospace';
  sCtx.fillText('-19.4°C', 14, 82);

  sCtx.fillStyle = '#94a3b8';
  sCtx.font = '12px sans-serif';
  sCtx.fillText('T1: -21.2°C  |  T3: -18.6°C', 14, 115);
  sCtx.fillText('MKT: -19.1°C | PINTU: RAPAT', 14, 136);

  // Status Badge
  sCtx.fillStyle = '#0f766e';
  sCtx.fillRect(14, 150, 140, 26);
  sCtx.fillStyle = '#ffffff';
  sCtx.font = 'bold 12px sans-serif';
  sCtx.fillText('JALUR HIJAU (PASS)', 20, 168);

  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  const screenGeo = new THREE.PlaneGeometry(dWidth * 0.78, dHeight * 0.46);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.set(0, 0.16, dDepth / 2 + 0.026);
  deviceGroup.add(screenMesh);

  // C. Tiga Tombol Berwarna di Bawah Layar
  const btnColors = [0xef4444, 0xf59e0b, 0x10b981]; // Merah (Back), Kuning (Select), Hijau (Confirm)
  const btnX = [-0.18, 0, 0.18];
  for (let b = 0; b < 3; b++) {
    const btnGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16);
    const btnMat = new THREE.MeshStandardMaterial({ color: btnColors[b], roughness: 0.3 });
    const btn = new THREE.Mesh(btnGeo, btnMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(btnX[b], -0.22, dDepth / 2 + 0.02);
    deviceGroup.add(btn);
  }

  // Tiga LED Indikator di atas Tombol
  for (let l = 0; l < 3; l++) {
    const ledGeo = new THREE.SphereGeometry(0.025, 12, 12);
    const ledMat = new THREE.MeshBasicMaterial({ color: btnColors[l] });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(btnX[l], -0.32, dDepth / 2 + 0.015);
    deviceGroup.add(led);
  }

  // D. Gland Kabel & Kabel Sensor Fleksibel Menuju Kargo
  const cableGlandGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.08, 12);
  const cableGlandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

  // 3 Gland kabel di sisi bawah perangkat
  const glandX = [-0.14, 0, 0.14];
  glandX.forEach((gx, idx) => {
    const gland = new THREE.Mesh(cableGlandGeo, cableGlandMat);
    gland.position.set(gx, -dHeight / 2 - 0.04, 0);
    deviceGroup.add(gland);

    // Kurva kabel menjuntai ke kargo menggunakan CatmullRomCurve3
    let targetX = idx === 0 ? -1.2 : (idx === 1 ? -0.2 : 1.2);
    let targetY = idx === 0 ? -0.4 : (idx === 1 ? -0.7 : -0.2);
    let targetZ = idx === 0 ? 0.2 : (idx === 1 ? 0.3 : 0.8);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(gx, -dHeight / 2 - 0.08, 0),
      new THREE.Vector3(gx + (targetX - gx) * 0.3, -dHeight / 2 - 0.35, 0.1),
      new THREE.Vector3(gx + (targetX - gx) * 0.7, targetY + 0.25, targetZ * 0.6),
      new THREE.Vector3(targetX, targetY, targetZ)
    ]);

    const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.014, 8, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, cableMat);
    deviceGroup.add(tubeMesh);

    // Probe Logam DS18B20 di Ujung Kabel
    const probeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12);
    const probeMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
    const probe = new THREE.Mesh(probeGeo, probeMat);
    probe.position.set(targetX, targetY, targetZ);
    probe.rotation.z = Math.PI / 4;
    deviceGroup.add(probe);
  });

  // Label Probe Interaktif (Indicator Nodes)
  function createProbeIndicator(label, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');

    // Rounded rectangle background (Safe polyfill for older/strict browser canvas)
    ctx.fillStyle = color;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(4, 4, 132, 42, 12);
    } else {
      const x = 4, y = 4, w = 132, h = 42, r = 12;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
    ctx.fill();

    // Subtle crisp border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 70, 26);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      depthTest: false,
      transparent: true
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.72, 0.26, 1);
    sprite.renderOrder = 999; // Tetap terbaca di atas kargo
    return sprite;
  }

  const p1Tag = createProbeIndicator('T1 Es', '#0284c7');
  p1Tag.position.set(-0.6, -cHeight / 2 + 1.45, -0.15);
  cargoGroup.add(p1Tag);

  const p2Tag = createProbeIndicator('T2 Inti', '#10b981');
  p2Tag.position.set(0.35, -cHeight / 2 + 0.9, -0.3);
  cargoGroup.add(p2Tag);

  const p3Tag = createProbeIndicator('T3 Pintu', '#f59e0b');
  p3Tag.position.set(cLen / 2 - 0.2, 0.7, cWidth / 2 - 0.3);
  reeferGroup.add(p3Tag);

  // =========================================================================
  // 8. INTERAKSI ROTASI ORBIT (DRAG & TOUCH VIA POINTER EVENTS)
  // =========================================================================
  let isDragging = false;
  let prevPointerPos = { x: 0, y: 0 };
  let targetRotationY = -0.32;
  let targetRotationX = 0.12;
  let currentRotationY = -0.32;
  let currentRotationX = 0.12;

  const onPointerDown = (e) => {
    isDragging = true;
    prevPointerPos = { x: e.clientX, y: e.clientY };
    renderer.domElement.style.cursor = 'grabbing';
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - prevPointerPos.x;
    const deltaY = e.clientY - prevPointerPos.y;

    targetRotationY += deltaX * 0.007;
    targetRotationX += deltaY * 0.005;

    // Batasi sudut elevasi vertikal agar tidak jungkir balik
    targetRotationX = Math.max(-0.45, Math.min(0.55, targetRotationX));

    prevPointerPos = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = () => {
    isDragging = false;
    renderer.domElement.style.cursor = 'grab';
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Resize Handler & ResizeObserver
  const updateViewportSize = () => {
    if (!containerEl) return;
    const newW = containerEl.clientWidth || 540;
    const newH = containerEl.clientHeight || 460;
    camera.aspect = newW / newH;
    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH, false);
    camera.lookAt(0, 0.15, 0);
  };

  window.addEventListener('resize', updateViewportSize);

  if (window.ResizeObserver) {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          updateViewportSize();
        }
      }
    });
    ro.observe(containerEl);
  }

  // =========================================================================
  // 9. ANIMATION LOOP (IDLE FLOATING + SMOOTH LERP ROTATION)
  // =========================================================================
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Idle Breathing Floating Animation (Efek melayang di ruang hero)
    floatingGroup.position.y = Math.sin(elapsedTime * 1.2) * 0.07;
    shadowPlane.scale.set(
      1 + Math.sin(elapsedTime * 1.2) * 0.05,
      1 + Math.sin(elapsedTime * 1.2) * 0.05,
      1
    );

    // Rotasi otomatis sangat lambat saat pengguna tidak sedang menggeser
    if (!isDragging) {
      targetRotationY += 0.0018;
    }

    // Damping LERP untuk pergerakan halus
    currentRotationY += (targetRotationY - currentRotationY) * 0.08;
    currentRotationX += (targetRotationX - currentRotationX) * 0.08;

    floatingGroup.rotation.y = currentRotationY;
    floatingGroup.rotation.x = currentRotationX;

    renderer.render(scene, camera);
  }

  animate();
  console.log('[Hero 3D] Three.js Floating Container & Q-GUARD berhasil diinisialisasi (Borderless)');
}
