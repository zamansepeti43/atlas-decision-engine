import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Eye, Search, ShieldCheck, ShoppingCart, Wallet, Car, Home, Briefcase, Users, BookOpen, Brain, ListTodo } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAssistantState } from '@/hooks/useAssistantState';
import { analyzeScamText, ATLAS_CAPABILITIES } from '@/lib/atlas-capabilities';

const ICONS = { shopping: ShoppingCart, finance: Wallet, 'scam-shield': ShieldCheck, automotive: Car, 'real-estate': Home, career: Briefcase, family: Users, learning: BookOpen, memory: Brain, tasks: ListTodo, research: Search } as const;

export default function AtlasOS() {
  const [, navigate] = useLocation();
  const state = useAssistantState();
  const [scamText, setScamText] = useState('');
  const analysis = useMemo(() => analyzeScamText(scamText), [scamText]);
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
            <div>
              <div className="mb-3 flex items-center gap-2 text-primary"><Bot className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.22em]">Atlas Life OS</span></div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Sen sor. Atlas araştırır, düşünür, takip eder.</h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">Alışverişten finansa, dolandırıcılık kontrolünden görev ve fiyat takibine kadar tek bir karar merkezi.</p>
            </div>
            <button onClick={() => ask('Bugün benim için önemli olan görevleri ve takipleri özetle.')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground">Atlas'a sor <ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat icon={ListTodo} label="Aktif görev" value={activeTasks} />
          <Stat icon={Eye} label="İzlenen" value={activeTracks} />
          <Stat icon={AlertTriangle} label="Okunmamış İzci" value={unread} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Dolandırıcılık Kalkanı</h2><p className="text-sm text-muted-foreground">Şüpheli mesajı buraya yapıştır ve risk sinyallerini gör.</p></div></div>
            <textarea value={scamText} onChange={(e) => setScamText(e.target.value)} placeholder="Örn. Tebrikler, 50.000 TL kazandınız..." className="min-h-32 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            {scamText && <div className="mt-4 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs text-muted-foreground">Risk değerlendirmesi</p><p className="text-lg font-bold">{analysis.level}</p></div><div className="text-3xl font-bold">%{analysis.score}</div></div>
              {analysis.signals.length > 0 && <ul className="mt-3 space-y-2 text-sm">{analysis.signals.map((signal) => <li key={signal} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{signal}</li>)}</ul>}
              <p className="mt-3 text-sm text-muted-foreground">{analysis.recommendation}</p>
            </div>}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">İzci durumu</h2><p className="mt-1 text-sm text-muted-foreground">Atlas'ın verdiği kararların takibi burada.</p>
            <div className="mt-5 space-y-3"><StatusRow label="Görevler" value={`${activeTasks} aktif`} /><StatusRow label="Fiyat takipleri" value={`${activeTracks} aktif`} /><StatusRow label="Bildirimler" value={`${unread} yeni`} /></div>
            <button onClick={() => navigate('/izci')} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">İzci'yi aç <ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>

        <section>
          <div className="mb-4"><h2 className="text-xl font-bold">Atlas yetenekleri</h2><p className="text-sm text-muted-foreground">Aynı konuşma motorunun farklı uzmanlıkları.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ATLAS_CAPABILITIES.map((capability) => { const Icon = ICONS[capability.id]; return <button key={capability.id} onClick={() => ask(capability.examples[0])} className="group rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><h3 className="font-semibold">{capability.title}</h3><p className="mt-1 text-sm text-muted-foreground">{capability.description}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">Örnek iste <ArrowRight className="h-3 w-3" /></span></button>; })}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: number }) { return <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-sm">{label}</span></div><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
function StatusRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-3 text-sm"><span>{label}</span><span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-4 w-4" />{value}</span></div>; }
