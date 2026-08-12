import { getSylonQualityProfile, subscribeSylonMode } from '../core/sylon-state.js';
import { getMapNode, getVisibleMapNodes, SYLON_MAP } from '../core/sylon-map-model.js';

export function supportsMapWebGL(documentRef = globalThis.document) {
  try {
    const canvas = documentRef?.createElement('canvas');
    return Boolean(canvas?.getContext('webgl2') || canvas?.getContext('webgl'));
  } catch {
    return false;
  }
}

function renderFallback(container) {
  container.dataset.mapMode = 'fallback';
  container.innerHTML = '<span class="sylon-map-layer__fallback" aria-hidden="true"></span>';
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

export async function initSylonMap(container, map = SYLON_MAP) {
  if (!container || !supportsMapWebGL()) {
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
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  camera.position.set(0, 0, 8.4);
  let targetDepth = 8.4;
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
  renderer.domElement.className = 'sylon-map-layer__canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.replaceChildren(renderer.domElement);
  container.dataset.mapMode = 'webgl';
  container.dataset.quality = profile.tier;

  const graph = new THREE.Group();
  graph.rotation.x = -0.025;
  scene.add(graph);

  const visibleNodes = getVisibleMapNodes(map);
  const pointById = new Map(visibleNodes.map((node) => [
    node.id,
    new THREE.Vector3(node.spatial.x, node.spatial.y, node.spatial.z || 0)
  ]));
  const nodeMeshes = new Map();
  const edgeLines = new Map();
  const hubRings = new THREE.Group();
  graph.add(hubRings);

  visibleNodes.forEach((node, index) => {
    const isRoot = node.id === map.rootId;
    const geometry = isRoot
      ? new THREE.DodecahedronGeometry(0.22, 1)
      : new THREE.OctahedronGeometry(0.075, 1);
    const materialOptions = {
      color: isRoot ? 0xd5c08e : node.tone === 'amber' ? 0xa88d5a : 0x789283,
      emissive: isRoot ? 0x6d5530 : 0x284638,
      emissiveIntensity: isRoot ? 1.25 : 0.72,
      roughness: isRoot ? 0.18 : 0.34,
      metalness: 0.02,
      transparent: true,
      opacity: isRoot ? 0.96 : 0.82
    };
    const material = isRoot
      ? new THREE.MeshPhysicalMaterial({ ...materialOptions, transmission: 0.22, thickness: 0.45, clearcoat: 0.65, clearcoatRoughness: 0.2 })
      : new THREE.MeshStandardMaterial(materialOptions);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pointById.get(node.id));
    mesh.userData = { id: node.id, phase: index * 1.37, baseScale: isRoot ? 1.35 : 1 };
    mesh.scale.setScalar(mesh.userData.baseScale);
    graph.add(mesh);
    nodeMeshes.set(node.id, mesh);
  });

  [0.34, 0.48, 0.64].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, index === 0 ? 0.006 : 0.004, 6, 72),
      new THREE.MeshBasicMaterial({
        color: index === 1 ? 0xb99a5f : 0x718e7a,
        transparent: true,
        opacity: 0.13 - index * 0.025,
        depthWrite: false
      })
    );
    ring.rotation.x = index * 0.62;
    ring.rotation.y = index * 0.48;
    ring.userData.speed = index % 2 === 0 ? 0.055 + index * 0.012 : -0.042;
    hubRings.add(ring);
  });

  map.edges.forEach((edge) => {
    const source = pointById.get(edge.source);
    const target = pointById.get(edge.target);
    if (!source || !target) return;
    const geometry = new THREE.BufferGeometry().setFromPoints([source, target]);
    const material = new THREE.LineBasicMaterial({
      color: edge.source === map.rootId ? 0x8aa193 : 0x8f815f,
      transparent: true,
      opacity: edge.source === map.rootId ? 0.035 : 0.01,
      depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    line.userData = { source: edge.source, target: edge.target, baseOpacity: material.opacity };
    graph.add(line);
    edgeLines.set(edge.id, line);
  });

  const dustCount = Math.min(profile.particles, 82);
  const positions = new Float32Array(dustCount * 3);
  for (let index = 0; index < dustCount; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 9;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 6;
    positions[index * 3 + 2] = -0.5 + Math.random() * 2.4;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: 0x8aa092,
    size: 0.018,
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  }));
  scene.add(dust);
  scene.add(new THREE.HemisphereLight(0xdfe7df, 0x15120e, 1.15));
  const warmLight = new THREE.PointLight(0xd6ad6a, 3.2, 10);
  warmLight.position.set(1.7, 1.5, 3.6);
  scene.add(warmLight);

  let frameId = 0;
  let disposed = false;
  let visible = !document.hidden;
  let lastTime = performance.now();
  let hoveredId = null;
  let focusedId = map.rootId;
  let modeRoute = null;
  let pointerX = 0;
  let pointerY = 0;
  let requestReducedRender = () => {};

  const unsubscribeMode = subscribeSylonMode((mode) => {
    modeRoute = mode.linkedRoute || null;
    container.dataset.sylonMode = mode.id;
    requestReducedRender();
  });

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
      graph.rotation.y += (pointerX * 0.045 - graph.rotation.y) * Math.min(1, delta * 2.2);
      graph.rotation.x += (-0.025 + pointerY * 0.025 - graph.rotation.x) * Math.min(1, delta * 2.2);
      dust.rotation.z = elapsed * 0.006;
      hubRings.children.forEach((ring, index) => {
        ring.rotation.z += delta * ring.userData.speed;
        ring.rotation.x += Math.sin(elapsed * 0.18 + index) * delta * 0.006;
      });
      camera.position.z += (targetDepth - camera.position.z) * Math.min(1, delta * 4.6);
    } else {
      camera.position.z = targetDepth;
    }

    nodeMeshes.forEach((mesh, id) => {
      const node = getMapNode(id, map);
      const active = id === hoveredId || id === focusedId || node?.route === modeRoute;
      const drift = profile.reducedMotion ? 0 : Math.sin(elapsed * 0.32 + mesh.userData.phase) * 0.018;
      mesh.position.z = (node?.spatial?.z || 0) + drift;
      if (!profile.reducedMotion) {
        mesh.rotation.x = elapsed * 0.08 + mesh.userData.phase;
        mesh.rotation.y = elapsed * 0.11 + mesh.userData.phase * 0.7;
      }
      const pulse = profile.reducedMotion ? 0 : Math.max(0, Math.sin(elapsed * 1.1 + mesh.userData.phase)) * 0.035;
      mesh.scale.setScalar(mesh.userData.baseScale * (1 + pulse + (active ? 0.16 : 0)));
      mesh.material.emissiveIntensity = (id === map.rootId ? 1.25 : 0.65) + (active ? 0.8 : 0);
    });

    edgeLines.forEach((line) => {
      const connected = [line.userData.source, line.userData.target].includes(hoveredId)
        || [line.userData.source, line.userData.target].includes(focusedId);
      line.material.opacity = line.userData.baseOpacity + (connected ? 0.12 : 0);
    });
    warmLight.position.x = 1.7 + Math.sin(elapsed * 0.21) * 0.28;
    warmLight.position.y = 1.5 + Math.cos(elapsed * 0.17) * 0.22;
    renderer.render(scene, camera);
  };

  const tick = (time) => {
    if (disposed) return;
    if (visible) render(time);
    frameId = requestAnimationFrame(tick);
  };
  requestReducedRender = () => {
    if (profile.reducedMotion && visible) render(performance.now());
  };
  const onPointerMove = (event) => {
    const bounds = container.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  };
  const onHover = (event) => {
    hoveredId = event.detail?.nodeId || null;
    if (profile.reducedMotion) render(performance.now());
  };
  const onFocus = (event) => {
    focusedId = event.detail?.nodeId || map.rootId;
    targetDepth = focusedId === map.rootId ? 8.4 : 6.6;
    if (profile.reducedMotion) render(performance.now());
  };
  const onVisibility = () => {
    visible = !document.hidden;
    lastTime = performance.now();
    if (visible && profile.reducedMotion) render(lastTime);
  };

  container.addEventListener('pointermove', onPointerMove, { passive: true });
  container.addEventListener('sylon:map-hover', onHover);
  container.addEventListener('sylon:map-focus', onFocus);
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  if (profile.reducedMotion) render(performance.now());
  else frameId = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('sylon:map-hover', onHover);
    container.removeEventListener('sylon:map-focus', onFocus);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    unsubscribeMode();
    disposeObject(graph);
    dustGeometry.dispose();
    dust.material.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    container.replaceChildren();
  };
}
