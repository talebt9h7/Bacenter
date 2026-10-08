import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  hashPassword,
  ownerPasswordMatches,
  requireAdminSection,
  getAdminActor,
} from '@/lib/admin-auth';
import {
  defaultSettings,
  getPublicSettings,
  getSettings,
  saveSettings,
  type StoreSettings,
} from '@/lib/settings';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (
    !(await requireAdminSection('configuration', 'view'))
  ) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    settings: await getPublicSettings(),
  });
}

export async function PUT(request: NextRequest) {
  if (
    !(await requireAdminSection('configuration', 'manage'))
  ) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));

  if (body.password) {
    const actor = await getAdminActor();

    if (!actor || actor.type !== 'owner') {
      return NextResponse.json(
        {
          error:
            'Only the store owner can change the master password.',
        },
        { status: 403 }
      );
    }

    if (
      typeof body.currentPassword !== 'string' ||
      !(await ownerPasswordMatches(body.currentPassword))
    ) {
      return NextResponse.json(
        {
          error: 'The current password is incorrect.',
        },
        { status: 400 }
      );
    }

    if (
      typeof body.password !== 'string' ||
      body.password.length < 8 ||
      body.password.length > 128
    ) {
      return NextResponse.json(
        {
          error:
            'The new password needs at least 8 characters.',
        },
        { status: 400 }
      );
    }

    await saveSettings({
      adminPasswordHash: hashPassword(body.password),
    });

    await logActivity(
      'settings.password',
      'settings'
    );

    return NextResponse.json({ ok: true });
  }

  const patch: Partial<StoreSettings> = {};

  const strings: (keyof StoreSettings)[] = [
    'storeName',
    'tagline',
    'logoUrl',
    'logoAlt',
    'faviconUrl',
    'metaTitle',
    'metaDescription',
    'canonicalBaseUrl',
    'ogImage',
    'announcement',
    'announcementHref',
    'supportEmail',
    'supportPhone',
    'whatsapp',
    'instagram',
    'youtube',
    'facebook',
    'address',
    'footerTagline',
    'copyrightText',
    'orderPrefix',
    'checkoutNote',
    'homeHeadline',
    'homeHeadlineAr',
    'homeSubheadline',
    'homeSubheadlineAr',
  ];

  for (const key of strings) {
    if (typeof body[key] === 'string') {
      (patch as Record<string, unknown>)[key] =
        body[key]
          .trim()
          .slice(
            0,
            key === 'checkoutNote' ||
            key === 'tagline'
              ? 400
              : 200
          );
    }
  }

  for (const key of [
    'exchangeRate',
    'freeShippingThreshold',
    'codFee',
    'lowStockThreshold',
  ] as const) {
    if (body[key] !== undefined) {
      const value = Number(body[key]);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return NextResponse.json(
          {
            error: `${key} must be a positive number.`,
          },
          { status: 400 }
        );
      }

      patch[key] = Math.round(value);
    }
  }

  if (
    patch.exchangeRate !== undefined &&
    patch.exchangeRate < 1
  ) {
    return NextResponse.json(
      {
        error:
          'The exchange rate must be at least 1.',
      },
      { status: 400 }
    );
  }

  if (typeof body.codEnabled === 'boolean') {
    patch.codEnabled = body.codEnabled;
  }

  if (patch.orderPrefix !== undefined) {
    patch.orderPrefix =
      patch.orderPrefix
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) ||
      defaultSettings.orderPrefix;
  }

  if (Array.isArray(body.navigation)) {
    patch.navigation = body.navigation
      .slice(0, 20)
      .map((group: any) => ({
        name: String(
          group.name ?? ''
        )
          .trim()
          .slice(0, 80),

        nameAr: String(
          group.nameAr ??
          group.name ??
          ''
        )
          .trim()
          .slice(0, 80),

        href: String(
          group.href ?? '/'
        )
          .trim()
          .slice(0, 300),

        image: String(
          group.image ?? ''
        )
          .trim()
          .slice(0, 300),

        caption: String(
          group.caption ?? ''
        )
          .trim()
          .slice(0, 200),

        captionAr: String(
          group.captionAr ??
          group.caption ??
          ''
        )
          .trim()
          .slice(0, 200),

        links: Array.isArray(group.links)
          ? group.links
              .slice(0, 20)
              .map((link: any) => ({
                label: String(
                  link.label ?? ''
                )
                  .trim()
                  .slice(0, 80),

                labelAr: String(
                  link.labelAr ??
                  link.label ??
                  ''
                )
                  .trim()
                  .slice(0, 80),

                href: String(
                  link.href ?? '/'
                )
                  .trim()
                  .slice(0, 300),
              }))
              .filter(
                (link: { label: string }) =>
                  link.label
              )
          : [],
      }))
      .filter(
        (group: { name: string }) =>
          group.name
      );
  }

  if (
    body.footer &&
    typeof body.footer === 'object'
  ) {
    const f = body.footer as any;

    const clean = (
      v: unknown,
      max = 300
    ) =>
      String(v ?? '')
        .trim()
        .slice(0, max);

    const groups = Array.isArray(f.groups)
      ? f.groups
          .slice(0, 8)
          .map((g: any) => ({
            title: clean(
              g?.title,
              80
            ),

            titleAr: clean(
              g?.titleAr ??
              g?.title,
              80
            ),

            links: Array.isArray(g?.links)
              ? g.links
                  .slice(0, 20)
                  .map((l: any) => ({
                    label: clean(
                      l?.label,
                      100
                    ),

                    labelAr: clean(
                      l?.labelAr ??
                      l?.label,
                      100
                    ),

                    href: clean(
                      l?.href || '/',
                      400
                    ),
                  }))
                  .filter(
                    (l: any) =>
                      l.label
                  )
              : [],
          }))
          .filter(
            (g: any) =>
              g.title
          )
      : [];

    const trustItems = Array.isArray(
      f.trustItems
    )
      ? f.trustItems
          .slice(0, 8)
          .map((x: any, i: number) => ({
            icon: [
              'pin',
              'globe',
              'star',
              'badge',
            ].includes(x?.icon)
              ? x.icon
              : 'badge',

            text: clean(
              x?.text,
              120
            ),

            textAr: clean(
              x?.textAr ??
              x?.text,
              120
            ),

            active:
              x?.active !== false,

            sortOrder:
              Number.isFinite(
                Number(x?.sortOrder)
              )
                ? Math.round(
                    Number(
                      x.sortOrder
                    )
                  )
                : i,
          }))
          .filter(
            (x: any) =>
              x.text
          )
      : [];

    const n =
      f.newsletter &&
      typeof f.newsletter ===
        'object'
        ? f.newsletter
        : {};

    patch.footer = {
      groups,
      trustItems,

      newsletter: {
        eyebrow: clean(
          n.eyebrow,
          120
        ),

        eyebrowAr: clean(
          n.eyebrowAr ??
          n.eyebrow,
          120
        ),

        title: clean(
          n.title,
          180
        ),

        titleAr: clean(
          n.titleAr ??
          n.title,
          180
        ),

        description: clean(
          n.description,
          300
        ),

        descriptionAr: clean(
          n.descriptionAr ??
          n.description,
          300
        ),

        image: clean(
          n.image,
          400
        ),

        active:
          n.active !== false,
      },

      demoDisclaimer: clean(
        f.demoDisclaimer,
        300
      ),

      demoDisclaimerAr: clean(
        f.demoDisclaimerAr ??
        f.demoDisclaimer,
        300
      ),
    };
  }

  if (Array.isArray(body.homeValues)) {
    patch.homeValues = body.homeValues
      .slice(0, 6)
      .map(
        (item: {
          title?: unknown;
          text?: unknown;
          titleAr?: unknown;
          textAr?: unknown;
        }) => ({
          title: String(
            item.title ?? ''
          ).slice(0, 80),

          titleAr: String(
            item.titleAr ??
            item.title ??
            ''
          ).slice(0, 80),

          text: String(
            item.text ?? ''
          ).slice(0, 300),

          textAr: String(
            item.textAr ??
            item.text ??
            ''
          ).slice(0, 300),
        })
      )
      .filter(
        (item: { title: string }) =>
          item.title
      );
  }

  if (
    body.homepage &&
    typeof body.homepage === 'object'
  ) {
    const existing =
      await getSettings();

    const hp = {
      ...(existing.homepage as Record<
        string,
        unknown
      >),
      ...(body.homepage as Record<
        string,
        unknown
      >),
    };

    const clean = (
      value: unknown,
      max = 1000
    ) =>
      String(value ?? '')
        .trim()
        .slice(0, max);

    const arr = (value: unknown) =>
      Array.isArray(value)
        ? value
        : [];

    const copy =
      hp.copy &&
      typeof hp.copy === 'object'
        ? (hp.copy as Record<
            string,
            unknown
          >)
        : {};

    patch.homepage = {
      copy: {
        trendingEyebrow: clean(
          copy.trendingEyebrow,
          120
        ),

        trendingEyebrowAr:
          clean(
            copy.trendingEyebrowAr,
            120
          ) ||
          clean(
            copy.trendingEyebrow,
            120
          ),

        trendingTitle: clean(
          copy.trendingTitle,
          120
        ),

        trendingTitleAr:
          clean(
            copy.trendingTitleAr,
            120
          ) ||
          clean(
            copy.trendingTitle,
            120
          ),

        trendingLink: clean(
          copy.trendingLink,
          120
        ),

        trendingLinkAr:
          clean(
            copy.trendingLinkAr,
            120
          ) ||
          clean(
            copy.trendingLink,
            120
          ),

        trendingHref: clean(
          copy.trendingHref || '/',
          300
        ),

        categoryTitle: clean(
          copy.categoryTitle,
          160
        ),

        categoryTitleAr:
          clean(
            copy.categoryTitleAr,
            160
          ) ||
          clean(
            copy.categoryTitle,
            160
          ),

        categoryDiscoverTitle:
          clean(
            copy.categoryDiscoverTitle,
            100
          ),

        categoryDiscoverTitleAr:
          clean(
            copy.categoryDiscoverTitleAr,
            100
          ) ||
          clean(
            copy.categoryDiscoverTitle,
            100
          ),

        categoryDiscoverLine2:
          clean(
            copy.categoryDiscoverLine2,
            100
          ),

        categoryDiscoverLine2Ar:
          clean(
            copy.categoryDiscoverLine2Ar,
            100
          ) ||
          clean(
            copy.categoryDiscoverLine2,
            100
          ),

        categoryDiscoverLink:
          clean(
            copy.categoryDiscoverLink,
            120
          ),

        categoryDiscoverLinkAr:
          clean(
            copy.categoryDiscoverLinkAr,
            120
          ) ||
          clean(
            copy.categoryDiscoverLink,
            120
          ),

        categoryLinkPrefix:
          clean(
            copy.categoryLinkPrefix,
            80
          ),

        categoryLinkPrefixAr:
          clean(
            copy.categoryLinkPrefixAr,
            80
          ) ||
          clean(
            copy.categoryLinkPrefix,
            80
          ),

        collectionsTitle:
          clean(
            copy.collectionsTitle,
            160
          ),

        collectionsTitleAr:
          clean(
            copy.collectionsTitleAr,
            160
          ) ||
          clean(
            copy.collectionsTitle,
            160
          ),

        collectionsLink:
          clean(
            copy.collectionsLink,
            120
          ),

        collectionsLinkAr:
          clean(
            copy.collectionsLinkAr,
            120
          ) ||
          clean(
            copy.collectionsLink,
            120
          ),

        collectionsHref: clean(
          copy.collectionsHref || '/',
          300
        ),

        socialEyebrow: clean(
          copy.socialEyebrow,
          120
        ),

        socialEyebrowAr:
          clean(
            copy.socialEyebrowAr,
            120
          ) ||
          clean(
            copy.socialEyebrow,
            120
          ),

        socialTitle: clean(
          copy.socialTitle,
          160
        ),

        socialTitleAr:
          clean(
            copy.socialTitleAr,
            160
          ) ||
          clean(
            copy.socialTitle,
            160
          ),

        socialHandle: clean(
          copy.socialHandle,
          120
        ),
      },

      intents: arr(hp.intents)
        .slice(0, 12)
        .map(
          (
            item: any,
            index: number
          ) => ({
            image: clean(
              item.image,
              300
            ),

            title: clean(
              item.title,
              100
            ),

            titleAr:
              clean(
                item.titleAr,
                100
              ) ||
              clean(
                item.title,
                100
              ),

            subtitle: clean(
              item.subtitle,
              160
            ),

            subtitleAr:
              clean(
                item.subtitleAr,
                160
              ) ||
              clean(
                item.subtitle,
                160
              ),

            href: clean(
              item.href || '/',
              300
            ),

            active:
              item.active !== false,

            sortOrder:
              Number.isFinite(
                Number(
                  item.sortOrder
                )
              )
                ? Math.round(
                    Number(
                      item.sortOrder
                    )
                  )
                : index,
          })
        )
        .filter(
          (x: any) =>
            x.title
        ),

      categories: arr(hp.categories)
        .slice(0, 20)
        .map(
          (
            item: any,
            index: number
          ) => ({
            id: clean(
              item.id,
              80
            ),

            name: clean(
              item.name,
              100
            ),

            nameAr:
              clean(
                item.nameAr,
                100
              ) ||
              clean(
                item.name,
                100
              ),

            active:
              item.active !== false,

            sortOrder:
              Number.isFinite(
                Number(
                  item.sortOrder
                )
              )
                ? Math.round(
                    Number(
                      item.sortOrder
                    )
                  )
                : index,
          })
        )
        .filter(
          (x: any) =>
            x.id &&
            x.name
        ),

      collections: arr(
        hp.collections
      )
        .slice(0, 50)
        .map(
          (
            item: any,
            index: number
          ) => ({
            id: clean(
              item.id,
              80
            ),

            slug: clean(
              item.slug ||
              item.id ||
              '',
              120
            )
              .toLowerCase()
              .replace(
                /[^a-z0-9-]/g,
                '-'
              )
              .replace(
                /-+/g,
                '-'
              )
              .replace(
                /^-|-$/g,
                ''
              ),

            title: clean(
              item.title,
              100
            ),

            titleAr:
              clean(
                item.titleAr,
                100
              ) ||
              clean(
                item.title,
                100
              ),

            description: clean(
              item.description,
              200
            ),

            descriptionAr:
              clean(
                item.descriptionAr,
                200
              ) ||
              clean(
                item.description,
                200
              ),

            image: clean(
              item.image,
              300
            ),

            href: clean(
              item.href ||
              `/collection/${clean(
                item.slug ||
                item.id ||
                '',
                120
              )}`,
              300
            ),

            active:
              item.active !== false,

            sortOrder:
              Number.isFinite(
                Number(
                  item.sortOrder
                )
              )
                ? Math.round(
                    Number(
                      item.sortOrder
                    )
                  )
                : index,

            productIds: arr(
              item.productIds
            )
              .slice(0, 100)
              .map(
                (
                  id: unknown
                ) =>
                  clean(
                    id,
                    120
                  )
              )
              .filter(Boolean),
          })
        )
        .filter(
          (x: any) =>
            x.title &&
            x.slug
        ),

      social: arr(hp.social)
        .slice(0, 20)
        .map(
          (
            item: any,
            index: number
          ) => ({
            image: clean(
              item.image,
              300
            ),

            href: clean(
              item.href || '/',
              500
            ),

            caption: clean(
              item.caption,
              160
            ),

            captionAr:
              clean(
                item.captionAr,
                160
              ) ||
              clean(
                item.caption,
                160
              ),

            active:
              item.active !== false,

            sortOrder:
              Number.isFinite(
                Number(
                  item.sortOrder
                )
              )
                ? Math.round(
                    Number(
                      item.sortOrder
                    )
                  )
                : index,
          })
        )
        .filter(
          (x: any) =>
            x.image
        ),

      videoStories: arr(
        hp.videoStories
      )
        .slice(0, 20)
        .map(
          (
            item: any,
            index: number
          ) => ({
            youtubeId: clean(
              item.youtubeId,
              100
            ),

            title: clean(
              item.title,
              160
            ),

            cta: clean(
              item.cta,
              120
            ),

            href: clean(
              item.href || '/',
              300
            ),

            active:
              item.active !== false,

            sortOrder:
              Number.isFinite(
                Number(
                  item.sortOrder
                )
              )
                ? Math.round(
                    Number(
                      item.sortOrder
                    )
                  )
                : index,
          })
        )
        .filter(
          (x: any) =>
            x.youtubeId &&
            x.title
        ),

      blocks: arr(hp.blocks)
        .slice(0, 20)
        .map(
          (
            item: any,
            index: number
          ) => ({
            key: clean(
              item.key,
              80
            ),

            label: clean(
              item.label,
              100
            ),

            enabled:
              item.enabled !== false,

            sortOrder:
              Number.isFinite(
                Number(
                  item.sortOrder
                )
              )
                ? Math.round(
                    Number(
                      item.sortOrder
                    )
                  )
                : index,
          })
        )
        .filter(
          (x: any) =>
            x.key
        ),
    };
  }

  await saveSettings(patch);

  await logActivity(
    'settings.update',
    'settings',
    undefined,
    Object.keys(patch).join(', ')
  );

  revalidatePath('/');

  return NextResponse.json({
    settings:
      await getPublicSettings(),
  });
}