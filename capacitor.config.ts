import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.spendix.app",
  appName: "Spendix",
  webDir: "out",

  server: {
    url: "https://spendix-app.vercel.app",
    cleartext: false,
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#0B0F14",
      androidSplashResourceName: "splash",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      style: "DARK",
      backgroundColor: "#0B0F14",
      overlaysWebView: false,
    },
  },
};

export default config;