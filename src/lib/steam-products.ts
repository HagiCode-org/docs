import { loadPromotions, type NormalizedPromotion, type PromotionImage } from '@/lib/promotions';

export type SteamProductKey = 'hagicode' | 'turbo-engine' | 'all-beauties-pack' | 'sponsor-pack' | 'hagicode-plus';

export interface DocsSteamProduct {
  key: SteamProductKey;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  platform: string;
  kind: 'application' | 'dlc' | 'bundle';
  image: PromotionImage | null;
  promotion: NormalizedPromotion | null;
}

const fallbackProducts: Record<SteamProductKey, Omit<DocsSteamProduct, 'key' | 'promotion'>> = {
  hagicode: {
    title: 'HagiCode',
    description: 'Steam edition entry for HagiCode.',
    ctaLabel: 'View on Steam',
    href: 'https://store.steampowered.com/app/4625540/Hagicode/',
    platform: 'Steam',
    kind: 'application',
    image: null,
  },
  'turbo-engine': {
    title: 'Turbo Engine DLC',
    description: 'Expand proposal concurrency and unlock deeper workspace customization.',
    ctaLabel: 'View DLC',
    href: 'https://store.steampowered.com/app/4635480/Hagicode__Turbo_Engine/',
    platform: 'Steam',
    kind: 'dlc',
    image: null,
  },
  'all-beauties-pack': {
    title: 'All Beauties Pack',
    description: 'Free Steam DLC with additional avatar resources for visual personalization.',
    ctaLabel: 'View on Steam',
    href: 'https://store.steampowered.com/app/4625540/Hagicode/',
    platform: 'Steam',
    kind: 'dlc',
    image: null,
  },
  'sponsor-pack': {
    title: 'Sponsor Pack',
    description: 'Supporter DLC for users who want visible long-term project support rewards.',
    ctaLabel: 'View on Steam',
    href: 'https://store.steampowered.com/app/4625540/Hagicode/',
    platform: 'Steam',
    kind: 'dlc',
    image: null,
  },
  'hagicode-plus': {
    title: 'Hagicode Plus',
    description: 'Official bundle combining the Steam main edition with Turbo Engine DLC.',
    ctaLabel: 'View Bundle',
    href: 'https://store.steampowered.com/bundle/73989/Hagicode_Plus/',
    platform: 'Steam',
    kind: 'bundle',
    image: null,
  },
};

const promotionAliases: Record<SteamProductKey, string[]> = {
  hagicode: ['main-game-steam-ea-2026-04-29', 'main-game-2026-04-29'],
  'turbo-engine': ['hagicode-turbo-engine-dlc'],
  'all-beauties-pack': [],
  'sponsor-pack': [],
  'hagicode-plus': ['hagicode-plus-bundle'],
};

export function resolveSteamProductFromPromotions(
  key: SteamProductKey,
  promotions: NormalizedPromotion[],
): DocsSteamProduct {
  const fallback = fallbackProducts[key];
  const promotion = promotionAliases[key]
    .map((id) => promotions.find((entry) => entry.id === id))
    .find((entry): entry is NormalizedPromotion => Boolean(entry)) ?? null;

  if (!promotion) {
    return {
      key,
      ...fallback,
      promotion: null,
    };
  }

  return {
    key,
    title: promotion.title || fallback.title,
    description: promotion.description || fallback.description,
    ctaLabel: promotion.ctaLabel || fallback.ctaLabel,
    href: promotion.link || fallback.href,
    platform: promotion.platform || fallback.platform,
    kind: fallback.kind,
    image: promotion.image,
    promotion,
  };
}

export async function loadDocsSteamProducts(options: {
  locale?: string | null;
  fetchImpl?: typeof fetch;
  now?: number;
} = {}): Promise<Record<SteamProductKey, DocsSteamProduct>> {
  const promotions = await loadPromotions(options);

  return {
    hagicode: resolveSteamProductFromPromotions('hagicode', promotions),
    'turbo-engine': resolveSteamProductFromPromotions('turbo-engine', promotions),
    'all-beauties-pack': resolveSteamProductFromPromotions('all-beauties-pack', promotions),
    'sponsor-pack': resolveSteamProductFromPromotions('sponsor-pack', promotions),
    'hagicode-plus': resolveSteamProductFromPromotions('hagicode-plus', promotions),
  };
}

