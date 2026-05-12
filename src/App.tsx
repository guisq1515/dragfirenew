/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useMemo, useEffect, Component, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Motion } from '@capacitor/motion';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  limit,
  getDocFromServer,
  Timestamp,
  deleteDoc,
  getDocs,
  writeBatch,
  updateDoc,
  disableNetwork,
  enableNetwork,
  increment
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  uploadString
} from 'firebase/storage';
import { auth, db, storage, googleProvider } from './firebase';
import { 
  searchPlacesHTTP as searchPlaces, 
  fetchPlaceDetails, 
  fetchRoutePoints,
  getPhotoUrl
} from './services/googleMapsService';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDWqsCxj7uc2Iu_J3JNPcgti5K7HNWjpY8';
import { logRemote } from './lib/remoteLogs';
import {
  AlertCircle,
  Play,
  Lock,
  ArrowLeft as ArrowLeftIcon,
  Share2 as Share2Icon,
  Flag,
  Weight,
  Scale,
  Home,
  Gauge,
  LayoutDashboard,
  Activity as ActivityIcon,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  EyeOff,
  Swords,
  Users,
  Instagram,
  MapPin,
  Cloud,
  BatteryCharging,
  Shield,
  ShieldCheck,
  RefreshCcw,
  Bluetooth,
  Cpu,
  UserPlus,
  UserMinus,
  Heart,
  Image as ImageIcon,
  Wand2,
  Download,
  CloudUpload,
  Filter,
  Plus,
  Minus,
  Map as MapIcon,
  Trophy,
  Settings as SettingsIcon,
  User,
  Clock,
  Zap,
  Timer,
  Car,
  AlertTriangle,
  CheckCircle2,
  X,
  RotateCcw,
  Fuel,
  Navigation,
  LayoutGrid,
  ArrowRight,
  Locate,
  Smartphone,
  Info,
  Signal,
  Search,
  Star,
  Camera as CameraIcon,
  Trash2,
  Sparkles,
  MessageSquare,
  Bell,
  Eye,
  LogOut,
  Settings2,
  Palette,
  Award,
  Target, Palmtree, Coffee, Waves, Tent, Mountain, Compass, ShieldAlert } from 'lucide-react';
import { PerformanceChart } from './components/PerformanceChart';
import { TripAnalysis } from './components/TripAnalysis';
import { ProfileLibrary } from './components/ProfileLibrary';
import { FuelCalculator } from './components/FuelCalculator';
import { editCarImage, fetchVehicleSpecs } from './services/geminiService';
import { AIPhotoEditor } from './components/AIPhotoEditor';
import { GasStations } from './components/GasStations';
import { AntigravityImporter } from './components/AntigravityImporter';
import { AdminDashboard } from './components/AdminDashboard';
import { OfflineMapManager } from './components/OfflineMapManager';
import { getThemeById, PROFILE_THEMES, BADGES, NEON_COLORS, TITLES } from './constants/themes';
import { ThemeStoreModal } from './components/ThemeStoreModal';
import { MissionsView } from './components/MissionsView';
import { ACHIEVEMENTS } from './constants/achievements';
import { PodiumRewardModal } from './components/MonthlyRewardModal';
import { APP_VERSION } from './versions';
import { useCorneringAssistant } from './hooks/useCorneringAssistant';
import { CorneringAssistantHUD } from './components/CorneringAssistantHUD';
import { MiniCorneringWidget } from './components/MiniCorneringWidget';
import { powerService } from './services/powerService';
import { KeepAwake } from '@capgo/capacitor-keep-awake';

interface RunPreset {
  id: string;
  label: string;
  mode: 'speed' | 'distance' | 'free' | 'trip' | 'duel';
  type?: 'standing' | 'rolling' | 'trip' | 'duel';
  target: number;
  startSpeed?: number;
  icon?: any;
  color?: string;
}

// Helper to convert Base64 to Uint8Array for stable Capacitor uploads
const base64ToUint8Array = (base64String: string): Uint8Array => {
  const binaryString = window.atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// --- LEADERBOARD MANAGEMENT (Stabilized Top 20) ---
const updateLeaderboard = async (entry: RankingEntry | Omit<RankingEntry, 'id'>) => {
  if (!entry.performanceScore || !entry.category) return;
  
  const date = new Date(entry.timestamp);
  const monthId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const docId = `global_${entry.category}_${monthId}`;
  const leaderboardRef = doc(db, 'leaderboards', docId);

  try {
    const snap = await getDoc(leaderboardRef);
    let entries: RankingEntry[] = [];
    
    if (snap.exists()) {
      entries = snap.data().entries || [];
    }

    // Identify user in the current list
    const existingIndex = entries.findIndex(e => e.uid === entry.uid);
    const score = entry.performanceScore || 0;

    if (existingIndex !== -1) {
      const existingScore = entries[existingIndex].performanceScore || 0;
      if (score > existingScore) {
        // Update to better score
        const entryWithId = { ...entry, id: `entry_${Date.now()}` } as RankingEntry;
        entries[existingIndex] = entryWithId;
      } else {
        // User already has a better or equal score in the list
        return;
      }
    } else {
      // New user for the list
      const entryWithId = { ...entry, id: `entry_${Date.now()}` } as RankingEntry;
      entries.push(entryWithId);
    }

    // Sort by score DESC
    entries.sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0));

    // Slice to Top 20
    const top20 = entries.slice(0, 20);

    await setDoc(leaderboardRef, {
      entries: top20,
      lastUpdated: Date.now(),
      category: entry.category,
      month: monthId
    }, { merge: true });

    console.log(`Leaderboard ${docId} updated successfully.`);
  } catch (error) {
    console.error("Error updating leaderboard document:", error);
  }
};

// --- Error Boundary ---
class ErrorBoundary extends React.Component<any, any> {
  state: { hasError: boolean, errorInfo: any } = { hasError: false, errorInfo: null };

  static getDerivedStateFromError(error: any) {
    try {
      const info = JSON.parse(error.message);
      return { hasError: true, errorInfo: info };
    } catch {
      return { hasError: true, errorInfo: { error: error.message } };
    }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950 text-white h-screen">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-display font-black italic mb-2 uppercase tracking-tighter">Ops! Algo deu errado</h2>
          <p className="text-zinc-400 text-sm mb-8 max-w-xs">
            Ocorreu um erro ao processar sua solicitação. Verifique sua conexà£o ou tente novamente.
          </p>
          <div className="bg-zinc-900 p-4 rounded-xl border border-white/5 text-left w-full max-w-sm mb-8">
            <p className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Detalhes do Erro</p>
            <p className="text-xs font-mono text-red-400 break-all">
              {this.state.errorInfo?.error || "Erro desconhecido"}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-brand-primary hover:bg-red-500 rounded-xl font-display font-black italic text-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <RefreshCcw className="w-5 h-5" />
            RECARREGAR APP
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}


// --- Brand Icon Component [NEW] ---
const BrandIcon = ({ brand, className = '' }: { brand: string, className?: string }) => {
  const b = brand?.toLowerCase() || '';
  
  // Audi Rings
  if (b.includes('audi')) return (
    <svg viewBox="0 0 100 40" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="20" cy="20" r="15" />
      <circle cx="40" cy="20" r="15" />
      <circle cx="60" cy="20" r="15" />
      <circle cx="80" cy="20" r="15" />
    </svg>
  );

  // BMW style
  if (b.includes('bmw')) return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M50 50 L50 10 A40 40 0 0 1 90 50 Z" />
      <path d="M50 50 L10 50 A40 40 0 0 1 50 90 Z" />
    </svg>
  );

