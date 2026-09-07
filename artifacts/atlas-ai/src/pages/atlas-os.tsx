import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Eye, Search, ShieldCheck, ShoppingCart, Wallet, Car, Home, Briefcase, Users, BookOpen, Brain, ListTodo, Link2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAssistantState } from '@/hooks/useAssistantState';
import { analyzeScamText, ATLAS_CAPABILITIES } from '@/lib/atlas-capabilities';
import { analyzeUrl, summarizeBudget } from '@/lib/offline-tools';

const ICONS = { shopping: ShoppingCart, finance: Wallet, 'scam-shield': ShieldCheck, automotive: Car, 'real-estate': Home, career: Briefcase, family: Users, learning: BookOpen, memory: Brain, tasks: ListTodo, research: Search } as const;

export default function AtlasOS() {
  const [, navigate] = useLocation();
  const state = useAssistantState();
  const [scamText, setScamText] = useState('');
  const [urlText, setUrlText] = useState('');
  const analysis = useMemo(() => analyzeScamText(scamText), [scamText]);
  const urlAnalysis = useMemo(() => analyzeUrl(urlText), [urlText]);
  const budget = useMemo(() => summarizeBudget(state.budgetEntries), [state.budgetEntries]);
  const activeTasks = state.tasks.filter((task) => task.status === 'active').length;
  const activeTracks = state.trackedProducts.filter((product) => product.status === 'active').length;
  const unread = state.events.filter((event) => !event.read).length;

  const ask = (text: string) => {
    navigate('/');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('atlas-prefill', { detail: text })), 0);
  };

  return (
    <main className="min-h-screen flex-1 overflow-auto bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div><div className="mb-3 flex items-center gap-2 text-primary"><Bot className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.22em]">Atlas Life OS</span></div><h1 className="text-3xl font-bold tracking-tight md:text-5xl">Sen sor. Atlas araştırır, düşünür, takip eder.</h1><p className="mt-3 max-w-2xl text-muted-foreground">API gerektirmeyen kişisel karar araçları artık Atlas'ın içinde: güvenlik, bütçe, görev, takip ve karar akışı.</p></div>
            <button onClick={() => ask('Bugün benim için önemli olan görevleri, takipleri ve uyarıları özetle.')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground">Atlas'a sor <ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3"><Stat icon={ListTodo} label="Aktif görev" value={activeTasks} /><Stat icon={Eye} label="İzlenen" value={activeTracks} /><Stat icon={AlertTriangle} label="Okunmamış İzci" value={unread} /></section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ToolCard icon={ShieldCheck} title="Dolandırıcılık Kalkanı" description="Mesajı analiz et; baskı, ödül, hassas bilgi ve link sinyallerini açıkla.">
            <textarea value={scamText} onChange={(e) => setScamText(e.target.value)} placeholder="Örn. Tebrikler, 50.000 TL kazandınız..." className="min-h-28 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            {scamText && <div className="mt-3 rounded-xl border border-border p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Risk</p><p className="font-bold">{analysis.level}</p></div><span className="text-3xl font-bold">%{analysis.score}</span></div><ul className="mt-3 space-y-2 text-sm">{analysis.signals.map((s) => <li key={s} className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{s}</li>)}</ul><p className="mt-3 text-sm text-muted-foreground">{analysis.recommendation}</p></div>}
          </ToolCard>

          <ToolCard icon={Link2} title="Bağlantı Güvenlik Kontrolü" description="URL'yi açmadan önce HTTPS, kısaltıcı, alan adı ve şüpheli uzantı sinyallerini kontrol et.">
            <div className="flex gap-2"><input value={urlText} onChange={(e) => setUrlText(e.target.value)} placeholder="https://ornek.com/..." className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
            {urlText && <div className="mt-3 rounded-xl border border-border p-4"><div className="flex items-center justify-between"><p className="font-bold">{urlAnalysis.level}</p><span className="text-2xl font-bold">%{urlAnalysis.score}</span></div><ul className="mt-3 space-y-2 text-sm">{urlAnalysis.signals.map((s) => <li key={s}>• {s}</li>)}</ul><p className="mt-3 text-sm text-muted-foreground">{urlAnalysis.recommendation}</p></div>}
          </ToolCard>

          <ToolCard icon={Wallet} title="Yerel Bütçe Özeti" description="Kayıtlı gelir/gider/borç/tasarruf verilerini API olmadan hesaplar.">
            <div className="grid grid-cols-2 gap-2 text-sm"><Metric label="Gelir" value={budget.income} /><Metric label="Gider" value={budget.expenses} /><Metric label="Borç" value={budget.debt} /><Metric label="Tasarruf" value={budget.saving} /></div><div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 p-3"><span>Net bakiye</span><strong>{budget.balance.toLocaleString('tr-TR')} TL</strong></div><p className="mt-2 text-xs text-muted-foreground">Tasarruf oranı: %{budget.savingRate}. Bu hesap finansal tavsiye değil, kayıtlı verilerin özetidir.</p>
          </ToolCard>

          <ToolCard icon={ListTodo} title="İzci & Otomasyon Temeli" description="Atlas'ın verdiği kararları görev, hatırlatıcı, hedef ve fiyat takibine dönüştürmek için mevcut yerel altyapıyı kullanır.">
            <div className="space-y-2 text-sm"><StatusRow label="Görevler" value={`${activeTasks} aktif`} /><StatusRow label="Fiyat takipleri" value={`${activeTracks} aktif`} /><StatusRow label="Uyarılar" value={`${unread} yeni`} /></div><button onClick={() => navigate('/izci')} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">İzci'yi aç <ArrowRight className="h-4 w-4" /></button>
          </ToolCard>
        </section>

        <section><div className="mb-4"><h2 className="text-xl font-bold">Atlas yetenekleri</h2><p className="text-sm text-muted-foreground">Hepsi tek bir kişisel karar merkezinde.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{ATLAS_CAPABILITIES.map((capability) => { const Icon = ICONS[capability.id]; return <button key={capability.id} onClick={() => ask(capability.examples[0])} className="group rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><h3 className="font-semibold">{capability.title}</h3><p className="mt-1 text-sm text-muted-foreground">{capability.description}</p></button>; })}</div></section>
      </div>
    </main>
  );
}

function ToolCard({ icon: Icon, title, description, children }: { icon: typeof Bot; title: string; description: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-4 flex items-center gap-3"><Icon className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div></div>{children}</div>; }
function Stat({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: number }) { return <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-sm">{label}</span></div><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value.toLocaleString('tr-TR')} TL</p></div>; }
function StatusRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-3"><span>{label}</span><span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-4 w-4" />{value}</span></div>; }
