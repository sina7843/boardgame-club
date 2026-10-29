// Stylesheets are bundled by the web app (Vite); the server never imports renderer files.
declare module '*.css';
declare module '*.webp' { const src: string; export default src; }
// Vite's import.meta.glob (the renderer resolves art files by path from content-id-map.json).
interface ImportMeta { glob<T>(pattern: string, options: { eager: true; import: 'default' }): Record<string, T> }
