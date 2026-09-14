import RAPIER from '@dimforge/rapier3d-compat';
import type { ArenaMap, SpawnPoint } from '../../maps/types.js';

export const MOVEMENT = {
  step: 1 / 60, radius: 0.35, height: 1.8, eyeHeight: 1.62,
  walkSpeed: 6, sprintSpeed: 9, acceleration: 42, braking: 55, airAcceleration: 12,
  gravity: 20, jumpSpeed: 7.5, terminalSpeed: 35, skin: 0.01,
} as const;

export interface MovementInput { forward: number; right: number; yaw: number; sprint: boolean; jump: boolean }
export interface PlayerPose { x: number; y: number; z: number }
export interface PlayerState extends PlayerPose { vx: number; vy: number; vz: number; yaw: number; grounded: boolean }
const finiteAxis = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

export function createPlayerController(world: RAPIER.World, map: ArenaMap, spawn: SpawnPoint) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(MOVEMENT.height / 2 - MOVEMENT.radius, MOVEMENT.radius), body);
  const controller = world.createCharacterController(MOVEMENT.skin);
  controller.setMaxSlopeClimbAngle(Math.PI / 4);
  controller.setMinSlopeSlideAngle(Math.PI / 4);
  controller.enableSnapToGround(0.2);
  controller.enableAutostep(0.25, 0.2, false);
  const state: PlayerState = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: spawn.yaw, grounded: false };
  const previous: PlayerPose = { x: 0, y: 0, z: 0 };
  const desired = { x: 0, y: 0, z: 0 };
  const translation = { x: 0, y: 0, z: 0 };
  const solidOnly = (candidate: RAPIER.Collider) => !candidate.isSensor();
  let jumpHeld = false;
  let disposed = false;
  let recoveries = 0;

  function reset(nextSpawn: SpawnPoint = spawn) {
    const [x, y, z] = nextSpawn.position;
    Object.assign(state, { x, y: y + MOVEMENT.skin, z, vx: 0, vy: 0, vz: 0, yaw: nextSpawn.yaw, grounded: false });
    previous.x = state.x; previous.y = state.y; previous.z = state.z;
    body.setTranslation({ x, y: state.y + MOVEMENT.height / 2, z }, true);
    body.setNextKinematicTranslation(body.translation());
    world.propagateModifiedBodyPositionsToColliders();
    world.updateSceneQueries();
    jumpHeld = false;
  }
  reset();

  function beforeStep(input: MovementInput) {
    previous.x = state.x; previous.y = state.y; previous.z = state.z;
    const forward = finiteAxis(input.forward);
    const right = finiteAxis(input.right);
    const length = Math.max(1, Math.hypot(forward, right));
    if (Number.isFinite(input.yaw)) state.yaw = Math.atan2(Math.sin(input.yaw), Math.cos(input.yaw));
    const speed = input.sprint === true ? MOVEMENT.sprintSpeed : MOVEMENT.walkSpeed;
    const sin = Math.sin(state.yaw); const cos = Math.cos(state.yaw);
    const targetX = (right * cos - forward * sin) / length * speed;
    const targetZ = (-right * sin - forward * cos) / length * speed;
    const dx = targetX - state.vx; const dz = targetZ - state.vz;
    const change = Math.hypot(dx, dz);
    const acceleration = state.grounded ? (forward || right ? MOVEMENT.acceleration : MOVEMENT.braking) : MOVEMENT.airAcceleration;
    const factor = change ? Math.min(1, acceleration * MOVEMENT.step / change) : 0;
    state.vx += dx * factor; state.vz += dz * factor;
    const jump = input.jump === true;
    if (jump && !jumpHeld && state.grounded) { state.vy = MOVEMENT.jumpSpeed; state.grounded = false; }
    jumpHeld = jump;
    state.vy = state.grounded ? -2 : Math.max(-MOVEMENT.terminalSpeed, state.vy - MOVEMENT.gravity * MOVEMENT.step);
    desired.x = state.vx * MOVEMENT.step; desired.y = state.vy * MOVEMENT.step; desired.z = state.vz * MOVEMENT.step;
    controller.computeColliderMovement(collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, solidOnly);
    const movement = controller.computedMovement();
    // Contacts with another kinematic capsule can add separation motion; keep it within the speed budget.
    const horizontal = Math.hypot(movement.x, movement.z);
    if (horizontal > speed * MOVEMENT.step) {
      const limit = speed * MOVEMENT.step / horizontal;
      movement.x *= limit; movement.z *= limit;
    }
    const upward = state.vy > 0;
    state.grounded = controller.computedGrounded() && !upward;
    if (upward && movement.y < desired.y - 0.001) state.vy = 0;
    if (state.grounded) state.vy = -2;
    state.vx = movement.x / MOVEMENT.step; state.vz = movement.z / MOVEMENT.step;
    const position = body.translation();
    translation.x = position.x + movement.x;
    translation.y = position.y + movement.y;
    translation.z = position.z + movement.z;
    body.setNextKinematicTranslation(translation);
  }
  function afterStep() {
    const position = body.translation();
    state.x = position.x; state.y = position.y - MOVEMENT.height / 2; state.z = position.z;
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.z) || state.y < -8 || state.y > 24 ||
      Math.abs(state.x) > map.size[0] / 2 || Math.abs(state.z) > map.size[1] / 2) {
      recoveries++;
      reset();
    }
  }
  return {
    state, previous, body, collider, beforeStep, afterStep, reset,
    get recoveries() { return recoveries; },
    clearInput() { state.vx = 0; state.vz = 0; jumpHeld = false; },
    dispose() {
      if (disposed) return;
      disposed = true;
      world.removeCharacterController(controller);
      world.removeRigidBody(body);
    },
  };
}

export type PlayerController = ReturnType<typeof createPlayerController>;
