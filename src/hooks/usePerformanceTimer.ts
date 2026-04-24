import { useState, useEffect, useRef, useCallback } from 'react';
import { RunConfig, RunResult, GPSPoint, TelemetryConfig } from '../types';
import { calculateDistance } from '../lib/utils';
import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';
import { fetchElevationPoints } from '../services/googleMapsService';

// --- KALMAN FILTER ENGINE v1.0 ---
class KalmanFilter {
  x: number = 0; // State: Velocity (m/s)
  p: number = 1; // Estimation error covariance
  q: number = 0.1; // Process noise covariance (How much we trust the model)
  r: number = 1.2; // Measurement noise covariance (How much we trust GPS)

  constructor(initialVelocity: number, processNoise = 0.1, measurementNoise = 1.2) {
    this.x = initialVelocity;
    this.q = processNoise;
    this.r = measurementNoise;
  }

  // Prediction step using accelerometer
  predict(accel: number, dt: number) {
    this.x = this.x + accel * dt;
    this.p = this.p + this.q;
  }

  // Update step using GPS measurement
  update(z: number) {
    const k = this.p / (this.p + this.r); // Kalman gain
    this.x = this.x + k * (z - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }
}

export function usePerformanceTimer(
  telemetryConfig?: TelemetryConfig,
  userId?: string,
  isGuest = false
) {
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [distance, setDistance] = useState(0); // meters
  const [isRunning, setIsRunning] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gForce, setGForce] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'error'>('searching');
  const [lastPosition, setLastPosition] = useState<{ latitude: number, longitude: number } | null>(null);
  const [gpsSource, setGpsSource] = useState<'internal' | 'external'>('internal');
  const [gpsRefreshKey, setGpsRefreshKey] = useState(0);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const lastPointRef = useRef<GPSPoint | null>(null);
  const lastStoppedTimestampRef = useRef<number | null>(null);
  const pointsRef = useRef<GPSPoint[]>([]);
  const configRef = useRef<RunConfig | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const maxGRef = useRef(0);
  const rolloutStartedRef = useRef(false);
  const accelerometerRef = useRef<{ x: number, y: number, z: number } | null>(null);
  const linearAccelRef = useRef<number>(0);
  const gLongRef = useRef<number>(0);
  const gLatRef = useRef<number>(0);
  const lastPositionRef = useRef<{ latitude: number, longitude: number } | null>(null);
  const currentRotationRef = useRef<{ alpha: number, beta: number, gamma: number }>({ alpha: 0, beta: 0, gamma: 0 });
  const activeAxisRef = useRef<'x' | 'y' | 'z' | null>(null);
  const daRef = useRef<number | undefined>(undefined);
  
  // Advanced Diagnostics
  const kalmanRef = useRef<KalmanFilter | null>(null);
  const wheelSpinCounterRef = useRef(0);
  const wheelSpinDetectedRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const isReadyRef = useRef(false);
  const isWaitingRef = useRef(false);
  const isRunningRef = useRef(false);

  const distanceRef = useRef(0);
  const lastGpsSpeedRef = useRef(0);

