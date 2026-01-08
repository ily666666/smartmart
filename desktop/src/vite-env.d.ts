/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_HOST: string;
  readonly VITE_API_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// QRCode 模块声明
declare module 'qrcode' {
  export function toDataURL(text: string, options?: object): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: object): Promise<void>;
  export function toString(text: string, options?: object): Promise<string>;
}
