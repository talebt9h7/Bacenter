import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsletterSubscribers } from '@/db/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    await db.insert(newsletterSubscribers).values({ email }).onConflictDoNothing();
    return NextResponse.json({ message: 'You’re on the list! Thanks for joining our community.' });
  } catch (error) { console.error('Newsletter signup failed', error); return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 }); }
}
