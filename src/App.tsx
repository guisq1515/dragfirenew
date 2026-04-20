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
  enableNetwork
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
  Car,
  Sparkles,
  MessageSquare,
  Bell,
  Eye,
  LogOut,
  Settings2,
  Palette
} from 'lucide-react';
import { PerformanceChart } from './components/PerformanceChart';
import { TripAnalysis } from './components/TripAnalysis';
import { ProfileLibrary } from './components/ProfileLibrary';
import { FuelCalculator } from './components/FuelCalculator';
import { editCarImage, fetchVehicleSpecs } from './services/geminiService';
import { AIPhotoEditor } from './components/AIPhotoEditor';
import { GasStations } from './components/GasStations';
import { AntigravityImporter } from './components/AntigravityImporter';
import { AdminDashboard } from './components/AdminDashboard';
import { getThemeById, PROFILE_THEMES, BADGES, NEON_COLORS } from './constants/themes';
import { ThemeStoreModal } from './components/ThemeStoreModal';

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

// --- Error Boundary ---
class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, errorInfo: null };

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
            Ocorreu um erro ao processar sua solicitação. Verifique sua conexão ou tente novamente.
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

// --- Brand Logo Component ---
const DragFireLogo = ({ size = 'medium', className = '' }: { size?: 'small' | 'medium' | 'large', className?: string }) => {
  const sizes = {
    small: 'h-6',
    medium: 'h-10',
    large: 'h-24'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative ${sizes[size]} aspect-square`}>
        {/* Flame Icon */}
        <div className="absolute -top-1 -right-1 w-1/2 h-1/2 overflow-visible">
          <svg viewBox="0 0 24 24" className="w-full h-full text-brand-primary drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">
            <path fill="currentColor" d="M12,18.5C10.07,18.5 8.5,16.93 8.5,15C8.5,13.07 10.07,11.5 12,11.5C13.93,11.5 15.5,13.07 15.5,15C15.5,16.93 13.93,18.5 12,18.5M12,2C12,2 17,7 17,11C17,14 14.5,16.5 12,16.5C9.5,16.5 7,14 7,11C7,7 12,2 12,2Z" />
          </svg>
        </div>
        {/* DF Letters */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <linearGradient id="df-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#e2e2e2', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path 
            d="M20 20 L50 20 Q70 20 70 40 L70 60 Q70 80 50 80 L20 80 Z" 
            fill="none" 
            stroke="white" 
            strokeWidth="8" 
            className="drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]"
          />
          <text 
            x="32" y="65" 
            fontFamily="font-display, sans-serif" 
            fontWeight="900" 
            fontStyle="italic" 
            fontSize="45" 
            fill="white"
          >D</text>
          <path 
            d="M60 30 L90 30 L90 40 L75 40 L75 50 L85 50 L85 60 L75 60 L75 80" 
            fill="none" 
            stroke="#ef4444" 
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {(size === 'medium' || size === 'large') && (
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className={`font-display font-black italic text-white uppercase tracking-tighter ${size === 'large' ? 'text-4xl' : 'text-xl'}`}>DRAG</span>
            <span className={`font-display font-black italic text-brand-primary uppercase tracking-tighter ${size === 'large' ? 'text-4xl' : 'text-xl'}`}>FIRE</span>
          </div>
        </div>
      )}
    </div>
  );
};

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

type Screen = 'home' | 'timer' | 'challenge' | 'duel-result' | 'settings' | 'login' | 'terms' | 'vehicle-settings' | 'profile-settings' | 'theme-store' | 'regional-ranking' | 'history' | 'gps-guide' | 'custom-setup' | 'trip-view' | 'fuel-calculator' | 'public-profile' | 'feed' | 'search' | 'ai-editor' | 'fuel-stations' | 'anp-import' | 'admin-dashboard' | 'cornering-assistant' | 'vehicle-catalog';

function GPSGuide({ onBack }: { onBack: () => void }) {
  const tips = [
    {
      title: "Céu Aberto",
      description: "O sinal de GPS viaja do espaço. Árvores, prédios altos e garagens bloqueiam ou refletem o sinal, causando erros de metros.",
      icon: <Cloud className="w-5 h-5 text-blue-400" />
    },
    {
      title: "Posição do Celular",
      description: "Coloque o celular no painel ou no para-brisa. Evite o console central ou o bolso, onde a lataria do carro abafa o sinal.",
      icon: <Smartphone className="w-5 h-5 text-brand-primary" />
    },
    {
      title: "Antenas Externas",
      description: "Para precisão profissional (10Hz ou 25Hz), considere usar receptores Bluetooth externos.",
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
      description: "Algumas marcas (Xiaomi, Samsung, Huawei) podem bloquear o GPS para economizar bateria. Verifique se o app tem permissão de 'Localização Precisa' e se a economia de energia está desativada.",
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
          <h2 className="text-xl font-display font-black italic text-white leading-none">GUIA DE PRECISÃO</h2>
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
          O DragFire utiliza um algoritmo híbrido que combina a posição geográfica com o efeito Doppler (velocidade real) para compensar oscilações do sensor do smartphone.
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
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Distância</span>
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
                            <div className="flex flex-col items-center">
                               <DragFireLogo size="small" />
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
                      <span className="text-[10px] font-black text-zinc-600 uppercase">Precisão</span>
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
          latitude: r.location.latitude,
          longitude: r.location.longitude,
          slope: r.slope || 0
        };
        await addDoc(collection(db, 'rankings'), rankingData);
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
        setError("Sem permissão para carregar o histórico. Tente relogar.");
      } else {
        setError("Erro ao carregar histórico. Verifique sua conexão.");
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
          <h2 className="text-xl font-display font-black italic text-white leading-none">HISTÓRICO</h2>
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
              No plano Free, apenas as <span className="text-yellow-500">2 últimas puxadas</span> são salvas.
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
              <div className={`w-6 h-6 rounded-full overflow-hidden border-2 ${isActive ? 'border-brand-primary' : 'border-transparent'}`}>
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
                  <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                      {act.handle && <span className="text-[9px] text-brand-primary font-black italic">#{act.handle}</span>}
                   </div>
                   <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{new Date(act.timestamp).toLocaleDateString()} • {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
        await deleteDoc(doc(db, 'follows', followId));
        setIsFollowing(false);
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
          await setDoc(doc(db, 'follows', followId), {
            followerId: currentUserId,
            followingId: uid,
            timestamp: Date.now()
          });
          setIsFollowing(true);
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Perfil de ${profile.displayName} no DragFire`,
      text: `Confira a garagem e os tempos de ${profile.displayName} no DragFire!`,
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
        <h3 className="text-white font-bold">Perfil não encontrado</h3>
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
      <div className="px-6 -mt-12 relative z-20 space-y-6">
        <div className="flex items-end justify-between">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl border-4 border-zinc-950 overflow-hidden bg-zinc-800 shadow-2xl">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-10 h-10 text-zinc-600" />
                </div>
              )}
            </div>
            </div>
            {/* Badge System: Zap for ADMIN, Brand Badge for Users */}
            {(uid === currentUserId && isAdmin) ? (
              <div className={`absolute -bottom-2 -right-2 ${theme.accentBg} text-white p-1.5 rounded-lg shadow-lg z-30`}>
                <Zap className="w-4 h-4 fill-current" />
              </div>
            ) : profile.activeBadgeId ? (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-black border border-white/10 shadow-2xl flex items-center justify-center z-30 p-1">
                <img src={BADGES.find(b => b.id === profile.activeBadgeId)?.imageUrl} className="w-full h-full object-contain" />
              </div>
            ) : profile.isPremium ? (
               <div className={`absolute -bottom-2 -right-2 ${theme.accentBg} text-white p-1 rounded-lg shadow-lg z-30`}>
                 <CheckCircle2 className="w-3 h-3 fill-current" />
               </div>
            ) : null}
          </div>
          
          {currentUserId !== uid && (
            <button 
              onClick={handleFollow}
              className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 ${isFollowing || isRequested ? 'bg-zinc-800 text-zinc-400 border border-white/5' : 'bg-brand-primary text-white shadow-lg shadow-red-600/20'}`}
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
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-display font-black italic text-white leading-none">
              {profile.displayName || 'Piloto Anônimo'}
            </h2>
            {profile.handle && (
              <p className={`w-full text-xs ${theme.accentText} font-black italic tracking-widest mt-1 uppercase`}>#{profile.handle}</p>
            )}
            {profile.isVerified && (
              <CheckCircle2 className="w-5 h-5 text-blue-400 fill-blue-400/10" />
            )}
            {profile.instagram && (
              <a 
                href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl text-white shadow-lg shadow-pink-600/20 active:scale-95 transition-all ml-1"
              >
                <Instagram className="w-4 h-4" />
                <span className="text-xs font-black tracking-tight">{profile.instagram.startsWith('@') ? profile.instagram : `@${profile.instagram}`}</span>
              </a>
            )}
          </div>
          {profile.bio && <p className="text-zinc-400 text-sm mt-2">{profile.bio}</p>}
          


          <div className="flex gap-4 mt-4">
            <div className="flex flex-col">
              <span className="text-white font-black italic text-lg leading-none">{profile.followersCount || 0}</span>
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Seguidores</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-black italic text-lg leading-none">{profile.followingCount || 0}</span>
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Seguindo</span>
            </div>
          </div>
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
            <ImageIcon className="w-4 h-4" /> Álbuns
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 rounded-lg text-brand-primary hover:bg-brand-primary hover:text-white transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Adicionar</span>
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
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">{v.brand} {v.model} • {v.year}</p>
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
                  Últimos Tempos
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
  const [filter, setFilter] = useState<'regional' | 'regional-100' | 'general'>('regional');
  const [typeFilter, setTypeFilter] = useState<'all' | 'car' | 'motorcycle'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'rankings'), 
      where('category', '==', filter.includes('201') || filter === 'regional-201' ? '201m' : '0-100'),
      orderBy('time', 'asc'), 
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RankingEntry));
      setRankings(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching rankings:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [filter]); // Re-fetch when filter changes

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
          <h2 className="text-xl font-display font-black italic text-white leading-none">RANKING 0-100</h2>
          <p className="text-xs text-brand-primary font-bold uppercase tracking-widest mt-1">Desafio Regional</p>
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
            <p className="text-zinc-500 text-xs font-bold uppercase">Nenhum tempo registrado nesta região</p>
          </div>
        ) : (
          filteredRankings.map((entry, index) => (
            <div 
              key={entry.id} 
              className="glass-panel rounded-2xl p-4 border-white/5 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all"
              onClick={() => onViewProfile(entry.uid)}
            >
              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-xs font-black italic text-brand-primary border border-brand-primary/20">
                #{index + 1}
              </div>
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                {entry.userPhoto ? (
                  <img src={entry.userPhoto} alt={entry.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <User className="w-5 h-5 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{entry.userName}</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase truncate">{entry.vehicleName}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-display font-black text-brand-accent italic leading-none">{entry.time.toFixed(2)}s</p>
                <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">{Math.round(entry.maxSpeed)} km/h</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
        <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
          Apenas puxadas realizadas em <span className="text-white font-bold">plano ou subida</span> são válidas para o ranking. Descidas são automaticamente invalidadas pelo sistema.
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
  const [category, setCategory] = useState<'0-100' | '201m'>('0-100');
  const [typeFilter, setTypeFilter] = useState<'all' | 'car' | 'motorcycle'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const mode = category === '201m' ? 'distance' : 'speed';
    const target = category === '201m' ? 201 : 100;

    const q = query(
      collection(db, 'rankings'), 
      where('mode', '==', mode),
      where('target', '==', target),
      orderBy('time', 'asc'), 
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RankingEntry));
      setRankings(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching rankings:", error);
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
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mt-1">Temporada 2026</p>
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

          {/* Podium Section */}
          {!loading && top3.length > 0 && (
            <div className="flex items-end justify-center gap-2 pt-6 h-64">
                {/* 2nd Place */}
                {top3[1] && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col items-center gap-2"
                    onClick={() => onViewProfile(top3[1].uid)}
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-3xl border-2 border-zinc-400 p-1 bg-zinc-900 group shadow-lg">
                         <img src={top3[1].userPhoto || 'https://via.placeholder.com/150'} className="w-full h-full object-cover rounded-2xl" />
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-zinc-400 rounded-full flex items-center justify-center text-[10px] font-black text-zinc-900 border-2 border-zinc-900">2</div>
                    </div>
                    <div className="text-center pt-2">
                       <p className="text-[10px] font-black text-white italic truncate max-w-[80px] leading-tight">{top3[1].userName}</p>
                       <p className="text-xl font-display font-black italic text-zinc-400">{top3[1].time.toFixed(2)}s</p>
                    </div>
                    <div className="w-full h-24 bg-zinc-800/40 border-t border-zinc-700/50 rounded-t-2xl" />
                  </motion.div>
                )}

                {/* 1st Place */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col items-center gap-2 -mb-4 z-10"
                  onClick={() => onViewProfile(top3[0].uid)}
                >
                  <div className="relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                       <Trophy className="w-8 h-8 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] fill-current" />
                    </div>
                    <div className="w-20 h-20 rounded-3xl border-4 border-yellow-500 p-1 bg-gradient-to-br from-yellow-500/20 to-transparent shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                       <img src={top3[0].userPhoto || 'https://via.placeholder.com/150'} className="w-full h-full object-cover rounded-2xl" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-black text-zinc-900 border-4 border-zinc-900">1</div>
                  </div>
                  <div className="text-center pt-2">
                     <p className="text-[12px] font-black text-white italic truncate max-w-[100px] leading-tight">{top3[0].userName}</p>
                     <p className="text-2xl font-display font-black italic text-yellow-500 glow-yellow">{top3[0].time.toFixed(2)}s</p>
                  </div>
                  <div className="w-full h-32 bg-gradient-to-t from-zinc-800/60 to-zinc-800/80 border-t-2 border-yellow-500/50 rounded-t-3xl shadow-[0_-10px_30px_rgba(234,179,8,0.1)]" />
                </motion.div>

                {/* 3rd Place */}
                {top3[2] && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col items-center gap-2"
                    onClick={() => onViewProfile(top3[2].uid)}
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-3xl border-2 border-orange-700/50 p-1 bg-zinc-900">
                         <img src={top3[2].userPhoto || 'https://via.placeholder.com/150'} className="w-full h-full object-cover rounded-2xl" />
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-orange-700 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-zinc-900">3</div>
                    </div>
                    <div className="text-center pt-2">
                       <p className="text-[10px] font-black text-white italic truncate max-w-[80px] leading-tight">{top3[2].userName}</p>
                       <p className="text-xl font-display font-black italic text-orange-600">{top3[2].time.toFixed(2)}s</p>
                    </div>
                    <div className="w-full h-20 bg-zinc-800/40 border-t border-zinc-700/50 rounded-t-2xl" />
                  </motion.div>
                )}
            </div>
          )}

          {/* List Section with Luxury Design */}
          <div className="space-y-4">
             {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                   <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                   <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em]">Sincronizando Satélites</p>
                </div>
             ) : others.length === 0 && top3.length === 0 ? (
               <div className="text-center py-20 bg-white/5 rounded-[40px] border border-white/5">
                 <Trophy className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                 <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Pista Vazia</p>
               </div>
             ) : (
                others.map((entry, index) => {
                   const pos = index + 4;
                   return (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={entry.id}
                        onClick={() => onViewProfile(entry.uid)}
                        className="group relative bg-[#121212]/50 backdrop-blur-xl border border-white/5 rounded-[28px] p-4 flex items-center gap-4 hover:bg-white/5 transition-all active:scale-[0.98]"
                      >
                         <div className="w-8 flex flex-col items-center">
                            <span className="text-zinc-600 font-display font-black italic text-xs">#{pos}</span>
                         </div>
                         <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 group-hover:border-brand-primary/50 transition-colors bg-zinc-950">
                            {entry.userPhoto ? (
                              <img src={entry.userPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-5 h-5 text-zinc-800 m-auto mt-3.5" />
                            )}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                               <h4 className="text-xs font-black text-white uppercase italic truncate">{entry.userName}</h4>
                               {entry.vehicleType === 'motorcycle' && <Navigation className="w-2.5 h-2.5 text-brand-secondary -rotate-90" />}
                            </div>
                            <p className="text-[8px] text-zinc-500 font-black tracking-widest uppercase truncate">{entry.vehicleName}</p>
                         </div>
                         <div className="text-right">
                             <p className="text-lg font-display font-black text-white italic group-hover:text-brand-primary transition-colors">{entry.time.toFixed(2)}s</p>
                             <div className="flex items-center gap-1 justify-end opacity-50">
                                <span className="text-[8px] font-black text-zinc-500">{Math.round(entry.maxSpeed)} KM/H</span>
                             </div>
                         </div>
                         {/* Subtle Shadow Glow */}
                         <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-brand-primary/5 to-transparent rounded-full" />
                      </motion.div>
                   )
                })
             )}
          </div>

          <div className="p-4 rounded-3xl bg-brand-primary/5 border border-brand-primary/20 flex gap-3">
             <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0" />
             <div>
                <p className="text-[10px] font-black text-brand-primary uppercase mb-1">Nota de Aferição</p>
                <p className="text-[9px] text-zinc-400 font-bold leading-relaxed italic">Somente puxadas em terreno nivelado ou aclive ascendente são homologadas pela liga Elite DragFire.</p>
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
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoURL(url);
      onUpdate({ photoURL: url });
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
      handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, ''),
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
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Toque na câmera para alterar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {followRequests.length > 0 && (
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Solicitações de Seguidores ({followRequests.length})</label>
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
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
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
              { id: 'showRankings', label: 'Aparecer no Ranking', desc: 'Permitir que seu tempo apareça no ranking global', icon: Trophy }
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
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">E-mail (Não editável)</label>
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
            SALVAR ALTERAÇÕES
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
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Menu de Configurações</p>
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
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Usar sensor de alta precisão</p>
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
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Forçar liberação do sensor (Xiaomi/Android)</p>
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
            <span className="text-sm font-bold text-zinc-300">Versão</span>
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
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">1. ACEITAÇÃO DOS TERMOS</h3>
          <p>Ao clicar em “ACEITO E CONTINUAR”, você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso, Responsabilidade e Política de Privacidade. Caso não concorde, selecione “NÃO ACEITO”, e o uso do aplicativo será interrompido.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">2. FINALIDADE DO APLICATIVO</h3>
          <p>O <span className="text-white font-bold">DRAGFIRE</span> é um aplicativo destinado ao monitoramento de desempenho veicular, incluindo medições como aceleração (0–100 km/h, 0–200 km/h), tempo, velocidade e outras métricas.</p>
          <p className="text-brand-primary/80 font-medium italic">⚠️ O uso é permitido exclusivamente em ambientes privados, controlados e legalmente autorizados, como pistas fechadas, autódromos ou propriedades particulares.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-brand-primary font-black text-[10px] uppercase tracking-widest">3. USO PROIBIDO</h3>
          <p>É expressamente proibido:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Utilizar o aplicativo em vias públicas para testes de desempenho;</li>
            <li>Praticar direção perigosa ou ilegal com base nas informações do app;</li>
            <li>Utilizar o aplicativo de forma que viole leis de trânsito ou normas de segurança.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">4. RESPONSABILIDADE DO USUÁRIO</h3>
          <p>O usuário declara que:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Utiliza o aplicativo por sua conta e risco;</li>
            <li>Cumpre integralmente a legislação vigente;</li>
            <li>É o único responsável pela condução do veículo;</li>
            <li>Assume total responsabilidade por quaisquer danos materiais, pessoais ou a terceiros decorrentes do uso.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">5. ISENÇÃO DE RESPONSABILIDADE</h3>
          <p>O <span className="text-white font-bold">DRAGFIRE</span> não se responsabiliza por:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Acidentes, multas, penalidades ou infrações;</li>
            <li>Danos ao veículo, ao usuário ou terceiros;</li>
            <li>Uso indevido, ilegal ou imprudente do aplicativo;</li>
            <li>Decisões tomadas com base nos dados fornecidos.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">6. LIMITAÇÃO DE GARANTIA</h3>
          <p>O aplicativo é fornecido “como está”, sem garantias de precisão absoluta dos dados, funcionamento ininterrupto ou livre de erros.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">7. COLETA DE DADOS (LGPD)</h3>
          <p>Para funcionamento do aplicativo, poderão ser coletados dados de localização (GPS), desempenho do veículo, dados do dispositivo e informações fornecidas pelo usuário.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">8. FINALIDADE DO TRATAMENTO DE DADOS</h3>
          <p>Os dados coletados serão utilizados para o funcionamento das funcionalidades, geração de métricas, melhoria da experiência e segurança.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">9. COMPARTILHAMENTO DE DADOS</h3>
          <p>Os dados não serão vendidos. Poderão ser compartilhados apenas quando necessário para funcionamento técnico ou por obrigação legal.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">10. ARMAZENAMENTO E SEGURANÇA</h3>
          <p>Os dados são armazenados em ambiente seguro, com medidas técnicas adequadas para proteção contra acesso não autorizado.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">11. DIREITOS DO USUÁRIO (LGPD)</h3>
          <p>Você pode solicitar acesso, correção ou exclusão dos seus dados através do contato: <span className="text-white font-bold">guisq1515@gmail.com</span></p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">12. RETENÇÃO DE DADOS</h3>
          <p>Os dados serão armazenados apenas pelo tempo necessário para cumprir as finalidades descritas ou conforme exigido por lei.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">13. ALTERAÇÕES NOS TERMOS</h3>
          <p>Estes termos podem ser atualizados a qualquer momento. O uso contínuo do app após alterações implica nova aceitação.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">14. LEGISLAÇÃO E FORO</h3>
          <p>Este termo será regido pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo/SP para resolução de conflitos.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-white font-black text-[10px] uppercase tracking-widest">15. CONSENTIMENTO FINAL</h3>
          <p>Ao clicar em “ACEITO E CONTINUAR”, você declara que leu e concorda com todos os termos, autoriza o tratamento de dados e assume total responsabilidade pelo uso.</p>
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
          NÃO ACEITO
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
    let blob: Blob | null = null;
    let dataToUpload: string | null = null;
    let isBase64Str = false;
    let downloadURL = '';

    setIsUploading(true);
    
    // Safety timeout (30s)
    const timeout = setTimeout(() => {
      setIsUploading(false);
      // We don't alert here because if it finally finishes, it will just update the state.
      // But we must release the UI.
    }, 30000);

    try {
      if (!auth.currentUser) throw new Error('Usuário não autenticado.');
      
      setUploadStatus('[S1] Abrindo Galeria...');
      
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri, 
        source: CameraSource.Photos,
        width: 1280,
        height: 1280
      });

      if (!photo.webPath) throw new Error('Câmera não retornou a imagem.');
      
      setUploadStatus('[S2] Preparando Foto...');
      const fileName = `main_${Date.now()}.jpg`;
      const path = `vehicles/${auth.currentUser.uid}/${formData.id || 'new'}/${fileName}`;
      const storageRef = ref(storage, path);
      
      setUploadProgress(10);
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      
      setUploadProgress(40);
      setUploadStatus('[S3] Enviando para Nuvem...');
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      setFormData({ ...formData, photoURL: downloadURL });
      setUploadStatus('Sucesso!');
    } catch (error: any) {
      console.error('Photo Error:', error);
      alert(`Erro ao processar foto: ${error.message || 'Erro desconhecido'}`);
    } finally {
      clearTimeout(timeout);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const handleAdditionalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement> | null) => {
    if (!auth.currentUser || !isPremium) return;
    
    setIsUploading(true);
    const timeout = setTimeout(() => setIsUploading(false), 30000);

    try {
      setUploadStatus('[S1] Abrindo Galeria...');
      const currentPhotos = formData.photoURLs || [];
      if (currentPhotos.length >= 6) {
        alert('Limite de 6 fotos extras atingido.');
        return;
      }

      const fileName = `extra_${Date.now()}.jpg`;
      const path = `vehicles/${auth.currentUser.uid}/${formData.id || 'new'}/${fileName}`;
      const storageRef = ref(storage, path);
      let payloadBlob: Blob | null = null;

      if (Capacitor.isNativePlatform() && !e) {
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
          width: 1280,
          height: 1280
        });
        
        if (!photo.webPath) throw new Error('Câmera não retornou imagem nativa.');
        setUploadProgress(10);
        const response = await fetch(photo.webPath);
        payloadBlob = await response.blob();
      } else if (e) {
        const file = e.target.files?.[0];
        if (file) payloadBlob = file;
      }

      if (!payloadBlob) throw new Error('Nenhuma imagem processada.');
      
      setUploadStatus('[S2] Enviando Foto Extra...');
      setUploadProgress(40);
      
      await uploadBytes(storageRef, payloadBlob);
      const downloadURL = await getDownloadURL(storageRef);

      setFormData({
        ...formData,
        photoURLs: [...currentPhotos, downloadURL]
      });

      setUploadStatus('Sucesso!');
    } catch (error: any) {
      console.error('Extra Photo Error:', error);
      alert(`Erro ao processar foto: ${error.message || 'Erro desconhecido'}`);
    } finally {
      clearTimeout(timeout);
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
      setFormData({
        year: YEARS[0],
        nickname: '',
        hp: 0,
        weight: 0,
        engine: '',
        transmission: '',
        stockHp: 0,
        stockWeight: 0
      });
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
            <h2 className="text-xl font-display font-black italic text-white leading-none">MEUS VEÍCULOS</h2>
            <p className="text-xs text-brand-primary font-bold uppercase tracking-widest mt-1">Garagem Virtual</p>
          </div>
        </div>

        <div className="space-y-3">
          {vehicles.map((v) => (
            <div 
              key={v.id}
              className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${v.active ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-zinc-900/50 border-white/5'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ${v.active ? 'bg-brand-primary/20' : 'bg-zinc-800'}`}>
                {v.photoURL ? (
                  <img src={v.photoURL} alt={v.nickname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  v.type === 'car' ? <Car className={`w-6 h-6 ${v.active ? 'text-brand-primary' : 'text-zinc-500'}`} /> : <Navigation className={`w-6 h-6 -rotate-90 ${v.active ? 'text-brand-primary' : 'text-zinc-500'}`} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{v.nickname}</h4>
                  {v.active && <span className="text-[8px] bg-brand-primary text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">Ativo</span>}
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">{v.brand} {v.model} • {v.year}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setCatalogVehicle(v);
                    setScreen('vehicle-catalog');
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[8px] font-black uppercase tracking-widest text-zinc-400 rounded-lg border border-white/5 active:scale-95 transition-all"
                >
                  VER CATÁLOGO
                </button>
              <button 
                  onClick={() => {
                    setEditingVehicle(v);
                    setScreen('vehicle-settings');
                  }}
                  className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(v)}
                  className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
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
            {editingVehicle.id ? 'EDITAR VEÍCULO' : 'NOVO VEÍCULO'}
          </h2>
          <p className="text-xs text-brand-primary font-bold uppercase tracking-widest mt-1">Configurações</p>
        </div>
      </div>

      <div className="flex gap-2 bg-zinc-900 border border-white/5 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('basics')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'basics' ? 'bg-brand-primary text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}
        >
          Informações Básicas
        </button>
        <button
          onClick={() => setActiveTab('technical')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'technical' ? 'bg-brand-primary text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}
        >
          Informações Técnicas
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
            {isPremium ? 'Toque no + para alterar' : 'Foto padrão do veículo'}
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
                   <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Modificações / Setup</label>
                   <textarea 
                    value={formData.mods || ''}
                    onChange={e => setFormData({...formData, mods: e.target.value})}
                    placeholder="Ex: Filtro K&N, Remap, Escape Full..."
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl p-4 text-[10px] text-white placeholder:text-zinc-800 focus:outline-none focus:border-brand-primary/50 transition-colors min-h-[100px] resize-none"
                   />
                </div>

                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Observações Adicionais</label>
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
                {formData.type === 'car' ? 'Versão / Motorização / Câmbio' : 'Versão / Setup (Opcional)'}
              </label>
              <div className="relative group">
                <select 
                  value={specs.includes(formData.engine) ? formData.engine : (formData.engine ? 'Custom' : '')}
                  onChange={e => setFormData({ ...formData, engine: e.target.value === 'Custom' ? ' ' : e.target.value })}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white focus:outline-none focus:border-brand-primary/50 transition-colors"
                  disabled={!formData.model}
                >
                  <option value="">Selecione a Versão</option>
                  {specs.map(s => <option key={s} value={s}>{s}</option>)}
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
                SALVAR VEÍCULO
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
    Você: challenge.opponentResult?.path[i]?.speed * 3.6 || 0
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
            {isWinner ? 'VITÓRIA!' : 'DERROTA'}
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
            <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest">VOCÊ</span>
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
  { id: '0-100', label: '0-100 km/h', mode: 'speed' as const, target: 100, startSpeed: 0, description: 'Teste clássico de aceleração', icon: Zap, color: 'from-red-500 to-orange-500', type: 'standing' },
  { id: '0-200', label: '0-200 km/h', mode: 'speed' as const, target: 200, startSpeed: 0, description: 'Performance em alta velocidade', icon: Gauge, color: 'from-orange-500 to-yellow-500', type: 'standing' },
  { id: '100-200', label: '100-200 km/h', mode: 'speed' as const, target: 200, startSpeed: 100, description: 'Retomada em movimento', icon: Timer, color: 'from-yellow-500 to-green-500', type: 'rolling' },
  { id: '201m', label: '201m', mode: 'distance' as const, target: 201, startSpeed: 0, description: '1/8 de milha (Arrancada)', icon: Flag, color: 'from-blue-500 to-cyan-500', type: 'standing' },
  { id: '402m', label: '402m', mode: 'distance' as const, target: 402, startSpeed: 0, description: '1/4 de milha (Padrão)', icon: Trophy, color: 'from-purple-500 to-pink-500', type: 'standing' },
  { id: '1km', label: '1km', mode: 'distance' as const, target: 1000, startSpeed: 0, description: 'Velocidade final máxima', icon: Flag, color: 'from-zinc-500 to-zinc-400', type: 'standing' },
  { id: 'free', label: 'Modo Livre', mode: 'free' as const, target: 0, startSpeed: 0, description: 'Ajuste mecânico e telemetria', icon: ActivityIcon, color: 'from-zinc-700 to-zinc-600', type: 'manual' },
  { id: 'custom', label: 'Personalizada', mode: 'custom' as const, target: 0, startSpeed: 0, description: 'Crie seu próprio teste', icon: SettingsIcon, color: 'from-brand-primary to-brand-secondary', type: 'custom' },
  { id: 'trip', label: 'Modo Viagem', mode: 'trip' as const, target: 0, startSpeed: 0, description: 'Média de viagem e análise de percurso', icon: MapIcon, color: 'from-blue-600 to-indigo-600', type: 'manual' },
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
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Distância (metros)</label>
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
}

function TimerClassic(props: TimerProps) {
  const {
    user, isGuest, userProfile, activeConfig, isRunning, isWaiting, isReady,
    lastResult, activeChallenge, currentSpeed, elapsedTime, distance, progress,
    gForce, gpsStatus, accuracy, vehicles, runVehicleId, isQuickSwitchOpen,
    useRollout, error, setIsQuickSwitchOpen, setRunVehicleId, setUseRollout,
    reset, handleBack, handleStart, manualStart, manualStop, handleDuel,
    requestPermission, setScreen, handleAcceptChallenge
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
                      {vehicles.find(v => v.id === runVehicleId)?.nickname || 'Anônimo'}
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
                <span className="block text-zinc-600 text-[9px] uppercase font-bold mb-0.5">Distância</span>
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
              <span>{activeConfig?.mode === 'speed' ? `Alcançando ${activeConfig.target} km/h` : `Percorrendo ${activeConfig?.target}m`}</span>
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
                        ? (isReady ? 'PRONTO PARA ACELERAR' : 'ACELERE ATÉ 100KM/H')
                        : (isReady ? 'SINAL VERDE: ARRANQUE!' : 'PARE O VEÍCULO')}
                </h3>
                <p className="text-zinc-500 text-[10px] font-medium mb-4">
                  {activeConfig?.mode === 'free'
                    ? 'Inicie a puxada manualmente quando desejar.'
                    : activeConfig?.mode === 'trip'
                      ? 'Inicie a viagem para monitorar sua performance.'
                      : activeConfig?.id === '100-200' 
                        ? `Aguardando atingir ${activeConfig.startSpeed} km/h...` 
                        : (isReady ? 'O cronômetro iniciará ao detectar movimento.' : 'O teste só começa com o carro totalmente parado.')}
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
                
                <h3 className="text-brand-accent font-black uppercase tracking-tighter text-xl italic mb-4">RESULTADO</h3>
                
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
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Distância Total</span>
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
                    <span className="text-[7px] text-zinc-700 font-black uppercase tracking-widest">Ghost Mode</span>
                  </div>
                  <div className="text-center px-1">
                    <p className="text-[10px] font-black text-white uppercase italic">Anônimo</p>
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
    requestPermission, setScreen, handleAcceptChallenge
  } = props;

  return (
    <motion.div 
      key="timer-elite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-[#050505] relative overflow-hidden"
    >
      {/* Real Racing Texture Background */}
      <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0)', backgroundSize: '3px 3px' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Elite Header */}
      <header className="p-6 flex items-center justify-between z-20 relative">
        <button onClick={handleBack} className="p-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 text-white shadow-xl active:scale-95 transition-all">
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div className="flex flex-col items-end">
           <h2 className="text-3xl font-display font-black italic tracking-tighter leading-none">
             <span className="text-white">DRAG</span>
             <span className="text-red-600">FIRE</span>
           </h2>
           <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em]">{activeConfig?.label}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${gpsStatus === 'active' ? 'bg-cyan-400 glow-cyan animate-pulse' : 'bg-zinc-700'}`} />
           </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 z-10 relative">
        {error && (
          <div className="mb-4 bg-red-500/20 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3 backdrop-blur-md">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-[10px] font-black uppercase text-red-200">{error}</p>
          </div>
        )}

        {/* Dynamic Speedometer Layout */}
        {!lastResult ? (
          <div className="flex-1 flex flex-col items-center justify-start pt-12 py-6 relative">
             <div className="relative w-full flex flex-col items-center justify-center mb-10 px-4">
                {/* Modern Arch Speedometer (Porsche/Audi Style) - EXPANDED TO FULL WIDTH */}
                <svg className="absolute inset-0 w-full h-[120%] transform -top-10" viewBox="0 0 100 80">
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                  
                  {/* Background Arch (Track) */}
                  <path 
                    d="M 15 65 A 40 40 0 1 1 85 65" 
                    className="stroke-zinc-900 fill-none" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    strokeDasharray="1 3"
                  />
                  
                  {/* Progress Arch - THICKER AND LARGER */}
                  <motion.path 
                    d="M 15 65 A 40 40 0 1 1 85 65" 
                    className="fill-none" 
                    stroke="url(#gaugeGradient)"
                    strokeWidth="8" 
                    strokeLinecap="round"
                    strokeDasharray="150"
                    strokeDashoffset={150 - (Math.min(currentSpeed, 260) / 260) * 150}
                    initial={{ strokeDashoffset: 150 }}
                    animate={{ strokeDashoffset: 150 - (Math.min(currentSpeed, 260) / 260) * 150 }}
                  />

                  {/* Sharp Ticks */}
                  {[...Array(11)].map((_, i) => {
                    const angle = -215 + i * 25;
                    const x1 = 50 + 36 * Math.cos(angle * Math.PI / 180);
                    const y1 = 45 + 36 * Math.sin(angle * Math.PI / 180);
                    const x2 = 50 + 44 * Math.cos(angle * Math.PI / 180);
                    const y2 = 45 + 44 * Math.sin(angle * Math.PI / 180);
                    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-zinc-800" strokeWidth="0.5" />;
                  })}
                </svg>

                {/* Digital Speed View */}
                <div className="flex flex-col items-center justify-center z-10 pt-4">
                   <div className="flex flex-col items-center">
                      <motion.span 
                        className={`text-[130px] font-display font-black italic tracking-tighter leading-none ${isRunning ? 'text-white' : 'text-zinc-700'}`}
                        animate={{ scale: isRunning ? [1, 1.01, 1] : 1 }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                         <SmoothCounter value={currentSpeed} />
                      </motion.span>
                      <div className="flex flex-col items-center gap-1 -mt-2">
                         <span className="text-[14px] font-black text-zinc-500 uppercase tracking-[0.6em] italic">KM/H</span>
                         {isRunning && (
                            <div className="px-3 py-1 bg-red-600 border border-red-500 rounded italic text-[14px] font-black text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                               {gForce.toFixed(2)}G
                            </div>
                         )}
                      </div>
                   </div>
                </div>

                {/* Progress Elite Bar - FIXED BELOW SPEEDOMETER */}
                {(isRunning || isWaiting) && activeConfig?.mode !== 'free' && (
                  <div className="w-full max-w-[280px] mt-8 z-20">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{activeConfig?.label}</span>
                        <span className="text-xl font-display font-black text-white italic">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          className="h-full bg-brand-primary shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                  </div>
                )}

                {/* Floating Vehicle Info - Far Left */}
                <div className="absolute -top-10 left-0 flex items-center gap-4 bg-zinc-900/40 backdrop-blur-md px-4 py-2 rounded-3xl border border-white/5">
                   <button 
                     onClick={() => !isRunning && setIsQuickSwitchOpen(true)}
                     className="w-14 h-14 rounded-2xl bg-zinc-950 border border-white/10 p-0.5 flex items-center justify-center overflow-hidden active:scale-95 transition-all shadow-xl"
                   >
                     {(() => {
                        const v = vehicles.find(veh => veh.id === runVehicleId);
                        if (v?.photoURL) return <img src={v.photoURL} className="w-full h-full object-cover rounded-xl" />;
                        return v?.type === 'car' ? <Car className="w-6 h-6 text-zinc-600" /> : <Navigation className="w-6 h-6 text-zinc-600 -rotate-90" />;
                     })()}
                   </button>
                   <div className="flex flex-col">
                      <span className="text-[12px] font-black text-white italic uppercase tracking-tighter">
                        {vehicles.find(v => v.id === runVehicleId)?.nickname || 'Piloto'}
                      </span>
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none">
                        {vehicles.find(v => v.id === runVehicleId)?.brand} {vehicles.find(v => v.id === runVehicleId)?.model}
                      </span>
                   </div>
                </div>

                {/* Accuracy Widget - Center Top */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-full max-w-[140px] z-30">
                   <div className="px-3 py-2 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center justify-center gap-3 shadow-2xl">
                      <div className={`p-1.5 rounded-lg ${gpsStatus === 'active' ? 'bg-cyan-500/20 text-cyan-400 glow-cyan' : 'bg-zinc-800 text-zinc-600'}`}>
                         <Signal className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-center">
                         <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest block">Precisão</span>
                         <span className={`text-[10px] font-black italic tracking-tighter ${gpsStatus === 'active' ? 'text-white' : 'text-zinc-600'}`}>
                           {accuracy ? `${accuracy.toFixed(1)}m` : '---'}
                         </span>
                      </div>
                   </div>
                </div>

                {/* Time Widget - Repositioned to Right */}
                <div className="absolute top-0 right-0 flex flex-col gap-3">
                   <div className="p-4 px-6 bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-[32px] flex flex-col items-end shadow-lg">
                      <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Time Elapsed</span>
                      <span className="text-3xl font-display font-black text-white italic leading-none">{elapsedTime.toFixed(2)}<span className="text-[10px] ml-0.5">s</span></span>
                   </div>
                </div>
             </div>
{/* Stop Button in Racing Aesthetic */}
             {((activeConfig?.mode === 'free' || activeConfig?.mode === 'trip') && isRunning) && (
               <motion.button
                 initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                 onClick={manualStop}
                 className="mt-12 px-12 py-5 bg-gradient-to-r from-red-600 to-red-800 text-white font-black italic uppercase tracking-[0.2em] rounded-full shadow-[0_15px_40px_rgba(185,28,28,0.4)] border-t border-white/20 active:scale-95 transition-all text-xs"
               >
                 ABORTAR PROVA
               </motion.button>
             )}
          </div>
        ) : (
          /* Racing Results Screen (Elite) - RESTRUCTURED & SCROLLABLE */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex-1 overflow-y-auto racing-scroll px-2 pb-32"
          >
             <div className="relative p-6 rounded-[40px] bg-gradient-to-br from-brand-primary/15 via-zinc-900/60 to-zinc-950 border border-white/5 overflow-hidden mb-6">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-primary/10 rounded-full blur-[80px]" />
                
                <header className="flex justify-between items-start mb-10">
                   <div>
                      <h3 className="text-3xl font-display font-black italic text-white leading-none tracking-tighter uppercase">STAGE <span className="text-brand-primary">HOMOLOGADO</span></h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em] mt-2 italic">Aferição Validada via Satélite</p>
                   </div>
                   <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                      <Flag className="w-6 h-6 text-brand-primary" />
                   </div>
                </header>

                {/* Main Metrics Card - No Overlap */}
                <div className="space-y-8 mb-10 px-2">
                   <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cronômetro Final</span>
                      <p className="text-7xl font-display font-black text-white italic leading-none drop-shadow-2xl">
                        {lastResult.time.toFixed(2)}<span className="text-2xl ml-1">S</span>
                      </p>
                   </div>
                   <div className="flex flex-col gap-2 border-t border-white/5 pt-6">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Velocidade Máxima (Real)</span>
                      <p className="text-5xl font-display font-black text-brand-accent italic leading-none underline decoration-brand-accent/30">
                        {Math.round(lastResult.maxSpeed)} <span className="text-xl ml-1">KM/H</span>
                      </p>
                   </div>
                </div>

                {/* Top Partials Card - Featured in first view */}
                <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                   <div className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block">Top Parciais (Intervalos)</span>
                   </div>
                   <div className="grid grid-cols-1 gap-3">
                      {calculateIntervals(lastResult.path, [20, 60, 100, 160]).map(interval => (
                        <div key={interval.target} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 group">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">0-{interval.target} KM/H</span>
                          <span className="text-xl font-display font-black text-white italic group-hover:text-brand-primary transition-colors">{interval.time.toFixed(2)}s</span>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             {/* Part 2: Performance Chart - Dedicated Section */}
             <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 px-2">
                   <div className="w-1 h-3 bg-brand-primary rounded-full" />
                   <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Curva de Aceleração G / Velocitometria</h4>
                </div>
                <div className="h-56 rounded-[32px] overflow-hidden border border-white/5 bg-zinc-900/30 p-2">
                   <PerformanceChart result={lastResult} opponentResult={activeChallenge?.result} isPremium={userProfile?.isPremium} />
                </div>
             </div>

             {/* Part 3: Secondary Telemetry */}
             <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-5 bg-zinc-900 border border-white/5 rounded-[32px] space-y-3">
                   <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block border-b border-white/5 pb-2">Telemetria G</span>
                   <div className="space-y-4 pt-2">
                      <div>
                         <span className="text-[9px] text-zinc-500 uppercase font-black">Max Traction</span>
                         <p className="text-2xl font-display font-black text-cyan-400 italic leading-none mt-1">{lastResult.maxG?.toFixed(2)}<span className="text-sm ml-0.5">G</span></p>
                      </div>
                   </div>
                </div>
                <div className="p-5 bg-zinc-900 border border-white/5 rounded-[32px] space-y-3">
                   <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block border-b border-white/5 pb-2">Ambiente</span>
                   <div className="space-y-4 pt-2">
                      <div>
                         <span className="text-[9px] text-zinc-500 uppercase font-black">Dens. Altitude</span>
                         <p className="text-2xl font-display font-black text-white italic leading-none mt-1">{lastResult.da || 0} <span className="text-sm ml-0.5">ft</span></p>
                      </div>
                   </div>
                </div>
             </div>

          </motion.div>
        )}

        {/* Start Logic (Elite) */}
        {!isRunning && !lastResult && (
           <div className="w-full space-y-4">
              <AnimatePresence mode="wait">
                 {isWaiting ? (
                   <motion.div 
                     key="elite-waiting"
                     initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                     className={`p-6 rounded-[32px] border flex flex-col items-center gap-4 text-center backdrop-blur-xl ${isReady ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_40px_rgba(6,182,212,0.1)]' : 'bg-red-500/10 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.1)]'}`}
                   >
                     <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isReady ? 'bg-cyan-500 text-white glow-cyan' : 'bg-red-500 text-white glow-red animate-pulse'}`}>
                        {isReady ? <Play className="w-8 h-8 fill-current" /> : <Clock className="w-8 h-8" />}
                     </div>
                     <div>
                        <h4 className={`text-xl font-display font-black italic uppercase tracking-tighter ${isReady ? 'text-cyan-400' : 'text-red-500'}`}>
                           {isReady ? 'PRONTO PARA PARTIDA' : 'SISTEMA EM ESPERA'}
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">
                           {isReady ? 'O sensor detectará o primeiro movimento.' : 'Aguardando o veículo parar totalmente...'}
                        </p>
                     </div>
                     
                     {(activeConfig?.mode === 'free' || activeConfig?.mode === 'trip') && (
                       <button onClick={manualStart} className="w-full py-4 bg-white text-black font-black uppercase italic rounded-2xl">LARGAR AGORA</button>
                     )}
                   </motion.div>
                 ) : (
                   <motion.div 
                     key="elite-setup"
                     className="p-8 bg-white/5 backdrop-blur-xl border border-white/5 rounded-[40px] text-center space-y-6"
                   >
                     <div className="space-y-1">
                        <h3 className="text-xl font-display font-black text-white italic uppercase tracking-tighter">PRONTO?</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em]">Configure e Aqueça os Pneus</p>
                     </div>
                     
                     {activeConfig?.type === 'standing' && (
                        <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-2xl border border-white/5">
                           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Rollout Control (30cm)</span>
                           <button 
                             onClick={() => setUseRollout(!useRollout)}
                             className={`w-12 h-6 rounded-full relative transition-colors ${useRollout ? 'bg-brand-primary glow-red' : 'bg-zinc-800'}`}
                           >
                             <motion.div animate={{ x: useRollout ? 24 : 0 }} className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
                           </button>
                        </div>
                     )}

                     <button 
                       onClick={handleStart}
                       className="w-full py-5 bg-brand-primary text-white font-display font-black text-2xl italic tracking-widest uppercase rounded-[28px] shadow-[0_15px_40px_rgba(239,68,68,0.4)] active:scale-95 transition-all"
                     >
                       INICIAR AFERIÇÃO
                     </button>
                   </motion.div>
                 )}
              </AnimatePresence>
           </div>
        )}
      </main>

      {/* Quick Switch Modal (Elite Style) */}
      <AnimatePresence>
        {isQuickSwitchOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-end justify-center p-4 overflow-hidden"
            onClick={() => setIsQuickSwitchOpen(false)}
          >
             {/* Background glow in modal */}
            <div className="absolute top-0 w-full h-1 bg-brand-primary glow-red" />

            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="w-full max-w-md bg-[#0a0a0a] border-t border-white/5 rounded-t-[50px] p-10 space-y-8"
              onClick={e => e.stopPropagation()}
            >
              <header className="flex justify-between items-center border-b border-white/5 pb-6">
                <div>
                   <h3 className="text-2xl font-display font-black italic text-white uppercase tracking-tighter">GARAGEM <span className="text-brand-primary">ELITE</span></h3>
                   <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mt-1">Selecionar Veículo para Prova</p>
                </div>
                <button onClick={() => setIsQuickSwitchOpen(false)} className="p-3 bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </header>

              <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 racing-scroll">
                <button onClick={() => { setRunVehicleId('anonimo'); setIsQuickSwitchOpen(false); }} className={`flex flex-col gap-3 p-4 rounded-[32px] border transition-all ${runVehicleId === 'anonimo' ? 'bg-white/5 border-brand-primary shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-zinc-950 shadow-none border-white/5'}`}>
                  <div className="aspect-square w-full rounded-2xl bg-zinc-900 flex flex-col items-center justify-center border border-white/5 gap-2">
                    <EyeOff className="w-8 h-8 text-zinc-700" />
                    <span className="text-[8px] text-zinc-700 font-black uppercase tracking-[0.2em]">Ghost Mode</span>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-white uppercase italic tracking-tighter">Anônimo</p>
                  </div>
                </button>
                {vehicles.map(v => (
                  <button key={v.id} onClick={() => { setRunVehicleId(v.id || ''); setIsQuickSwitchOpen(false); }} className={`flex flex-col gap-3 p-4 rounded-[32px] border transition-all ${runVehicleId === v.id ? 'bg-white/5 border-brand-primary shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-zinc-950 border-white/5 shadow-none'}`}>
                    <div className="aspect-square w-full rounded-2xl bg-zinc-900 overflow-hidden border border-white/5">
                      {v.photoURL ? <img src={v.photoURL} className="w-full h-full object-cover" /> : (v.type === 'car' ? <Car className="w-10 h-10 text-zinc-800 m-auto mt-4" /> : <Navigation className="w-10 h-10 text-zinc-800 -rotate-90 m-auto mt-4" />)}
                    </div>
                    <div className="text-center space-y-0.5">
                      <p className="text-[10px] font-black text-white uppercase italic truncate">{v.nickname}</p>
                      <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest truncate">{v.brand}</p>
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
    currentHeading
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
          // Volta para a tela inicial em vez de fechar o app
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
    upcomingNodes, 
    isRouteMode, 
    currentRoadName 
  } = useCorneringAssistant(
    currentLat, 
    currentLng, 
    currentHeading, 
    currentSpeed, 
    user?.uid,
    isGuest,
    { baseDist: telemetryConfig.lookAheadBaseDistance || 500 },
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
                  createdAt: new Date().toISOString()
                };
                await setDoc(userRef, userData);
                // Store email privately
                await setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'data'), {
                  email: firebaseUser.email
                });
                setScreen('terms');
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
      // console.warn('Atenção: O processo não respondeu em 10 segundos.');
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
      alert("Como Visitante, seus dados não são salvos na nuvem. Crie uma conta ou faça login com Google para salvar seus veículos e tempos permanentemente!");
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
            
            let estimatedPowerCV = 0;
            if (isUserPremium && lastResult.time > 0) {
              const weightForEstimation = activeVehicle?.weight || 1500;
              // Basic physics estimation with current test data
              estimatedPowerCV = powerService.estimateHorsepower(lastResult, weightForEstimation, []);
            }

            const selectedVehicle = activeVehicle;

            const runData = { 
              ...lastResult, 
              uid: user.uid,
              vehicleId: selectedVehicle?.id || null,
              vehicleName: selectedVehicle ? `${selectedVehicle.nickname} (${selectedVehicle.model})` : 'Piloto Anônimo',
              estimatedPowerCV
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
            
            console.log("Run saved to Firestore successfully");
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'runs');
          }
        };
        
        saveRun();

        // Save to rankings if it's a valid standard run
        const isStandard0to100 = lastResult.config.mode === 'speed' && lastResult.config.target === 100;
        const isStandard201m = lastResult.config.mode === 'distance' && lastResult.config.target === 201;

        if (
          (isStandard0to100 || isStandard201m) && 
          lastResult.isValidSlope && 
          lastResult.location &&
          (lastResult.avgAccuracy ?? 100) < 18 && // Relaxed slightly for more inclusion
          (lastResult.maxG ?? 0) < 3.8 &&
          lastResult.time > 1.2
        ) {
            const selectedVehicle = runVehicleId === 'anonimo' ? null : (vehicles.find(v => v.id === runVehicleId) || vehicle);

            const rankingData: Omit<RankingEntry, 'id'> = {
              uid: user.uid,
              userName: user.displayName || 'Piloto',
              userPhoto: user.photoURL || undefined,
              vehicleName: selectedVehicle ? `${selectedVehicle.nickname} (${selectedVehicle.model})` : 'Veículo não vinculado',
              vehicleType: selectedVehicle?.type || 'car',
              time: lastResult.time,
              maxSpeed: lastResult.maxSpeed,
              timestamp: lastResult.timestamp,
              category: isStandard0to100 ? '0-100' : '201m',
              latitude: lastResult.location.latitude,
              longitude: lastResult.location.longitude,
              slope: lastResult.slope || 0,
              vehicleId: selectedVehicle?.id || undefined
            };
          addDoc(collection(db, 'rankings'), rankingData)
            .catch(err => handleFirestoreError(err, OperationType.WRITE, 'rankings'));
        }
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

      setActiveConfig(preset);
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
              className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black relative overflow-hidden"
            >
              {/* Animated Background Glows */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] aspect-square bg-brand-primary/5 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-[50%] aspect-square bg-brand-primary/10 blur-[100px] rounded-full pointer-events-none" />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="mb-16 relative z-10 flex flex-col items-center"
              >
                <DragFireLogo size="large" className="mb-8" />
                <h2 className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">AFERIÇÃO DE PERFORMACE</h2>
              </motion.div>

              <div className="w-full max-w-xs space-y-4 relative z-10">
                <button 
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-2xl font-black italic text-lg transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                >
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
                  className="w-full py-3 bg-zinc-950 text-white/40 hover:text-white rounded-2xl font-bold text-sm border border-white/5 transition-all active:scale-95"
                >
                  ENTRAR COMO VISITANTE
                </button>
              </div>

              <div className="absolute bottom-10 left-0 right-0 px-8 opacity-20 z-10">
                <p className="text-[8px] font-black tracking-[0.5em] text-white/50 mb-1">DESIGNED FOR SPEED</p>
                <p className="text-[10px] font-mono text-white/50">v{APP_VERSION}-ELITE</p>
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
              isPremium={isUserPremium}
              userId={user?.uid || ''}
              editingVehicle={editingVehicle}
              setEditingVehicle={setEditingVehicle}
              onSave={saveVehicle} 
              onDelete={deleteVehicle}
              onBack={() => setScreen('settings')} 
              setScreen={setScreen}
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
        ) : screen === 'search' ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <SearchUsers 
              currentUserId={user?.uid}
              onViewProfile={(uid) => {
                setSelectedProfileUid(uid);
                setScreen('public-profile');
              }}
            />
          </motion.div>
        ) : screen === 'feed' ? (
          <motion.div
            key="feed"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <Feed />
          </motion.div>
        ) : screen === 'public-profile' ? (
          <motion.div
            key="public-profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <PublicProfile 
              uid={selectedProfileUid || ''} 
              currentUserId={user?.uid}
              onBack={() => setScreen(history.length > 0 ? 'history' : 'home')} 
              onEditVehicles={() => setScreen('vehicle-settings')}
              onOpenStore={() => setScreen('theme-store')}
              onViewVehicle={(v) => {
                setCatalogVehicle(v);
                setScreen('vehicle-catalog');
              }}
              isAdmin={isAdmin}
            />
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
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 whitespace-nowrap overflow-visible flex items-center gap-1.5">
                  {isGuest ? 'Modo Visitante' : (
                    <>
                      {vehicle ? `${vehicle.nickname} • ${vehicle.model}` : user?.displayName || 'Piloto'}
                      {userProfile?.handle && <span className="text-brand-primary italic">#{userProfile.handle}</span>}
                    </>
                  )}
                </p>
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
            <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
              {/* 1. Main Features Grid (2x2) */}
              <section className="grid grid-cols-2 gap-3">
                {/* 1.1 AI Photo Editor */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('ai-editor')}
                  className="relative group h-40 bg-zinc-900 rounded-[24px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-brand-primary/40 shadow-xl"
                >
                  <img src="/assets/ai_editor_banner.png" alt="IA" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Sparkles className="w-7 h-7 text-brand-primary animate-pulse" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-brand-primary/20 backdrop-blur-md rounded border border-brand-primary/30 text-[7px] font-black text-brand-primary uppercase tracking-widest mb-1.5 inline-block">Mágica</span>
                    <h4 className="text-sm font-display font-black italic text-white leading-tight uppercase tracking-tighter">Editor <span className="text-brand-primary font-bold">IA</span></h4>
                  </div>
                </motion.div>

                {/* 1.2 Assistente de Curvas */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('cornering-assistant')}
                  className="relative group h-40 bg-zinc-900 rounded-[24px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-brand-primary/40 shadow-xl"
                >
                  <img src="/assets/cornering_banner.png" alt="Curves" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Navigation className="w-7 h-7 text-brand-primary animate-pulse -rotate-90" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-brand-primary/20 backdrop-blur-md rounded border border-brand-primary/30 text-[7px] font-black text-brand-primary uppercase tracking-widest mb-1.5 inline-block">Pro HUD</span>
                    <h4 className="text-sm font-display font-black italic text-white leading-tight uppercase tracking-tighter">Assistente <span className="text-brand-primary font-bold">Curvas</span></h4>
                  </div>
                </motion.div>

                {/* 1.3 Teste Performance */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPerformanceMenu(true)}
                  className="relative group h-40 bg-zinc-900 rounded-[24px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-brand-primary/40 shadow-xl"
                >
                  <img src="/assets/performance_banner.png" alt="Performance" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Timer className="w-7 h-7 text-brand-primary animate-pulse" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-brand-primary/20 backdrop-blur-md rounded border border-brand-primary/30 text-[7px] font-black text-brand-primary uppercase tracking-widest mb-1.5 inline-block">Telemetria</span>
                    <h4 className="text-sm font-display font-black italic text-white leading-tight uppercase tracking-tighter">Teste <span className="text-brand-primary font-bold">Performance</span></h4>
                  </div>
                </motion.div>

                {/* 1.4 Postos e Preços */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('fuel-stations')}
                  className="relative group h-40 bg-zinc-900 rounded-[24px] border border-white/5 cursor-pointer overflow-hidden transition-all hover:border-brand-accent/40 shadow-xl"
                >
                  <img src="/assets/posto_banner.png" alt="Postos" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute top-3 right-3"><Fuel className="w-7 h-7 text-brand-accent animate-pulse" /></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="px-1.5 py-0.5 bg-brand-accent/20 backdrop-blur-md rounded border border-brand-accent/30 text-[7px] font-black text-brand-accent uppercase tracking-widest mb-1.5 inline-block">Economia</span>
                    <h4 className="text-sm font-display font-black italic text-white leading-tight uppercase tracking-tighter">Postos <span className="text-brand-accent font-bold">Elite</span></h4>
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
                      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110]"
                    />
                    <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-zinc-950 rounded-t-[40px] border-t border-white/10 p-8 z-[120] pb-12 overflow-y-auto"
                    >
                      <div className="w-12 h-1.5 bg-zinc-900 rounded-full mx-auto mb-8" />
                      
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h4 className="text-2xl font-display font-black italic text-white uppercase tracking-tighter leading-tight">Testes de Performance</h4>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Escolha sua modalidade abaixo</p>
                        </div>
                        <button onClick={() => setShowPerformanceMenu(false)} className="p-3 bg-zinc-900 rounded-2xl text-zinc-500">
                          <Plus className="w-6 h-6 rotate-45" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {PRESETS.map((preset) => (
                          <motion.button
                            key={preset.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => {
                              handleSelectPreset(preset as any);
                              setShowPerformanceMenu(false);
                            }}
                            className="group flex items-center gap-4 p-4 bg-zinc-900 rounded-2xl border border-white/5 hover:border-brand-primary/30 transition-all text-left"
                          >
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${preset.color} flex items-center justify-center shrink-0 shadow-lg`}>
                              <preset.icon className="w-6 h-6 text-white" />
                            </div>
                            
                            <div className="flex-1">
                              <h5 className="text-base font-display font-black italic text-white leading-tight uppercase tracking-tight">{preset.label}</h5>
                              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{preset.description}</p>
                            </div>
                            
                            <div className="p-2 bg-zinc-950 rounded-lg text-zinc-700 group-hover:text-brand-primary transition-colors">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </motion.button>
                        ))}
                      </div>

                      <button 
                        onClick={() => setShowPerformanceMenu(false)}
                        className="w-full mt-8 py-4 bg-zinc-900 text-zinc-600 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                      >
                        FECHAR MENU
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

              {/* 6. GPS Guide */}
              <section 
                onClick={() => setScreen('gps-guide')}
                className="bg-zinc-900/30 rounded-2xl p-4 border border-white/5 cursor-pointer hover:bg-zinc-900/50 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <Signal className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white">Guia de Precisão</h4>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Como melhorar o sinal GPS</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-700" />
                </div>
              </section>
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
              upcomingNodes={upcomingNodes}
              currentLat={currentLat}
              currentLng={currentLng}
              currentHeading={currentHeading}
              speedKmh={currentSpeed}
              lookAheadDistance={telemetryConfig.lookAheadBaseDistance || 500}
              destination={destination}
              setDestination={setDestination}
              isRouteMode={isRouteMode}
              onBack={() => setScreen('home')}
              currentRoadName={currentRoadName}
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
            <AIPhotoEditor onBack={() => setScreen('home')} />
          </motion.div>
        ) : screen === 'fuel-stations' ? (
          <motion.div
            key="fuel-stations"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <GasStations onBack={() => setScreen('home')} />
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
                runVehicleId={runVehicleId}
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
                runVehicleId={runVehicleId}
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
                <h4 className="text-white font-black italic uppercase tracking-widest text-sm">Dica de Precisão</h4>
                <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                  Para melhores resultados, <span className="text-white font-bold">fixe o celular no suporte do veículo</span>. Evite segurar o aparelho na mão.
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
      </div>
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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [uid]);

  if (loading) return <div className="flex-1 flex items-center justify-center bg-zinc-950"><div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!profile) return <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 p-8 text-center"><p>Ops! Perfil não encontrado.</p><button onClick={onBack} className="mt-4 text-brand-primary font-bold uppercase tracking-widest text-[10px]">Voltar</button></div>;

  const theme = getThemeById(profile.activeThemeId || 'default');
  const isOwner = uid === currentUserId;

  return (
    <div className={`flex-1 flex flex-col overflow-y-auto hide-scrollbar ${theme.backgroundClass} relative`}>
      {/* Neon Borders of the Pilot */}
      {profile.activeNeonColor && (
        <div className="fixed inset-0 pointer-events-none z-50">
           <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: profile.activeNeonColor, boxShadow: `0 0 20px ${profile.activeNeonColor}` }} />
           <div className="absolute right-0 top-0 bottom-0 w-1" style={{ backgroundColor: profile.activeNeonColor, boxShadow: `0 0 20px ${profile.activeNeonColor}` }} />
        </div>
      )}

      {/* Dynamic Header */}
      <div className={`relative pt-12 pb-10 px-6 border-b-2 ${theme.borderClass} ${theme.headerClass} overflow-hidden shadow-2xl`}>
         {theme.bannerUrl && (
           <img src={theme.bannerUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" />
         )}
         {/* Animated BG Accent */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" />
         
         <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            <button onClick={onBack} className="p-2.5 bg-black/40 backdrop-blur-md rounded-xl text-white/50 hover:text-white transition-all"><ChevronLeft className="w-6 h-6" /></button>
            <div className="flex items-center gap-2">
               {isOwner && (
                 <button 
                  onClick={() => setShowThemeStore(true)}
                  className="p-3 bg-brand-primary/20 border border-brand-primary/30 rounded-2xl text-brand-primary hover:bg-brand-primary hover:text-white transition-all shadow-[0_10px_25px_rgba(239,68,68,0.3)] active:scale-95"
                 >
                    <Palette className="w-6 h-6" />
                 </button>
               )}
            </div>
         </div>

         <div className="flex flex-col items-center mt-6 text-center">
            <div className={`w-32 h-32 rounded-[40px] p-1.5 border-4 ${theme.borderClass} mb-6 relative shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden scale-100 active:scale-105 transition-transform duration-500`}>
               <div className="w-full h-full rounded-[36px] overflow-hidden">
                 {profile.photoURL ? (
                   <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-4xl font-black">{profile.displayName?.[0]}</div>
                 )}
               </div>
               
               {/* Badge System: Zap for ADMIN, Brand Badge for Users */}
               {(uid === currentUserId && isAdmin) ? (
                 <div className="absolute -bottom-1 -right-1 bg-brand-primary p-2 rounded-2xl border-4 border-zinc-950 shadow-xl z-30">
                    <Zap className="w-5 h-5 text-white fill-current" />
                 </div>
               ) : profile.activeBadgeId ? (
                 <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-2xl bg-black border-4 border-zinc-950 shadow-2xl flex items-center justify-center z-30 p-1.5">
                   <img src={BADGES.find(b => b.id === profile.activeBadgeId)?.imageUrl} className="w-full h-full object-contain" />
                 </div>
               ) : profile.isPremium ? (
                 <div className="absolute -bottom-1 -right-1 bg-brand-primary p-2 rounded-2xl border-4 border-zinc-950 shadow-xl z-30">
                    <Sparkles className="w-5 h-5 text-white" />
                 </div>
               ) : null}
            </div>

            <h2 className="text-3xl font-display font-black italic text-white uppercase tracking-tighter drop-shadow-xl">{profile.displayName}</h2>
            <div className="flex items-center gap-3 mt-3 bg-black/30 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/5">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{profile.isPremium ? 'Piloto Elite' : 'Piloto Enthusiasta'}</span>
               {profile.isPremium && <div className="h-1 w-1 bg-brand-primary rounded-full shadow-[0_0_8px_#ef4444]" />}
               {profile.isPremium && <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary">Verified</span>}
            </div>
         </div>
      </div>
         {/* Stats Grid */}
         <div className="grid grid-cols-3 gap-4">
            {[ 
              { label: 'Veículos', value: vehicles.length, icon: Car, color: 'text-blue-500' },
              { label: 'DFCores', value: (profile.dfCoins || 0).toLocaleString(), icon: Trophy, color: 'text-yellow-500' },
              { label: 'Atividade', value: 'High', icon: ActivityIcon, color: 'text-brand-primary' }
            ].map((stat, i) => (
              <div key={i} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-5 rounded-[32px] flex flex-col items-center gap-2 shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                 <div className={`p-2 rounded-xl bg-white/5 ${stat.color} opacity-40 group-hover:opacity-100 transition-opacity`}>
                    <stat.icon className="w-4 h-4" />
                 </div>
                 <span className="text-xl font-display font-black italic text-white leading-none tracking-tight">{stat.value}</span>
                 <span className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em]">{stat.label}</span>
              </div>
            ))}
         </div>

         {/* Garage Section */}
         <section>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-4 bg-brand-primary rounded-full" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/50 italic">Personal Garage</h3>
              </div>
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{vehicles.length} slots</span>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
               {vehicles.map(v => (
                 <button 
                  key={v.id} 
                  onClick={() => onEditVehicle(v)}
                  className="w-full bg-zinc-900/60 backdrop-blur-xl border border-white/5 p-5 rounded-[32px] flex items-center justify-between group active:scale-[0.98] transition-all hover:bg-zinc-900 shadow-xl"
                 >
                    <div className="flex items-center gap-5">
                       <div className="w-16 h-12 bg-black rounded-2xl border border-white/5 flex items-center justify-center overflow-hidden shadow-inner group-hover:border-brand-primary/30 transition-colors">
                          <img src={v.photoURL} alt="" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                       </div>
                       <div className="text-left">
                          <h4 className="text-base font-black italic text-white uppercase tracking-tight group-hover:text-brand-primary transition-colors leading-none mb-1.5">{v.nickname || v.model}</h4>
                          <div className="flex items-center gap-1.5">
                             <BrandIcon brand={v.brand} className="w-4 h-4 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100" />
                             <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{v.brand}</span>
                          </div>
                       </div>
                    </div>
                    <div className="h-10 w-10 flex items-center justify-center bg-white/5 rounded-2xl group-hover:bg-brand-primary transition-colors">
                       <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-white" />
                    </div>
                 </button>
               ))}

               {isOwner && (
                 <button 
                  onClick={() => alert('Dica: Configure seus veículos no menu de configurações!')}
                  className="w-full py-10 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-3 text-zinc-700 hover:text-white hover:border-zinc-500 transition-all group"
                 >
                    <div className="p-3 bg-zinc-800 rounded-2xl group-hover:bg-zinc-700 transition-colors">
                       <Plus className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Manage Garage</span>
                 </button>
               )}
            </div>
         </section>

         {/* Albums Section */}
         <section className="pb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-4 bg-brand-accent rounded-full" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/50 italic">Pilot Highlights</h3>
            </div>
            <ProfileLibrary uid={uid} currentUserId={currentUserId} profile={profile} />
         </section>

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


function VehicleCatalog({ vehicle, onBack, isOwnCar, onEditVehicle }: { vehicle: Vehicle, onBack: () => void, isOwnCar: boolean, onEditVehicle: (v: Vehicle) => void }) {
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'photos' | 'results'>('stats');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const allPhotos = Array.from(new Set([
    vehicle.photoURL,
    ...(vehicle.photoURLs || [])
  ])).filter(Boolean) as string[];

  useEffect(() => {
    const fetchRuns = async () => {
      if (!vehicle.id) return;
      try {
        const q = query(
          collection(db, 'runs'),
          where('vehicleId', '==', vehicle.id),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        setRuns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RunResult)));
      } catch (e) {
        console.error("Error fetching vehicle runs:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchRuns();
  }, [vehicle.id]);

  const validatedRuns = runs.filter(r => r.isValidSlope);
  
  // Use persistent best records from vehicle doc, fallback to latest 10 runs
  const best0to100Time = vehicle.best0to100 || validatedRuns.filter(r => r.config.mode === 'speed' && r.config.target === 100).sort((a,b) => a.time - b.time)[0]?.time;
  const best201mTime = vehicle.best201m || validatedRuns.filter(r => r.config.mode === 'distance' && r.config.target === 201).sort((a,b) => a.time - b.time)[0]?.time;
  
  const maxSpeed = Math.max(...runs.map(r => r.maxSpeed), 0);
  const accelScore = best0to100Time ? Math.max(10, 100 - (best0to100Time * 5)) : 0;
  const speedScore = maxSpeed ? Math.min(100, (maxSpeed / 300) * 100) : 0;
  const handlingScore = Math.min(100, (runs[0]?.maxG || 0.8) * 80);

  const handleShareVehicle = async () => {
    const shareData = {
      title: `Confira meu ${vehicle.brand} ${vehicle.model}`,
      text: `Veja os detalhes e a performance do meu carro no DragFire!`,
      url: window.location.href
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link do veículo copiado!');
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-20 bg-[url('https://images.unsplash.com/photo-1542281286-9e0a16bb7366?q=80&w=2000')] bg-cover grayscale blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/40 to-zinc-950" />
      </div>

      <header className="px-6 py-4 flex items-center justify-between relative z-10 pt-10">
        <button onClick={onBack} className="p-2 bg-black/40 backdrop-blur-md rounded-xl text-white/50 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
           <h2 className="font-display font-black italic text-xl tracking-tighter leading-none whitespace-nowrap">
             DRAG<span className="text-brand-primary">FIRE</span>
           </h2>
           {isOwnCar && (
             <button 
               onClick={() => onEditVehicle?.(vehicle)}
               className="ml-4 p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-brand-primary hover:bg-brand-primary hover:text-white transition-all active:scale-95"
             >
               <SettingsIcon className="w-5 h-5" />
             </button>
           )}
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-20 overflow-hidden">
        {/* Top Spacer */}
        <div className="h-4" />

        {/* Vehicle Display Area */}
        <div className="flex-1 relative flex flex-col items-center justify-center px-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`w-full relative aspect-[4/3] max-h-[400px] rounded-[40px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 group bg-zinc-900 ${vehicle.catalogLayout === 'classic' ? 'mb-4' : ''}`}
          >
             <div className="relative w-full h-full">
               <AnimatePresence mode="wait">
                 <motion.img
                   key={currentPhotoIndex}
                   src={allPhotos[currentPhotoIndex] || 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?q=80&w=1200'}
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   transition={{ duration: 0.4 }}
                   className="w-full h-full object-cover transition-transform duration-1000"
                   referrerPolicy="no-referrer"
                 />
               </AnimatePresence>
               
               {allPhotos.length > 1 && (
                 <>
                   {/* Navigation Arrows */}
                   <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 z-40 pointer-events-none">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(prev => (prev - 1 + allPhotos.length) % allPhotos.length); }}
                        className="p-2 bg-black/30 backdrop-blur-md border border-white/10 rounded-full text-white/50 hover:text-white hover:bg-black/50 transition-all pointer-events-auto active:scale-90"
                      >
                         <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(prev => (prev + 1) % allPhotos.length); }}
                        className="p-2 bg-black/30 backdrop-blur-md border border-white/10 rounded-full text-white/50 hover:text-white hover:bg-black/50 transition-all pointer-events-auto active:scale-90"
                      >
                         <ChevronRight className="w-4 h-4" />
                      </button>
                   </div>

                   {/* Indicators (Dots) */}
                   <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-40">
                      {allPhotos.map((_, idx) => (
                         <div 
                           key={idx}
                           className={`h-1 rounded-full transition-all duration-300 ${idx === currentPhotoIndex ? 'w-4 bg-brand-primary' : 'w-1.5 bg-white/20'}`}
                         />
                      ))}
                   </div>
                 </>
               )}
             </div>
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
             
             {/* Premium Header Bar (Overlay mode) */}
             {(vehicle.catalogLayout === 'overlay' || !vehicle.catalogLayout) && (
               <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-xl">
                     <h2 className="font-display font-black italic text-xs tracking-tighter leading-none whitespace-nowrap">
                        DRAG<span className="text-brand-primary">FIRE</span>
                     </h2>
                     <div className="h-4 w-[1px] bg-white/10" />
                     <div className="flex items-center gap-2">
                        <BrandIcon brand={vehicle.brand} className="w-7 h-7 drop-shadow-md" />
                        <div className="flex flex-col">
                           <span className="text-xs font-black italic text-white uppercase tracking-tight leading-none">{vehicle.brand}</span>
                           <span className="text-[5px] font-bold text-white/40 uppercase tracking-[0.2em] leading-none mt-1.5">{vehicle.nickname || vehicle.model}</span>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-2">

                     <button 
                       onClick={(e) => { e.stopPropagation(); handleShareVehicle(); }}
                       className="p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl text-white hover:bg-brand-primary transition-all active:scale-90 shadow-lg"
                     >
                       <Share2Icon className="w-4 h-4" />
                     </button>
                  </div>
               </div>
             )}

             {/* Stage Badge (Bottom Right Overlay) */}
             {(vehicle.catalogLayout === 'overlay' || !vehicle.catalogLayout) && vehicle.stage?.toLowerCase() !== 'stock' && vehicle.stage?.toLowerCase() !== 'original' && (
               <div className="absolute bottom-2 right-2 z-30">
                  <div className="bg-brand-primary/90 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 flex items-center shadow-2xl">
                     <span className="text-[7px] font-black italic text-zinc-950 uppercase tracking-widest whitespace-nowrap">STAGE {vehicle.stage?.split(' ')[1] || vehicle.stage}</span>
                  </div>
               </div>
             )}
          </motion.div>

          {/* CLASSIC IDENTITY CARD */}
          {vehicle.catalogLayout === 'classic' && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full bg-zinc-900 border border-white/5 rounded-3xl p-5 relative overflow-hidden flex items-center justify-between"
            >
               <div className="absolute inset-y-0 left-0 w-1 bg-brand-primary shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-white/5">
                     <BrandIcon brand={vehicle.brand} className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                     <h1 className="text-xl font-display font-black italic text-white leading-none tracking-tighter uppercase mb-0.5">{vehicle.brand}</h1>
                     <div className="flex items-center gap-2">
                        <span className="text-brand-primary text-[8px] font-black italic uppercase tracking-widest leading-none">{vehicle.model}</span>
                        <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                        <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest leading-none">{vehicle.nickname || vehicle.model}</span>
                     </div>
                  </div>
               </div>
                  <div className="text-right flex flex-col items-end">
                     {vehicle.stage?.toLowerCase() !== 'stock' && vehicle.stage?.toLowerCase() !== 'original' && (
                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest italic mb-2 ${vehicle.stage === 'Stage Max' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' : 'bg-brand-primary text-zinc-950'}`}>
                           {vehicle.stage === 'Stage Max' ? 'Stage Max' : `Stage ${vehicle.stage?.split(' ')[1] || vehicle.stage}`}
                        </div>
                     )}
                     <button 
                       onClick={handleShareVehicle}
                       className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors"
                     >
                       <Share2Icon className="w-3.5 h-3.5" />
                     </button>
                  </div>
            </motion.div>
          )}
        </div>

        {/* REFACTORED DASHBOARD (Two Columns) */}
        <div className="px-6 py-6 pb-20 space-y-6 bg-zinc-950/90 backdrop-blur-2xl border-t border-white/5 z-30">
          <div className="grid grid-cols-2 gap-6">
             {/* LEFT COLUMN: PERFORMANCE BARS */}
             <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-1 h-3 bg-brand-primary rounded-full" />
                   <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Dinâmica</h4>
                </div>

                {/* V-MAX BAR */}
                <div className="space-y-1.5">
                   <div className="flex justify-between items-end">
                      <span className="text-[8px] font-black text-zinc-500 uppercase">Velocidade Máxima</span>
                      <span className="text-xs font-display font-black italic text-white">{maxSpeed.toFixed(0)} <span className="text-brand-accent text-[8px] ml-0.5">KM/H</span></span>
                   </div>
                   <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${speedScore}%` }}
                        className="h-full bg-brand-accent rounded-full shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                      />
                   </div>
                </div>

                {/* TORQUE BAR */}
                <div className="space-y-1.5">
                   <div className="flex justify-between items-end">
                      <span className="text-[8px] font-black text-zinc-500 uppercase">Torque Estimado</span>
                      <span className="text-xs font-display font-black italic text-white">{(vehicle.hp || 0) * 1.5 || '--'} <span className="text-orange-500 text-[8px] ml-0.5">NM</span></span>
                   </div>
                   <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        className="h-full bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                      />
                   </div>
                </div>

                <div className="space-y-1.5 pb-2">
                   <div className="flex justify-between items-end">
                      <span className="text-[8px] font-black text-zinc-500 uppercase">Força G Acúm.</span>
                      <span className="text-xs font-display font-black italic text-white">{(runs[0]?.maxG || 0.85).toFixed(2)} <span className="text-blue-500 text-[8px] ml-0.5">G</span></span>
                   </div>
                   <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${handlingScore}%` }}
                        className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                      />
                   </div>
                </div>

                {/* BEST RECORDS SECTION */}
                <div className="pt-2 border-t border-white/5 space-y-3">
                   <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-3 h-3 text-yellow-500/50" />
                      <h4 className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Melhores Recordes</h4>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-2">
                      {/* 0-100km/h Record */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col gap-1 transition-all hover:bg-white/[0.05]">
                         <div className="flex items-center gap-1.5 opacity-40">
                            <Gauge className="w-2.5 h-2.5 text-brand-primary" />
                            <span className="text-[6px] font-black text-white uppercase tracking-wider">0-100 km/h</span>
                         </div>
                         <div className="flex items-baseline gap-1">
                            <span className="text-sm font-display font-black italic text-white leading-none">{vehicle.best0to100 ? vehicle.best0to100.toFixed(2) : '--'}</span>
                            <span className="text-[8px] font-black italic text-brand-primary uppercase">s</span>
                         </div>
                      </div>

                      {/* 201m Record */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col gap-1 transition-all hover:bg-white/[0.05]">
                         <div className="flex items-center gap-1.5 opacity-40">
                            <Flag className="w-2.5 h-2.5 text-blue-500" />
                            <span className="text-[6px] font-black text-white uppercase tracking-wider">201 metros</span>
                         </div>
                         <div className="flex items-baseline gap-1">
                            <span className="text-sm font-display font-black italic text-white leading-none">{vehicle.best201m ? vehicle.best201m.toFixed(2) : '--'}</span>
                            <span className="text-[8px] font-black italic text-blue-500 uppercase">s</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* RIGHT COLUMN: PHYSICAL SPECS */}
             <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-1 h-3 bg-zinc-700 rounded-full" />
                   <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Ficha Técnica</h4>
                </div>

                {/* HP CARD */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between group hover:border-brand-primary/30 transition-colors">
                   <div className="flex flex-col">
                      <span className="text-[7px] font-black text-white/30 uppercase tracking-tighter">Potência</span>
                      <span className="text-sm font-display font-black italic text-white leading-none">{vehicle.hp || '--'} <span className="text-brand-primary text-[8px] lowercase">cv</span></span>
                   </div>
                   <Zap className="w-4 h-4 text-brand-primary/40 group-hover:text-brand-primary transition-colors" />
                </div>

                {/* WEIGHT CARD */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between group hover:border-zinc-400/30 transition-colors">
                   <div className="flex flex-col">
                      <span className="text-[7px] font-black text-white/30 uppercase tracking-tighter">Peso Total</span>
                      <span className="text-sm font-display font-black italic text-white leading-none">{vehicle.weight || '--'} <span className="text-zinc-500 text-[8px] lowercase">kg</span></span>
                   </div>
                   <Weight className="w-4 h-4 text-zinc-700 group-hover:text-white transition-colors" />
                </div>

                {/* ENGINE CARD */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col justify-center group hover:border-blue-400/30 transition-colors">
                   <span className="text-[7px] font-black text-white/30 uppercase tracking-tighter mb-1">Modelo Motor</span>
                   <span className="text-[10px] font-black italic text-white uppercase italic tracking-tighter truncate">{vehicle.engine || 'STOCK ENGINE'}</span>
                </div>
             </div>
          </div>

          <button 
            onClick={handleShareVehicle}
            className="w-full h-14 bg-gradient-to-r from-brand-primary to-red-600 text-white rounded-2xl font-black italic uppercase text-xs tracking-[0.2em] shadow-[0_10px_30px_rgba(185,28,28,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
          >
            <Share2Icon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            COMPARTILHAR GARAGEM
          </button>
        </div>
      </main>
    </div>
  );
}
