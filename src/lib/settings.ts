import { eq, sql } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db';
import { banners, contentPages, settings, shippingZones, videoStories } from '@/db/schema';
import { iraqGovernorates } from './iraq';
import { infoPages } from './info';

export type NavigationLink = { label: string; labelAr?: string; href: string };
export type NavigationGroup = { name: string; nameAr?: string; href: string; links: NavigationLink[]; image: string; caption: string; captionAr?: string };
export type FooterLink = { label: string; labelAr?: string; href: string };
export type FooterGroup = { title: string; titleAr?: string; links: FooterLink[] };
export type FooterConfig = { groups: FooterGroup[]; trustItems: { icon: 'pin' | 'globe' | 'star' | 'badge'; text: string; textAr?: string; active: boolean; sortOrder: number }[]; newsletter: { eyebrow: string; eyebrowAr?: string; title: string; titleAr?: string; description: string; descriptionAr?: string; image: string; active: boolean }; demoDisclaimer: string; demoDisclaimerAr?: string };
export type HomepageConfig = {
  copy: { trendingEyebrow: string; trendingEyebrowAr?: string; trendingTitle: string; trendingTitleAr?: string; trendingLink: string; trendingLinkAr?: string; trendingHref: string; categoryTitle: string; categoryTitleAr?: string; categoryDiscoverTitle: string; categoryDiscoverTitleAr?: string; categoryDiscoverLine2: string; categoryDiscoverLine2Ar?: string; categoryDiscoverLink: string; categoryDiscoverLinkAr?: string; categoryLinkPrefix: string; categoryLinkPrefixAr?: string; collectionsTitle: string; collectionsTitleAr?: string; collectionsLink: string; collectionsLinkAr?: string; collectionsHref: string; socialEyebrow: string; socialEyebrowAr?: string; socialTitle: string; socialTitleAr?: string; socialHandle: string };
  intents: { image: string; title: string; titleAr?: string; subtitle: string; subtitleAr?: string; href: string; active: boolean; sortOrder: number }[];
  categories: { id: string; name: string; nameAr?: string; active: boolean; sortOrder: number }[];
  collections: { id: string; slug: string; title: string; titleAr: string; description: string; descriptionAr: string; image: string; href: string; active: boolean; sortOrder: number; productIds?: string[] }[];
  social: { image: string; href: string; caption: string; captionAr?: string; active: boolean; sortOrder: number }[];
  videoStories: { youtubeId: string; title: string; titleAr?: string; cta: string; ctaAr?: string; href: string; active: boolean; sortOrder: number }[];
  blocks: { key: string; label: string; enabled: boolean; sortOrder: number }[];
};

