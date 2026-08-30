/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DRIVE_FILE_ID?: string;
  readonly VITE_DRIVE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
