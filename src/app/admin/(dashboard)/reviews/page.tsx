import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { products, reviews } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { ReviewsManager, type AdminReview } from '@/components/admin/reviews-manager';

export const metadata = { title: 'Reviews' };
export const dynamic = 'force-dynamic';
export default async function ReviewsPage() {
  if (!(await requireAdminSection('sales', 'view'))) redirect('/admin');
  const [rows, productRows] = await Promise.all([
    db.select({ id: reviews.id, productId: reviews.productId, productName: products.name, productNameAr: products.nameAr, name: reviews.name, city: reviews.city, phone: reviews.phone, rating: reviews.rating, title: reviews.title, body: reviews.body, verified: reviews.verified, status: reviews.status, reply: reviews.reply, orderId: reviews.orderId, createdAt: reviews.createdAt }).from(reviews).innerJoin(products, eq(reviews.productId, products.id)).orderBy(desc(reviews.createdAt)).limit(500),
    db.select({ id: products.id, name: products.name, nameAr: products.nameAr }).from(products).orderBy(products.name),
  ]);
  return <ReviewsManager initial={rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) as AdminReview[]} products={productRows} />;
}
