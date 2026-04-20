export interface Achievement {
  id: string;
  title: string;
  description: string;
  reward: number;
  icon: string;
  type: 'once' | 'daily' | 'weekly';
  category: 'social' | 'garage' | 'economy' | 'performance';
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'daily_login',
    title: 'Piloto Ativo',
    description: 'Faça login no app hoje',
    reward: 10,
    icon: 'Sun',
    type: 'daily',
    category: 'economy'
  },
  {
    id: 'register_vehicle',
    title: 'Garagem Completa',
    description: 'Cadastre seu primeiro veículo',
    reward: 100,
    icon: 'Car',
    type: 'once',
    category: 'garage'
  },
  {
    id: 'invite_friend',
    title: 'Equipe de Rua',
    description: 'Convide um amigo para o DragFire',
    reward: 200,
    icon: 'UserPlus',
    type: 'once',
    category: 'social'
  },
  {
    id: 'share_photo',
    title: 'Influenciador Gearhead',
    description: 'Compartilhe uma foto de um veículo',
    reward: 50,
    icon: 'Share2',
    type: 'weekly',
    category: 'social'
  },
  {
    id: 'ai_photo_edit',
    title: 'Estúdio Digital',
    description: 'Edite uma foto usando o Estúdio IA',
    reward: 50,
    icon: 'Sparkles',
    type: 'weekly',
    category: 'performance'
  },
  {
    id: 'fuel_update',
    title: 'Radar de Combustível',
    description: 'Registre o preço de um posto de combustível',
    reward: 20,
    icon: 'Fuel',
    type: 'weekly',
    category: 'economy'
  }
];
