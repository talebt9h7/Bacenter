import { pgTable, serial, text, integer, timestamp, uniqueIndex, jsonb, boolean, customType, index } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType() { return 'bytea'; } });

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull().default(''),
  description: text('description').notNull().default(''),
  descriptionAr: text('description_ar').notNull().default(''),
  image: text('image'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('categories_active_idx').on(table.active), index('categories_sort_idx').on(table.sortOrder)]);

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull().default(''),
  subtitle: text('subtitle').notNull().default(''),
  subtitleAr: text('subtitle_ar').notNull().default(''),
  description: text('description').notNull().default(''),
  descriptionAr: text('description_ar').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  salePriceIqd: integer('sale_price_iqd').notNull().default(0),
  category: text('category').notNull(),
  capacity: text('capacity'),
  badge: text('badge'),
  badgeAr: text('badge_ar'),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  dimensions: text('dimensions').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  published: boolean('published').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull().default(''),
  hex: text('hex').notNull().default('#333333'),
  stock: integer('stock').notNull().default(0),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  primaryIndex: integer('primary_index').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [index('variants_product_idx').on(table.productId)]);

export const inventoryBatches = pgTable('inventory_batches', {
  id: serial('id').primaryKey(),
  variantId: integer('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  batchNumber: text('batch_number').notNull(),
  quantityReceived: integer('quantity_received').notNull(),
  quantityRemaining: integer('quantity_remaining').notNull(),
  purchaseCostIqd: integer('purchase_cost_iqd'),
  purchaseCostUsdCents: integer('purchase_cost_usd_cents'),
  purchaseExchangeRate: integer('purchase_exchange_rate'),
  salePriceCents: integer('sale_price_cents'),
  salePriceIqd: integer('sale_price_iqd'),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  notes: text('notes'),
}, (table) => [index('batches_variant_idx').on(table.variantId), index('batches_received_idx').on(table.receivedAt)]);

export const inventoryMovements = pgTable('inventory_movements', {
  id: serial('id').primaryKey(),
  variantId: integer('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  stockAfter: integer('stock_after').notNull(),
  reason: text('reason').notNull(),
  reference: text('reference'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [index('movements_variant_idx').on(table.variantId)]);

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  variantId: integer('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('cart_session_variant').on(table.sessionId, table.variantId)]);

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const supportMessages = pgTable('support_messages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull(),
  email: text('email'),
  governorate: text('governorate'),
  ordersCount: integer('orders_count').notNull().default(0),
  totalSpent: integer('total_spent').notNull().default(0),
  note: text('note'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  preferredChannel: text('preferred_channel').notNull().default('whatsapp'),
  lastContactAt: timestamp('last_contact_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastOrderAt: timestamp('last_order_at'),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  sessionId: text('session_id').notNull(),
  customerId: integer('customer_id'),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  governorate: text('governorate').notNull().default(''),
  address: jsonb('address').notNull(),
  items: jsonb('items').notNull(),
  currency: text('currency').notNull().default('USD'),
  exchangeRate: integer('exchange_rate').notNull().default(1),
  subtotalCents: integer('subtotal_cents').notNull(),
  shippingCents: integer('shipping_cents').notNull(),
  discountCents: integer('discount_cents').notNull().default(0),
  codFeeCents: integer('cod_fee_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  profitIqd: integer('profit_iqd'),
  couponCode: text('coupon_code'),
  paymentMethod: text('payment_method').notNull().default('cod'),
  paymentStatus: text('payment_status').notNull().default('unpaid'),
  status: text('status').notNull().default('pending'),
  customerNote: text('customer_note'),
  adminNote: text('admin_note'),
  trackingNumber: text('tracking_number'),
  courier: text('courier'),
  source: text('source').notNull().default('website'),
  sourceNote: text('source_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('orders_status_idx').on(table.status), index('orders_phone_idx').on(table.phone)]);

export const orderEvents = pgTable('order_events', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [index('events_order_idx').on(table.orderId)]);

export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  rate: integer('rate').notNull().default(5000),
  minDays: integer('min_days').notNull().default(2),
  maxDays: integer('max_days').notNull().default(4),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  type: text('type').notNull().default('percent'),
  value: integer('value').notNull(),
  minSubtotal: integer('min_subtotal').notNull().default(0),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  freeShipping: boolean('free_shipping').notNull().default(false),
  active: boolean('active').notNull().default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const banners = pgTable('banners', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull().default('hero'),
  categoryId: text('category_id'),
  title: text('title').notNull(),
  titleAr: text('title_ar'),
  subtitle: text('subtitle'),
  subtitleAr: text('subtitle_ar'),
  ctaLabel: text('cta_label'),
  ctaLabelAr: text('cta_label_ar'),
  href: text('href').notNull().default('/'),
  image: text('image').notNull(),
  mobileImage: text('mobile_image'),
  badge: text('badge'),
  active: boolean('active').notNull().default(true),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contentPages = pgTable('content_pages', {
  slug: text('slug').primaryKey(),
  eyebrow: text('eyebrow').notNull().default(''),
  eyebrowAr: text('eyebrow_ar').notNull().default(''),
  title: text('title').notNull(),
  titleAr: text('title_ar').notNull().default(''),
  subtitle: text('subtitle').notNull().default(''),
  subtitleAr: text('subtitle_ar').notNull().default(''),
  image: text('image'),
  sections: jsonb('sections').$type<{ title: string; text: string }[]>().notNull().default([]),
  sectionsAr: jsonb('sections_ar').$type<{ title: string; text: string }[]>().notNull().default([]),
  faqs: jsonb('faqs').$type<{ question: string; answer: string }[]>().notNull().default([]),
  faqsAr: jsonb('faqs_ar').$type<{ question: string; answer: string }[]>().notNull().default([]),
  published: boolean('published').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const videoStories = pgTable('video_stories', {
  id: serial('id').primaryKey(),
  youtubeId: text('youtube_id').notNull(),
  title: text('title').notNull().default(''),
  titleAr: text('title_ar').notNull().default(''),
  cta: text('cta').notNull().default('Watch now'),
  ctaAr: text('cta_ar').notNull().default('شاهد الآن'),
  href: text('href').notNull().default('/'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('video_stories_sort_idx').on(table.sortOrder), index('video_stories_active_idx').on(table.active)]);


export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('manager'),
  permissions: jsonb('permissions').$type<Record<string, { view: boolean; manage: boolean }>>().notNull().default({}),
  active: boolean('active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('admin_users_role_idx').on(table.role), index('admin_users_active_idx').on(table.active)]);


export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  category: text('category').notNull().default('other'),
  description: text('description').notNull(),
  amountIqd: integer('amount_iqd').notNull(),
  expenseDate: timestamp('expense_date').defaultNow().notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  country: text('country'),
  address: text('address'),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('suppliers_name_idx').on(table.name)]);

export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('received'),
  totalCostIqd: integer('total_cost_iqd').notNull().default(0),
  purchaseDate: timestamp('purchase_date').defaultNow().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('purchases_supplier_idx').on(table.supplierId), index('purchases_date_idx').on(table.purchaseDate)]);

export const purchaseItems = pgTable('purchase_items', {
  id: serial('id').primaryKey(),
  purchaseId: integer('purchase_id').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  variantId: integer('variant_id').notNull().references(() => productVariants.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull(),
  purchaseCostIqd: integer('purchase_cost_iqd').notNull(),
  purchaseCostUsdCents: integer('purchase_cost_usd_cents'),
  purchaseExchangeRate: integer('purchase_exchange_rate'),
  salePriceCents: integer('sale_price_cents'),
  salePriceIqd: integer('sale_price_iqd'),
  batchId: integer('batch_id').references(() => inventoryBatches.id, { onDelete: 'set null' }),
  notes: text('notes'),
}, (table) => [index('purchase_items_purchase_idx').on(table.purchaseId), index('purchase_items_variant_idx').on(table.variantId)]);


export const storeLocations = pgTable('store_locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull().default(''),
  address: text('address').notNull().default(''),
  addressAr: text('address_ar').notNull().default(''),
  description: text('description').notNull().default(''),
  descriptionAr: text('description_ar').notNull().default(''),
  mapUrl: text('map_url').notNull().default(''),
  phone: text('phone'),
  hours: text('hours').notNull().default(''),
  hoursAr: text('hours_ar').notNull().default(''),
  image: text('image'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('store_locations_active_sort_idx').on(table.active, table.sortOrder, table.id)]);

export const urlRedirects = pgTable('url_redirects', {
  id: serial('id').primaryKey(),
  sourcePath: text('source_path').notNull().unique(),
  destinationPath: text('destination_path').notNull(),
  statusCode: integer('status_code').notNull().default(301),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('url_redirects_active_idx').on(table.active)]);
