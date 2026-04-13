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
  MapPin
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, addDoc, updateDoc, doc, Timestamp, getDocs } from 'firebase/firestore';
import { fetchNearbyStations, getPhotoUrl, GooglePlaceResult, getCityFromCoordinates } from '../services/googleMapsService';
import { GasStation } from '../types';
import { Geolocation } from '@capacitor/geolocation';
import { normalizeText } from '../lib/utils';

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

export function GasStations({ onBack }: { onBack: () => void }) {
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
  const [selectedRadius, setSelectedRadius] = useState(50000); // Default to 50km as requested
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [manualCityInput, setManualCityInput] = useState('');
  const [isLocationError, setIsLocationError] = useState(false);

  // 1. Get User Location
  const getLocation = async () => {
    try {
      setIsLocationError(false);
      setLoading(true);
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      });
      setUserLocation([position.coords.latitude, position.coords.longitude]);
    } catch (err: any) {
      console.warn('Geolocation error:', err.message);
      setIsLocationError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  // 2. Fetch Real Stations from Google and Firestore
  useEffect(() => {
    const loadRealStations = async () => {
      setLoading(true);
      
      const timeoutId = setTimeout(() => {
        if (loading) {
          console.warn('Real search timed out, showing initial stations.');
          setLoading(false);
        }
      }, 6000);

      try {
        let city = currentCity;
        
        if (!city && userLocation) {
          try {
            city = await getCityFromCoordinates(userLocation[0], userLocation[1]);
            console.log('Google detected city:', city);
          } catch (cityErr) {
            console.error('City detection failed:', cityErr);
          }
        }
        
        if (city && city !== 'Unknown') {
          setCurrentCity(city);
        }

        // Step B: Fetch from Google
        let googleResults: GooglePlaceResult[] = [];
        try {
          if (userLocation) {
            console.log('Fetching from Google Places...');
            googleResults = await fetchNearbyStations(userLocation[0], userLocation[1], selectedRadius);
            console.log('Google results:', googleResults.length);
          }
        } catch (gErr) {
          console.error('Google Places API failed (likely CORS on localhost):', gErr);
          // Prosseguimos sem resultados do Google, usando apenas nosso banco ANP
        }
        
        // Step C: Fetch ALL stations from our ANP database for this city
        let anpStationsInCity: GasStation[] = [];
        const searchCity = city?.toUpperCase();

        if (searchCity) {
          const normalizedCity = normalizeText(searchCity);
          console.log('Final normalized city for query:', normalizedCity);
          const anpQuery = query(
            collection(db, 'fuel_stations_anp'),
            where('municipio', '==', normalizedCity),
            limit(200)
          );
          const anpSnapshot = await getDocs(anpQuery);
          anpStationsInCity = anpSnapshot.docs.map(doc => doc.data() as GasStation);
          console.log(`Found ${anpStationsInCity.length} ANP stations for ${normalizedCity}`);
          
          // Debug extremo: se não achou nada por cidade, tenta pegar os primeiros 10 do banco total
          if (anpStationsInCity.length === 0) {
            console.log('No stations for city, trying a blind sample fetch...');
            const sampleQuery = query(collection(db, 'fuel_stations_anp'), limit(10));
            const sampleSnapshot = await getDocs(sampleQuery);
            console.log('Sample stations in entire DB:', sampleSnapshot.docs.length);
            if (sampleSnapshot.docs.length > 0) {
              console.log('Sample 1 municipio:', sampleSnapshot.docs[0].data()?.municipio);
            }
          }
        }

        // Step D: Merge & Populate Real Prices
        const processedStations: GasStation[] = googleResults.map(res => {
          const stationId = res.place_id;
          
          // Try to match with an ANP station by name or address keyword
          const match = anpStationsInCity.find(s => 
            res.name.toUpperCase().includes(s.name.toUpperCase().substring(0, 10)) ||
            res.vicinity.toUpperCase().includes(s.address.split(',')[0].toUpperCase())
          );

          return {
            id: stationId,
            name: res.name,
            brand: match?.brand || (
              res.name.toLowerCase().includes('shell') ? 'Shell' : 
              res.name.toLowerCase().includes('br') ? 'Petrobras' : 
              res.name.toLowerCase().includes('ipiranga') ? 'Ipiranga' : 'Outros'
            ),
            address: res.vicinity,
            latitude: res.geometry.location.lat,
            longitude: res.geometry.location.lng,
            prices: {},
            pricesANP: match?.pricesANP || {},
            cnpj: match?.cnpj || match?.id,
            rating: res.rating || 0,
            reviewsCount: res.user_ratings_total || 0,
            lastUpdated: match?.lastUpdated || Date.now(),
            photoURL: res.photos?.[0] ? getPhotoUrl(res.photos[0].photo_reference) || undefined : undefined
          };
        });

        // Step E: Add stations from ANP that are NOT in Google but have coordinates (if any)
        const extraStations = anpStationsInCity.filter(s => 
          !processedStations.some(ps => ps.cnpj === (s.cnpj || s.id))
        );

        setStations([...processedStations, ...extraStations]);
        console.log('Total stations set to state:', [...processedStations, ...extraStations].length);
      } catch (err) {
        console.error('Failed to load real stations:', err);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    loadRealStations();
  }, [userLocation, selectedRadius]); // Depend only on physical location and radius

  const handleManualSearch = () => {
    if (manualCityInput.trim()) {
      setCurrentCity(manualCityInput.trim());
      setLoading(true);
    }
  };

  // 3. Keep distances and sorting updated
  useEffect(() => {
    if (userLocation && stations.length > 0) {
      const updatedStations = [...stations].map(s => {
        // Se o posto não tem coordenadas (latitude 0), marcamos como distância 0 ou muito alta dependendo da lógica.
        // Como o usuário quer ver esses postos, vamos dar uma "distância artificial" baixa se for da mesma cidade.
        let d = 9999;
        if (s.latitude !== 0 && userLocation) {
          d = Math.sqrt(
            Math.pow(s.latitude - userLocation[0], 2) + 
            Math.pow(s.longitude - userLocation[1], 2)
          ) * 111; 
        } else if (currentCity && s.municipio === normalizeText(currentCity)) {
          d = 0.1; // Se é da cidade do usuário e não tem coordenadas, coloca no topo
        }
        return { ...s, dist: d };
      });
      
      updatedStations.sort((a, b) => {
        const priceA = a.prices?.[selectedFuel] || (a.pricesANP as any)?.[selectedFuel] || 999;
        const priceB = b.prices?.[selectedFuel] || (b.pricesANP as any)?.[selectedFuel] || 999;
        
        if (filterBy === 'price') return priceA - priceB;
        if (filterBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        return (a.dist || 0) - (b.dist || 0);
      });

      setStations(updatedStations);
    }
  }, [filterBy, selectedFuel, userLocation, stations.length, currentCity]);

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
              <h2 className="text-xl font-display font-black italic text-white leading-none">POSTOS</h2>
              <p className="text-[10px] text-brand-primary font-bold uppercase tracking-widest mt-1">
                {currentCity ? `Em ${currentCity}` : 'Comparando Preços'} 
                {stations.some(s => s.pricesANP && Object.keys(s.pricesANP).length > 0) && ' • DADOS ANP OK'}
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
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Buscando postos reais...</p>
          </div>
        ) : (
          <>
            {/* Loading / Error States */}
        {loading && !stations.length && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
            <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-white font-bold">Buscando postos reais...</p>
              <p className="text-zinc-500 text-xs mt-1">Isso pode levar alguns segundos.</p>
            </div>
            
            <div className="w-full max-w-xs space-y-4 pt-8 border-t border-white/5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase text-center">GPS lento? Digite sua cidade:</p>
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
                  className="bg-brand-primary text-zinc-950 px-4 rounded-xl font-bold text-sm active:scale-95 transition-all"
                >
                  Ir
                </button>
              </div>
            </div>
          </div>
        )}

        {isLocationError && !stations.length && !loading && (
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
                  className="bg-brand-primary text-zinc-950 px-4 rounded-xl font-bold text-sm"
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!loading && stations.length > 0 ? (
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
                          {station.dist?.toFixed(1)} km
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
                        R$ {station.prices?.[selectedFuel]?.toFixed(2) || '0.00'}
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

        {/* Floating Add Price Button */}
        <button 
          onClick={() => {
            if (filteredStations.length > 0) {
              setSelectedStation(filteredStations[0]);
              setShowDetailMode(true);
            }
          }}
          className="absolute bottom-28 right-6 w-14 h-14 bg-brand-primary rounded-2xl flex items-center justify-center text-zinc-950 shadow-2xl shadow-brand-primary/40 active:scale-90 transition-all z-10"
        >
          <Plus className="w-6 h-6" />
        </button>

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
          </>
        )}
      </main>
    </div>
  );
}
