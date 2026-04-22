export interface ProfileThemeDef {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  isBrand?: boolean;
  backgroundClass: string;
  headerClass: string;
  accentText: string;
  accentBg: string;
  cardBg: string; // The inner cards background class
  borderClass: string;
  bannerUrl?: string;
  neonColor?: string;
  isMoto?: boolean;
}

export interface StoreItem {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  imageUrl?: string;
  color?: string;
}

export const PROFILE_THEMES: ProfileThemeDef[] = [
  {
    id: 'default',
    name: 'Padrão DragFire',
    price: 0,
    priceLabel: 'Grátis',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-zinc-900',
    accentText: 'text-brand-primary',
    accentBg: 'bg-brand-primary',
    cardBg: 'bg-zinc-900/50',
    borderClass: 'border-white/5',
  },
  {
    id: 'redline_turbo',
    name: 'RedLine Turbo',
    price: 490,
    priceLabel: '🪙 490 DC',
    backgroundClass: 'bg-red-950/20',
    headerClass: 'bg-gradient-to-br from-red-900/40 to-black',
    accentText: 'text-red-500',
    accentBg: 'bg-red-600',
    cardBg: 'bg-red-950/30',
    borderClass: 'border-red-500/20',
    bannerUrl: '/assets/banner_redline.png',
    neonColor: '#ef4444'
  },
  {
    id: 'jdm_midnight',
    name: 'JDM Midnight',
    price: 990,
    priceLabel: '🪙 990 DC',
    backgroundClass: 'bg-purple-950/30',
    headerClass: 'bg-gradient-to-r from-fuchsia-900/50 to-purple-900/50',
    accentText: 'text-fuchsia-400',
    accentBg: 'bg-fuchsia-500',
    cardBg: 'bg-purple-900/30',
    borderClass: 'border-purple-500/30',
    bannerUrl: '/assets/banner_jdm.png',
    neonColor: '#d946ef'
  },
  {
    id: 'cyberpunk_2077',
    name: 'Cyberpunk Neon',
    price: 990,
    priceLabel: '🪙 990 DC',
    backgroundClass: 'bg-[#0f172a]',  // Slate 900
    headerClass: 'bg-gradient-to-br from-[#0284c7]/40 to-[#e11d48]/40', // Cyan to Rose
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-500',
    cardBg: 'bg-slate-800/50',
    borderClass: 'border-cyan-500/40',
    bannerUrl: '/assets/banner_cyberpunk.png',
    neonColor: '#06b6d4'
  },
  
  // ------ JOGOS & VINTAGE (Especiais) ------ //
  {
    id: 'nfs_underground',
    name: 'Underground Racing',
    price: 1990,
    priceLabel: '🪙 1990 DC',
    backgroundClass: 'bg-slate-950',
    headerClass: 'bg-gradient-to-br from-lime-900/40 to-slate-900',
    accentText: 'text-lime-500',
    accentBg: 'bg-lime-500',
    cardBg: 'bg-slate-900',
    borderClass: 'border-lime-500/20',
    bannerUrl: '/assets/banner_underground.png'
  },
  {
    id: 'forza_festival',
    name: 'Horizon Festival',
    price: 1990,
    priceLabel: '🪙 1990 DC',
    backgroundClass: 'bg-orange-950/10',
    headerClass: 'bg-gradient-to-r from-pink-600/30 via-orange-500/30 to-yellow-500/20',
    accentText: 'text-orange-400',
    accentBg: 'bg-orange-500',
    cardBg: 'bg-orange-950/30',
    borderClass: 'border-orange-500/30',
    bannerUrl: '/assets/banner_horizon.png'
  },
  {
    id: 'midnight_cub',
    name: 'Midnight Dub',
    price: 1590,
    priceLabel: '🪙 1590 DC',
    backgroundClass: 'bg-black',
    headerClass: 'bg-gradient-to-b from-zinc-800/80 to-black',
    accentText: 'text-yellow-500',
    accentBg: 'bg-yellow-600',
    cardBg: 'bg-zinc-900/50',
    borderClass: 'border-yellow-600/10',
    bannerUrl: '/assets/banner_midnight_dub.png'
  },
  
  // ------ MARCAS (Brand Themes) ------ //
  {
    id: 'brand_porsche',
    name: 'Porsche Elite',
    isBrand: true,
    price: 1490,
    priceLabel: '🪙 1490 DC',
    backgroundClass: 'bg-neutral-900',
    headerClass: 'bg-gradient-to-b from-stone-400/20 to-neutral-900',
    accentText: 'text-amber-500', // Gold/Yellowish
    accentBg: 'bg-amber-500',
    cardBg: 'bg-neutral-800',
    borderClass: 'border-amber-500/20',
    bannerUrl: '/assets/banner_porsche.png',
    neonColor: '#f59e0b'
  },
  {
    id: 'brand_bmw',
    name: 'M-Power (BMW)',
    isBrand: true,
    price: 1490,
    priceLabel: '🪙 1490 DC',
    backgroundClass: 'bg-slate-950',
    headerClass: 'bg-gradient-to-tr from-sky-600/30 via-slate-900 to-red-600/30',
    accentText: 'text-sky-400', 
    accentBg: 'bg-sky-500',
    cardBg: 'bg-slate-900',
    borderClass: 'border-white/10',
    bannerUrl: '/assets/banner_bmw.png'
  },
  {
    id: 'brand_vw',
    name: 'GTI Project (VW)',
    isBrand: true,
    price: 1290,
    priceLabel: '🪙 1290 DC',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-[url("https://www.transparenttextures.com/patterns/carbon-fibre.png")] bg-zinc-900/80',
    accentText: 'text-red-500', 
    accentBg: 'bg-red-600',
    cardBg: 'bg-red-950/20',
    borderClass: 'border-red-600/30',
    bannerUrl: '/assets/banner_vw.png'
  },
  {
    id: 'brand_chevrolet',
    name: 'SS Performance (GM)',
    isBrand: true,
    price: 1290,
    priceLabel: '🪙 1290 DC',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-gradient-to-t from-zinc-950 to-yellow-600/20',
    accentText: 'text-yellow-500', 
    accentBg: 'bg-yellow-600',
    cardBg: 'bg-zinc-900/70',
    borderClass: 'border-yellow-600/20',
    bannerUrl: '/assets/banner_chevrolet.png'
  },
  {
    id: 'brand_honda',
    name: 'VTEC Racing (Honda)',
    isBrand: true,
    price: 1290,
    priceLabel: '🪙 1290 DC',
    backgroundClass: 'bg-red-950/10',
    headerClass: 'bg-gradient-to-b from-red-700/20 to-zinc-950',
    accentText: 'text-white', 
    accentBg: 'bg-red-600',
    cardBg: 'bg-red-900/20',
    borderClass: 'border-red-500/30',
    bannerUrl: '/assets/banner_honda.png'
  },
  {
    id: 'moto_yamaha',
    name: 'Team Blue (Yamaha)',
    isBrand: true,
    price: 1290,
    priceLabel: '🪙 1290 DC',
    backgroundClass: 'bg-blue-950/10',
    headerClass: 'bg-gradient-to-tr from-blue-700/30 to-slate-900',
    accentText: 'text-blue-400', 
    accentBg: 'bg-blue-600',
    cardBg: 'bg-blue-900/20',
    borderClass: 'border-blue-500/30',
    bannerUrl: '/assets/banner_yamaha.png',
    isMoto: true
  },
  {
    id: 'moto_kawasaki',
    name: 'Team Green (Kawasaki)',
    isBrand: true,
    isMoto: true,
    price: 1290,
    priceLabel: '🪙 1290 DC',
    backgroundClass: 'bg-emerald-950/20',
    headerClass: 'bg-gradient-to-br from-lime-600/40 to-black',
    accentText: 'text-lime-400', 
    accentBg: 'bg-lime-600',
    cardBg: 'bg-emerald-900/30',
    borderClass: 'border-lime-500/30',
    bannerUrl: '/assets/banner_kawasaki.png'
  },
  {
    id: 'moto_harley',
    name: 'Freedom (Harley-Davidson)',
    isBrand: true,
    isMoto: true,
    price: 1490,
    priceLabel: '🪙 1490 DC',
    backgroundClass: 'bg-orange-950/20',
    headerClass: 'bg-gradient-to-t from-black to-orange-900/40',
    accentText: 'text-orange-500', 
    accentBg: 'bg-orange-600',
    cardBg: 'bg-zinc-900',
    borderClass: 'border-orange-600/20',
    bannerUrl: '/assets/banner_harley.png'
  },
  {
    id: 'moto_royal',
    name: 'Classic (Royal Enfield)',
    isBrand: true,
    isMoto: true,
    price: 990,
    priceLabel: '🪙 990 DC',
    backgroundClass: 'bg-stone-950',
    headerClass: 'bg-gradient-to-b from-stone-800 to-stone-950',
    accentText: 'text-amber-700', 
    accentBg: 'bg-amber-800',
    cardBg: 'bg-stone-900',
    borderClass: 'border-amber-900/20',
    bannerUrl: '/assets/banner_royal.png'
  },
  {
    id: 'moto_honda_racing',
    name: 'HRC Racing (Honda Moto)',
    isBrand: true,
    isMoto: true,
    price: 1290,
    priceLabel: '🪙 1290 DC',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-gradient-to-tr from-red-600/30 via-white/5 to-blue-600/30',
    accentText: 'text-red-500', 
    accentBg: 'bg-red-600',
    cardBg: 'bg-zinc-900',
    borderClass: 'border-blue-500/20',
    bannerUrl: '/assets/banner_honda_moto.png'
  },
  {
    id: 'moto_suzuki',
    name: 'Speed (Suzuki)',
    isBrand: true,
    isMoto: true,
    price: 1290,
    priceLabel: '🪙 1290 DC',
    backgroundClass: 'bg-blue-950/20',
    headerClass: 'bg-gradient-to-br from-blue-600/40 to-slate-900',
    accentText: 'text-blue-300', 
    accentBg: 'bg-blue-500',
    cardBg: 'bg-slate-900',
    borderClass: 'border-blue-400/20',
    bannerUrl: '/assets/banner_suzuki.png'
  },
  {
    id: 'moto_ducati',
    name: 'Rosso Corsa (Ducati)',
    isBrand: true,
    isMoto: true,
    price: 1490,
    priceLabel: '🪙 1490 DC',
    backgroundClass: 'bg-red-950/20',
    headerClass: 'bg-gradient-to-br from-red-800/40 to-black',
    accentText: 'text-red-400', 
    accentBg: 'bg-red-600',
    cardBg: 'bg-red-900/30',
    borderClass: 'border-red-600/30',
    bannerUrl: '/assets/banner_ducati.png'
  },
  {
    id: 'motogp_pro',
    name: 'MotoGP Pro',
    isBrand: true,
    isMoto: true,
    price: 1590,
    priceLabel: '🪙 1590 DC',
    backgroundClass: 'bg-stone-950',
    headerClass: 'bg-gradient-to-t from-stone-900 to-black',
    accentText: 'text-white',
    accentBg: 'bg-stone-700',
    cardBg: 'bg-stone-900',
    borderClass: 'border-white/20',
    bannerUrl: '/assets/banner_motogp.png'
  },
  {
    id: 'grau_244',
    name: 'Cultura 244 (Grau)',
    isBrand: true,
    isMoto: true,
    price: 990,
    priceLabel: '🪙 990 DC',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-[url("https://www.transparenttextures.com/patterns/black-scales.png")] bg-yellow-900/40',
    accentText: 'text-yellow-500',
    accentBg: 'bg-yellow-500',
    cardBg: 'bg-zinc-900/60',
    borderClass: 'border-yellow-500/20',
    bannerUrl: '/assets/banner_grau244.png'
  },
  {
    id: 'brand_audi',
    name: 'Vorsprung (Audi)',
    isBrand: true,
    price: 1490,
    priceLabel: '🪙 1490 DC',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-gradient-to-r from-zinc-800 to-red-950/40',
    accentText: 'text-red-500', 
    accentBg: 'bg-red-600',
    cardBg: 'bg-zinc-900',
    borderClass: 'border-red-600/20',
    bannerUrl: '/assets/banner_audi.png'
  },
  {
    id: 'brand_nissan',
    name: 'Skyline Legend (Nissan)',
    isBrand: true,
    price: 2490,
    priceLabel: '🪙 2490 DC',
    backgroundClass: 'bg-indigo-950/20',
    headerClass: 'bg-gradient-to-br from-indigo-900/50 to-black',
    accentText: 'text-indigo-400', 
    accentBg: 'bg-indigo-600',
    cardBg: 'bg-indigo-950/30',
    borderClass: 'border-indigo-500/20',
    bannerUrl: '/assets/banner_nissan.png',
    neonColor: '#4f46e5'
  },
  {
    id: 'brand_ford',
    name: 'Pony Power (Ford)',
    isBrand: true,
    price: 1490,
    priceLabel: '🪙 1490 DC',
    backgroundClass: 'bg-blue-950/10',
    headerClass: 'bg-gradient-to-t from-black to-blue-900/30',
    accentText: 'text-blue-400', 
    accentBg: 'bg-blue-600',
    cardBg: 'bg-zinc-900',
    borderClass: 'border-blue-500/20',
    bannerUrl: '/assets/banner_ford.png'
  },
  {
    id: 'brand_toyota',
    name: 'TRD Supra (Toyota)',
    isBrand: true,
    price: 2490,
    priceLabel: '🪙 2490 DC',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-gradient-to-br from-orange-600/30 to-black',
    accentText: 'text-orange-500', 
    accentBg: 'bg-orange-600',
    cardBg: 'bg-zinc-900',
    borderClass: 'border-orange-500/20',
    bannerUrl: '/assets/banner_toyota.png',
    neonColor: '#f97316'
  },
  {
    id: 'brand_mercedes',
    name: 'AMG Elite (Mercedes)',
    isBrand: true,
    price: 2490,
    priceLabel: '🪙 2490 DC',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-gradient-to-tr from-emerald-600/20 via-zinc-900 to-black',
    accentText: 'text-emerald-400', 
    accentBg: 'bg-emerald-600',
    cardBg: 'bg-zinc-900',
    borderClass: 'border-emerald-500/20',
    bannerUrl: '/assets/banner_mercedes.png',
    neonColor: '#10b981'
  },
  {
    id: 'brand_mitsubishi',
    name: 'Evolution (Mitsubishi)',
    isBrand: true,
    price: 1490,
    priceLabel: '🪙 1490 DC',
    backgroundClass: 'bg-red-950/10',
    headerClass: 'bg-gradient-to-b from-red-600/30 to-black',
    accentText: 'text-red-500', 
    accentBg: 'bg-red-600',
    cardBg: 'bg-zinc-900',
    borderClass: 'border-red-600/20',
    bannerUrl: '/assets/banner_mitsubishi.png'
  }
];

