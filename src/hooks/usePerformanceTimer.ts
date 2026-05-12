import { useState, useEffect, useRef, useCallback } from 'react';
import { RunConfig, RunResult, GPSPoint, TelemetryConfig } from '../types';
import { calculateDistance, calculateBearing } from '../lib/utils';
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
  const launchSignRef = useRef<number>(1);
  const wheelSpinCounterRef = useRef(0);
  const wheelSpinDetectedRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settlingCountdown, setSettlingCountdown] = useState(0);
  const isReadyRef = useRef(false);
  const isSettlingRef = useRef(false);
  const isWaitingRef = useRef(false);
  const isRunningRef = useRef(false);
  const settlingTimerRef = useRef<number | null>(null);

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

    if (pointsRef.current.length >= 3) {
      const start = pointsRef.current[0];
      const mid = pointsRef.current[Math.floor(pointsRef.current.length / 2)];
      const end = pointsRef.current[pointsRef.current.length - 1];
      
      try {
        const elevations = await fetchElevationPoints(
          [
            { lat: start.latitude, lng: start.longitude }, 
            { lat: mid.latitude, lng: mid.longitude },
            { lat: end.latitude, lng: end.longitude }
          ],
          userId,
          isGuest
        );
        
        // Use 3 points to ensure we capture the profile even if it's undulating
        if (elevations.length >= 2) {
          const startElev = elevations[0].elevation;
          const endElev = elevations[elevations.length - 1].elevation;
          const elevationChange = endElev - startElev;
          
          // Calculate Net Slope
          slope = (elevationChange / distanceRef.current) * 100;
          isValidSlope = slope >= -1.0;
          verifiedDistance = Math.sqrt(Math.pow(distanceRef.current, 2) + Math.pow(elevationChange, 2));
          slopeCorrectedTime = finalTime / (1 + (slope * 0.015));
        } else {
          // Fallback to GPS altitude if APIs fail
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

    const generatedSerial = `DF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const result: RunResult = {
      id: crypto.randomUUID(),
      runSerial: generatedSerial,
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
    launchSignRef.current = 1;
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
          let signedAccel = 0;
          const mode = telemetryConfig?.mountingAxis || 'auto';
          
          if (isRunningRef.current && activeAxisRef.current) {
            const axisValue = activeAxisRef.current === 'x' ? lx : activeAxisRef.current === 'y' ? ly : lz;
            signedAccel = (axisValue || 0) * launchSignRef.current;
            currentAccelMag = Math.abs(signedAccel);
          } else if (mode !== 'auto' && mode !== 'all') {
            const axisValue = mode === 'x' ? lx : mode === 'y' ? ly : lz;
            signedAccel = axisValue || 0;
            currentAccelMag = Math.abs(signedAccel);
          } else {
            currentAccelMag = Math.sqrt((lx || 0)**2 + (ly || 0)**2 + (lz || 0)**2);
            signedAccel = currentAccelMag; // Fallback to magnitude if no axis yet
          }

          const accelGain = telemetryConfig?.fusionAccelGain ?? 1.0;
          currentAccelMag *= accelGain;
          signedAccel *= accelGain;

          const rotThreshold = telemetryConfig?.rotationThreshold || 60; 
          const isRotating = currentRotationRef.current.alpha > rotThreshold || currentRotationRef.current.beta > rotThreshold || currentRotationRef.current.gamma > rotThreshold;
          
          if (isRotating) {
            linearAccelRef.current = 0;
          } else {
            const noiseFloor = telemetryConfig?.noiseFloor || 0.05;
            // Use signed acceleration for prediction, but keep magnitude for noise filtering
            linearAccelRef.current = currentAccelMag > noiseFloor ? signedAccel : 0;
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
                if (absX > absY && absX > absZ) {
                  activeAxisRef.current = 'x';
                  launchSignRef.current = (lx || 0) > 0 ? 1 : -1;
                } else if (absY > absX && absY > absZ) {
                  activeAxisRef.current = 'y';
                  launchSignRef.current = (ly || 0) > 0 ? 1 : -1;
                } else {
                  activeAxisRef.current = 'z';
                  launchSignRef.current = (lz || 0) > 0 ? 1 : -1;
                }
              } else {
                // Fixed axis mode
                const mode = telemetryConfig?.mountingAxis;
                const axisValue = mode === 'x' ? lx : mode === 'y' ? ly : lz;
                launchSignRef.current = (axisValue || 0) > 0 ? 1 : -1;
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
                
                if (startTimeRef.current) {
                  setElapsedTime((now - startTimeRef.current) / 1000);
                  
                  // --- HIGH-PRECISION DISTANCE INTEGRATION (Dead Reckoning) ---
                  // Distance = Speed * dt + 0.5 * Accel * dt^2
                  const currentSpeedMs = (kalmanRef.current?.x || (currentSpeed / 3.6));
                  const accel = linearAccelRef.current;
                  const deltaD = (currentSpeedMs * dt) + (0.5 * accel * dt * dt);
                  
                  if (deltaD > 0) {
                    distanceRef.current += deltaD;
                    setDistance(distanceRef.current);
                    
                    // Anticipatory Finish Detection (Check between GPS updates)
                    const config = configRef.current;
                    if (config?.mode === 'distance' && distanceRef.current >= config.target) {
                      const finalTime = (now - (startTimeRef.current || now)) / 1000;
                      stopRun(finalTime);
                    }
                  }
                }
                
                // --- LINEAR FUSION (Legacy Fallback for Speed) ---
                if (telemetryConfig?.fusionAlgorithm !== 'kalman') {
                  if (isRunningRef.current && Math.abs(linearAccelRef.current) > 0.1 && (now - (startTimeRef.current || now)) > 300) {
                    setCurrentSpeed(prev => {
                      const deltaV = (linearAccelRef.current * dt) * 3.6;
                      const dampenedDeltaV = deltaV * 0.2;
                      const newSpeed = prev + dampenedDeltaV;
                      const maxAllowed = lastGpsSpeedRef.current + 10;
                      const minAllowed = Math.max(0, lastGpsSpeedRef.current - 10);
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
            const { latitude, longitude, speed, accuracy, altitude, heading: systemHeading } = position.coords;
            let calculatedSpeed = speed;
            
            // Xiaomi/Android Fallback: If system reports 0 or null but we moved, calculate from distance
            if ((calculatedSpeed === null || calculatedSpeed <= 0.05) && lastPointRef.current) {
              const d = calculateDistance(lastPointRef.current, { latitude, longitude } as any);
              const t = (position.timestamp - lastPointRef.current.timestamp) / 1000;
              
              if (t > 0 && t < 3) { // Only fallback if update is frequent enough
                const speedFromDist = d / t;
                // If moved more than 1.5m and calculated speed is > 2km/h, trust the calculation
                if (d > 1.5 && speedFromDist > 0.5) {
                  calculatedSpeed = speedFromDist;
                }
              }
            }
            
            const currentPoint: GPSPoint = { latitude, longitude, altitude: altitude, speed: calculatedSpeed || 0, accuracy: accuracy, timestamp: position.timestamp, gLong: gLongRef.current, gLat: gLatRef.current };
            const speedKmh = (calculatedSpeed || 0) * 3.6;
            
            // Smart Heading Logic (Waze-style)
            if (speedKmh > 10 && lastPositionRef.current) {
              const distMoved = calculateDistance(lastPositionRef.current, { latitude, longitude });
              if (distMoved > 2) {
                const gpsBearing = calculateBearing(lastPositionRef.current, { latitude, longitude });
                // Smooth with system heading if available, or just use GPS
                setCurrentHeading(prev => {
                   if (prev === null) return gpsBearing;
                   let diff = gpsBearing - prev;
                   if (diff > 180) diff -= 360;
                   if (diff < -180) diff += 360;
                   return (prev + diff * 0.3 + 360) % 360; // Smoothing
                });
              }
            } else if (systemHeading !== null) {
              // Low speed: use system heading but with heavy smoothing to avoid "gyro bugs"
              setCurrentHeading(prev => {
                if (prev === null) return systemHeading;
                let diff = systemHeading - prev;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                return (prev + diff * 0.1 + 360) % 360;
              });
            }
            
            setAccuracy(accuracy);
            setLastPosition({ latitude, longitude });
            lastPositionRef.current = { latitude, longitude };
            
            // --- WHEEL SPIN DETECTION ---
            if (isRunningRef.current && telemetryConfig?.wheelSpinDetectionEnabled && lastPointRef.current) {
              const dt = (position.timestamp - lastPointRef.current.timestamp) / 1000;
              if (dt > 0) {
                const gpsAccel = (currentPoint.speed - lastPointRef.current.speed) / dt;
                const gpsG = gpsAccel / 9.81;
                const measuredG = linearAccelRef.current / 9.81;
                
                if (measuredG > gpsG + 0.35) {
                  wheelSpinCounterRef.current++;
                  if (wheelSpinCounterRef.current > 3) wheelSpinDetectedRef.current = true;
                } else {
                  wheelSpinCounterRef.current = Math.max(0, wheelSpinCounterRef.current - 1);
                }
              }
            }

            // --- SPEED FUSION UPDATE WITH IMU ASSISTANCE ---
            const isStationaryIMU = Math.abs(linearAccelRef.current) < 0.02 && currentRotationRef.current.alpha < 2 && currentRotationRef.current.beta < 2 && currentRotationRef.current.gamma < 2;
            
            if (telemetryConfig?.fusionAlgorithm === 'kalman' && kalmanRef.current) {
               let z = calculatedSpeed || 0;
               // If IMU says stationary and GPS is low, force zero to kill jitter
               if (isStationaryIMU && z < 2.22) z = 0; // 2.22 m/s = 8 km/h
               
               kalmanRef.current.update(z);
               setCurrentSpeed(kalmanRef.current.x * 3.6);
            } else {
              setCurrentSpeed(prev => {
                let s = speedKmh;
                if (isStationaryIMU && s < 8) s = 0;
                
                if (calculatedSpeed === null) return s;
                const gpsWeight = telemetryConfig?.fusionGpsWeight ?? 0.95;
                if (s < 0.5) return 0;
                if (Math.abs(prev - s) > 20) return s; 
                return (prev * (1 - gpsWeight)) + (s * gpsWeight);
              });
            }
            
            // Local shadowed speed for logic below
            const effectiveSpeedKmh = isStationaryIMU && speedKmh < 8 ? 0 : speedKmh;
            lastGpsSpeedRef.current = effectiveSpeedKmh;

            const config = configRef.current;
            if (!config) { lastPointRef.current = currentPoint; return; }

            if (isRunningRef.current) {
              let p = 0;
              if (config.mode === 'speed') p = (effectiveSpeedKmh / config.target) * 100;
              else if (config.mode === 'distance') p = (distanceRef.current / config.target) * 100;
              setProgress(Math.min(100, Math.max(0, p)));
            } else setProgress(0);

            if (config.mode === 'free' || config.mode === 'trip') {
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
                // Vibration-Tolerant Stationary Detection
                // Engine idle vibration usually stays below 0.15G.
                // We use a slightly higher threshold here to avoid false jump-starts.
                const isStationaryVibrationTolerant = linearAccelRef.current < 0.2 && currentRotationRef.current.alpha < 5 && currentRotationRef.current.beta < 5 && currentRotationRef.current.gamma < 5;
                const isStopped = effectiveSpeedKmh < 1.2 || isStationaryVibrationTolerant;
                
                if (isStopped) {
                  lastStoppedTimestampRef.current = position.timestamp;
                  
                  // Start settling if not already settling or ready
                  if (!isSettlingRef.current && !isReadyRef.current) {
                    setIsSettling(true);
                    isSettlingRef.current = true;
                    setSettlingCountdown(3.0);
                    
                    if (settlingTimerRef.current) clearInterval(settlingTimerRef.current);
                    let timeLeft = 3.0;
                    settlingTimerRef.current = window.setInterval(() => {
                      timeLeft -= 0.1;
                      setSettlingCountdown(Math.max(0, timeLeft));
                      if (timeLeft <= 0) {
                        if (settlingTimerRef.current) clearInterval(settlingTimerRef.current);
                        setIsSettling(false);
                        isSettlingRef.current = false;
                        setIsReady(true);
                        isReadyRef.current = true;
                      }
                    }, 100);
                  }
                } else {
                  // If we detect REAL movement while settling: JUMP START!
                  // Movement must be sustained or significant to trigger Jump Start
                  const isRealMovement = effectiveSpeedKmh > 2.5 || linearAccelRef.current > 0.5;
                  
                  if (isSettlingRef.current && isRealMovement) {
                    if (settlingTimerRef.current) clearInterval(settlingTimerRef.current);
                    setIsSettling(false);
                    isSettlingRef.current = false;
                    setSettlingCountdown(0);
                    setError("QUEIMA DE LARGADA: AGUARDE 3S PARADO!");
                  }
                  
                  // If already ready, start the run normally (Uses motionSensitivity)
                  if (isReadyRef.current && effectiveSpeedKmh >= 1.8) {
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
                }
              } else if (speedKmh >= config.startSpeed) {
                // Rolling start: no settling needed
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
                // --- DISTANCE CALIBRATION (Sync IMU with GPS) ---
                const dPos = calculateDistance(lastPointRef.current, currentPoint);
                const timeDelta = (currentPoint.timestamp - lastPointRef.current.timestamp) / 1000;
                const avgSpeedMs = (currentPoint.speed + lastPointRef.current.speed) / 2;
                const dSpeed = avgSpeedMs * timeDelta;
                
                // Calculated GPS delta (fused)
                const dGps = (accuracy && accuracy < 15) ? (dSpeed * 0.8 + dPos * 0.2) : dPos;
                
                // Drift Correction: We subtly nudge distanceRef towards the GPS truth
                // We use a rolling average approach to prevent "teleporting"
                if (dGps > 0) {
                  const currentTotalGpsDist = calculateDistance(pointsRef.current[0], currentPoint);
                  const drift = currentTotalGpsDist - distanceRef.current;
                  
                  // If accuracy is high (< 10m), trust GPS more for the nudge
                  const correctionFactor = (accuracy && accuracy < 10) ? 0.2 : 0.05;
                  distanceRef.current += drift * correctionFactor;
                  setDistance(distanceRef.current);
                }
              }
              
              if (rolloutStartedRef.current && !startTimeRef.current && distanceRef.current >= 0.3048) { 
                startTimeRef.current = currentPoint.timestamp; 
                rolloutStartedRef.current = false; 
              }
              
              const config = configRef.current;
              if (config?.mode === 'distance' && distanceRef.current >= config.target) { 
                stopRun((currentPoint.timestamp - (startTimeRef.current || 0)) / 1000); 
                return; 
              }
              if (config?.mode === 'speed' && speedKmh >= config.target) { 
                stopRun((currentPoint.timestamp - (startTimeRef.current || 0)) / 1000); 
                return; 
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
    setIsRunning(false); isRunningRef.current = false; setIsWaiting(false); isWaitingRef.current = false; 
    setIsReady(false); isReadyRef.current = false; setIsSettling(false); isSettlingRef.current = false;
    setSettlingCountdown(0);
    lastStoppedTimestampRef.current = null; setDistance(0); distanceRef.current = 0; setElapsedTime(0); setProgress(0); setLastResult(null);
    setGForce(0); maxGRef.current = 0; rolloutStartedRef.current = false; configRef.current = null; activeAxisRef.current = null;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (settlingTimerRef.current) clearInterval(settlingTimerRef.current);
    kalmanRef.current = null;
    launchSignRef.current = 1;
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
  return { 
    currentSpeed, distance, isRunning, isWaiting, isReady, isSettling, settlingCountdown,
    progress, elapsedTime, gForce, lastResult, error, accuracy, gpsStatus, lastPosition, 
    currentLat: lastPosition?.latitude ?? null, currentLng: lastPosition?.longitude ?? null, 
    currentHeading, startRun, manualStart, manualStop, reset, setMockResult, requestPermission, 
    refreshGPS, gpsSource, setGpsSource 
  };
}
