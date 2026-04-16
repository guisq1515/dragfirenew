import React, { useEffect, useState } from 'react';
import { doc, getDoc, query, collection, where, limit, getDocs, setDoc } from 'firebase/firestore';
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
  Anchor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, TelemetryConfig, SystemSettings, TelemetryProfile } from '../types';

export function AdminDashboard({ onBack }: { onBack: () => void }) {
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
    mountingAxis: 'auto'
  });
  
  const [profiles, setProfiles] = useState<Record<string, TelemetryProfile>>({
    'v1.5.3-balanced': {
      id: 'v1.5.3-balanced',
      name: 'Padrão (v1.5.3)',
      isDefault: true,
      motionSensitivity: 1.4,
      noiseFloor: 0.05,
      maxAccelG: 2.5,
      fusionGpsWeight: 0.95,
      fusionAccelGain: 1.0,
      rotationThreshold: 60,
      mountingAxis: 'auto'
    }
  });
  const [activeProfileId, setActiveProfileId] = useState('v1.5.3-balanced');
  const [selectedProfileId, setSelectedProfileId] = useState('v1.5.3-balanced');
  const [saveLoading, setSaveLoading] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [showNewProfileModal, setShowNewProfileModal] = useState(false);

  // Consider 15,000 requests per month as the absolute safe free-tier limit before any billing starts
  const FREE_TIER_LIMIT = 15000;

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
            // Support legacy structure
            setTelemetrySettings(snapshot.data() as TelemetryConfig);
          }
        }
      } catch (e) {
        console.error('Failed to load telemetry settings', e);
      }
    };

    fetchUsage();
    fetchSettings();
  }, []);

  const updateGlobalSettings = async (updatedProfiles: Record<string, TelemetryProfile>, activeId: string) => {
    setSaveLoading(true);
    try {
      const docRef = doc(db, 'system_config', 'settings');
      await setDoc(docRef, {
        activeProfileId: activeId,
        profiles: updatedProfiles
      }, { merge: true });
      alert('Configurações salvas e aplicadas a todos os clientes!');
    } catch (e) {
      console.error('Failed to save settings', e);
      alert('Erro ao salvar configurações');
    } finally {
      setSaveLoading(false);
    }
  };

  const saveToCurrentProfile = async () => {
    const updatedProfiles = {
      ...profiles,
      [selectedProfileId]: {
        ...profiles[selectedProfileId],
        ...telemetrySettings,
        id: selectedProfileId
      }
    };
    setProfiles(updatedProfiles);
    await updateGlobalSettings(updatedProfiles, activeProfileId);
  };

  const activateProfile = async () => {
    setActiveProfileId(selectedProfileId);
    await updateGlobalSettings(profiles, selectedProfileId);
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
    // We don't activate it globally yet, just save it
    await updateGlobalSettings(updatedProfiles, activeProfileId);
  };

  const deleteProfile = async (id: string) => {
    if (profiles[id].isDefault) {
      alert('O perfil padrão não pode ser excluído.');
      return;
    }

    if (!window.confirm('Excluir este perfil de configuração?')) return;

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

  const totalUsage = usageData ? usageData.places + usageData.geocode : 0;
  
  // Security Config (Matching googleMapsService.ts)
  const MONTHLY_CAP = 15000;
  const SAFETY_MARGIN = 0.70;
  const LOCK_THRESHOLD = MONTHLY_CAP * SAFETY_MARGIN;

  const usagePercentage = Math.min((totalUsage / MONTHLY_CAP) * 100, 100);
  const lockPercentage = SAFETY_MARGIN * 100;
  
  const isLocked = totalUsage >= LOCK_THRESHOLD;
  const isDanger = usagePercentage >= (lockPercentage - 10); // Close to lock
  const isWarning = usagePercentage >= 50;

  return (
    <div className="flex-1 flex flex-col p-6 space-y-8 overflow-y-auto bg-zinc-950 pb-24">
      <div className="flex items-center gap-4 bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg text-zinc-400 active:scale-90 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none uppercase tracking-tighter">ADMIN DRAGFIRE</h2>
          <p className="text-xs text-red-500 font-bold uppercase tracking-widest mt-1">Painel Gerencial</p>
        </div>
      </div>

      {/* API Monitoring Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
          <Shield className="w-3 h-3 text-brand-primary" />
          Monitoramento de API (Segurança & Custos)
        </h3>

        {apiLoading ? (
          <div className="flex justify-center p-10">
            <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-panel p-6 rounded-3xl border flex flex-col gap-4 ${isLocked ? 'border-red-500 bg-red-500/10' : isDanger ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1">
                  Uso Mensal ({new Date().toLocaleDateString('pt-BR', { month: 'long' })})
                </p>
                <div className="flex items-baseline gap-1">
                  <h4 className={`text-4xl font-display font-black italic leading-none ${isLocked ? 'text-red-500' : 'text-white'}`}>
                    {totalUsage.toLocaleString()}
                  </h4>
                  <span className="text-xs text-zinc-500 font-bold uppercase">/ {MONTHLY_CAP.toLocaleString()} reqs</span>
                </div>
              </div>
              <div className={`p-3 rounded-2xl border ${isLocked ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-950 border-white/5'}`}>
                {isLocked ? (
                  <Zap className="w-6 h-6 animate-pulse" />
                ) : isDanger ? (
                  <AlertTriangle className="w-6 h-6 text-yellow-500" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-zinc-600 px-1">
                <span>Progresso</span>
                <span className="text-red-500 underline">Trava de Segurança: {LOCK_THRESHOLD.toLocaleString()} (70%)</span>
              </div>
              <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-white/5 relative">
                {/* Safety Margin Indicator */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 z-10" 
                  style={{ left: `${lockPercentage}%` }}
                />
                
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercentage}%` }}
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isLocked ? 'bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 
                    isDanger ? 'bg-yellow-500' : 
                    'bg-green-500'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="bg-zinc-950/50 p-4 rounded-2xl border border-white/5">
                <span className="text-[8px] uppercase font-black text-zinc-600 block mb-1 tracking-widest">Buscas (Places)</span>
                <span className="text-lg font-bold text-white">{usageData?.places.toLocaleString()}</span>
              </div>
              <div className="bg-zinc-950/50 p-4 rounded-2xl border border-white/5">
                <span className="text-[8px] uppercase font-black text-zinc-600 block mb-1 tracking-widest">Cidades (Geocode)</span>
                <span className="text-lg font-bold text-white">{usageData?.geocode.toLocaleString()}</span>
              </div>
            </div>

            {isLocked ? (
              <div className="mt-2 text-[9px] text-white font-black uppercase border border-red-500 bg-red-600 p-4 rounded-2xl flex gap-3 shadow-lg shadow-red-600/20">
                <Zap className="w-4 h-4 shrink-0" />
                SISTEMA BLOQUEADO: Limite de segurança de 70% atingido para evitar cobranças.
              </div>
            ) : isDanger && (
              <div className="mt-2 text-[9px] text-yellow-500 font-bold uppercase border border-yellow-500/20 bg-yellow-500/10 p-4 rounded-2xl flex gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                CUIDADO: Próximo ao bloqueio automático de 70%.
              </div>
            )}

            <p className="text-[8px] text-zinc-600 text-center uppercase font-bold tracking-tighter mt-1">
              Limites Diários: Visitantes: 5 | Logados: 20 | Anti-Spam: 30s
            </p>
          </motion.div>
        )}
      </div>
      {/* Telemetry Settings Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
          <Activity className="w-3 h-3 text-brand-primary" />
          Ajustes de Telemetria (Sensores)
        </h3>

        <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-zinc-900/40 space-y-8">
          {/* Profile Management Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <RotateCw className="w-3 h-3 text-brand-primary" />
                Perfil de Configuração
              </label>
              <button 
                onClick={() => setShowNewProfileModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-950 border border-white/5 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
              >
                <Plus className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase">Novo Perfil</span>
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {Object.values(profiles).map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => selectProfile(profile.id)}
                  className={`flex-shrink-0 px-4 py-3 rounded-2xl border transition-all flex flex-col gap-1 min-w-[124px] ${
                    selectedProfileId === profile.id 
                      ? 'border-brand-primary bg-brand-primary/10' 
                      : 'bg-zinc-950/50 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className={`text-[10px] font-black uppercase tracking-tight truncate max-w-[80px] ${selectedProfileId === profile.id ? 'text-white' : 'text-zinc-600'}`}>
                      {profile.name}
                    </span>
                    {profile.isDefault && <ShieldCheck className={`w-3 h-3 ${selectedProfileId === profile.id ? 'text-white/50' : 'text-zinc-800'}`} />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activeProfileId === profile.id && (
                      <span className="text-[7px] bg-green-500 text-zinc-950 px-1 rounded font-black uppercase italic">Ativo Global</span>
                    )}
                    {profile.isDefault && (
                      <span className="text-[7px] border border-white/10 text-zinc-600 px-1 rounded font-bold uppercase tracking-tighter">Default</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button 
                  onClick={saveToCurrentProfile}
                  disabled={saveLoading}
                  className="flex-1 py-3 bg-zinc-950 border border-white/5 text-zinc-300 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-900 transition-all hover:border-white/20"
                >
                  {saveLoading ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5 text-zinc-500" />}
                  Salvar no Perfil Selecionado
                </button>
                
                {!profiles[selectedProfileId]?.isDefault && (
                  <button 
                    onClick={() => deleteProfile(selectedProfileId)}
                    className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl transition-all active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {selectedProfileId !== activeProfileId && (
                <button 
                  onClick={activateProfile}
                  disabled={saveLoading}
                  className="w-full py-3 bg-brand-primary text-white rounded-xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Tornar Ativo para Todos os Clientes
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-white/5" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Radio className="w-3 h-3 text-red-500" />
                Limite de Largada (G-Force)
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="1.0" 
                  max="2.5" 
                  step="0.05"
                  value={telemetrySettings.motionSensitivity}
                  onChange={(e) => setTelemetrySettings({...telemetrySettings, motionSensitivity: Number(e.target.value)})}
                  className="flex-1 accent-brand-primary"
                />
                <span className="text-xl font-display font-black italic text-white w-12">{telemetrySettings.motionSensitivity.toFixed(2)}G</span>
              </div>
              <p className="text-[8px] text-zinc-600 font-medium">Recomendado: 1.40G. Menos que isso pode disparar com vibração do motor.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Gauge className="w-3 h-3 text-blue-500" />
                Filtro de Ruído (m/s²)
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="0.01" 
                  max="0.5" 
                  step="0.01"
                  value={telemetrySettings.noiseFloor}
                  onChange={(e) => setTelemetrySettings({...telemetrySettings, noiseFloor: Number(e.target.value)})}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xl font-display font-black italic text-white w-12">{telemetrySettings.noiseFloor.toFixed(2)}</span>
              </div>
              <p className="text-[8px] text-zinc-600 font-medium">Ignora acelerações menores que isto. Padrão: 0.05.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3 text-yellow-500" />
                Cap de Aceleração (Max G)
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="1.5" 
                  max="5.0" 
                  step="0.1"
                  value={telemetrySettings.maxAccelG}
                  onChange={(e) => setTelemetrySettings({...telemetrySettings, maxAccelG: Number(e.target.value)})}
                  className="flex-1 accent-yellow-500"
                />
                <span className="text-xl font-display font-black italic text-white w-12">{telemetrySettings.maxAccelG.toFixed(1)}G</span>
              </div>
              <p className="text-[8px] text-zinc-600 font-medium">Limita a velocidade virtual para evitar erros. Road cars raramente passam de 2.0G.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3 h-3 text-green-500" />
                Confiança no GPS (%)
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="0.5" 
                  max="1.0" 
                  step="0.05"
                  value={telemetrySettings.fusionGpsWeight || 0.7}
                  onChange={(e) => setTelemetrySettings({...telemetrySettings, fusionGpsWeight: Number(e.target.value)})}
                  className="flex-1 accent-green-500"
                />
                <span className="text-xl font-display font-black italic text-white w-12">{((telemetrySettings.fusionGpsWeight || 0.95) * 100).toFixed(0)}%</span>
              </div>
              <p className="text-[8px] text-zinc-600 font-medium">Recomendado: 95% (v1.5.3). Estabiliza o velocímetro estilo "Waze".</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Gauge className="w-3 h-3 text-orange-500" />
                Ganho de Aceleração linear
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.1"
                  value={telemetrySettings.fusionAccelGain || 1.0}
                  onChange={(e) => setTelemetrySettings({...telemetrySettings, fusionAccelGain: Number(e.target.value)})}
                  className="flex-1 accent-orange-500"
                />
                <span className="text-xl font-display font-black italic text-white w-12">{(telemetrySettings.fusionAccelGain || 1.0).toFixed(1)}x</span>
              </div>
              <p className="text-[8px] text-zinc-600 font-medium">Multiplicador do ganho base de 20% (v1.5.3 Balanced).</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <RotateCw className="w-3 h-3 text-purple-500" />
                Trava de Rotação (Giroscópio)
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="20" 
                  max="180" 
                  step="5"
                  value={telemetrySettings.rotationThreshold || 60}
                  onChange={(e) => setTelemetrySettings({...telemetrySettings, rotationThreshold: Number(e.target.value)})}
                  className="flex-1 accent-purple-500"
                />
                <span className="text-xl font-display font-black italic text-white w-12">{telemetrySettings.rotationThreshold || 60}°/s</span>
              </div>
              <p className="text-[8px] text-zinc-600 font-medium">Para de subir velocidade se o celular girar mais que isso por segundo.</p>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Anchor className="w-3 h-3 text-brand-primary" />
                Eixo de Montagem (Smart Lock)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'auto', label: 'Inteligente' },
                  { id: 'all', label: 'Todos Eixos' },
                  { id: 'y', label: 'Vertical (Y)' },
                  { id: 'x', label: 'Horizontal (X)' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTelemetrySettings({...telemetrySettings, mountingAxis: opt.id as any})}
                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${telemetrySettings.mountingAxis === opt.id ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-red-600/20' : 'bg-zinc-950/50 border-white/5 text-zinc-500 hover:text-zinc-400'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-zinc-600 font-medium">"Inteligente" trava o eixo de maior impacto na hora da arrancada.</p>
            </div>

            <div className="bg-zinc-950/80 p-6 rounded-3xl border border-zinc-500/20 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest leading-tight">Segurança Ativa: v1.5.3</h4>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5 tracking-tighter">Status: Ativado por Hardware</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Drift Guard</span>
                  <span className="text-[9px] text-green-500 font-black italic uppercase">±5 km/h limit</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Balanced Damping</span>
                  <span className="text-[9px] text-green-500 font-black italic uppercase">20% Influence</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* User Management Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
          <ShieldCheck className="w-3 h-3 text-yellow-500" />
          Gerenciar Usuários & Premium
        </h3>

        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por nome do piloto..."
              className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:border-brand-primary/50 outline-none transition-all"
            />
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {userLoading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center py-12"
                >
                  <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                </motion.div>
              ) : users.length > 0 ? (
                users.map(u => (
                  <motion.div 
                    key={u.uid}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-panel border-white/5 p-4 rounded-3xl flex items-center justify-between hover:bg-zinc-900/50 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-950 border border-white/5 relative">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-6 h-6 text-zinc-800" />
                          </div>
                        )}
                        {u.isPremium && (
                          <div className="absolute top-0 right-0 bg-yellow-500 p-0.5 rounded-bl-lg">
                            <Zap className="w-2.5 h-2.5 text-zinc-950 fill-current" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate leading-tight">{u.displayName || 'Piloto DragFire'}</p>
                        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mt-1 opacity-50">UID: {u.uid.slice(0, 10)}...</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => togglePremium(u)}
                      className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                        u.isPremium 
                          ? 'bg-yellow-500 text-zinc-950 shadow-lg shadow-yellow-500/20' 
                          : 'bg-zinc-800 text-zinc-500 border border-white/5 hover:text-white'
                      }`}
                    >
                      {u.isPremium ? 'Premium OK' : 'Ativar Premium'}
                    </button>
                  </motion.div>
                ))
              ) : searchTerm.length > 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 space-y-3 opacity-40"
                >
                  <Search className="w-12 h-12 text-zinc-800 mx-auto" />
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Nenhum piloto encontrado</p>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-panel border-dashed border-white/5 bg-transparent p-12 rounded-3xl text-center space-y-3"
                >
                  <User className="w-10 h-10 text-zinc-800 mx-auto opacity-20" />
                  <p className="text-zinc-700 text-[9px] font-black uppercase tracking-[0.2em]">Pesquise para gerenciar créditos</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {/* New Profile Modal */}
      <AnimatePresence>
        {showNewProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pb-32">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewProfileModal(false)}
              className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm glass-panel bg-zinc-900/50 p-8 rounded-[40px] border-white/5 space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand-primary/20 rounded-2xl">
                  <RotateCw className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-black italic text-white uppercase italic tracking-tighter leading-none">NOVO PERFIL</h3>
                  <p className="text-[10px] text-brand-primary font-black uppercase tracking-widest mt-1">Salvar Configuração</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome do Perfil</label>
                  <input 
                    type="text"
                    autoFocus
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    placeholder="Ex: Performance Pro..."
                    className="w-full bg-zinc-950 border border-white/5 rounded-2xl py-4 px-6 text-sm text-white focus:border-brand-primary/50 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowNewProfileModal(false)}
                    className="flex-1 py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={createNewProfile}
                    className="flex-2 py-4 bg-brand-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-red-600/20"
                  >
                    Salvar Perfil
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