export const getThemeById = (id?: string): ProfileThemeDef => {
  return PROFILE_THEMES.find(t => t.id === id) || PROFILE_THEMES[0];
};

export const BADGES: StoreItem[] = [
  { id: 'porsche', name: 'Porsche Elite', price: 1500, priceLabel: '🪙 1500 DC', imageUrl: '/assets/badge_porsche_new.png' },
  { id: 'bmw_m', name: 'BMW M Power', price: 1500, priceLabel: '🪙 1500 DC', imageUrl: '/assets/badge_bmw_new.png' },
  { id: 'ferrari', name: 'Ferrari Cavallino', price: 1500, priceLabel: '🪙 1500 DC', imageUrl: '/assets/badge_ferrari_new.png' },
  { id: 'badge_rocket', name: 'Foguete Drag', price: 2000, priceLabel: '🪙 2000 DC', imageUrl: '/assets/badge_rocket_new.png' },
  { id: 'badge_missile', name: 'Míssil de Pista', price: 2000, priceLabel: '🪙 2000 DC', imageUrl: '/assets/badge_missile.png' },
  { id: 'badge_flag', name: 'Flag Quadriculada', price: 1000, priceLabel: '🪙 1000 DC', imageUrl: '/assets/badge_flag.png' },
  { id: 'badge_turbo', name: 'Caracol Turbo', price: 1800, priceLabel: '🪙 1800 DC', imageUrl: '/assets/badge_turbo_new.png' },
  { id: 'badge_piston', name: 'Pistão Forjado', price: 1200, priceLabel: '🪙 1200 DC', imageUrl: '/assets/badge_piston_new.png' },
  { id: 'badge_nitro', name: 'Botão Nitro (NOS)', price: 2500, priceLabel: '🪙 2500 DC', imageUrl: '/assets/badge_nitro_new.png' },
  { id: 'badge_helmet', name: 'Capacete Pro', price: 1500, priceLabel: '🪙 1500 DC', imageUrl: '/assets/badge_helmet.png' },
];