export type StoreSettings = {
  storeName: string; tagline: string; logoUrl: string; logoAlt: string; faviconUrl: string; metaTitle: string; metaDescription: string; seoIndex: boolean; seoFollow: boolean; canonicalBaseUrl: string; ogImage: string; announcement: string; announcementHref: string;
  supportEmail: string; supportPhone: string; whatsapp: string; instagram: string; youtube: string; facebook: string; address: string; footerTagline: string; copyrightText: string;
  exchangeRate: number; freeShippingThreshold: number; codFee: number; codEnabled: boolean; lowStockThreshold: number;
  orderPrefix: string; checkoutNote: string; homeHeadline: string; homeHeadlineAr?: string; homeSubheadline: string; homeSubheadlineAr?: string; homeValues: { title: string; text: string; titleAr?: string; textAr?: string }[];
  navigation: NavigationGroup[];
  footer: FooterConfig;
  homepage: HomepageConfig;
  adminPasswordHash?: string;
};
export const defaultSettings: StoreSettings = {
  storeName: 'UR', tagline: 'Your final touch | لمستك الأخيرة.', logoUrl: '/images/UR-logo.svg', logoAlt: 'UR', faviconUrl: '/images/UR-logo.svg', seoIndex: true, seoFollow: true, canonicalBaseUrl: '', ogImage: '/images/UR-logo.svg', metaTitle: 'UR Leather | لمستك الأخيرة', metaDescription: 'اكتشف منتجات UR Leather المصنوعة من الجلد الطبيعي، بتصاميم تجمع بين الأناقة والاستخدام اليومي.', announcement: 'Free delivery across Iraq on orders over 150,000 IQD · Cash on delivery', announcementHref: '/info/shipping',
  supportEmail: '', supportPhone: '07700000000', whatsapp: '9647700000000', instagram: '', youtube: '', facebook: '', address: 'Iraq', footerTagline: 'Your final touch.\nلمستك الأخيرة.', copyrightText: 'UR Leather.',
  exchangeRate: 1320, freeShippingThreshold: 150000, codFee: 0, codEnabled: true, lowStockThreshold: 5,
  orderPrefix: 'UR', checkoutNote: 'We deliver to all 18 governorates of Iraq. Pay in cash when your order arrives.',
  homeHeadline: 'We’re committed to moving you through the world with confidence.', homeHeadlineAr: 'نصمم منتجات تساعدك على التحرك بثقة في كل يوم.', homeSubheadline: 'So wherever you are, we’ll gear you up for...', homeSubheadlineAr: 'أينما كنت، جهّز نفسك بما يناسب رحلتك.',
  homeValues: [{ title: 'Better with age', text: 'Our gear is built to last and love – to day 1000 and beyond.' }, { title: 'Considered materials', text: 'Our primary fabrics are made from recycled sources like plastic bottles.' }, { title: 'Leather, crafted', text: 'We use leather from gold-rated LWG tanneries.' }],
  footer: {
    groups: [
      { title: 'Help', titleAr: 'المساعدة', links: [{ label: 'Customer care', href: '/info/contact' }, { label: 'Shipping & returns', href: '/info/shipping' }, { label: 'Extended warranties', href: '/info/warranty' }, { label: 'Cleaning & care', href: '/info/care' }, { label: 'Contact us', href: '/info/contact' }, { label: 'Terms & conditions', href: '/info/terms' }, { label: 'Privacy policy', href: '/info/privacy' }, { label: 'Cookie policy', href: '/info/cookies' }] },
      { title: 'Shop products', titleAr: 'تسوق المنتجات', links: [{ label: 'Shop all products', href: '/products/category/all' }, { label: 'Backpacks', href: '/products/category/backpacks' }, { label: 'Slings & crossbody bags', href: '/products/category/crossbody-bags' }, { label: 'Bags & luggage', href: '/products/category/bags' }, { label: 'Wallets', href: '/products/category/wallets' }, { label: 'Phone cases', href: '/products/category/phone-cases' }, { label: 'Accessories', href: '/products/category/accessories' }] },
      { title: 'Explore the range', titleAr: 'استكشف التشكيلة', links: [{ label: 'Bestsellers', href: '/collection/bestsellers' }, { label: 'New releases', href: '/collection/new-releases' }, { label: 'Travel', href: '/collection/travel' }, { label: 'Work', href: '/collection/work' }, { label: 'Outdoor', href: '/collection/outdoor' }, { label: 'The Outlet', href: '/collection/outlet' }, { label: 'Value sets', href: '/collection/value-sets' }] },
      { title: 'About us', titleAr: 'من نحن', links: [{ label: 'Our story', href: '/info/our-story' }, { label: 'Our materials', href: '/info/our-materials' }, { label: 'Responsible business', href: '/info/responsible-business' }, { label: 'The journal', href: '/info/journal' }, { label: 'Stores & stockists', href: '/info/stores' }, { label: 'Corporate gifting', href: '/info/corporate-gifting' }, { label: 'Careers', href: '/info/careers' }] },
    ],
    trustItems: [
      { icon: 'pin', text: 'Delivery across Iraq', textAr: 'توصيل إلى جميع أنحاء العراق', active: true, sortOrder: 0 },
      { icon: 'globe', text: 'Cash on delivery', textAr: 'الدفع عند الاستلام', active: true, sortOrder: 1 },
      { icon: 'star', text: '4.9-star Google rating', textAr: 'تقييم 4.9 نجمة على Google', active: true, sortOrder: 2 },
      { icon: 'badge', text: 'B Corp since 2015', textAr: 'مؤسسة B Corp منذ 2015', active: true, sortOrder: 3 },
    ],
    newsletter: { eyebrow: 'Get in first', eyebrowAr: 'كن أول من يعرف', title: 'Sign up for new releases and subscriber exclusives', titleAr: 'اشترك لمعرفة المنتجات الجديدة والعروض الحصرية', description: 'New releases, thoughtful stories and a few subscriber-only surprises.', descriptionAr: 'منتجات جديدة، قصص مختارة وبعض المفاجآت الحصرية للمشتركين.', image: '/images/newsletter.png', active: true },
    demoDisclaimer: 'An independent website recreation for demonstration. Not affiliated with Bellroy. No real payments are collected.',
  },
  navigation: [
    { name: 'Featured', nameAr: 'مختارات', href: '/collection/bestsellers', links: [{ label: 'Bestsellers', href: '/collection/bestsellers' }, { label: 'New releases', href: '/collection/new-releases' }, { label: 'Students & graduates', href: '/collection/campus' }, { label: 'The Outlet', href: '/collection/outlet' }, { label: 'Value sets', href: '/collection/value-sets' }], image: 'highlight-laneway.jpg', caption: 'Good design. Great company.' },
    { name: 'Bags & Luggage', nameAr: 'الحقائب والأمتعة', href: '/products/category/bags', links: [{ label: 'Backpacks', href: '/products/category/backpacks' }, { label: 'Crossbody bags', href: '/products/category/crossbody-bags' }, { label: 'Tote bags', href: '/products/category/tote-bags' }, { label: 'Work bags', href: '/products/category/work-bags' }, { label: 'Luggage', href: '/products/category/luggage' }], image: 'hero-backpacks.jpg', caption: 'We’ve got your back.' },
    { name: 'Travel', nameAr: 'السفر', href: '/collection/travel', links: [{ label: 'Luggage', href: '/products/category/luggage' }, { label: 'Travel backpacks', href: '/products/category/backpacks' }, { label: 'Travel slings', href: '/products/category/crossbody-bags' }, { label: 'RFID & travel wallets', href: '/products/category/wallets' }, { label: 'Packing cubes & pouches', href: '/products/category/accessories' }], image: 'highlight-travel.jpg', caption: 'A world of possibility.' },
    { name: 'Wallets', nameAr: 'المحافظ', href: '/products/category/wallets', links: [{ label: 'All wallets', href: '/products/category/wallets' }, { label: 'Billfolds', href: '/products/hide-and-seek' }, { label: 'Slim wallets', href: '/products/note-sleeve' }, { label: 'RFID protected', href: '/products/category/wallets' }], image: 'hide-and-seek.jpg', caption: 'Less bulk. More possibility.' },
    { name: 'Phone Cases & Tech', nameAr: 'أغطية الهواتف والتقنية', href: '/collection/for-tech-lovers', links: [{ label: 'Phone cases', href: '/products/category/phone-cases' }, { label: 'Tech organizers', href: '/products/tech-kit' }, { label: 'Laptop & tablet bags', href: '/collection/work' }, { label: 'All tech', href: '/collection/tech' }], image: 'highlight-phone.jpg', caption: 'For all the ways you move.' },
    { name: 'Accessories', nameAr: 'الإكسسوارات', href: '/products/category/accessories', links: [{ label: 'Pouches & organizers', href: '/products/category/accessories' }, { label: 'Tech Kit', href: '/products/tech-kit' }, { label: 'Travel accessories', href: '/collection/travel' }, { label: 'All accessories', href: '/products/category/accessories' }], image: 'highlight-pouches.jpg', caption: 'Little things. Big difference.' },
    { name: 'About Us', nameAr: 'من نحن', href: '/info/our-story', links: [{ label: 'Our story', href: '/info/our-story' }, { label: 'Our materials', href: '/info/our-materials' }, { label: 'Responsible business', href: '/info/responsible-business' }, { label: 'The journal', href: '/info/journal' }, { label: 'Shipping & delivery', href: '/info/shipping' }], image: 'intent-outdoor.jpg', caption: 'Designed for a better world.' },
  ],
  homepage: {
    copy: { trendingEyebrow: 'Well loved. Well traveled.', trendingEyebrowAr: 'محبوب في كل مكان. ومرافق في كل رحلة.', trendingTitle: 'Trending now', trendingTitleAr: 'الأكثر رواجاً الآن', trendingLink: 'Shop bestsellers', trendingLinkAr: 'تسوق الأكثر مبيعاً', trendingHref: '/collection/bestsellers', categoryTitle: 'Find your everyday companion', categoryTitleAr: 'اختر رفيقك اليومي', categoryDiscoverTitle: 'Less ordinary.', categoryDiscoverTitleAr: 'أقل اعتيادية.', categoryDiscoverLine2: 'More you.', categoryDiscoverLine2Ar: 'أكثر تعبيراً عنك.', categoryDiscoverLink: 'Explore the collection', categoryDiscoverLinkAr: 'استكشف المجموعة', categoryLinkPrefix: 'Shop all', categoryLinkPrefixAr: 'تسوق كل', collectionsTitle: 'Gear to suit your style', collectionsTitleAr: 'منتجات تناسب أسلوبك', collectionsLink: 'Find your collection', collectionsLinkAr: 'اكتشف مجموعتك', collectionsHref: '/products/category/all', socialEyebrow: 'Out there, with you.', socialEyebrowAr: 'معك أينما ذهبت.', socialTitle: 'Like. Comment. Aspire.', socialTitleAr: 'أعجبك. شاركنا. واستلهم.', socialHandle: '@bellroy'  },
    intents: [
      { image: 'intent-travel', title: 'Smoother travel', titleAr: 'سفر أكثر سلاسة', subtitle: 'Upgrade your setup', subtitleAr: 'طوّر تجهيزات رحلتك', href: '/collection/travel', active: true, sortOrder: 0 },
      { image: 'intent-work', title: 'Organized workdays', titleAr: 'أيام عمل أكثر تنظيماً', subtitle: 'Refine your routine', subtitleAr: 'طوّر روتينك اليومي', href: '/collection/work', active: true, sortOrder: 1 },
      { image: 'intent-tech', title: 'Protected tech', titleAr: 'تقنية محمية', subtitle: 'Defend your devices', subtitleAr: 'احمِ أجهزتك', href: '/collection/tech', active: true, sortOrder: 2 },
      { image: 'intent-errands', title: 'Easier errands', titleAr: 'مشاوير أسهل', subtitle: 'Tote smarter', subtitleAr: 'احمل بذكاء', href: '/products/category/tote-bags', active: true, sortOrder: 3 },
      { image: 'intent-outdoor', title: 'Prepared adventures', titleAr: 'مغامرات جاهزة', subtitle: 'Gear up and go', subtitleAr: 'جهّز نفسك وانطلق', href: '/collection/outdoor', active: true, sortOrder: 4 },
      { image: 'intent-campus', title: 'Streamlined studies', titleAr: 'دراسة أكثر تنظيماً', subtitle: 'Set up for success', subtitleAr: 'جهّز نفسك للنجاح', href: '/collection/campus', active: true, sortOrder: 5 },
    ],
    categories: [
      { id: 'backpacks', name: 'Backpacks', nameAr: 'حقائب الظهر', active: true, sortOrder: 0 },
      { id: 'crossbody-bags', name: 'Crossbody bags', nameAr: 'حقائب كروس بودي', active: true, sortOrder: 1 },
      { id: 'wallets', name: 'Wallets', nameAr: 'المحافظ', active: true, sortOrder: 2 },
      { id: 'phone-cases', name: 'Phone cases', nameAr: 'أغطية الهواتف', active: true, sortOrder: 3 },
      { id: 'luggage', name: 'Luggage', nameAr: 'أمتعة السفر', active: true, sortOrder: 4 },
      { id: 'work-bags', name: 'Work bags', nameAr: 'حقائب العمل', active: true, sortOrder: 5 },
      { id: 'accessories', name: 'Accessories', nameAr: 'الإكسسوارات', active: true, sortOrder: 6 },
    ],
    collections: [
      { id: 'transit', slug: 'transit', title: 'Transit', titleAr: 'ترانزيت', description: 'Stealthy, efficient, practical', descriptionAr: 'Stealthy, efficient, practical', image: '/images/collection-transit.jpg', href: '/collection/transit', active: true, sortOrder: 0 },
      { id: 'lite', slug: 'lite', title: 'Lite', titleAr: 'لايت', description: 'Lightweight, easy, adaptable', descriptionAr: 'Lightweight, easy, adaptable', image: '/images/collection-lite.jpg', href: '/collection/lite', active: true, sortOrder: 1 },
      { id: 'tokyo', slug: 'tokyo', title: 'Tokyo', titleAr: 'طوكيو', description: 'Functional, minimal, modern', descriptionAr: 'Functional, minimal, modern', image: '/images/collection-tokyo.jpg', href: '/collection/tokyo', active: true, sortOrder: 2 },
      { id: 'venture', slug: 'venture', title: 'Venture', titleAr: 'فنتشر', description: 'Adventure is in the details', descriptionAr: 'Adventure is in the details', image: '/images/collection-venture.jpg', href: '/collection/venture', active: true, sortOrder: 3 },
      { id: 'classic', slug: 'classic', title: 'Classic', titleAr: 'كلاسيك', description: 'Timeless, reliable, just right', descriptionAr: 'Timeless, reliable, just right', image: '/images/collection-classic.jpg', href: '/collection/classic', active: true, sortOrder: 4 },
      { id: 'cinch', slug: 'cinch', title: 'Cinch', titleAr: 'سينش', description: 'Colorful, fun, everyday', descriptionAr: 'Colorful, fun, everyday', image: '/images/collection-cinch.jpg', href: '/collection/cinch', active: true, sortOrder: 5 },
    ],
    social: [1, 2, 3, 4, 5].map(index => ({ image: `/images/social-${index}.jpg`, href: '', caption: 'Come along for the ride', captionAr: 'رافقنا في الرحلة', active: true, sortOrder: index - 1 })),
    videoStories: [
      { youtubeId: 'GNDqj75YIkE', title: 'Cinch Cinch revolution', cta: 'Shop the collection', href: '/collection/cinch', active: true, sortOrder: 0 },
      { youtubeId: 'ZKAuKBXBuPM', title: '5 reasons: Transit Check-In', cta: 'Shop luggage', href: '/products/category/luggage', active: true, sortOrder: 1 },
      { youtubeId: 'KPsdVwHPIqU', title: 'For all tiny carry needs', cta: 'Shop accessories', href: '/products/category/accessories', active: true, sortOrder: 2 },
      { youtubeId: 'zZsbBtcm1ao', title: 'A dog inspired a horse', cta: 'Explore the story', href: '/info/journal', active: true, sortOrder: 3 },
      { youtubeId: 'yGZYUNu03jw', title: 'Bring some drinks', cta: 'Gear up for the outdoors', href: '/collection/outdoor', active: true, sortOrder: 4 },
    ],
    blocks: [
      { key: 'hero', label: 'Hero slideshow', enabled: true, sortOrder: 0 },
      { key: 'highlights', label: 'Highlight cards', enabled: true, sortOrder: 1 },
      { key: 'trending', label: 'Trending products', enabled: true, sortOrder: 2 },
      { key: 'purpose', label: 'Purpose & values', enabled: true, sortOrder: 3 },
      { key: 'categories', label: 'Shop by category', enabled: true, sortOrder: 4 },
      { key: 'responsible', label: 'Responsible business', enabled: true, sortOrder: 5 },
      { key: 'collections', label: 'Collections', enabled: true, sortOrder: 6 },
      { key: 'videos', label: 'Video stories', enabled: true, sortOrder: 7 },
      { key: 'social', label: 'Social / Instagram', enabled: true, sortOrder: 8 },
    ],
  }
};
const publicKeys: (keyof StoreSettings)[] = ['storeName', 'tagline', 'logoUrl', 'logoAlt', 'faviconUrl', 'metaTitle', 'metaDescription', 'canonicalBaseUrl', 'ogImage', 'seoIndex', 'seoFollow', 'announcement', 'announcementHref', 'supportEmail', 'supportPhone', 'whatsapp', 'instagram', 'youtube', 'facebook', 'address', 'footerTagline', 'copyrightText', 'exchangeRate', 'freeShippingThreshold', 'codFee', 'codEnabled', 'lowStockThreshold', 'orderPrefix', 'checkoutNote', 'homeHeadline', 'homeSubheadline', 'homeValues', 'navigation', 'footer', 'homepage'];

