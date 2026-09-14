import { PCFShadowMap, PerspectiveCamera, WebGLRenderer } from 'three';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import type { MapWorld } from '@neon-strike/shared/physics';
import type { BotOptions } from '@neon-strike/shared/bots';
import type { MatchRules } from '@neon-strike/shared/match';
import { createPlayerController, FixedStep, MOVEMENT } from '@neon-strike/shared/simulation';
import { createArenaEnvironment } from '../../maps/createArenaEnvironment';
import type { Preferences } from '../../settings/preferences';
import { InputManager } from './InputManager';
import { TrainingRuntime, type TrainingReadout } from '../combat/TrainingRuntime';

export interface PlayerDebug {
  x: number; y: number; z: number; speed: number; grounded: boolean;
  yaw: number; pitch: number; cameraY: number; fov: number; fps: number; calls: number; geometries: number; recoveries: number;
  bots: ReturnType<TrainingRuntime['botDebug']>;
}
export interface PlayerSceneCallbacks {
  onLock: (locked: boolean) => void;
  onInputError: (message: string) => void;
  onError: () => void;
  onDebug: (debug: PlayerDebug) => void;
  onCombat?: (snapshot: TrainingReadout) => void;
  onScoreboard?: (open: boolean) => void;
}

export function createPlayerScene(container: HTMLElement, physics: MapWorld, initialPreferences: Preferences, callbacks: PlayerSceneCallbacks, trainingMode = false, bots?: BotOptions, rules?: Readonly<MatchRules>) {
  let preferences = initialPreferences;
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.domElement.setAttribute('aria-label', 'Arena em primeira pessoa');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);
  const environment = createArenaEnvironment(NEON_FACILITY);
  const camera = new PerspectiveCamera(preferences.video.fov, 1, 0.05, 160);
  camera.rotation.order = 'YXZ';
  environment.scene.add(camera);
  const spawn = NEON_FACILITY.spawns[7]!;
  const player = createPlayerController(physics.world, NEON_FACILITY, spawn);
  const clock = new FixedStep();
  let active = false;
  let failed = false;
  let lastTime = 0;
  let lastRender = 0;
  let debugEnabled = false;
  let debugTime = 0;
  let renderedFrames = 0;
  let measuredFps = 0;
  let bobPhase = 0;
  let bobAmount = 0;
  let training: TrainingRuntime | null = null;
  const input = new InputManager(renderer.domElement, {
    onLock(locked) {
      active = locked && !failed;
      player.clearInput();
      if (!active) training?.pause();
      clock.reset(); lastTime = 0;
      emitDebug();
      callbacks.onLock(active);
    },
    onError: callbacks.onInputError,
    onScoreboard: (open) => { if (trainingMode || bots) callbacks.onScoreboard?.(open); },
  });
  input.yaw = spawn.yaw;
  input.sensitivity = preferences.controls.sensitivity;
  if ((trainingMode || bots) && callbacks.onCombat) training = new TrainingRuntime(physics, player, environment.scene, camera, input, preferences, callbacks.onCombat, bots, rules);
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function step(combat = true) {
    if (combat && training && !training.playing) {
      input.clearGameplay(); player.clearInput(); training.step(); return;
    }
    if (training && !training.alive) { input.clearGameplay(); player.clearInput(); }
    if (!bots || !training || training.alive) player.beforeStep(input.read());
    else { player.previous.x = player.state.x; player.previous.y = player.state.y; player.previous.z = player.state.z; }
    if (combat) training?.beforePhysics();
    physics.world.step();
    player.afterStep();
    if (combat) training?.afterPhysics();
    if (combat) training?.step();
    if (combat && training?.ended) input.release();
  }
  // Establish ground contact before the first user gesture; no elapsed game time.
  step(false); step(false);
  function resize() {
    const width = Math.max(1, container.clientWidth); const height = Math.max(1, container.clientHeight);
    const video = preferences.video;
    camera.aspect = width / height; camera.fov = training?.aiming ? video.fov * 0.65 : video.fov; camera.updateProjectionMatrix();
    let ratio = Math.min(window.devicePixelRatio, { low: 0.75, medium: 1, high: 1.5 }[video.quality]);
    if (video.resolution !== 'native') {
      const [targetWidth, targetHeight] = video.resolution.split('x').map(Number);
      ratio = Math.min(ratio, targetWidth! / width, targetHeight! / height);
    }
    renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = video.shadows && video.quality !== 'low';
    renderer.shadowMap.needsUpdate = true;
  }
  function updateCamera(delta: number) {
    const { state, previous } = player;
    const alpha = active ? clock.alpha : 1;
    const speed = Math.hypot(state.vx, state.vz);
    const bobEnabled = preferences.gameplay.headBob && !reducedMotion.matches;
    const target = active && state.grounded && speed > 0.3 && bobEnabled ? (speed > MOVEMENT.walkSpeed + 0.5 ? 0.024 : 0.016) : 0;
    bobAmount = bobEnabled ? bobAmount + (target - bobAmount) * Math.min(1, delta * 12) : 0;
    bobPhase = (bobPhase + speed * delta * 1.9) % (Math.PI * 2);
    camera.position.set(
      previous.x + (state.x - previous.x) * alpha,
      previous.y + (state.y - previous.y) * alpha + MOVEMENT.eyeHeight + Math.sin(bobPhase) * bobAmount,
      previous.z + (state.z - previous.z) * alpha,
    );
    camera.rotation.set(input.pitch, input.yaw, 0, 'YXZ');
    const fov = training?.aiming ? preferences.video.fov * 0.65 : preferences.video.fov;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    training?.update(active && training.playing ? delta : 0, alpha);
  }
  function emitDebug() {
    if (!import.meta.env.DEV || !debugEnabled) return;
    const state = player.state;
    callbacks.onDebug({
      x: state.x, y: state.y, z: state.z, speed: Math.hypot(state.vx, state.vz), grounded: state.grounded,
      yaw: input.yaw, pitch: input.pitch, cameraY: camera.position.y, fov: camera.fov, fps: measuredFps,
      calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, recoveries: player.recoveries,
      bots: training?.botDebug() ?? [],
    });
  }
  function frame(time: number) {
    const delta = lastTime ? Math.max(0, Math.min(0.1, (time - lastTime) / 1000)) : 0;
    lastTime = time;
    if (active) clock.advance(delta, step);
    updateCamera(delta);
    const interval = preferences.video.maxFps ? 1000 / preferences.video.maxFps : 0;
    if (interval && time - lastRender < interval - 0.5) return;
    lastRender = interval ? time - (time - lastRender) % interval : time;
    renderer.render(environment.scene, camera);
    renderedFrames++;
    if (import.meta.env.DEV && debugEnabled && time - debugTime >= 250) {
      measuredFps = renderedFrames * 1000 / Math.max(1, time - debugTime);
      emitDebug();
      debugTime = time; renderedFrames = 0;
    }
  }
  function visibilityChanged() {
    lastTime = 0; lastRender = 0; clock.reset();
    renderer.setAnimationLoop(document.hidden || failed ? null : frame);
  }
  function contextLost(event: Event) {
    event.preventDefault(); failed = true;
    input.release(); visibilityChanged(); callbacks.onError();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  document.addEventListener('visibilitychange', visibilityChanged);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  resize(); updateCamera(0); renderer.render(environment.scene, camera); visibilityChanged();
  return {
    resume: () => { if (!failed && !training?.ended) { training?.unlockAudio(); input.request(); } },
    pause: input.release,
    restart() { input.clear(); player.reset(); training?.reset(); input.yaw = spawn.yaw; input.pitch = 0; bobAmount = 0; bobPhase = 0; clock.reset(); step(false); step(false); updateCamera(0); },
    setPreferences(next: Preferences) { preferences = next; input.sensitivity = next.controls.sensitivity; training?.setPreferences(next); resize(); },
    setDebug(enabled: boolean) { debugEnabled = import.meta.env.DEV && enabled; debugTime = performance.now(); renderedFrames = 0; emitDebug(); },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect(); input.dispose();
      document.removeEventListener('visibilitychange', visibilityChanged);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      training?.dispose(); player.dispose(); environment.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}

export type PlayerScene = ReturnType<typeof createPlayerScene>;
