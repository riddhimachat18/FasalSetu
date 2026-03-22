/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_API_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_GOOGLE_AI_API_KEY: string;
  readonly VITE_WEATHER_API_KEY: string;
  readonly VITE_SOIL_API_URL: string;
  readonly VITE_ENABLE_VOICE_FEATURES: string;
  readonly VITE_ENABLE_VIDEO_FEATURES: string;
  readonly VITE_ENABLE_GEMINI_AI: string;
  readonly VITE_ENABLE_FIREBASE: string;
  readonly VITE_ENABLE_ADVANCED_ANALYTICS: string;
  readonly VITE_ENABLE_CRISIS_DETECTION: string;
  readonly VITE_ENABLE_CHIRP3_HD_VOICES: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_DEBUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
