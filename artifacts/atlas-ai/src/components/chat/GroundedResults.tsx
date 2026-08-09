import { AlertTriangle, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import type { AtlasResponseMetadata } from '@/lib/intent-router';

interface Props {
  metadata: AtlasResponseMetadata;
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatPrice(priceTRY?: number): string {
  return typeof priceTRY === 'number' && Number.isFinite(priceTRY)
    ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(priceTRY)
    : 'Fiyat belirtilmedi';
}

function formatRetrievedAt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function GroundedResults({ metadata }: Props) {
  const showResearchWarning = metadata.research.status === 'unavailable' || metadata.research.status === 'failed';
  const hasEvidence = metadata.sources.length > 0 || metadata.products.length > 0 || metadata.decision || metadata.research.requested;
  if (!hasEvidence) return null;

  return (
    <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
      {showResearchWarning && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            {metadata.research.status === 'unavailable'
              ? 'Web araştırması şu anda kullanılamıyor. Yanıt güncel arama sonuçlarıyla doğrulanamadı.'
              : 'Web araştırması tamamlanamadı. Yanıt mevcut bilgilerle oluşturuldu.'}
          </p>
        </div>
      )}

      {metadata.decision?.summary && (
        <section aria-labelledby="decision-summary" className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <h3 id="decision-summary" className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Karar özeti</h3>
          <p className="text-sm leading-relaxed text-foreground">{metadata.decision.summary}</p>
          {metadata.decision.reasons?.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{metadata.decision.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>}
          {metadata.decision.tradeoffs?.length > 0 && <div className="mt-3"><p className="text-xs font-semibold text-foreground">Ödünler</p><ul className="mt-1 space-y-1 text-xs text-muted-foreground">{metadata.decision.tradeoffs.map((tradeoff) => <li key={tradeoff}>• {tradeoff}</li>)}</ul></div>}
        </section>
      )}

      {metadata.products.length > 0 && (
        <section aria-labelledby="product-results">
          <h3 id="product-results" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Bulunan ürünler</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {metadata.products.map((product, index) => {
              const url = safeExternalUrl(product.url);
              const retrievedAt = formatRetrievedAt(product.retrievedAt);
              return (
                <article key={`${product.url}-${index}`} className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{product.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{product.seller ? `Satıcı: ${product.seller}` : `Kaynak: ${product.source.domain}`}</p>
                    </div>
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${product.title} kaynağını yeni sekmede aç`} className="text-primary hover:text-primary/80">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-primary">{formatPrice(product.priceTRY)}</p>{product.score !== undefined && <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">Puan {product.score}/100</span>}</div>
                  {product.availability && <p className="mt-2 text-xs text-muted-foreground">{product.availability === 'in_stock' ? 'Kaynakta stokta' : 'Kaynakta stokta değil'}</p>}
                  {product.features.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Özellikler: {product.features.join(', ')}</p>}
                  {retrievedAt && <p className="mt-2 text-[11px] text-muted-foreground/70">Alınma zamanı: {retrievedAt}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {metadata.sources.length > 0 && (
        <section aria-labelledby="research-sources">
          <h3 id="research-sources" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Search className="h-3.5 w-3.5" aria-hidden="true" /> Kaynaklar
          </h3>
          <ul className="space-y-2">
            {metadata.sources.map((source, index) => {
              const url = safeExternalUrl(source.url);
              if (!url) return null;
              return (
                <li key={`${source.url}-${index}`}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm text-foreground hover:border-primary/40">
                    <span><span className="font-medium">{source.title}</span><span className="ml-2 text-xs text-muted-foreground">{source.domain}</span></span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Güven: %{Math.round(Math.max(0, Math.min(1, metadata.confidence)) * 100)}
      </div>
    </div>
  );
}