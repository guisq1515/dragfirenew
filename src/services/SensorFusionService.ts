import { Motion } from '@capacitor/motion';

export interface IMUData {
  accel: { x: number, y: number, z: number };
  gyro: { alpha: number, beta: number, gamma: number };
  lateralG: number;
  longitudinalG: number;
  timestamp: number;
}

class SensorFusionService {
  private currentData: IMUData = {
    accel: { x: 0, y: 0, z: 0 },
    gyro: { alpha: 0, beta: 0, gamma: 0 },
    lateralG: 0,
    longitudinalG: 0,
    timestamp: Date.now()
  };

  private listeners: ((data: IMUData) => void)[] = [];
  private isActive = false;

  constructor() {}

  async start() {
    if (this.isActive) return;
    
    try {
      // Permission check is handled by Capacitor internally or should be requested if needed
      await Motion.addListener('accel', (event) => {
        // Convert to Gs (approx 9.81 m/s^2)
        const ax = event.acceleration.x / 9.81;
        const ay = event.acceleration.y / 9.81;
        const az = event.acceleration.z / 9.81;

        // Simple filtering to get Lateral/Longitudinal based on common phone orientations
        // This assumes phone is flat or vertical in a mount. 
        // For professional use, we would need a calibration step.
        this.currentData.accel = { x: ax, y: ay, z: az };
        this.currentData.lateralG = ax; // Typical for landscape mount
        this.currentData.longitudinalG = ay;
        this.currentData.timestamp = Date.now();
        
        this.notify();
      });

      await Motion.addListener('orientation', (event) => {
        this.currentData.gyro = { 
          alpha: event.alpha, 
          beta: event.beta, 
          gamma: event.gamma 
        };
        this.notify();
      });

      this.isActive = true;
      console.log("Sensor Fusion Service Started");
    } catch (e) {
      console.warn("Motion sensors not available on this device", e);
    }
  }

  stop() {
    Motion.removeAllListeners();
    this.isActive = false;
  }

  private notify() {
    this.listeners.forEach(l => l({ ...this.currentData }));
  }

  addListener(callback: (data: IMUData) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  getCurrentG(): { lateral: number, longitudinal: number } {
    return { 
      lateral: this.currentData.lateralG, 
      longitudinal: this.currentData.longitudinalG 
    };
  }
}

export const sensorFusion = new SensorFusionService();
