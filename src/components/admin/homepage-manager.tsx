'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Pencil, Plus, Save, Trash2 } from 'lucide-react';

import { api, Field, ImageField, Modal, Switch, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { storefrontT } from '@/lib/i18n';
import type { HomepageConfig } from '@/lib/settings';

type Props = { initial: HomepageConfig };

const clone = (value: HomepageConfig): HomepageConfig => JSON.parse(JSON.stringify(value));

export function HomepageManager({ initial }: Props) {
  const { language } = useLanguage();
  const t = (label: string) => storefrontT(label, language);
  const router = useRouter();
  const [data, setData] = useStateWithClone(initial);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ type: 'intent'|'collection'|'social'; index: number } | null>(null);
  const { flash, success, fail } = useFlash();

  async function save(next = data) {
    setBusy(true);
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        json: { homepage: next },
      });
      success('Homepage saved.');
      router.refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof HomepageConfig>(key: K, value: HomepageConfig[K]) {
    setData({ ...data, [key]: value });
  }

  function toggleBlock(key: string) {
    update(
      'blocks',
      data.blocks.map((x) =>
        x.key === key ? { ...x, enabled: !x.enabled } : x
      )
    );
  }

  function remove(type: 'intent'|'collection'|'social', index: number) {
    const next = clone(data);
    const key =
      type === 'intent'
        ? 'intents'
        : type === 'collection'
          ? 'collections'
          : 'social';

    next[key].splice(index, 1);
    update(key, next[key] as any);
  }

  function add(type: 'intent'|'collection'|'social') {
    const next = clone(data);

    if (type === 'intent') {
      next.intents.push({
        image: '',
        title: '',
        subtitle: '',
        href: '/',
        active: true,
        sortOrder: next.intents.length,
      });
    }

    if (type === 'collection') {
      next.collections.push({
        id: `collection-${Date.now()}`,
        slug: `collection-${Date.now()}`,
        title: '',
        titleAr: '',
        description: '',
        descriptionAr: '',
        image: '',
        href: '/',
        active: true,
        sortOrder: next.collections.length,
        productIds: [],
  });
}

    if (type === 'social') {
      next.social.push({
        image: '',
        href: 'https://www.instagram.com/',
        caption: '',
        active: true,
        sortOrder: next.social.length,
      });
    }

    const key =
      type === 'intent'
        ? 'intents'
        : type === 'collection'
          ? 'collections'
          : 'social';

    update(key, next[key] as any);
    setEditing({
      type,
      index: next[key].length - 1,
    });
  }

  const sortedIntents = data.intents
    .map((item, index) => ({ ...item, __index: index }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sortedCollections = data.collections
    .map((item, index) => ({ ...item, __index: index }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sortedSocial = data.social
    .map((item, index) => ({ ...item, __index: index }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const editingItem: any = editing
    ? data[
        editing.type === 'intent'
          ? 'intents'
          : editing.type === 'collection'
            ? 'collections'
            : 'social'
      ][editing.index]
    : null;

  return (
    <>
      {flash}

      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>{t('Homepage sections')}</h2>
            <p className="admin-hint" style={{ margin: '4px 0 0' }}>
              {t('Turn homepage blocks on or off and change their display order.')}
            </p>
          </div>

          <button
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={() => void save()}
            disabled={busy}
          >
            {busy ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}
            Save
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('Section')}</th>
                <th>{t('Status')}</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {[...data.blocks]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((block) => (
                  <tr key={block.key}>
                    <td>
                      <strong>{block.label}</strong>
                    </td>

                    <td>
                      <button
                        className={`admin-badge ${block.enabled ? 'success' : 'muted'}`}
                        onClick={() => toggleBlock(block.key)}
                      >
                        {block.enabled ? 'Visible' : 'Hidden'}
                      </button>
                    </td>

                    <td className="num">
                      <button
                        className="admin-icon-btn"
                        onClick={() => toggleBlock(block.key)}
                      >
                        {block.enabled ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>{t('Homepage copy')}</h2>
            <p className="admin-hint" style={{ margin: '4px 0 0' }}>
              {language === 'ar'
                ? 'أدخل محتوى العربية والإنجليزية بشكل مستقل. الروابط مشتركة بين اللغتين.'
                : 'Enter Arabic and English content independently. Links are shared between both languages.'}
            </p>
          </div>
        </div>

        <div className="admin-form-grid">
          <Field label="Trending eyebrow — English">
            <input
              value={data.copy.trendingEyebrow}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  trendingEyebrow: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Trending eyebrow — العربية">
            <input
              dir="rtl"
              value={data.copy.trendingEyebrowAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  trendingEyebrowAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Trending title — English">
            <input
              value={data.copy.trendingTitle}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  trendingTitle: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Trending title — العربية">
            <input
              dir="rtl"
              value={data.copy.trendingTitleAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  trendingTitleAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Trending link — English">
            <input
              value={data.copy.trendingLink}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  trendingLink: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Trending link — العربية">
            <input
              dir="rtl"
              value={data.copy.trendingLinkAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  trendingLinkAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Trending URL" className="span-2">
            <input
              value={data.copy.trendingHref}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  trendingHref: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category heading — English">
            <input
              value={data.copy.categoryTitle}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryTitle: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category heading — العربية">
            <input
              dir="rtl"
              value={data.copy.categoryTitleAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryTitleAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category card line 1 — English">
            <input
              value={data.copy.categoryDiscoverTitle}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryDiscoverTitle: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category card line 1 — العربية">
            <input
              dir="rtl"
              value={data.copy.categoryDiscoverTitleAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryDiscoverTitleAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category card line 2 — English">
            <input
              value={data.copy.categoryDiscoverLine2}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryDiscoverLine2: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category card line 2 — العربية">
            <input
              dir="rtl"
              value={data.copy.categoryDiscoverLine2Ar || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryDiscoverLine2Ar: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category card link — English">
            <input
              value={data.copy.categoryDiscoverLink}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryDiscoverLink: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category card link — العربية">
            <input
              dir="rtl"
              value={data.copy.categoryDiscoverLinkAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryDiscoverLinkAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category button — English">
            <input
              value={data.copy.categoryLinkPrefix}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryLinkPrefix: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Category button — العربية">
            <input
              dir="rtl"
              value={data.copy.categoryLinkPrefixAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  categoryLinkPrefixAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Collections heading — English">
            <input
              value={data.copy.collectionsTitle}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  collectionsTitle: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Collections heading — العربية">
            <input
              dir="rtl"
              value={data.copy.collectionsTitleAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  collectionsTitleAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Collections link — English">
            <input
              value={data.copy.collectionsLink}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  collectionsLink: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Collections link — العربية">
            <input
              dir="rtl"
              value={data.copy.collectionsLinkAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  collectionsLinkAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Collections URL" className="span-2">
            <input
              value={data.copy.collectionsHref}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  collectionsHref: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Social eyebrow — English">
            <input
              value={data.copy.socialEyebrow}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  socialEyebrow: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Social eyebrow — العربية">
            <input
              dir="rtl"
              value={data.copy.socialEyebrowAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  socialEyebrowAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Social title — English">
            <input
              value={data.copy.socialTitle}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  socialTitle: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Social title — العربية">
            <input
              dir="rtl"
              value={data.copy.socialTitleAr || ''}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  socialTitleAr: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Social handle — English">
            <input
              value={data.copy.socialHandle}
              onChange={(e) =>
                update('copy', {
                  ...data.copy,
                  socialHandle: e.target.value,
                })
              }
            />
          </Field>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>{t('Purpose cards')}</h2>
            <p className="admin-hint" style={{ margin: '4px 0 0' }}>
              {t('The lifestyle cards under the purpose statement.')}
            </p>
          </div>

          <button
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={() => add('intent')}
          >
            <Plus size={14} /> {t('Add')}
          </button>
        </div>

        <div className="admin-banner-grid">
          {sortedIntents.map((item) => (
            <article
              className={`admin-banner-card ${item.active ? '' : 'inactive'}`}
              key={`${item.image}-${item.__index}`}
            >
              <img
                src={
                  item.image
                    ? `/images/${item.image}.jpg`
                    : '/images/placeholder.svg'
                }
                alt=""
              />

              <div className="admin-banner-body">
                <strong>
                  {language === 'ar'
                    ? item.titleAr ||
                      item.title ||
                      t('Untitled card')
                    : item.title || t('Untitled card')}
                </strong>

                <small>
                  {language === 'ar'
                    ? item.subtitleAr || item.subtitle
                    : item.subtitle}{' '}
                  · {item.href}
                </small>

                <div className="admin-banner-actions">
                  <button
                    className="admin-icon-btn"
                    onClick={() =>
                      update(
                        'intents',
                        data.intents.map((x, i) =>
                          i === item.__index
                            ? { ...x, active: !x.active }
                            : x
                        )
                      )
                    }
                  >
                    {item.active ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                  </button>

                  <button
                    className="admin-icon-btn"
                    onClick={() =>
                      setEditing({
                        type: 'intent',
                        index: item.__index,
                      })
                    }
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    className="admin-icon-btn danger"
                    onClick={() => remove('intent', item.__index)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>{t('Shop by category')}</h2>
            <p className="admin-hint" style={{ margin: '4px 0 0' }}>
              {language === 'ar'
                ? 'تصنيفات الصفحة الرئيسية مرتبطة الآن بتصنيفات المنتجات. غيّر الاسم العربي والإنجليزي، الظهور والترتيب من صفحة التصنيفات.'
                : 'Homepage category tabs use the same product categories. Manage English/Arabic names, visibility and order from the Categories page.'}
            </p>
          </div>

          <Link
            href="/admin/categories"
            className="admin-btn admin-btn-primary admin-btn-sm"
          >
            {language === 'ar' ? 'إدارة التصنيفات' : 'Manage categories'}
          </Link>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>{t('Collections')}</h2>
            <p className="admin-hint" style={{ margin: '4px 0 0' }}>
              {t('Control the collection cards displayed near the bottom of the homepage.')}
            </p>
          </div>

          <button
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={() => add('collection')}
          >
            <Plus size={14} /> {t('Add')}
          </button>
        </div>

        <div className="admin-banner-grid">
          {sortedCollections.map((item) => (
            <article
              className={`admin-banner-card ${item.active ? '' : 'inactive'}`}
              key={`${item.id}-${item.__index}`}
            >
              <img
                src={item.image || '/images/placeholder.svg'}
                alt=""
              />

              <div className="admin-banner-body">
                <strong>{item.title || t('Untitled collection')}</strong>
                <small>
                  {item.description} · {item.href}
                </small>

                <div className="admin-banner-actions">
                  <button
                    className="admin-icon-btn"
                    onClick={() =>
                      update(
                        'collections',
                        data.collections.map((x, i) =>
                          i === item.__index
                            ? { ...x, active: !x.active }
                            : x
                        )
                      )
                    }
                  >
                    {item.active ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                  </button>

                  <button
                    className="admin-icon-btn"
                    onClick={() =>
                      setEditing({
                        type: 'collection',
                        index: item.__index,
                      })
                    }
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    className="admin-icon-btn danger"
                    onClick={() =>
                      remove('collection', item.__index)
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>{t('Social / Instagram cards')}</h2>
            <p className="admin-hint" style={{ margin: '4px 0 0' }}>
              {t('Manage the images and links shown in the social strip.')}
            </p>
          </div>

          <button
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={() => add('social')}
          >
            <Plus size={14} /> {t('Add')}
          </button>
        </div>

        <div className="admin-banner-grid">
          {sortedSocial.map((item) => (
            <article
              className={`admin-banner-card ${item.active ? '' : 'inactive'}`}
              key={`${item.image}-${item.__index}`}
            >
              <img
                src={item.image || '/images/placeholder.svg'}
                alt=""
              />

              <div className="admin-banner-body">
                <strong>{item.caption || t('Social card')}</strong>
                <small>{item.href}</small>

                <div className="admin-banner-actions">
                  <button
                    className="admin-icon-btn"
                    onClick={() =>
                      update(
                        'social',
                        data.social.map((x, i) =>
                          i === item.__index
                            ? { ...x, active: !x.active }
                            : x
                        )
                      )
                    }
                  >
                    {item.active ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                  </button>

                  <button
                    className="admin-icon-btn"
                    onClick={() =>
                      setEditing({
                        type: 'social',
                        index: item.__index,
                      })
                    }
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    className="admin-icon-btn danger"
                    onClick={() =>
                      remove('social', item.__index)
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="admin-page-actions">
        <button
          className="admin-btn admin-btn-primary"
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Save size={15} />
          )}
          Save all homepage changes
        </button>
      </div>

      {editing && editingItem && (
        <Modal
          title={`${t('Edit')} ${
            editing.type === 'intent'
              ? t('Purpose cards')
              : editing.type === 'collection'
                ? t('Collections')
                : t('Social card')
          }`}
          onClose={() => setEditing(null)}
          wide
        >
          <div className="admin-form-grid">
            {editing.type === 'intent' && (
              <>
                <ImageField
                  label={t('Image name or URL')}
                  value={editingItem.image}
                  onChange={(image) =>
                    update(
                      'intents',
                      data.intents.map((x, i) =>
                        i === editing.index ? { ...x, image } : x
                      )
                    )
                  }
                  hint="Existing purpose images use names such as intent-travel. You can also enter a full URL."
                />

                <Field label="Title — English">
                  <input
                    value={editingItem.title}
                    onChange={(e) =>
                      update(
                        'intents',
                        data.intents.map((x, i) =>
                          i === editing.index
                            ? { ...x, title: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label="Title — العربية">
                  <input
                    dir="rtl"
                    value={editingItem.titleAr || ''}
                    onChange={(e) =>
                      update(
                        'intents',
                        data.intents.map((x, i) =>
                          i === editing.index
                            ? { ...x, titleAr: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label="Subtitle — English">
                  <input
                    value={editingItem.subtitle}
                    onChange={(e) =>
                      update(
                        'intents',
                        data.intents.map((x, i) =>
                          i === editing.index
                            ? { ...x, subtitle: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label="Subtitle — العربية">
                  <input
                    dir="rtl"
                    value={editingItem.subtitleAr || ''}
                    onChange={(e) =>
                      update(
                        'intents',
                        data.intents.map((x, i) =>
                          i === editing.index
                            ? { ...x, subtitleAr: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label={t('Link')} className="span-2">
                  <input
                    value={editingItem.href}
                    onChange={(e) =>
                      update(
                        'intents',
                        data.intents.map((x, i) =>
                          i === editing.index
                            ? { ...x, href: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>
              </>
            )}

            {editing.type === 'collection' && (
              <>
                <ImageField
                  label={t('Image')}
                  value={editingItem.image}
                  onChange={(image) =>
                    update(
                      'collections',
                      data.collections.map((x, i) =>
                        i === editing.index ? { ...x, image } : x
                      )
                    )
                  }
                />

                <Field label={t('ID')}>
                  <input
                    value={editingItem.id}
                    onChange={(e) =>
                      update(
                        'collections',
                        data.collections.map((x, i) =>
                          i === editing.index
                            ? { ...x, id: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label={t('Title')}>
                  <input
                    value={editingItem.title}
                    onChange={(e) =>
                      update(
                        'collections',
                        data.collections.map((x, i) =>
                          i === editing.index
                            ? { ...x, title: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label={t('Description')}>
                  <input
                    value={editingItem.description}
                    onChange={(e) =>
                      update(
                        'collections',
                        data.collections.map((x, i) =>
                          i === editing.index
                            ? { ...x, description: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label={t('Link')} className="span-2">
                  <input
                    value={editingItem.href}
                    onChange={(e) =>
                      update(
                        'collections',
                        data.collections.map((x, i) =>
                          i === editing.index
                            ? { ...x, href: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>
              </>
            )}

            {editing.type === 'social' && (
              <>
                <ImageField
                  label={t('Image')}
                  value={editingItem.image}
                  onChange={(image) =>
                    update(
                      'social',
                      data.social.map((x, i) =>
                        i === editing.index ? { ...x, image } : x
                      )
                    )
                  }
                />

                <Field label={t('Link')} className="span-2">
                  <input
                    value={editingItem.href}
                    onChange={(e) =>
                      update(
                        'social',
                        data.social.map((x, i) =>
                          i === editing.index
                            ? { ...x, href: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label="Caption — English">
                  <input
                    value={editingItem.caption}
                    onChange={(e) =>
                      update(
                        'social',
                        data.social.map((x, i) =>
                          i === editing.index
                            ? { ...x, caption: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>

                <Field label="Caption — العربية">
                  <input
                    dir="rtl"
                    value={editingItem.captionAr || ''}
                    onChange={(e) =>
                      update(
                        'social',
                        data.social.map((x, i) =>
                          i === editing.index
                            ? { ...x, captionAr: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </Field>
              </>
            )}

            <div className="span-2">
              <Switch
                checked={editingItem.active}
                onChange={(active) => {
                  const key =
                    editing.type === 'intent'
                      ? 'intents'
                      : editing.type === 'collection'
                        ? 'collections'
                        : 'social';

                  update(
                    key,
                    data[key].map((x, i) =>
                      i === editing.index ? { ...x, active } : x
                    ) as any
                  );
                }}
                label={editingItem.active ? 'Visible' : 'Hidden'}
              />
            </div>
          </div>

          <div className="admin-modal-actions">
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => setEditing(null)}
            >
              Close
            </button>

            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setEditing(null)}
            >
              <Save size={15} /> Apply
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function useStateWithClone(initial: HomepageConfig) {
  return useState<HomepageConfig>(() => clone(initial));
}