let bootstrapped: Promise<void> | null = null;

/**
 * Keeps the content_pages table compatible with the current Drizzle schema.
 * Older Supabase projects may have been created before the bilingual/updated_at
 * fields were added, which otherwise makes the admin Content page fail at runtime.
 */
let settingsSchemaReady: Promise<void> | null = null;
async function ensureSettingsSchema() {
  if (settingsSchemaReady) return settingsSchemaReady;
  settingsSchemaReady = db.execute(sql.raw(`
    ALTER TABLE public.settings
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
    CREATE TABLE IF NOT EXISTS public.video_stories (
      id serial PRIMARY KEY,
      youtube_id text NOT NULL,
      title text NOT NULL DEFAULT '',
      title_ar text NOT NULL DEFAULT '',
      cta text NOT NULL DEFAULT 'Watch now',
      cta_ar text NOT NULL DEFAULT 'شاهد الآن',
      href text NOT NULL DEFAULT '/',
      active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE public.video_stories ADD COLUMN IF NOT EXISTS title_ar text NOT NULL DEFAULT '';
    ALTER TABLE public.video_stories ADD COLUMN IF NOT EXISTS cta_ar text NOT NULL DEFAULT 'شاهد الآن';
    ALTER TABLE public.video_stories ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `)).then(() => undefined).catch((error) => { settingsSchemaReady = null; throw error; });
  return settingsSchemaReady;
}

