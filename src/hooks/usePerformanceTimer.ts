import { useState, useEffect, useRef, useCallback } from 'react';
import { RunConfig, RunResult, GPSPoint } from '../types';
import { calculateDistance } from '../lib/utils';
import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';

export function usePerformanceTimer() {
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

  const startTimeRef = useRef<number | null>(null);
  const lastPointRef = useRef<GPSPoint | null>(null);
  const lastStoppedTimestampRef = useRef<number | null>(null);
  const pointsRef = useRef<GPSPoint[]>([]);
  const configRef = useRef<RunConfig | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const maxGRef = useRef(0);
  const rolloutStartedRef = useRef(false);
  const accelerometerRef = useRef<{ x: number, y: number, z: number } | null>(null);
  const daRef = useRef<number | undefined>(undefined);

  const [isReady, setIsReady] = useState(false);
  const isReadyRef = useRef(false);
  const isWaitingRef = useRef(false);
  const isRunningRef = useRef(false);

  const distanceRef = useRef(0);

  const stopRun = useCallback((finalTime: number) => {
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

    // Fetch DA if location is available
    const fetchDA = async (lat: number, lon: number) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,surface_pressure&forecast_days=1`);
        const data = await response.json();
        if (data.current) {
          const tempC = data.current.temperature_2m;
          const pressureHpa = data.current.surface_pressure;
          // Standard DA formula (simplified)
          // DA = PressureAlt + [120 * (OAT - ISA_Temp)]
          const pressureAlt = (145366 * (1 - Math.pow(pressureHpa / 1013.25, 0.190284)));
          const isaTemp = 15 - (1.98 * (pressureAlt / 1000));
          const da = pressureAlt + (118.8 * (tempC - isaTemp));
          daRef.current = Math.round(da);
        }
      } catch (e) {
        console.error("Error fetching DA:", e);
      }
    };

    if (pointsRef.current.length > 0) {
      fetchDA(pointsRef.current[0].latitude, pointsRef.current[0].longitude);
    }

    // Calculate slope
    let slope = 0;
    let isValidSlope = true;
    if (pointsRef.current.length >= 2) {
      const startPoint = pointsRef.current[0];
      const endPoint = pointsRef.current[pointsRef.current.length - 1];
      
      if (startPoint.altitude !== null && endPoint.altitude !== null && distanceRef.current > 0) {
        const elevationChange = endPoint.altitude - startPoint.altitude;
        slope = (elevationChange / distanceRef.current) * 100;
        // Invalidate if downhill (slope < -1% as a buffer for GPS noise)
        if (slope < -1) {
          isValidSlope = false;
        }
      }
    }

    const result: RunResult = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      config: { ...configRef.current },
      time: finalTime,
      maxSpeed,
      avgSpeed,
      distance: distanceRef.current,
      path: [...pointsRef.current],
      slope,
      isValidSlope,
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
  }, []); // Remove distance dependency

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
      if (startTimeRef.current) {
        setElapsedTime((Date.now() - startTimeRef.current) / 1000);
      }
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
  }, []);

  useEffect(() => {
    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    };

    let watchId: string | null = null;
    let motionListener: any = null;

    const initSensors = async () => {
      try {
        // Request permissions first
        const geoPerms = await Geolocation.requestPermissions();
        if (geoPerms.location !== 'granted') {
          setError("Permissão de localização negada. O app precisa de GPS para cronometrar.");
          return;
        }

        // Motion usually doesn't need explicit runtime permission request on Android 
        // with the plugin, but we handle it via the listener.
        
        motionListener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.accelerationIncludingGravity;
          accelerometerRef.current = { x: x || 0, y: y || 0, z: z || 0 };
          
          if (isReadyRef.current && !isRunningRef.current && configRef.current) {
            const totalG = Math.sqrt((x || 0)**2 + (y || 0)**2 + (z || 0)**2) / 9.81;
            const isStandingStart = configRef.current.startSpeed === 0 || configRef.current.startSpeed === undefined;
            
            if (isStandingStart && totalG > 1.15) {
              console.log("ACCELEROMETER LAUNCH DETECTED! G:", totalG);
              setIsWaiting(false);
              isWaitingRef.current = false;
              setIsRunning(true);
              isRunningRef.current = true;
              
              const now = Date.now();
              if (configRef.current.useRollout) {
                rolloutStartedRef.current = true;
                startTimeRef.current = null;
              } else {
                startTimeRef.current = now;
              }
              
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = window.setInterval(() => {
                if (startTimeRef.current) {
                  setElapsedTime((Date.now() - startTimeRef.current) / 1000);
                }
              }, 50);
            }
          }
        });

        if (gpsSource === 'internal') {
          watchId = await Geolocation.watchPosition(options, (position, err) => {
            if (err) {
              setGpsStatus('error');
              if (err.message.includes('timeout')) return;
              setError(err.message);
              return;
            }

            if (!position) return;
            
            setGpsStatus('active');
            const { latitude, longitude, speed, accuracy, altitude } = position.coords;
            
            let calculatedSpeed = speed;
            if (calculatedSpeed === null && lastPointRef.current) {
              const d = calculateDistance(lastPointRef.current, { latitude, longitude } as any);
              const t = (position.timestamp - lastPointRef.current.timestamp) / 1000;
              if (t > 0) calculatedSpeed = d / t;
            }

            const currentPoint: GPSPoint = {
              latitude,
              longitude,
              altitude: altitude,
              speed: calculatedSpeed || 0,
              accuracy: accuracy,
              timestamp: position.timestamp,
            };

            setAccuracy(accuracy);
            setLastPosition({ latitude, longitude });
            
            // Speed optimization: Use raw Doppler speed if available (+10% smoothing for noise)
            // If speed is null, fallback to distance/time calculation.
            const speedKmh = (calculatedSpeed || 0) * 3.6;
            
            // Prioritize reactive speed update for the UI
            setCurrentSpeed(prev => {
              if (calculatedSpeed === null) return speedKmh;
              // Smooth slightly to avoid jitter, but keep it high-response
              return prev * 0.1 + speedKmh * 0.9;
            });

            const config = configRef.current;
            if (!config) {
              lastPointRef.current = currentPoint;
              return;
            }

            // Progress calculation
            if (isRunningRef.current) {
              let p = 0;
              if (config.mode === 'speed') {
                p = (speedKmh / config.target) * 100;
              } else if (config.mode === 'distance') {
                p = (distanceRef.current / config.target) * 100;
              }
              setProgress(Math.min(100, Math.max(0, p)));
            } else {
              setProgress(0);
            }

            if (config.mode === 'free') {
              if (isRunningRef.current) {
                pointsRef.current.push(currentPoint);
                if (lastPointRef.current) {
                   const dPos = calculateDistance(lastPointRef.current, currentPoint);
                   const newDist = distanceRef.current + dPos;
                   distanceRef.current = newDist;
                   setDistance(newDist);
                }
              }
              lastPointRef.current = currentPoint;
              return;
            }

            if (isWaitingRef.current && !isRunningRef.current) {
              const isStandingStart = config.startSpeed === 0 || config.startSpeed === undefined;
              if (isStandingStart) {
                if (speedKmh < 1.2) {
                  lastStoppedTimestampRef.current = position.timestamp;
                  if (!isReadyRef.current) {
                    setIsReady(true);
                    isReadyRef.current = true;
                  }
                }
                
                if (isReadyRef.current && speedKmh >= 1.8) {
                  setIsWaiting(false);
                  isWaitingRef.current = false;
                  setIsRunning(true);
                  isRunningRef.current = true;
                  const lastStopped = lastStoppedTimestampRef.current || (position.timestamp - 500);
                  if (config.useRollout) {
                    rolloutStartedRef.current = true;
                    startTimeRef.current = null;
                  } else {
                    startTimeRef.current = lastStopped;
                  }
                  pointsRef.current = [currentPoint];
                  distanceRef.current = 0;
                  setDistance(0);
                  if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  timerIntervalRef.current = window.setInterval(() => {
                    if (startTimeRef.current) {
                      setElapsedTime((Date.now() - startTimeRef.current) / 1000);
                    }
                  }, 50);
                }
              } else if (speedKmh >= config.startSpeed) {
                setIsWaiting(false);
                isWaitingRef.current = false;
                setIsRunning(true);
                isRunningRef.current = true;
                startTimeRef.current = position.timestamp;
                pointsRef.current = [currentPoint];
                distanceRef.current = 0;
                setDistance(0);
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = window.setInterval(() => {
                  if (startTimeRef.current) {
                    setElapsedTime((Date.now() - startTimeRef.current) / 1000);
                  }
                }, 50);
              }
            }

            if (isRunningRef.current) {
              pointsRef.current.push(currentPoint);
              if (lastPointRef.current) {
                const timeDelta = (currentPoint.timestamp - lastPointRef.current.timestamp) / 1000;
                const dPos = calculateDistance(lastPointRef.current, currentPoint);
                const avgSpeedMs = (currentPoint.speed + lastPointRef.current.speed) / 2;
                const dSpeed = avgSpeedMs * timeDelta;
                // High response distance calculation
                const d = (accuracy && accuracy < 15) ? (dSpeed * 0.9 + dPos * 0.1) : dPos;
                const newDist = distanceRef.current + d;
                distanceRef.current = newDist;
                setDistance(newDist);

                if (rolloutStartedRef.current && !startTimeRef.current && newDist >= 0.3048) {
                  startTimeRef.current = currentPoint.timestamp;
                  rolloutStartedRef.current = false;
                }
                
                if (config.mode === 'distance' && newDist >= config.target) {
                  const finalTime = (currentPoint.timestamp - (startTimeRef.current || 0)) / 1000;
                  stopRun(finalTime);
                  return;
                }
                if (config.mode === 'speed' && speedKmh >= config.target) {
                  const finalTime = (currentPoint.timestamp - (startTimeRef.current || 0)) / 1000;
                  stopRun(finalTime);
                  return;
                }
              }
            }
            lastPointRef.current = currentPoint;
          });
        }
      } catch (err: any) {
        setError(err.message || "Erro ao iniciar sensores.");
      }
    };

    initSensors();

    return () => {
      if (motionListener) motionListener.remove();
      if (watchId) Geolocation.clearWatch({ id: watchId });
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [stopRun, gpsSource, gpsRefreshKey]); // Stable dependencies

  const reset = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    setIsWaiting(false);
    isWaitingRef.current = false;
    setIsReady(false);
    isReadyRef.current = false;
    lastStoppedTimestampRef.current = null;
    setDistance(0);
    distanceRef.current = 0;
    setElapsedTime(0);
    setProgress(0);
    setLastResult(null);
    setGForce(0);
    maxGRef.current = 0;
    rolloutStartedRef.current = false;
    configRef.current = null;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const setMockResult = (result: RunResult) => {
    setLastResult(result);
  };

  const requestPermission = useCallback(() => {
    setError(null);
    navigator.geolocation.getCurrentPosition(
      () => {
        // Permission granted, watchPosition will handle the rest
      },
      (err) => {
        if (err.code === err.TIMEOUT) return;
        
        let msg = err.message;
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Permissão de localização negada pelo usuário.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Sinal de GPS indisponível no momento.";
        }
        setError(msg);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const refreshGPS = useCallback(() => {
    setGpsRefreshKey(prev => prev + 1);
    requestPermission();
  }, [requestPermission]);

  return {
    currentSpeed,
    distance,
    isRunning,
    isWaiting,
    isReady,
    progress,
    elapsedTime,
    gForce,
    lastResult,
    error,
    accuracy,
    gpsStatus,
    lastPosition,
    startRun,
    manualStart,
    manualStop,
    reset,
    setMockResult,
    requestPermission,
    refreshGPS,
    gpsSource,
    setGpsSource
  };
}
