export type CollageItem = {
  src: string;
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
  w: number; // px (auto scales on mobile)
  rot: number; // degrees
  op: number; // 0..1
  blur?: number; // px
  scale?: number;
  hideMobile?: boolean;
};

export type StickerItem = {
  src: string;
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
  w: number; // px
  rot: number; // degrees
  op: number; // 0..1
  scale?: number;
  hideMobile?: boolean;
};

/**
 * Background collage (messy cut‑and‑paste).
 * Add images in /public/collage, then add a new item here.
 */
export const COLLAGE: CollageItem[] = [
  { src: "/collage/scrapbook-love.jpg", x: 84, y: 18, w: 420, rot: 9, op: 0.42, blur: 0, hideMobile: true },
  { src: "/collage/vw-collage.jpg",      x: 92, y: 74, w: 480, rot: -7, op: 0.36, blur: 0, hideMobile: true },
  { src: "/collage/moodboard.jpg",       x: 16, y: 78, w: 520, rot: 7, op: 0.34, blur: 1, hideMobile: true },

  { src: "/collage/cake.jpg",            x: 10, y: 26, w: 360, rot: -10, op: 0.32, blur: 1 },
  { src: "/collage/dinner.jpg",          x: 72, y: 92, w: 360, rot: 8, op: 0.30, blur: 1, hideMobile: true },

  // Subtle “memory echoes” from your real photos
  { src: "/photos/2026-01-01-fireworks-at-16a-hang-trong/03.jpg", x: 20, y: 12, w: 420, rot: 10, op: 0.24, blur: 1 },
  { src: "/photos/2026-01-01-fireworks-at-16a-hang-trong/06.jpg", x: 88, y: 40, w: 380, rot: -12, op: 0.22, blur: 1, hideMobile: true },
];

/**
 * Stickers (icons). Files live in /public/stickers
 * Keep it minimal — 3–6 stickers is enough.
 */
export const STICKERS: StickerItem[] = [
  { src: "/stickers/film.svg",     x: 10, y: 62, w: 150, rot: -10, op: 0.85 },
  { src: "/stickers/cassette.svg", x: 92, y: 22, w: 140, rot: 12,  op: 0.78, hideMobile: true },
  { src: "/stickers/pin.svg",      x: 86, y: 86, w: 120, rot: -6,  op: 0.72, hideMobile: true },
  { src: "/stickers/vinyl.svg",    x: 56, y: 10, w: 120, rot: 8,   op: 0.62, hideMobile: true },
  { src: "/stickers/sticker_orange.svg", x: 18, y: 18, w: 140, rot: -8, op: 0.85, hideMobile: true },
];

