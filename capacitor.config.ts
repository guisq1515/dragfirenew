import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dragfire.app',
  appName: 'DragFire',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SocialLogin: {
      google: {
        webClientId: '724970175479-44l6ps8tevb4frh9vpbir25ovufag319.apps.googleusercontent.com'
      }
    },
    CapacitorHttp: {
      enabled: false
    }
  }
};

export default config;