export const NEON_COLORS: StoreItem[] = [
  { id: 'neon_red', name: 'Vermelho Turbo', price: 500, priceLabel: '🪙 500 DC', color: '#ef4444' },
  { id: 'neon_cyan', name: 'Ciano Digital', price: 500, priceLabel: '🪙 500 DC', color: '#06b6d4' },
  { id: 'neon_lime', name: 'Verde Niterói', price: 500, priceLabel: '🪙 500 DC', color: '#84cc16' },
  { id: 'neon_fuchsia', name: 'Fúcsia Midnight', price: 500, priceLabel: '🪙 500 DC', color: '#d946ef' },
  { id: 'neon_gold', name: 'Dourado Elite', price: 500, priceLabel: '🪙 500 DC', color: '#f59e0b' },
];

export const TITLES: StoreItem[] = [
  { id: 'title_elite', name: 'Piloto Elite', price: 500, priceLabel: '🪙 500 DC' },
  { id: 'title_drift', name: 'Piloto de Drift', price: 500, priceLabel: '🪙 500 DC' },
  { id: 'title_fuga', name: 'Piloto de Fuga', price: 500, priceLabel: '🪙 500 DC' },
  { id: 'title_nave', name: 'Piloto de Nave', price: 500, priceLabel: '🪙 500 DC' },
  { id: 'title_kart', name: 'Piloto de Kart', price: 500, priceLabel: '🪙 500 DC' },
  { id: 'title_track', name: 'Piloto de TrackDay', price: 500, priceLabel: '🪙 500 DC' },
  { id: 'title_master', name: 'Mestre da Pista', price: 500, priceLabel: '🪙 500 DC' },
  { id: 'title_legend', name: 'Lenda das Ruas', price: 500, priceLabel: '🪙 500 DC' },
];
