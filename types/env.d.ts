/// <reference types="vite/client" />

/**
 * Vite 环境变量类型定义
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_APP_TITLE?: string;
  readonly VITE_TENANT_ENABLED?: string;
  readonly VITE_AI_ENABLED?: string;
  readonly VITE_OIDC_ENABLED?: string;
  readonly VITE_MOCK_ENABLED?: string;
  readonly VITE_DYNAMIC_ROUTES_ENABLED?: string;
  readonly VITE_MEDIA_WEBRTC_BASE_URL?: string;
  readonly VITE_MEDIA_HLS_BASE_URL?: string;
  readonly VITE_MEDIA_RTSP_BASE_URL?: string;
  readonly VITE_MEDIA_PLAYBACK_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_INFO__: {
  pkg: {
    name: string;
    version: string;
  };
  buildTimestamp: number;
};
