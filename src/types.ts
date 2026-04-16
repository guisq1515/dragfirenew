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
  latitude: number;
  longitude: number;
  slope: number;
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
}

export interface Vehicle {
  id?: string;
  uid?: string;
  type: 'car' | 'motorcycle';
  brand: string;
  model: string;
  year: string;
  nickname: string;
  photoURL?: string;
  photoURLs?: string[]; // Multiple photos for premium
  active?: boolean;
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