  // Honda / Hyundai style
  if (b.includes('honda') || b.includes('hyundai')) return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="6">
      <rect x="15" y="15" width="70" height="70" rx="10" />
      <path d="M30 30 L30 70 M70 30 L70 70 M30 50 L70 50" strokeLinecap="round" />
    </svg>
  );

  // Porsche / Ferrari shield style
  if (b.includes('porsche') || b.includes('ferrari') || b.includes('lamborghini')) return (
    <svg viewBox="0 0 80 100" className={className} fill="currentColor">
      <path d="M40 5 C10 5 5 20 5 50 C5 80 40 95 40 95 C40 95 75 80 75 50 C75 20 70 5 40 5Z" />
      <text x="40" y="65" textAnchor="middle" fill="black" fontSize="40" fontWeight="900" fontStyle="italic">{brand.charAt(0).toUpperCase()}</text>
    </svg>
  );

  // Mercedes
  if (b.includes('mercedes')) return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="4">
      <circle cx="50" cy="50" r="45" />
      <path d="M50 5 L50 50 L10 70 M50 50 L90 70" strokeLinecap="round" />
    </svg>
  );

  // Yamaha / Moto
  if (b.includes('yamaha') || b.includes('kawasaki') || b.includes('honda')) return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="4">
      <circle cx="50" cy="50" r="40" strokeDasharray="10 5" />
      <path d="M50 20 L50 80 M20 50 L80 50" strokeLinecap="round" />
    </svg>
  );

  // Default Stylish Shield
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-brand-primary to-black border border-brand-primary/30 rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.2)] ${className}`}>
      <span className="text-[10px] font-black italic text-brand-primary uppercase">{brand.charAt(0).toUpperCase()}</span>
    </div>
  );
};
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import { usePerformanceTimer } from './hooks/usePerformanceTimer';
import { RunMode, RunConfig, RunResult, Challenge, Vehicle, RankingEntry, GPSPoint, UserProfile, TelemetryConfig, SystemSettings, Activity, PowerReference } from './types';
import { calculateDistance } from './lib/utils';
import { VEHICLE_DATA, YEARS } from './constants/vehicles';

// Fix Leaflet default icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const baseVehicle: Vehicle = {
  type: 'car',
  nickname: '',
  brand: '',
  model: '',
  year: YEARS ? YEARS[0] : '2024',
  category: 'custom',
  photoURL: '',
  hp: 0,
  stage: 'Stock',
  maxSpeed: 0,
  mods: '',
  observations: '',
  engine: '',
  transmission: '',
  weight: 0,
  stockHp: 0,
  stockTorque: 0,
  stockWeight: 0
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const TERMS_VERSION = '1.0.0';
const ADMIN_EMAILS = ['guisq1515@gmail.com'];

type Screen = 'home' | 'timer' | 'challenge' | 'duel-result' | 'settings' | 'login' | 'terms' | 'vehicle-settings' | 'profile-settings' | 'theme-store' | 'regional-ranking' | 'history' | 'gps-guide' | 'custom-setup' | 'trip-view' | 'fuel-calculator' | 'public-profile' | 'feed' | 'search' | 'ai-editor' | 'fuel-stations' | 'anp-import' | 'admin-dashboard' | 'cornering-assistant' | 'vehicle-catalog' | 'missions' | 'trip-explorer' | 'curve-radar' | 'banned' | 'offline-maps';

function GPSGuide({ onBack }: { onBack: () => void }) {
  const tips = [
    {
      title: "Céu Aberto",
      description: "O sinal de GPS viaja do espaà§o. àrvores, prédios altos e garagens bloqueiam ou refletem o sinal, causando erros de metros.",
      icon: <Cloud className="w-5 h-5 text-blue-400" />
    },
    {
      title: "Posição do Celular",
      description: "Coloque o celular no painel ou no para-brisa. Evite o console central ou o bolso, onde a lataria do carro abafa o sinal.",
      icon: <Smartphone className="w-5 h-5 text-brand-primary" />
    },
    {
      title: "Antenas Externas",
      description: "Para precisà£o profissional (10Hz ou 25Hz), considere usar receptores Bluetooth externos.",
      icon: <Zap className="w-5 h-5 text-brand-accent" />
    },
    {
      title: "Bateria e Energia",
      description: "Mantenha o celular carregando. O modo de economia de energia reduz a frequência de atualização do GPS para economizar bateria.",
      icon: <BatteryCharging className="w-5 h-5 text-green-400" />
    },
    {
      title: "Hardware do Smartphone",
      description: "A qualidade do sensor GPS varia entre modelos. Smartphones mais modernos e potentes possuem chips de localização mais precisos e rápidos.",
      icon: <Smartphone className="w-5 h-5 text-purple-400" />
    },
    {
      title: "Permissões de Sistema",
      description: "Algumas marcas (Xiaomi, Samsung, Huawei) podem bloquear o GPS para economizar bateria. Verifique se o app tem permissà£o de 'Localização Precisa' e se a economia de energia está desativada.",
      icon: <Shield className="w-5 h-5 text-red-400" />
    }
  ];

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto bg-zinc-950 pb-24">
      <div className="flex items-center gap-4 bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20">
        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none">GUIA DE PRECISàƒO</h2>
          <p className="text-xs text-brand-primary font-bold uppercase tracking-widest mt-1">Como melhorar seus resultados</p>
        </div>
      </div>

      <div className="space-y-4">
        {tips.map((tip, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-panel rounded-2xl p-4 border-white/5 flex gap-4"
          >
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shrink-0">
              {tip.icon}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">{tip.title}</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">{tip.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-black text-white uppercase tracking-widest">Dica Técnica</h4>
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          O DragFire utiliza um algoritmo híbrido que combina a posição geográfica com o efeito Doppler (velocidade real) para compensar oscilaà§ões do sensor do smartphone.
        </p>
      </div>
    </div>
  );
}

// --- Helpers ---
const calculateIntervals = (path: GPSPoint[], targets: number[]) => {
  if (path.length === 0) return [];
  const startTime = path[0].timestamp;
  const intervals: { target: number; time: number }[] = [];
  
  targets.forEach(target => {
    // Find the first point that exceeds or equals the target
    const targetIndex = path.findIndex(p => p.speed * 3.6 >= target);
    
    if (targetIndex !== -1) {
      const point = path[targetIndex];
      let exactTime = point.timestamp;
      
      // Interpolate if we have a previous point
      if (targetIndex > 0) {
        const prevPoint = path[targetIndex - 1];
        const speedNow = point.speed * 3.6;
        const speedPrev = prevPoint.speed * 3.6;
        const timeNow = point.timestamp;
        const timePrev = prevPoint.timestamp;
        
        const speedDiff = speedNow - speedPrev;
        const timeDiff = timeNow - timePrev;
        const targetDiff = target - speedPrev;
        
        if (speedDiff > 0) {
          const timeOffset = (targetDiff / speedDiff) * timeDiff;
          exactTime = timePrev + timeOffset;
        }
      }
      
      intervals.push({
        target,
        time: (exactTime - startTime) / 1000
      });
    }
  });
  
  return intervals;
};

const calculateDistanceIntervals = (path: GPSPoint[], targets: number[]) => {
  if (path.length === 0) return [];
  const startTime = path[0].timestamp;
  const intervals: { target: number; time: number }[] = [];
  
  let totalDistance = 0;
  const pathWithDistance = path.map((point, index) => {
    if (index === 0) return { ...point, cumulativeDistance: 0 };
    const prevPoint = path[index - 1];
    
    const timeDelta = (point.timestamp - prevPoint.timestamp) / 1000;
    const dPos = calculateDistance(prevPoint, point);
    const avgSpeedMs = (point.speed + prevPoint.speed) / 2;
    const dSpeed = avgSpeedMs * timeDelta;
    // Keeping same weight as in usePerformanceTimer for consistency
    const d = (point.accuracy && point.accuracy < 10) ? (dSpeed * 0.8 + dPos * 0.2) : dPos;
    
    totalDistance += d;
    return { ...point, cumulativeDistance: totalDistance };
  });

  targets.forEach(target => {
    const targetIndex = pathWithDistance.findIndex(p => p.cumulativeDistance >= target);
    
    if (targetIndex !== -1) {
      const point = pathWithDistance[targetIndex];
      let exactTime = point.timestamp;
      
      if (targetIndex > 0) {
        const prevPoint = pathWithDistance[targetIndex - 1];
        const dNow = point.cumulativeDistance;
        const dPrev = prevPoint.cumulativeDistance;
        const tNow = point.timestamp;
        const tPrev = prevPoint.timestamp;
        
        const dDiff = dNow - dPrev;
        const tDiff = tNow - tPrev;
        const targetDiff = target - dPrev;
        
        if (dDiff > 0) {
          const timeOffset = (targetDiff / dDiff) * tDiff;
          exactTime = tPrev + timeOffset;
        }
      }
      
      intervals.push({
        target,
        time: (exactTime - startTime) / 1000
      });
    }
  });
  
  return intervals;
};

interface HistoryItemProps {
  key?: React.Key;
  run: RunResult;
  isPremium?: boolean;
  onDelete: (id: string) => void | Promise<void>;
}

function HistoryItem({ run, isPremium, onDelete }: HistoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div 
      className={`glass-panel rounded-2xl border-white/5 flex flex-col transition-all duration-300 ${isExpanded ? 'p-6 bg-zinc-900/80' : 'p-4'}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${run.config.mode === 'speed' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
            {run.config.mode === 'speed' ? <Zap className="w-5 h-5" /> : <Flag className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-base font-bold text-white leading-none">
              {run.config.isCustom ? (
                run.config.mode === 'speed' ? `${run.config.startSpeed}-${run.config.target} km/h` : `${run.config.target}m`
              ) : (
                run.config.mode === 'speed' ? `${run.config.target} km/h` : `${run.config.target}m`
              )}
            </h4>
            <div className="text-right">
              <h2 className="text-xl font-display font-black italic text-white leading-none tracking-tight">RANKING <span className="text-brand-primary">REGIONAL</span></h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Temporada de {new Date().toLocaleString('pt-BR', { month: 'long' })}</p>
            </div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{formatDate(run.timestamp)}</p>
          </div>
        </div>
        <div className="text-right flex items-center gap-4">
          <div className="flex flex-col items-end">
            <p className="text-2xl font-display font-black text-brand-accent italic leading-none">{run.time.toFixed(2)}s</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{Math.round(run.maxSpeed)} km/h</p>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(run.id!);
            }}
            className="p-2 text-zinc-700 hover:text-red-500 transition-colors bg-zinc-950/50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-6 mt-6 border-t border-white/5 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950/50 p-4 rounded-xl border border-white/5">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-3">
                    {run.config.mode === 'free' ? 'Resumo' : 'Intervalos'}
                  </span>
                  <div className="space-y-2">
                    {run.config.mode === 'free' ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Distà¢ncia</span>
                          <span className="text-sm font-display font-black text-white italic">{Math.round(run.distance)}m</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Velo. Média</span>
                          <span className="text-sm font-display font-black text-white italic">{Math.round(run.avgSpeed)} km/h</span>
                        </div>
                      </>
                    ) : run.config.isCustom ? (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">
                          {run.config.mode === 'speed' ? `${run.config.startSpeed}-${run.config.target} km/h` : `${run.config.target}m`}
                        </span>
                        <span className="text-sm font-display font-black text-white italic">{run.time.toFixed(2)}s</span>
                      </div>
                    ) : (
                      calculateIntervals(run.path, [20, 40, 60, 80, 100]).map(interval => (
                        <div key={interval.target} className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">0-{interval.target} km/h</span>
                          <span className="text-sm font-display font-black text-white italic">{interval.time.toFixed(2)}s</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                  <div className="bg-zinc-950/50 p-4 rounded-xl border border-white/5 space-y-4">
                    <div>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Inclinação</span>
                      <p className={`text-lg font-display font-black italic leading-none ${run.isValidSlope ? 'text-white' : 'text-red-500'}`}>
                        {run.slope?.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Density Altitude</span>
                      <p className="text-lg font-display font-black text-white italic leading-none">{run.da !== undefined ? `${run.da} ft` : '---'}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1 font-display">Potência (CV)</span>
                        {!isPremium ? (
                          <div className="flex items-center gap-1.5 text-yellow-500/40">
                             <div className="p-1.5 bg-yellow-500/10 rounded-lg">
                                <Zap className="w-3 h-3 fill-current" />
                             </div>
                             <span className="text-[8px] font-black uppercase tracking-tighter">Premium</span>
                          </div>
                        ) : (
                          <p className="text-[8px] font-black text-brand-primary uppercase italic leading-none animate-pulse">
                            Em Desenvolvimento
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Pico G</span>
                        <p className="text-lg font-display font-black text-white italic leading-none">{run.maxG?.toFixed(2)}G</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <span className="text-[10px] font-black text-zinc-600 uppercase">Precisà£o</span>
                      <p className="text-xs font-bold text-zinc-500">{run.avgAccuracy?.toFixed(1)}m</p>
                    </div>
                  </div>
              </div>
              
              <PerformanceChart result={run} isPremium={isPremium} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HistoryView({ 
  user,
  isGuest,
  isPremium,
  isAdmin,
  onBack 
}: { 
  user: FirebaseUser | null,
  isGuest?: boolean,
  isPremium?: boolean,
  isAdmin?: boolean,
  onBack: () => void 
}) {
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleSyncRanking = async () => {
    if (!user || syncing) return;
    setSyncing(true);
    setUploadStatus('Sincronizando Ranking...');
    
    let syncedCount = 0;
    try {
      // 1. Get current rankings to avoid duplicates (simplified check)
      const existingQ = query(collection(db, 'rankings'), where('uid', '==', user.uid));
      const existingSnap = await getDocs(existingQ);
      const existingTimestamps = new Set(existingSnap.docs.map(d => d.data().timestamp));

      // 2. Filter valid runs from local state
      const validRuns = runs.filter(r => {
        const isStandard0to100 = r.config.mode === 'speed' && r.config.target === 100;
        const isStandard201m = r.config.mode === 'distance' && r.config.target === 201;
        
        return (isStandard0to100 || isStandard201m) && 
               r.isValidSlope && 
               r.location && 
               (r.avgAccuracy ?? 100) < 18 &&
               !existingTimestamps.has(r.timestamp);
      });

      if (validRuns.length === 0) {
        alert('Nenhuma puxada nova válida para sincronizar.');
        return;
      }

      // 3. Batch upload (conceptual, using individual adds for simplicity and progress feedback)
      for (const r of validRuns) {
                const performanceScore = r.config.mode === 'speed' ? (100 / r.time) * 1000 : (201 / r.time) * 1000;
        const rankingData: Omit<RankingEntry, 'id'> = {
          uid: user.uid,
          userName: user.displayName || 'Piloto',
          userPhoto: user.photoURL || undefined,
          vehicleName: 'Sync Histórico', // We don't have the full vehicle object here easily, but we can improve this
          vehicleType: r.config.mode === 'distance' ? 'car' : 'car', 
          time: r.time,
          maxSpeed: r.maxSpeed,
          timestamp: r.timestamp,
          category: r.config.mode === 'speed' ? '0-100' : '201m',
          mode: r.config.mode === 'speed' ? 'speed' : 'distance',
          target: r.config.target,
          latitude: r.location?.latitude || 0,
          longitude: r.location?.longitude || 0,
          slope: r.slope || 0,
          performanceScore
        };
        await addDoc(collection(db, 'rankings'), rankingData);
        await updateLeaderboard(rankingData);
        syncedCount++;
      }

      alert(`${syncedCount} puxadas sincronizadas com sucesso!`);
    } catch (err: any) {
      console.error("Sync error:", err);
      alert("Erro na sincronização: " + err.message);
    } finally {
      setSyncing(false);
      setUploadStatus('');
    }
  };

  useEffect(() => {
    if (isGuest) {
      try {
        const localRuns = JSON.parse(localStorage.getItem('dragfire_guest_runs') || '[]');
        setRuns(localRuns);
        setError(null);
      } catch (e) {
        console.error("Error loading guest history:", e);
        setError("Erro ao carregar histórico local.");
      }
      setLoading(false);
      return;
    }

    if (!user) return;
    const q = query(
      collection(db, 'runs'), 
      where('uid', '==', user.uid),
      limit(100) // Fetch a slightly larger batch to ensure we have enough after manual sort
    );
    
    setError(null);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as RunResult))
        .sort((a, b) => {
          const tA = (a.timestamp as any)?.seconds || 0;
          const tB = (b.timestamp as any)?.seconds || 0;
          return tB - tA;
        })
        .slice(0, 50); // Keep the limit of 50
      setRuns(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching history:", err);
      // More descriptive message for common firestore errors
      if (err.message.includes('index')) {
        setError("O banco de dados ainda está sendo configurado. Tente novamente em alguns minutos.");
      } else if (err.message.includes('permission')) {
        setError("Sem permissà£o para carregar o histórico. Tente relogar.");
      } else {
        setError("Erro ao carregar histórico. Verifique sua conexà£o.");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, isGuest]);

  const deleteRun = async (runId: string) => {
    if (!window.confirm('Deseja excluir esta puxada permanentemente?')) return;
    
    if (isGuest) {
      const updatedRuns = runs.filter(r => r.id !== runId);
      setRuns(updatedRuns);
      localStorage.setItem('dragfire_guest_runs', JSON.stringify(updatedRuns));
      return;
    }

    try {
      await deleteDoc(doc(db, 'runs', runId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `runs/${runId}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 pb-32 space-y-6 overflow-y-auto bg-zinc-950">
      <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={handleSyncRanking}
              disabled={syncing}
              className={`p-2 rounded-lg flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${syncing ? 'bg-zinc-800 text-zinc-600' : 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30 active:scale-95'}`}
            >
              <RefreshCcw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sinc Ranking'}
            </button>
          )}
          <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none">HISTà“RICO</h2>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Suas puxadas recentes</p>
        </div>
      </div>

      {!isPremium && !isGuest && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight leading-tight">
              No plano Free, apenas as <span className="text-yellow-500">2 últimas puxadas</span> sà£o salvas.
            </p>
            <p className="text-[9px] text-zinc-500 font-medium mt-0.5">Assine o Premium para histórico ilimitado!</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12 px-6 space-y-4">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <History className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-red-400 text-xs font-bold uppercase tracking-widest">{error}</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
              <History className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-zinc-500 text-xs font-bold uppercase">Nenhuma puxada registrada</p>
          </div>
        ) : (
          runs.map((run) => (
            <HistoryItem key={run.id} run={run} isPremium={isPremium} onDelete={deleteRun} />
          ))
        )}
      </div>
    </div>
  );
}

function BottomNav({ 
  activeScreen, 
  onNavigate, 
  userPhoto,
  isGuest,
  isAdmin
}: { 
  activeScreen: Screen, 
  onNavigate: (s: Screen) => void,
  userPhoto?: string,
  isGuest?: boolean,
  isAdmin?: boolean
}) {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home', locked: false },
    { id: 'search', icon: Search, label: 'Busca', locked: false },
    { id: 'regional-ranking', icon: Trophy, label: 'Ranking', locked: false },
    ...(isAdmin ? [{ id: 'admin-dashboard', icon: LayoutDashboard, label: 'Dash', locked: false }] : []),
    { id: (activeScreen === 'trip-explorer' ? 'trip-explorer' : (activeScreen === 'curve-radar' ? 'curve-radar' : 'missions')), icon: Target, label: 'Missões', locked: isGuest },
    { id: 'public-profile', icon: User, label: 'Perfil', locked: isGuest },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 px-6 py-3 z-50 flex items-center justify-between safe-area-bottom">
      {navItems.map((item) => {
        const isActive = activeScreen === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => !item.locked && onNavigate(item.id as Screen)}
            className={`flex flex-col items-center gap-1 transition-all active:scale-90 relative ${isActive ? 'text-brand-primary' : 'text-zinc-500'} ${item.locked ? 'opacity-50 grayscale' : ''}`}
          >
            {item.id === 'public-profile' && userPhoto ? (
              <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${isActive ? 'border-brand-primary' : 'border-zinc-800'} shadow-lg transition-all`}>
                <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
            )}
            <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
            {item.locked && (
              <div className="absolute -top-1 -right-1">
                <Lock className="w-2.5 h-2.5 text-yellow-500" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SearchUsers({ 
  currentUserId, 
  onViewProfile 
}: { 
  currentUserId: string | undefined, 
  onViewProfile: (uid: string) => void 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchTerm.length < 3) {
      setResults([]);
      return;
    }

      const delayDebounceFn = setTimeout(async () => {
        setLoading(true);
        try {
          let q;
          if (searchTerm.startsWith('#')) {
            const handleSearch = searchTerm.substring(1).toLowerCase();
            q = query(
              collection(db, 'users'),
              where('handle', '==', handleSearch),
              limit(10)
            );
          } else {
            q = query(
              collection(db, 'users'),
              where('displayName', '>=', searchTerm),
              where('displayName', '<=', searchTerm + '\uf8ff'),
              limit(20)
            );
          }
          const snapshot = await getDocs(q);
          const users = snapshot.docs
            .map(doc => ({ uid: doc.id, ...(doc.data() as any) } as UserProfile))
            .filter(u => u.uid !== currentUserId);
          setResults(users);
        } catch (error) {
          console.error("Error searching users:", error);
        } finally {
          setLoading(false);
        }
      }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentUserId]);

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 p-6 space-y-6 overflow-y-auto pb-32">
      <div className="space-y-2">
        <h2 className="text-2xl font-display font-black italic text-white uppercase tracking-tighter">BUSCAR PILOTOS</h2>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Encontre seus amigos</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
        <input 
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Digite o nome do piloto..."
          className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 transition-all"
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length > 0 ? (
          results.map((u) => (
            <button
              key={u.uid}
              onClick={() => onViewProfile(u.uid)}
              className="w-full p-4 bg-zinc-900/50 border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-zinc-900 transition-all active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800">
                {u.photoURL ? (
                  <img src={u.photoURL || undefined} alt={u.displayName || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-6 h-6 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{u.displayName}</h4>
                  {u.isPremium && <Zap className="w-3 h-3 text-brand-primary fill-current" />}
                </div>
                {u.bio && <p className="text-[10px] text-zinc-500 line-clamp-1">{u.bio}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-700" />
            </button>
          ))
        ) : searchTerm.length >= 3 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-zinc-500 text-sm">Nenhum piloto encontrado.</p>
          </div>
        ) : (
          <div className="text-center py-12 space-y-2">
            <Users className="w-12 h-12 text-zinc-900 mx-auto mb-2" />
            <p className="text-zinc-700 text-xs font-bold uppercase tracking-widest">Digite pelo menos 3 caracteres</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Feed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        // 1. Get follow list
        const followQ = query(collection(db, 'follows'), where('followerId', '==', auth.currentUser.uid));
        const followSnap = await getDocs(followQ);
        const followingIds = followSnap.docs.map(d => d.data().followingId);
        
        // Add self to feed as well
        followingIds.push(auth.currentUser.uid);

        if (followingIds.length === 0) {
          setActivities([]);
          setLoading(false);
          return;
        }

        // 2. Get activities (Firestore limit 10 for 'in' operator)
        // Divide in chunks if more than 10, but for now let's limit to 10 followings
        const activityQ = query(
          collection(db, 'activities'),
          where('uid', 'in', followingIds.slice(0, 10)),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const activitySnap = await getDocs(activityQ);
        setActivities(activitySnap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
      } catch (e) {
        console.error("Error fetching feed:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-950 p-6 items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto pb-32">
      <div className="p-6 pb-2 space-y-2">
        <h2 className="text-2xl font-display font-black italic text-white uppercase tracking-tighter">FEED SOCIAL</h2>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Atividades da Pista</p>
      </div>

      <div className="px-6 space-y-4 mt-4">
        {activities.length > 0 ? (
          activities.map((act) => (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/50 border border-white/5 rounded-[24px] p-4 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                  {act.userPhoto ? (
                    <img src={act.userPhoto} alt={act.userName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-zinc-600" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white italic uppercase tracking-tight truncate">{act.userName}</span>
                      {act.handle && <span className="text-[9px] text-brand-primary font-black italic uppercase">#{act.handle}</span>}
                   </div>
                   <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{new Date(act.timestamp).toLocaleDateString()} â€¢ {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              <div className="bg-zinc-950/50 rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                 <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    {act.type === 'new_run' ? <Zap className="w-6 h-6 text-brand-primary fill-current" /> : <Car className="w-6 h-6 text-brand-primary" />}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-black text-brand-primary uppercase tracking-widest mb-0.5 italic">
                       {act.type === 'new_run' ? 'Novo Resultado' : 'Novo Veículo na Garagem'}
                    </p>
                    <h4 className="text-sm font-black text-white uppercase italic tracking-tighter truncate">
                       {act.data.vehicleName || 'Veículo'}
                    </h4>
                    <p className="text-[10px] text-zinc-400 font-bold">
                       {act.type === 'new_run' ? `${act.data.target}: ${act.data.time}` : act.data.description}
                    </p>
                 </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30">
             <Users className="w-12 h-12 text-zinc-600" />
             <p className="text-[10px] font-black uppercase tracking-widest max-w-[150px]">O feed está vazio. Siga outros pilotos para ver as atividades!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PublicProfile({ 
  uid, 
  currentUserId,
  onBack,
  onEditVehicles,
  onViewVehicle,
  onOpenStore,
  isAdmin
}: { 
  uid: string, 
  currentUserId: string | undefined,
  onBack: () => void,
  onEditVehicles?: () => void,
  onViewVehicle?: (v: Vehicle) => void,
  onOpenStore?: () => void,
  isAdmin: boolean
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeProfileTab, setActiveProfileTab] = useState<'garage' | 'runs' | 'library'>('garage');

  const theme = getThemeById(profile?.activeThemeId);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const profileDoc = await getDoc(doc(db, 'users', uid));
        if (profileDoc.exists()) {
          const data = profileDoc.data() as UserProfile;
          setProfile(data);
          
          // Enhanced Privacy Check
          const canViewContent = currentUserId === uid || isFollowing || !data.privacySettings?.isPrivate;
          
          if (canViewContent) {
            const vehiclesQuery = query(collection(db, 'vehicles'), where('uid', '==', uid));
            const vehiclesSnap = await getDocs(vehiclesQuery);
            setVehicles(vehiclesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));

            const runsQuery = query(collection(db, 'runs'), where('uid', '==', uid), limit(20));
            const runsSnap = await getDocs(runsQuery);
            const fetchedRuns = runsSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as RunResult))
              .sort((a, b) => {
                const tA = (a.timestamp as any)?.seconds || 0;
                const tB = (b.timestamp as any)?.seconds || 0;
                return tB - tA;
              })
              .slice(0, 10);
            setRuns(fetchedRuns);
          }
        }

        if (currentUserId) {
          const followDoc = await getDoc(doc(db, 'follows', `${currentUserId}_${uid}`));
          setIsFollowing(followDoc.exists());

          const requestDoc = await getDoc(doc(db, 'follow_requests', `${currentUserId}_${uid}`));
          setIsRequested(requestDoc.exists());
        }
      } catch (error) {
        console.error("Error fetching public profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [uid, currentUserId]);

  const handleFollow = async () => {
    if (!currentUserId || !profile) return;
    const followId = `${currentUserId}_${uid}`;
    try {
      if (isFollowing) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'follows', followId));
        batch.update(doc(db, 'users', uid), { followersCount: increment(-1) });
        batch.update(doc(db, 'users', currentUserId), { followingCount: increment(-1) });
        await batch.commit();
        setIsFollowing(false);
        setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) - 1 } : null);
      } else if (isRequested) {
        await deleteDoc(doc(db, 'follow_requests', followId));
        setIsRequested(false);
      } else {
        if (profile.isPrivate) {
          await setDoc(doc(db, 'follow_requests', followId), {
            followerId: currentUserId,
            followingId: uid,
            timestamp: Date.now()
          });
          setIsRequested(true);
        } else {
          const batch = writeBatch(db);
          batch.set(doc(db, 'follows', followId), {
            followerId: currentUserId,
            followingId: uid,
            timestamp: Date.now()
          });
          batch.update(doc(db, 'users', uid), { followersCount: increment(1) });
          batch.update(doc(db, 'users', currentUserId), { followingCount: increment(1) });
          await batch.commit();
          setIsFollowing(true);
          setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : null);
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Perfil de ${profile?.displayName || 'Piloto'} no DragFire`,
      text: `Confira a garagem e os tempos de ${profile?.displayName || 'Piloto'} no DragFire!`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link do perfil copiado!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
        <User className="w-12 h-12 text-zinc-800 mb-4" />
        <h3 className="text-white font-bold">Perfil nà£o encontrado</h3>
        <button onClick={onBack} className="mt-4 text-brand-primary font-bold uppercase text-xs">Voltar</button>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col ${theme.backgroundClass} overflow-y-auto pb-32 relative`}>
      {/* Neon Borders of the Pilot */}
      {profile.activeNeonColor && (
        <div className="fixed inset-0 pointer-events-none z-50">
           <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: profile.activeNeonColor, boxShadow: `0 0 20px ${profile.activeNeonColor}` }} />
           <div className="absolute right-0 top-0 bottom-0 w-1" style={{ backgroundColor: profile.activeNeonColor, boxShadow: `0 0 20px ${profile.activeNeonColor}` }} />
        </div>
      )}

      {/* Header */}
      <div className={`relative h-48 ${theme.headerClass} overflow-hidden`}>
        {theme.bannerUrl && (
          <img src={theme.bannerUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 z-20 p-2 bg-black/40 backdrop-blur-md rounded-xl text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="absolute top-6 right-6 z-20 flex gap-2 items-center">
          {currentUserId === uid && onOpenStore && (
            <button 
              onClick={onOpenStore}
              className="p-2 bg-black/40 backdrop-blur-md rounded-xl text-brand-primary hover:text-white transition-colors"
            >
              <Palette className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={handleShare}
            className="p-2 bg-black/40 backdrop-blur-md rounded-xl text-white hover:text-brand-primary transition-colors"
          >
            <Share2Icon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-6 -mt-16 relative z-20">
        <div className="flex items-start gap-6">
          {/* Profile Picture & Badge Wrapper */}
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-3xl border-4 border-zinc-950 overflow-hidden bg-zinc-800 shadow-2xl">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-zinc-600" />
                </div>
              )}
            </div>
            
            {/* Clean, Frameless Badge System */}
            {(uid === currentUserId && isAdmin) ? (
              <div className="absolute -bottom-3 -right-3 bg-brand-primary text-white p-2 rounded-xl shadow-lg z-30 border-2 border-zinc-950">
                <Zap className="w-5 h-5 fill-current" />
              </div>
            ) : profile.activeBadgeId ? (
              <div className="absolute -bottom-4 -right-4 w-16 h-16 flex items-center justify-center z-30 pointer-events-none">
                <img 
                  src={BADGES.find(b => b.id === profile.activeBadgeId)?.imageUrl} 
                  className="w-full h-full object-contain filter drop-shadow-[0_8px_15px_rgba(0,0,0,0.6)] contrast-[1.3] brightness-110" 
                  style={{ filter: 'url(#remove-black-filter)' }}
                  alt="Pilot Badge"
                />
              </div>
            ) : profile.isPremium ? (
               <div className="absolute -bottom-3 -right-3 bg-brand-primary text-white p-2 rounded-xl shadow-lg z-30 border-2 border-zinc-950">
                 <CheckCircle2 className="w-4 h-4 fill-current" />
               </div>
            ) : null}
          </div>

          {/* User Info & Stats Layout */}
          <div className="flex-1 pt-6 space-y-4">
            <div className="flex flex-col">
              <h2 className="text-2xl font-display font-black italic text-white leading-none uppercase tracking-tighter">
                {profile.displayName || 'Piloto Anà´nimo'}
              </h2>
              {profile.handle && (
                <p className="text-[10px] text-brand-primary font-black italic tracking-[0.2em] mt-1.5 uppercase opacity-80">#{profile.handle.toUpperCase()}</p>
              )}
            </div>

            <div className="flex items-center gap-5">
              <div className="flex flex-col">
                <span className="text-white font-black italic text-lg leading-none">{profile.followersCount || 0}</span>
                <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mt-1">Seguidores</span>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black italic text-lg leading-none">{profile.followingCount || 0}</span>
                <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mt-1">Seguindo</span>
              </div>

              {profile.instagram && (
                <a 
                  href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-lg text-white shadow-lg shadow-pink-600/20 active:scale-95 transition-all ml-auto xs:ml-0"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
            </div>
            
            {currentUserId !== uid && (
              <div className="flex gap-2 w-full">
                <button 
                  onClick={handleFollow}
                  className={`flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2 active:scale-95 ${
                    isFollowing 
                      ? 'bg-zinc-800 text-zinc-400 border border-white/5' 
                      : isRequested 
                        ? 'bg-zinc-900 text-zinc-500 border border-dashed border-white/10'
                        : 'bg-brand-primary text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)] hover:shadow-brand-primary/40'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-3.5 h-3.5" />
                      Seguindo
                    </>
                  ) : isRequested ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      Solicitado
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Seguir
                    </>
                  )}
                </button>
                
                {isFollowing && (
                  <button className="px-3 bg-zinc-800 border border-white/5 rounded-xl text-zinc-400 active:scale-95 transition-all">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-zinc-400 text-xs mt-6 px-1 italic border-l-2 border-brand-primary/30 pl-4">{profile.bio}</p>
        )}
      </div>


        {/* Tab Navigation */}
        <div className="flex bg-zinc-900 rounded-xl overflow-hidden p-1 border border-white/5 shadow-lg">
          <button 
            onClick={() => setActiveProfileTab('garage')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg flex justify-center items-center gap-1.5 ${activeProfileTab === 'garage' ? 'bg-brand-primary text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            <Car className="w-4 h-4" /> Garagem
          </button>
          <button 
            onClick={() => setActiveProfileTab('runs')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg flex justify-center items-center gap-1.5 ${activeProfileTab === 'runs' ? 'bg-brand-primary text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            <History className="w-4 h-4" /> Tempos
          </button>
          <button 
            onClick={() => setActiveProfileTab('library')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg flex justify-center items-center gap-1.5 ${activeProfileTab === 'library' ? 'bg-brand-primary text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            <ImageIcon className="w-4 h-4" /> àlbuns
          </button>
        </div>

        {/* Vehicles & Runs (Privacy Check) */}
        {((profile.privacySettings?.isPrivate || profile.isPrivate) && !isFollowing && currentUserId !== uid) ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4 bg-zinc-900/30 rounded-3xl border border-white/5">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-zinc-700" />
            </div>
            <div>
              <h3 className="text-white font-bold">Esta conta é privada</h3>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">Siga este piloto para ver sua garagem e tempos registrados.</p>
            </div>
          </div>
        ) : (
          <>
            {activeProfileTab === 'garage' && (
              <div className="space-y-4 pb-12">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Car className="w-4 h-4 text-brand-primary" />
                  Garagem
                </h3>
                {uid === currentUserId && onEditVehicles && (
                  <button 
                    onClick={onEditVehicles}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-brand-primary hover:bg-brand-primary hover:text-white transition-all active:scale-95 shadow-[0_5px_15px_rgba(239,68,68,0.1)]"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">ADICIONAR</span>
                  </button>
                )}
                <span className="text-[10px] text-zinc-500 font-bold">{vehicles.length} {vehicles.length === 1 ? 'Veículo' : 'Veículos'}</span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {vehicles.map(v => (
                  <button 
                    key={v.id} 
                    onClick={() => onViewVehicle?.(v)}
                    className="glass-panel rounded-2xl p-4 border-white/5 flex flex-col gap-4 text-left active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center overflow-hidden border border-white/5">
                        {v.photoURL ? (
                          <img src={v.photoURL} alt={v.nickname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          v.type === 'car' ? <Car className="w-6 h-6 text-zinc-700" /> : <Navigation className="w-6 h-6 -rotate-90 text-zinc-700" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{v.nickname}</h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">{v.brand} {v.model} â€¢ {v.year}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

            {activeProfileTab === 'runs' && (
              <div className="space-y-4 pb-12">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-primary" />
                  àšltimos Tempos
                </h3>
              </div>
              
              <div className="space-y-2">
                {runs.map(run => (
                  <div key={run.id} className="bg-zinc-900/50 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-brand-primary uppercase italic">
                        {run.config.mode === 'speed' ? `0-${run.config.target} KM/H` : `${run.config.target}M`}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-bold">{new Date(run.timestamp).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-display font-black italic text-white leading-none">
                        {run.time.toFixed(2)}s
                      </p>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase">{run.maxSpeed.toFixed(0)} KM/H</p>
                    </div>
                  </div>
                ))}
                {runs.length === 0 && (
                  <p className="text-center py-8 text-zinc-600 text-[10px] font-bold uppercase">Nenhuma puxada registrada</p>
                )}
                </div>
              </div>
            )}

            {activeProfileTab === 'library' && (
              <ProfileLibrary 
                uid={uid} 
                currentUserId={currentUserId} 
                profile={profile} 
              />
            )}
          </>
        )}
      </div>
  );
}
function RegionalRanking({ 
  userLocation, 
  onBack,
  onViewProfile
}: { 
  userLocation: { latitude: number, longitude: number } | null, 
  onBack: () => void,
  onViewProfile: (uid: string) => void
}) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [filter, setFilter] = useState<'regional' | 'regional-100' | 'general' | 'regional-201'>('regional-201');
  const [typeFilter, setTypeFilter] = useState<'all' | 'car' | 'motorcycle'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const date = new Date();
    const monthId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const categoryId = filter.includes('201') || filter === 'regional-201' ? '201m' : '0-100';
    const docId = `global_${categoryId}_${monthId}`;

    const unsubscribe = onSnapshot(doc(db, 'leaderboards', docId), (snapshot) => {
      if (snapshot.exists()) {
        setRankings(snapshot.data().entries || []);
      } else {
        setRankings([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [filter]);

  const filteredRankings = useMemo(() => {
    let result = rankings;

    // Filter by vehicle type
    if (typeFilter !== 'all') {
      result = result.filter(entry => entry.vehicleType === typeFilter);
    }

    // Filter by region
    if (filter.startsWith('regional') && userLocation) {
      const maxDist = filter === 'regional-100' ? 100000 : 20000;
      result = result.filter(entry => {
        const dist = calculateDistance(
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: entry.latitude, longitude: entry.longitude }
        );
        return dist <= maxDist;
      });
    }
    
    return result;
  }, [rankings, filter, typeFilter, userLocation]);

  return (
    <div className="flex-1 flex flex-col p-6 pb-32 space-y-6 overflow-y-auto bg-zinc-950">
      <div className="flex items-center gap-4 bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20">
        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none">RANKING {filter.includes('201') ? '201M' : '0-100'}</h2>
          <p className="text-xs text-brand-primary font-bold uppercase tracking-widest mt-1">Temporada de {new Date().toLocaleString('pt-BR', { month: 'long' })}</p>
        </div>
      </div>

      <div className="space-y-4 pb-24">
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-white/5">
          <button 
            onClick={() => setFilter('regional')}
            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === 'regional' ? 'bg-brand-primary text-white shadow-lg' : 'text-zinc-500'}`}
          >
            0-100 (20km)
          </button>
          <button 
            onClick={() => setFilter('regional-201')}
            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === 'regional-201' ? 'bg-brand-primary text-white shadow-lg' : 'text-zinc-500'}`}
          >
            201m (20km)
          </button>
          <button 
            onClick={() => setFilter('general')}
            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === 'general' ? 'bg-brand-primary text-white shadow-lg' : 'text-zinc-500'}`}
          >
            Geral
          </button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setTypeFilter('all')}
            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${typeFilter === 'all' ? 'bg-white text-zinc-950 border-white' : 'bg-zinc-900 text-zinc-500 border-white/5'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setTypeFilter('car')}
            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${typeFilter === 'car' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-zinc-900 text-zinc-500 border-white/5'}`}
          >
            Carros
          </button>
          <button 
            onClick={() => setTypeFilter('motorcycle')}
            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${typeFilter === 'motorcycle' ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-zinc-900 text-zinc-500 border-white/5'}`}
          >
            Motos
          </button>
        </div>
      </div>

        {/* Standard List Section with Top 3 Highlights */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRankings.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="w-6 h-6 text-zinc-700" />
              </div>
              <p className="text-zinc-500 text-xs font-bold uppercase">Nenhum tempo registrado nesta regià£o</p>
            </div>
          ) : (
            filteredRankings.map((entry, index) => {
               const pos = index + 1;
               const isTop3 = pos <= 3;
               const isGold = pos === 1;
               const isSilver = pos === 2;
               const isBronze = pos === 3;

               return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={entry.id}
                    onClick={() => onViewProfile(entry.uid)}
                    className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98]
                      ${isGold ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30' : 
                        isSilver ? 'bg-gradient-to-r from-zinc-400/10 to-transparent border-zinc-400/20' : 
                        isBronze ? 'bg-gradient-to-r from-orange-700/10 to-transparent border-orange-700/20' :
                        'bg-zinc-900/40 border-white/5 hover:bg-white/5'}`}
                  >
                     {/* Rank Position */}
                     <div className="w-8 flex flex-col items-center justify-center">
                        {isTop3 ? (
                          <Trophy className={`w-5 h-5 fill-current ${isGold ? 'text-yellow-500' : isSilver ? 'text-zinc-400' : 'text-orange-600'}`} />
                        ) : (
                          <span className="text-zinc-500 font-display font-black italic text-xs">#{pos}</span>
                        )}
                     </div>

                     {/* Photo */}
                     <div className={`relative shrink-0 w-11 h-11 rounded-xl overflow-hidden border transition-colors bg-zinc-950
                        ${isGold ? 'border-yellow-500' : isSilver ? 'border-zinc-400' : isBronze ? 'border-orange-700' : 'border-white/10'}`}>
                        {entry.userPhoto ? (
                          <img src={entry.userPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-5 h-5 text-zinc-800 m-auto" />
                        )}
                     </div>

                     {/* Pilot & Vehicle Info */}
                     <div className="flex-1 min-w-0">
                        <h4 className={`font-black uppercase italic truncate tracking-tight ${isGold ? 'text-yellow-500 text-xs' : 'text-white text-[11px]'}`}>
                          {entry.userName}
                        </h4>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase truncate flex items-center gap-1.5 mt-0.5">
                           <Car className="w-2.5 h-2.5 opacity-40" />
                           {entry.vehicleName}
                        </p>
                     </div>

                     {/* Score & Time Results */}
                     <div className="text-right">
                        <p className={`font-display font-black italic transition-colors leading-none
                           ${isGold ? 'text-xl text-yellow-500' : 'text-lg text-white'}`}>
                           {entry.performanceScore?.toFixed(0) || '0'} <span className="text-[8px] uppercase tracking-tighter">pts</span>
                        </p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">{entry.time.toFixed(2)}s â€¢ {Math.round(entry.maxSpeed)} KM/H</p>
                     </div>
                  </motion.div>
               );
            })
          )}
        </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
        <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
          Apenas puxadas realizadas em <span className="text-white font-bold">plano ou subida</span> sà£o válidas para o ranking. Descidas sà£o automaticamente invalidadas pelo sistema.
        </p>
      </div>
    </div>
  );
}

function RegionalRankingElite({ 
  userLocation, 
  onBack,
  onViewProfile
}: { 
  userLocation: { latitude: number, longitude: number } | null, 
  onBack: () => void,
  onViewProfile: (uid: string) => void
}) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [filter, setFilter] = useState<'regional' | 'regional-100' | 'general'>('regional');
  const [category, setCategory] = useState<'0-100' | '201m'>('201m');
  const [typeFilter, setTypeFilter] = useState<'all' | 'car' | 'motorcycle'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const date = new Date();
    const monthId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const docId = `global_${category}_${monthId}`;

    const unsubscribe = onSnapshot(doc(db, 'leaderboards', docId), (snapshot) => {
      if (snapshot.exists()) {
        setRankings(snapshot.data().entries || []);
      } else {
        setRankings([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [category]);

  const filteredRankings = useMemo(() => {
    let result = rankings;
    if (typeFilter !== 'all') {
      result = result.filter(entry => entry.vehicleType === typeFilter);
    }
    if (filter !== 'general' && userLocation) {
      const maxDist = filter === 'regional-100' ? 100000 : 20000;
      result = result.filter(entry => {
        const dist = calculateDistance(
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: entry.latitude, longitude: entry.longitude }
        );
        return dist <= maxDist;
      });
    }
    return result;
  }, [rankings, filter, typeFilter, userLocation]);

  const top3 = filteredRankings.slice(0, 3);
  const others = filteredRankings.slice(3);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-32 relative bg-[#0a0a0a]">
       {/* Carbon Fiber Realistic Background */}
       <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 0)', backgroundSize: '4px 4px' }} />
       
       <div className="p-6 space-y-8 relative z-10">
          <header className="flex items-center justify-between">
            <button onClick={onBack} className="p-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 text-white active:scale-95 transition-all">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-right">
              <h2 className="text-3xl font-display font-black italic text-white leading-none tracking-tighter">ELITE <span className="text-brand-primary underline decoration-2">RANK</span></h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mt-1">Tempo de {new Date().toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}</p>
            </div>
          </header>

          {/* Luxury Filter Toggle */}
          <div className="flex flex-col gap-4">
            <div className="flex p-1.5 bg-white/5 backdrop-blur-md rounded-[24px] border border-white/5">
               {['0-100', '201m'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setCategory(cat as any)}
                    className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-[18px] transition-all duration-500 ${category === cat ? 'bg-brand-primary text-white shadow-[0_5px_15px_rgba(239,68,68,0.3)] scale-[1.02]' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {cat === '0-100' ? '0-100 KM/H' : '201 METROS'}
                  </button>
               ))}
            </div>

            <div className="flex gap-2">
               {['regional', 'regional-100', 'general'].map((f) => (
                  <button 
                    key={f}
                    onClick={() => setFilter(f as any)}
                    className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-xl border transition-all ${filter === f ? 'bg-white/10 border-white/30 text-white' : 'bg-transparent border-white/5 text-zinc-700'}`}
                  >
                    {f === 'regional' ? '20 KM' : f === 'regional-100' ? '100 KM' : 'GLOBAL'}
                  </button>
               ))}
            </div>
          </div>

          {/* Unified List Section with Top 3 Highlights */}
          <div className="space-y-3">
             {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                   <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                   <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em]">Sincronizando Satélites</p>
                </div>
             ) : filteredRankings.length === 0 ? (
               <div className="text-center py-20 bg-white/5 rounded-[40px] border border-white/5">
                 <Trophy className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                 <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Pista Vazia</p>
               </div>
             ) : (
                filteredRankings.map((entry, index) => {
                   const pos = index + 1;
                   const isTop3 = pos <= 3;
                   const isGold = pos === 1;
                   const isSilver = pos === 2;
                   const isBronze = pos === 3;

                   return (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={entry.id}
                        onClick={() => onViewProfile(entry.uid)}
                        className={`group relative flex items-center gap-4 p-4 rounded-[28px] border transition-all active:scale-[0.98]
                          ${isGold ? 'bg-gradient-to-r from-yellow-500/20 via-yellow-500/5 to-transparent border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]' : 
                            isSilver ? 'bg-gradient-to-r from-zinc-400/10 to-transparent border-zinc-400/20' : 
                            isBronze ? 'bg-gradient-to-r from-orange-700/10 to-transparent border-orange-700/20' :
                            'bg-[#121212]/50 backdrop-blur-xl border-white/5 hover:bg-white/5'}`}
                      >
                         {/* Rank Position */}
                         <div className="w-8 flex flex-col items-center justify-center relative">
                            {isTop3 ? (
                              <Trophy className={`w-5 h-5 fill-current ${isGold ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : isSilver ? 'text-zinc-400' : 'text-orange-600'}`} />
                            ) : (
                              <span className="text-zinc-600 font-display font-black italic text-xs tracking-tighter">#{pos}</span>
                            )}
                         </div>

                         {/* Photo */}
                         <div className={`relative shrink-0 ${isTop3 ? 'w-14 h-14' : 'w-12 h-12'} rounded-2xl overflow-hidden border-2 transition-colors bg-zinc-950
                            ${isGold ? 'border-yellow-500' : isSilver ? 'border-zinc-400' : isBronze ? 'border-orange-700' : 'border-white/10 group-hover:border-brand-primary/50'}`}>
                            {entry.userPhoto ? (
                              <img src={entry.userPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-6 h-6 text-zinc-800 m-auto" />
                            )}
                         </div>

                         {/* Pilot & Vehicle Info */}
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                               <h4 className={`font-black uppercase italic truncate tracking-tight ${isGold ? 'text-yellow-500 text-sm' : 'text-white text-xs'}`}>
                                 {entry.userName}
                               </h4>
                               {entry.vehicleType === 'motorcycle' && <Navigation className="w-3 h-3 text-brand-secondary -rotate-90" />}
                            </div>
                            <p className="text-[9px] text-zinc-400 font-black tracking-widest uppercase truncate flex items-center gap-2">
                               <Car className="w-3 h-3 opacity-40" />
                               {entry.vehicleName || 'Veículo Desconhecido'}
                            </p>
                         </div>

                         {/* Score & Time Results */}
                         <div className="text-right">
                            <p className={`font-display font-black italic transition-colors leading-none mb-1
                               ${isGold ? 'text-2xl text-yellow-500 glow-yellow' : 'text-xl text-white group-hover:text-brand-primary'}`}>
                               {entry.performanceScore?.toFixed(0) || '0'} <span className="text-[8px] uppercase tracking-tighter">pts</span>
                            </p>
                            <div className="flex flex-col items-end opacity-60">
                               <span className="text-[10px] font-black text-zinc-400">{entry.time.toFixed(2)}s</span>
                               <span className="text-[8px] font-bold text-zinc-500">{Math.round(entry.maxSpeed)} KM/H</span>
                            </div>
                         </div>

                         {/* High-End Decor Lines for Top 3 */}
                         {isTop3 && (
                           <div className={`absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none overflow-hidden rounded-tr-[28px]`}>
                              <div className={`absolute -top-16 -right-16 w-32 h-32 rotate-45 ${isGold ? 'bg-yellow-500' : isSilver ? 'bg-zinc-400' : 'bg-orange-700'}`} />
                           </div>
                         )}
                      </motion.div>
                   )
                })
             )}
          </div>

          <div className="p-4 rounded-3xl bg-brand-primary/5 border border-brand-primary/20 flex gap-3">
             <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0" />
             <div>
                <p className="text-[10px] font-black text-brand-primary uppercase mb-1">Nota de Aferição</p>
                <p className="text-[9px] text-zinc-400 font-bold leading-relaxed italic">Somente puxadas em terreno nivelado ou aclive ascendente sà£o homologadas pela liga Elite DragFire.</p>
             </div>
          </div>
       </div>
    </div>
  );
}


function ProfileSettings({ 
  user, 
  userProfile,
  onUpdate, 
  onBack 
}: { 
  user: FirebaseUser | null, 
  userProfile: UserProfile | null,
  onUpdate: (data: Partial<UserProfile>) => void, 
  onBack: () => void 
}) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [instagram, setInstagram] = useState(userProfile?.instagram || '');
  const [isPrivate, setIsPrivate] = useState(userProfile?.isPrivate || false);
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [handle, setHandle] = useState(userProfile?.handle || '');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [privacySettings, setPrivacySettings] = useState(userProfile?.privacySettings || {
    isPrivate: false,
    showHistory: true,
    showGarage: true,
    showRankings: true
  });
  const [uploading, setUploading] = useState(false);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoadingRequests(true);
    const q = query(collection(db, 'follow_requests'), where('followingId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requests = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const userDoc = await getDoc(doc(db, 'users', data.followerId));
        requests.push({
          id: d.id,
          ...data,
          userName: userDoc.exists() ? userDoc.data().displayName : 'Piloto',
          userPhoto: userDoc.exists() ? userDoc.data().photoURL : null
        });
      }
      setFollowRequests(requests);
      setLoadingRequests(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAcceptRequest = async (request: any) => {
    try {
      const batch = writeBatch(db);
      
      // Add to follows
      const followId = `${request.followerId}_${user?.uid}`;
      batch.set(doc(db, 'follows', followId), {
        followerId: request.followerId,
        followingId: user?.uid,
        timestamp: Date.now()
      });

      // Delete request
      batch.delete(doc(db, 'follow_requests', request.id));

      await batch.commit();
    } catch (error) {
      console.error("Error accepting follow request:", error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'follow_requests', requestId));
    } catch (error) {
      console.error("Error rejecting follow request:", error);
    }
  };

  const handleUpgrade = () => {
    // Simulate upgrade
    onUpdate({ isPremium: true });
  };

  const handleFileChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', null, 
          (error) => {
            console.error('Profile upload failed:', error);
            reject(error);
          }, 
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              setPhotoURL(url);
              onUpdate({ photoURL: url });
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      setUploading(false);
    }
  };

  const checkHandle = async (val: string) => {
    if (!val || val === userProfile?.handle) {
      setHandleError(null);
      return;
    }
    setIsCheckingHandle(true);
    try {
      const q = query(collection(db, 'users'), where('handle', '==', val));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setHandleError('Este identificador já está sendo usado por outro piloto.');
      } else {
        setHandleError(null);
      }
    } catch (e) {
      console.error("Error checking handle:", e);
    } finally {
      setIsCheckingHandle(false);
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (handleError) return;
    onUpdate({ 
      displayName, 
      bio, 
      instagram, 
      isPrivate: privacySettings.isPrivate,
      handle: handle.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
      privacySettings 
    });
    onBack();
  };

  return (
    <div className="flex-1 flex flex-col p-6 pb-32 space-y-6 overflow-y-auto bg-zinc-950">
      <div className="flex items-center gap-4 bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20">
        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none">PERFIL</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-brand-primary font-bold uppercase tracking-widest">Dados do Piloto</p>
            {userProfile?.isPremium && (
              <span className="bg-yellow-500 text-zinc-950 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Premium</span>
            )}
          </div>
        </div>
      </div>

      {!userProfile?.isPremium && (
        <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3 text-yellow-500">
            <Zap className="w-5 h-5" />
            <h3 className="text-xs font-black uppercase tracking-widest">Seja Premium</h3>
          </div>
          <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
            Desbloqueie vantagens exclusivas: garagem ilimitada, fotos reais dos veículos, histórico completo e gráficos de performance!
          </p>
          <button 
            onClick={handleUpgrade}
            className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
          >
            ASSINAR AGORA
          </button>
        </div>
      )}

      <div className="flex flex-col items-center space-y-4">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-brand-primary/30 shadow-lg shadow-brand-primary/10">
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <User className="w-10 h-10 text-zinc-700" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <label className="absolute bottom-0 right-0 p-2 bg-brand-primary rounded-full text-white shadow-lg cursor-pointer hover:bg-red-500 transition-colors active:scale-90">
            <CameraIcon className="w-4 h-4" />
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={uploading} />
          </label>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Toque na cà¢mera para alterar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {followRequests.length > 0 && (
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Solicitaà§ões de Seguidores ({followRequests.length})</label>
            <div className="space-y-2">
              {followRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-3 bg-zinc-900 border border-white/5 rounded-xl">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
                    {req.userPhoto ? (
                      <img src={req.userPhoto} alt={req.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-5 h-5 text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{req.userName}</p>
                    <p className="text-[9px] text-zinc-500 uppercase font-black tracking-tighter">Quer te seguir</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleRejectRequest(req.id)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleAcceptRequest(req)}
                      className="p-2 bg-brand-primary hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Nome de Piloto</label>
          <input 
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Seu nome ou apelido"
            className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 transition-colors"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Bio / Slogan</label>
          <textarea 
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Ex: Piloto de final de semana..."
            className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary/50 outline-none transition-all resize-none h-24"
            maxLength={150}
          />
          <p className="text-[9px] text-zinc-600 text-right">{bio.length}/150</p>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Racing ID & Social</label>
          
          <div className="space-y-1.5">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-brand-primary text-lg">#</span>
              <input 
                type="text"
                value={handle}
                onChange={e => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                  setHandle(val);
                  checkHandle(val);
                }}
                placeholder="seu_nome_de_piloto"
                className={`w-full bg-zinc-900 border ${handleError ? 'border-red-500' : 'border-white/5'} rounded-xl py-4 pl-10 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 transition-colors uppercase font-black italic tracking-tighter`}
              />
            </div>
            {isCheckingHandle && <p className="text-[8px] text-zinc-500 animate-pulse px-1">Verificando disponibilidade...</p>}
            {handleError && <p className="text-[8px] text-red-500 px-1">{handleError}</p>}
            {!handleError && handle && <p className="text-[8px] text-green-500 px-1">Identificador disponível!</p>}
          </div>

          <div className="relative">
            <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              placeholder="@seu_perfil"
              className="w-full bg-zinc-900 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Central de Privacidade */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 px-1">
            <Shield className="w-4 h-4 text-brand-primary" />
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Central de Privacidade</label>
          </div>

          <div className="space-y-2">
            {[
              { id: 'isPrivate', label: 'Conta Privada', desc: 'Apenas seguidores podem ver seu perfil completo', icon: Lock },
              { id: 'showHistory', label: 'Mostrar Histórico', desc: 'Permitir que outros vejam suas puxadas salvas', icon: History },
              { id: 'showGarage', label: 'Mostrar Garagem', desc: 'Permitir que outros vejam seus veículos', icon: Car },
              { id: 'showRankings', label: 'Aparecer no Ranking', desc: 'Permitir que seu tempo apareà§a no ranking global', icon: Trophy }
            ].map((item) => (
              <div 
                key={item.id}
                onClick={() => setPrivacySettings({ ...privacySettings, [item.id]: !((privacySettings as any)[item.id]) })}
                className="flex items-center justify-between p-4 bg-zinc-900 border border-white/5 rounded-2xl cursor-pointer hover:border-brand-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${((privacySettings as any)[item.id]) ? 'bg-brand-primary/10 text-brand-primary' : 'bg-zinc-800 text-zinc-500'}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{item.label}</p>
                    <p className="text-[9px] text-zinc-500 font-medium">{item.desc}</p>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full p-1 transition-colors ${((privacySettings as any)[item.id]) ? 'bg-brand-primary' : 'bg-zinc-800'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${((privacySettings as any)[item.id]) ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">E-mail (Nà£o editável)</label>
          <input 
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl p-4 text-zinc-500 cursor-not-allowed"
          />
        </div>

        <div className="pt-4">
          <button 
            type="submit"
            className="w-full py-4 bg-brand-primary hover:bg-red-500 rounded-xl font-display font-black text-lg italic tracking-tight flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all active:scale-95"
          >
            <Zap className="w-5 h-5" />
            SALVAR ALTERAà‡à•ES
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingsMenu({ 
  user, 
  isGuest, 
  vehicles,
  activeVehicle,
  onSelectVehicle,
  onNavigate, 
  onBack,
  gpsSource,
  onToggleGpsSource,
  onRefreshGps,
  isAdmin,
  uiPreference,
  onToggleUiPreference
}: { 
  user: FirebaseUser | null, 
  isGuest: boolean, 
  vehicles: Vehicle[],
  activeVehicle: Vehicle | null,
  onSelectVehicle: (v: Vehicle) => void,
  onNavigate: (screen: Screen) => void, 
  onBack: () => void,
  gpsSource: 'internal' | 'external',
  onToggleGpsSource: () => void,
  onRefreshGps: () => void,
  isAdmin?: boolean,
  uiPreference?: 'classic' | 'elite',
  onToggleUiPreference: () => void
}) {
  return (
    <div className="flex-1 flex flex-col p-6 pb-32 space-y-6 overflow-y-auto bg-zinc-950">
      <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none">AJUSTES</h2>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Menu de Configuraà§ões</p>
        </div>
      </div>

      {!isGuest && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">Veículo Ativo</h3>
          
          {activeVehicle ? (
            <div className="flex flex-col items-center p-6 bg-zinc-900/50 border border-white/5 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-brand-primary/10 to-transparent" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-32 h-32 rounded-2xl bg-zinc-800 border-2 border-brand-primary/30 flex items-center justify-center overflow-hidden mb-4 shadow-2xl">
                  {activeVehicle.photoURL ? (
                    <img 
                      src={activeVehicle.photoURL} 
                      alt={activeVehicle.nickname} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <Car className="w-12 h-12 text-zinc-700" />
                  )}
                </div>
                
                <h4 className="text-xl font-display font-black italic text-white mb-1 uppercase tracking-tight">{activeVehicle.nickname}</h4>
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                  <span>{activeVehicle.brand}</span>
                  <div className="w-1 h-1 rounded-full bg-zinc-700" />
                  <span>{activeVehicle.model}</span>
                  <div className="w-1 h-1 rounded-full bg-zinc-700" />
                  <span>{activeVehicle.year}</span>
                </div>
                
                <button 
                  onClick={() => onNavigate('vehicle-settings')}
                  className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-all active:scale-95"
                >
                  Editar Veículo
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => onNavigate('vehicle-settings')}
              className="w-full p-8 bg-zinc-900/30 border border-dashed border-white/10 rounded-3xl flex flex-col items-center gap-3 text-zinc-500 hover:bg-zinc-900/50 transition-all"
            >
              <Plus className="w-8 h-8" />
              <span className="text-xs font-bold uppercase tracking-widest">Adicionar Veículo</span>
            </button>
          )}

          {vehicles.length > 1 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest px-1">Trocar Veículo</p>
              <div className="grid grid-cols-1 gap-2">
                {vehicles.filter(v => v.id !== activeVehicle?.id).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onSelectVehicle(v)}
                    className="flex items-center gap-3 p-3 bg-zinc-900/30 border border-white/5 rounded-xl hover:bg-zinc-900/50 transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                      {v.type === 'car' ? <Car className="w-4 h-4 text-zinc-600" /> : <Navigation className="w-4 h-4 -rotate-90 text-zinc-600" />}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-bold text-zinc-400">{v.nickname}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">Conta e Perfil</h3>
        
        <button 
          onClick={() => isGuest ? null : onNavigate('profile-settings')}
          className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${isGuest ? 'bg-zinc-900/30 border-white/5 opacity-50 cursor-not-allowed' : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900 hover:border-white/10 active:scale-[0.98]'}`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isGuest ? 'bg-zinc-800' : 'bg-brand-primary/10'}`}>
            {isGuest ? <Lock className="w-5 h-5 text-zinc-600" /> : <User className="w-5 h-5 text-brand-primary" />}
          </div>
          <div className="flex-1 text-left">
            <h4 className="text-sm font-bold text-white">Meu Perfil</h4>
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Dados e foto do piloto</p>
          </div>
          {!isGuest && <ChevronRight className="w-5 h-5 text-zinc-700" />}
        </button>

        <button 
          onClick={() => isGuest ? null : onNavigate('vehicle-settings')}
          className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${isGuest ? 'bg-zinc-900/30 border-white/5 opacity-50 cursor-not-allowed' : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900 hover:border-white/10 active:scale-[0.98]'}`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isGuest ? 'bg-zinc-800' : 'bg-brand-secondary/10'}`}>
            {isGuest ? <Lock className="w-5 h-5 text-zinc-600" /> : <Car className="w-5 h-5 text-brand-secondary" />}
          </div>
          <div className="flex-1 text-left">
            <h4 className="text-sm font-bold text-white">Meus Veículos</h4>
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Gerenciar garagem</p>
          </div>
          {!isGuest && <ChevronRight className="w-5 h-5 text-zinc-700" />}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">Hardware e Sensores</h3>
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl divide-y divide-white/5">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gpsSource === 'internal' ? 'bg-zinc-800' : 'bg-brand-primary/10'}`}>
                <Cpu className={`w-5 h-5 ${gpsSource === 'internal' ? 'text-zinc-500' : 'text-brand-primary'}`} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Antena GPS Externa</h4>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Usar sensor de alta precisà£o</p>
              </div>
            </div>
            <button 
              onClick={onToggleGpsSource}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${gpsSource === 'external' ? 'bg-brand-primary' : 'bg-zinc-800'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${gpsSource === 'external' ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                <RefreshCcw className="w-5 h-5 text-zinc-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Reiniciar GPS</h4>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Forà§ar liberação do sensor (Xiaomi/Android)</p>
              </div>
            </div>
            <button 
              onClick={onRefreshGps}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95"
            >
              Reiniciar
            </button>
          </div>

          {gpsSource === 'external' && (
            <div className="p-4 bg-brand-primary/5">
              <button className="w-full py-3 bg-zinc-900 border border-brand-primary/30 rounded-xl text-brand-primary text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all">
                <Bluetooth className="w-4 h-4" />
                Conectar Dispositivo
              </button>
              <p className="text-[9px] text-zinc-500 mt-2 text-center italic">
                Suporte para VBOX, RaceBox e antenas Bluetooth 10Hz+
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">Aplicativo</h3>
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl divide-y divide-white/5">
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-300">Versà£o</span>
            <span className="text-xs font-mono text-zinc-500">v{APP_VERSION}</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-300">Termos de Uso</span>
            <button onClick={() => onNavigate('terms')} className="text-xs font-bold text-brand-primary uppercase tracking-widest">Ver</button>
          </div>
          <div className="p-4 flex items-center justify-between bg-brand-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                <CloudUpload className="w-4 h-4 text-brand-primary" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Importar Dados ANP</h4>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Planilhas Oficiais</p>
              </div>
            </div>
            <button 
              onClick={() => onNavigate('anp-import')}
              className="px-4 py-2 bg-brand-primary rounded-lg text-[9px] font-black uppercase tracking-widest text-white transition-all active:scale-95"
            >
              Abrir
            </button>
          </div>
          <div className="p-4 flex items-center justify-between bg-cyan-500/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <MapIcon className="w-4 h-4 text-cyan-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Mapas Offline</h4>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Navegação sem Internet</p>
              </div>
            </div>
            <button 
              onClick={() => onNavigate('offline-maps')}
              className="px-4 py-2 bg-cyan-500 rounded-lg text-[9px] font-black uppercase tracking-widest text-white transition-all active:scale-95"
            >
              Abrir
            </button>
          </div>
          
          {isAdmin && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Função Admin</h4>
                    <p className="text-[10px] text-yellow-500 uppercase font-bold">Painel de Controle</p>
                  </div>
                </div>
                <button 
                  onClick={() => onNavigate('admin-dashboard')}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-950 transition-all active:scale-95"
                >
                  Acessar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isGuest && (
        <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
          <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
            Você está no <span className="text-brand-primary font-bold">Modo Visitante</span>. 
            Crie uma conta para salvar seus veículos, fotos e tempos na nuvem.
          </p>
        </div>
      )}
    </div>
  );
}


function TermsOfUse({ onAccept, onDecline }: { onAccept: () => void, onDecline: () => void }) {
  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto bg-zinc-950">
      <div className="flex flex-col items-center text-center space-y-4 pt-4">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center border border-brand-primary/20">
          <AlertCircle className="w-8 h-8 text-brand-primary" />
        </div>
        <h2 className="text-2xl font-display font-black italic text-white uppercase tracking-tighter">
          TERMOS DE USO E RESPONSABILIDADE
        </h2>
      </div>

      <div className="glass-panel rounded-2xl p-6 border-white/5 space-y-6 text-zinc-400 text-sm leading-relaxed">
        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">1. ACEITAà‡àƒO DOS TERMOS</h3>
          <p>Ao clicar em â€œACEITO E CONTINUARâ€, você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso, Responsabilidade e Política de Privacidade. Caso nà£o concorde, selecione â€œNàƒO ACEITOâ€, e o uso do aplicativo será interrompido.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">2. FINALIDADE DO APLICATIVO</h3>
          <p>O <span className="text-white font-bold">DRAGFIRE</span> é um aplicativo destinado ao monitoramento de desempenho veicular, incluindo medià§ões como aceleração (0â€“100 km/h, 0â€“200 km/h), tempo, velocidade e outras métricas.</p>
          <p className="text-brand-primary/80 font-medium italic">âš ï¸ O uso é permitido exclusivamente em ambientes privados, controlados e legalmente autorizados, como pistas fechadas, autódromos ou propriedades particulares.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-brand-primary font-black text-[10px] uppercase tracking-widest">3. USO PROIBIDO</h3>
          <p>à‰ expressamente proibido:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Utilizar o aplicativo em vias públicas para testes de desempenho;</li>
            <li>Praticar direção perigosa ou ilegal com base nas informaà§ões do app;</li>
            <li>Utilizar o aplicativo de forma que viole leis de trà¢nsito ou normas de seguranà§a.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">4. RESPONSABILIDADE DO USUàRIO</h3>
          <p>O usuário declara que:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Utiliza o aplicativo por sua conta e risco;</li>
            <li>Cumpre integralmente a legislação vigente;</li>
            <li>à‰ o único responsável pela condução do veículo;</li>
            <li>Assume total responsabilidade por quaisquer danos materiais, pessoais ou a terceiros decorrentes do uso.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">5. ISENà‡àƒO DE RESPONSABILIDADE</h3>
          <p>O <span className="text-white font-bold">DRAGFIRE</span> nà£o se responsabiliza por:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Acidentes, multas, penalidades ou infraà§ões;</li>
            <li>Danos ao veículo, ao usuário ou terceiros;</li>
            <li>Uso indevido, ilegal ou imprudente do aplicativo;</li>
            <li>Decisões tomadas com base nos dados fornecidos.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">6. LIMITAà‡àƒO DE GARANTIA</h3>
          <p>O aplicativo é fornecido â€œcomo estáâ€, sem garantias de precisà£o absoluta dos dados, funcionamento ininterrupto ou livre de erros.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">7. COLETA DE DADOS (LGPD)</h3>
          <p>Para funcionamento do aplicativo, poderà£o ser coletados dados de localização (GPS), desempenho do veículo, dados do dispositivo e informaà§ões fornecidas pelo usuário.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">8. FINALIDADE DO TRATAMENTO DE DADOS</h3>
          <p>Os dados coletados serà£o utilizados para o funcionamento das funcionalidades, geração de métricas, melhoria da experiência e seguranà§a.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">9. COMPARTILHAMENTO DE DADOS</h3>
          <p>Os dados nà£o serà£o vendidos. Poderà£o ser compartilhados apenas quando necessário para funcionamento técnico ou por obrigação legal.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">10. ARMAZENAMENTO E SEGURANà‡A</h3>
          <p>Os dados sà£o armazenados em ambiente seguro, com medidas técnicas adequadas para proteção contra acesso nà£o autorizado.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">11. DIREITOS DO USUàRIO (LGPD)</h3>
          <p>Você pode solicitar acesso, correção ou exclusà£o dos seus dados através do contato: <span className="text-white font-bold">guisq1515@gmail.com</span></p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">12. RETENà‡àƒO DE DADOS</h3>
          <p>Os dados serà£o armazenados apenas pelo tempo necessário para cumprir as finalidades descritas ou conforme exigido por lei.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">13. ALTERAà‡à•ES NOS TERMOS</h3>
          <p>Estes termos podem ser atualizados a qualquer momento. O uso contínuo do app após alteraà§ões implica nova aceitação.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">14. LEGISLAà‡àƒO E FORO</h3>
          <p>Este termo será regido pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de Sà£o Paulo/SP para resolução de conflitos.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">15. CONSENTIMENTO FINAL</h3>
          <p>Ao clicar em â€œACEITO E CONTINUARâ€, você declara que leu e concorda com todos os termos, autoriza o tratamento de dados e assume total responsabilidade pelo uso.</p>
        </div>
      </div>

      <div className="pb-8 space-y-3">
        <button 
          onClick={onAccept}
          className="w-full py-4 bg-brand-primary hover:bg-red-500 rounded-xl font-display font-black text-lg italic tracking-tight flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all active:scale-95"
        >
          <Zap className="w-5 h-5" />
          ACEITO E CONTINUAR
        </button>
        <button 
          onClick={onDecline}
          className="w-full py-3 bg-zinc-900 text-zinc-500 rounded-xl font-bold text-sm hover:text-white transition-all active:scale-95 border border-white/5"
        >
          NàƒO ACEITO
        </button>
      </div>
    </div>
  );
}

function VehicleSettings({ 
  vehicles,
  userProfile,
  isPremium,
  userId,
  editingVehicle,
  setEditingVehicle,
  onSave, 
  onDelete,
  onBack,
  setScreen,
  setCatalogVehicle
}: { 
  vehicles: Vehicle[], 
  userProfile: UserProfile | null,
  isPremium: boolean,
  userId: string,
  editingVehicle: Vehicle | null,
  setEditingVehicle: (v: Vehicle | null) => void,
  onSave: (v: Vehicle) => void, 
  onDelete: (v: Vehicle) => void,
  onBack: () => void,
  setScreen: (v: string) => void,
  setCatalogVehicle: (v: Vehicle | null) => void
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const canAddMore = isPremium || vehicles.length < 1;
  const baseVehicle: Vehicle = {
    uid: userId || '',
    type: 'car',
    nickname: '',
    brand: '',
    model: '',
    year: YEARS[0],
    category: 'custom',
    photoURL: '',
    hp: 0,
    stage: 'Stock',
    maxSpeed: 0,
    mods: '',
    observations: '',
    engine: '',
    transmission: '',
    weight: 0,
    stockHp: 0,
    stockTorque: 0,
    stockWeight: 0,
    catalogLayout: 'overlay'
  };
  const STAGES_LIST = ['Stock', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage Max'];
  const [formData, setFormData] = useState<Vehicle>(editingVehicle || baseVehicle);
  
  // Update formData if editingVehicle changes (important if component stays mounted)
  useEffect(() => {
    if (editingVehicle) {
      setFormData(editingVehicle);
    } else {
      setFormData(baseVehicle);
    }
  }, [editingVehicle]);

  const [activeTab, setActiveTab] = useState<'basics' | 'technical'>('basics');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement> | null) => {
    setIsUploading(true);
    setUploadProgress(1);
    
    try {
      if (!auth.currentUser) throw new Error('Usuário não autenticado.');
      
      // Forçar pedido de permissão no Android 13+
      const permission = await Camera.checkPermissions();
      if (permission.photos !== 'granted' || permission.camera !== 'granted') {
        await Camera.requestPermissions({ permissions: ['photos', 'camera'] });
      }

      await logRemote({ uid: auth.currentUser.uid, level: 'info', message: 'UPLOAD_MAIN_START', details: { vehicleId: formData.id } });
      
      let finalDataUrl = '';
      
      if (Capacitor.isNativePlatform() && !e) {
        setUploadStatus('[S1] Abrindo Galeria...');
        const photo = await Camera.getPhoto({
          quality: 60,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          width: 1024,
          height: 1024
        });

        if (!photo.dataUrl) throw new Error('Câmera não retornou os dados da imagem.');
        finalDataUrl = photo.dataUrl;
      } else if (e && e.target.files && e.target.files[0]) {
        setUploadStatus('[S1] Lendo arquivo...');
        const file = e.target.files[0];
        finalDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });
      }

      if (!finalDataUrl) throw new Error('Nenhuma imagem foi fornecida.');
      
      logRemote({ uid: auth.currentUser.uid, level: 'info', message: 'PHOTO_DATA_RECEIVED', details: { size_est: finalDataUrl.length } });
      
      setUploadStatus('[S2] Processando Foto...');
      setUploadProgress(50);
      
      setFormData({ ...formData, photoURL: finalDataUrl });
      
      setUploadProgress(90);
      setUploadStatus('Sucesso!');
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
      }, 1000);

    } catch (error: any) {
      console.error('Photo Error:', error);
      await logRemote({ 
        uid: auth?.currentUser?.uid || 'unknown', 
        level: 'error', 
        message: 'UPLOAD_MAIN_ERROR', 
        details: { message: error.message, stack: error.stack } 
      });
      alert(`Erro ao processar foto: ${error.message || 'Erro desconhecido'}`);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const handleAdditionalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement> | null) => {
    if (!auth.currentUser || !isPremium) return;
    
    setIsUploading(true);
    setUploadProgress(1);

    try {
      const currentPhotos = formData.photoURLs || [];
      if (currentPhotos.length >= 6) {
        alert('Limite de 6 fotos extras atingido.');
        setIsUploading(false);
        return;
      }

      // Forçar pedido de permissão no Android 13+
      const permission = await Camera.checkPermissions();
      if (permission.photos !== 'granted' || permission.camera !== 'granted') {
        await Camera.requestPermissions({ permissions: ['photos', 'camera'] });
      }

      let finalDataUrl = '';

      if (Capacitor.isNativePlatform() && !e) {
        setUploadStatus('[S1] Abrindo Galeria...');
        const photo = await Camera.getPhoto({
          quality: 60,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          width: 800,
          height: 800
        });

        if (!photo.dataUrl) throw new Error('Câmera não retornou os dados da imagem.');
        finalDataUrl = photo.dataUrl;
      } else if (e && e.target.files && e.target.files[0]) {
        setUploadStatus('[S1] Lendo arquivo...');
        const file = e.target.files[0];
        finalDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });
      }

      if (!finalDataUrl) throw new Error('Nenhuma imagem foi fornecida.');
      
      await logRemote({ uid: auth.currentUser.uid, level: 'info', message: 'EXTRA_PHOTO_DATA_RECEIVED', details: { size: finalDataUrl.length } });
      
      setUploadStatus('[S2] Adicionando Foto...');
      setUploadProgress(50);
      
      setFormData({
        ...formData,
        photoURLs: [...currentPhotos, finalDataUrl]
      });
      
      setUploadProgress(90);
      setUploadStatus('Sucesso!');
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
      }, 1000);

    } catch (error: any) {
      console.error('Extra photo error:', error);
      await logRemote({ 
        uid: auth?.currentUser?.uid || 'unknown', 
        level: 'error', 
        message: 'UPLOAD_EXTRA_ERROR', 
        details: { message: error.message, stack: error.stack } 
      });
      alert(`Erro ao processar foto extra: ${error.message || 'Erro desconhecido'}`);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };


  const removeExtraPhoto = async (url: string) => {
    try {
      const photoRef = ref(storage, url);
      await deleteObject(photoRef);
      setFormData({
        ...formData,
        photoURLs: formData.photoURLs?.filter(u => u !== url) || []
      });
    } catch (error) {
      console.error("Error removing extra photo:", error);
    }
  };
  const brands = useMemo(() => {
    return Object.keys(VEHICLE_DATA[formData.type] || {});
  }, [formData.type]);

  const models = useMemo(() => {
    if (!formData.brand) return [];
    return Object.keys(VEHICLE_DATA[formData.type]?.[formData.brand] || {});
  }, [formData.type, formData.brand]);

  const specs = useMemo(() => {
    if (!formData.brand || !formData.model) return [];
    return VEHICLE_DATA[formData.type]?.[formData.brand]?.[formData.model] || [];
  }, [formData.type, formData.brand, formData.model]);

  const [isFetchingAI, setIsFetchingAI] = useState(false);
  const handleMagicaIA = async () => {
    if (!formData.brand || !formData.model || !isPremium) return;
    setIsFetchingAI(true);
    try {
      const data = await fetchVehicleSpecs(formData.brand, formData.model, formData.year, formData.engine);
      setFormData(prev => ({
        ...prev,
        hp: data.hp || prev.hp,
        stockHp: data.hp,
        stockWeight: data.weight,
        weight: data.weight || prev.weight
      }));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsFetchingAI(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      // Ensure at least a nickname or brand/model is provided for better display
      const finalData = {
        ...formData,
        nickname: formData.nickname?.trim() || (formData.brand ? `${formData.brand} ${formData.model}` : 'Meu Veículo')
      };

      console.log('Submitting vehicle data:', finalData);
      await onSave(finalData);
      
      setEditingVehicle(null);
      setFormData(baseVehicle);
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      setSaveError(error?.message || 'Erro inesperado ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const internalHandleEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormData(v);
  };

  const internalHandleAddNew = () => {
    setEditingVehicle({
      ...baseVehicle,
      type: 'car',
      brand: '',
      model: '',
      year: YEARS[0],
      nickname: ''
    } as Vehicle);
    setFormData({
      ...baseVehicle,
      type: 'car',
      brand: '',
      model: '',
      year: YEARS[0],
      nickname: ''
    });
  };

  if (!editingVehicle) {
    return (
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto bg-zinc-950">
        <div className="flex items-center gap-4 bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20">
          <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-display font-black italic text-white leading-none">MEUS VEàCULOS</h2>
            <p className="text-xs text-brand-primary font-bold uppercase tracking-widest mt-1">Garagem Virtual</p>
          </div>
        </div>

        <div className="space-y-3">
          {vehicles.map((v) => (
            <div 
              key={v.id}
              className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${v.active ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-zinc-900/50 border-white/5'}`}
            >
              {/* Clickable Area for Catalog */}
              <button 
                onClick={() => {
                  setCatalogVehicle(v);
                  setScreen('vehicle-catalog');
                }}
                className="flex-1 flex items-center gap-4 text-left active:scale-[0.98] transition-all"
              >
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 ${v.active ? 'bg-brand-primary/20' : 'bg-zinc-800'}`}>
                  {v.photoURL ? (
                    <img src={v.photoURL} alt={v.nickname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    v.type === 'car' ? <Car className={`w-8 h-8 ${v.active ? 'text-brand-primary' : 'text-zinc-500'}`} /> : <Navigation className={`w-8 h-8 -rotate-90 ${v.active ? 'text-brand-primary' : 'text-zinc-500'}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-white italic uppercase tracking-tight">{v.nickname}</h4>
                    {v.active && <span className="text-[8px] bg-brand-primary text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse">Ativo</span>}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{v.brand} {v.model} â€¢ {v.year}</p>
                </div>
              </button>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                   onClick={() => {
                     setEditingVehicle(v);
                     setScreen('vehicle-settings');
                   }}
                   className="p-3 bg-zinc-800/50 backdrop-blur-sm rounded-xl text-zinc-400 hover:text-white border border-white/5 active:scale-90 transition-all"
                 >
                    <SettingsIcon className="w-5 h-5" />
                 </button>
                 <button 
                   onClick={() => onDelete(v)}
                   className="p-3 bg-zinc-800/50 backdrop-blur-sm rounded-xl text-zinc-400 hover:text-red-500 border border-white/5 active:scale-90 transition-all"
                 >
                    <Trash2 className="w-5 h-5" />
                 </button>
              </div>
            </div>
          ))}

          {canAddMore ? (
            <button 
              onClick={internalHandleAddNew}
              className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center gap-2 text-zinc-500 hover:text-white hover:border-white/10 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-widest">Adicionar Novo Veículo</span>
            </button>
          ) : (
            <div className="p-8 bg-yellow-500/5 border border-dashed border-yellow-500/20 rounded-2xl flex flex-col items-center gap-2 text-yellow-500/40 text-center">
              <Lock className="w-6 h-6" />
              <span className="text-[10px] font-black uppercase tracking-widest">Limite de 1 veículo atingido</span>
              <p className="text-[9px] font-bold uppercase tracking-tighter">Assine o Premium para garagem ilimitada</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto bg-zinc-950">
      <div className="flex items-center gap-4 bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20">
        <button onClick={() => setEditingVehicle(null)} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none">
            {editingVehicle.id ? 'EDITAR VEàCULO' : 'NOVO VEàCULO'}
          </h2>
          <p className="text-xs text-brand-primary font-bold uppercase tracking-widest mt-1">Configuraà§ões</p>
        </div>
      </div>

      <div className="flex gap-2 bg-zinc-900 border border-white/5 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('basics')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'basics' ? 'bg-brand-primary text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}
        >
          Informaà§ões Básicas
        </button>
        <button
          onClick={() => setActiveTab('technical')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'technical' ? 'bg-brand-primary text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}
        >
          Informaà§ões Técnicas
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {activeTab === 'basics' ? (
          <>
            <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative group">
            <div 
              onClick={() => {
                if (!isPremium) {
                  alert("A função de adicionar fotos reais do veículo está disponível apenas para usuários Premium. Assine agora para personalizar sua garagem!");
                } else {
                  if (Capacitor.isNativePlatform()) {
                    handlePhotoUpload(null);
                  } else {
                    const input = document.getElementById('vehicle-photo-input') as HTMLInputElement;
                    input?.click();
                  }
                }
              }}
              className="w-32 h-32 rounded-3xl bg-zinc-900 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden hover:border-brand-primary/50 transition-colors cursor-pointer"
            >
              {formData.photoURL ? (
                <img src={formData.photoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <CameraIcon className="w-8 h-8 text-zinc-700 hover:text-brand-primary/50 transition-colors" />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  {uploadStatus && (
                     <span className="text-[10px] font-black text-white uppercase tracking-widest px-2 text-center leading-tight">
                       {uploadStatus}
                     </span>
                  )}
                  {uploadProgress > 0 && (
                    <span className="text-[10px] font-black text-brand-primary">{uploadProgress}%</span>
                  )}
                </div>
              )}
              <input 
                id="vehicle-photo-input"
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
                disabled={isUploading || !isPremium} 
              />
            </div>
          </div>
          {!isPremium && (
            <div className="flex items-center gap-1.5 text-yellow-500/50">
              <Lock className="w-3 h-3" />
              <p className="text-[9px] font-bold uppercase tracking-widest">Foto real disponível apenas no Premium</p>
            </div>
          )}
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            {isPremium ? 'Toque no + para alterar' : 'Foto padrà£o do veículo'}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Tipo de Veículo</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'car', brand: '', model: '' })}
              className={`py-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${formData.type === 'car' ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
            >
              <Car className="w-5 h-5" />
              CARRO
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'motorcycle', brand: '', model: '' })}
              className={`py-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${formData.type === 'motorcycle' ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
            >
              <Navigation className="w-5 h-5 -rotate-90" />
              MOTO
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Nome Afetivo (Apelido)</label>
          <input 
            type="text"
            value={formData.nickname}
            onChange={e => setFormData({...formData, nickname: e.target.value})}
            placeholder="Ex: Foguete Vermelho"
            className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 transition-colors"
          />
        </div>

        {/* Catalog Style Selection [NEW] */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-1 h-3 bg-brand-primary rounded-full transition-all" />
             <h4 className="text-[10px] font-black text-white/50 uppercase tracking-widest">Estilo do Catálogo</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <button 
               type="button"
               onClick={() => setFormData(p => ({...p, catalogLayout: 'overlay'}))}
               className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.catalogLayout === 'overlay' || !formData.catalogLayout ? 'bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
             >
               <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 relative overflow-hidden flex items-center justify-center">
                  <div className={`absolute inset-0 bg-brand-primary/20 ${formData.catalogLayout === 'overlay' || !formData.catalogLayout ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
                  <div className="w-5 h-1.5 bg-white/40 rounded-full" />
               </div>
               <span className="text-[10px] font-bold uppercase tracking-tight">Overlay</span>
             </button>
             <button 
               type="button"
               onClick={() => setFormData(p => ({...p, catalogLayout: 'classic'}))}
               className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.catalogLayout === 'classic' ? 'bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
             >
               <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex flex-col gap-1 items-center justify-center">
                  <div className="w-6 h-4 bg-zinc-700 rounded-sm" />
                  <div className={`w-5 h-1.5 bg-brand-primary/40 rounded-full ${formData.catalogLayout === 'classic' ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
               </div>
               <span className="text-[10px] font-bold uppercase tracking-tight">Classic</span>
             </button>
          </div>
        </div>
          </>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
             <div className="bg-zinc-900/50 p-6 rounded-[24px] border border-white/5 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase italic tracking-tighter">Performance de Fábrica</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Configure o potencial do seu motor</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Potência (CV)</label>
                    <input 
                      type="number"
                      value={formData.hp || ''}
                      onChange={e => setFormData({...formData, hp: parseInt(e.target.value)})}
                      placeholder="Ex: 230"
                      className="w-full bg-zinc-950 border border-white/5 rounded-xl p-3 text-white placeholder:text-zinc-800 focus:outline-none focus:border-brand-primary/50 transition-colors font-black italic"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Velo. Máx (kM/h)</label>
                    <input 
                      type="number"
                      value={formData.maxSpeed || ''}
                      onChange={e => setFormData({...formData, maxSpeed: parseInt(e.target.value)})}
                      placeholder="Ex: 250"
                      className="w-full bg-zinc-950 border border-white/5 rounded-xl p-3 text-white placeholder:text-zinc-800 focus:outline-none focus:border-brand-primary/50 transition-colors font-black italic"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Nível de Preparação (STAGE)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STAGES_LIST.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => setFormData({...formData, stage})}
                        className={`py-2 px-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${formData.stage === stage ? (stage === 'Stage Max' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 border-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-brand-primary border-brand-primary text-white') : 'bg-zinc-950 border-white/5 text-zinc-600'}`}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Modificaà§ões / Setup</label>
                   <textarea 
                    value={formData.mods || ''}
                    onChange={e => setFormData({...formData, mods: e.target.value})}
                    placeholder="Ex: Filtro K&N, Remap, Escape Full..."
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl p-4 text-[10px] text-white placeholder:text-zinc-800 focus:outline-none focus:border-brand-primary/50 transition-colors min-h-[100px] resize-none"
                   />
                </div>

                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Observaà§ões Adicionais</label>
                   <textarea 
                    value={formData.observations || ''}
                    onChange={e => setFormData({...formData, observations: e.target.value})}
                    placeholder="Detalhes únicos que você queira registrar..."
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl p-4 text-[10px] text-white placeholder:text-zinc-800 focus:outline-none focus:border-brand-primary/50 transition-colors min-h-[80px] resize-none"
                   />
                </div>
             </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Fotos Extras (Premium - Máx 3)</label>
          <div className="grid grid-cols-3 gap-2">
            {formData.photoURLs?.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/5">
                <img src={url} alt={`Extra ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button 
                  type="button"
                  onClick={() => removeExtraPhoto(url)}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-lg text-white hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {isPremium && (formData.photoURLs?.length || 0) < 3 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-brand-primary/50 transition-all text-zinc-600 hover:text-brand-primary/50">
                <ImageIcon className="w-5 h-5" />
                <span className="text-[8px] font-black uppercase">Adicionar</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleAdditionalPhotoUpload} disabled={isUploading} />
              </label>
            )}
            {!isPremium && (
              <div className="aspect-square rounded-xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-1 text-zinc-800">
                <Lock className="w-5 h-5" />
                <span className="text-[8px] font-black uppercase">Bloqueado</span>
              </div>
            )}
          </div>
        </div>

        {/* Brand/Model/Spec Selection */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Marca</label>
            <select 
              value={brands.includes(formData.brand) ? formData.brand : (formData.brand ? 'Outra' : '')}
              onChange={e => setFormData({ ...formData, brand: e.target.value === 'Outra' ? ' ' : e.target.value, model: '', engine: '' })}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white focus:outline-none focus:border-brand-primary/50 transition-colors"
              required
            >
              <option value="">Selecione a Marca</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="Outra">Outra (Digitar)</option>
            </select>
            {(!brands.includes(formData.brand) && formData.brand !== '') && (
              <input 
                type="text"
                placeholder="Nome da Marca"
                value={formData.brand === ' ' ? '' : formData.brand}
                onChange={e => setFormData({ ...formData, brand: e.target.value || ' ' })}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 mt-2 text-white focus:border-brand-primary/50"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Modelo</label>
            <select 
              value={models.includes(formData.model) ? formData.model : (formData.model ? 'Outro' : '')}
              onChange={e => setFormData({ ...formData, model: e.target.value === 'Outro' ? ' ' : e.target.value, engine: '' })}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white focus:outline-none focus:border-brand-primary/50 transition-colors"
              required
              disabled={!formData.brand}
            >
              <option value="">Selecione o Modelo</option>
              {models.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="Outro">Outro (Digitar)</option>
            </select>
            {(!models.includes(formData.model) && formData.model !== '') && (
              <input 
                type="text"
                placeholder="Nome do Modelo"
                value={formData.model === ' ' ? '' : formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value || ' ' })}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 mt-2 text-white focus:border-brand-primary/50"
              />
            )}
          </div>

          <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">
                {formData.type === 'car' ? 'Versà£o / Motorização / Cà¢mbio' : 'Versà£o / Setup (Opcional)'}
              </label>
              <div className="relative group">
                <select 
                  value={specs.includes(formData.engine) ? formData.engine : (formData.engine ? 'Custom' : '')}
                  onChange={e => setFormData({ ...formData, engine: e.target.value === 'Custom' ? ' ' : e.target.value })}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white focus:outline-none focus:border-brand-primary/50 transition-colors"
                  disabled={!formData.model}
                >
                  <option value="">Selecione a Versà£o</option>
                  {specs.map((s: string) => <option key={s} value={s}>{s}</option>)}
                  <option value="Custom">Outra / Customizada</option>
                </select>
                {(!specs.includes(formData.engine) && formData.engine !== '') && (
                  <input 
                    type="text"
                    placeholder={formData.type === 'car' ? "Ex: 2.0 Turbo Manual 180cv" : "Ex: Edição Especial / Remap"}
                    value={formData.engine === ' ' ? '' : formData.engine}
                    onChange={e => setFormData({ ...formData, engine: e.target.value || ' ' })}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 mt-2 text-white focus:border-brand-primary/50"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Ano</label>
              <select 
                value={formData.year}
                onChange={e => setFormData({ ...formData, year: e.target.value })}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white focus:outline-none focus:border-brand-primary/50 transition-colors"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
               <button
                 type="button"
                 disabled={!(formData.type === 'motorcycle' ? formData.model : formData.engine) || isFetchingAI || !isPremium}
                 onClick={handleMagicaIA}
                 className={`w-full h-[54px] rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${(!(formData.type === 'motorcycle' ? formData.model : formData.engine) || !isPremium) ? 'bg-zinc-900 text-zinc-700 border border-white/5' : 'bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30 hover:bg-brand-secondary/30'}`}
               >
                 {isFetchingAI ? <div className="w-4 h-4 border-2 border-brand-secondary border-t-transparent rounded-full animate-spin" /> : <Wand2 className="w-4 h-4" />}
                 Mágica IA
               </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1 text-brand-primary">Peso Total (kg)</label>
            <input 
              type="number"
              value={formData.weight || ''}
              onChange={e => setFormData({...formData, weight: Number(e.target.value)})}
              placeholder="Ex: 1450"
              className="w-full bg-zinc-900 border border-brand-primary/20 rounded-xl p-4 text-white placeholder:text-zinc-800 focus:outline-none focus:border-brand-primary/50 transition-colors"
            />
            <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-tighter px-1">{formData.type === 'car' ? 'Carro + Piloto + Combustível' : 'Moto + Piloto + Equipamento'}</p>
          </div>
        </div>

        {saveError && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3 text-red-400 text-xs mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{saveError}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <button 
            type="submit"
            disabled={isSaving || isUploading}
            className="w-full py-4 bg-brand-primary hover:bg-red-500 rounded-xl font-display font-black text-lg italic tracking-tight flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Zap className="w-5 h-5" />
                SALVAR VEàCULO
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={onBack}
            className="w-full py-3 text-zinc-500 text-sm font-bold hover:text-white transition-colors"
          >
            CANCELAR
          </button>
        </div>
      </form>
    </div>
  );
}

function DuelComparison({ challenge }: { challenge: Challenge }) {
  if (!challenge.opponentResult) return null;

  const isWinner = challenge.opponentResult.time < challenge.result.time;

  // Prepare chart data (speed over time)
  const chartData = challenge.result.path.map((p, i) => ({
    time: i,
    [challenge.creatorName]: p.speed * 3.6,
    Você: (challenge.opponentResult?.path[i]?.speed || 0) * 3.6
  }));

  const creatorChartData = challenge.result.path.map((p, i) => ({
    time: i,
    speed: p.speed * 3.6
  }));

  const opponentChartData = challenge.opponentResult.path.map((p, i) => ({
    time: i,
    speed: p.speed * 3.6
  }));

  return (
    <div className="flex-1 flex flex-col p-6 space-y-8 overflow-y-auto bg-zinc-950">
      <div className="flex flex-col items-center text-center space-y-3">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl ${isWinner ? 'bg-brand-secondary shadow-green-500/30' : 'bg-brand-primary shadow-red-500/30'}`}
        >
          <Trophy className={`w-10 h-10 ${isWinner ? 'text-zinc-950' : 'text-white'}`} />
        </motion.div>
        <div className="space-y-1">
          <h2 className="text-3xl font-display font-black italic text-white uppercase tracking-tighter">
            {isWinner ? 'VITà“RIA!' : 'DERROTA'}
          </h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Duelo de Performance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Creator Card */}
        <div className={`relative glass-panel rounded-2xl p-5 border transition-all ${!isWinner ? 'border-brand-primary/30 bg-brand-primary/5 ring-1 ring-brand-primary/20' : 'border-white/5'}`}>
          {!isWinner && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-[8px] font-black px-3 py-1 rounded-full shadow-lg uppercase tracking-widest">
              VENCEDOR
            </div>
          )}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
              <User className="w-3 h-3 text-zinc-500" />
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">{challenge.creatorName}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Tempo Final</span>
            <p className={`text-3xl font-display font-black italic leading-none ${!isWinner ? 'text-brand-primary' : 'text-white'}`}>
              {challenge.result.time.toFixed(2)}s
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-end">
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-zinc-600 uppercase">Velo. Máx</span>
              <p className="text-sm font-display font-bold text-zinc-300">{Math.round(challenge.result.maxSpeed)} <span className="text-[10px]">km/h</span></p>
            </div>
          </div>
        </div>

        {/* Opponent Card (You) */}
        <div className={`relative glass-panel rounded-2xl p-5 border transition-all ${isWinner ? 'border-brand-secondary/30 bg-brand-secondary/5 ring-1 ring-brand-secondary/20' : 'border-white/5'}`}>
          {isWinner && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-secondary text-zinc-950 text-[8px] font-black px-3 py-1 rounded-full shadow-lg uppercase tracking-widest">
              VENCEDOR
            </div>
          )}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-brand-accent/20 flex items-center justify-center">
              <User className="w-3 h-3 text-brand-accent" />
            </div>
            <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest">VOCàŠ</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Tempo Final</span>
            <p className={`text-3xl font-display font-black italic leading-none ${isWinner ? 'text-brand-secondary' : 'text-white'}`}>
              {challenge.opponentResult.time.toFixed(2)}s
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-end">
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-zinc-600 uppercase">Velo. Máx</span>
              <p className="text-sm font-display font-bold text-zinc-300">{Math.round(challenge.opponentResult.maxSpeed)} <span className="text-[10px]">km/h</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <PerformanceChart 
          result={challenge.result} 
          opponentResult={challenge.opponentResult} 
          isPremium={true} 
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Análise Lado a Lado</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-[120px] bg-zinc-900/50 rounded-2xl p-3 border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={creatorChartData}>
                  <Area type="monotone" dataKey="speed" stroke="#71717a" fill="#71717a" fillOpacity={0.1} strokeWidth={2} />
                  <XAxis hide />
                  <YAxis hide domain={[0, 'auto']} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[8px] font-black text-center text-zinc-600 uppercase tracking-widest">Aceleração {challenge.creatorName}</p>
          </div>
          <div className="space-y-2">
            <div className="h-[120px] bg-zinc-900/50 rounded-2xl p-3 border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={opponentChartData}>
                  <Area type="monotone" dataKey="speed" stroke="#00f2ff" fill="#00f2ff" fillOpacity={0.1} strokeWidth={2} />
                  <XAxis hide />
                  <YAxis hide domain={[0, 'auto']} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[8px] font-black text-center text-brand-accent uppercase tracking-widest">Sua Aceleração</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 pb-8">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Trajetos Comparados</h3>
        <div className="h-[220px] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
          <MapContainer 
            center={[challenge.result.path[0].latitude, challenge.result.path[0].longitude]} 
            zoom={16} 
            className="h-full w-full"
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Polyline 
              positions={challenge.result.path.map(p => [p.latitude, p.longitude] as [number, number])} 
              color="#71717a" 
              weight={4}
              opacity={0.4}
              dashArray="8, 8"
            />
            <Polyline 
              positions={challenge.opponentResult.path.map(p => [p.latitude, p.longitude] as [number, number])} 
              color="#00f2ff" 
              weight={5}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

function ChallengeView({ 
  challenge, 
  onAccept, 
  onDecline,
  currentLocation
}: { 
  challenge: Challenge, 
  onAccept: () => void, 
  onDecline: () => void,
  currentLocation: { latitude: number, longitude: number } | null
}) {
  const startPoint = challenge.result.path[0];
  const distanceToStart = currentLocation 
    ? calculateDistance(currentLocation, startPoint) 
    : null;

  const isNearStart = distanceToStart !== null && distanceToStart < 100; // 100 meters radius

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center gap-4 bg-brand-accent/10 p-4 rounded-2xl border border-brand-accent/20">
        <div className="w-12 h-12 bg-brand-accent rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,242,255,0.4)]">
          <Swords className="w-6 h-6 text-zinc-950" />
        </div>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none">CONVITE DE DUELO</h2>
          <p className="text-xs text-brand-accent font-bold uppercase tracking-widest mt-1">De: {challenge.creatorName}</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Modalidade</span>
          <span className="text-white font-bold">{challenge.result.config.target}{challenge.result.config.mode === 'speed' ? ' km/h' : 'm'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Tempo a Bater</span>
          <span className="text-brand-primary text-2xl font-display font-black italic">{challenge.result.time.toFixed(2)}s</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Expira em</span>
          <div className="flex items-center gap-1.5 text-orange-500 font-bold">
            <Clock className="w-4 h-4" />
            <span>48h</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">Local do Desafio</h3>
        <RunMap result={challenge.result} />
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-medium bg-zinc-900/50 p-3 rounded-xl border border-white/5">
            <Navigation className="w-4 h-4 text-brand-accent" />
            {distanceToStart !== null ? (
              <span>Você está a <strong className="text-white">{Math.round(distanceToStart)}m</strong> do ponto de largada.</span>
            ) : (
              <span>Aguardando sinal de GPS para verificar sua posição...</span>
            )}
          </div>
          <button 
            onClick={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${startPoint.latitude},${startPoint.longitude}&travelmode=driving`;
              window.open(url, '_blank');
            }}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-white/5"
          >
            <MapPin className="w-4 h-4 text-brand-accent" />
            COMO CHEGAR NA LARGADA
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-auto">
        <button 
          onClick={onAccept}
          disabled={!isNearStart}
          className={`w-full py-4 rounded-xl font-display font-black text-lg italic tracking-tight flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
            isNearStart 
              ? 'bg-brand-secondary text-zinc-950 shadow-green-600/20' 
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
          }`}
        >
          <Play className="w-5 h-5" />
          ACEITAR DESAFIO
        </button>
        {!isNearStart && (
          <p className="text-[9px] text-center text-zinc-500 font-bold uppercase">
            Vá até o local da largada para aceitar o duelo
          </p>
        )}
        <button 
          onClick={onDecline}
          className="w-full py-3 text-zinc-500 text-sm font-bold hover:text-white transition-colors"
        >
          RECUSAR
        </button>
      </div>
    </div>
  );
}

function RunMap({ result }: { result: RunResult }) {
  const positions = useMemo(() => 
    result.path.map(p => [p.latitude, p.longitude] as [number, number]), 
  [result.path]);

  if (positions.length === 0) return null;

  const startPoint = positions[0];
  const endPoint = positions[positions.length - 1];

  function ChangeView({ center }: { center: [number, number] }) {
    const map = useMap();
    map.setView(center, 16);
    return null;
  }

  return (
    <div className="h-48 w-full rounded-xl overflow-hidden border border-white/10 mt-4 relative group">
      <MapContainer 
        center={startPoint} 
        zoom={16} 
        scrollWheelZoom={false}
        zoomControl={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <Polyline 
          positions={positions} 
          pathOptions={{ color: '#00f2ff', weight: 4, opacity: 0.8 }} 
        />
        <Marker position={startPoint} />
        <Marker position={endPoint} />
        <ChangeView center={startPoint} />
      </MapContainer>
      <div className="absolute top-2 right-2 z-10 bg-zinc-950/80 p-1.5 rounded-lg backdrop-blur-sm border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
        <MapIcon className="w-3 h-3 text-brand-accent" />
      </div>
    </div>
  );
}

const PRESETS = [
  { id: '201m', label: '201m', mode: 'distance' as const, target: 201, startSpeed: 0, description: '1/8 de milha (Arrancada)', icon: Flag, color: 'from-blue-500 to-cyan-500', type: 'standing' },
  { id: '0-100', label: '0-100 km/h', mode: 'speed' as const, target: 100, startSpeed: 0, description: 'Teste clássico de aceleração', icon: Zap, color: 'from-red-500 to-orange-500', type: 'standing' },
  { id: '0-200', label: '0-200 km/h', mode: 'speed' as const, target: 200, startSpeed: 0, description: 'Performance em alta velocidade', icon: Gauge, color: 'from-orange-500 to-yellow-500', type: 'standing' },
  { id: '100-200', label: '100-200 km/h', mode: 'speed' as const, target: 200, startSpeed: 100, description: 'Retomada em movimento', icon: Timer, color: 'from-yellow-500 to-green-500', type: 'rolling' },
  { id: '402m', label: '402m', mode: 'distance' as const, target: 402, startSpeed: 0, description: '1/4 de milha (Padrà£o)', icon: Trophy, color: 'from-purple-500 to-pink-500', type: 'standing' },
  { id: 'free', label: 'Modo Livre', mode: 'free' as const, target: 0, startSpeed: 0, description: 'Ajuste mecà¢nico e telemetria', icon: ActivityIcon, color: 'from-zinc-700 to-zinc-600', type: 'manual' },
  { id: 'custom', label: 'Personalizada', mode: 'custom' as const, target: 0, startSpeed: 0, description: 'Crie seu próprio teste', icon: SettingsIcon, color: 'from-brand-primary to-brand-secondary', type: 'custom' }
];

// --- Components ---
function SmoothCounter({ value, className }: { value: number, className?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    const startValue = displayValue;
    const endValue = value;
    const duration = 300; // ms
    const startTime = performance.now();
    
    let animationFrame: number;
    
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out quad
      const easedProgress = progress * (2 - progress);
      
      const current = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(current);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  return <span className={className}>{Math.round(displayValue)}</span>;
}

function GPSIndicator({ accuracy, onRequest }: { accuracy: number | null, onRequest: () => void }) {
  const getSignalLevel = () => {
    if (accuracy === null) return 0;
    if (accuracy < 5) return 4;
    if (accuracy < 10) return 3;
    if (accuracy < 20) return 2;
    if (accuracy < 50) return 1;
    return 0;
  };

  const level = getSignalLevel();
  const colors = ['text-zinc-700', 'text-red-500', 'text-orange-500', 'text-yellow-500', 'text-green-500'];

  return (
    <button 
      onClick={onRequest}
      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-full hover:bg-zinc-800 transition-colors active:scale-95"
    >
      <div className="flex items-end gap-0.5 h-3">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className={`w-1 rounded-full transition-all ${i <= level ? 'bg-current' : 'bg-zinc-800'} ${colors[level]}`}
            style={{ height: `${i * 25}%` }}
          />
        ))}
      </div>
    </button>
  );
}

function CustomSetup({ onBack, onStart, config, setConfig }: { 
  onBack: () => void, 
  onStart: () => void,
  config: { type: 'speed' | 'distance', startSpeed: number, target: number },
  setConfig: (config: { type: 'speed' | 'distance', startSpeed: number, target: number }) => void
}) {
  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <ArrowLeftIcon className="w-6 h-6 text-zinc-400" />
        </button>
        <h2 className="text-xl font-display font-black italic text-white leading-none tracking-tight">MODO PERSONALIZADO</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Tipo de Teste</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setConfig({ ...config, type: 'speed' })}
              className={`py-4 rounded-xl border font-bold transition-all ${
                config.type === 'speed' 
                  ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' 
                  : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10'
              }`}
            >
              Aceleração
            </button>
            <button
              onClick={() => setConfig({ ...config, type: 'distance' })}
              className={`py-4 rounded-xl border font-bold transition-all ${
                config.type === 'distance' 
                  ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' 
                  : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10'
              }`}
            >
              Arrancada
            </button>
          </div>
        </div>

        {config.type === 'speed' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Velocidade Inicial (km/h)</label>
              <input
                type="number"
                value={config.startSpeed}
                onChange={(e) => setConfig({ ...config, startSpeed: Number(e.target.value) })}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white font-bold focus:outline-none focus:border-brand-primary transition-colors"
                placeholder="Ex: 0, 60, 100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Velocidade Final (km/h)</label>
              <input
                type="number"
                value={config.target}
                onChange={(e) => setConfig({ ...config, target: Number(e.target.value) })}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white font-bold focus:outline-none focus:border-brand-primary transition-colors"
                placeholder="Ex: 100, 200, 250"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Distà¢ncia (metros)</label>
            <input
              type="number"
              value={config.target}
              onChange={(e) => setConfig({ ...config, target: Number(e.target.value) })}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white font-bold focus:outline-none focus:border-brand-primary transition-colors"
              placeholder="Ex: 201, 402, 1000"
            />
          </div>
        )}

        <div className="pt-4">
          <button
            onClick={onStart}
            className="w-full py-4 bg-brand-primary hover:bg-red-500 text-white rounded-xl font-display font-black text-lg italic tracking-tight shadow-lg shadow-red-600/20 transition-all active:scale-95"
          >
            CONFIRMAR E INICIAR
          </button>
        </div>
      </div>
    </div>
  );
}

interface TimerProps {
  user: FirebaseUser | null;
  isGuest: boolean;
  userProfile: UserProfile | null;
  activeConfig: RunPreset | null;
  isRunning: boolean;
  isWaiting: boolean;
  isReady: boolean;
  lastResult: RunResult | null;
  activeChallenge: Challenge | null;
  currentSpeed: number;
  elapsedTime: number;
  distance: number;
  progress: number;
  gForce: number;
  gpsStatus: 'idle' | 'searching' | 'active' | 'error';
  accuracy: number | null;
  vehicles: Vehicle[];
  runVehicleId: string;
  isQuickSwitchOpen: boolean;
  useRollout: boolean;
  error: string | null;
  setIsQuickSwitchOpen: (open: boolean) => void;
  setRunVehicleId: (id: string) => void;
  setUseRollout: (use: boolean) => void;
  reset: () => void;
  handleBack: () => void;
  handleStart: () => void;
  manualStart: () => void;
  manualStop: () => void;
  handleDuel: () => void;
  requestPermission: () => void;
  setScreen: (screen: Screen) => void;
  handleAcceptChallenge: (c: Challenge) => void;
  isSettling: boolean;
  settlingCountdown: number;
  telemetryConfig: TelemetryConfig;
  setTelemetryConfig: React.Dispatch<React.SetStateAction<TelemetryConfig>>;
}

function TimerClassic(props: TimerProps) {
  const {
    user, isGuest, userProfile, activeConfig, isRunning, isWaiting, isReady,
    lastResult, activeChallenge, currentSpeed, elapsedTime, distance, progress,
    gForce, gpsStatus, accuracy, vehicles, runVehicleId, isQuickSwitchOpen,
    useRollout, error, setIsQuickSwitchOpen, setRunVehicleId, setUseRollout,
    reset, handleBack, handleStart, manualStart, manualStop, handleDuel,
    requestPermission, setScreen, handleAcceptChallenge, isSettling, settlingCountdown,
    telemetryConfig, setTelemetryConfig
  } = props;

  return (
    <motion.div 
      key="timer-classic"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      {/* Timer Header */}
      <header className="p-3 flex items-center justify-between border-b border-white/5 bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
          <button 
            onClick={handleBack}
            className="p-1.5 hover:bg-white/5 rounded-full transition-colors flex items-center gap-1.5 text-zinc-400 hover:text-white shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-2">Performance Test</span>
        </div>
        
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-brand-primary uppercase tracking-widest leading-none mb-0.5">{activeConfig?.label}</span>
          <GPSIndicator accuracy={accuracy} onRequest={requestPermission} />
        </div>

        <button className="p-1.5 hover:bg-white/5 rounded-full transition-colors">
          <SettingsIcon className="w-4 h-4 text-zinc-400" />
        </button>
      </header>

      <div className="bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${gpsStatus === 'active' ? 'bg-green-500 animate-pulse' : gpsStatus === 'searching' ? 'bg-yellow-500 animate-bounce' : 'bg-red-500'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
            GPS: {gpsStatus === 'active' ? 'Sinal Ativo' : gpsStatus === 'searching' ? 'Buscando...' : 'Erro'}
            {accuracy && ` (${accuracy.toFixed(1)}m)`}
          </span>
        </div>
        <button 
          onClick={() => {
            reset();
            requestPermission();
          }}
          className="text-[9px] font-black uppercase tracking-widest text-brand-primary hover:text-white transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Reiniciar GPS
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-lg flex items-center gap-2 text-red-400 text-[10px] max-w-md mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {(!accuracy || accuracy > 20) && !lastResult && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-primary/10 border border-brand-primary/20 p-3 rounded-xl flex items-start gap-3 max-w-md mx-auto"
          >
            <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-white text-[10px] font-black uppercase tracking-widest">Dica de Sinal</p>
              <p className="text-zinc-400 text-[10px] leading-relaxed">
                Para resultados precisos, evite ficar sob árvores ou coberturas metálicas. Procure um local com céu aberto.
              </p>
            </div>
          </motion.div>
        )}

        {!lastResult && (
          <div className="relative aspect-square w-full max-w-[280px] mx-auto flex flex-col items-center justify-center">
            <div className="absolute inset-0 border-[12px] border-zinc-900 rounded-full" />
            <motion.div 
              className="absolute inset-0 border-[12px] border-brand-primary rounded-full border-t-transparent border-l-transparent"
              animate={{ rotate: (currentSpeed / 260) * 270 - 135 }}
              transition={{ type: 'spring', damping: 15 }}
            />
            
            {!isGuest && (
              <div 
                className="absolute -top-4 -left-4 z-20 group"
                style={{ transform: 'translate(10%, 10%)' }}
              >
                <button 
                  onClick={() => !isRunning && setIsQuickSwitchOpen(true)}
                  className={`flex items-center gap-2 p-2 rounded-2xl border transition-all ${runVehicleId === 'anonimo' ? 'bg-zinc-900/40 border-white/10' : 'bg-brand-primary/10 border-brand-primary/30'} backdrop-blur-md active:scale-95`}
                  disabled={isRunning && currentSpeed > 5}
                >
                  <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center overflow-hidden border border-white/5">
                    {(() => {
                      const v = vehicles.find(veh => veh.id === runVehicleId);
                      if (v?.photoURL) return <img src={v.photoURL} className="w-full h-full object-cover" />;
                      if (v?.type === 'motorcycle') return <Navigation className="w-4 h-4 text-zinc-600 -rotate-90" />;
                      return <Car className="w-4 h-4 text-zinc-600" />;
                    })()}
                  </div>
                  <div className="text-left pr-2">
                    <p className="text-[7px] font-black text-brand-primary uppercase tracking-widest leading-none mb-0.5">Veículo</p>
                    <p className="text-[9px] font-black text-white uppercase italic tracking-tighter truncate max-w-[80px]">
                      {vehicles.find(v => v.id === runVehicleId)?.nickname || 'Anà´nimo'}
                    </p>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${isQuickSwitchOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}

            <div className="text-center z-10">
              <motion.div 
                className={`block text-8xl font-display font-black italic tracking-tighter speed-text leading-none ${isRunning ? 'text-brand-primary drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]' : ''}`}
                animate={{ scale: isRunning ? 1.05 : 1 }}
              >
                <SmoothCounter value={currentSpeed} />
              </motion.div>
              <span className="text-zinc-500 font-bold uppercase tracking-widest text-sm">km/h</span>
              {isRunning && (
                <div className="mt-2 flex items-center justify-center gap-1">
                  <ActivityIcon className="w-3 h-3 text-brand-accent" />
                  <span className="text-brand-accent font-mono font-bold text-sm tracking-tighter">{gForce.toFixed(2)}G</span>
                </div>
              )}
            </div>

            <div className="absolute bottom-10 flex gap-8 text-zinc-400 font-mono">
              <div className="text-center">
                <span className="block text-zinc-600 text-[9px] uppercase font-bold mb-0.5">Tempo</span>
                <span className="text-white text-lg font-bold leading-none">{elapsedTime.toFixed(2)}s</span>
              </div>
              <div className="text-center">
                <span className="block text-zinc-600 text-[9px] uppercase font-bold mb-0.5">Distà¢ncia</span>
                <span className="text-white text-lg font-bold leading-none">
                  {distance > 1000 ? `${(distance / 1000).toFixed(2)}k` : `${Math.round(distance)}m`}
                </span>
              </div>
            </div>

            {((activeConfig?.mode === 'free' || activeConfig?.mode === 'trip') && isRunning) && (
              <button
                onClick={manualStop}
                className={`absolute -bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[200px] py-3 ${activeConfig?.mode === 'trip' ? 'bg-blue-600' : 'bg-red-500'} text-white font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all`}
              >
                <RotateCcw className="w-5 h-5" />
                {activeConfig?.mode === 'trip' ? 'ENCERRAR VIAGEM' : 'FINALIZAR'}
              </button>
            )}
          </div>
        )}

        {(isRunning || isWaiting) && activeConfig?.mode !== 'free' && (
          <div className="max-w-[320px] mx-auto w-full space-y-2 mt-8">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
              <span>{activeConfig?.mode === 'speed' ? `Alcanà§ando ${activeConfig.target} km/h` : `Percorrendo ${activeConfig?.target}m`}</span>
              <span className="text-brand-accent">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-white/10 p-0.5">
              <motion.div 
                className="h-full bg-brand-accent rounded-full shadow-[0_0_15px_rgba(0,242,255,0.4)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              />
            </div>
          </div>
        )}

        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {isWaiting && (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center p-6 glass-panel rounded-2xl border-brand-secondary/30"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 transition-all duration-500 ${isReady ? 'bg-brand-secondary shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-brand-secondary/20 animate-pulse'}`}>
                  {activeConfig?.id === '100-200' ? (
                    <Flag className={`w-6 h-6 ${isReady ? 'text-white' : 'text-brand-secondary'} fill-current`} />
                  ) : (
                    <Play className={`w-6 h-6 ${isReady ? 'text-white' : 'text-brand-secondary'} fill-current`} />
                  )}
                </div>
                <h3 className={`text-lg font-bold uppercase tracking-wider mb-1 transition-colors duration-500 ${isReady ? 'text-brand-secondary' : 'text-zinc-500'}`}>
                  {activeConfig?.mode === 'free'
                    ? 'MODO LIVRE - PRONTO'
                    : activeConfig?.mode === 'trip'
                      ? 'MODO VIAGEM - PRONTO'
                      : activeConfig?.id === '100-200' 
                        ? (isReady ? 'PRONTO PARA ACELERAR' : 'ACELERE ATà‰ 100KM/H')
                        : (isReady ? 'SINAL VERDE: ARRANQUE!' : 'PARE O VEàCULO')}
                </h3>
                <p className="text-zinc-500 text-[10px] font-medium mb-4">
                  {activeConfig?.mode === 'free'
                    ? 'Inicie a puxada manualmente quando desejar.'
                    : activeConfig?.mode === 'trip'
                      ? 'Inicie a viagem para monitorar sua performance.'
                      : activeConfig?.id === '100-200' 
                        ? `Aguardando atingir ${activeConfig.startSpeed} km/h...` 
                        : (isReady ? 'O cronà´metro iniciará ao detectar movimento.' : 'O teste só comeà§a com o carro totalmente parado.')}
                </p>

                {(activeConfig?.mode === 'free' || activeConfig?.mode === 'trip') && (
                  <button
                    onClick={manualStart}
                    className={`w-full py-4 ${activeConfig?.mode === 'trip' ? 'bg-blue-600' : 'bg-brand-primary'} text-zinc-950 font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all`}
                  >
                    <Play className="w-6 h-6 fill-current" />
                    {activeConfig?.mode === 'trip' ? 'INICIAR VIAGEM' : 'INICIAR PUXADA'}
                  </button>
                )}

                <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10 w-fit mx-auto">
                  <ActivityIcon className="w-3 h-3 text-brand-primary" />
                  <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Sensor IMU Ativo - Launch Trigger</span>
                </div>

                {!isReady && currentSpeed > 5 && activeConfig?.id !== '100-200' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 p-2 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-[10px] text-red-200 font-bold uppercase text-left">
                      Movimento detectado! Pare totalmente para iniciar.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {lastResult && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel rounded-2xl p-5 border-brand-accent/30 overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Flag className="w-16 h-16 text-brand-accent" />
                </div>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-brand-accent font-black uppercase tracking-tighter text-xl italic">RESULTADO</h3>
                    <p className="text-[8px] font-mono text-brand-accent/60 font-bold uppercase tracking-widest">{lastResult.runSerial || 'DF-A1B2'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Pontuação</span>
                    <span className="text-2xl font-display font-black text-white italic">{lastResult.performanceScore || 0} <span className="text-[10px] text-zinc-600">PTS</span></span>
                  </div>
                </div>
                
                {vehicles.find(v => v.id === runVehicleId) && (
                  <div className="mb-4 p-3 bg-brand-accent/5 border border-brand-accent/20 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-accent/10 rounded-lg flex items-center justify-center overflow-hidden">
                      {(() => {
                        const v = vehicles.find(veh => veh.id === runVehicleId);
                        if (v?.photoURL) return <img src={v.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
                        return v?.type === 'car' ? <Car className="w-5 h-5 text-brand-accent" /> : <Navigation className="w-5 h-5 text-brand-accent -rotate-90" />;
                      })()}
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none mb-1">Veículo Utilizado</p>
                      <p className="text-sm font-bold text-white leading-none">
                        {vehicles.find(v => v.id === runVehicleId)?.nickname} 
                        <span className="text-zinc-500 font-medium text-[10px] uppercase ml-1">
                          {vehicles.find(v => v.id === runVehicleId)?.brand} {vehicles.find(v => v.id === runVehicleId)?.model}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 text-[9px] uppercase font-bold">Tempo Final</span>
                    <p className="text-4xl font-display font-black text-white italic leading-none">{lastResult.time.toFixed(2)}s</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 text-[9px] uppercase font-bold">Velo. Máxima</span>
                    <p className="text-4xl font-display font-black text-white italic leading-none">{Math.round(lastResult.maxSpeed)} <span className="text-xs">km/h</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 space-y-3">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block border-b border-white/5 pb-2">
                      {lastResult.config.mode === 'free' ? 'Resumo da Puxada' : 'Intervalos'}
                    </span>
                    <div className="space-y-2">
                      {lastResult.config.mode === 'free' ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Distà¢ncia Total</span>
                            <span className="text-sm font-display font-black text-white italic">{Math.round(lastResult.distance)}m</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Velo. Média</span>
                            <span className="text-sm font-display font-black text-white italic">{Math.round(lastResult.avgSpeed)} km/h</span>
                          </div>
                        </>
                      ) : lastResult.config.isCustom ? (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">
                            {lastResult.config.mode === 'speed' ? `${lastResult.config.startSpeed}-${lastResult.config.target} km/h` : `${lastResult.config.target}m`}
                          </span>
                          <span className="text-sm font-display font-black text-white italic">{lastResult.time.toFixed(2)}s</span>
                        </div>
                      ) : (
                        <>
                          {calculateIntervals(lastResult.path, [20, 40, 60, 80, 100]).map(interval => (
                            <div key={interval.target} className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">0-{interval.target} km/h</span>
                              <span className="text-sm font-display font-black text-white italic">{interval.time.toFixed(2)}s</span>
                            </div>
                          ))}
                          {lastResult.config.mode === 'distance' && calculateDistanceIntervals(lastResult.path, [201, 402]).map(interval => (
                            <div key={interval.target} className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">0-{interval.target}m</span>
                              <span className="text-sm font-display font-black text-white italic">{interval.time.toFixed(2)}s</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 space-y-4">
                    <div className="space-y-1">
                      <span className="text-zinc-500 text-[9px] uppercase font-bold block">Inclinação (Slope)</span>
                      <div className="flex items-center gap-2">
                        <p className={`text-xl font-display font-black italic leading-none ${lastResult.isValidSlope ? 'text-white' : 'text-red-500'}`}>
                          {lastResult.slope?.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500 text-[9px] uppercase font-bold block">G-Force Peak</span>
                      <p className="text-xl font-display font-black text-white italic leading-none">{lastResult.maxG?.toFixed(2)}G</p>
                    </div>
                  </div>
                </div>

                <PerformanceChart 
                  result={lastResult} 
                  opponentResult={activeChallenge?.result} 
                  isPremium={userProfile?.isPremium} 
                />

                <RunMap result={lastResult} />

                <div className="flex flex-col gap-2 mt-5">
                  <div className="flex gap-2">
                    <button 
                      onClick={reset}
                      className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      REPETIR
                    </button>
                    <button 
                      className="px-4 py-3 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-brand-accent/20"
                    >
                      <Share2Icon className="w-4 h-4" />
                    </button>
                  </div>
                  {lastResult.config.mode !== 'free' && !lastResult.config.isCustom && (
                    <button 
                      onClick={handleDuel}
                      className="w-full py-4 bg-brand-primary hover:bg-red-500 rounded-xl font-display font-black text-lg italic tracking-tight flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all active:scale-95"
                    >
                      <Swords className="w-5 h-5" />
                      DUELAR COM AMIGO
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {!isRunning && !isWaiting && !lastResult && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 text-center"
              >
                <div className="mb-4 flex flex-col items-center">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Info className="w-5 h-5 text-brand-primary" />
                  </div>
                  <h4 className="font-bold text-zinc-400 uppercase text-[10px] tracking-widest mb-1">Atenção</h4>
                  <p className="text-zinc-500 text-[10px] font-medium">O teste de arrancada só inicia com o veículo parado.</p>
                </div>

                {activeConfig?.type === 'standing' && (
                  <div className="mb-6 flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-white/5">
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">1-Foot Rollout</span>
                    </div>
                    <button 
                      onClick={() => setUseRollout(!useRollout)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${useRollout ? 'bg-brand-primary' : 'bg-zinc-800'}`}
                    >
                      <motion.div 
                        className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm"
                        animate={{ x: useRollout ? 20 : 0 }}
                      />
                    </button>
                  </div>
                )}

                <button 
                  onClick={handleStart}
                  className="w-full py-4 bg-brand-primary hover:bg-red-500 rounded-xl font-display font-black text-lg italic tracking-tight flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all active:scale-95"
                >
                  <Timer className="w-5 h-5" />
                  INICIAR
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Quick Switch Modal Overlay */}
      <AnimatePresence>
        {isQuickSwitchOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-end justify-center p-4"
            onClick={() => setIsQuickSwitchOpen(false)}
          >
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="w-full max-w-md bg-zinc-900 border-t border-white/10 rounded-t-[40px] p-8 space-y-6 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-display font-black italic text-white uppercase tracking-tight">Vincular Veículo</h3>
                </div>
                <button onClick={() => setIsQuickSwitchOpen(false)} className="p-2 bg-white/5 rounded-xl text-zinc-400">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <button onClick={() => { setRunVehicleId('anonimo'); setIsQuickSwitchOpen(false); }} className={`flex flex-col gap-2 p-3 rounded-[32px] border transition-all ${runVehicleId === 'anonimo' ? 'bg-zinc-800 border-brand-primary' : 'bg-zinc-950/50 border-white/5'}`}>
                  <div className="aspect-[4/3] w-full rounded-2xl bg-zinc-900 flex flex-col items-center justify-center border border-white/5 gap-1">
                    <EyeOff className="w-5 h-5 text-zinc-600" />
                    <span className="text-[7px] text-zinc-700 font-black uppercase tracking-widest">Modo Fantasma</span>
                  </div>
                  <div className="text-center px-1">
                    <p className="text-[10px] font-black text-white uppercase italic">Anà´nimo</p>
                  </div>
                </button>
                {vehicles.map(v => (
                  <button key={v.id} onClick={() => { setRunVehicleId(v.id || ''); setIsQuickSwitchOpen(false); }} className={`flex flex-col gap-2 p-3 rounded-[32px] border transition-all ${runVehicleId === v.id ? 'bg-zinc-800 border-brand-primary shadow-lg shadow-red-600/20' : 'bg-zinc-950/50 border-white/5'}`}>
                    <div className="aspect-[4/3] w-full rounded-2xl bg-zinc-900 flex items-center justify-center overflow-hidden border border-white/5">
                      {v.photoURL ? <img src={v.photoURL} alt={v.nickname} className="w-full h-full object-cover" /> : (v.type === 'car' ? <Car className="w-6 h-6 text-zinc-700" /> : <Navigation className="w-6 h-6 -rotate-90 text-zinc-700" />)}
                    </div>
                    <div className="text-center px-1">
                      <p className="text-[10px] font-black text-white uppercase italic truncate w-full">{v.nickname}</p>
                      <p className="text-[7px] text-zinc-500 font-black uppercase tracking-widest truncate w-full">{v.brand} {v.model}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TimerElite(props: TimerProps) {
  const {
    user, isGuest, userProfile, activeConfig, isRunning, isWaiting, isReady,
    lastResult, activeChallenge, currentSpeed, elapsedTime, distance, progress,
    gForce, gpsStatus, accuracy, vehicles, runVehicleId, isQuickSwitchOpen,
    useRollout, error, setIsQuickSwitchOpen, setRunVehicleId, setUseRollout,
    reset, handleBack, handleStart, manualStart, manualStop, handleDuel,
    requestPermission, setScreen, handleAcceptChallenge, isSettling, settlingCountdown,
    telemetryConfig, setTelemetryConfig
  } = props;

  // --- NOVAS CONFIGURAÇÕES DO TESTE ---
  const [pocketMode, setPocketMode] = useState(() => localStorage.getItem('df_pocket_mode') === 'true');
  const [stabilizer15s, setStabilizer15s] = useState(() => localStorage.getItem('df_stabilizer_15s') === 'true');
  
  const [stabilizerCountdown, setStabilizerCountdown] = useState(0);
  const [isStabilizing, setIsStabilizing] = useState(false);
  const [showPerfSettings, setShowPerfSettings] = useState(false);
  
  const [liveVibration, setLiveVibration] = useState(1.0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationMax, setCalibrationMax] = useState(0);

  useEffect(() => {
    localStorage.setItem('df_pocket_mode', String(pocketMode));
    localStorage.setItem('df_stabilizer_15s', String(stabilizer15s));
  }, [pocketMode, stabilizer15s]);

  // Alerta tátil (Vibração) de que a estabilização/aferição acabou e está pronto para arrancar
  useEffect(() => {
    if (isReady && pocketMode) {
      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500]); // Alerta distintivo: vibrar, pausa, vibrar
      }
    }
  }, [isReady, pocketMode]);

  useEffect(() => {
    if (!showPerfSettings && !isCalibrating) return;
    
    let listener: any;
    const startMotion = async () => {
      try {
        listener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.accelerationIncludingGravity;
          const totalG = Math.sqrt((x || 0)**2 + (y || 0)**2 + (z || 0)**2) / 9.81;
          setLiveVibration(totalG);
          
          if (isCalibrating) {
            setCalibrationMax(prev => Math.max(prev, totalG));
          }
        });
      } catch (e) {
        console.error("Erro ao iniciar sensor para calibração:", e);
      }
    };
    
    startMotion();
    return () => {
      if (listener && listener.remove) {
        listener.remove();
      }
    };
  }, [showPerfSettings, isCalibrating]);

  const startAutoCalibration = () => {
    setIsCalibrating(true);
    setCalibrationMax(0);
    setTimeout(() => {
      setIsCalibrating(false);
      setCalibrationMax(currentMax => {
        const newSensitivity = Math.min(3.0, Math.max(1.0, Number((currentMax + 0.2).toFixed(2))));
        setTelemetryConfig(prev => ({ ...prev, motionSensitivity: newSensitivity }));
        alert(`Calibração Concluída!\nNova sensibilidade: ${newSensitivity}G`);
        return currentMax;
      });
    }, 5000);
  };

  const onStartWithStabilizer = () => {
    if (currentSpeed > 1.5) return;
    
    if (pocketMode && stabilizer15s) {
      setIsStabilizing(true);
      setStabilizerCountdown(15);
      const interval = window.setInterval(() => {
        setStabilizerCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsStabilizing(false);
            handleStart();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      handleStart();
    }
  };

  const activeVehicle = vehicles.find(v => v.id === runVehicleId);
  const [resultTab, setResultTab] = useState<'summary' | 'telemetry' | 'map'>('summary');

  return (
    <motion.div 
      key="timer-elite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-[#050505] relative overflow-hidden"
    >
      {/* High-Performance Tech Texture */}
      <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0)', backgroundSize: '15px 15px' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/5 via-transparent to-black pointer-events-none" />

      {/* Header Controls - Now with Logo integration */}
      <header className="p-4 flex items-center justify-between z-50 relative">
        <button onClick={handleBack} className="p-3 bg-zinc-900/60 backdrop-blur-2xl rounded-xl border border-white/10 text-white shadow-xl active:scale-95 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-end opacity-60">
           <h2 className="text-xl font-display font-black italic tracking-tighter leading-none">
              <span className="text-white">DRAG</span><span className="text-red-600">FIRE</span>
           </h2>
           <span className="text-[5px] font-black text-zinc-600 uppercase tracking-[0.3em]">ELITE PERFORMANCE</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-2 pb-6 z-10 relative overflow-hidden">
        {error && (
          <div className="mb-2 bg-red-600/10 border border-red-600/30 p-3 rounded-xl flex items-center gap-3 backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-[9px] font-black uppercase text-red-200">{error}</p>
          </div>
        )}

        {/* New Widget Grid Layout (Boxes 1, 2, 3, 4) */}
        {!lastResult && (
           <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Box 1: Vehicle Info */}
              <div className="flex flex-col gap-2 bg-zinc-950/20 backdrop-blur-md p-3 rounded-2xl border border-white/5 shadow-2xl">
                 <button 
                  onClick={() => !isRunning && setIsQuickSwitchOpen(true)}
                  className="w-12 h-12 rounded-xl bg-zinc-900 border border-brand-primary/20 flex items-center justify-center overflow-hidden active:scale-95 transition-all shadow-xl"
                 >
                   {activeVehicle?.photoURL ? (
                      <img src={activeVehicle.photoURL} className="w-full h-full object-cover rounded-lg" />
                   ) : (
                      activeVehicle?.type === 'car' ? <Car className="w-6 h-6 text-zinc-700" /> : <Navigation className="w-6 h-6 text-zinc-700 -rotate-90" />
                   )}
                 </button>
                 <div className="flex flex-col min-w-0">
                    <span className="text-xs font-display font-black text-white italic uppercase tracking-tight truncate">
                      {activeVehicle?.nickname || 'PILOTO'}
                    </span>
                    <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest leading-none mt-0.5 truncate">
                      {activeVehicle?.brand} {activeVehicle?.model}
                    </span>
                 </div>
              </div>

              {/* Center Column: GPS (Box 3) & Mode (Box 4) */}
              <div className="flex flex-col items-center justify-center gap-3">
                 {/* Box 3: GPS Signal */}
                 <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-end gap-1 h-3">
                       {[1, 2, 3, 4].map((i) => {
                         const level = accuracy === null ? 0 : accuracy < 5 ? 4 : accuracy < 10 ? 3 : accuracy < 20 ? 2 : accuracy < 50 ? 1 : 0;
                         const colors = ['bg-zinc-700', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
                         return (
                           <div 
                             key={i} 
                             className={`w-1 rounded-full transition-all ${i <= level ? colors[level] : 'bg-zinc-800'}`}
                             style={{ height: `${i * 25}%` }}
                           />
                         );
                       })}
                    </div>
                    <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.4em] leading-none">
                       SINAL GPS
                    </span>
                 </div>

                 {/* Box 4: Run Mode Name */}
                 <div className="bg-brand-primary/10 px-3 py-1 rounded-lg border border-brand-primary/20">
                    <span className="text-[8px] font-black text-white italic uppercase tracking-tighter whitespace-nowrap">
                      {activeConfig?.mode === 'speed' ? `0-${activeConfig.target} KM/H` : activeConfig?.mode === 'distance' ? `${activeConfig.target}m Conv.` : 'TELEM. LIVRE'}
                    </span>
                 </div>
              </div>

              {/* Box 2: Last Run/Live Time - BIGGER */}
              <div className="flex flex-col items-end justify-center bg-black/40 p-3 rounded-[24px] border border-white/5 backdrop-blur-xl shadow-2xl flex-1">
                 <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-2">TEMPO DE PUXADA</span>
                 <span className="text-4xl font-display font-black text-white italic leading-none tracking-tighter">
                   {elapsedTime.toFixed(2)}<span className="text-sm ml-0.5 text-zinc-600">s</span>
                 </span>
              </div>
           </div>
        )}

        {/* Speedometer Gauge & Central UI */}
        {!lastResult ? (
          <div className="flex-1 flex flex-col items-center relative h-full">
             
             {/* Main Dashboard Core */}
             <div className="relative w-full flex-1 flex flex-col items-center justify-center -mt-6 min-h-0">
                <button 
                  onClick={() => setShowPerfSettings(true)}
                  className="absolute top-0 right-4 z-20 p-3 bg-zinc-900/60 backdrop-blur-2xl rounded-xl border border-white/10 text-white active:scale-95 transition-all shadow-xl"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
                {/* Refined Arch Gauge */}
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg className="absolute w-[140%] h-[140%] opacity-20 pointer-events-none" viewBox="0 0 100 80">
                    <path 
                      d="M 15 65 A 40 40 0 1 1 85 65" 
                      className="stroke-zinc-900 fill-none" 
                      strokeWidth="4" 
                      strokeLinecap="round"
                      strokeDasharray="1 3"
                    />
                    <motion.path 
                      d="M 15 65 A 40 40 0 1 1 85 65" 
                      className="fill-none" 
                      stroke={currentSpeed > 200 ? "#ef4444" : "#ffffff"}
                      strokeWidth="4" 
                      strokeLinecap="round"
                      strokeDasharray="150"
                      strokeDashoffset={150 - (Math.min(currentSpeed, 300) / 300) * 150}
                      initial={{ strokeDashoffset: 150 }}
                      animate={{ strokeDashoffset: 150 - (Math.min(currentSpeed, 300) / 300) * 150 }}
                    />
                  </svg>

                  {/* Speed & G-Force Core */}
                  <div className="flex flex-col items-center justify-center z-10">
                     <div className="flex flex-col items-center">
                        <motion.span 
                          className={`text-[100px] font-display font-black italic tracking-tighter leading-none ${isRunning ? 'text-white' : 'text-zinc-800'}`}
                        >
                           <SmoothCounter value={currentSpeed} />
                        </motion.span>
                        <div className="flex flex-col items-center -mt-2">
                           <span className="text-[12px] font-black text-zinc-500 uppercase tracking-[0.8em] italic ml-3">KM/H</span>
                        </div>
                     </div>

                     {/* Live G-Force Meter */}
                     {isRunning && (
                       <div className="mt-4 px-4 py-1 bg-zinc-900/40 backdrop-blur-md rounded-full border border-white/5 flex items-center gap-2 shadow-2xl">
                          <ActivityIcon className="w-3 h-3 text-brand-primary" />
                          <span className="text-lg font-display font-black text-white italic tracking-tighter">{gForce.toFixed(2)}<span className="text-[10px] ml-0.5 text-zinc-500">G</span></span>
                       </div>
                     )}
                  </div>
                </div>

                {/* High-Resolution Distance Progress Bar */}
                {activeConfig?.mode === 'distance' && isRunning && (
                   <div className="w-64 mt-6 space-y-1.5">
                      <div className="flex justify-between items-end">
                         <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Progresso da Puxada</span>
                         <span className="text-[10px] font-display font-black italic text-white">{distance.toFixed(0)}m / {activeConfig.target}m</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-900/50 rounded-full overflow-hidden border border-white/5">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${progress}%` }}
                           className="h-full bg-brand-primary shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                         />
                      </div>
                   </div>
                )}

                {/* SINAL VERDE / CANCELAR TESTE */}
                {!isRunning ? (
                  <div className="mt-8 min-h-[100px] flex flex-col items-center justify-center">
                      <AnimatePresence mode="wait">
                         {isWaiting ? (
                           <motion.div 
                             key="classic-waiting"
                             initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                             className="flex flex-col items-center gap-3 text-center"
                           >
                             <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${isReady ? 'bg-brand-secondary shadow-[0_0_30px_rgba(34,197,94,0.6)]' : isSettling ? 'bg-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)]' : 'bg-zinc-900 border border-white/5 animate-pulse'}`}>
                                {isReady ? <Play className="w-6 h-6 text-white fill-current" /> : isSettling ? <Clock className="w-6 h-6 text-white animate-spin" /> : <Clock className="w-6 h-6 text-zinc-600" />}
                             </div>
                             <div>
                                <h4 className={`text-xl font-display font-black italic uppercase tracking-tighter transition-colors duration-500 ${isReady ? 'text-brand-secondary' : isSettling ? 'text-yellow-500' : 'text-zinc-600'}`}>
                                   {isReady ? 'SINAL VERDE: ARRANQUE!' : isSettling ? `ESTABILIZANDO... ${settlingCountdown.toFixed(1)}s` : 'AGUARDANDO PARADA...'}
                                </h4>
                                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                                   {isReady ? 'O cronà´metro iniciará ao detectar movimento' : isSettling ? 'Não se mova enquanto o GPS estabiliza' : 'O teste comeà§a com o carro parado'}
                                 </p>
                             </div>
                           </motion.div>
                        ) : (
                          <motion.div 
                            key="classic-setup"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex flex-col items-center gap-4"
                          >
                            <div className="text-center">
                               <h3 className="text-2xl font-display font-black text-white italic uppercase tracking-tighter leading-none">VAMOS COMEà‡AR?</h3>
                               <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.3em] mt-1.5">Verifique o sinal de satélite acima</p>
                            </div>
                            
                            {activeConfig?.type === 'standing' && (
                               <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-950/40 border border-white/5">
                                 <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">Rollout 1ft</span>
                                 <button 
                                   onClick={() => setUseRollout(!useRollout)}
                                   className={`w-8 h-4 rounded-full relative transition-colors ${useRollout ? 'bg-brand-primary' : 'bg-zinc-800'}`}>
                                   <motion.div animate={{ x: useRollout ? 16 : 0 }} className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full" />
                                 </button>
                               </div>
                            )}

                            <button 
                                                             onClick={onStartWithStabilizer}
                                                            disabled={currentSpeed > 1.5}
                              className={`w-full min-w-[200px] py-4 bg-brand-primary text-white font-display font-black text-xl italic tracking-[0.1em] uppercase rounded-[28px] shadow-[0_15px_40px_rgba(239,68,68,0.3)] border-t border-white/20 active:scale-95 transition-all ${currentSpeed > 1.5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                                            {currentSpeed > 1.5 ? 'PARE O VEÍCULO' : 'INICIAR'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                  </div>
                ) : (
                   /* Abort Button during Run */
                   <motion.button
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     onClick={reset}
                     className="mt-12 px-8 py-3 bg-zinc-900 text-white/50 border border-white/10 rounded-full font-black italic uppercase tracking-widest text-[8px] active:scale-95 transition-all flex items-center gap-2 hover:text-red-500 hover:border-red-500/30"
                   >
                     <X className="w-3 h-3" />
                     ABORTAR PUXADA
                   </motion.button>
                )}
             </div>

             {/* Bottom Interruption Button - For free/trip modes only */}
             <div className="w-full flex flex-col items-center pb-2">
                {((activeConfig?.mode === 'free' || activeConfig?.mode === 'trip') && isRunning) && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    onClick={manualStop}
                    className="w-full py-5 bg-red-600 text-white font-black italic uppercase tracking-[0.3em] rounded-[24px] shadow-[0_10px_30px_rgba(220,38,38,0.3)] border-t border-white/20 active:scale-95 transition-all text-xs"
                  >
                    INTERROMPER TESTE
                  </motion.button>
                )}
             </div>
          </div>
        ) : (
          /* Racing Results Screen (Elite) - Tabbed Layout */
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col px-1 pb-4 overflow-hidden"
          >
             <div className="flex-1 relative rounded-[32px] bg-gradient-to-br from-zinc-900 to-black border border-white/5 overflow-hidden mb-4 shadow-2xl flex flex-col">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/10 blur-[50px] pointer-events-none" />
                
                {/* Elite Tabs */}
                <div className="flex p-2 bg-black/40 backdrop-blur-xl border-b border-white/5">
                   {(['summary', 'telemetry', 'map'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setResultTab(tab)}
                        className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${resultTab === tab ? 'bg-brand-primary text-white shadow-lg shadow-red-600/20' : 'text-zinc-600 hover:text-zinc-400'}`}
                      >
                         {tab === 'summary' ? 'Resumo' : tab === 'telemetry' ? 'Telemetria' : 'Percurso'}
                      </button>
                   ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                   {resultTab === 'summary' && (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                         <div className="flex justify-between items-start">
                            {/* Lado Esquerdo: Veículo */}
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center shrink-0">
                                  {activeVehicle?.photoURL ? (
                                     <img src={activeVehicle.photoURL} alt="Car" className="w-full h-full object-cover" />
                                  ) : (
                                     <Car className="w-5 h-5 text-zinc-600" />
                                  )}
                               </div>
                               <div className="flex flex-col">
                                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">Veículo Testado</span>
                                  <span className="text-sm font-display font-black text-white italic uppercase tracking-tighter leading-none">{activeVehicle?.nickname || 'Piloto Anônimo'}</span>
                                  <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{activeVehicle?.brand} {activeVehicle?.model}</span>
                               </div>
                            </div>

                            {/* Lado Direito: Pontuação e Registro */}
                            <div className="text-right flex flex-col items-end">
                               <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Pontuação</span>
                               <span className="text-xl font-display font-black text-white italic leading-none">{lastResult.performanceScore || 0} <span className="text-[10px] text-zinc-500">PTS</span></span>
                               
                               <div className="mt-2 text-right">
                                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest block mb-0.5">Registro da Puxada</span>
                                  <span className="text-[10px] font-mono text-brand-primary font-bold bg-brand-primary/10 px-1.5 py-0.5 rounded-sm">{lastResult.runSerial || 'DF-PREVIEW'}</span>
                               </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-2 gap-8">
                            <div className="flex flex-col">
                               <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Velocidade Final</span>
                               <p className="text-5xl font-display font-black text-white italic leading-none mt-1">
                                 {Math.round(lastResult.maxSpeed)}<span className="text-lg ml-1 text-red-600">KM/H</span>
                               </p>
                            </div>
                            <div className="flex flex-col">
                               <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Duração</span>
                               <p className="text-5xl font-display font-black text-brand-accent italic leading-none mt-1">
                                 {lastResult.time.toFixed(2)}<span className="text-lg ml-1">SEG</span>
                               </p>
                            </div>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                               <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Potência Est.</span>
                               <span className="text-2xl font-display font-black text-white italic">{lastResult.estimatedPowerCV || 0} <span className="text-xs text-zinc-500">CV</span></span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                               <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Inclinação Média</span>
                               <span className={`text-2xl font-display font-black italic ${Math.abs(lastResult.slope || 0) > 1.0 ? 'text-yellow-500' : 'text-white'}`}>
                                  {lastResult.slope?.toFixed(1)}%
                               </span>
                            </div>
                         </div>

                         <div className="space-y-3">
                            <div className="flex items-center justify-between">
                               <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em]">Intervalos de Velocidade</span>
                               <button onClick={() => setResultTab('telemetry')} className="text-[8px] font-black text-brand-primary uppercase tracking-widest flex items-center gap-1">
                                  Ver Telemetria <ChevronRight className="w-2.5 h-2.5" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               {calculateIntervals(lastResult.path, [20, 40, 60, 80, 100, 120, 160, 200]).map(interval => (
                                 <div key={interval.target} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                                    <span className="text-[8px] font-bold text-zinc-400 uppercase">0-{interval.target}</span>
                                    <span className="text-sm font-display font-black text-white italic">{interval.time.toFixed(2)}s</span>
                                 </div>
                               ))}
                            </div>
                         </div>

                         {/* Mini Telemetry Preview */}
                         <div className="mt-4 pt-4 border-t border-white/5">
                            <div className="h-32 opacity-60">
                               <PerformanceChart result={lastResult} isPremium={true} />
                            </div>
                         </div>
                      </motion.div>
                   )}

                   {resultTab === 'telemetry' && (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col">
                         <div className="flex-1 min-h-[300px]">
                            <PerformanceChart 
                              result={lastResult} 
                              opponentResult={activeChallenge?.result} 
                              isPremium={true} 
                            />
                         </div>
                         <div className="mt-4 p-4 rounded-2xl bg-zinc-950 border border-white/5">
                            <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Análise de G-Force</h4>
                            <div className="flex justify-between items-center">
                               <div className="flex flex-col">
                                  <span className="text-[7px] text-zinc-600 uppercase font-bold">Pico Lateral</span>
                                  <span className="text-lg font-display font-black text-white italic">1.12G</span>
                               </div>
                               <div className="flex flex-col text-right">
                                  <span className="text-[7px] text-zinc-600 uppercase font-bold">Pico Longitudinal</span>
                                  <span className="text-lg font-display font-black text-brand-primary italic">{lastResult.maxG?.toFixed(2)}G</span>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                   )}

                   {resultTab === 'map' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col">
                         <div className="flex-1 rounded-[24px] overflow-hidden border border-white/5 shadow-2xl min-h-[400px]">
                            <RunMap result={lastResult} />
                         </div>
                         <div className="mt-4 flex items-center justify-between px-2">
                            <div className="flex flex-col">
                               <span className="text-[7px] text-zinc-600 uppercase font-bold tracking-widest">Localização</span>
                               <span className="text-[9px] font-bold text-zinc-400 uppercase">{lastResult.location?.latitude.toFixed(4)}, {lastResult.location?.longitude.toFixed(4)}</span>
                            </div>
                            <div className="flex flex-col text-right">
                               <span className="text-[7px] text-zinc-600 uppercase font-bold tracking-widest">Distà¢ncia Total</span>
                               <span className="text-[9px] font-bold text-zinc-400 uppercase">{Math.round(lastResult.distance)} Metros</span>
                            </div>
                         </div>
                      </motion.div>
                   )}
                </div>

                <div className="p-6 bg-black/60 border-t border-white/5 flex gap-3">
                   <button 
                     onClick={reset} 
                     className="flex-1 py-4 bg-brand-primary text-white font-display font-black italic uppercase tracking-[0.2em] rounded-2xl active:scale-95 transition-all text-[11px] shadow-lg shadow-red-600/20"
                   >
                      REPETIR TESTE
                   </button>
                   <button className="px-6 py-4 bg-zinc-800 text-white rounded-2xl active:scale-95 transition-all">
                      <Share2Icon className="w-5 h-5" />
                   </button>
                </div>
             </div>
          </motion.div>
        )}
      </main>

      {/* Elite Quick Switch Modal */}
      <AnimatePresence>
        {isQuickSwitchOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-end justify-center p-4"
            onClick={() => setIsQuickSwitchOpen(false)}
          >
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="w-full max-w-md bg-[#0a0a0a] border-t border-white/10 rounded-t-[50px] p-10 space-y-8"
              onClick={e => e.stopPropagation()}
            >
              <header className="flex justify-between items-center">
                 <h3 className="text-2xl font-display font-black italic text-white uppercase">GARAGEM <span className="text-brand-primary">ELITE</span></h3>
                 <button onClick={() => setIsQuickSwitchOpen(false)} className="p-3 bg-white/5 rounded-2xl text-zinc-600">
                   <X className="w-6 h-6" />
                 </button>
              </header>

              <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <button onClick={() => { setRunVehicleId('anonimo'); setIsQuickSwitchOpen(false); }} className={`flex flex-col gap-3 p-4 rounded-[32px] border transition-all ${runVehicleId === 'anonimo' ? 'bg-white/5 border-brand-primary shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-zinc-950 border-white/5'}`}>
                  <div className="aspect-square w-full rounded-2xl bg-zinc-900 flex flex-col items-center justify-center border border-white/5 gap-2">
                    <EyeOff className="w-6 h-6 text-zinc-700" />
                    <span className="text-[8px] text-zinc-700 font-black uppercase tracking-widest">Modo Fantasma</span>
                  </div>
                  <p className="text-[10px] font-black text-white uppercase italic text-center">Anà´nimo</p>
                </button>
                {vehicles.map(v => (
                  <button key={v.id} onClick={() => { setRunVehicleId(v.id || ''); setIsQuickSwitchOpen(false); }} className={`flex flex-col gap-3 p-4 rounded-[32px] border transition-all ${runVehicleId === v.id ? 'bg-white/5 border-brand-primary shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-zinc-950 border-white/5'}`}>
                    <div className="aspect-square w-full rounded-2xl bg-zinc-900 overflow-hidden border border-white/5">
                      {v.photoURL ? <img src={v.photoURL} className="w-full h-full object-cover" /> : (v.type === 'car' ? <Car className="w-8 h-8 text-zinc-800 m-auto mt-4" /> : <Navigation className="w-8 h-8 text-zinc-800 -rotate-90 m-auto mt-4" />)}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-white uppercase italic truncate">{v.nickname}</p>
                      <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">{v.brand}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Pocket Mode Overlay */}
      {pocketMode && !lastResult && (isStabilizing || isWaiting || isRunning) && (
        <div className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0)', backgroundSize: '15px 15px' }} />
          
          <div className="w-24 h-24 rounded-full bg-brand-primary/10 flex items-center justify-center mb-8 animate-pulse border border-brand-primary/30">
            <Lock className="w-10 h-10 text-brand-primary" />
          </div>
          
          <h3 className="text-3xl font-display font-black italic text-white uppercase tracking-tighter mb-2">
            MODO BOLSO ATIVO
          </h3>
          
          <p className="text-xs text-zinc-400 uppercase tracking-widest max-w-xs mb-12 leading-relaxed">
            {isStabilizing 
              ? `Estabilizando... Guarde no bolso em ${stabilizerCountdown}s` 
              : isWaiting 
              ? 'Aguardando arrancada no bolso...' 
              : 'Puxada em andamento!'}
          </p>

          <div className="w-full max-w-xs bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-2xl mb-8">
            <div className="flex justify-between items-center text-left mb-2">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Velocidade Atual</span>
              <span className="text-xl font-display font-black text-white italic">{Math.round(currentSpeed)} <span className="text-[10px] text-zinc-500">KM/H</span></span>
            </div>
            <div className="flex justify-between items-center text-left">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Tempo</span>
              <span className="text-xl font-display font-black text-brand-accent italic">{elapsedTime.toFixed(1)}s</span>
            </div>
          </div>

          <div className="w-full max-w-xs h-14 bg-zinc-900 rounded-full p-1 relative flex items-center overflow-hidden border border-white/5">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 250 }}
              dragElastic={0.1}
              dragMomentum={false}
              onDragEnd={(event, info) => {
                if (info.offset.x >= 200) {
                  setPocketMode(false);
                }
              }}
              className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg z-10"
            >
              <ChevronRight className="w-6 h-6 text-black font-bold" />
            </motion.div>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] pointer-events-none select-none">
              Deslize para Desbloquear
            </span>
          </div>
        </div>
      )}

      {/* Performance Settings Modal */}
      <AnimatePresence>
        {showPerfSettings && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[32px] p-6 space-y-6 shadow-2xl relative"
            >
              <header className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-lg font-display font-black italic text-white uppercase">Ajustes do Teste</h3>
                </div>
                <button onClick={() => setShowPerfSettings(false)} className="p-2 bg-white/5 rounded-xl text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </header>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">Modo Bolso</h4>
                    <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">Previne toques acidentais</p>
                  </div>
                  <button 
                    onClick={() => setPocketMode(!pocketMode)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${pocketMode ? 'bg-brand-primary' : 'bg-zinc-800'}`}
                  >
                    <motion.div animate={{ x: pocketMode ? 16 : 0 }} className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">Estabilizador (15s)</h4>
                    <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">Apenas no Modo Bolso</p>
                  </div>
                  <button 
                    onClick={() => setStabilizer15s(!stabilizer15s)}
                    disabled={!pocketMode}
                    className={`w-10 h-6 rounded-full relative transition-colors ${stabilizer15s && pocketMode ? 'bg-brand-primary' : 'bg-zinc-800'} ${!pocketMode ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    <motion.div animate={{ x: stabilizer15s && pocketMode ? 16 : 0 }} className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
                  </button>
                </div>



                <div className="p-4 bg-zinc-950 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-white">Sensibilidade do Sensor</h4>
                      <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">Ajuste para evitar queima de largada</p>
                    </div>
                    <span className="text-xs font-display font-black text-brand-primary italic">
                      {telemetryConfig.motionSensitivity}G
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[7px] font-bold text-zinc-500 uppercase tracking-widest">
                      <span>Vibração Atual</span>
                      <span>{liveVibration.toFixed(2)}G</span>
                    </div>
                    <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/5 relative">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100" 
                        style={{ width: `${Math.min(100, (liveVibration / 3.0) * 100)}%` }}
                      />
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_5px_#fff]" 
                        style={{ left: `${Math.min(100, (telemetryConfig.motionSensitivity / 3.0) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[7px] font-bold text-zinc-500 uppercase tracking-widest">
                      <span>Ajuste Manual</span>
                      <span>1.0G - 3.0G</span>
                    </div>
                    <input 
                      type="range" 
                      min="1.0" 
                      max="3.0" 
                      step="0.05"
                      value={telemetryConfig.motionSensitivity}
                      onChange={(e) => setTelemetryConfig(prev => ({ ...prev, motionSensitivity: parseFloat(e.target.value) }))}
                      className="w-full accent-brand-primary bg-zinc-900 h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={startAutoCalibration}
                    disabled={isCalibrating}
                    className={`w-full py-3 rounded-xl font-display font-black italic uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 ${isCalibrating ? 'bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 animate-pulse' : 'bg-zinc-900 text-white border border-white/5 hover:border-brand-primary/30'}`}
                  >
                    <RefreshCcw className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} />
                    {isCalibrating ? 'CALIBRANDO (ACELERE O MOTOR)...' : 'CALIBRAÇÃO AUTOMÁTICA'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}




export default function App() {
  const [telemetryConfig, setTelemetryConfig] = useState<TelemetryConfig>({
    motionSensitivity: 1.4,
    noiseFloor: 0.05,
    maxAccelG: 2.5,
    fusionGpsWeight: 0.95,
    fusionAccelGain: 1.0
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_config', 'settings'), (snapshot) => {
      if (snapshot.exists()) {
        const settings = snapshot.data() as SystemSettings;
        if (settings.activeProfileId && settings.profiles?.[settings.activeProfileId]) {
          setTelemetryConfig(settings.profiles[settings.activeProfileId]);
        } else {
          // Backward compatibility or direct settings
          setTelemetryConfig(snapshot.data() as TelemetryConfig);
        }
      }
    }, (error) => {
      console.error("Error fetching telemetry config:", error);
    });
    return () => unsub();
  }, []);


  const {
    currentSpeed,
    distance,
    isRunning,
    isWaiting,
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
    isReady,
    progress,
    gpsSource,
    setGpsSource,
    currentLat,
    currentLng,
    currentHeading,
    isSettling,
    settlingCountdown
  } = usePerformanceTimer(telemetryConfig);


  const [screen, setScreen] = useState<Screen>('home');

  // --- Keep Awake Logic ---
  useEffect(() => {
    const shouldKeepAwake = isRunning || isWaiting || screen === 'cornering-assistant';
    
    const updateKeepAwake = async () => {
      try {
        if (shouldKeepAwake) {
          await KeepAwake.keepAwake();
        } else {
          await KeepAwake.allowSleep();
        }
      } catch (e) {
        console.error("Error updating KeepAwake:", e);
      }
    };

    updateKeepAwake();
  }, [isRunning, isWaiting, screen]);
  const [showPerformanceMenu, setShowPerformanceMenu] = useState(false);

  useEffect(() => {
    let listener: any;
    const setupBackButton = async () => {
      if (!Capacitor.isNativePlatform()) return;
      listener = await CapacitorApp.addListener('backButton', () => {
        setScreen(currentScreen => {
          if (currentScreen === 'home' || currentScreen === 'login') {
            CapacitorApp.exitApp();
            return currentScreen;
          }
          
          if (currentScreen === 'timer') {
            reset();
            setActiveConfig(null);
          }
          
          return 'home';
        });
      });
    };
    setupBackButton();
    return () => {
      if (listener) listener.remove();
    };
  }, []);
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);
  const [activeConfig, setActiveConfig] = useState<RunPreset | null>(null);
  const [customConfig, setCustomConfig] = useState<{
    type: 'speed' | 'distance';
    startSpeed: number;
    target: number;
  }>({ type: 'speed', startSpeed: 0, target: 100 });
  const [useRollout, setUseRollout] = useState(true);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const isAdmin = useMemo(() => {
    return user?.email ? ADMIN_EMAILS.includes(user.email) : false;
  }, [user]);

  const isUserPremium = useMemo(() => {
    return isAdmin || userProfile?.isPremium;
  }, [isAdmin, userProfile]);

  const [currentMissions, setCurrentMissions] = useState<any[]>([]);
  const [pendingReward, setPendingReward] = useState<{
    position: '1' | '2' | '3';
    rewardAmount: number;
    type: 'global' | 'regional';
    month: string;
  } | null>(null);

  const [isGuest, setIsGuest] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const lastSavedRunIdRef = useRef<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [guestTermsAccepted, setGuestTermsAccepted] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);
  const [showChallengeSearch, setShowChallengeSearch] = useState(false);
  const [searchTarget, setSearchTarget] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState<Partial<PowerReference> | null>(null);
  const [catalogVehicle, setCatalogVehicle] = useState<Vehicle | null>(null);
  const [runVehicleId, setRunVehicleId] = useState<string | null>(null);
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [powerReferences, setPowerReferences] = useState<PowerReference[]>([]);

  const handleEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setScreen('vehicle-settings');
  };

  const handleAddNew = () => {
    setEditingVehicle(baseVehicle);
    setScreen('vehicle-settings');
  };

  useEffect(() => {
    if (vehicle?.id && !runVehicleId) {
      setRunVehicleId(vehicle.id);
    }
  }, [vehicle]);

  const logActivity = async (type: Activity['type'], data: Activity['data']) => {
    if (!user || !userProfile) return;
    try {
      await addDoc(collection(db, 'activities'), {
        uid: user.uid,
        userName: userProfile.displayName,
        userPhoto: userProfile.photoURL,
        handle: userProfile.handle,
        type,
        data,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("Error logging activity:", e);
    }
  };

  // --- Cornering Assistant Integration ---
  const [destination, setDestination] = useState<string | null>(null);
  const { 
    nextCurve, 
    posteriorCurve,
    upcomingNodes, 
    allRegionalWays,
    isLoading,
    lookAheadDistance,
    isRouteMode, 
    currentRoadName,
    snappedLocation,
    smoothLocation,
    trailNodes,
    imu
  } = useCorneringAssistant(
    currentLat, 
    currentLng, 
    currentHeading, 
    currentSpeed, 
    user?.uid,
    isGuest,
    telemetryConfig,
    destination
  );

  // Challenge Listener
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'challenges'), 
      where('opponentId', '==', user.uid),
      where('status', '==', 'pending'),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const challenge = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Challenge;
        setIncomingChallenge(challenge);
      } else {
        setIncomingChallenge(null);
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      if (!user) return;
      try {
        console.log("Testing Firestore connection...");
        // Try to read a non-existent doc to test connectivity
        await getDocFromServer(doc(db, '_connection_test', 'ping'));
        console.log("Firestore connection test successful (Read)");
      } catch (error) {
        console.error("Firestore connection test failed:", error);
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    }
    testConnection();
  }, [user]);

  // Power References Listener
  useEffect(() => {
    const q = query(collection(db, 'power_references'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const refs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PowerReference));
      setPowerReferences(refs);
    }, (error) => {
      console.warn("Error fetching power references:", error);
    });
    return () => unsubscribe();
  }, []);

  // Auth Listener
  useEffect(() => {
    let unsubscribeVehicles: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'No user');
      // Log auth state
      console.log('Passo 1: Firebase percebeu ' + (firebaseUser ? 'Usuário Logado' : 'Deslogado'));
      
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (firebaseUser) {
        setIsGuest(false); // Reset guest mode if logged in

        // Sync user profile with Retries
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          let retryCount = 0;
          const maxRetries = 3;
          let userData: UserProfile | undefined;
          let success = false;

          while (retryCount < maxRetries && !success) {
            try {
              // Try to get data with a smaller timeout or just normally
              const userSnap = await getDoc(userRef);
              userData = userSnap.data() as UserProfile | undefined;
              
              if (!userSnap.exists()) {
                userData = {
                  uid: firebaseUser.uid,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                  termsAccepted: false,
                  termsVersion: TERMS_VERSION,
                  isPremium: false,
                  followersCount: 0,
                  followingCount: 0,
                  createdAt: new Date().toISOString()
                };
                await setDoc(userRef, userData);
                // Store email privately
                await setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'data'), {
                  email: firebaseUser.email
                });
                setScreen('terms');
              } else if (userData?.isBanned) {
                setScreen('banned');
              } else if (!userData?.termsAccepted || userData?.termsVersion !== TERMS_VERSION) {
                setScreen('terms');
              } else {
                setScreen('home');
              }
              success = true;
            } catch (syncError: any) {
              retryCount++;
              console.error(`Sync attempt ${retryCount} failed:`, syncError);
              
              // If we are on first retry and it's a network thing, we can try to enableNetwork once
              if (retryCount === 1) {
                try { await enableNetwork(db); } catch(e) {}
              }

              if (retryCount < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * retryCount));
              } else {
                // Fallback: If we can't sync but show existing user, at least go to home
                if (screen === 'login' || screen === 'terms') {
                  setScreen('home');
                }
                success = true; // Stop loop even if failed, we handle it via fallback
              }
            }
          }

          setUserProfile(userData || null);
          if (userData) {
            checkPeriodicMissions(userData);
            checkMonthlyRewards(userData);
          }
          setIsLoggingIn(false); 

          // Real-time vehicles sync
          const vehiclesRef = collection(db, 'vehicles');
          const q = query(vehiclesRef, where('uid', '==', firebaseUser.uid));
          
          unsubscribeVehicles = onSnapshot(q, (snapshot) => {
            const vehicleList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Vehicle));
            setVehicles(vehicleList);
            const active = vehicleList.find(v => v.active) || vehicleList[0] || null;
            setVehicle(active);
          }, (error) => {
            console.warn('Vehicle sync error:', error);
          } );
        } catch (error: any) {
          console.error('Error syncing user data:', error);
          setIsLoggingIn(false);
          setScreen('home'); // Always transition to home as fallback
        }
      } else {
        console.log('User signed out or null');
        setIsLoggingIn(false); // Reset if user is null
        if (unsubscribeVehicles) {
          unsubscribeVehicles();
          unsubscribeVehicles = null;
        }
        if (!isGuest) {
          setVehicle(null);
          setVehicles([]);
          setScreen('login');
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeVehicles) unsubscribeVehicles();
    };
  }, []); // Only run once on mount

  const handleAcceptTerms = async () => {
    if (isGuest) {
      setGuestTermsAccepted(true);
      setScreen('home');
      return;
    }

    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        termsAccepted: true,
        termsVersion: TERMS_VERSION,
        acceptedAt: new Date().toISOString()
      });
      setUserProfile(prev => prev ? { ...prev, termsAccepted: true, termsVersion: TERMS_VERSION } : null);
      setScreen('home');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), data, { merge: true });
      // Update local user state to reflect changes in UI immediately
      if (data.displayName || data.photoURL) {
        setUser(prev => prev ? { ...prev, ...data } as FirebaseUser : null);
      }
      // Update userProfile state
      setUserProfile(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleCompleteMission = async (missionId: string) => {
    if (!user || !userProfile) return;
    
    // Check if already completed/claimed
    const isClaimed = userProfile.completedMissions?.includes(missionId);
    if (isClaimed) return;

    try {
      const ref = doc(db, 'users', user.uid);
      const newProgress = { ...(userProfile.missionProgress || {}), [missionId]: true };
      
      await updateDoc(ref, { missionProgress: newProgress });
      setUserProfile(prev => prev ? { ...prev, missionProgress: newProgress } : null);
      
      logRemote({ uid: user.uid, level: 'info', message: `Mission marked for claim: ${missionId}` });
    } catch (e) {
      console.error('Error completing mission:', e);
    }
  };

  const checkMonthlyRewards = async (profile: UserProfile) => {
    if (!user || isGuest) return;

    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    if (profile.lastRewardClaimMonth === currentMonth) return;

    try {
      // Calculate previous month range
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1, 1);
      lastMonth.setHours(0, 0, 0, 0);
      const startOfLastMonth = lastMonth.getTime();

      const endMonth = new Date();
      endMonth.setDate(1);
      endMonth.setHours(0, 0, 0, 0);
      const startOfCurrentMonth = endMonth.getTime();

      const lastMonthName = lastMonth.toLocaleString('pt-BR', { month: 'long' });

      // Check Global Top 3 (0-100 and 201m)
      const categories: ('0-100' | '201m')[] = ['0-100', '201m'];
      
      for (const cat of categories) {
        const mode = cat === '201m' ? 'distance' : 'speed';
        const target = cat === '201m' ? 201 : 100;

        const q = query(
          collection(db, 'rankings'),
          where('category', '==', cat),
          where('timestamp', '>=', startOfLastMonth),
          where('timestamp', '<', startOfCurrentMonth),
          orderBy('time', 'asc'),
          limit(3)
        );

        const snap = await getDocs(q);
        const top3 = snap.docs.map(d => ({ uid: d.data().uid }));
        
        const myIndex = top3.findIndex(entry => entry.uid === user.uid);
        if (myIndex !== -1) {
          const pos = (myIndex + 1).toString() as '1' | '2' | '3';
          const rewardBase = pos === '1' ? 1000 : pos === '2' ? 500 : 250;
          
          setPendingReward({
            position: pos,
            rewardAmount: rewardBase * 2, // Double for Global
            type: 'global',
            month: lastMonthName
          });
          return; // Show one at a time
        }
      }

      // If also checking regional, we would need to filter by distances... 
      // but usually regional rewards are also checked here if we have a stable way of defining "region" winners 
      // For now, focusing on Global as requested for "double" and logic is similar.

    } catch (e) {
      console.error('Error checking monthly rewards:', e);
    }
  };

  const handleClaimMonthlyReward = async () => {
    if (!user || !userProfile || !pendingReward) return;

    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const newCoins = (userProfile.dfCoins || 0) + pendingReward.rewardAmount;
      const ref = doc(db, 'users', user.uid);
      
      await updateDoc(ref, {
        dfCoins: newCoins,
        lastRewardClaimMonth: currentMonth
      });

      setUserProfile({ 
        ...userProfile, 
        dfCoins: newCoins, 
        lastRewardClaimMonth: currentMonth 
      });

      logActivity('ranking_reward', {
        position: pendingReward.position,
        amount: pendingReward.rewardAmount,
        month: pendingReward.month
      });

      setPendingReward(null);
      alert(`Parabéns! Você resgatou ${pendingReward.rewardAmount} DC pelo seu pódio em ${pendingReward.month}!`);
    } catch (e) {
      console.error('Error claiming monthly reward:', e);
    }
  };

  const checkPeriodicMissions = (profile: UserProfile) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const updates: Partial<UserProfile> = {};
    let hasChanges = false;

    // Daily Login
    if (profile.lastLoginDate !== todayStr) {
      const currentProgress = profile.missionProgress || {};
      updates.lastLoginDate = todayStr;
      updates.missionProgress = { ...currentProgress, 'daily_login': true };
      
      // If it was daily login, we remove 'daily_login' from completedMissions 
      // so they can claim it again today.
      updates.completedMissions = (profile.completedMissions || []).filter(id => id !== 'daily_login');
      hasChanges = true;
    }

    // Weekly Reset (Every Monday at 04:00)
    const lastMonday = new Date();
    lastMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    lastMonday.setHours(4, 0, 0, 0);
    
    const lastResetStr = lastMonday.toISOString();
    if (profile.lastWeeklyReset !== lastResetStr) {
      updates.lastWeeklyReset = lastResetStr;
      
      // Reset progress and completion for weekly missions
      const weeklyIds = ACHIEVEMENTS.filter(a => a.type === 'weekly').map(a => a.id);
      
      const currentMissions = profile.completedMissions || [];
      updates.completedMissions = (updates.completedMissions || currentMissions).filter(id => !weeklyIds.includes(id));
      
      const currentProgress = updates.missionProgress || profile.missionProgress || {};
      const newProgress = { ...currentProgress };
      weeklyIds.forEach(id => delete newProgress[id]);
      updates.missionProgress = newProgress;
      
      hasChanges = true;
    }

    if (hasChanges) {
      handleUpdateProfile(updates);
    }
  };

  const [showPrecisionHint, setShowPrecisionHint] = useState(false);
  useEffect(() => {
    if (screen === 'timer' && !isRunning && !lastResult) {
      setShowPrecisionHint(true);
      const timer = setTimeout(() => setShowPrecisionHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [screen, isRunning, lastResult]);

  const handleGuestLogin = () => {
    setIsGuest(true);
    setGuestTermsAccepted(false);
    setScreen('terms');
  };

  // Initialize Social Login for native platforms
  useEffect(() => {
    const initSocial = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await SocialLogin.initialize({
            google: {
              webClientId: '724970175479-44l6ps8tevb4frh9vpbir25ovufag319.apps.googleusercontent.com',
              mode: 'online'
            }
          });
        }
      } catch (e) {
        console.error("SocialLogin initialization error:", e);
      }
    };
    initSocial();
  }, []);


  const handleLogin = async () => {
    setIsLoggingIn(true);
    // console.log('Iniciando Autenticação Google...');
    
    // Failsafe timeout
    const failsafe = setTimeout(() => {
      setIsLoggingIn(false);
      // console.warn('Atenção: O processo nà£o respondeu em 10 segundos.');
    }, 10000);

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await SocialLogin.login({
          provider: 'google',
          options: {},
        });

        const res = result.result as any;
        if (res.idToken) {
          const credential = GoogleAuthProvider.credential(res.idToken);
          await signInWithCredential(auth, credential);
        } else {
          throw new Error('Falha ao obter Token do Google');
        }
      } else {
        await signInWithPopup(auth, googleProvider);
      }
      clearTimeout(failsafe);
    } catch (error: any) {
      console.error('Login error:', error);
      setIsLoggingIn(false);
      
      // Tratamento específico de erros
      if (error.code === 'auth/popup-blocked') {
        alert('O login foi bloqueado pelo seu navegador. Por favor, permita pop-ups para este site.');
      } else if (error.code === 'auth/cancelled-popup-request' || error.message?.includes('cancel')) {
        // Usuário cancelou, ignoramos silenciosamente
      } else {
        alert('Erro ao fazer login: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  // Remove redirect result handler as we are using popups only
  useEffect(() => {
    // No-op
  }, []);

  const handleLogout = async () => {
    try {
      if (isGuest) {
        setIsGuest(false);
        setGuestTermsAccepted(false);
        setScreen('login');
      } else {
        await signOut(auth);
        setScreen('login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const saveVehicle = async (v: Vehicle) => {
    if (isGuest) {
      alert("Como Visitante, seus dados nà£o sà£o salvos na nuvem. Crie uma conta ou faà§a login com Google para salvar seus veículos e tempos permanentemente!");
      return;
    }

    if (!user) {
      console.warn('Cannot save vehicle: No user logged in');
      return;
    }
    
    console.log('Attempting to save vehicle:', v);
    
    try {
      if (v.id) {
        // Update existing
        console.log('Updating existing vehicle:', v.id);
        const vehicleRef = doc(db, 'vehicles', v.id);
        await setDoc(vehicleRef, { ...v, updatedAt: new Date().toISOString() }, { merge: true });
        console.log('Vehicle update successful');
      } else {
        // Create new
        console.log('Creating new vehicle');
        const vehicleData = { 
          ...v, 
          uid: user.uid, 
          active: vehicles.length === 0, // Set as active if it's the first one
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          hp: v.hp || 0,
          stage: v.stage || 'Stock',
          maxSpeed: v.maxSpeed || 0,
          mods: v.mods || '',
          observations: v.observations || ''
        };
        const newDocRef = await addDoc(collection(db, 'vehicles'), vehicleData);
        
        logActivity('new_vehicle', {
          vehicleId: newDocRef.id,
          vehicleName: v.nickname,
          description: `${v.brand} ${v.model} (${v.year})`
        });
        
        handleCompleteMission('register_vehicle');
        
        console.log('Vehicle creation successful, ID:', newDocRef.id);
      }

      // Only change screen if we are not already in vehicle-settings
      if (screen !== 'vehicle-settings') {
        setScreen('vehicle-settings');
      }
    } catch (error) {
      console.error('Error saving vehicle:', error);
      handleFirestoreError(error, OperationType.WRITE, `vehicles`);
      throw error; // Re-throw so handleSubmit can catch it
    }
  };

  const selectVehicle = async (v: Vehicle) => {
    if (!user || !v.id) return;

    try {
      const batch = writeBatch(db);
      // Deactivate all
      vehicles.forEach(veh => {
        if (veh.id) {
          batch.update(doc(db, 'vehicles', veh.id), { active: false });
        }
      });
      // Activate selected
      batch.update(doc(db, 'vehicles', v.id), { active: true });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicles/${v.id}`);
    }
  };

  const deleteVehicle = async (v: Vehicle) => {
    if (!user || !v.id) return;
    if (vehicles.length <= 1) {
      alert("Você precisa ter pelo menos um veículo cadastrado.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'vehicles', v.id));
      const newList = vehicles.filter(veh => veh.id !== v.id);
      setVehicles(newList);
      if (v.active) {
        const newActive = newList[0];
        await selectVehicle(newActive);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vehicles/${v.id}`);
    }
  };

  useEffect(() => {
    if (lastResult && calibrationMode) {
      // HANDLE CALIBRATION TEST
      const saveCalibration = async () => {
        try {
          const newId = `ref_${Date.now()}`;
          const newRef: PowerReference = {
            id: newId,
            carName: calibrationMode.carName || 'Capturado',
            weight: calibrationMode.weight || 0,
            time: lastResult.time,
            distance: lastResult.config.target,
            slope: lastResult.slope || 0,
            verifiedCV: calibrationMode.verifiedCV || 0,
            timestamp: Date.now(),
            isLiveTest: true,
            rawRunId: lastResult.id
          };
          
          await setDoc(doc(db, 'power_references', newId), newRef);
          
          // Show success and return to admin
          alert(`Teste de Calibração salvo!\nTempo: ${lastResult.time.toFixed(2)}s\nLocal: ${lastResult.slope?.toFixed(1)}%`);
          setCalibrationMode(null);
          setScreen('admin-dashboard');
        } catch (e) {
          console.error("Failed to save calibration reference:", e);
          alert("Erro ao salvar calibração.");
          setCalibrationMode(null);
        }
      };
      saveCalibration();
      return; // Skip normal saving flow
    }

    if (lastResult && activeChallenge && activeChallenge.status === 'pending') {
      const updatedChallenge: Challenge = {
        ...activeChallenge,
        status: 'completed',
        opponentResult: lastResult
      };
      setActiveChallenge(updatedChallenge);
      setScreen('duel-result');

      // Save duel result to Firestore
      if (user) {
        const challengeRef = doc(db, 'challenges', activeChallenge.id);
        setDoc(challengeRef, updatedChallenge, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.WRITE, `challenges/${activeChallenge.id}`));
      }
    } else if (lastResult && !activeChallenge) {
      // Save solo run result to Firestore
      if (lastSavedRunIdRef.current === lastResult.id) return;

      if (user) {
        const saveRun = async () => {
          try {
            if (!userProfile?.isPremium) {
              const runsRef = collection(db, 'runs');
              const q = query(runsRef, where('uid', '==', user.uid));
              const snapshot = await getDocs(q);
              
              if (snapshot.size >= 2) {
                const sortedDocs = snapshot.docs.sort((a, b) => {
                  const tA = (a.data().timestamp as any)?.seconds || 0;
                  const tB = (b.data().timestamp as any)?.seconds || 0;
                  return tB - tA; // Newest first
                });
                const docsToDelete = sortedDocs.slice(1); 
                for (const d of docsToDelete) {
                  await deleteDoc(doc(db, 'runs', d.id));
                }
              }
            }
            
            const activeVehicle = runVehicleId === 'anonimo' ? null : (vehicles.find(v => v.id === runVehicleId) || vehicle);
            const weightForEstimation = activeVehicle?.weight || 1500;
            
            let estimatedPowerCV = 0;
            let performanceScore = 0;
            if (lastResult.time > 0) {
              estimatedPowerCV = powerService.estimateHorsepower(lastResult, weightForEstimation, powerReferences);
              performanceScore = powerService.calculateScore(estimatedPowerCV, weightForEstimation, lastResult.time);
            }

            // Generate a short user-friendly serial for this run (e.g. DF-A1B2)
            const runSerial = lastResult.runSerial || `DF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

            const selectedVehicle = activeVehicle;

            const runData = { 
              ...lastResult, 
              uid: user.uid,
              vehicleId: selectedVehicle?.id || null,
              vehicleName: selectedVehicle ? `${selectedVehicle.nickname} (${selectedVehicle.model})` : 'Piloto Anà´nimo',
              estimatedPowerCV,
              performanceScore,
              runSerial
            };
             await addDoc(collection(db, 'runs'), runData);
             lastSavedRunIdRef.current = lastResult.id;
             
             // --- AUTO RECORD UPDATE (PB Sync) ---
             if (selectedVehicle && selectedVehicle.id) {
               const vRef = doc(db, 'vehicles', selectedVehicle.id);
               const isStandard0to100 = lastResult.config.mode === 'speed' && lastResult.config.target === 100;
               const isStandard201m = lastResult.config.mode === 'distance' && lastResult.config.target === 201;

               if (isStandard0to100) {
                 if (!selectedVehicle.best0to100 || lastResult.time < selectedVehicle.best0to100) {
                   await setDoc(vRef, { best0to100: lastResult.time }, { merge: true });
                 }
               }
               if (isStandard201m) {
                 if (!selectedVehicle.best201m || lastResult.time < selectedVehicle.best201m) {
                   await setDoc(vRef, { best201m: lastResult.time }, { merge: true });
                 }
               }
             }

             logActivity('new_run', {
              runId: lastResult.id,
              vehicleId: vehicle?.id,
              vehicleName: vehicle?.nickname,
              target: `${lastResult.config.target}${lastResult.config.mode === 'speed' ? ' KM/H' : 'M'}`,
              time: `${lastResult.time.toFixed(2)}s`
            });
            
            console.log("Run saved to Firestore successfully with Score:", performanceScore);

            // --- RANKING SYNC ---
            const isStandard0to100 = lastResult.config.mode === 'speed' && lastResult.config.target === 100;
            const isStandard201m = lastResult.config.mode === 'distance' && lastResult.config.target === 201;

            if (
              (isStandard0to100 || isStandard201m) && 
              lastResult.location &&
              (lastResult.avgAccuracy ?? 100) < 25 && // Relaxed for more inclusion
              (lastResult.maxG ?? 0) < 4.5 && // Relaxed
              lastResult.time > 1.0
            ) {
                const rankingData: Omit<RankingEntry, 'id'> = {
                  uid: user.uid,
                  userName: user.displayName || 'Piloto',
                  userPhoto: user.photoURL || undefined,
                  vehicleName: selectedVehicle ? `${selectedVehicle.nickname} (${selectedVehicle.model})` : 'Veículo nà£o vinculado',
                  vehicleType: selectedVehicle?.type || 'car',
                  time: lastResult.time,
                  maxSpeed: lastResult.maxSpeed,
                  timestamp: lastResult.timestamp,
                  category: isStandard0to100 ? '0-100' : '201m',
                  mode: isStandard0to100 ? 'speed' : 'distance',
                  target: isStandard0to100 ? 100 : 201,
                  latitude: lastResult.location.latitude,
                  longitude: lastResult.location.longitude,
                  slope: lastResult.slope || 0,
                  performanceScore,
                  runSerial,
                  vehicleId: selectedVehicle?.id || undefined
                };
              await addDoc(collection(db, 'rankings'), rankingData);
              await updateLeaderboard(rankingData);
            }
          } catch (e) {
            console.error("Error in saveRun:", e);
          }
        };
        saveRun();
      } else if (isGuest) {
        // Save to localStorage for guest users
        try {
          const localRuns = JSON.parse(localStorage.getItem('dragfire_guest_runs') || '[]');
          if (!localRuns.find((r: any) => r.id === lastResult.id)) {
            localRuns.unshift(lastResult);
            localStorage.setItem('dragfire_guest_runs', JSON.stringify(localRuns.slice(0, 50)));
            lastSavedRunIdRef.current = lastResult.id;
          }
        } catch (e) {
          console.error("Error saving to localStorage:", e);
        }
      }

      if (lastResult.config.mode === 'trip') {
        setScreen('trip-view');
      }
    }
  }, [lastResult, user, isGuest, userProfile?.isPremium, vehicle]);

  const handleSelectPreset = (preset: RunPreset) => {
    setActiveConfig(preset);
    
    if (preset.id === 'custom') {
      setScreen('custom-setup');
      return;
    }

    if (preset.id === 'trip') {
      setScreen('timer');
      startRun({
        mode: 'trip',
        target: 0,
        startSpeed: 0,
        useRollout: false
      });
      return;
    }

    setScreen('timer');
    
    // Auto-start ONLY for rolling starts (100-200)
    if (preset.type === 'rolling') {
      const config: RunConfig = {
        mode: preset.mode,
        target: preset.target,
        startSpeed: preset.startSpeed,
        useRollout: false
      };
      startRun(config);
    }
  };

  const handleStart = () => {
    if (!activeConfig) return;
    
    if (activeConfig.id === 'custom') {
      const config: RunConfig = {
        mode: customConfig.type,
        target: customConfig.target,
        startSpeed: customConfig.startSpeed,
        useRollout: customConfig.type === 'distance' ? useRollout : false,
        isCustom: true
      };
      startRun(config);
      setScreen('timer');
      return;
    }

    const config: RunConfig = {
      mode: activeConfig.mode,
      target: activeConfig.target,
      startSpeed: activeConfig.startSpeed,
      useRollout: activeConfig.type === 'standing' ? useRollout : false
    };
    startRun(config);
  };

  const handleBack = () => {
    reset();
    setScreen('home');
    setActiveConfig(null);
  };

  const handleDuel = () => {
    if (!lastResult) return;
    setShowChallengeSearch(true);
  };

  const handleSearchUsersForChallenge = async () => {
    if (!searchTarget.trim()) return;
    setIsSearching(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', searchTarget),
        where('displayName', '<=', searchTarget + '\uf8ff'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      const usersList = snapshot.docs.map(doc => doc.data() as UserProfile);
      setSearchResults(usersList.filter(u => u.uid !== user?.uid));
    } catch (e) {
      console.error("Error searching users:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const sendChallenge = async (targetUser: UserProfile) => {
    if (!lastResult || !user) return;
    
    const challenge: Challenge = {
      id: crypto.randomUUID(),
      creatorId: user.uid,
      creatorName: user.displayName || 'Piloto',
      opponentId: targetUser.uid,
      isPrivate: true,
      result: lastResult,
      expiresAt: Date.now() + (48 * 60 * 60 * 1000),
      status: 'pending'
    };
    
    try {
      await setDoc(doc(db, 'challenges', challenge.id), challenge);
      alert(`Desafio enviado para ${targetUser.displayName}!`);
      setShowChallengeSearch(false);
      setSearchTarget('');
      setSearchResults([]);
    } catch (e) {
      console.error("Error sending challenge:", e);
      alert("Erro ao enviar desafio.");
    }
  };

  const handleAcceptChallenge = async (challenge: Challenge) => {
    const updated: Challenge = { ...challenge, status: 'accepted', acceptedAt: Date.now() };
    try {
      await setDoc(doc(db, 'challenges', challenge.id), updated, { merge: true });
      setActiveChallenge(updated);
      setIncomingChallenge(null);
      
      const preset = PRESETS.find(p => 
        p.mode === updated.result.config.mode && 
        p.target === updated.result.config.target
      ) || PRESETS[0];

      setActiveConfig(preset as RunPreset);
      setScreen('timer');
      
      const config: RunConfig = {
        mode: updated.result.config.mode,
        target: updated.result.config.target,
        startSpeed: updated.result.config.startSpeed
      };
      startRun(config);
    } catch (e) {
      console.error("Error accepting challenge:", e);
    }
  };

  const handleDeclineChallenge = async (challenge: Challenge) => {
    try {
      await setDoc(doc(db, 'challenges', challenge.id), { status: 'expired' }, { merge: true });
      setIncomingChallenge(null);
    } catch (e) {
      console.error("Error declining challenge:", e);
    }
  };

  const isStopped = currentSpeed < 3;

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans select-none overflow-hidden">
        {isRunning && (
          <>
            <div className="fire-border-left" />
            <div className="fire-border-right" />
          </>
        )}
        <AnimatePresence mode="wait">
          {!isAuthReady ? (
            <motion.div 
              key="loading"
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : screen === 'login' ? (
            <div 
              key="login"
              className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#050505] relative overflow-hidden"
            >
              {/* Dynamic Background Image */}
              <div className="absolute inset-0 z-0">
                <img 
                  src="assets/banner_horizon.png" 
                  className="w-full h-full object-cover opacity-20 blur-[2px]"
                  alt="" 
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505]" />
              </div>

              {/* Animated Mesh Glows */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[-20%] left-[-10%] w-[80%] aspect-square bg-brand-primary/20 blur-[120px] rounded-full pointer-events-none z-0" 
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-[-10%] right-[-5%] w-[60%] aspect-square bg-red-900/20 blur-[100px] rounded-full pointer-events-none z-0" 
              />
              
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="mb-12 relative z-10 flex flex-col items-center"
              >
                <div className="space-y-2">
                  <h1 className="text-4xl font-display font-black italic text-white uppercase tracking-tighter leading-none">
                    DRAG<span className="text-brand-primary">FIRE</span>
                  </h1>
                  <h1 className="text-3xl font-display font-black italic text-white/90 uppercase tracking-[0.2em] leading-none">
                    PERFORMANCE
                  </h1>
                  <div className="flex items-center gap-3 justify-center pt-2">
                    <div className="h-px w-8 bg-gradient-to-r from-transparent to-zinc-800" />
                    <h2 className="text-zinc-500 font-bold uppercase tracking-[0.4em] text-[8px] whitespace-nowrap">
                      Aferição de Performance
                    </h2>
                    <div className="h-px w-8 bg-gradient-to-l from-transparent to-zinc-800" />
                  </div>
                </div>
              </motion.div>

              <div className="w-full max-w-xs space-y-4 relative z-10">
                <button 
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="group w-full py-4 bg-white text-black rounded-2xl font-black italic text-lg transition-all active:scale-95 flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:bg-zinc-100 disabled:opacity-50 overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                  {isLoggingIn ? (
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                      ENTRAR COM GOOGLE
                    </>
                  )}
                </button>
                
                <button 
                  onClick={handleGuestLogin}
                  className="w-full py-4 bg-white/5 backdrop-blur-md text-white/60 hover:text-white hover:bg-white/10 rounded-2xl font-black italic text-[11px] tracking-widest border border-white/10 transition-all active:scale-95 uppercase"
                >
                  Entrar como Visitante
                </button>

                <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest pt-2">
                  Junte-se a +10.000 pilotos entusiastas
                </p>
              </div>

              <div className="absolute bottom-10 left-0 right-0 px-8 opacity-40 z-10 flex flex-col items-center gap-1">
                <p className="text-[7px] font-black tracking-[0.8em] text-white/40 uppercase">Elite Racing Tech</p>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
                  <p className="text-[9px] font-mono text-zinc-500">v{APP_VERSION}-ELITE</p>
                </div>
              </div>
            </div>
        ) : screen === 'terms' ? (
          <motion.div
            key="terms"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TermsOfUse onAccept={handleAcceptTerms} onDecline={handleLogout} />
          </motion.div>
        ) : screen === 'settings' ? (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <SettingsMenu 
              user={user} 
              isGuest={isGuest} 
              vehicles={vehicles}
              activeVehicle={vehicle}
              onSelectVehicle={selectVehicle}
              onNavigate={setScreen} 
              onBack={() => setScreen('home')}
              gpsSource={gpsSource}
              onToggleGpsSource={() => setGpsSource(prev => prev === 'internal' ? 'external' : 'internal')}
              onRefreshGps={refreshGPS}
              isAdmin={user?.email ? ADMIN_EMAILS.includes(user.email) : false}
              uiPreference={userProfile?.uiPreference || 'elite'}
              onToggleUiPreference={() => {
                const newPref = (userProfile?.uiPreference || 'elite') === 'elite' ? 'classic' : 'elite';
                handleUpdateProfile({ uiPreference: newPref });
              }}
            />
          </motion.div>
        ) : screen === 'vehicle-settings' ? (
          <motion.div
            key="vehicle-settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <VehicleSettings 
              vehicles={vehicles} 
              userProfile={userProfile}
              isPremium={isUserPremium || false}
              userId={user?.uid || ''}
              editingVehicle={editingVehicle}
              setEditingVehicle={setEditingVehicle}
              onSave={saveVehicle} 
              onDelete={deleteVehicle}
              onBack={() => setScreen('settings')} 
              setScreen={(v: string) => setScreen(v as Screen)}
              setCatalogVehicle={setCatalogVehicle}
            />
          </motion.div>
        ) : screen === 'profile-settings' ? (
          <motion.div
            key="profile-settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <ProfileSettings 
              user={user} 
              userProfile={userProfile}
              onUpdate={handleUpdateProfile} 
              onBack={() => setScreen('settings')} 
            />
          </motion.div>
        ) : screen === 'regional-ranking' ? (
          <motion.div
            key="regional-ranking"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {(userProfile?.uiPreference === 'elite' || !userProfile?.uiPreference) ? (
              <RegionalRankingElite 
                userLocation={lastPosition}
                onBack={() => setScreen('home')} 
                onViewProfile={(uid) => {
                  setSelectedProfileUid(uid);
                  setScreen('public-profile');
                }}
              />
            ) : (
              <RegionalRanking 
                userLocation={lastPosition}
                onBack={() => setScreen('home')} 
                onViewProfile={(uid) => {
                  setSelectedProfileUid(uid);
                  setScreen('public-profile');
                }}
              />
            )}
          </motion.div>
        ) : screen === 'vehicle-catalog' && catalogVehicle ? (
          <motion.div
            key="vehicle-catalog"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <VehicleCatalog 
              vehicle={catalogVehicle} 
              onBack={() => setScreen(selectedProfileUid ? 'public-profile' : 'settings')}
              isOwnCar={user?.uid === catalogVehicle.uid}
              onEditVehicle={(v) => {
                handleEdit(v);
                setScreen('vehicle-settings');
              }}
            />
          </motion.div>
        ) : screen === 'theme-store' && userProfile ? (
          <ThemeStoreModal 
            profile={userProfile}
            onClose={() => setScreen('settings')}
            onUpdate={(data) => {
              if (userProfile) setUserProfile({ ...userProfile, ...data });
            }}
          />
        ) : screen === 'trip-explorer' && userProfile ? (
            <TripExplorer 
              onBack={() => setScreen('home')}
              userLocation={lastPosition ? { lat: lastPosition.latitude, lng: lastPosition.longitude } : null}
              userId={user?.uid}
              isGuest={isGuest}
            />
          ) : screen === 'curve-radar' && userProfile ? (
            <CurveRadar 
              onBack={() => setScreen('home')}
              userLocation={lastPosition ? { lat: lastPosition.latitude, lng: lastPosition.longitude } : null}
              userId={user?.uid}
              isGuest={isGuest}
            />
          ) : screen === 'banned' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950 text-white h-screen">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <ShieldAlert className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-display font-black italic mb-2 uppercase tracking-tighter">Conta Suspensa</h2>
              <p className="text-zinc-400 text-sm mb-8 max-w-xs">
                Sua conta foi suspensa por violar nossos termos de uso ou diretrizes da comunidade.
              </p>
              {userProfile?.banReason && (
                <div className="bg-zinc-900 p-4 rounded-xl border border-white/5 text-left w-full max-w-sm mb-8">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Motivo da Suspensão</p>
                  <p className="text-xs font-mono text-red-400">{userProfile.banReason}</p>
                </div>
              )}
              <button 
                onClick={handleLogout}
                className="w-full max-w-xs py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-display font-black italic text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                SAIR DO APP
              </button>
            </div>
          ) : screen === 'missions' && userProfile ? (
            <MissionsView 
              profile={userProfile}
              onUpdate={(data) => setUserProfile({ ...userProfile, ...data })}
            />
          ) : screen === 'history' ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <HistoryView 
              user={user} 
              isGuest={isGuest}
              isPremium={isUserPremium}
              isAdmin={isAdmin}
              onBack={() => setScreen('home')} 
            />
          </motion.div>
        ) : screen === 'gps-guide' ? (
          <motion.div
            key="gps-guide"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <GPSGuide onBack={() => setScreen('home')} />
          </motion.div>
        ) : screen === 'custom-setup' ? (
          <motion.div
            key="custom-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <CustomSetup 
              onBack={() => setScreen('home')} 
              onStart={handleStart}
              config={customConfig}
              setConfig={setCustomConfig}
            />
          </motion.div>
        ) : screen === 'home' ? (
          <motion.div 
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Home Header */}
            <header className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-brand-primary/30 shadow-lg shadow-brand-primary/10 shrink-0">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-brand-primary flex items-center justify-center neon-glow">
                        <Gauge className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  {isUserPremium && (
                    <span className="bg-yellow-500 text-zinc-950 text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-lg shadow-yellow-500/20 leading-none">Premium</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                  <h1 className="font-display font-extrabold text-2xl tracking-tighter italic leading-none whitespace-nowrap">
                    DRAG<span className="text-brand-primary">FIRE</span>
                  </h1>
                </div>
                <div className="flex flex-col">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 whitespace-nowrap overflow-visible flex items-center gap-1.5 leading-none">
                    {isGuest ? 'Modo Visitante' : (vehicle ? `${vehicle.nickname} â€¢ ${vehicle.model}` : user?.displayName || 'Piloto')}
                  </p>
                  {!isGuest && userProfile?.handle && (
                    <span className="text-brand-primary italic font-black text-[10px] mt-0.5 uppercase">#{userProfile.handle}</span>
                  )}
                </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <GPSIndicator accuracy={accuracy} onRequest={requestPermission} />
                <button 
                  onClick={handleLogout}
                  className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-red-500 transition-colors"
                  title={isGuest ? "Sair do Modo Visitante" : "Sair"}
                >
                  {isGuest ? <LogOut className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => setScreen('settings')}
                  className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Home Content */}
            <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
              {/* 1. Main Features Grid (2x2) */}
              <section className="grid grid-cols-2 gap-3">
                {/* 1.1 Editor IA (Purple Neon) */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('ai-editor')}
                  className="relative group h-32 bg-zinc-900 rounded-[24px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-purple-500/40 shadow-xl"
                >
                  <img src="/assets/ai_editor_banner.png" alt="IA" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Sparkles className="w-7 h-7 text-purple-500 animate-pulse" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-purple-500/20 backdrop-blur-md rounded border border-purple-500/30 text-[7px] font-black text-purple-500 uppercase tracking-widest mb-1.5 inline-block">Mágica</span>
                    <h4 className="text-sm font-display font-black italic text-white leading-tight uppercase tracking-tighter">Editor <span className="text-purple-500 font-bold">IA</span></h4>
                  </div>
                </motion.div>

                {/* 1.2 Assistente de Curvas (Yellow Elite) */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('cornering-assistant')}
                  className="relative group h-32 bg-zinc-900 rounded-[24px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-yellow-500/40 shadow-xl"
                >
                  <img src="/assets/cornering_banner.png" alt="Curves" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Navigation className="w-7 h-7 text-yellow-500 animate-pulse -rotate-90" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-yellow-500/20 backdrop-blur-md rounded border border-yellow-500/30 text-[7px] font-black text-yellow-500 uppercase tracking-widest mb-1.5 inline-block">Pro HUD</span>
                    <h4 className="text-sm font-display font-black italic text-white leading-tight uppercase tracking-tighter">Assistente <span className="text-yellow-500 font-bold">Curvas</span></h4>
                  </div>
                </motion.div>

                {/* 1.3 Teste Performance */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPerformanceMenu(true)}
                  className="relative group h-32 bg-zinc-900 rounded-[24px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-brand-primary/40 shadow-xl"
                >
                  <img src="/assets/performance_banner.png" alt="Performance" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Timer className="w-7 h-7 text-brand-primary animate-pulse" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-brand-primary/20 backdrop-blur-md rounded border border-brand-primary/30 text-[7px] font-black text-brand-primary uppercase tracking-widest mb-1.5 inline-block">Telemetria</span>
                    <h4 className="text-sm font-display font-black italic text-white leading-tight uppercase tracking-tighter">Teste <span className="text-brand-primary font-bold">Performance</span></h4>
                  </div>
                </motion.div>

                {/* 1.4 Postos e Preà§os (Emerald Green) */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('fuel-stations')}
                  className="relative group h-32 bg-zinc-900 rounded-[24px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-emerald-500/40 shadow-xl"
                >
                  <img src="/assets/posto_banner.png" alt="Postos" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Fuel className="w-7 h-7 text-emerald-500 animate-pulse" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 backdrop-blur-md rounded border border-emerald-500/30 text-[7px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 inline-block">Economia</span>
                    <h4 className="text-sm font-display font-black italic text-white leading-tight uppercase tracking-tighter">Postos <span className="text-emerald-500 font-bold">Elite</span></h4>
                  </div>
                </motion.div>
              </section>




              {/* Performance Selection Drawer (Modal Bottom Sheet) */}
              <AnimatePresence>
                {showPerformanceMenu && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowPerformanceMenu(false)}
                      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110]"
                    />
                    <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-zinc-950 rounded-t-[40px] border-t border-white/10 p-6 z-[120] pb-10 overflow-y-auto shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
                    >
                      <div className="w-12 h-1.5 bg-zinc-900 rounded-full mx-auto mb-6" />
                      
                      <div className="flex items-center justify-between mb-6 px-2">
                        <div>
                          <h4 className="text-2xl font-display font-black italic text-white uppercase tracking-tighter leading-tight">Escolha o <span className="text-brand-primary">Teste</span></h4>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Alta performance e telemetria precisa</p>
                        </div>
                        <button onClick={() => setShowPerformanceMenu(false)} className="p-3 bg-zinc-900 rounded-2xl text-zinc-500 active:scale-90 transition-transform">
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      {/* Featured (Top 2) */}
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {PRESETS.slice(0, 2).map((preset) => (
                          <motion.button
                            key={preset.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              handleSelectPreset(preset as any);
                              setShowPerformanceMenu(false);
                            }}
                            className={`relative h-32 rounded-3xl overflow-hidden border border-white/5 bg-gradient-to-br ${preset.color} p-4 text-left shadow-lg group`}
                          >
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                            <preset.icon className="w-8 h-8 text-white/90 mb-2 relative z-10" />
                            <div className="relative z-10">
                              <h5 className="text-sm font-display font-black italic text-white uppercase leading-none">{preset.label}</h5>
                              <p className="text-[7px] text-white/70 font-bold uppercase tracking-widest mt-1.5 leading-tight">{preset.description}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <h6 className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] px-2 mb-3">Outras Modalidades</h6>
                        <div className="grid grid-cols-1 gap-2">
                          {PRESETS.slice(2).map((preset) => (
                            <motion.button
                              key={preset.id}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                handleSelectPreset(preset as any);
                                setShowPerformanceMenu(false);
                              }}
                              className="group flex items-center gap-4 p-4 bg-zinc-900/50 rounded-[24px] border border-white/5 hover:border-brand-primary/30 transition-all text-left"
                            >
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${preset.color} flex items-center justify-center shrink-0`}>
                                <preset.icon className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <h5 className="text-xs font-display font-black italic text-white uppercase leading-none">{preset.label}</h5>
                                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{preset.description}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-800" />
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowPerformanceMenu(false)}
                        className="w-full mt-8 py-5 bg-zinc-900 border border-white/5 text-zinc-500 rounded-2xl font-black uppercase tracking-widest text-[9px] active:scale-95 transition-all"
                      >
                        Cancelar
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* 4. Utilities (Fuel & History) */}
              <div className="grid grid-cols-2 gap-3">
                <section 
                  onClick={() => setScreen('fuel-calculator')}
                  className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 cursor-pointer hover:bg-zinc-900 transition-all active:scale-[0.98]"
                >
                  <div className="flex flex-col gap-3">
                    <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                      <Fuel className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Consumo</h4>
                      <p className="text-[9px] text-zinc-500 uppercase font-bold">Calculadora km/L</p>
                    </div>
                  </div>
                </section>

                <section 
                  onClick={() => setScreen('history')}
                  className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 cursor-pointer hover:bg-zinc-900 transition-all active:scale-[0.98]"
                >
                  <div className="flex flex-col gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                      <History className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Histórico</h4>
                      <p className="text-[9px] text-zinc-500 uppercase font-bold">Suas puxadas</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* 5. Active Duel (Conditional) */}
              {activeChallenge && (
                <section className={`rounded-2xl p-4 border ${isGuest ? 'bg-zinc-900/50 border-white/5 opacity-50' : 'bg-brand-accent/5 border-brand-accent/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isGuest ? 'bg-zinc-800' : 'bg-brand-accent/20'}`}>
                      {isGuest ? <Lock className="w-5 h-5 text-zinc-600" /> : <Swords className="w-5 h-5 text-brand-accent" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white">Duelo Ativo</h4>
                      <p className={`text-[10px] uppercase font-bold ${isGuest ? 'text-zinc-600' : 'text-brand-accent'}`}>
                        {isGuest ? 'Disponível apenas para usuários logados' : `Desafio de ${activeChallenge.creatorName}`}
                      </p>
                    </div>
                    {!isGuest && (
                      <button 
                        onClick={() => setScreen('challenge')}
                        className="px-4 py-2 bg-brand-accent text-zinc-950 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-accent/20"
                      >
                        Ver Desafio
                      </button>
                    )}
                  </div>
                </section>
              )}

                            {/* 6. Guia de Precisà£o (Full Width) */}
              <section 
                onClick={() => setScreen('gps-guide')}
                className="bg-brand-primary/5 rounded-[28px] p-5 border border-brand-primary/10 cursor-pointer hover:bg-brand-primary/10 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white italic uppercase">Guia de Precisà£o</h4>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Dicas para 100% de confiabilidade</p>
                  </div>
                </div>
              </section>

              {/* 7. Viagem & Radar Curvas (Side by Side Grid) */}
              <div className="grid grid-cols-2 gap-3 pb-4">
                {/* 7.1 Sugestà£o de Viagem */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('trip-explorer')}
                  className="relative group h-32 bg-zinc-900 rounded-[28px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-cyan-500/40 shadow-xl"
                >
                  <img src="/assets/viagem_banner.png" alt="Viagem" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Palmtree className="w-6 h-6 text-cyan-400 animate-pulse" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-cyan-500/20 backdrop-blur-md rounded border border-cyan-500/30 text-[7px] font-black text-cyan-400 uppercase tracking-widest mb-1 inline-block">Role</span>
                    <h4 className="text-xs font-display font-black italic text-white leading-tight uppercase tracking-tighter">Explorador <span className="text-cyan-400 font-bold">Viagem</span></h4>
                  </div>
                </motion.div>

                {/* 7.2 Radar de Curvas */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('curve-radar')}
                  className="relative group h-32 bg-zinc-900 rounded-[28px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-yellow-500/40 shadow-xl"
                >
                  <img src="/assets/radar_curvas_banner.png" alt="Radar" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><ActivityIcon className="w-6 h-6 text-yellow-400 animate-pulse" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-yellow-500/20 backdrop-blur-md rounded border border-yellow-500/30 text-[7px] font-black text-yellow-400 uppercase tracking-widest mb-1 inline-block">Adrenalina</span>
                    <h4 className="text-xs font-display font-black italic text-white leading-tight uppercase tracking-tighter">Radar de <span className="text-yellow-400 font-bold">Curvas</span></h4>
                  </div>
                </motion.div>
              </div>
            </main>
          </motion.div>
        ) : screen === 'challenge' && activeChallenge ? (
          <motion.div
            key="challenge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <header className="p-3 flex items-center justify-between border-b border-white/5 bg-zinc-900/50 backdrop-blur-md z-10">
              <button 
                onClick={() => setScreen('home')}
                className="p-1.5 hover:bg-white/5 rounded-full transition-colors flex items-center gap-1.5 text-zinc-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Início</span>
              </button>
              <h1 className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Duelo Ativo</h1>
              <div className="w-8" />
            </header>
            <ChallengeView 
              challenge={activeChallenge} 
              onAccept={() => handleAcceptChallenge(activeChallenge)}
              onDecline={() => setScreen('home')}
              currentLocation={lastPosition}
            />
          </motion.div>
        ) : screen === 'cornering-assistant' ? (
          <motion.div
            key="cornering-assistant"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            <CorneringAssistantHUD 
              nextCurve={nextCurve}
              posteriorCurve={posteriorCurve}
              upcomingNodes={upcomingNodes}
              currentLat={currentLat}
              currentLng={currentLng}
              currentHeading={currentHeading}
              speedKmh={currentSpeed}
              lookAheadDistance={lookAheadDistance}
              destination={destination}
              setDestination={setDestination}
              isRouteMode={isRouteMode}
              onBack={() => setScreen('home')}
              currentRoadName={currentRoadName}
              snappedLocation={snappedLocation}
              smoothLocation={smoothLocation}
              trailNodes={trailNodes}
              telemetryConfig={telemetryConfig}
              isLoading={isLoading}
              allRegionalWays={allRegionalWays}
              imu={imu}
              minimapZoomMultiplier={telemetryConfig.minimapZoomMultiplier}
            />
          </motion.div>
        ) : screen === 'duel-result' && activeChallenge ? (
          <motion.div
            key="duel-result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <header className="p-3 flex items-center justify-between border-b border-white/5 bg-zinc-900/50 backdrop-blur-md z-10">
              <button 
                onClick={() => {
                  setActiveChallenge(null);
                  setScreen('home');
                }}
                className="p-1.5 hover:bg-white/5 rounded-full transition-colors flex items-center gap-1.5 text-zinc-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Início</span>
              </button>
              <h1 className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Resultado do Duelo</h1>
              <button 
                className="p-1.5 hover:bg-white/5 rounded-full transition-colors"
                onClick={() => {
                  // Share duel result
                  alert('Resultado do duelo copiado!');
                }}
              >
                <Share2Icon className="w-4 h-4 text-zinc-400" />
              </button>
            </header>
            <DuelComparison challenge={activeChallenge} />
          </motion.div>
        ) : screen === 'trip-view' && lastResult ? (
          <motion.div
            key="trip-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <header className="p-3 flex items-center justify-between border-b border-white/5 bg-zinc-900/50 backdrop-blur-md z-10">
              <button 
                onClick={() => {
                  reset();
                  setScreen('home');
                }}
                className="p-1.5 hover:bg-white/5 rounded-full transition-colors flex items-center gap-1.5 text-zinc-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Início</span>
              </button>
              <h1 className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Análise de Viagem</h1>
              <button 
                className="p-1.5 hover:bg-white/5 rounded-full transition-colors"
                onClick={() => {
                  alert('Relatório de viagem copiado!');
                }}
              >
                <Share2Icon className="w-4 h-4 text-zinc-400" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
              <TripAnalysis result={lastResult} />
              
              <div className="h-64 rounded-2xl overflow-hidden border border-white/5 mt-6 mb-20">
                <MapContainer 
                  center={[lastResult.path[0]?.latitude || 0, lastResult.path[0]?.longitude || 0]} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  <Polyline 
                    positions={lastResult.path.map(p => [p.latitude, p.longitude])} 
                    color="#ef4444" 
                    weight={4}
                    opacity={0.8}
                  />
                </MapContainer>
              </div>
            </div>
          </motion.div>
        ) : screen === 'fuel-calculator' ? (
          <motion.div
            key="fuel-calculator"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <FuelCalculator onBack={() => setScreen('home')} />
          </motion.div>
        ) : screen === 'ai-editor' ? (
          <motion.div
            key="ai-editor"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <AIPhotoEditor 
              onBack={() => setScreen('home')} 
              onCompleteMission={handleCompleteMission}
            />
          </motion.div>
        ) : screen === 'fuel-stations' ? (
          <motion.div
            key="fuel-stations"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <GasStations 
              onBack={() => setScreen('home')} 
              onCompleteMission={handleCompleteMission}
            />
          </motion.div>
        ) : screen === 'anp-import' ? (
          <motion.div
            key="anp-import"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <AntigravityImporter onBack={() => setScreen('settings')} />
          </motion.div>
        ) : screen === 'admin-dashboard' ? (
          <motion.div
            key="admin-dashboard"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <AdminDashboard 
              onBack={() => setScreen('settings')} 
              onStartLiveCalibration={(data) => {
                setCalibrationMode(data);
                setScreen('timer');
              }}
            />
          </motion.div>
         ) : screen === 'search' ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <UserSearch 
              onBack={() => setScreen('home')} 
              onViewProfile={(uid) => {
                setSelectedProfileUid(uid);
                setScreen('public-profile');
              }} 
            />
          </motion.div>
        ) : screen === 'public-profile' ? (
          <motion.div
            key="public-profile"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <PublicProfileDetail 
              uid={selectedProfileUid || user?.uid || ''} 
              currentUserId={user?.uid}
              onBack={() => setScreen('home')} 
              onUpdateProfile={handleUpdateProfile}
              onEditVehicle={(v) => {
                setCatalogVehicle(v);
                setScreen('vehicle-catalog');
              }}
              isAdmin={isAdmin}
            />
          </motion.div>
        ) : screen === 'feed' ? (
          <motion.div
            key="feed"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 flex items-center justify-center text-zinc-600 uppercase font-black text-[10px] tracking-widest bg-zinc-950">
               Em breve: Feed Global
            </div>
          </motion.div>
        ) : screen === 'offline-maps' ? (
          <motion.div
            key="offline-maps"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <OfflineMapManager onBack={() => setScreen('settings')} />
          </motion.div>
        ) : screen === 'timer' ? (

           <>
            {(userProfile?.uiPreference === 'elite' || !userProfile?.uiPreference) ? (
              <TimerElite 
                user={user}
                isGuest={isGuest}
                userProfile={userProfile}
                activeConfig={activeConfig}
                isRunning={isRunning}
                isWaiting={isWaiting}
                isReady={isReady}
                lastResult={lastResult}
                activeChallenge={activeChallenge}
                currentSpeed={currentSpeed}
                elapsedTime={elapsedTime}
                distance={distance}
                progress={progress}
                gForce={gForce}
                gpsStatus={gpsStatus}
                accuracy={accuracy}
                vehicles={vehicles}
                runVehicleId={runVehicleId || ''}
                isQuickSwitchOpen={isQuickSwitchOpen}
                useRollout={useRollout}
                error={error}
                setIsQuickSwitchOpen={setIsQuickSwitchOpen}
                setRunVehicleId={setRunVehicleId}
                setUseRollout={setUseRollout}
                reset={reset}
                handleBack={handleBack}
                handleStart={handleStart}
                manualStart={manualStart}
                manualStop={manualStop}
                handleDuel={handleDuel}
                requestPermission={requestPermission}
                setScreen={setScreen}
                handleAcceptChallenge={handleAcceptChallenge}
                isSettling={isSettling}
                settlingCountdown={settlingCountdown}
                telemetryConfig={telemetryConfig}
                setTelemetryConfig={setTelemetryConfig}
              />
            ) : (
              <TimerClassic 
                user={user}
                isGuest={isGuest}
                userProfile={userProfile}
                activeConfig={activeConfig}
                isRunning={isRunning}
                isWaiting={isWaiting}
                isReady={isReady}
                lastResult={lastResult}
                activeChallenge={activeChallenge}
                currentSpeed={currentSpeed}
                elapsedTime={elapsedTime}
                distance={distance}
                progress={progress}
                gForce={gForce}
                gpsStatus={gpsStatus}
                accuracy={accuracy}
                vehicles={vehicles}
                runVehicleId={runVehicleId || ''}
                isQuickSwitchOpen={isQuickSwitchOpen}
                useRollout={useRollout}
                error={error}
                setIsQuickSwitchOpen={setIsQuickSwitchOpen}
                setRunVehicleId={setRunVehicleId}
                setUseRollout={setUseRollout}
                reset={reset}
                handleBack={handleBack}
                handleStart={handleStart}
                manualStart={manualStart}
                manualStop={manualStop}
                handleDuel={handleDuel}
                requestPermission={requestPermission}
                setScreen={setScreen}
                handleAcceptChallenge={handleAcceptChallenge}
                isSettling={isSettling}
                settlingCountdown={settlingCountdown}
                telemetryConfig={telemetryConfig}
                setTelemetryConfig={setTelemetryConfig}
              />
            )}
           </>
        ) : null}
      </AnimatePresence>

    {(user || isGuest) && screen !== 'login' && screen !== 'terms' && screen !== 'timer' && screen !== 'custom-setup' && screen !== 'vehicle-catalog' && !isRunning && (
        <BottomNav 
          activeScreen={screen} 
          isGuest={isGuest}
          isAdmin={isAdmin}
          onNavigate={(s) => {
            if (s === 'public-profile' && user) {
              setSelectedProfileUid(user.uid);
            }
            setScreen(s);
          }} 
          userPhoto={user?.photoURL || undefined}
        />
      )}

      {/* Search/Challenge Modal */}
      <AnimatePresence>
        {showChallengeSearch && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col p-6"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-display font-black italic text-white uppercase tracking-tight">Desafiar Amigo</h2>
              <button 
                onClick={() => setShowChallengeSearch(false)}
                className="p-2 bg-zinc-900 rounded-full text-zinc-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Nome do piloto..."
                value={searchTarget}
                onChange={(e) => setSearchTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUsersForChallenge()}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:border-brand-primary transition-colors outline-none"
              />
              <button 
                onClick={handleSearchUsersForChallenge}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-brand-primary text-white text-[10px] font-black uppercase rounded-lg active:scale-95 transition-all"
              >
                Buscar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {isSearching ? (
                <div className="flex justify-center p-12">
                  <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map(u => (
                  <div key={u.uid} className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center font-black">
                        {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover rounded-xl" /> : u.displayName?.[0]}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{u.displayName}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Disponível</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => sendChallenge(u)}
                      className="px-4 py-2 bg-brand-primary text-white text-xs font-black uppercase rounded-xl active:scale-95 transition-all"
                    >
                      Desafiar
                    </button>
                  </div>
                ))
              ) : searchTarget && !isSearching && (
                <p className="text-center text-zinc-600 text-sm py-12">Nenhum piloto encontrado.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Challenge Alert */}
      <AnimatePresence>
        {incomingChallenge && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-24 left-4 right-4 z-[110] bg-brand-primary p-5 rounded-[28px] shadow-2xl shadow-red-600/30 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Swords className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div>
                <h4 className="text-white font-display font-black italic tracking-tighter uppercase text-lg leading-none">NOVO DUELO!</h4>
                <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-1">
                  {incomingChallenge.creatorName} te desafiou
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleDeclineChallenge(incomingChallenge)}
                className="w-10 h-10 bg-black/10 rounded-full flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleAcceptChallenge(incomingChallenge)}
                className="px-4 py-2 bg-white text-brand-primary rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
              >
                ACEITAR
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Precision Hint Overlay */}
      <AnimatePresence>
        {showPrecisionHint && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] w-[80%] max-w-sm"
          >
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-brand-primary/30 p-6 rounded-3xl shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 bg-brand-primary/20 rounded-2xl flex items-center justify-center mx-auto">
                <Info className="w-6 h-6 text-brand-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="text-white font-black italic uppercase tracking-widest text-sm">Dica de Precisà£o</h4>
                <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                  Para melhores resultados, <span className="text-white font-bold">fixe o celular no suporte do veículo</span>. Evite segurar o aparelho na mà£o.
                </p>
              </div>
              <button 
                onClick={() => setShowPrecisionHint(false)}
                className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] pt-2 active:scale-95 transition-all"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        {pendingReward && (
          <PodiumRewardModal
            isOpen={!!pendingReward}
            onClose={() => setPendingReward(null)}
            onClaim={handleClaimMonthlyReward}
            position={pendingReward.position || '3'}
            rewardAmount={pendingReward.rewardAmount}
            type={pendingReward.type || 'global'}
            month={pendingReward.month}
          />
        )}
      </div>
      
      {/* Global SVG Filters for UI Processing */}
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <filter id="remove-black-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="1 0 0 0 0
                                                 0 1 0 0 0
                                                 0 0 1 0 0
                                                 1 1 1 0 -1" />
          </filter>
        </defs>
      </svg>
    </ErrorBoundary>
  );
}

function UserSearch({ onBack, onViewProfile }: { onBack: () => void, onViewProfile: (uid: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      setUsersList(snapshot.docs.map(doc => doc.data() as UserProfile));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-zinc-900/50">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-xs font-black uppercase tracking-widest text-brand-primary">Buscar Pilotos</h1>
        <div className="w-9" />
      </header>

      <div className="p-4 overflow-y-auto">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Nome do piloto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-brand-primary outline-none transition-all"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {usersList.map(u => (
              <button 
                key={u.uid}
                onClick={() => onViewProfile(u.uid)}
                className="w-full bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-zinc-800 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                    {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xl">{u.displayName?.[0]}</div>}
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold text-white">{u.displayName}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{u.isPremium ? 'Piloto Elite' : 'Piloto'}</p>
                  </div>
                </div>
                <div className="p-2 bg-white/5 rounded-xl group-hover:bg-brand-primary transition-colors">
                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white" />
                </div>
              </button>
            ))}
            {searchTerm && usersList.length === 0 && !loading && (
              <p className="text-center py-12 text-zinc-600 text-sm">Nenhum piloto encontrado.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PublicProfileDetail({ uid, currentUserId, onBack, onUpdateProfile, onEditVehicle, isAdmin }: { uid: string, currentUserId: string | undefined, onBack: () => void, onUpdateProfile: (data: any) => void, onEditVehicle: (v: Vehicle) => void, isAdmin: boolean }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showThemeStore, setShowThemeStore] = useState(false);
  const [activeTab, setActiveTab] = useState<'garage' | 'times' | 'albums'>('garage');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
        
        // Fetch vehicles
        const vQuery = query(collection(db, 'vehicles'), where('uid', '==', uid));
        const vSnap = await getDocs(vQuery);
        setVehicles(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));

        // Fetch follow status
        if (currentUserId) {
          const followDoc = await getDoc(doc(db, 'follows', `${currentUserId}_${uid}`));
          setIsFollowing(followDoc.exists());

          const requestDoc = await getDoc(doc(db, 'follow_requests', `${currentUserId}_${uid}`));
          setIsRequested(requestDoc.exists());
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [uid, currentUserId]);

  const handleFollow = async () => {
    if (!currentUserId || !profile) return;
    const followId = `${currentUserId}_${uid}`;
    try {
      if (isFollowing) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'follows', followId));
        batch.update(doc(db, 'users', uid), { followersCount: increment(-1) });
        batch.update(doc(db, 'users', currentUserId), { followingCount: increment(-1) });
        await batch.commit();
        setIsFollowing(false);
        setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) - 1 } : null);
      } else if (isRequested) {
        await deleteDoc(doc(db, 'follow_requests', followId));
        setIsRequested(false);
      } else {
        if (profile.isPrivate) {
          await setDoc(doc(db, 'follow_requests', followId), {
            followerId: currentUserId,
            followingId: uid,
            timestamp: Date.now()
          });
          setIsRequested(true);
        } else {
          const batch = writeBatch(db);
          batch.set(doc(db, 'follows', followId), {
            followerId: currentUserId,
            followingId: uid,
            timestamp: Date.now()
          });
          batch.update(doc(db, 'users', uid), { followersCount: increment(1) });
          batch.update(doc(db, 'users', currentUserId), { followingCount: increment(1) });
          await batch.commit();
          setIsFollowing(true);
          setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : null);
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-zinc-950"><div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!profile) return <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 p-8 text-center"><p>Ops! Perfil nà£o encontrado.</p><button onClick={onBack} className="mt-4 text-brand-primary font-bold uppercase tracking-widest text-[10px]">Voltar</button></div>;

  const theme = getThemeById(profile.activeThemeId || 'default');
  const handleToggleBan = async () => {
    if (!profile || !isAdmin) return;
    
    const newStatus = !profile.isBanned;
    let reason = '';
    
    if (newStatus) {
      reason = prompt('Motivo do banimento:') || 'Violação dos termos de uso';
    }
    
    try {
      await setDoc(doc(db, 'users', uid), { 
        isBanned: newStatus,
        banReason: newStatus ? reason : null
      }, { merge: true });
      
      setProfile(prev => prev ? { ...prev, isBanned: newStatus, banReason: reason } : null);
      alert(newStatus ? 'Usuário banido com sucesso.' : 'Banimento removido.');
    } catch (e) {
      console.error(e);
      alert('Erro ao processar banimento.');
    }
  };

  const isOwner = uid === currentUserId;

  return (
    <div className={`flex-1 flex flex-col overflow-y-auto hide-scrollbar ${theme.backgroundClass} relative`}>
      {/* Neon Borders of the Pilot */}
      {profile.activeNeonColor && (
        <div className="fixed inset-0 pointer-events-none z-[60]">
           <div className="absolute left-0 top-0 bottom-0 w-1" style={{ 
             backgroundColor: profile.activeNeonColor, 
             boxShadow: `0 0 15px ${profile.activeNeonColor}` 
           }} />
           <div className="absolute right-0 top-0 bottom-0 w-1" style={{ 
             backgroundColor: profile.activeNeonColor, 
             boxShadow: `0 0 15px ${profile.activeNeonColor}` 
           }} />
        </div>
      )}

      {/* Dynamic Header (Banner) - Height Increased for larger exposure */}
      <div className={`relative pt-16 pb-40 px-6 ${theme.headerClass} overflow-hidden shadow-2xl transition-all duration-500`}>
         {theme.bannerUrl && (
           <motion.img 
             initial={{ scale: 1.1, opacity: 0 }}
             animate={{ scale: 1, opacity: 0.8 }}
             src={theme.bannerUrl} 
             className="absolute inset-0 w-full h-full object-cover" 
           />
         )}
         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
         
         <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20">
            <button onClick={onBack} className="p-3 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl text-white/50 hover:text-white transition-all active:scale-90">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
               {isOwner && (
                 <button 
                  onClick={() => setShowThemeStore(true)}
                  className="p-3 bg-brand-primary border-2 border-white/20 rounded-2xl text-white shadow-xl active:scale-95"
                 >
                    <Palette className="w-6 h-6" />
                 </button>
               )}
               {!isOwner && isAdmin && (
                 <button 
                   onClick={handleToggleBan}
                   className={`p-3 rounded-2xl text-white shadow-xl active:scale-95 transition-all ${profile?.isBanned ? 'bg-green-600' : 'bg-red-600'}`}
                 >
                   {profile?.isBanned ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                 </button>
               )}
               <button className="p-3 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl text-white/50">
                 <Share2Icon className="w-5 h-5" />
               </button>
            </div>
         </div>

         </div>

      {/* Compact Info Header */}
      <div className="relative px-6 -mt-20 z-10">
         <div className="flex flex-row items-start gap-5">
            {/* Profile Photo & Refined Badge Wrapper */}
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="relative shrink-0"
            >
               <div className="w-24 h-24 rounded-[28px] overflow-hidden bg-zinc-950 border-4 border-zinc-950 shadow-2xl">
                 {profile.photoURL ? (
                   <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-4xl font-black text-white/50">{profile.displayName?.[0]}</div>
                 )}
               </div>
               
               {/* Fixed Badge: Smaller & Clean Recorte (No Background) */}
               <div className="absolute -bottom-2 -right-2 z-30 pointer-events-none">
                  {profile.activeBadgeId ? (
                    <div className="w-12 h-12 flex items-center justify-center bg-transparent overflow-visible">
                       <img 
                         src={BADGES.find(b => b.id === profile.activeBadgeId)?.imageUrl} 
                         className="w-full h-full object-contain filter drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)] contrast-[1.3] brightness-110" 
                         style={{ filter: 'url(#remove-black-filter)' }}
                         alt="Badge" 
                       />
                    </div>
                  ) : (uid === currentUserId && isAdmin) ? (
                    <div className="bg-brand-primary p-1.5 rounded-xl border-2 border-black shadow-xl ring-1 ring-brand-primary/20">
                       <Zap className="w-4 h-4 text-white fill-current" />
                    </div>
                  ) : profile.isPremium ? (
                    <div className="bg-brand-primary p-1.5 rounded-xl border-2 border-black shadow-xl">
                       <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  ) : null}
               </div>
            </motion.div>

            {/* Compact Info Column */}
            <div className="flex-1 min-w-0 flex flex-col pt-2">
               <h2 className="text-xl font-display font-black italic text-white uppercase tracking-tighter leading-none mb-1">
                 {profile.displayName}
               </h2>
               
               {/* Title - Compact */}
               <div className="mb-2">
                  <span className="text-[7px] font-black uppercase tracking-[0.2em] text-brand-primary italic opacity-90">
                    {profile.activeTitleId ? TITLES.find(t => t.id === profile.activeTitleId)?.name : (profile.isPremium ? 'Piloto Elite' : 'Piloto Enthusiasta')}
                  </span>
               </div>

               {/* Instagram - Compact */}
               {profile.instagram && (
                 <div className="flex items-center gap-1.5 opacity-90 mb-3">
                    <Instagram className="w-3 h-3 text-pink-500" />
                    <span className="text-[10px] font-black text-white/70 italic tracking-tighter">@{profile.instagram.replace(/^@+/, '')}</span>
                 </div>
               )}

               {/* Bottom Stats Row & Follow Action */}
               <div className="flex items-center justify-between border-t border-white/5 pt-2 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col leading-none">
                       <span className="text-xs font-display font-black italic text-white">{profile.followersCount || 0}</span>
                       <span className="text-[6px] font-black uppercase text-zinc-600 tracking-widest mt-0.5 whitespace-nowrap">Seguidores</span>
                    </div>
                    {/* Handle directly next to stats */}
                    {profile.handle && (
                      <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest italic pt-1 border-l border-white/5 pl-4">#{profile.handle.toUpperCase()}</span>
                    )}
                  </div>

                  {currentUserId !== uid && (
                     <div className="flex gap-1">
                       <button 
                         onClick={handleFollow}
                         className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[8px] transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                           isFollowing 
                             ? 'bg-zinc-800 text-zinc-400 border border-white/5' 
                             : isRequested 
                               ? 'bg-zinc-900 text-zinc-500 border border-dashed border-white/10'
                               : 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40'
                         }`}
                       >
                         {isFollowing ? 'Seguindo' : isRequested ? 'Solicitado' : 'Seguir'}
                       </button>
                       {isFollowing && (
                          <button className="p-2 bg-zinc-800 border border-white/5 rounded-xl text-zinc-400">
                            <MessageSquare className="w-3 h-3" />
                          </button>
                       )}
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>




      {/* Main Content Area */}
      <div className="px-6 py-6 pb-24 space-y-12">
         {/* Segmented Tab Bar */}
         <div className="flex bg-black/40 backdrop-blur-xl border border-white/5 p-1 rounded-2xl">
            {[
              { id: 'garage', label: 'Garagem', icon: Car },
              { id: 'times', label: 'Tempos', icon: History },
              { id: 'albums', label: 'àlbuns', icon: ImageIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-zinc-600'}`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
         </div>

         <AnimatePresence mode="wait">
            {activeTab === 'garage' && (
              <motion.section 
                key="garage"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3 pb-8">
                   {vehicles.map(v => (
                     <button 
                      key={v.id} 
                      onClick={() => onEditVehicle(v)}
                      className="w-full bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-[28px] flex flex-col group active:scale-[0.98] transition-all overflow-hidden"
                     >
                        {/* Image Top */}
                        <div className="w-full h-28 bg-black/40 border-b border-white/5 flex items-center justify-center overflow-hidden shadow-inner relative">
                           {v.photoURL ? (
                             <img src={v.photoURL} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                           ) : (
                             <Navigation className="w-6 h-6 text-zinc-800 -rotate-90" />
                           )}
                           <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <BrandIcon brand={v.brand} className="w-3.5 h-3.5 grayscale" />
                           </div>
                        </div>

                        {/* Content Bottom */}
                        <div className="p-3 text-left">
                           <h4 className="text-[11px] font-black italic text-white uppercase tracking-tight leading-none mb-1 truncate">{v.nickname || v.model}</h4>
                           <div className="flex items-center gap-1 opacity-40">
                              <span className="text-[8px] text-zinc-400 font-black uppercase tracking-wider truncate">{v.brand} {v.year}</span>
                           </div>
                        </div>
                     </button>
                   ))}
                   
                   {vehicles.length === 0 && (
                     <div className="col-span-2 py-12 flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-[32px]">
                        <Car className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Nenhum veículo cadastrado</p>
                     </div>
                   )}
                </div>
              </motion.section>
            )}

            {activeTab === 'times' && (
              <motion.section 
                key="times"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                 <div className="grid grid-cols-2 gap-4">
                   {[
                     { label: '0-100 km/h', value: '--', unit: 's', color: 'text-brand-primary' },
                     { label: '201 metros', value: '--', unit: 's', color: 'text-blue-500' },
                     { label: 'Top Speed', value: '--', unit: 'km/h', color: 'text-brand-accent' },
                     { label: 'Puxadas', value: '0', unit: '', color: 'text-yellow-500' }
                   ].map((record, i) => (
                     <div key={i} className="bg-zinc-900/40 p-5 rounded-[32px] border border-white/5 flex flex-col gap-1">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{record.label}</span>
                        <div className="flex items-baseline gap-1">
                           <span className="text-2xl font-display font-black italic text-white">{record.value}</span>
                           <span className={`text-[10px] font-bold italic ${record.color} uppercase`}>{record.unit}</span>
                        </div>
                     </div>
                   ))}
                 </div>
                 <div className="py-12 flex flex-col items-center justify-center text-zinc-700">
                    <History className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Nenhum tempo registrado</p>
                 </div>
              </motion.section>
            )}

            {activeTab === 'albums' && (
              <motion.section 
                key="albums"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <ProfileLibrary uid={uid} currentUserId={currentUserId} profile={profile} />
              </motion.section>
            )}
         </AnimatePresence>
      </div>

      <AnimatePresence>
        {showThemeStore && (
          <ThemeStoreModal 
            profile={profile} 
            onClose={() => setShowThemeStore(false)} 
            onUpdate={(data) => {
              setProfile(prev => prev ? ({ ...prev, ...data }) : null);
              onUpdateProfile(data);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function TripExplorer({ onBack, userLocation, userId, isGuest }: { onBack: () => void, userLocation: { lat: number, lng: number } | null, userId?: string, isGuest: boolean }) {
  const [activeTab, setActiveTab] = React.useState('categories');
  const [selectedCategory, setSelectedCategory] = React.useState<any>(null);
  const [places, setPlaces] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedPlace, setSelectedPlace] = React.useState<any>(null);
  const [distance, setDistance] = React.useState(50);

  const categories = [
    { id: 'beach', label: 'Praia', icon: <Palmtree className="w-6 h-6" />, query: 'praia beach', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { id: 'biker_cafe', label: 'Café Biker', icon: <Coffee className="w-6 h-6" />, query: 'café da manhà£ moto', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'waterfall', label: 'Cachoeira', icon: <Waves className="w-6 h-6" />, query: 'cachoeira waterfall', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'camping', label: 'Camping', icon: <Tent className="w-6 h-6" />, query: 'camping acampamento', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'lookout', label: 'Mirante', icon: <Mountain className="w-6 h-6" />, query: 'mirante lookout scenic vista', color: 'text-yellow-400', bg: 'bg-yellow-500/10' }
  ];

  const handleSearch = async (cat: any) => {
    if (!userLocation) return;
    setSelectedCategory(cat);
    setLoading(true);
    setActiveTab('results');
    try {
      const data = await searchPlaces(cat.query, userLocation, distance * 1000, userId, isGuest);
      setPlaces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (place: any) => {
    setLoading(true);
    try {
      const details = await fetchPlaceDetails(place.id);
      setSelectedPlace(details || place);
      setActiveTab('detail');
    } catch (e) {
      console.error(e);
      setSelectedPlace(place);
      setActiveTab('detail');
    } finally {
      setLoading(false);
    }
  };

  if (activeTab === 'detail' && selectedPlace) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
        <header className="p-6 flex items-center gap-4 border-b border-white/5">
          <button onClick={() => setActiveTab('results')} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-display font-black italic text-white uppercase truncate">{selectedPlace.displayName?.text || selectedPlace.name}</h2>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="aspect-video rounded-[32px] overflow-hidden bg-zinc-900 border border-white/5 relative">
            {selectedPlace.photos && selectedPlace.photos.length > 0 ? (
              <img 
                src={`https://places.googleapis.com/v1/${selectedPlace.photos[0].name}/media?maxHeightPx=1000&maxWidthPx=1000&key=${GOOGLE_MAPS_API_KEY}`} 
                className="w-full h-full object-cover"
                alt="Local"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Palmtree className="w-12 h-12 text-zinc-800" /></div>
            )}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2">
                   <Star className="w-4 h-4 text-yellow-500 fill-current" />
                   <span className="text-white font-black italic">{selectedPlace.rating || 'N/A'}</span>
                   <span className="text-zinc-500 text-[10px] uppercase font-bold">({selectedPlace.userRatingCount || 0} avaliaà§ões)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Sobre o Local</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{selectedPlace.formattedAddress}</p>
            </div>

            {selectedPlace.reviews && selectedPlace.reviews.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Comentários Recentes</h3>
                <div className="space-y-3">
                  {selectedPlace.reviews.slice(0, 3).map((rev: any, idx: number) => (
                    <div key={idx} className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-white italic">{rev.authorAttribution?.displayName}</span>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => <Star key={i} className={`w-2 h-2 ${i < rev.rating ? 'text-yellow-500 fill-current' : 'text-zinc-800'}`} />)}
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 line-clamp-2">{rev.text?.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.location.latitude},${selectedPlace.location.longitude}&travelmode=driving`;
                window.open(url, '_blank');
              }}
              className="w-full py-5 bg-cyan-500 text-zinc-950 rounded-[28px] font-black italic uppercase text-xs tracking-[0.2em] shadow-xl shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <Navigation className="w-5 h-5" />
              Traà§ar Rota Agora
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      <header className="p-6 flex items-center gap-4 border-b border-white/5">
        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white uppercase tracking-tighter">Explorador de Viagem</h2>
          <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest mt-1">Destinos Elite</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        {activeTab === 'categories' && (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-end px-1">
                 <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Raio de Busca</h3>
                 <span className="text-sm font-display font-black italic text-cyan-400">{distance} <span className="text-[10px]">KM</span></span>
              </div>
              <input 
                type="range" 
                min="10" max="500" step="10" 
                value={distance} 
                onChange={(e) => setDistance(Number(e.target.value))}
                className="w-full accent-cyan-500 h-2 bg-zinc-900 rounded-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {categories.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSearch(cat)}
                  className={`${cat.bg} p-6 rounded-[32px] border border-white/5 flex flex-col items-center gap-4 transition-all hover:border-white/10`}
                >
                  <div className={`${cat.color}`}>{cat.icon}</div>
                  <span className="text-[10px] font-black uppercase text-white tracking-widest">{cat.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-4 pb-24">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-cyan-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Resultados Próximos</h3>
            </div>
            
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-4">
                 <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                 <p className="text-[8px] font-black text-zinc-600 uppercase">Escaneando Satélites...</p>
              </div>
            ) : places.length > 0 ? (
              places.map((place) => (
                <motion.div
                  key={place.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleViewDetails(place)}
                  className="bg-zinc-900/50 p-4 rounded-[28px] border border-white/5 flex items-center gap-4 active:scale-[0.98] transition-all"
                >
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden shrink-0 border border-white/5">
                     {place.photos && place.photos.length > 0 ? (
                       <img 
                        src={`https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=400&maxWidthPx=400&key=${GOOGLE_MAPS_API_KEY}`} 
                        className="w-full h-full object-cover"
                        alt="Local"
                       />
                     ) : <Palmtree className="w-6 h-6 text-zinc-700 m-auto mt-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-white italic uppercase truncate">{place.displayName?.text}</h4>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        <span className="text-[10px] text-white font-bold">{place.rating || 'N/A'}</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter truncate">{place.formattedAddress}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-800" />
                </motion.div>
              ))
            ) : (
              <div className="py-20 text-center space-y-4 opacity-30">
                 <Compass className="w-12 h-12 text-white mx-auto" />
                 <p className="text-[10px] font-black uppercase">Nenhum destino encontrado no raio de {distance}km</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CurveRadar({ onBack, userLocation, userId, isGuest }: { onBack: () => void, userLocation: { lat: number, lng: number } | null, userId?: string, isGuest: boolean }) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [analysisResult, setAnalysisResult] = React.useState<{
    routePoints: { lat: number, lng: number }[],
    curves: any[],
    score: number,
    totalDistance: number,
    routeName: string
  } | null>(null);

  const handleAnalyzeRoute = async () => {
    if (!userLocation || !searchQuery) return;
    setLoading(true);
    setAnalysisResult(null);

    try {
      const routeData = await fetchRoutePoints(userLocation, searchQuery, userId, isGuest);
      if (routeData.status === 'OK' && routeData.points.length > 0) {
        const curves: any[] = [];
        let totalScore = 0;
        
        for (let i = 0; i < routeData.points.length - 2; i++) {
            const p1 = routeData.points[i];
            const p2 = routeData.points[i+1];
            const p3 = routeData.points[i+2];
            
            const angle = Math.abs(Math.atan2(p3.lng - p2.lng, p3.lat - p2.lat) - Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat));
            if (angle > 0.3) { 
                curves.push({ severity: angle * 2, point: p2 });
                totalScore += angle * 2;
            }
        }

        const distanceKm = routeData.points.length * 0.1; 
        setAnalysisResult({
          routePoints: routeData.points,
          curves,
          score: Math.min(100, (totalScore / (distanceKm + 1)) * 5),
          totalDistance: distanceKm,
          routeName: routeData.routeName || searchQuery
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      <header className="p-6 flex items-center gap-4 border-b border-white/5">
        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white uppercase tracking-tighter">Radar de Curvas</h2>
          <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest mt-1">Análise de trajeto IA</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Para onde vamos acelerar?" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-yellow-500/50 outline-none transition-all"
            />
          </div>
          <button 
            onClick={handleAnalyzeRoute}
            disabled={loading || !searchQuery}
            className="w-full py-4 bg-yellow-500 text-zinc-950 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-yellow-500/10 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Analisando Trajeto...' : 'Mapear Curvas'}
          </button>
        </div>

        {analysisResult && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="relative overflow-hidden bg-zinc-900 rounded-[32px] border border-white/5 p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-[50px] rounded-full" />
              <div className="relative z-10 flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nível de Adrenalina</span>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-5xl font-display font-black italic text-white tracking-tighter">{analysisResult.score.toFixed(0)}</h3>
                    <span className="text-yellow-500 font-black italic uppercase">pts</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-white uppercase italic">{analysisResult.curves.length} Curvas</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{analysisResult.totalDistance.toFixed(1)} KM Total</p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-5 border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black text-white uppercase truncate">{analysisResult.routeName}</h4>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Trajeto mais sinuoso detectado</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                 <div className="bg-zinc-950 rounded-2xl p-3 text-center border border-white/5">
                   <span className="block text-[7px] font-black text-zinc-600 uppercase mb-1">Fechadas</span>
                   <span className="text-sm font-display font-black italic text-red-500">{analysisResult.curves.filter(c => c.severity > 3).length}</span>
                 </div>
                 <div className="bg-zinc-950 rounded-2xl p-3 text-center border border-white/5">
                   <span className="block text-[7px] font-black text-zinc-600 uppercase mb-1">Médias</span>
                   <span className="text-sm font-display font-black italic text-orange-500">{analysisResult.curves.filter(c => c.severity >= 1.5 && c.severity <= 3).length}</span>
                 </div>
                 <div className="bg-zinc-950 rounded-2xl p-3 text-center border border-white/5">
                   <span className="block text-[7px] font-black text-zinc-600 uppercase mb-1">Abertas</span>
                   <span className="text-sm font-display font-black italic text-yellow-500">{analysisResult.curves.filter(c => c.severity < 1.5).length}</span>
                 </div>
              </div>
            </div>

            <button 
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat || 0},${userLocation?.lng || 0}&destination=${encodeURIComponent(searchQuery)}&travelmode=driving`;
                window.open(url, '_blank');
              }}
              className="w-full py-5 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center gap-3 group active:scale-95 transition-all"
            >
              <Navigation className="w-5 h-5 text-yellow-500 group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Iniciar Roteiro</span>
            </button>
          </motion.div>
        )}

        {!analysisResult && !loading && (
          <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center space-y-4">
            <ActivityIcon className="w-16 h-16 text-white" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] max-w-[200px]">Insira o destino para mapear o nível de pilotagem da estrada</p>
          </div>
        )}
      </main>
    </div>
  );
}

function VehicleCatalog({ vehicle, onBack, isOwnCar, onEditVehicle }: { vehicle: any, onBack: () => void, isOwnCar: boolean, onEditVehicle: (v: any) => void }) {
  const stats = {
    topSpeed: vehicle.maxSpeed || (vehicle.type === 'motorcycle' ? 180 : 240),
    torque: vehicle.torque || (vehicle.type === 'motorcycle' ? 40 : 270),
    gForce: vehicle.maxG || 0.85,
    power: vehicle.hp || (vehicle.type === 'motorcycle' ? 30 : 180),
    weight: vehicle.weight || (vehicle.type === 'motorcycle' ? 160 : 1350),
    engine: vehicle.engine || (vehicle.type === 'motorcycle' ? '400cc Single' : '1.8 TFSI (180CV)'),
    stage: vehicle.stage || 'STOCK'
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden relative h-full">
      {/* Header - Compact */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between z-20">
        <button onClick={onBack} className="p-2 bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-xl text-white active:scale-90 transition-transform">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-white font-black italic text-base tracking-tighter uppercase">Drag<span className="text-brand-primary">Fire</span></span>
        <button className="p-2 bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-xl text-white active:scale-90 transition-transform">
          <SettingsIcon className="w-5 h-5 text-brand-primary" />
        </button>
      </header>

      <main className="flex-1 flex flex-col px-4 pb-4 overflow-hidden">
        {/* Hero Card - More Compact */}
        <div className="relative aspect-[4/3] rounded-[32px] overflow-hidden border border-white/10 shadow-xl mb-2 shrink-0">
          <img 
            src={vehicle.photoURL || 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&q=80'} 
            className="w-full h-full object-cover" 
            alt={vehicle.model} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Top Glass Badge - More Compact & Higher */}
          <div className="absolute top-2 left-4 right-4 flex items-start justify-between">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl py-1.5 px-2.5 flex items-center gap-2">
              <div className="text-[8px] font-black text-white italic uppercase tracking-tighter pr-2 border-r border-white/10">
                DRAG<span className="text-brand-primary">FIRE</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-white uppercase leading-none">{vehicle.brand}</span>
                  <span className="text-[6px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{vehicle.nickname || vehicle.model}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Stage moved here - More compact */}
              <div className="bg-brand-primary/90 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
                <span className="text-[7px] font-black text-white italic uppercase tracking-widest">{stats.stage}</span>
              </div>
              <button className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white">
                <Share2Icon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area - Two Columns */}
        <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-hidden">
          {/* Left Column: DINÃ‚MICA */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-0.5 h-3 bg-brand-primary rounded-full" />
              <h4 className="text-[9px] font-black text-white uppercase italic tracking-widest">Dinâmica</h4>
            </div>
            
            <div className="flex-1 bg-zinc-900/40 border border-white/5 rounded-3xl p-4 flex flex-col justify-start">
               <div className="space-y-2.5">
                 <div className="space-y-1">
                   <div className="flex justify-between items-end">
                     <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Velocidade Máxima</span>
                     <span className="text-[10px] font-black text-white italic">{stats.topSpeed} <span className="text-[7px] text-brand-primary">KM/H</span></span>
                   </div>
                   <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-400" style={{ width: '65%' }} />
                   </div>
                 </div>

                 <div className="space-y-1">
                   <div className="flex justify-between items-end">
                     <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Torque Estimado</span>
                     <span className="text-[10px] font-black text-white italic">{stats.torque} <span className="text-[7px] text-orange-500">NM</span></span>
                   </div>
                   <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                     <div className="h-full bg-orange-500" style={{ width: '55%' }} />
                   </div>
                 </div>

                 <div className="space-y-1">
                   <div className="flex justify-between items-end">
                     <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Força G Acúm.</span>
                     <span className="text-[10px] font-black text-white italic">{stats.gForce} <span className="text-[7px] text-blue-500">G</span></span>
                   </div>
                   <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500" style={{ width: '45%' }} />
                   </div>
                 </div>
               </div>

               <div className="mt-3 pt-2 border-t border-white/5">
                 <div className="flex items-center gap-1.5 mb-2">
                   <Trophy className="w-3 h-3 text-yellow-500" />
                   <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Melhores Recordes</span>
                 </div>
                 <div className="space-y-1.5">
                   <div className="flex items-center justify-between bg-zinc-950/50 rounded-lg p-1.5">
                     <span className="text-[6px] font-bold text-zinc-500 uppercase tracking-widest">0-100 KM/H</span>
                     <span className="text-[9px] font-black text-white italic">
                       {vehicle.best0to100 ? vehicle.best0to100.toFixed(2) : '--'} <span className="text-brand-primary">S</span>
                     </span>
                   </div>
                   <div className="flex items-center justify-between bg-zinc-950/50 rounded-lg p-1.5">
                     <span className="text-[6px] font-bold text-zinc-500 uppercase tracking-widest">201 METROS</span>
                     <span className="text-[9px] font-black text-white italic">
                       {vehicle.best201m ? vehicle.best201m.toFixed(2) : '--'} <span className="text-blue-500">S</span>
                     </span>
                   </div>
                 </div>
               </div>
            </div>
          </div>

          {/* Right Column: FICHA TÃ‰CNICA */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-0.5 h-3 bg-zinc-600 rounded-full" />
              <h4 className="text-[9px] font-black text-zinc-400 uppercase italic tracking-widest">Ficha Técnica</h4>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[6px] font-black text-zinc-600 uppercase tracking-widest">Potência</span>
                  <span className="text-sm font-black text-white italic leading-none">{stats.power} <span className="text-[7px] text-brand-primary">CV</span></span>
                </div>
                <Zap className="w-5 h-5 text-brand-primary opacity-30" />
              </div>

              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[6px] font-black text-zinc-600 uppercase tracking-widest">Peso Total</span>
                  <span className="text-[10px] font-black text-white italic leading-none">{stats.weight} <span className="text-[6px] text-zinc-500">KG</span></span>
                </div>
                <Scale className="w-4 h-4 text-zinc-600" />
              </div>

              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-3 flex flex-col">
                <span className="text-[6px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">Modelo Motor</span>
                <span className="text-[9px] font-black text-white italic leading-tight">{stats.engine}</span>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[6px] font-black text-zinc-600 uppercase tracking-widest">Tração</span>
                  <span className="text-[10px] font-black text-white italic leading-none">{vehicle.traction || 'FWD'}</span>
                </div>
                <Cpu className="w-4 h-4 text-zinc-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button - More Compact */}
        <div className="mt-4 pt-2 shrink-0">
          <button 
            className="w-full py-4 bg-gradient-to-r from-brand-primary to-red-600 text-white rounded-[24px] font-black uppercase italic tracking-[0.2em] text-[9px] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3"
          >
            <Share2Icon className="w-4 h-4" />
            Compartilhar Garagem
          </button>
          
          {isOwnCar && (
            <button 
              onClick={() => onEditVehicle(vehicle)}
              className="w-full py-2 text-zinc-600 font-black uppercase tracking-widest text-[7px] active:scale-95"
            >
              Editar Configurações
            </button>
          )}
        </div>
      </main>
    </div>
  );
}