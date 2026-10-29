// Stylesheets are bundled by the web app (Vite); the server never imports renderer files.
declare module '*.css';
declare module '*.webp' { const src: string; export default src; }
