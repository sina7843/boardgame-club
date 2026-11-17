// Stylesheets are bundled by the web app (Vite); the server never imports renderer files.
declare module '*.css';
declare module '*.webp' { const src: string; export default src; }
declare module '*.png' { const src: string; export default src; }
interface ImportMeta { glob(pattern: string, opts: { eager: true; import: 'default' }): Record<string, string>; }
