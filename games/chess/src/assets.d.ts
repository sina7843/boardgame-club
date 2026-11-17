// Stylesheets are bundled by the web app (Vite); the server never imports renderer files.
declare module '*.css';
declare module '*.webp' { const src: string; export default src; }
// Vite's import.meta.glob (the web app bundles the renderer; the server never imports pieces.tsx).
interface ImportMeta { glob: (pattern: string, opts: { eager: true; query: '?url'; import: 'default' }) => Record<string, string> }
