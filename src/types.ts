export type RunMode = 'speed' | 'distance' | 'free' | 'custom' | 'trip';

export interface RunConfig {
  mode: RunMode;
  target: number; // km/h for speed mode, meters for distance mode
  startSpeed?: number; // Optional start speed for rolling starts (km/h)
  useRollout?: boolean; // 1-foot rollout (approx 30cm)
  isCustom?: boolean;
}

export interface RunResult {
  id: string;
  timestamp: number;
  config: RunConfig;
  time: number; // seconds
  maxSpeed: number; // km/h
  avgSpeed: number; // km/h
  distance: number; // meters
  path: GPSPoint[]; // full path coordinates
  slope?: number; // percentage (positive = uphill, negative = downhill)
  isValidSlope?: boolean;
  maxG?: number | null;
  avgAccuracy?: number | null;
  da?: number | null; // Density Altitude in feet
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  estimatedPowerCV?: number; // Estimated engine horsepower
  vehicleId?: string;       // Associated vehicle
  vehicleName?: string;     // Associated vehicle name
}

export interface RankingEntry {
  id: string;
  uid: string;
  userName: string;
  userPhoto?: string;
  vehicleName: string;
  vehicleType: 'car' | 'motorcycle';
  time: number;
  maxSpeed: number;
  timestamp: number;
  category: '0-100' | '201m' | '402m';
  latitude: number;
  longitude: number;
  slope: number;
  vehicleId?: string;
}

export interface Challenge {
  id: string;
  creatorId: string;
  creatorName: string;
  opponentId?: string; // Target of the private challenge
  isPrivate?: boolean;
  result: RunResult;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'completed' | 'expired';
  acceptedAt?: number;
  opponentResult?: RunResult;
}

export interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number; // m/s
  accuracy: number | null;
  timestamp: number;
  gLong?: number; // Longitudinal G-Force
  gLat?: number;  // Lateral G-Force
}

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName: string | null;
  photoURL: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  isPremium?: boolean;
  createdAt: string;
  bio?: string;
  instagram?: string;
  isVerified?: boolean;
  isPrivate?: boolean;
  followingCount?: number;
  isAdmin?: boolean;
  handle?: string;
  privacySettings?: {
    isPrivate?: boolean;
    showHistory?: boolean;
    showGarage?: boolean;
    showRankings?: boolean;
  };
}

export interface Vehicle {
  id?: string;
  uid?: string;
  type: 'car' | 'motorcycle';
  brand: string;
  model: string;
  year: string;
  nickname: string;
  category?: string;
  photoURL?: string;
  photoURLs?: string[]; // Multiple photos for premium
  active?: boolean;
  weight?: number;      // Total weight in kg
  hp?: number;          // CV
  stage?: string;       // Stage 1, 2, 3, etc.
  maxSpeed?: number;    // KM/H
  mods?: string;        // Text list of modifications
  observations?: string;
  engine?: string;
  transmission?: string;
  stockHp?: number;
  stockTorque?: number;
  stockWeight?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Follow {
  followerId: string;
  followingId: string;
  timestamp: number;
}

export interface GasStation {
  id: string;
  name: string;
  brand: string;
  address: string;
  latitude: number;
  longitude: number;
  prices: {
    gasoline?: number;
    ethanol?: number;
    dieselS10?: number;
    dieselS500?: number;
    gnv?: number;
  };
  pricesANP?: {
    gasoline?: number;
    ethanol?: number;
    dieselS10?: number;
    dieselS500?: number;
    gnv?: number;
  };
  rating: number;
  reviewsCount: number;
  cnpj?: string;
  municipio?: string;
  dist?: number;
  lastUpdated: number;
  photoURL?: string;
  reviews?: {
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    timestamp: number;
  }[];
}

export interface TelemetryConfig {
  motionSensitivity: number; // Launch threshold in G
  noiseFloor: number;        // Linear acceleration noise floor
  maxAccelG: number;         // Cap for speed fusion contribution
  dtInterval?: number;      // Update rate (ms)
  fusionGpsWeight?: number;  // 0.0 - 1.0 (How much we trust GPS)
  fusionAccelGain?: number;  // 0.0 - 2.0 (Multiplier for accel data)
  rotationThreshold?: number; // Threshold to ignore accel (deg/s)
  mountingAxis?: 'auto' | 'all' | 'x' | 'y' | 'z'; // Pref axis
  lookAheadBaseDistance?: number;   // Base distance in meters (default 500)
  lookAheadSpeedFactor?: number;    // Multiplier for speed-based distance (default 5)
  lookAheadMaxDistance?: number;    // Max look-ahead limit (default 1500)
}

export interface TelemetryProfile extends TelemetryConfig {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface SystemSettings {
  activeProfileId: string;
  profiles: Record<string, TelemetryProfile>;
}

export interface PowerReference {
  id: string;
  carName: string;
  weight: number;      // kg
  time: number;        // seconds (can be 0-100 or 201m time)
  distance?: number;   // meters (optional, defaults to 201)
  time0to100?: number; // legacy support
  slope: number;       // percentage
  verifiedCV: number;  // Horsepower
  timestamp: number;
  isLiveTest?: boolean;
  rawRunId?: string;
}
export interface Activity {
  id?: string;
  uid: string;
  userName: string;
  userPhoto?: string;
  handle?: string;
  type: 'new_run' | 'new_vehicle' | 'new_record' | 'follow';
  data: {
    runId?: string;
    vehicleId?: string;
    vehicleName?: string;
    description?: string;
    target?: string;
    time?: string;
  };
  timestamp: number;
}
