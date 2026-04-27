import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc, query, collection, where, limit, getDocs, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  ChevronLeft, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  Search, 
  User, 
  ShieldCheck,
  Radio,
  Gauge,
  Activity,
  Save,
  RotateCw,
  Anchor,
  Plus,
  Trash2,
  Navigation,
  LayoutDashboard,
  Coins,
  Settings as SettingsIcon,
  Users,
  Compass,
  Map,
  Eye,
  Info,
  Download,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, TelemetryConfig, SystemSettings, TelemetryProfile, PowerReference, RankingEntry } from '../types';
import { sensorFusion } from '../services/SensorFusionService';

export function AdminDashboard({ 
  onBack,
  onStartLiveCalibration
}: { 
  onBack: () => void,
  onStartLiveCalibration?: (data: Partial<PowerReference>) => void
}) {
  const [usageData, setUsageData] = useState<{ places: number; geocode: number } | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  
  // User management state
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userLoading, setUserLoading] = useState(false);

  // Telemetry Settings
  const [telemetrySettings, setTelemetrySettings] = useState<TelemetryConfig>({
    motionSensitivity: 1.4,
    noiseFloor: 0.05,
    maxAccelG: 2.5,
    fusionGpsWeight: 0.95,
    fusionAccelGain: 1.0,
    rotationThreshold: 60,
    mountingAxis: 'auto',
    minimapZoomMultiplier: 30000,
    curveDetectionThreshold: 15,
    curveMediumThreshold: 45,
    curveHardThreshold: 90,
    regionalCacheRadius: 7500,
    fusionAlgorithm: 'kalman',
    daCorrectionEnabled: false,
    wheelSpinDetectionEnabled: false,
    lookAheadBaseDistance: 1000,
    lookAheadSpeedFactor: 5,
    lookAheadMaxDistance: 2500,
    manualDownloadRadius: 40,
    calibrationRadius: 30000,
    smartPreloadTriggerDistance: 5000,
    smartPreloadProjectDistance: 40000
  });
  
  const [profiles, setProfiles] = useState<Record<string, TelemetryProfile>>({
    'v1.5.3-balanced': {
      id: 'v1.5.3-balanced',
      name: 'PadrÃ£o (v1.5.3)',
      isDefault: true,
      motionSensitivity: 1.4,
      noiseFloor: 0.05,
      maxAccelG: 2.5,
      fusionGpsWeight: 0.95,
      fusionAccelGain: 1.0,
      rotationThreshold: 60,
      mountingAxis: 'auto',
      minimapZoomMultiplier: 30000,
      curveDetectionThreshold: 15,
      curveMediumThreshold: 45,
      curveHardThreshold: 90,
      regionalCacheRadius: 7500,
      fusionAlgorithm: 'kalman',
      daCorrectionEnabled: false,
      wheelSpinDetectionEnabled: false,
      lookAheadBaseDistance: 1000,
      manualDownloadRadius: 40,
      calibrationRadius: 30000,
      smartPreloadTriggerDistance: 5000,
      smartPreloadProjectDistance: 40000
    }
  });
  const [activeProfileId, setActiveProfileId] = useState('v1.5.3-balanced');
  const [selectedProfileId, setSelectedProfileId] = useState('v1.5.3-balanced');
  const [saveLoading, setSaveLoading] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [showNewProfileModal, setShowNewProfileModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'settings' | 'power'>('overview');
  const [coinAmount, setCoinAmount] = useState<Record<string, number>>({});

  // Power References state
  const [powerRefs, setPowerRefs] = useState<PowerReference[]>([]);
  const [showPowerForm, setShowPowerForm] = useState(false);
  const [refFormData, setRefFormData] = useState<Partial<PowerReference>>({
    carName: '',
    weight: undefined,
    time: undefined,
    distance: 201, 
    slope: 0,
    verifiedCV: undefined
  });

  const MONTHLY_CAP = 15000;
  const SAFETY_MARGIN = 0.70;
  const LOCK_THRESHOLD = MONTHLY_CAP * SAFETY_MARGIN;

  const [stressTestData, setStressTestData] = useState<{
    peaks: { x: number, y: number, z: number },
    current: { x: number, y: number, z: number },
    vibrationRMS: number
  }>({
    peaks: { x: 0, y: 0, z: 0 },
    current: { x: 0, y: 0, z: 0 },
    vibrationRMS: 0
  });

  const [isStressTestActive, setIsStressTestActive] = useState(false);
  const vibrationBuffer = useRef<number[]>([]);

  useEffect(() => {
    if (!isStressTestActive) return;

    const unsub = sensorFusion.addListener((data) => {
      setStressTestData(prev => {
        const nx = data.accel.x;
        const ny = data.accel.y;
        const nz = data.accel.z;

        // Peak detection
        const newPeaks = {
          x: Math.max(prev.peaks.x, Math.abs(nx)),
          y: Math.max(prev.peaks.y, Math.abs(ny)),
          z: Math.max(prev.peaks.z, Math.abs(nz))
        };

        // RMS Vibration (Simple window)
        const totalMag = Math.sqrt(nx*nx + ny*ny + nz*nz);
        vibrationBuffer.current.push(totalMag);
        if (vibrationBuffer.current.length > 50) vibrationBuffer.current.shift();
        
        const sumSq = vibrationBuffer.current.reduce((acc, v) => acc + v*v, 0);
        const rms = Math.sqrt(sumSq / vibrationBuffer.current.length);

        return {
          peaks: newPeaks,
          current: { x: nx, y: ny, z: nz },
          vibrationRMS: rms
        };
      });
    });

    sensorFusion.start();
    return () => unsub();
  }, [isStressTestActive]);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const today = new Date();
        const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const docRef = doc(db, 'api_usage', monthId);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setUsageData({
            places: data.places_nearby_search || 0,
            geocode: data.geocoding_reverse || 0,
          });
        } else {
          setUsageData({ places: 0, geocode: 0 });
        }
      } catch (e) {
        console.error('Failed to load API usage', e);
      } finally {
        setApiLoading(false);
      }
    };

    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'system_config', 'settings');
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data() as SystemSettings;
          if (data.profiles) {
            setProfiles(data.profiles);
            if (data.activeProfileId && data.profiles[data.activeProfileId]) {
              setActiveProfileId(data.activeProfileId);
              setSelectedProfileId(data.activeProfileId);
              setTelemetrySettings(data.profiles[data.activeProfileId]);
            }
          } else {
            setTelemetrySettings({
               ...telemetrySettings
            });
          }
          setHasChanges(false);
        }
      } catch (e) {
        console.error('Failed to load telemetry settings', e);
      }
    };

    const fetchPowerRefs = async () => {
      try {
        const q = query(collection(db, 'power_references'), limit(50));
        const snapshot = await getDocs(q);
        const refs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PowerReference));
        setPowerRefs(refs.sort((a, b) => b.timestamp - a.timestamp));
      } catch (e) {
        console.error('Failed to load power references', e);
      }
    };

    fetchUsage();
    fetchSettings();
    fetchPowerRefs();
  }, []);

  const updateGlobalSettings = async (updatedProfiles: Record<string, TelemetryProfile>, activeId: string) => {
    setSaveLoading(true);
    try {
      const docRef = doc(db, 'system_config', 'settings');
      await setDoc(docRef, {
        activeProfileId: activeId,
        profiles: updatedProfiles
      }, { merge: true });
      alert('ConfiguraÃ§Ãµes salvas e aplicadas a todos os clientes!');
    } catch (e) {
      console.error('Failed to save settings', e);
      alert('Erro ao salvar configuraÃ§Ãµes');
    } finally {
      setSaveLoading(false);
    }
  };
  const saveChanges = async () => {
    const updatedProfiles = {
      ...profiles,
      [activeProfileId]: {
        ...profiles[activeProfileId],
        ...telemetrySettings,
        id: activeProfileId
      }
    };
    setProfiles(updatedProfiles);
    setHasChanges(false);
    await updateGlobalSettings(updatedProfiles, activeProfileId);
  };

  const activateProfile = async () => {
    // Also save current settings to this profile when activating
    const updatedProfiles = {
      ...profiles,
      [selectedProfileId]: {
        ...profiles[selectedProfileId],
        ...telemetrySettings,
        id: selectedProfileId
      }
    };
    setProfiles(updatedProfiles);
    setActiveProfileId(selectedProfileId);
    setHasChanges(false);
    await updateGlobalSettings(updatedProfiles, selectedProfileId);
  };

  const createNewProfile = async () => {
    if (!profileNameInput.trim()) return;
    
    const newId = `profile-${Date.now()}`;
    const newProfile: TelemetryProfile = {
      ...telemetrySettings,
      id: newId,
      name: profileNameInput,
      isDefault: false
    };

    const updatedProfiles = {
      ...profiles,
      [newId]: newProfile
    };

    setProfiles(updatedProfiles);
    setSelectedProfileId(newId);
    setShowNewProfileModal(false);
    setProfileNameInput('');
    await updateGlobalSettings(updatedProfiles, activeProfileId);
  };

  const deleteProfile = async (id: string) => {
    if (profiles[id].isDefault) {
      alert('O perfil padrão nÃ£o pode ser excluÃ­do.');
      return;
    }

    if (!window.confirm('Excluir este perfil de configuraÃ§Ã£o?')) return;

    const newProfiles = { ...profiles };
    delete newProfiles[id];

    let newActiveId = activeProfileId;
    if (activeProfileId === id) {
      newActiveId = 'v1.5.3-balanced';
    }
    
    let newSelectedId = selectedProfileId;
    if (selectedProfileId === id) {
      newSelectedId = 'v1.5.3-balanced';
      setTelemetrySettings(newProfiles[newSelectedId]);
    }

    setProfiles(newProfiles);
    setActiveProfileId(newActiveId);
    setSelectedProfileId(newSelectedId);
    await updateGlobalSettings(newProfiles, newActiveId);
  };

  const selectProfile = (id: string | undefined) => {
    if (!id || !profiles[id]) return;
    setSelectedProfileId(id);
    setTelemetrySettings(profiles[id]);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setUserLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const userList = snapshot.docs.map(doc => ({ 
        ...doc.data(), 
        uid: doc.id
      } as UserProfile));
      setUsers(userList);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setUserLoading(false);
    }
  };

  const togglePremium = async (targetUser: UserProfile) => {
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await setDoc(userRef, { isPremium: !targetUser.isPremium }, { merge: true });
      setUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, isPremium: !u.isPremium } : u));
    } catch (error) {
      console.error("Error toggling premium:", error);
    }
  };

  const handleAddCoins = async (targetUser: UserProfile, amount: number) => {
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const newBalance = (targetUser.dfCoins || 0) + amount;
      await setDoc(userRef, { dfCoins: newBalance }, { merge: true });
      setUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, dfCoins: newBalance } : u));
      alert(`Adicionado ${amount} DC para ${targetUser.displayName}`);
    } catch (error) {
      console.error("Error adding coins:", error);
    }
  };

  const handleSavePowerRef = async () => {
    if (!refFormData.carName || !refFormData.weight) return;
    setSaveLoading(true);
    try {
      const newId = `ref-${Date.now()}`;
      const newRef: PowerReference = {
        id: newId,
        carName: refFormData.carName!,
        weight: Number(refFormData.weight),
        time: Number(refFormData.time),
        distance: Number(refFormData.distance || 201),
        slope: Number(refFormData.slope || 0),
        verifiedCV: Number(refFormData.verifiedCV),
        timestamp: Date.now()
      };

      await setDoc(doc(db, 'power_references', newId), newRef);
      setPowerRefs([newRef, ...powerRefs]);
      setShowPowerForm(false);
      setRefFormData({ carName: '', weight: 0, time: 0, distance: 201, slope: 0, verifiedCV: 0 });
      alert('ReferÃªncia salva com sucesso!');
    } catch (e) {
      console.error('Failed to save power ref', e);
      alert('Erro ao salvar referÃªncia');
    } finally {
      setSaveLoading(false);
    }
  };

  const deletePowerRef = async (id: string) => {
    if (!window.confirm('Excluir esta referÃªncia de potÃªncia?')) return;
    try {
      await deleteDoc(doc(db, 'power_references', id));
      setPowerRefs(powerRefs.filter(r => r.id !== id));
    } catch (e) {
      console.error('Failed to delete power ref', e);
    }
  };

  const rebuildLeaderboards = async () => {
    if (!window.confirm('Deseja reconstruir os rankings Top 20 de todas as categorias do mÃªs atual? Isso lerÃ¡ todos os dados brutos e atualizarÃ¡ o "arquivo" de ranking.')) return;
    setSaveLoading(true);
    try {
      const today = new Date();
      const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      
      const categories: ('0-100' | '201m')[] = ['0-100', '201m'];
      let totalProcessed = 0;
      
      for (const cat of categories) {
        const q = query(
          collection(db, 'rankings'),
          where('category', '==', cat),
          where('timestamp', '>=', startOfMonth),
          orderBy('performanceScore', 'desc'),
          limit(20)
        );
        
        const snap = await getDocs(q);
        const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RankingEntry));
        
        const docId = `global_${cat}_${monthId}`;
        await setDoc(doc(db, 'leaderboards', docId), {
          entries,
          lastUpdated: Date.now(),
          category: cat,
          month: monthId
        }, { merge: true });
        
        totalProcessed += entries.length;
      }
      
      alert(`Rankings reconstruÃ­dos com sucesso! ${totalProcessed} entradas processadas.`);
    } catch (e: any) {
      console.error('Failed to rebuild rankings', e);
      alert('Erro ao reconstruir rankings: ' + e.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const totalUsage = usageData ? usageData.places + usageData.geocode : 0;
  const usagePercentage = Math.min((totalUsage / MONTHLY_CAP) * 100, 100);
  const lockPercentage = SAFETY_MARGIN * 100;
  const isLocked = totalUsage >= LOCK_THRESHOLD;
  const isDanger = usagePercentage >= (lockPercentage - 10);

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Admin Header */}
      <div className="p-6 pb-2 space-y-6">
        <div className="flex items-center justify-between bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400 active:scale-95 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-display font-black italic text-white leading-none uppercase tracking-tighter">ADMIN DRAGFIRE</h2>
              <p className="text-xs text-red-500 font-bold uppercase tracking-widest mt-1">Painel Gerencial</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-zinc-950 border border-white/5 rounded-full">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">v.1.9.40-ELITE</span>
          </div>
        </div>

        {/* Tab Navigation Segmented Control */}
        <div className="flex bg-zinc-900/50 p-1 rounded-[22px] border border-white/5 backdrop-blur-md">
          {[
            { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'users', label: 'UsuÃ¡rios', icon: Users },
            { id: 'settings', label: 'Aux. Curvas', icon: Navigation },
            { id: 'power', label: 'PotÃªncia', icon: Gauge },
            { id: 'sensors', label: 'Sensores', icon: Radio }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex flex-col xs:flex-row items-center justify-center gap-1 xs:gap-2 py-3 rounded-[18px] transition-all duration-300 ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="text-[7px] xs:text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 pt-2"
            >
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                  <Shield className="w-3 h-3 text-brand-primary" />
                  Monitoramento Global
                </h3>

                {apiLoading ? (
                  <div className="flex justify-center p-10">
                    <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className={`glass-panel p-6 rounded-3xl border flex flex-col gap-4 ${isLocked ? 'border-red-500 bg-red-500/10' : isDanger ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Uso Mensal API</p>
                        <div className="flex items-baseline gap-1">
                          <h4 className={`text-4xl font-display font-black italic leading-none ${isLocked ? 'text-red-500' : 'text-white'}`}>
                            {totalUsage.toLocaleString()}
                          </h4>
                          <span className="text-xs text-zinc-500 font-bold uppercase">/ {MONTHLY_CAP.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className={`p-3 rounded-2xl border ${isLocked ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-950 border-white/5'}`}>
                        {isLocked ? <Zap className="w-6 h-6 animate-pulse" /> : isDanger ? <AlertTriangle className="w-6 h-6 text-yellow-500" /> : <CheckCircle2 className="w-6 h-6 text-green-500" />}
                      </div>
                    </div>

                    <div className="space-y-2">
                       <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-white/5 relative">
                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 z-10" style={{ left: `${lockPercentage}%` }} />
                        <motion.div initial={{ width: 0 }} animate={{ width: `${usagePercentage}%` }} className={`h-full rounded-full ${isLocked ? 'bg-red-600' : isDanger ? 'bg-yellow-500' : 'bg-green-500'}`} />
                      </div>
                      <p className="text-[8px] font-black uppercase text-zinc-600 text-right tracking-[0.1em]">SeguranÃ§a em 70%</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-950/50 p-4 rounded-[24px] border border-white/5 text-center">
                        <span className="text-[8px] uppercase font-black text-zinc-600 block mb-1">Places Search</span>
                        <span className="text-xl font-bold text-white">{(usageData?.places || 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-zinc-950/50 p-4 rounded-[24px] border border-white/5 text-center">
                        <span className="text-[8px] uppercase font-black text-zinc-600 block mb-1">Geocoding</span>
                        <span className="text-xl font-bold text-white">{(usageData?.geocode || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {isLocked && (
                      <div className="mt-2 text-[9px] text-white font-black uppercase border border-red-500 bg-red-600 p-4 rounded-2xl flex gap-3 shadow-lg shadow-red-600/20">
                        <Zap className="w-4 h-4 shrink-0" />
                        SISTEMA BLOQUEADO: Limite atingido.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 pt-2"
            >
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                  <User className="w-3 h-3 text-brand-primary" />
                  CRM & GestÃ£o Comercial
                </h3>

                <div className="relative group h-14">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Nome do piloto..."
                    className="w-full h-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-4 text-sm text-white focus:border-brand-primary/50 outline-none transition-all"
                  />
                  <button onClick={handleSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-primary text-white rounded-xl">
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {userLoading ? (
                    <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
                  ) : users.length > 0 ? (
                    users.map(u => (
                      <div key={u.uid} className="glass-panel border-white/5 p-5 rounded-[32px] bg-zinc-900/40 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-zinc-950 border border-white/5">
                              {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User className="w-full h-full p-4 text-white/10" />}
                            </div>
                            <div>
                              <p className="text-sm font-black text-white italic uppercase tracking-tight">{u.displayName || 'Piloto'}</p>
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">#{u.handle || 'ID DESCONHECIDO'}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => togglePremium(u)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${u.isPremium ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}
                          >
                            {u.isPremium ? 'PREMIUM Ã¢Å“â€¦' : 'ATIVAR PRO'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center"><Coins className="w-4 h-4 text-brand-primary" /></div>
                             <div>
                                <p className="text-[8px] font-black text-zinc-500 uppercase">Saldo</p>
                                <p className="text-sm font-bold text-white italic">{u.dfCoins || 0} DC</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <input 
                                type="number" placeholder="+ Moedas" value={coinAmount[u.uid] || ''}
                                onChange={(e) => setCoinAmount({ ...coinAmount, [u.uid]: Number(e.target.value) })}
                                className="w-20 bg-zinc-800 border-white/5 rounded-lg p-2 text-xs text-white text-center"
                             />
                             <button 
                                onClick={() => handleAddCoins(u, coinAmount[u.uid] || 0)}
                                className="bg-brand-primary text-white p-2 rounded-lg"
                             >
                                <Plus className="w-4 h-4" />
                             </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 p-8 border-2 border-dashed border-white/5 rounded-[40px] opacity-20">
                       <Search className="w-12 h-12 mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase">Pesquise para gerenciar pilotos</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sensors' && (
            <motion.div
              key="sensors"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pt-2"
            >
              <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black italic text-white uppercase tracking-tighter">Teste de Stress de Sensores</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">MediÃ§Ã£o de VibraÃ§Ã£o e InterferÃªncia</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (isStressTestActive) {
                        setIsStressTestActive(false);
                      } else {
                        setStressTestData({ peaks: { x: 0, y: 0, z: 0 }, current: { x: 0, y: 0, z: 0 }, vibrationRMS: 0 });
                        vibrationBuffer.current = [];
                        setIsStressTestActive(true);
                      }
                    }}
                    className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isStressTestActive ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}
                  >
                    {isStressTestActive ? 'PARAR TESTE' : 'INICIAR TESTE'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Eixo X (Lat)', val: stressTestData.current.x, peak: stressTestData.peaks.x, color: 'text-blue-400' },
                    { label: 'Eixo Y (Long)', val: stressTestData.current.y, peak: stressTestData.peaks.y, color: 'text-emerald-400' },
                    { label: 'Eixo Z (Vert)', val: stressTestData.current.z, peak: stressTestData.peaks.z, color: 'text-purple-400' }
                  ].map((axis, i) => (
                    <div key={i} className="bg-zinc-950 p-4 rounded-2xl border border-white/5 space-y-1">
                      <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{axis.label}</p>
                      <p className={`text-xl font-display font-black italic ${axis.color}`}>{axis.val.toFixed(3)}<span className="text-[10px] ml-1">G</span></p>
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-[7px] font-bold text-zinc-500 uppercase">Pico Detectado</p>
                        <p className="text-xs font-black text-white">{axis.peak.toFixed(3)}G</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Intensidade de VibraÃ§Ã£o (RMS)</p>
                    <div className="flex items-baseline gap-2">
                       <h4 className={`text-4xl font-display font-black italic ${stressTestData.vibrationRMS > 0.5 ? 'text-red-500' : 'text-white'}`}>
                        {stressTestData.vibrationRMS.toFixed(4)}
                       </h4>
                       <span className="text-xs font-bold text-zinc-500 uppercase">G-Vib</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Filtro Sugerido</p>
                    <p className="text-xs font-black text-brand-primary uppercase">
                      {stressTestData.vibrationRMS > 0.8 ? 'Noise Floor 0.15+' : stressTestData.vibrationRMS > 0.4 ? 'Noise Floor 0.08' : 'PadrÃ£o 0.05'}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex gap-4">
                  <Info className="w-5 h-5 text-blue-400 shrink-0" />
                  <p className="text-[9px] font-medium text-zinc-400 leading-relaxed uppercase">
                    Use este teste em carros com muita vibraÃ§Ã£o mecÃ¢nica ou escapamento direto. Se o RMS ficar acima de <span className="text-white">0.5000</span>, recomenda-se aumentar o <span className="text-white">Noise Floor</span> nas configuraÃ§Ãµes do Auxiliar de Curvas para evitar detecÃ§Ã£o de movimento falso.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pt-2"
            >
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                  <Navigation className="w-3 h-3 text-cyan-500" />
                  ConfiguraÃ§Ãµes Aux. Curvas
                </h3>

                <div className="glass-panel p-6 rounded-[34px] border border-white/5 bg-zinc-900/40 space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Profiles Global</label>
                    <button onClick={() => setShowNewProfileModal(true)} className="p-1.5 bg-zinc-950 border border-white/5 rounded-lg text-brand-primary"><Plus className="w-4 h-4" /></button>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {(Object.values(profiles) as TelemetryProfile[]).map((profile) => (
                      <button
                        key={profile.id} onClick={() => selectProfile(profile.id)}
                        className={`flex-shrink-0 px-4 py-3 rounded-2xl border transition-all flex flex-col gap-1 min-w-[120px] ${selectedProfileId === profile.id ? 'border-brand-primary bg-brand-primary/10' : 'bg-zinc-950/50 border-white/5'}`}
                      >
                        <span className={`text-[10px] font-black uppercase truncate ${selectedProfileId === profile.id ? 'text-white' : 'text-zinc-600'}`}>{profile.name}</span>
                        {profile.isDefault && <ShieldCheck className="w-3 h-3 text-zinc-700" />}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-8 pt-4">
                    <div className="space-y-6">
                       <h4 className="text-[8px] font-black text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                         <Zap className="w-3 h-3 text-brand-primary" /> Performance Engine (IA)
                       </h4>
                       
                       <div className="space-y-3 bg-brand-primary/5 p-4 rounded-2xl border border-brand-primary/10">
                         <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                              <Activity className="w-3 h-3 text-brand-primary" /> Algoritmo de FusÃ£o
                            </label>
                            <div className="flex bg-zinc-950 p-1 rounded-lg border border-white/5">
                              <button 
                                onClick={() => {
                                  setTelemetrySettings({...telemetrySettings, fusionAlgorithm: "linear"});
                                  setHasChanges(true);
                                }}
                                className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${telemetrySettings.fusionAlgorithm === "linear" ? "bg-zinc-800 text-white" : "text-zinc-600"}`}
                              >
                                Linear
                              </button>
                              <button 
                                onClick={() => {
                                  setTelemetrySettings({...telemetrySettings, fusionAlgorithm: "kalman"});
                                  setHasChanges(true);
                                }}
                                className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${telemetrySettings.fusionAlgorithm === "kalman" ? "bg-brand-primary text-white" : "text-zinc-600"}`}
                              >
                                Kalman
                              </button>
                            </div>
                         </div>
                         <p className="text-[8px] text-zinc-500 font-medium leading-tight mb-2">Algoritmo de processamento de dados GPS + AcelerÃ´metro. Kalman Ã© o padrão Dragy/Racebox.</p>
                         
                         <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="flex justify-between items-center">
                               <label className="text-[9px] font-bold text-zinc-400 uppercase">CorreÃ§Ã£o Sea Level (DA)</label>
                               <button 
                                 onClick={() => {
                                   setTelemetrySettings({...telemetrySettings, daCorrectionEnabled: !telemetrySettings.daCorrectionEnabled});
                                   setHasChanges(true);
                                 }}
                                 className={`w-10 h-5 rounded-full relative transition-all ${telemetrySettings.daCorrectionEnabled ? "bg-green-500" : "bg-zinc-800"}`}
                               >
                                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${telemetrySettings.daCorrectionEnabled ? "right-1" : "left-1"}`} />
                               </button>
                            </div>
                            <div className="flex justify-between items-center">
                               <label className="text-[9px] font-bold text-zinc-400 uppercase">DetecÃ§Ã£o de Destracionamento</label>
                               <button 
                                 onClick={() => {
                                   setTelemetrySettings({...telemetrySettings, wheelSpinDetectionEnabled: !telemetrySettings.wheelSpinDetectionEnabled});
                                   setHasChanges(true);
                                 }}
                                 className={`w-10 h-5 rounded-full relative transition-all ${telemetrySettings.wheelSpinDetectionEnabled ? "bg-green-500" : "bg-zinc-800"}`}
                               >
                                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${telemetrySettings.wheelSpinDetectionEnabled ? "right-1" : "left-1"}`} />
                               </button>
                            </div>
                         </div>
                       </div>
                    </div>
                    <div className="space-y-6">
                       <h4 className="text-[8px] font-black text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                         <Compass className="w-3 h-3" /> Algoritmo de IA & VisÃ£o
                       </h4>
                       
                       {[
                         { 
                           id: 'lookAheadBaseDistance', 
                           label: 'Alcance de DetecÃ§Ã£o', 
                           min: 200, max: 4000, step: 100, icon: Eye,
                           desc: 'O que faz: Controla o quÃ£o longe a IA "enxerga" na via.',
                           utility: 'Utilidade: Em altas velocidades, aumente para dar mais tempo de reaÃ§Ã£o.'
                         },
                         { 
                           id: 'curveDetectionThreshold', 
                           label: 'Sensibilidade de Curva', 
                           min: 5, max: 45, step: 1, icon: Compass,
                           desc: 'O que faz: Ã‚ngulo mÃ­nimo para considerar um trecho como curva.',
                           utility: 'Utilidade: Aumente se houver muitos alertas falsos em retas leves.'
                         },
                         { 
                           id: 'minimapZoomMultiplier', 
                           label: 'Zoom do Minimapa', 
                           min: 5000, max: 100000, step: 1000, icon: Navigation,
                           desc: 'O que faz: Escala visual do mapa no HUD.',
                           utility: 'Utilidade: Ajuste para melhor visibilidade conforme o tamanho da tela.'
                         },
                         { 
                           id: 'regionalCacheRadius', 
                           label: 'Raio de Cache do Mapa', 
                           min: 1000, max: 15000, step: 500, icon: Map,
                           desc: 'O que faz: Tamanho da Ã¡rea baixada para uso offline.',
                           utility: 'Utilidade: Valores maiores garantem funcionamento sem internet por mais tempo.'
                         },
                         { 
                           id: 'manualDownloadRadius', 
                           label: 'Download Manual (km)', 
                           min: 5, max: 100, step: 5, icon: Download,
                           desc: 'O que faz: Raio da Ã¡rea baixada manualmente.',
                           utility: 'Utilidade: 40km garante cobertura total para trajetos longos.'
                         },
                         { 
                           id: 'calibrationRadius', 
                           label: 'Raio de Calibração (m)', 
                           min: 1000, max: 60000, step: 1000, icon: ShieldAlert,
                           desc: 'O que faz: Raio inicial necessário para liberar o uso.',
                           utility: 'Utilidade: 30000m (30km) garante cobertura total inicial.'
                         },
                         { 
                           id: 'smartPreloadTriggerDistance', 
                           label: 'Gatilho de Projeção (m)', 
                           min: 500, max: 20000, step: 500, icon: Activity,
                           desc: 'O que faz: Distância percorrida para disparar o download à frente.',
                           utility: 'Utilidade: 5000m mantém o mapa atualizado com eficiência.'
                         },
                         { 
                           id: 'smartPreloadProjectDistance', 
                           label: 'Distância de Projeção (m)', 
                           min: 5000, max: 100000, step: 1000, icon: Navigation,
                           desc: 'O que faz: Quão longe a IA deve projetar e baixar o mapa.',
                           utility: 'Utilidade: 40000m (40km) é o novo padrão ultra-seguro.'
                         }
                       ].map(field => (
                         <div key={field.id} className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                           <div className="flex justify-between items-center mb-1">
                             <label className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                               <field.icon className="w-3 h-3 text-cyan-400" />
                               {field.label}
                             </label>
                             <span className="text-sm font-display font-black italic text-cyan-400">{(telemetrySettings as any)[field.id] || 0}</span>
                           </div>
                           
                           <div className="space-y-1 mb-3">
                              <p className="text-[8px] text-zinc-500 font-medium leading-tight">{field.desc}</p>
                              <p className="text-[8px] text-brand-primary/60 font-bold leading-tight uppercase italic">{field.utility}</p>
                           </div>

                           <input 
                             type="range" min={field.min} max={field.max} step={field.step} 
                             value={(telemetrySettings as any)[field.id] || 0} 
                             onChange={(e) => setTelemetrySettings({...telemetrySettings, [field.id]: Number(e.target.value)})}
                             className="w-full accent-cyan-500 h-1.5"
                           />
                         </div>
                       ))}
                    </div>

                    <div className="space-y-4 border-t border-white/5 pt-6">
                       <h4 className="text-[8px] font-black text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                         <Activity className="w-3 h-3" /> Sensores & Estabilidade
                       </h4>
                       {[
                         { id: 'motionSensitivity', label: 'Sensibilidade Largada (G)', min: 1.0, max: 2.5, step: 0.1, icon: Radio },
                         { id: 'noiseFloor', label: 'Noise Floor (RuÃ­do)', min: 0.01, max: 0.5, step: 0.01, icon: Gauge },
                         { id: 'maxAccelG', label: 'AceleraÃ§Ã£o MÃ¡xima (CAP)', min: 1.5, max: 5.0, step: 0.1, icon: Zap },
                         { id: 'fusionGpsWeight', label: 'ConfianÃ§a GPS', min: 0.5, max: 1.0, step: 0.05, icon: Activity }
                       ].map(field => (
                         <div key={field.id} className="space-y-3">
                           <div className="flex justify-between items-center">
                             <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                               <field.icon className="w-3 h-3 text-zinc-600" />
                               {field.label}
                             </label>
                             <span className="text-xs font-bold text-white">{(telemetrySettings as any)[field.id] || 0}</span>
                           </div>
                           <input 
                             type="range" min={field.min} max={field.max} step={field.step} 
                             value={(telemetrySettings as any)[field.id] || 0} 
                             onChange={(e) => setTelemetrySettings({...telemetrySettings, [field.id]: Number(e.target.value)})}
                             className="w-full accent-zinc-700 h-1"
                           />
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={rebuildLeaderboards}
                      disabled={saveLoading}
                      className="p-6 bg-zinc-900 border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3 active:scale-95 transition-all group hover:border-brand-primary/30"
                    >
                       <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <RotateCw className={`w-6 h-6 text-brand-primary ${saveLoading ? 'animate-spin' : ''}`} />
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">Reconstruir</p>
                          <p className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">Top 20 Rankings</p>
                       </div>
                    </button>

                    <div className="p-6 bg-zinc-900 border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3 opacity-50 cursor-not-allowed">
                       <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center">
                          <Anchor className="w-6 h-6 text-zinc-600" />
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">ManutenÃ§Ã£o</p>
                          <p className="text-[8px] text-zinc-700 font-bold uppercase mt-0.5">Servidor</p>
                       </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex gap-2">
                    <button onClick={saveChanges} disabled={saveLoading} className={`flex-1 py-4 border rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${hasChanges ? "bg-zinc-900 border-yellow-500/50 text-yellow-500 shadow-lg shadow-yellow-500/10" : "bg-zinc-950 border-white/5 text-zinc-500"}`}>
                      <Save className={`w-4 h-4 ${hasChanges ? "text-yellow-500" : "text-zinc-500"}`} /> {hasChanges ? "Salvar Pendentes" : "Perfil Salvo"}
                    </button>
                    {selectedProfileId !== activeProfileId && (
                      <button onClick={activateProfile} disabled={saveLoading} className="flex-1 py-4 bg-brand-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4" /> Ativar Global
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'power' && (
            <motion.div 
              key="power"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6 pt-2"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Gauge className="w-3 h-3 text-brand-primary" />
                    GestÃ£o de Calibração
                  </h3>
                  <button onClick={() => setShowPowerForm(!showPowerForm)} className="p-2 bg-zinc-900 rounded-lg text-brand-primary border border-brand-primary/20">
                    {showPowerForm ? <ChevronLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>

                {showPowerForm ? (
                  <div className="glass-panel p-6 rounded-[34px] border border-brand-primary/10 bg-brand-primary/5 space-y-4">
                    <input type="text" value={refFormData.carName} onChange={e => setRefFormData({...refFormData, carName: e.target.value})} placeholder="Modelo do Carro" className="w-full bg-zinc-950 border-white/5 rounded-xl p-4 text-sm text-white" />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" value={refFormData.weight || ''} onChange={e => setRefFormData({...refFormData, weight: Number(e.target.value)})} placeholder="Peso(kg)" className="bg-zinc-950 border-white/5 rounded-xl p-4 text-sm text-white" />
                      <input type="number" value={refFormData.verifiedCV || ''} onChange={e => setRefFormData({...refFormData, verifiedCV: Number(e.target.value)})} placeholder="CV Real" className="bg-zinc-950 border-white/5 rounded-xl p-4 text-sm text-white" />
                    </div>
                    <button onClick={handleSavePowerRef} className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black uppercase text-[10px]">Cadastrar ReferÃªncia</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {powerRefs.length > 0 ? powerRefs.map(ref => (
                      <div key={ref.id} className="glass-panel p-4 rounded-[26px] border border-white/5 bg-zinc-900/40 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black text-white italic uppercase">{ref.carName}</h4>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">MT: {ref.weight}kg Ã¢â‚¬Â¢ PW: {ref.verifiedCV} CV</p>
                        </div>
                        <button onClick={() => deletePowerRef(ref.id)} className="p-3 text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )) : (
                      <div className="p-12 border-2 border-dashed border-white/5 rounded-[40px] text-center opacity-20">Nenhuma calibraÃ§Ã£o.</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showNewProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNewProfileModal(false)} className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm glass-panel bg-zinc-900/40 p-8 rounded-[40px] border-white/5 space-y-6">
              <div className="flex items-center gap-3"><div className="p-3 bg-brand-primary/20 rounded-xl"><RotateCw className="w-5 h-5 text-brand-primary" /></div><h3 className="text-lg font-display font-black text-white italic uppercase">Novo Perfil</h3></div>
              <input type="text" autoFocus value={profileNameInput} onChange={(e) => setProfileNameInput(e.target.value)} placeholder="Nome do Ajuste..." className="w-full bg-zinc-950 border-white/5 rounded-2xl py-4 px-6 text-sm text-white" />
              <div className="flex gap-3">
                <button onClick={() => setShowNewProfileModal(false)} className="flex-1 py-4 bg-zinc-800 text-zinc-400 rounded-[20px] font-black text-[10px] uppercase">Cancelar</button>
                <button onClick={createNewProfile} className="flex-2 py-4 bg-brand-primary text-white rounded-[20px] font-black text-[10px] uppercase shadow-lg shadow-red-600/20">Salvar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}




