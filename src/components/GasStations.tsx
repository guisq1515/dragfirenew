import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Map as MapIcon, 
  List, 
  Filter, 
  Search, 
  Star, 
  Navigation, 
  Fuel, 
  Clock, 
  Plus,
  ArrowUpDown,
  Car,
  Image as ImageIcon,
  MapPin,
  Database
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, addDoc, updateDoc, doc, Timestamp, getDocs } from 'firebase/firestore';
import { fetchNearbyStationsHTTP, fetchNearbyStationsNew, fetchNearbyStationsTextSearch, getPhotoUrl, GooglePlaceResult, getCityFromCoordinates } from '../services/googleMapsService';
import { GasStation, UserProfile } from '../types';
import { Geolocation } from '@capacitor/geolocation';
import { normalizeText } from '../lib/utils';
import { APP_VERSION } from '../versions';

// Multi-marker support
const customMarkerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Mock initial data (focusing on SP as requested)
const MOCK_STATIONS: GasStation[] = [
  {
    id: '1',
    name: 'Posto Shell - Interlagos',
    brand: 'Shell',
    address: 'Av. Interlagos, 2225 - São Paulo, SP',
    latitude: -23.6821,
    longitude: -46.6914,
    // Community prices (start empty or with specific reports)
    prices: {},
    // ANP Official prices (what we have in our database)
    pricesANP: { gasoline: 5.89, ethanol: 3.79, dieselS10: 6.10, dieselS500: 5.95 },
    rating: 4.8,
    reviewsCount: 156,
    lastUpdated: Date.now(),
    photoURL: 'https://images.unsplash.com/photo-1541447271487-09612b3f49f7?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: '2',
    name: 'Posto BR - Ipiranga',
    brand: 'Petrobras',
    address: 'Av. das Nações Unidas, 12901 - São Paulo, SP',
    latitude: -23.5904,
    longitude: -46.6901,
    prices: { gasoline: 5.75, ethanol: 3.65, dieselS10: 5.99 },
    rating: 4.5,
    reviewsCount: 89,
    lastUpdated: Date.now() - 3600000,
    photoURL: 'https://images.unsplash.com/photo-1516515429572-1f99e17588b3?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: '3',
    name: 'Ipiranga - JK',
    brand: 'Ipiranga',
    address: 'Av. Pres. Juscelino Kubitschek, 1500 - São Paulo, SP',
    latitude: -23.5855,
    longitude: -46.6815,
    prices: { gasoline: 5.95, ethanol: 3.85 },
    rating: 4.2,
    reviewsCount: 42,
    lastUpdated: Date.now() - 86400000,
  }
];

