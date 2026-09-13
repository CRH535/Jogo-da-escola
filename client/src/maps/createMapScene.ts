import {
  BufferGeometry, Float32BufferAttribute,
  LineBasicMaterial, LineSegments, PCFShadowMap, PerspectiveCamera, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import type { MapWorld } from '@neon-strike/shared/physics';
import type { Preferences } from '../settings/preferences';
import { createArenaEnvironment } from './createArenaEnvironment';
import { MAP_VIEWS } from './mapViews';

export interface MapScene {
  dispose: () => void;
  setView: (id: string) => void;
  setSpawns: (visible: boolean) => void;
  setDebug: (visible: boolean) => void;
  setVideo: (video: Preferences['video']) => void;
}

export function createMapScene(container: HTMLElement, physics: MapWorld, onError: () => void, initialVideo: Preferences['video']): MapScene {
  let video = initialVideo;
  let viewId = 'overview';
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.domElement.setAttribute('aria-label', 'Mapa 3D NEON FACILITY');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);
  const environment = createArenaEnvironment(NEON_FACILITY);
  const { scene, meshes } = environment;
  const camera = new PerspectiveCamera(48, 1, 0.1, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 10;
  controls.maxDistance = 220;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2.4;
  renderer.shadowMap.type = PCFShadowMap;
  let debug: LineSegments<BufferGeometry, LineBasicMaterial> | undefined;
  function setDebug(visible: boolean) {
    if (!import.meta.env.DEV) return;
    if (visible && !debug) {
      const buffers = physics.world.debugRender();
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(buffers.vertices, 3));
      debug = new LineSegments(geometry, new LineBasicMaterial({ color: '#f9e655', depthTest: false }));
      debug.renderOrder = 10;
      scene.add(debug);
    }
    if (debug) debug.visible = visible;
  }
  const offset = new Vector3();
  function setView(id: string) {
    const view = MAP_VIEWS.find((entry) => entry.id === id) ?? MAP_VIEWS[0]!;
    viewId = view.id;
    controls.target.fromArray(view.target);
    const fit = view.id === 'overview' ? Math.max(1, 1 / camera.aspect) : Math.max(1, 0.65 / camera.aspect);
    offset.fromArray(view.offset).multiplyScalar(fit);
    controls.maxDistance = Math.max(220, offset.length() * 1.25);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }
  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    let ratio = Math.min(window.devicePixelRatio, { low: 0.75, medium: 1, high: 1.5 }[video.quality]);
    if (video.resolution !== 'native') {
      const [targetWidth, targetHeight] = video.resolution.split('x').map(Number);
      ratio = Math.min(ratio, targetWidth! / width, targetHeight! / height);
    }
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = video.shadows && video.quality !== 'low';
    // Static lighting: refresh only after a quality/viewport change, not every frame.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    setView(viewId);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  let lastFrame = 0;
  let failed = false;
  function frame(time: number) {
    const interval = video.maxFps ? 1000 / video.maxFps : 0;
    if (interval && time - lastFrame < interval - 0.5) return;
    lastFrame = interval ? time - (time - lastFrame) % interval : time;
    renderer.render(scene, camera);
  }
  function visibilityChanged() {
    lastFrame = 0;
    renderer.setAnimationLoop(document.hidden || failed ? null : frame);
  }
  function contextLost(event: Event) { event.preventDefault(); failed = true; visibilityChanged(); onError(); }
  document.addEventListener('visibilitychange', visibilityChanged);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  resize();
  renderer.render(scene, camera);
  visibilityChanged();
  return {
    setView, setDebug,
    setSpawns: (visible) => { meshes.spawns.visible = visible; },
    setVideo: (next) => { video = next; resize(); },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      controls.dispose();
      debug?.geometry.dispose(); debug?.material.dispose();
      environment.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
