// Excalidraw loads its fonts from EXCALIDRAW_ASSET_PATH, or from a CDN when it's unset. drawui is
// local-first, so the fonts are copied into the build (scripts/copy-fonts.ts) and served from here.
// Excalidraw builds its font list when its module is evaluated, so every module that imports
// Excalidraw imports this one first. ES modules evaluate in import order, and the CSP allows no
// inline script to set it earlier.
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

window.EXCALIDRAW_ASSET_PATH = `${location.origin}/`;

export {};
