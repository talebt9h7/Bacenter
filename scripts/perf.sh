#!/usr/bin/env bash
# Mobile performance check (Lighthouse, slow 4G + 4× slower CPU), median of 3 runs per page.
#   BASE=https://ur-leather.shop npm run perf        # or a local `npm start` on :3000
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
PAGES=("/" "/products/category/all" "${PRODUCT_PATH:-/products/craft}")
OUT="$(mktemp -d)"
for page in "${PAGES[@]}"; do
  for i in 1 2 3; do
    npx -y lighthouse@12.8.2 "$BASE$page" --quiet --chrome-flags="--headless=new" --only-categories=performance \
      --form-factor=mobile --throttling-method=simulate --output=json --output-path="$OUT/run-$i.json" >/dev/null 2>&1
  done
  node -e '
    const runs=[1,2,3].map(i=>require(process.argv[1]+"/run-"+i+".json"));
    const med=f=>runs.map(f).sort((a,b)=>a-b)[1]; const A=k=>r=>r.audits[k].numericValue;
    console.log(process.argv[2].padEnd(28),"score",Math.round(med(r=>r.categories.performance.score*100)),
      "LCP",(med(A("largest-contentful-paint"))/1000).toFixed(2)+"s","TBT",Math.round(med(A("total-blocking-time")))+"ms",
      "CLS",med(A("cumulative-layout-shift")).toFixed(3));' "$OUT" "$page"
done