export function GasStations({ onBack, onCompleteMission }: { onBack: () => void; onCompleteMission?: (id: string) => void }) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState<'price' | 'distance' | 'rating'>('distance');
  const [selectedFuel, setSelectedFuel] = useState<'gasoline' | 'ethanol'>('gasoline');
  const [stations, setStations] = useState<GasStation[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<GasStation | null>(null);
  const [showDetailMode, setShowDetailMode] = useState(false);
  const [updatingFuel, setUpdatingFuel] = useState<'gasoline' | 'ethanol' | 'dieselS10' | 'dieselS500'>('gasoline');
  const [newPrice, setNewPrice] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'prices' | 'reviews'>('prices');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(10000); // Set default to 10km as requested
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [manualCityInput, setManualCityInput] = useState('');
  const [isLocationError, setIsLocationError] = useState(false);
  const [apiStatus, setApiStatus] = useState<string | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  // 1. Get User Location
  const getLocation = async () => {
    try {
      setIsLocationError(false);
      setLoading(true);
      console.log('Checking GPS permissions...');
      
      // Native Permission Check (Capacitor)
      const permResult = await Geolocation.checkPermissions();
      console.log('Permissions status:', permResult.location);
      
      if (permResult.location !== 'granted') {
        const reqResult = await Geolocation.requestPermissions();
        if (reqResult.location !== 'granted') {
          console.warn('Location permission denied');
          setIsLocationError(true);
          setLoading(false);
          // alert('Permissão de GPS negada. Ative nas configurações do celular.');
          return;
        }
      }
      
      console.log('Requesting accurate position...');
      const position = await Promise.race([
        Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 3000
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('GPS Timeout (12s)')), 12000))
      ]) as any;

      console.log('Position acquired:', position.coords.latitude, position.coords.longitude);
      setUserLocation([position.coords.latitude, position.coords.longitude]);
    } catch (err: any) {
      console.error('CRITICAL GPS ERROR:', err.message);
      setIsLocationError(true);
      // alert('Erro GPS: ' + (err.message || 'Desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  // 1.1 Dedicated effect for city detection (UX Improvement)
  useEffect(() => {
    const detectCity = async () => {
      if (!userLocation || currentCity) return; 
      
      try {
        console.log('[CITY] Inciando detecção de cidade via GPS...');
        const city = await getCityFromCoordinates(userLocation[0], userLocation[1]);
        if (city && city !== 'Unknown') {
          console.log('[CITY] Cidade identificada:', city);
          setCurrentCity(city);
        }
      } catch (err) {
        console.error('[CITY] Erro ao detectar cidade:', err);
      }
    };
    
    detectCity();
  }, [userLocation]);

  // 2. Fetch Real Stations from Google and Firestore
  useEffect(() => {
    const loadRealStations = async () => {
      if (!userLocation && !manualCityInput) return;
      
      setLoading(true);
      const currentUser = auth.currentUser;
      const uid = currentUser?.uid;
      const isGuest = !currentUser;

      console.log('[SEARCH] Iniciando busca de postos...');
      
      const timeoutId = setTimeout(() => {
        if (loading) console.warn('[SEARCH] A busca está demorando mais que o esperado...');
      }, 10000);

      try {
        let googleResults: GooglePlaceResult[] = [];
        setApiStatus(null);
        setApiErrorMessage(null);

        // A. PRIORIDADE 1: Busca por Coordenadas GPS (MAIS PRECISO)
        if (userLocation) {
          try {
            console.log('[SEARCH] Tentando busca por proximidade GPS (v1)...');
            const response = await fetchNearbyStationsNew(userLocation[0], userLocation[1], selectedRadius, uid, isGuest);
            
            setApiStatus(response.status);
            
            if (response.status === 'LIMIT_ERROR') {
              const reason = response.error_message;
              let friendlyMessage = 'Limite de buscas atingido.';
              
              if (reason === 'SPAM_THROTTLE') friendlyMessage = 'Aguarde 30s para buscar novamente (Anti-Spam).';
              if (reason === 'GLOBAL_LIMIT') friendlyMessage = 'Sistema em manutenção (Cota Mensal atingida).';
              if (reason === 'GUEST_LIMIT') friendlyMessage = 'Limite de Visitante (5/dia) atingido. Faça login para continuar!';
              if (reason === 'USER_LIMIT') friendlyMessage = 'Limite diário (20/dia) atingido. Volte amanhã!';
              
              setApiErrorMessage(friendlyMessage);
              setLoading(false);
              return;
            }

            if (response.error_message) setApiErrorMessage(response.error_message);

            if (response.results && response.results.length > 0) {
              console.log('[SEARCH] Sucesso: Postos encontrados por GPS.');
              googleResults = response.results;
            } else {
              console.log('[SEARCH] Nada encontrado por GPS, tentando fallbacks...');
              
              // FALLBACK 1: Busca por Texto (SÓ SE JÁ TIVERMOS A CIDADE)
              if (currentCity) {
                console.log(`[SEARCH] Tentando busca por texto em: ${currentCity}`);
                const textSearchResponse = await fetchNearbyStationsTextSearch(`Postos em ${currentCity}`, userLocation[0], userLocation[1], selectedRadius, uid, isGuest);
                if (textSearchResponse.results && textSearchResponse.results.length > 0) {
                  googleResults = textSearchResponse.results;
                }
              }

              // FALLBACK 2: Legacy HTTP
              if (googleResults.length === 0) {
                console.log('[SEARCH] Tentando busca legado (Legacy HTTP)...');
                const fallbackResponse = await fetchNearbyStationsHTTP(userLocation[0], userLocation[1], selectedRadius, true, uid, isGuest);
                if (fallbackResponse.results && fallbackResponse.results.length > 0) {
                  googleResults = fallbackResponse.results;
                }
              }
            }
          } catch (gErr) {
            console.error('[SEARCH] Erro na busca Google:', gErr);
          }
        }
        
        // B. Busca na base ANP (Depende da Cidade)
        let anpStationsInCity: GasStation[] = [];
        if (currentCity) {
          const normalizedCity = normalizeText(currentCity);
          const anpQuery = query(
            collection(db, 'fuel_stations_anp'),
            where('municipio', '==', normalizedCity),
            limit(100)
          );
          const anpSnapshot = await getDocs(anpQuery);
          anpStationsInCity = anpSnapshot.docs.map(doc => doc.data() as GasStation);
        }

        // C. Merge e Cálculo de Distância (Imediato)
        const processedFromGoogle = googleResults.map(res => {
          const match = anpStationsInCity.find(s => 
            res.name.toUpperCase().includes(s.name.toUpperCase().substring(0, 8)) ||
            res.vicinity.toUpperCase().includes(s.address.split(',')[0].toUpperCase().substring(0, 10))
          );

          const lat = res.geometry.location.lat;
          const lng = res.geometry.location.lng;
          let distance = 999;

          if (userLocation && lat && lng) {
            distance = Math.sqrt(
              Math.pow(lat - userLocation[0], 2) + 
              Math.pow(lng - userLocation[1], 2)
            ) * 111;
          }

          return {
            id: res.place_id,
            name: res.name,
            brand: match?.brand || 'Outros',
            address: res.vicinity,
            latitude: lat,
            longitude: lng,
            dist: distance,
            prices: {},
            pricesANP: match?.pricesANP || {},
            cnpj: match?.cnpj || match?.id,
            rating: res.rating || 0,
            reviewsCount: res.user_ratings_total || 0,
            lastUpdated: match?.lastUpdated || Date.now(),
            photoURL: res.photos?.[0] ? getPhotoUrl(res.photos[0].photo_reference) || undefined : undefined
          };
        });

        const extraFromANP = anpStationsInCity.filter(s => 
          !processedFromGoogle.some(pg => pg.cnpj === (s.cnpj || s.id))
        ).map(s => {
          let distance = 999;
          if (userLocation && s.latitude && s.longitude) {
            distance = Math.sqrt(Math.pow(s.latitude - userLocation[0], 2) + Math.pow(s.longitude - userLocation[1], 2)) * 111;
          } else if (currentCity && s.municipio === normalizeText(currentCity)) {
            distance = 0.5; // Mesma cidade sem GPS
          }

          return { ...s, dist: distance };
        });

        const allStations = [...processedFromGoogle, ...extraFromANP];
        allStations.sort((a, b) => (a.dist || 999) - (b.dist || 999));
        setStations(allStations);

      } catch (err: any) {
        console.error('[CRITICAL] Falha geral ao carregar postos:', err);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    loadRealStations();
  }, [userLocation, selectedRadius, currentCity]);

  const handleManualSearch = () => {
    if (manualCityInput.trim()) {
      setCurrentCity(manualCityInput.trim());
      setLoading(true);
    }
  };

  // 3. Keep distances and sorting updated reatively
  useEffect(() => {
    if (stations.length > 0) {
      const sorted = [...stations].sort((a, b) => {
        if (filterBy === 'price') {
          const priceA = a.prices?.[selectedFuel] || (a.pricesANP as any)?.[selectedFuel] || 999;
          const priceB = b.prices?.[selectedFuel] || (b.pricesANP as any)?.[selectedFuel] || 999;
          return priceA - priceB;
        }
        if (filterBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        return (a.dist || 999) - (b.dist || 999);
      });
      setStations(sorted);
    }
  }, [filterBy, selectedFuel]);

  const handleUpdatePrice = async (fuelType: string) => {
    if (!selectedStation || !newPrice || isUpdating) return;
    const price = parseFloat(newPrice);
    if (isNaN(price)) return;

    setIsUpdating(true);
    try {
      const user = auth.currentUser;
      
      await addDoc(collection(db, 'fuel_price_updates'), {
        stationId: selectedStation.id,
        fuelType: fuelType,
        price: price,
        timestamp: Date.now(),
        userId: user?.uid || 'guest',
        userName: user?.displayName || 'Piloto DragFire'
      });

      setStations(prev => prev.map(s => {
        if (s.id === selectedStation.id) {
          return {
            ...s,
            prices: { ...s.prices, [fuelType]: price },
            lastUpdated: Date.now()
          };
        }
        return s;
      }));

      // No need to close detail, just update UI
      setNewPrice('');
      if (onCompleteMission) onCompleteMission('fuel_update');
    } catch (error) {
      console.error("Error updating price:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNavigate = () => {
    if (!selectedStation) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedStation.latitude},${selectedStation.longitude}`;
    window.open(url, '_blank');
  };

  const handleAddReview = async () => {
    if (!selectedStation || !newComment || isUpdating) return;

    setIsUpdating(true);
    try {
      const user = auth.currentUser;
      const review = {
        userId: user?.uid || 'guest',
        userName: user?.displayName || 'Piloto DragFire',
        rating: newRating,
        comment: newComment,
        timestamp: Date.now()
      };

      // 1. Log the review
      await addDoc(collection(db, 'fuel_station_reviews'), {
        stationId: selectedStation.id,
        ...review
      });

      // 2. Update local state
      setStations(prev => prev.map(s => {
        if (s.id === selectedStation.id) {
          const updatedReviews = [review, ...(s.reviews || [])];
          const newAvgRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0) / updatedReviews.length;
          return {
            ...s,
            reviews: updatedReviews,
            rating: parseFloat(newAvgRating.toFixed(1)),
            reviewsCount: updatedReviews.length
          };
        }
        return s;
      }));

      setNewComment('');
      setNewRating(5);
      setActiveTab('reviews');
    } catch (error) {
      console.error("Error adding review:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredStations = stations.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="p-4 space-y-4 border-b border-white/5 bg-zinc-900/50 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-zinc-800 rounded-xl text-zinc-400 active:scale-90 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-display font-black italic text-white leading-none">LOCALIZAR POSTOS</h2>
              <p className="text-[10px] text-brand-primary font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="opacity-60">Comparando Preços</span>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-brand-primary" />
                    {currentCity ? currentCity : 'Localizando...'}
                  </p>
              </p>
            </div>
          </div>
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'map' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600'}`}
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou bandeira..."
              className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 transition-all"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'distance', label: 'Distância', icon: MapPin },
              { id: 'price', label: 'Menor Preço', icon: Fuel },
              { id: 'rating', label: 'Melhores Notas', icon: Star },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterBy(f.id as any)}
                className={`flex-shrink-0 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                  filterBy === f.id 
                    ? 'bg-brand-primary border-brand-primary text-zinc-950' 
                    : 'bg-zinc-900/50 border-white/5 text-zinc-500'
                }`}
              >
                <f.icon className="w-3 h-3" />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Fuel Type Selector */}
      <div className="flex bg-zinc-900/30 p-2 gap-2">
        <button 
          onClick={() => setSelectedFuel('gasoline')}
          className={`flex-1 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest border transition-all ${
            selectedFuel === 'gasoline' ? 'bg-zinc-800 border-white/10 text-white' : 'border-transparent text-zinc-600'
          }`}
        >
          Gasolina
        </button>
        <button 
          onClick={() => setSelectedFuel('ethanol')}
          className={`flex-1 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest border transition-all ${
            selectedFuel === 'ethanol' ? 'bg-zinc-800 border-white/10 text-white' : 'border-transparent text-zinc-600'
          }`}
        >
          Etanol
        </button>
      </div>

      {/* Radius Filter */}
      <div className="px-4 mb-4 flex gap-2">
        {[10000, 25000, 50000].map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRadius(r)}
            className={`flex-1 py-1.5 rounded-full font-black text-[9px] uppercase tracking-tighter border transition-all ${
              selectedRadius === r 
                ? 'bg-brand-primary border-transparent text-black scale-105' 
                : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-white'
            }`}
          >
            {r / 1000}km
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <Navigation className="w-4 h-4 text-brand-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center px-8">
              <p className="text-white font-black italic uppercase tracking-widest text-[11px] mb-1">
                {currentCity ? `Buscando postos em ${currentCity}...` : 'Buscando postos e localização...'}
              </p>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-[8px] animate-pulse">
                Aguarde um momento
              </p>
            </div>
            {/* Botão de segurança caso demore muito */}
            <button 
              onClick={() => setLoading(false)}
              className="mt-4 text-[9px] text-zinc-600 underline font-bold uppercase tracking-widest"
            >
              Cancelar e ver dados locais
            </button>
          </div>
        ) : isLocationError && !stations.length ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
              <MapPin className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold">GPS não encontrado</p>
              <p className="text-zinc-500 text-xs mt-1">Não conseguimos detectar sua localização.</p>
            </div>
            
            <button 
              onClick={getLocation}
              className="bg-white text-black px-6 py-3 rounded-full font-bold text-sm active:scale-95 transition-all"
            >
              Tentar Reposicionar GPS
            </button>

            <div className="w-full max-w-xs space-y-4 pt-8 border-t border-white/5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase text-center">Ou busque manualmente:</p>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Cidade, UF"
                  value={manualCityInput}
                  onChange={(e) => setManualCityInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                />
                <button 
                  onClick={handleManualSearch}
                  className="bg-brand-primary text-zinc-950 px-4 rounded-xl font-bold text-sm cursor-pointer"
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>
        ) : !stations.length ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
            <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center">
              <MapIcon className="w-6 h-6 text-zinc-600" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold">Nenhum posto encontrado</p>
              <p className="text-zinc-500 text-[10px] mt-2 max-w-[240px] leading-relaxed uppercase font-black tracking-widest">
                Não encontramos postos próximos via Google Places ou base ANP. 
              </p>
              <p className="text-red-500 text-[10px] mt-4 max-w-[240px] leading-relaxed uppercase font-black tracking-widest border border-red-500/20 bg-red-500/5 p-3 rounded-xl">
                VERIFIQUE SUA CHAVE DE API DO GOOGLE OU TENTE AUMENTAR O RAIO DE BUSCA.
              </p>
              
              {apiStatus && apiStatus !== 'OK' && apiStatus !== 'ZERO_RESULTS' && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest leading-tight">
                    ERRO TÉCNICO NO GOOGLE: <span className="underline italic">{apiStatus}</span>
                  </p>
                  {apiErrorMessage && (
                    <p className="text-[9px] text-red-400 font-medium leading-relaxed normal-case">
                      {apiErrorMessage === 'BillingNotEnabled' ? 'Faturamento não ativado no Google Cloud. Vincule um cartão para usar a busca.' : apiErrorMessage}
                    </p>
                  )}
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">
                    Verifique seu Google Cloud Console e vincule um faturamento (Billing).
                  </p>
                </div>
              )}

              {apiStatus === 'ZERO_RESULTS' && (
                <p className="text-[9px] text-brand-primary mt-2 uppercase font-bold">
                  Tentamos buscar por categoria e palavra-chave, mas nada foi encontrado neste raio.
                </p>
              )}

              <p className="block text-zinc-600 mt-2 text-[8px] font-bold uppercase tracking-widest">
                Dica: Tente aumentar o raio de busca para 50km.
              </p>
            </div>
            
            <div className="w-full max-w-xs space-y-4 pt-8 border-t border-white/5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase text-center">Tentar outra cidade:</p>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Ex: São Paulo"
                  value={manualCityInput}
                  onChange={(e) => setManualCityInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                />
                <button 
                  onClick={handleManualSearch}
                  className="bg-brand-primary text-zinc-950 px-4 rounded-xl font-bold text-sm cursor-pointer"
                >
                  Ir
                </button>
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'list' ? (
              <motion.div 
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-full overflow-y-auto p-4 space-y-4 pb-24"
              >
              {filteredStations.map((station) => (
                <button
                  key={station.id}
                  onClick={() => {
                    setSelectedStation(station);
                    setShowDetailMode(true);
                  }}
                  className="w-full glass-panel p-4 rounded-3xl border-white/5 flex gap-4 text-left active:scale-[0.98] transition-all"
                >
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex-shrink-0 overflow-hidden relative">
                    {station.photoURL ? (
                      <img src={station.photoURL} alt={station.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Fuel className="w-6 h-6 text-zinc-800" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-white/10">
                      <span className="text-[8px] font-black text-white">{station.brand}</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white truncate">{station.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-medium truncate">{station.address}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-brand-primary">
                        <Navigation className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">
                          {station.dist && station.dist < 900 ? `${station.dist.toFixed(1)} km` : 'Localização...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">
                          {station.rating}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col justify-center">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-1">Preço</span>
                    <div className="flex flex-col">
                      <span className="text-xl font-display font-black italic text-white leading-none">
                        R$ {(station.prices?.[selectedFuel] || (station.pricesANP as any)?.[selectedFuel])?.toFixed(2) || '---'}
                      </span>
                      <span className="text-[8px] text-zinc-500 font-bold uppercase mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-2 h-2" />
                        {Math.floor((Date.now() - station.lastUpdated) / 3600000)}h atrás
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-0"
            >
              <MapContainer 
                center={userLocation || [-23.5505, -46.6333]} 
                zoom={15} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {filteredStations.map(station => (
                  <Marker 
                    key={station.id} 
                    position={[station.latitude, station.longitude]}
                    icon={customMarkerIcon}
                  >
                    <Popup className="custom-popup">
                      <div className="p-2 space-y-1">
                        <h4 className="font-bold text-zinc-950 text-xs">{station.name}</h4>
                        <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest">
                          R$ {station.prices[selectedFuel]?.toFixed(2)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </motion.div>
          )}
        </AnimatePresence>
      )}


        {/* Full Screen Detail Profile */}
        <AnimatePresence>
          {showDetailMode && selectedStation && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
            >
              {/* Cover Image Header */}
              <div className="relative h-[35vh] w-full bg-zinc-900">
                <img 
                  src={selectedStation.photoURL || 'https://images.unsplash.com/photo-1541447271487-09612b3f49f7?auto=format&fit=crop&q=80&w=800'} 
                  alt={selectedStation.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                
                <button 
                  onClick={() => setShowDetailMode(false)}
                  className="absolute top-6 left-6 p-3 bg-zinc-900/80 backdrop-blur-md rounded-2xl text-white shadow-xl"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-brand-primary text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest">
                      {selectedStation.brand}
                    </span>
                    <div className="flex items-center gap-1 text-yellow-500 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-[10px] font-black">{selectedStation.rating}</span>
                    </div>
                  </div>
                  <h3 className="text-3xl font-display font-black italic text-white leading-none uppercase tracking-tighter">
                    {selectedStation.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 text-zinc-400">
                    <MapPin className="w-3 h-3 text-brand-primary" />
                    <p className="text-[10px] font-medium truncate">{selectedStation.address}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                {/* Navigation Button */}
                <button 
                  onClick={handleNavigate}
                  className="w-full py-4 bg-white text-zinc-950 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all"
                >
                  <Navigation className="w-5 h-5" />
                  Como Chegar (GPS)
                </button>

                {/* Dados do Cadastro ANP */}
                {selectedStation.cnpj && (
                   <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-5 space-y-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary">
                            <Database className="w-5 h-5" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cadastro Oficial ANP</p>
                            <h4 className="text-white font-bold text-sm">{selectedStation.cnpj}</h4>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                         <div>
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-1">Bandeira</p>
                            <span className="text-xs font-bold text-zinc-300">{selectedStation.brand}</span>
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-1">Última Coleta</p>
                            <span className="text-xs font-bold text-zinc-300">
                               {new Date(selectedStation.lastUpdated).toLocaleDateString('pt-BR')}
                            </span>
                         </div>
                      </div>
                   </div>
                )}

                {/* Vertical Totem List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Totem de Preços</h4>
                    <span className="text-[8px] text-zinc-600 font-bold uppercase">Base: São Paulo / ANP</span>
                  </div>

                  {/* Header Row */}
                  <div className="grid grid-cols-[1fr_repeat(2,90px)] gap-2 px-4 mb-2">
                    <span className="text-[8px] font-black text-zinc-600 uppercase">Combustível</span>
                    <span className="text-[8px] font-black text-zinc-600 uppercase text-center">Valor Dados ANP</span>
                    <span className="text-[8px] font-black text-brand-primary uppercase text-center">Comunidade</span>
                  </div>
                  
                  <div className="space-y-2">
                    {[
                      { id: 'gasoline', label: 'Gasolina Common', icon: Fuel, color: 'text-brand-primary' },
                      { id: 'ethanol', label: 'Etanol Hidratado', icon: Fuel, color: 'text-green-500' },
                      { id: 'dieselS10', label: 'Diesel S10', icon: Fuel, color: 'text-yellow-500' },
                      { id: 'dieselS500', label: 'Diesel S500', icon: Fuel, color: 'text-zinc-400' },
                    ].map(fuel => {
                      const priceCommunity = (selectedStation.prices as any)[fuel.id];
                      const priceANP = (selectedStation.pricesANP as any)?.[fuel.id];
                      
                      return (
                        <div key={fuel.id} className="relative group">
                          <div className="glass-panel p-3 rounded-2xl border-white/5 grid grid-cols-[1fr_repeat(2,90px)] items-center gap-2 hover:bg-zinc-900/50 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl bg-zinc-950 border border-white/5`}>
                                <fuel.icon className={`w-3 h-3 ${fuel.color}`} />
                              </div>
                              <span className="text-[10px] font-black text-white uppercase truncate">{fuel.label}</span>
                            </div>

                            {/* ANP Column - Data we have */}
                            <div className="flex flex-col items-center bg-zinc-950/50 py-2 rounded-xl border border-white/5 opacity-80">
                              <span className="text-sm font-display font-black italic text-zinc-500">
                                {priceANP ? `R$ ${priceANP.toFixed(2)}` : '---'}
                              </span>
                            </div>

                            {/* Community Column - Data to be added */}
                            <button 
                              onClick={() => {
                                setUpdatingFuel(fuel.id as any);
                                // Set initial value to ANP if community is empty
                                setNewPrice(priceCommunity ? priceCommunity.toString() : (priceANP ? priceANP.toFixed(2) : ''));
                                setIsUpdateModalOpen(true);
                              }}
                              className="flex flex-col items-center bg-brand-primary/5 py-2 rounded-xl border border-brand-primary/10 hover:bg-brand-primary/10 transition-all active:scale-95 group"
                            >
                              <span className="text-lg font-display font-black italic text-brand-primary leading-none">
                                {priceCommunity ? `R$ ${priceCommunity.toFixed(2)}` : '---'}
                              </span>
                              {!priceCommunity && <span className="text-[6px] font-black text-brand-primary/50 uppercase mt-0.5">+ REPORTAR</span>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Review Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Avaliações</h4>
                    <button 
                      onClick={() => setActiveTab('reviews')}
                      className="text-[10px] font-black text-brand-primary uppercase tracking-widest"
                    >
                      Ver Tudo
                    </button>
                  </div>

                  {activeTab === 'reviews' ? (
                    <div className="space-y-4">
                      {/* Review form is already integrated elsewhere or can be added here */}
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button 
                              key={star} 
                              onClick={() => setNewRating(star)}
                              className={`p-2 rounded-lg border transition-all ${newRating >= star ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 'bg-zinc-950 border-white/5 text-zinc-700'}`}
                            >
                              <Star className={`w-4 h-4 ${newRating >= star ? 'fill-current' : ''}`} />
                            </button>
                          ))}
                        </div>
                        <textarea 
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Deixe sua avaliação sobre este posto..."
                          className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-xs text-white placeholder:text-zinc-700 focus:border-brand-primary outline-none transition-all resize-none h-24"
                        />
                        <button 
                          onClick={handleAddReview}
                          disabled={isUpdating || !newComment}
                          className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                        >
                          Enviar Avaliação
                        </button>
                      </div>

                      <div className="space-y-3">
                        {selectedStation.reviews?.map((review, i) => (
                          <div key={i} className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-white">{review.userName}</span>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`w-2 h-2 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-zinc-800'}`} />
                                ))}
                              </div>
                            </div>
                            <p className="text-[10px] text-zinc-500 font-medium italic leading-relaxed">"{review.comment}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setActiveTab('reviews')}
                      className="w-full py-8 bg-zinc-900/30 border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3 text-zinc-600"
                    >
                      <Star className="w-8 h-8 opacity-20" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Toque para ver avaliações</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Price Update Bottom Sheet Panel */}
              <AnimatePresence>
                {isUpdateModalOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsUpdateModalOpen(false)}
                      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110]"
                    />
                    <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-[40px] border-t border-white/10 p-8 z-[120] pb-12"
                    >
                      <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8" />
                      
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 bg-brand-primary/10 rounded-2xl border border-brand-primary/20">
                          <Fuel className="w-6 h-6 text-brand-primary" />
                        </div>
                        <div>
                          <h4 className="text-xl font-display font-black italic text-white uppercase tracking-tighter">
                            Atualizar {updatingFuel === 'gasoline' ? 'Gasolina' : updatingFuel === 'ethanol' ? 'Etanol' : 'Diesel'}
                          </h4>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Reportar valor real na bomba</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-display font-black italic text-brand-primary">R$</span>
                          <input 
                            type="number"
                            autoFocus
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className="w-full bg-zinc-950 border-2 border-brand-primary/20 rounded-3xl py-8 px-16 text-4xl font-display font-black italic text-white focus:border-brand-primary outline-none transition-all text-center"
                          />
                        </div>

                        {/* Quick Adjust Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => {
                              const p = parseFloat(newPrice) || 0;
                              setNewPrice((p - 0.10).toFixed(2));
                            }}
                            className="py-4 bg-zinc-800 rounded-2xl text-zinc-400 font-black text-xs uppercase"
                          >
                            - 0,10
                          </button>
                          <button 
                            onClick={() => {
                              const p = parseFloat(newPrice) || 0;
                              setNewPrice((p + 0.10).toFixed(2));
                            }}
                            className="py-4 bg-zinc-800 rounded-2xl text-zinc-400 font-black text-xs uppercase"
                          >
                            + 0,10
                          </button>
                        </div>

                        <button 
                          onClick={async () => {
                            await handleUpdatePrice(updatingFuel);
                            setIsUpdateModalOpen(false);
                          }}
                          className="w-full py-6 bg-brand-primary text-zinc-950 rounded-3xl font-display font-black italic text-xl uppercase shadow-2xl shadow-brand-primary/20 active:scale-95 transition-all"
                        >
                          Confirmar Valor
                        </button>
                        
                        <button 
                          onClick={() => setIsUpdateModalOpen(false)}
                          className="w-full text-zinc-600 font-black text-[10px] uppercase tracking-widest"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
