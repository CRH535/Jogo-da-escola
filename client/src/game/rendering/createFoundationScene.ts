import {
  BoxGeometry, Color, DirectionalLight, EdgesGeometry, Group, HemisphereLight,
  LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, OctahedronGeometry,
  PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';
import type { Preferences } from '../../settings/preferences';

export interface FoundationScene {
  dispose: () => void;
  setVideo: (video: Preferences['video']) => void;
}

export function createFoundationScene(container: HTMLElement, onError: () => void, initialVideo: Preferences['video']): FoundationScene {
  let video = initialVideo;
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.domElement.setAttribute('aria-label', 'Cena 3D de NEON STRIKE');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#080c0d');
  const camera = new PerspectiveCamera(48, 1, 0.1, 50);
  const core = new Group();
  const geometry = new OctahedronGeometry(1.55);
  const material = new MeshStandardMaterial({
    color: '#244f4d', metalness: 0.6, roughness: 0.4,
    emissive: '#174442', emissiveIntensity: 0.25, flatShading: true,
  });
  const shell = new Mesh(geometry, material);
  const edges = new EdgesGeometry(geometry);
  const edgeMaterial = new LineBasicMaterial({ color: '#64efd2' });
  core.add(shell, new LineSegments(edges, edgeMaterial));

  const railGeometry = new BoxGeometry(0.055, 2.65, 0.055);
  const railMaterial = new MeshStandardMaterial({ color: '#ff7365', emissive: '#ff7365', emissiveIntensity: 1.5 });
  for (const side of [-1, 1]) {
    const rail = new Mesh(railGeometry, railMaterial);
    rail.position.x = side * 2.05;
    rail.rotation.z = -0.35;
    core.add(rail);
  }
  core.rotation.z = 0.12;
  scene.add(core, new HemisphereLight('#defef6', '#121719', 2));
  const keyLight = new DirectionalLight('#ffffff', 3);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    const wide = width >= 900;
    camera.aspect = width / height;
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    const horizontalFit = 3 / (tangent * camera.aspect * (wide ? 0.5 : 1));
    const distance = Math.max(8, horizontalFit);
    camera.position.set(0, 0.1, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const halfHeight = distance * tangent;
    core.scale.setScalar(wide ? 1 : 0.6);
    core.position.set(wide ? halfHeight * camera.aspect * 0.45 : 0, wide ? 0 : (1 - 460 / height) * halfHeight, 0);
    const qualityRatio = { low: 0.75, medium: 1, high: 1.5 }[video.quality];
    let ratio = Math.min(window.devicePixelRatio, qualityRatio);
    if (video.resolution !== 'native') {
      const [targetWidth, targetHeight] = video.resolution.split('x').map(Number);
      ratio = Math.min(ratio, targetWidth! / width, targetHeight! / height);
    }
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = video.shadows && video.quality !== 'low';
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let previousTime = 0;
  let lastFrame = 0;
  function frame(time: number) {
    const interval = video.maxFps ? 1000 / video.maxFps : 0;
    if (interval && time - lastFrame < interval - 0.5) return;
    lastFrame = interval ? time - ((time - lastFrame) % interval) : time;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    if (!reducedMotion.matches) core.rotation.y += delta * 0.32;
    renderer.render(scene, camera);
  }
  function visibilityChanged() {
    previousTime = 0;
    lastFrame = 0;
    renderer.setAnimationLoop(document.hidden ? null : frame);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    onError();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.render(scene, camera);
  visibilityChanged();

  function dispose() {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    document.removeEventListener('visibilitychange', visibilityChanged);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    geometry.dispose();
    edges.dispose();
    railGeometry.dispose();
    material.dispose();
    edgeMaterial.dispose();
    railMaterial.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  return { dispose, setVideo: (next) => { video = next; resize(); } };
}
