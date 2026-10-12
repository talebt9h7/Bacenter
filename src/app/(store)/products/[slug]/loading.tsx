// Shown the moment a product link is clicked, while the page data loads.
// It also lets Next.js prefetch the page shell from product cards ahead of the click.
export default function ProductLoading() {
  return (
    <main className="product-page product-page-loading" aria-busy="true" aria-label="Loading product">
      <div className="product-detail-layout">
        <div className="product-gallery">
          <div className="product-main-image skeleton-block" />
          <div className="product-thumbnails">
            {[0, 1, 2, 3].map(index => <span key={index} className="skeleton-thumb skeleton-block" />)}
          </div>
        </div>
        <div className="product-buy-box">
          <span className="skeleton-line skeleton-block" style={{ width: '70%', height: 38 }} />
          <span className="skeleton-line skeleton-block" style={{ width: '30%', height: 22 }} />
          <span className="skeleton-line skeleton-block" style={{ width: '45%' }} />
          <span className="skeleton-line skeleton-block" style={{ width: '100%', height: 47, marginTop: 28 }} />
          <span className="skeleton-line skeleton-block" style={{ width: '100%' }} />
          <span className="skeleton-line skeleton-block" style={{ width: '90%' }} />
        </div>
      </div>
    </main>
  );
}
