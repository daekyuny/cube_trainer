// Demo playback: multiples of the normal turn time (260 ms, slow 650 ms).
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
