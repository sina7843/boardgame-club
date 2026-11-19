// Stylesheets are bundled by the web app (Vite); the server never imports renderer files.
declare module '*.css';
declare module '*.webp' { const src: string; export default src; }
declare module '*.png' { const src: string; export default src; }
// Vite's import.meta.glob (card faces resolved by type key from ./art/sr-<key>.png).
interface ImportMeta { glob<T>(pattern: string, options: { eager: true; import: 'default' }): Record<string, T> }
