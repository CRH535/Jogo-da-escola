export interface Preferences {
  profile: { name: string };
  video: {
    resolution: 'native' | '1920x1080' | '1600x900' | '1280x720';
    quality: 'low' | 'medium' | 'high';
    shadows: boolean;
    maxFps: 0 | 30 | 60 | 120;
    fov: number;
  };
  audio: { master: number; effects: number; music: number; interface: number; footsteps: number };
  controls: { sensitivity: number };
  gameplay: { headBob: boolean; tutorialCompleted: boolean };
  match: { map: 'neon-facility'; bots: number; difficulty: 'easy' | 'normal' | 'hard' };
}

export const PREFERENCES_KEY = 'neon-strike:preferences:v1';

export function defaultPreferences(): Preferences {
  return {
    profile: { name: 'Player' },
    video: { resolution: 'native', quality: 'medium', shadows: true, maxFps: 60, fov: 90 },
    audio: { master: 80, effects: 80, music: 40, interface: 60, footsteps: 80 },
    controls: { sensitivity: 1 },
    gameplay: { headBob: true, tutorialCompleted: false },
    match: { map: 'neon-facility', bots: 3, difficulty: 'normal' },
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function choice<T extends string | number>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}
function number(value: unknown, fallback: number, min: number, max: number, step = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Number((Math.round(Math.max(min, Math.min(max, value)) / step) * step).toFixed(2));
}
function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
export function normalizeName(value: unknown): string {
  if (typeof value !== 'string') return 'Player';
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 20).join('') || 'Player';
}

export function normalizePreferences(value: unknown): Preferences {
  const data = record(value);
  const video = record(data.video);
  const audio = record(data.audio);
  const controls = record(data.controls);
  const gameplay = record(data.gameplay);
  const match = record(data.match);
  const defaults = defaultPreferences();
  return {
    profile: { name: normalizeName(record(data.profile).name) },
    video: {
      resolution: choice(video.resolution, ['native', '1920x1080', '1600x900', '1280x720'], defaults.video.resolution),
      quality: choice(video.quality, ['low', 'medium', 'high'], defaults.video.quality),
      shadows: boolean(video.shadows, defaults.video.shadows),
      maxFps: choice(video.maxFps, [0, 30, 60, 120], defaults.video.maxFps),
      fov: number(video.fov, defaults.video.fov, 60, 110),
    },
    audio: {
      master: number(audio.master, defaults.audio.master, 0, 100),
      effects: number(audio.effects, defaults.audio.effects, 0, 100),
      music: number(audio.music, defaults.audio.music, 0, 100),
      interface: number(audio.interface, defaults.audio.interface, 0, 100),
      footsteps: number(audio.footsteps, defaults.audio.footsteps, 0, 100),
    },
    controls: { sensitivity: number(controls.sensitivity, 1, 0.1, 3, 0.1) },
    gameplay: {
      headBob: boolean(gameplay.headBob, true),
      tutorialCompleted: boolean(gameplay.tutorialCompleted, false),
    },
    match: {
      map: 'neon-facility',
      bots: number(match.bots, 3, 1, 7),
      difficulty: choice(match.difficulty, ['easy', 'normal', 'hard'], 'normal'),
    },
  };
}

export function loadPreferences(): Preferences {
  try {
    const data = record(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null'));
    return data.version === 1 ? normalizePreferences(data.preferences) : defaultPreferences();
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(preferences: Preferences): boolean {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, preferences: normalizePreferences(preferences) }));
    return true;
  } catch {
    return false;
  }
}
