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
    bannerUrl: '/assets/redline_turbo_banner_1776652514191.png',
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
    bannerUrl: '/assets/jdm_midnight_banner_1776652533251.png',
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
    bannerUrl: '/assets/cyberpunk_neon_banner_1776652550704.png',
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
    bannerUrl: '/assets/porsche_elite_banner_1776652566548.png',
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
  },
  {
    id: 'moto_ducati',
    name: 'Rosso Corsa (Ducati)',
    isBrand: true,
    price: 1490,
    priceLabel: '🪙 1490 DC',
    backgroundClass: 'bg-red-950/20',
    headerClass: 'bg-gradient-to-br from-red-800/40 to-black',
    accentText: 'text-red-400', 
    accentBg: 'bg-red-600',
    cardBg: 'bg-red-900/30',
    borderClass: 'border-red-600/30',
  },
  {
    id: 'motogp_pro',
    name: 'MotoGP Pro',
    isBrand: true,
    price: 1590,
    priceLabel: '🪙 1590 DC',
    backgroundClass: 'bg-stone-950',
    headerClass: 'bg-gradient-to-t from-stone-900 to-black',
    accentText: 'text-white',
    accentBg: 'bg-stone-700',
    cardBg: 'bg-stone-900',
    borderClass: 'border-white/20',
  },
  {
    id: 'grau_244',
    name: 'Cultura 244 (Grau)',
    isBrand: true,
    price: 990,
    priceLabel: '🪙 990 DC',
    backgroundClass: 'bg-zinc-950',
    headerClass: 'bg-[url("https://www.transparenttextures.com/patterns/black-scales.png")] bg-yellow-900/40',
    accentText: 'text-yellow-500',
    accentBg: 'bg-yellow-500',
    cardBg: 'bg-zinc-900/60',
    borderClass: 'border-yellow-500/20',
  }
];

export const getThemeById = (id?: string): ProfileThemeDef => {
  return PROFILE_THEMES.find(t => t.id === id) || PROFILE_THEMES[0];
};

export const BADGES: StoreItem[] = [
  { id: 'porsche', name: 'Porsche Elite', price: 1500, priceLabel: '🪙 1500 DC', imageUrl: '/assets/porsche_badge_icon_1776652586173.png' },
  { id: 'bmw_m', name: 'BMW M Power', price: 1500, priceLabel: '🪙 1500 DC', imageUrl: '/assets/bmw_m_badge_icon_1776652603496.png' },
  { id: 'ferrari', name: 'Ferrari Cavallino', price: 1500, priceLabel: '🪙 1500 DC', imageUrl: '/assets/ferrari_badge_icon_1776652617265.png' },
];

export const NEON_COLORS: StoreItem[] = [
  { id: 'neon_red', name: 'Vermelho Turbo', price: 500, priceLabel: '🪙 500 DC', color: '#ef4444' },
  { id: 'neon_cyan', name: 'Ciano Digital', price: 500, priceLabel: '🪙 500 DC', color: '#06b6d4' },
  { id: 'neon_lime', name: 'Verde Niterói', price: 500, priceLabel: '🪙 500 DC', color: '#84cc16' },
  { id: 'neon_fuchsia', name: 'Fúcsia Midnight', price: 500, priceLabel: '🪙 500 DC', color: '#d946ef' },
  { id: 'neon_gold', name: 'Dourado Elite', price: 500, priceLabel: '🪙 500 DC', color: '#f59e0b' },
];
