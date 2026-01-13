/**
 * Soundscape Registry
 *
 * Central registry for all available soundscape options.
 * To add a new soundscape:
 * 1. Add the audio file to ios/Igloo/ as .m4a format
 * 2. Add it to Xcode's "Copy Bundle Resources" build phase
 * 3. Add the SoundscapeId to types/index.ts
 * 4. Add the SoundscapeConfig here with available: true
 * 5. Rebuild the app (pod install && npx expo run:ios)
 *
 * See llm/SOUNDSCAPE_SYSTEM.md for full documentation.
 */

import type { SoundscapeId, SoundscapeConfig } from '@/types';

/**
 * Registry of all soundscape configurations.
 * Only soundscapes with available: true will be shown in the UI.
 */
export const SOUNDSCAPE_REGISTRY: Record<SoundscapeId, SoundscapeConfig> = {
  'ocean-waves': {
    id: 'ocean-waves',
    name: 'Ocean Waves',
    description: 'Gentle waves lapping on the shore',
    filename: 'ocean-waves',
    available: true,
  },
  'rain': {
    id: 'rain',
    name: 'Rain',
    description: 'Soft rainfall on leaves',
    filename: 'rain',
    available: false, // Not yet bundled
  },
  'forest': {
    id: 'forest',
    name: 'Forest',
    description: 'Birds and rustling leaves',
    filename: 'forest',
    available: false, // Not yet bundled
  },
  'white-noise': {
    id: 'white-noise',
    name: 'White Noise',
    description: 'Steady ambient noise',
    filename: 'whitenoise',
    available: false, // Not yet bundled
  },
  'campfire': {
    id: 'campfire',
    name: 'Campfire',
    description: 'Crackling fire sounds',
    filename: 'campfire',
    available: false, // Not yet bundled
  },
};

/** Default soundscape for new users */
export const DEFAULT_SOUNDSCAPE_ID: SoundscapeId = 'ocean-waves';

/** Default volume for new users (0.0 to 1.0) */
export const DEFAULT_VOLUME = 0.3;

/**
 * Get all available soundscapes (those with bundled audio files)
 */
export function getAvailableSoundscapes(): SoundscapeConfig[] {
  return Object.values(SOUNDSCAPE_REGISTRY).filter((s) => s.available);
}

/**
 * Get all soundscapes including unavailable ones (for showing "coming soon")
 */
export function getAllSoundscapes(): SoundscapeConfig[] {
  return Object.values(SOUNDSCAPE_REGISTRY);
}

/**
 * Get a specific soundscape config by ID
 */
export function getSoundscapeById(id: SoundscapeId): SoundscapeConfig {
  return SOUNDSCAPE_REGISTRY[id];
}

/**
 * Get the filename for a soundscape (without extension)
 */
export function getSoundscapeFilename(id: SoundscapeId): string {
  return SOUNDSCAPE_REGISTRY[id].filename;
}

/**
 * Check if a soundscape is available
 */
export function isSoundscapeAvailable(id: SoundscapeId): boolean {
  return SOUNDSCAPE_REGISTRY[id].available;
}
