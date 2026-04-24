import { Motion } from '@capacitor/motion';

export interface IMUData {
  accel: { x: number, y: number, z: number };
  gyro: { alpha: number, beta: number, gamma: number };
  lateralG: number;
  longitudinalG: number;
  fusedHeading: number;
  timestamp: number;
}

class SensorFusionService {
  private currentData: IMUData = {
    accel: { x: 0, y: 0, z: 0 },
    gyro: { alpha: 0, beta: 0, gamma: 0 },
    lateralG: 0,
    longitudinalG: 0,
    fusedHeading: 0,
    timestamp: Date.now()
  };

  // Kalman Filter for Heading
  private Q = 0.1; // Process noise
  private R = 2.0; // Measurement noise
  private x = 0;   // State (Heading)
  private P = 1;   // Error covariance
  private K = 0;   // Kalman gain

  private listeners: ((data: IMUData) => void)[] = [];
  private isActive = false;
  private lastUpdate = Date.now();

  constructor() {}

  async start() {
    if (this.isActive) return;
    
    try {
      await Motion.addListener('accel', (event) => {
        const ax = event.acceleration.x / 9.81;
        const ay = event.acceleration.y / 9.81;
        const az = event.acceleration.z / 9.81;

        this.currentData.accel = { x: ax, y: ay, z: az };
        // Assuming Landscape Mount
        this.currentData.lateralG = ax; 
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
        
        // Update fused heading using alpha (Z-axis rotation)
        if (event.alpha !== null) {
          this.updateHeading(event.alpha);
        }
        
        this.notify();
      });

      this.isActive = true;
      console.log("Elite Sensor Fusion (Kalman Enabled) Started");
    } catch (e) {
      console.warn("Motion sensors not available", e);
    }
  }

  // Simple 1D Kalman Filter for Heading smoothing
  private updateHeading(measurement: number) {
    // Prediction
    this.P = this.P + this.Q;

    // Innovation (handle 360 wrap)
    let diff = measurement - this.x;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    // Update
    this.K = this.P / (this.P + this.R);
    this.x = this.x + this.K * diff;
    this.P = (1 - this.K) * this.P;

    // Wrap state
    if (this.x < 0) this.x += 360;
    if (this.x >= 360) this.x -= 360;

    this.currentData.fusedHeading = this.x;
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

  getHeading(): number {
    return this.currentData.fusedHeading;
  }
}

export const sensorFusion = new SensorFusionService();