  const stopRun = useCallback(async (finalTime: number) => {
    if (!configRef.current) return;

    setIsRunning(false);
    isRunningRef.current = false;
    setIsReady(false);
    isReadyRef.current = false;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const speeds = pointsRef.current.map(p => p.speed * 3.6);
    const maxSpeed = Math.max(...speeds, 0);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    
    const accuracies = pointsRef.current.map(p => p.accuracy).filter((a): a is number => a !== null);
    const avgAccuracy = accuracies.length > 0 ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : null;

    let slope = 0;
    let isValidSlope = true;
    let verifiedDistance = distanceRef.current;
    let slopeCorrectedTime = finalTime; 
    let seaLevelTime = finalTime;

    if (pointsRef.current.length >= 2) {
      const start = pointsRef.current[0];
      const end = pointsRef.current[pointsRef.current.length - 1];
      
      try {
        const elevations = await fetchElevationPoints(
          [{ lat: start.latitude, lng: start.longitude }, { lat: end.latitude, lng: end.longitude }],
          userId,
          isGuest
        );

        if (elevations.length === 2) {
          const startElev = elevations[0].elevation;
          const endElev = elevations[1].elevation;
          const elevationChange = endElev - startElev;
          slope = (elevationChange / distanceRef.current) * 100;
          isValidSlope = slope >= -1.0;
          verifiedDistance = Math.sqrt(Math.pow(distanceRef.current, 2) + Math.pow(elevationChange, 2));
          slopeCorrectedTime = finalTime / (1 + (slope * 0.015));
        } else {
          if (start.altitude !== null && end.altitude !== null) {
            const elevationChange = end.altitude - start.altitude;
            slope = (elevationChange / distanceRef.current) * 100;
            isValidSlope = slope >= -1.0;
          }
        }

        // DA CORRECTION (Sea Level Equivalent)
        if (telemetryConfig?.daCorrectionEnabled && daRef.current !== undefined) {
          // Standard DA Compensation: ~3% power per 1000ft DA
          // We apply the inverse to the time: TimeSeaLevel = Time / (1 + (DA/1000 * 0.03))
          const daFactor = 1 + (daRef.current / 1000) * 0.03;
          seaLevelTime = finalTime / daFactor;
        }

      } catch (e) {
        console.error("Failed to verify elevation:", e);
      }
    }

    const fetchDA = async (lat: number, lon: number) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,surface_pressure&forecast_days=1`);
        const data = await response.json();
        if (data.current) {
          const tempC = data.current.temperature_2m;
          const pressureHpa = data.current.surface_pressure;
          const pressureAlt = (145366 * (1 - Math.pow(pressureHpa / 1013.25, 0.190284)));
          const isaTemp = 15 - (1.98 * (pressureAlt / 1000));
          const da = pressureAlt + (118.8 * (tempC - isaTemp));
          daRef.current = Math.round(da);
        }
      } catch (e) {}
    };

    if (pointsRef.current.length > 0) {
      fetchDA(pointsRef.current[0].latitude, pointsRef.current[0].longitude);
    }

    const result: RunResult = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      config: { ...configRef.current },
      time: finalTime,
      maxSpeed,
      avgSpeed,
      distance: verifiedDistance,
      path: [...pointsRef.current],
      slope,
      isValidSlope,
      slopeCorrectedTime,
      seaLevelTime,
      wheelSpinDetected: wheelSpinDetectedRef.current,
      fusionUsed: telemetryConfig?.fusionAlgorithm || 'linear',
      maxG: maxGRef.current,
      avgAccuracy: avgAccuracy ?? null,
      da: daRef.current ?? null,
      location: pointsRef.current.length > 0 ? {
        latitude: pointsRef.current[0].latitude,
        longitude: pointsRef.current[0].longitude
      } : null
    };

    setLastResult(result);
    configRef.current = null;
    wheelSpinDetectedRef.current = false;
    wheelSpinCounterRef.current = 0;
  }, [userId, isGuest, telemetryConfig]); 

  const manualStart = useCallback(() => {
    if (!configRef.current || (configRef.current.mode !== 'free' && configRef.current.mode !== 'trip')) return;
    setIsWaiting(false);
    isWaitingRef.current = false;
    setIsRunning(true);
    isRunningRef.current = true;
    startTimeRef.current = Date.now();
    pointsRef.current = [];
    distanceRef.current = 0;
    setDistance(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      if (startTimeRef.current) setElapsedTime((Date.now() - startTimeRef.current) / 1000);
    }, 50);
  }, []);

  const manualStop = useCallback(() => {
    if (!isRunningRef.current || !startTimeRef.current) return;
    const finalTime = (Date.now() - startTimeRef.current) / 1000;
    stopRun(finalTime);
  }, [stopRun]);

  const startRun = useCallback((config: RunConfig) => {
    configRef.current = config;
    setIsWaiting(true);
    isWaitingRef.current = true;
    setIsReady(false);
    isReadyRef.current = false;
    setIsRunning(false);
    isRunningRef.current = false;
    setDistance(0);
    distanceRef.current = 0;
    setElapsedTime(0);
    setLastResult(null);
    setGForce(0);
    maxGRef.current = 0;
    rolloutStartedRef.current = false;
    pointsRef.current = [];
    lastPointRef.current = null;
    lastStoppedTimestampRef.current = null;
    kalmanRef.current = new KalmanFilter(0, 0.2, 1.0);
    wheelSpinDetectedRef.current = false;
    wheelSpinCounterRef.current = 0;
  }, []);

  useEffect(() => {
    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
      interval: 500,
      minimumUpdateInterval: 0
    };
    let watchId: string | null = null;
    let motionListener: any = null;
    
    const initSensors = async () => {
      try {
        const geoPerms = await Geolocation.requestPermissions();
        if (geoPerms.location !== 'granted') {
          setError("Permissão de localização negada.");
          return;
        }

        motionListener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.accelerationIncludingGravity;
          const { x: lx, y: ly, z: lz } = event.acceleration || { x: 0, y: 0, z: 0 };
          const rotation = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };
          
          currentRotationRef.current = { alpha: Math.abs(rotation.alpha || 0), beta: Math.abs(rotation.beta || 0), gamma: Math.abs(rotation.gamma || 0) };
          accelerometerRef.current = { x: x || 0, y: y || 0, z: z || 0 };
          
          let currentAccelMag = 0;
          const mode = telemetryConfig?.mountingAxis || 'auto';
          
          if (isRunningRef.current && activeAxisRef.current && mode === 'auto') {
            const axisValue = activeAxisRef.current === 'x' ? lx : activeAxisRef.current === 'y' ? ly : lz;
            currentAccelMag = Math.abs(axisValue || 0);
          } else if (mode !== 'auto' && mode !== 'all') {
            const axisValue = mode === 'x' ? lx : mode === 'y' ? ly : lz;
            currentAccelMag = Math.abs(axisValue || 0);
          } else {
            currentAccelMag = Math.sqrt((lx || 0)**2 + (ly || 0)**2 + (lz || 0)**2);
          }

          const accelGain = telemetryConfig?.fusionAccelGain ?? 1.0;
          currentAccelMag *= accelGain;
          const rotThreshold = telemetryConfig?.rotationThreshold || 60; 
          const isRotating = currentRotationRef.current.alpha > rotThreshold || currentRotationRef.current.beta > rotThreshold || currentRotationRef.current.gamma > rotThreshold;
          
          if (isRotating) linearAccelRef.current = 0;
          else {
            const noiseFloor = telemetryConfig?.noiseFloor || 0.05;
            linearAccelRef.current = currentAccelMag > noiseFloor ? currentAccelMag : 0;
          }
          
          gLongRef.current = (ly || 0) / 9.81;
          gLatRef.current = (lx || 0) / 9.81;
          
          const currentTotalG = Math.abs(currentAccelMag / 9.81);
          if (isRunningRef.current) {
            setGForce(currentTotalG);
            if (currentTotalG > maxGRef.current) maxGRef.current = currentTotalG;
            
            // Kalman Prediction Step (50Hz)
            if (kalmanRef.current && telemetryConfig?.fusionAlgorithm === 'kalman') {
              kalmanRef.current.predict(linearAccelRef.current, 0.02);
              setCurrentSpeed(kalmanRef.current.x * 3.6);
            }
          }
          
          if (isReadyRef.current && !isRunningRef.current && configRef.current) {
            const totalG = Math.sqrt((x || 0)**2 + (y || 0)**2 + (z || 0)**2) / 9.81;
            const isStandingStart = configRef.current.startSpeed === 0 || configRef.current.startSpeed === undefined;
            const threshold = telemetryConfig?.motionSensitivity || 1.6;
            
            if (isStandingStart && totalG > threshold) {
              if ((telemetryConfig?.mountingAxis || 'auto') === 'auto') {
                const absX = Math.abs(lx || 0), absY = Math.abs(ly || 0), absZ = Math.abs(lz || 0);
                if (absX > absY && absX > absZ) activeAxisRef.current = 'x';
                else if (absY > absX && absY > absZ) activeAxisRef.current = 'y';
                else activeAxisRef.current = 'z';
              }
              setIsWaiting(false);
              isWaitingRef.current = false;
              setIsRunning(true);
              isRunningRef.current = true;
              const now = Date.now();
              if (configRef.current.useRollout) { rolloutStartedRef.current = true; startTimeRef.current = null; }
              else startTimeRef.current = now;
              
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              let lastTick = Date.now();
              timerIntervalRef.current = window.setInterval(() => {
                const now = Date.now();
                const dt = (now - lastTick) / 1000;
                lastTick = now;
                if (startTimeRef.current) setElapsedTime((now - startTimeRef.current) / 1000);
                
                // --- LINEAR FUSION (Legacy Fallback) ---
                if (telemetryConfig?.fusionAlgorithm !== 'kalman') {
                  if (isRunningRef.current && linearAccelRef.current > 0.1 && (now - (startTimeRef.current || now)) > 300) {
                    setCurrentSpeed(prev => {
                      const deltaV = (linearAccelRef.current * 0.02) * 3.6;
                      const dampenedDeltaV = deltaV * 0.2;
                      const newSpeed = prev + dampenedDeltaV;
                      const maxAllowed = lastGpsSpeedRef.current + 5;
                      const minAllowed = Math.max(0, lastGpsSpeedRef.current - 5);
                      return Math.min(maxAllowed, Math.max(minAllowed, newSpeed));
                    });
                  }
                }
              }, 20); 
            }
          }
        });

        if (gpsSource === 'internal') {
          watchId = await Geolocation.watchPosition(options, (position, err) => {
            if (err) { setGpsStatus('error'); return; }
            if (!position) return;
            setGpsStatus('active');
            const { latitude, longitude, speed, accuracy, altitude, heading } = position.coords;
            setCurrentHeading(heading ?? null);
            
            let calculatedSpeed = speed;
            if (calculatedSpeed === null && lastPointRef.current) {
              const d = calculateDistance(lastPointRef.current, { latitude, longitude } as any), t = (position.timestamp - lastPointRef.current.timestamp) / 1000;
              if (t > 0) calculatedSpeed = d / t;
            }
            const currentPoint: GPSPoint = { latitude, longitude, altitude: altitude, speed: calculatedSpeed || 0, accuracy: accuracy, timestamp: position.timestamp, gLong: gLongRef.current, gLat: gLatRef.current };
            
            setAccuracy(accuracy);
            setLastPosition({ latitude, longitude });
            const speedKmh = (calculatedSpeed || 0) * 3.6;
            
            // --- WHEEL SPIN DETECTION ---
            if (isRunningRef.current && telemetryConfig?.wheelSpinDetectionEnabled && lastPointRef.current) {
              const dt = (position.timestamp - lastPointRef.current.timestamp) / 1000;
              if (dt > 0) {
                const gpsAccel = (currentPoint.speed - lastPointRef.current.speed) / dt;
                const gpsG = gpsAccel / 9.81;
                const measuredG = linearAccelRef.current / 9.81;
                
                // If physical G is much higher than GPS-derived G, the wheels are spinning
                if (measuredG > gpsG + 0.35) {
                  wheelSpinCounterRef.current++;
                  if (wheelSpinCounterRef.current > 3) wheelSpinDetectedRef.current = true;
                } else {
                  wheelSpinCounterRef.current = Math.max(0, wheelSpinCounterRef.current - 1);
                }
              }
            }

            // --- SPEED FUSION UPDATE ---
            if (telemetryConfig?.fusionAlgorithm === 'kalman' && kalmanRef.current) {
               kalmanRef.current.update(calculatedSpeed || 0);
               setCurrentSpeed(kalmanRef.current.x * 3.6);
            } else {
              setCurrentSpeed(prev => {
                if (calculatedSpeed === null) return speedKmh;
                const gpsWeight = telemetryConfig?.fusionGpsWeight ?? 0.95;
                if (speedKmh < 0.5) return 0;
                if (Math.abs(prev - speedKmh) > 20) return speedKmh; 
                return (prev * (1 - gpsWeight)) + (speedKmh * gpsWeight);
              });
            }
            
            lastGpsSpeedRef.current = speedKmh;

            const config = configRef.current;
            if (!config) { lastPointRef.current = currentPoint; return; }

            if (isRunningRef.current) {
              let p = 0;
              if (config.mode === 'speed') p = (speedKmh / config.target) * 100;
              else if (config.mode === 'distance') p = (distanceRef.current / config.target) * 100;
              setProgress(Math.min(100, Math.max(0, p)));
            } else setProgress(0);

            if (config.mode === 'free') {
              if (isRunningRef.current) {
                pointsRef.current.push(currentPoint);
                if (lastPointRef.current) {
                   const dPos = calculateDistance(lastPointRef.current, currentPoint), newDist = distanceRef.current + dPos;
                   distanceRef.current = newDist; setDistance(newDist);
                }
              }
              lastPointRef.current = currentPoint; return;
            }

            if (isWaitingRef.current && !isRunningRef.current) {
              const isStandingStart = config.startSpeed === 0 || config.startSpeed === undefined;
              if (isStandingStart) {
                if (speedKmh < 1.2) { lastStoppedTimestampRef.current = position.timestamp; if (!isReadyRef.current) { setIsReady(true); isReadyRef.current = true; } }
                if (isReadyRef.current && speedKmh >= 1.8) {
                  setIsWaiting(false); isWaitingRef.current = false; setIsRunning(true); isRunningRef.current = true;
                  const lastStopped = lastStoppedTimestampRef.current || (position.timestamp - 500);
                  if (config.useRollout) { rolloutStartedRef.current = true; startTimeRef.current = null; }
                  else startTimeRef.current = lastStopped;
                  pointsRef.current = [currentPoint]; distanceRef.current = 0; setDistance(0);
                  if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  timerIntervalRef.current = window.setInterval(() => {
                    const now = Date.now(); if (startTimeRef.current) setElapsedTime((now - startTimeRef.current) / 1000);
                  }, 20);
                }
              } else if (speedKmh >= config.startSpeed) {
                setIsWaiting(false); isWaitingRef.current = false; setIsRunning(true); isRunningRef.current = true;
                startTimeRef.current = position.timestamp; pointsRef.current = [currentPoint]; distanceRef.current = 0; setDistance(0);
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = window.setInterval(() => {
                  const now = Date.now(); if (startTimeRef.current) setElapsedTime((now - startTimeRef.current) / 1000);
                }, 20);
              }
            }

            if (isRunningRef.current) {
              pointsRef.current.push(currentPoint);
              if (lastPointRef.current) {
                const timeDelta = (currentPoint.timestamp - lastPointRef.current.timestamp) / 1000, dPos = calculateDistance(lastPointRef.current, currentPoint);
                const avgSpeedMs = (currentPoint.speed + lastPointRef.current.speed) / 2, dSpeed = avgSpeedMs * timeDelta;
                const d = (accuracy && accuracy < 15) ? (dSpeed * 0.9 + dPos * 0.1) : dPos;
                const newDist = distanceRef.current + d;
                distanceRef.current = newDist; setDistance(newDist);
                if (rolloutStartedRef.current && !startTimeRef.current && newDist >= 0.3048) { startTimeRef.current = currentPoint.timestamp; rolloutStartedRef.current = false; }
                if (config.mode === 'distance' && newDist >= config.target) { stopRun((currentPoint.timestamp - (startTimeRef.current || 0)) / 1000); return; }
                if (config.mode === 'speed' && speedKmh >= config.target) { stopRun((currentPoint.timestamp - (startTimeRef.current || 0)) / 1000); return; }
              }
            }
            lastPointRef.current = currentPoint;
          });
        }
      } catch (err: any) { setError(err.message || "Erro ao iniciar sensores."); }
    };
    initSensors();
    return () => { if (motionListener) motionListener.remove(); if (watchId) Geolocation.clearWatch({ id: watchId }); if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [stopRun, gpsSource, gpsRefreshKey, telemetryConfig]); 

  const reset = () => {
    setIsRunning(false); isRunningRef.current = false; setIsWaiting(false); isWaitingRef.current = false; setIsReady(false); isReadyRef.current = false;
    lastStoppedTimestampRef.current = null; setDistance(0); distanceRef.current = 0; setElapsedTime(0); setProgress(0); setLastResult(null);
    setGForce(0); maxGRef.current = 0; rolloutStartedRef.current = false; configRef.current = null; activeAxisRef.current = null;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    kalmanRef.current = null;
    wheelSpinDetectedRef.current = false;
    wheelSpinCounterRef.current = 0;
  };
  const setMockResult = (result: RunResult) => { setLastResult(result); };
  const requestPermission = useCallback(() => {
    setError(null); navigator.geolocation.getCurrentPosition(() => {}, (err) => {
      if (err.code === err.TIMEOUT) return;
      let msg = err.message; if (err.code === err.PERMISSION_DENIED) msg = "Permissão de localização negada.";
      else if (err.code === err.POSITION_UNAVAILABLE) msg = "Sinal de GPS indisponível.";
      setError(msg);
    }, { enableHighAccuracy: true, timeout: 5000 });
  }, []);
  const refreshGPS = useCallback(() => { setGpsRefreshKey(prev => prev + 1); requestPermission(); }, [requestPermission]);
  return { currentSpeed, distance, isRunning, isWaiting, isReady, progress, elapsedTime, gForce, lastResult, error, accuracy, gpsStatus, lastPosition, currentLat: lastPosition?.latitude ?? null, currentLng: lastPosition?.longitude ?? null, currentHeading, startRun, manualStart, manualStop, reset, setMockResult, requestPermission, refreshGPS, gpsSource, setGpsSource };
}
