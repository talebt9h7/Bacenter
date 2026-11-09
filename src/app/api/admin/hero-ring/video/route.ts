import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { media } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The hosting platform accepts request bodies up to about 4.5 MB, so the video must stay under 4 MB.
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = new Set(['video/mp4', 'video/webm']);

/** Admin → Homepage: uploads the short hero video (MP4/WebM) into the media library. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('storefront', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ar = (request.cookies.get('UR_lang')?.value ?? 'ar') !== 'en';
  try {
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: ar ? 'اختر ملف فيديو.' : 'Choose a video file.' }, { status: 400 });
    if (!TYPES.has(file.type)) return NextResponse.json({ error: ar ? 'الفيديو لازم يكون MP4 أو WebM.' : 'The video must be MP4 or WebM.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: ar ? `حجم الفيديو ${(file.size / 1048576).toFixed(1)} ميغا. الحد 4 ميغا: قصّره إلى 6–10 ثواني بدقة 720 وبدون صوت، أو حط رابط فيديو مباشر.` : `The video is ${(file.size / 1048576).toFixed(1)} MB. The limit is 4 MB: trim it to 6–10 s at 720p without sound, or paste a direct video link.` }, { status: 413 });
    const data = Buffer.from(await file.arrayBuffer());
    const [row] = await db.insert(media).values({ filename: file.name.slice(0, 200), mimeType: file.type, size: data.length, data }).returning({ id: media.id });
    return NextResponse.json({ video: `/api/video/${row.id}` }, { status: 201 });
  } catch (error) {
    console.error('Hero video upload failed', error);
    return NextResponse.json({ error: ar ? 'ما انرفع الفيديو. إذا حجمه أكبر من 4 ميغا صغّره وجرب مرة ثانية.' : 'The upload failed. If the file is over 4 MB, make it smaller and try again.' }, { status: 500 });
  }
}
