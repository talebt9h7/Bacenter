import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import Link from 'next/link';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ArrowLeft, ShoppingBag, WalletCards, Tag, Repeat2 } from 'lucide-react';
import { db } from '@/db';
import { customers, orders, products } from '@/db/schema';
import { iqd, when } from '@/lib/format';
import { statusLabels } from '@/lib/iraq';
import { CustomerProfileClient } from '@/components/admin/customer-profile-client';

export const metadata = { title: 'Customer' };

type Item = { productId?:string; name:string; quantity:number; unitPrice?:number };
const bagCategories = ['backpacks','crossbody-bags','tote-bags','work-bags','luggage'];

export default async function CustomerProfilePage({ params }: { params: Promise<{ id:string }> }) {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const { id } = await params;
  const [customer] = await db.select().from(customers).where(eq(customers.id, Number(id)));
  if (!customer) return <main className="admin-page"><Link className="admin-link" href="/admin/customers">← Customers</Link><div className="admin-card"><p className="admin-empty">Customer not found.</p></div></main>;
  const history = await db.select().from(orders).where(eq(orders.customerId, customer.id)).orderBy(desc(orders.createdAt));
  const productIds = [...new Set(history.flatMap(order => (order.items as Item[]).map(item=>item.productId).filter(Boolean) as string[]))];
  const productRows = productIds.length ? await db.select({id:products.id,name:products.name,category:products.category}).from(products).where(inArray(products.id, productIds)) : [];
  const productMap = new Map(productRows.map(p=>[p.id,p]));
  const purchased = new Map<string,{name:string;category:string;quantity:number;lastOrder:Date}>();
  for (const order of history) for (const item of order.items as Item[]) {
    const p = item.productId ? productMap.get(item.productId) : undefined; const key = item.productId || item.name;
    const existing = purchased.get(key); if (existing) { existing.quantity += item.quantity; if (new Date(order.createdAt)>existing.lastOrder) existing.lastOrder=new Date(order.createdAt); } else purchased.set(key,{name:item.name,category:p?.category||'other',quantity:item.quantity,lastOrder:new Date(order.createdAt)});
  }
  const categories = [...new Set([...purchased.values()].map(x=>x.category))];
  const isWalletBuyer = categories.includes('wallets'); const isBagBuyer = categories.some(x=>bagCategories.includes(x)); const isAccessoryBuyer = categories.includes('accessories');
  const templates = [
    isWalletBuyer ? {label:'Wallet → new bags',text:`هلا ${customer.name} 👋\nبما أنك من عملائنا الذين اشتروا من قسم المحافظ، حبيت نخبرك أنه توفرت عندنا مجموعة جديدة من الحقائب. إذا تحب أرسل لك الصور والتفاصيل.`} : null,
    isBagBuyer ? {label:'Bag → accessories',text:`هلا ${customer.name} 👋\nبما أنك اشتريت من منتجات الحقائب عندنا، توفرت عندنا إكسسوارات جديدة ممكن تناسب استخدامك. إذا تحب أرسل لك الخيارات المتوفرة.`} : null,
    isAccessoryBuyer ? {label:'Accessory → bags',text:`هلا ${customer.name} 👋\nتوفرت عندنا مجموعة جديدة من الحقائب، وحبيت أشاركك الخيارات الجديدة إذا تحب تشوفها.`} : null,
    {label:'General follow-up',text:`هلا ${customer.name} 👋\nنتمنى المنتج عجبك. توفرت عندنا منتجات جديدة، وإذا تحب أرسل لك آخر الإضافات والأسعار.`},
  ].filter(Boolean) as {label:string;text:string}[];
  return <main className="admin-page">
    <div className="admin-page-heading"><div><Link href="/admin/customers" className="admin-link"><ArrowLeft size={14}/> All customers</Link><span className="admin-eyebrow">CRM · Customer profile</span><h1>{customer.name}</h1><p>{customer.phone}{customer.email ? ` · ${customer.email}` : ''}</p></div></div>
    <div className="admin-stat-grid"><div className="admin-stat"><span>Orders</span><strong>{history.filter(o=>!['cancelled','returned'].includes(o.status)).length}</strong></div><div className="admin-stat"><span>Product spend</span><strong>{iqd(customer.totalSpent)}</strong></div><div className="admin-stat"><span>Products</span><strong>{purchased.size}</strong></div><div className="admin-stat"><span>Segments</span><strong>{[isWalletBuyer,isBagBuyer,isAccessoryBuyer,history.length>1].filter(Boolean).length}</strong></div></div>
    <CustomerProfileClient customer={{...customer,lastContactAt:customer.lastContactAt}} phoneUrl={`tel:${customer.phone}`} messages={templates}/>
    <section className="admin-card"><div className="admin-card-heading"><h2><ShoppingBag size={17}/> What they bought</h2><span className="admin-count">{purchased.size} products</span></div><div className="admin-customer-products">{[...purchased.values()].map(item=><div key={item.name} className="admin-customer-product"><div><strong>{item.name}</strong><small>{item.category} · {item.quantity} units</small></div><span>{when(item.lastOrder)}</span></div>)}</div>{!purchased.size&&<p className="admin-empty">No purchase history yet.</p>}</section>
    <section className="admin-card"><div className="admin-card-heading"><h2><Repeat2 size={17}/> Purchase history</h2><span className="admin-count">{history.length} orders</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Products</th><th>Total</th><th>Status</th></tr></thead><tbody>{history.map(order=><tr key={order.id}><td><Link href={`/admin/orders/${order.id}`} className="admin-strong-link">{order.reference}</Link><br/><small>{when(order.createdAt)} · {order.source}</small></td><td>{(order.items as Item[]).map(item=>`${item.quantity} × ${item.name}`).join(', ')}</td><td><strong>{iqd(Math.max(0,order.subtotalCents-order.discountCents))}</strong><br/><small>+ {iqd(order.shippingCents)} delivery</small></td><td>{statusLabels[order.status as keyof typeof statusLabels] ?? order.status}</td></tr>)}</tbody></table></div></section>
  </main>;
}
