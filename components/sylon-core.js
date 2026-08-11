import { createSylonInteractionState, getSylonQualityProfile } from '../core/sylon-state.js';

export function supportsWebGL(documentRef = globalThis.document) {
  try {
    const canvas = documentRef?.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function renderFallback(container) {
  container.dataset.coreMode = 'fallback';
  container.innerHTML = `
    <div class="sylon-core-fallback" role="img" aria-label="Органическая структура SYLON">
      <span></span><span></span><span></span><i></i><i></i><i></i>
    </div>`;
}

function createHelixCurve(THREE, phase, turns = 2.3) {
  const points = [];
  const count = 88;
  for (let index = 0; index < count; index += 1) {
    const progress = index / (count - 1);
    const angle = progress * Math.PI * 2 * turns + phase;
    const asymmetry = Math.sin(progress * Math.PI * 5 + phase * 0.6);
    const radius = 0.7 + Math.sin(progress * Math.PI * 3.2 + phase * 0.18) * 0.11;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius + asymmetry * 0.11,
      (progress - 0.5) * 3.45 + Math.sin(progress * Math.PI * 4.4 + phase) * 0.09,
      Math.sin(angle) * radius * (0.68 + Math.cos(progress * Math.PI * 2 + phase) * 0.06)
    ));
  }
  return { curve: new THREE.CatmullRomCurve3(points), points };
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

export async function initSylonCore(container) {
  if (!container || !supportsWebGL()) {
    if (container) renderFallback(container);
    return () => {};
  }

  let THREE;
  try {
    THREE = await import('three');
  } catch {
    renderFallback(container);
    return () => {};
  }
  if (!container.isConnected) return () => {};

  const profile = getSylonQualityProfile();
  const state = createSylonInteractionState();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 30);
  camera.position.set(0, 0, state.depth);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: profile.tier === 'high', powerPreference: 'high-performance' });
  } catch {
    renderFallback(container);
    return () => {};
  }

  renderer.setPixelRatio(profile.pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'sylon-core__canvas';
  renderer.domElement.setAttribute('aria-label', 'Интерактивное ядро SYLON. Перетаскивайте для вращения, колесо меняет глубину.');
  renderer.domElement.setAttribute('role', 'img');
  container.replaceChildren(renderer.domElement);
  container.dataset.coreMode = 'webgl';
  container.dataset.quality = profile.tier;

  const core = new THREE.Group();
  core.rotation.z = -0.16;
  scene.add(core);

  const strandMaterialA = new THREE.MeshPhysicalMaterial({
    color: 0x526f61,
    emissive: 0x142c22,
    emissiveIntensity: 0.72,
    roughness: 0.24,
    metalness: 0.02,
    transmission: 0.18,
    transparent: true,
    opacity: 0.78,
    depthWrite: false
  });
  const strandMaterialB = strandMaterialA.clone();
  strandMaterialB.color.setHex(0x8a7959);
  strandMaterialB.emissive.setHex(0x332413);

  const helixA = createHelixCurve(THREE, 0);
  const helixB = createHelixCurve(THREE, Math.PI);
  const segments = profile.tier === 'high' ? 132 : 92;
  const strandA = new THREE.Mesh(new THREE.TubeGeometry(helixA.curve, segments, 0.075, 8, false), strandMaterialA);
  const strandB = new THREE.Mesh(new THREE.TubeGeometry(helixB.curve, segments, 0.075, 8, false), strandMaterialB);
  core.add(strandA, strandB);

  const connectorPositions = [];
  for (let index = 8; index < helixA.points.length - 4; index += 13) {
    connectorPositions.push(...helixA.points[index].toArray(), ...helixB.points[index].toArray());
  }
  const connectorGeometry = new THREE.BufferGeometry();
  connectorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(connectorPositions, 3));
  const connectors = new THREE.LineSegments(connectorGeometry, new THREE.LineBasicMaterial({
    color: 0xc1b184,
    transparent: true,
    opacity: 0.12,
    depthWrite: false
  }));
  core.add(connectors);

  const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0xe0d1a1, emissive: 0x8e7440, emissiveIntensity: 0.9, roughness: 0.35 });
  const nodes = [];
  for (let index = 9; index < helixA.points.length - 4; index += 14) {
    for (const point of [helixA.points[index], helixB.points[index]]) {
      const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), nodeMaterial.clone());
      node.position.copy(point);
      node.scale.set(1.25, 0.86, 1);
      node.userData.phase = index * 0.19 + nodes.length;
      nodes.push(node);
      core.add(node);
    }
  }

  const particlePositions = new Float32Array(profile.particles * 3);
  for (let index = 0; index < profile.particles; index += 1) {
    const radius = 1.1 + Math.random() * 1.5;
    const angle = Math.random() * Math.PI * 2;
    particlePositions[index * 3] = Math.cos(angle) * radius;
    particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 4.6;
    particlePositions[index * 3 + 2] = Math.sin(angle) * radius * 0.58;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
    color: 0xa7bea9,
    size: profile.tier === 'high' ? 0.025 : 0.032,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  }));
  core.add(particles);

  scene.add(new THREE.HemisphereLight(0xdce8de, 0x17120d, 1.25));
  const warmLight = new THREE.PointLight(0xe0b46c, 4.5, 8);
  warmLight.position.set(1.8, 1.2, 2.7);
  scene.add(warmLight);
  const greenLight = new THREE.PointLight(0x5f9a74, 4, 7);
  greenLight.position.set(-2, -1.3, 2.1);
  scene.add(greenLight);

  let frameId = 0;
  let disposed = false;
  let visible = !document.hidden;
  let lastTime = performance.now();
  let sampleStarted = lastTime;
  let sampledFrames = 0;
  let adaptiveApplied = false;
  let pointerId = null;
  let previousPointerX = 0;

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (profile.reducedMotion) render(performance.now());
  };

  const render = (time) => {
    const elapsed = time * 0.001;
    const delta = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    if (!profile.reducedMotion) {
      state.targetRotation += 0.045 * delta;
      state.velocity *= Math.pow(0.025, delta);
      state.targetRotation += state.velocity * delta;
      state.rotation += (state.targetRotation - state.rotation) * Math.min(1, delta * 4.2);
      state.depth += (state.targetDepth - state.depth) * Math.min(1, delta * 5);
      const breath = 1 + Math.sin(elapsed * 0.72) * 0.018;
      core.scale.setScalar(breath);
      particles.rotation.y -= delta * 0.035;
    }

    core.rotation.y = state.rotation + state.pointerX * 0.08;
    core.rotation.x = state.pointerY * 0.055;
    camera.position.z = state.depth;
    const hoverStrength = state.hoveredModule ? 0.9 : 0;
    nodes.forEach((node) => {
      const pulse = profile.reducedMotion ? 0 : Math.max(0, Math.sin(elapsed * 1.45 + node.userData.phase));
      node.material.emissiveIntensity = 0.72 + pulse * 0.5 + hoverStrength;
      node.scale.setScalar(1 + pulse * 0.09 + hoverStrength * 0.08);
    });
    warmLight.intensity = 4.2 + Math.sin(elapsed * 0.58) * 0.35 + hoverStrength;
    renderer.render(scene, camera);

    sampledFrames += 1;
    if (!adaptiveApplied && time - sampleStarted > 2400) {
      const fps = sampledFrames / ((time - sampleStarted) / 1000);
      if (fps < 46 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(1);
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        container.dataset.quality = 'adaptive';
      }
      adaptiveApplied = true;
    }
  };

  const tick = (time) => {
    if (disposed) return;
    if (visible) render(time);
    frameId = requestAnimationFrame(tick);
  };

  const requestReducedRender = () => {
    if (profile.reducedMotion && visible) render(performance.now());
  };

  const onPointerDown = (event) => {
    state.dragging = true;
    pointerId = event.pointerId;
    previousPointerX = event.clientX;
    state.velocity = 0;
    renderer.domElement.setPointerCapture?.(pointerId);
    container.classList.add('is-dragging');
  };
  const onPointerMove = (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    state.pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    state.pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    container.classList.toggle('is-reacting', Math.hypot(state.pointerX, state.pointerY) < 0.86);
    if (state.dragging && event.pointerId === pointerId) {
      const movement = event.clientX - previousPointerX;
      state.targetRotation += movement * 0.009;
      state.velocity = movement * 0.13;
      previousPointerX = event.clientX;
    }
    requestReducedRender();
  };
  const endDrag = (event) => {
    if (pointerId !== null && event.pointerId !== pointerId) return;
    state.dragging = false;
    pointerId = null;
    container.classList.remove('is-dragging');
  };
  const onWheel = (event) => {
    event.preventDefault();
    state.targetDepth = Math.min(5.25, Math.max(3.45, state.targetDepth + event.deltaY * 0.0015));
    requestReducedRender();
  };
  const onVisibility = () => {
    visible = !document.hidden;
    lastTime = performance.now();
    if (visible && profile.reducedMotion) render(lastTime);
  };
  const onModuleHover = (event) => {
    state.hoveredModule = event.detail?.route || null;
    container.dataset.linkedModule = state.hoveredModule || '';
    requestReducedRender();
  };

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  container.addEventListener('sylon:module-hover', onModuleHover);
  resize();

  if (profile.reducedMotion) render(performance.now());
  else frameId = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', endDrag);
    canvas.removeEventListener('pointercancel', endDrag);
    canvas.removeEventListener('pointerleave', endDrag);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    container.removeEventListener('sylon:module-hover', onModuleHover);
    disposeObject(core);
    renderer.dispose();
    renderer.forceContextLoss?.();
    container.replaceChildren();
  };
}