async function ensureContentPagesSchema() {
  await db.execute(sql.raw(`
    ALTER TABLE public.content_pages
      ADD COLUMN IF NOT EXISTS eyebrow_ar text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS title_ar text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS subtitle_ar text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS sections_ar jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS faqs_ar jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `));
}

async function ensureBannersSchema() {
  await db.execute(sql`
    ALTER TABLE public.banners
      ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'hero',
      ADD COLUMN IF NOT EXISTS category_id text,
      ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS title_ar text,
      ADD COLUMN IF NOT EXISTS subtitle text,
      ADD COLUMN IF NOT EXISTS subtitle_ar text,
      ADD COLUMN IF NOT EXISTS cta_label text,
      ADD COLUMN IF NOT EXISTS cta_label_ar text,
      ADD COLUMN IF NOT EXISTS href text NOT NULL DEFAULT '/',
      ADD COLUMN IF NOT EXISTS image text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS mobile_image text,
      ADD COLUMN IF NOT EXISTS badge text,
      ADD COLUMN IF NOT EXISTS badge_ar text,
      ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS starts_at timestamp,
      ADD COLUMN IF NOT EXISTS ends_at timestamp,
      ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()
  `);
}

export function ensureStoreSeeded() {
  if (!bootstrapped) bootstrapped = (async () => {
    // Schema compatibility is handled by Drizzle migrations, not on storefront requests.
    const [[zoneCount], [bannerCount], [pageCount]] = await Promise.all([
      db.select({ total: sql<number>`count(*)` }).from(shippingZones),
      db.select({ total: sql<number>`count(*)` }).from(banners),
      db.select({ total: sql<number>`count(*)` }).from(contentPages),
    ]);
    if (Number(zoneCount.total) === 0) await db.insert(shippingZones).values(iraqGovernorates.map((zone, index) => ({ ...zone, sortOrder: index }))).onConflictDoNothing();
    if (Number(bannerCount.total) === 0) await db.insert(banners).values([
      { kind: 'hero', title: 'For all the ways you move.', ctaLabel: 'Shop tech', href: '/collection/for-tech-lovers', image: '/images/hero-tech.jpg', mobileImage: '/images/hero-tech-mobile.jpg', sortOrder: 0 },
      { kind: 'hero', title: 'Carry smart.\nMove free.\nGo far.', ctaLabel: 'Shop bestsellers', href: '/collection/bestsellers', image: '/images/hero-carry.jpg', mobileImage: '/images/hero-carry-mobile.jpg', sortOrder: 1 },
      { kind: 'hero', title: 'We’ve got\nyour back.', ctaLabel: 'Shop backpacks', href: '/products/category/backpacks', image: '/images/hero-backpacks.jpg', mobileImage: '/images/hero-backpacks-mobile.jpg', sortOrder: 2 },
      { kind: 'highlight', title: 'New cases for iPhone 18', href: '/products/category/phone-cases', image: '/images/highlight-phone.jpg', badge: 'NEW', sortOrder: 0 },
      { kind: 'highlight', title: 'Gear for the gamers', href: '/products/classic-messenger', image: '/images/highlight-gaming.jpg', sortOrder: 1 },
      { kind: 'highlight', title: 'Packing Cubes, Pouches & Caddies', href: '/products/category/accessories', image: '/images/highlight-pouches.jpg', sortOrder: 2 },
      { kind: 'highlight', title: 'Build your perfect travel setup', href: '/collection/travel', image: '/images/highlight-travel.jpg', sortOrder: 3 },
      { kind: 'highlight', title: 'Two new Laneway hues', href: '/collection/laneway', image: '/images/highlight-laneway.jpg', sortOrder: 4 },
      { kind: 'highlight', title: 'Gear up, go far, with Venture', href: '/collection/venture', image: '/images/highlight-venture.jpg', sortOrder: 5 },
      { kind: 'highlight', title: 'Save up to 20% with Value Sets', href: '/collection/value-sets', image: '/images/highlight-sets.jpg', badge: 'SAVE', sortOrder: 6 },
      { kind: 'highlight', title: 'Luggage made for the long haul', href: '/products/category/luggage', image: '/images/highlight-luggage.jpg', sortOrder: 7 },
    ]);
    if (Number(pageCount.total) === 0) await db.insert(contentPages).values(Object.entries(infoPages).map(([slug, page]) => ({ slug, eyebrow: page.eyebrow, eyebrowAr: page.eyebrow, title: page.title, titleAr: page.title, subtitle: page.subtitle, subtitleAr: page.subtitle, image: page.image ? `/images/${page.image}` : null, sections: page.sections ?? [], sectionsAr: page.sections ?? [], faqs: page.faqs ?? [], faqsAr: page.faqs ?? [] }))).onConflictDoNothing();
  })().catch(error => { bootstrapped = null; throw error; });
  return bootstrapped;
}
export const getSettings = cache(async function getSettings(): Promise<StoreSettings> {
  const rows = await db.select().from(settings);
  const merged: Record<string, unknown> = { ...defaultSettings };
  for (const row of rows) merged[row.key] = row.value;
  const homepage = (merged.homepage as HomepageConfig) ?? defaultSettings.homepage;
  // Video stories are database-owned content. Do not recreate deleted rows from
  // the legacy homepage settings when the table becomes empty.
  const videoRows = await db.select().from(videoStories).orderBy(videoStories.sortOrder, videoStories.id);
  const normalizedVideoStories = videoRows.map((item) => ({ youtubeId: item.youtubeId, title: item.title, titleAr: item.titleAr || item.title, cta: item.cta, ctaAr: item.ctaAr || 'شاهد الآن', href: item.href, active: item.active, sortOrder: item.sortOrder }));
  const storedCopy = homepage.copy ?? {};
  const defaultCategoriesById = new Map(defaultSettings.homepage.categories.map(item => [item.id, item]));
  const defaultCollectionsById = new Map(defaultSettings.homepage.collections.map(item => [item.id, item]));
  const defaultIntentsByHref = new Map(defaultSettings.homepage.intents.map(item => [item.href, item]));
  const defaultSocialByImage = new Map(defaultSettings.homepage.social.map(item => [item.image, item]));
  const defaultVideosByYoutube = new Map(defaultSettings.homepage.videoStories.map(item => [item.youtubeId, item]));
  merged.homepage = {
    ...defaultSettings.homepage,
    ...homepage,
    copy: { ...defaultSettings.homepage.copy, ...storedCopy },
    // An empty DB result is intentional: if the admin deletes all stories,
    // the storefront must stay empty instead of falling back to hardcoded videos.
    videoStories: normalizedVideoStories.map((item) => {
      const fallback = defaultVideosByYoutube.get(item.youtubeId);
      return { ...item, titleAr: item.titleAr || fallback?.titleAr || item.title, ctaAr: item.ctaAr || fallback?.cta || 'شاهد الآن' };
    }),
    intents: (homepage.intents ?? defaultSettings.homepage.intents).map((item: any, index: number) => {
      const fallback = defaultIntentsByHref.get(item?.href) ?? defaultSettings.homepage.intents[index];
      return { ...fallback, ...item, titleAr: String(item?.titleAr || fallback?.titleAr || item?.title || ''), subtitleAr: String(item?.subtitleAr || fallback?.subtitleAr || item?.subtitle || ''), sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index };
    }),
    categories: (homepage.categories ?? defaultSettings.homepage.categories).map((item: any, index: number) => {
      const fallback = defaultCategoriesById.get(item?.id) ?? defaultSettings.homepage.categories[index];
      return { ...fallback, ...item, nameAr: String(item?.nameAr || fallback?.nameAr || item?.name || ''), sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index };
    }),
    collections: (homepage.collections ?? defaultSettings.homepage.collections).map((item: any, index) => {
      const fallback = defaultCollectionsById.get(item?.id) ?? defaultSettings.homepage.collections[index];
      return { ...fallback, ...item, slug: item.slug || item.id, titleAr: String(item.titleAr || fallback?.titleAr || item.title || ''), descriptionAr: String(item.descriptionAr || fallback?.descriptionAr || item.description || ''), productIds: Array.isArray(item.productIds) ? item.productIds : (fallback?.productIds ?? []), sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index };
    }),
    social: (homepage.social ?? defaultSettings.homepage.social).map((item: any, index: number) => {
      const fallback = defaultSocialByImage.get(item?.image) ?? defaultSettings.homepage.social[index];
      return { ...fallback, ...item, captionAr: String(item.captionAr || fallback?.captionAr || item.caption || ''), sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index };
    }),
  };
  const navigation = (merged.navigation as NavigationGroup[]) ?? defaultSettings.navigation;
  merged.navigation = Array.isArray(navigation) ? navigation.map((group: any) => ({
    ...group,
    nameAr: String(group?.nameAr ?? group?.name ?? ''),
    captionAr: String(group?.captionAr ?? group?.caption ?? ''),
    links: Array.isArray(group?.links) ? group.links.map((link: any) => ({ label: String(link?.label ?? ''), labelAr: String(link?.labelAr ?? link?.label ?? ''), href: String(link?.href ?? '/') })) : [],
  })) : defaultSettings.navigation;
  const footer = (merged.footer as Partial<FooterConfig>) ?? defaultSettings.footer;
  merged.footer = {
    ...defaultSettings.footer, ...footer,
    groups: Array.isArray(footer.groups) ? footer.groups.map((g: any) => ({ title: String(g?.title ?? ''), titleAr: String(g?.titleAr ?? g?.title ?? ''), links: Array.isArray(g?.links) ? g.links.map((l: any) => ({ label: String(l?.label ?? ''), labelAr: String(l?.labelAr ?? l?.label ?? ''), href: String(l?.href ?? '/') })) : [] })) : defaultSettings.footer.groups,
    trustItems: Array.isArray(footer.trustItems) ? footer.trustItems.map((x: any, i: number) => ({ icon: ['pin','globe','star','badge'].includes(x?.icon) ? x.icon : 'badge', text: String(x?.text ?? ''), textAr: String(x?.textAr ?? x?.text ?? ''), active: x?.active !== false, sortOrder: Number.isFinite(Number(x?.sortOrder)) ? Number(x.sortOrder) : i })) : defaultSettings.footer.trustItems,
    newsletter: { ...defaultSettings.footer.newsletter, ...(footer.newsletter ?? {}), eyebrowAr: String((footer.newsletter as any)?.eyebrowAr ?? (footer.newsletter as any)?.eyebrow ?? ''), titleAr: String((footer.newsletter as any)?.titleAr ?? (footer.newsletter as any)?.title ?? ''), descriptionAr: String((footer.newsletter as any)?.descriptionAr ?? (footer.newsletter as any)?.description ?? '') },
    demoDisclaimer: String(footer.demoDisclaimer ?? defaultSettings.footer.demoDisclaimer),
    demoDisclaimerAr: String((footer as any).demoDisclaimerAr ?? footer.demoDisclaimer ?? defaultSettings.footer.demoDisclaimer),
  };
  return merged as StoreSettings;
});
export const getPublicSettings = cache(async function getPublicSettings() { const all = await getSettings(); return Object.fromEntries(publicKeys.map(key => [key, all[key]])) as Omit<StoreSettings, 'adminPasswordHash'>; });
export async function saveSettings(patch: Partial<StoreSettings>) {
  for (const [key, value] of Object.entries(patch)) await db.insert(settings).values({ key, value: value as object, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value: value as object, updatedAt: new Date() } });
}
export async function getActiveBanners(kind: string, categoryId?: string) {
  await ensureStoreSeeded();
  const now = new Date();
  const rows = await db.select().from(banners).where(eq(banners.kind, kind)).orderBy(banners.sortOrder, banners.id);
  return rows.filter(row => (!categoryId || row.categoryId === categoryId) && row.active && (!row.startsAt || row.startsAt <= now) && (!row.endsAt || row.endsAt >= now));
}
export async function getActiveZones() { await ensureStoreSeeded(); return (await db.select().from(shippingZones).orderBy(shippingZones.sortOrder)).filter(zone => zone.enabled); }
export async function getContentPage(slug: string) { await ensureStoreSeeded(); const [row] = await db.select().from(contentPages).where(eq(contentPages.slug, slug)); return row && row.published ? row : null; }
