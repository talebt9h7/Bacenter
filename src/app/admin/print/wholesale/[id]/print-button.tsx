'use client';
import { Printer } from 'lucide-react';
export function PrintButton() {
  return <div className="inv-toolbar"><button type="button" onClick={() => window.print()}><Printer size={16} /> طباعة / حفظ PDF</button></div>;
}
