import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { supportMessages } from '@/db/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !subject || subject.length > 100 || message.length < 10 || message.length > 5000) return NextResponse.json({ error: 'Please complete all fields and write a message of 10–5000 characters.' }, { status: 400 });
    const [entry] = await db.insert(supportMessages).values({ name, email, subject, message }).returning({ id: supportMessages.id });
    return NextResponse.json({ reference: `HELP-${entry.id}`, message: 'Your message has been saved. This demonstration does not send emails to Bellroy.' }, { status: 201 });
  } catch (error) { console.error('Contact form failed', error); return NextResponse.json({ error: 'Your message could not be saved. Please try again.' }, { status: 500 }); }
}
