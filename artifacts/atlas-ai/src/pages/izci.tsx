import { AlertTriangle, BellRing, Check, CheckSquare2, Clock3, Crosshair, Target, WalletCards } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAssistantState } from '@/hooks/useAssistantState';
import { markEventRead, setTaskCompleted } from '@/lib/assistant-store';

function formatDate(value?: string): string {
  if (!value) return 'Tarih yok';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Empty({ children }: { children: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{children}</p>;
}

export default function Izci() {
  const state = useAssistantState();
  const unread = state.events.filter((event) => !event.read);
  const activeTasks = state.tasks.filter((task) => task.status === 'active');
  const activeGoals = state.goals.filter((goal) => goal.status === 'active');
  const activeTracking = state.trackedProducts.filter((product) => product.status !== 'paused');
  const upcoming = state.reminders.filter((reminder) => reminder.status === 'pending');

  return (
    <main className="h-[100dvh] min-w-0 flex-1 overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
        <SidebarTrigger aria-label="Menüyü aç" />
        <div className="min-w-0"><h1 className="font-serif text-xl font-bold">İZCİ</h1><p className="truncate text-xs text-muted-foreground">Atlas takip ve gözlem katmanı</p></div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />Yerel izleme aktif</div>
      </header>

      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-8">
        <section aria-labelledby="today-heading">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase text-primary">Bugün</p><h2 id="today-heading" className="mt-1 text-2xl font-semibold">Durum özeti</h2></div><p className="text-xs text-muted-foreground">Son kontrol: {formatDate(new Date().toISOString())}</p></div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            <div className="bg-card p-5"><AlertTriangle className="mb-4 h-5 w-5 text-red-400" /><strong className="block text-2xl">{unread.filter((event) => event.severity === 'critical').length}</strong><span className="text-sm text-muted-foreground">önemli uyarı</span></div>
            <div className="bg-card p-5"><Clock3 className="mb-4 h-5 w-5 text-amber-400" /><strong className="block text-2xl">{activeTasks.length + upcoming.length}</strong><span className="text-sm text-muted-foreground">yaklaşan görev</span></div>
            <div className="bg-card p-5"><Crosshair className="mb-4 h-5 w-5 text-emerald-400" /><strong className="block text-2xl">{activeTracking.length}</strong><span className="text-sm text-muted-foreground">takip aktif</span></div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div aria-labelledby="tracking-heading">
            <h2 id="tracking-heading" className="mb-3 flex items-center gap-2 text-base font-semibold"><Crosshair className="h-4 w-4 text-primary" />Fiyat Takipleri</h2>
            <div className="divide-y divide-border border-y border-border">
              {state.trackedProducts.length === 0 ? <Empty>Atlas'a “Bu ürünü takip et” diyerek takip başlatabilirsin.</Empty> : state.trackedProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.source ?? 'Kaynak bağlanmadı'} · {product.lastCheckedAt ? formatDate(product.lastCheckedAt) : 'Henüz kontrol edilmedi'}</p></div><div className="shrink-0 text-right"><p className="font-medium">{product.currentPrice ? `${product.currentPrice.toLocaleString('tr-TR')} TL` : 'Fiyat yok'}</p><p className={product.status === 'unavailable' ? 'text-xs text-amber-400' : 'text-xs text-emerald-400'}>{product.status}</p></div></div>)}
            </div>
          </div>

          <div aria-labelledby="goals-heading">
            <h2 id="goals-heading" className="mb-3 flex items-center gap-2 text-base font-semibold"><Target className="h-4 w-4 text-primary" />Hedefler</h2>
            <div className="divide-y divide-border border-y border-border">
              {state.goals.length === 0 ? <Empty>Henüz izlenen hedef yok.</Empty> : state.goals.map((goal) => {
                const progress = goal.targetAmount ? Math.min(100, Math.round(((goal.currentAmount ?? 0) / goal.targetAmount) * 100)) : 0;
                return <div key={goal.id} className="py-4"><div className="mb-2 flex justify-between gap-3"><p className="font-medium">{goal.title}</p><span className="text-sm tabular-nums text-primary">%{progress}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{goal.targetDate ? formatDate(goal.targetDate) : 'Hedef tarihi yok'}</p></div>;
              })}
            </div>
          </div>

          <div aria-labelledby="tasks-heading">
            <h2 id="tasks-heading" className="mb-3 flex items-center gap-2 text-base font-semibold"><CheckSquare2 className="h-4 w-4 text-primary" />Görevler ve Hatırlatıcılar</h2>
            <div className="divide-y divide-border border-y border-border">
              {state.tasks.length === 0 ? <Empty>Henüz görev yok.</Empty> : state.tasks.map((task) => <div key={task.id} className="flex items-center gap-3 py-3"><button type="button" onClick={() => setTaskCompleted(task.id, task.status !== 'completed')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border hover:border-primary" aria-label={task.status === 'completed' ? 'Görevi yeniden aç' : 'Görevi tamamla'}>{task.status === 'completed' && <Check className="h-4 w-4 text-emerald-400" />}</button><div className="min-w-0"><p className={task.status === 'completed' ? 'truncate text-muted-foreground line-through' : 'truncate font-medium'}>{task.title}</p><p className="text-xs text-muted-foreground">{formatDate(task.dueAt)}</p></div></div>)}
              {upcoming.map((reminder) => <div key={reminder.id} className="flex items-center gap-3 py-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border"><BellRing className="h-4 w-4 text-amber-400" /></div><div className="min-w-0"><p className="truncate font-medium">{reminder.message}</p><p className="text-xs text-muted-foreground">Hatırlatıcı · {formatDate(reminder.scheduledAt)}</p></div></div>)}
            </div>
          </div>

          <div aria-labelledby="subscriptions-heading">
            <h2 id="subscriptions-heading" className="mb-3 flex items-center gap-2 text-base font-semibold"><WalletCards className="h-4 w-4 text-primary" />Abonelikler</h2>
            <div className="divide-y divide-border border-y border-border">
              {state.subscriptions.length === 0 ? <Empty>Henüz abonelik kaydı yok.</Empty> : state.subscriptions.map((subscription) => <div key={subscription.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium">{subscription.name}</p><p className="text-xs text-muted-foreground">{formatDate(subscription.renewalAt)}</p></div><p className="text-sm tabular-nums">{subscription.monthlyCost ? `${subscription.monthlyCost.toLocaleString('tr-TR')} TL/ay` : 'Tutar yok'}</p></div>)}
            </div>
          </div>
        </section>

        <section aria-labelledby="alerts-heading">
          <h2 id="alerts-heading" className="mb-3 flex items-center gap-2 text-base font-semibold"><BellRing className="h-4 w-4 text-primary" />Uyarılar ve Son Değişiklikler</h2>
          <div className="divide-y divide-border border-y border-border">
            {state.events.length === 0 ? <Empty>İzci henüz bir değişiklik yakalamadı.</Empty> : state.events.slice(0, 12).map((event) => <button key={event.id} type="button" onClick={() => markEventRead(event.id)} className="flex w-full items-start gap-3 py-4 text-left"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${event.read ? 'bg-muted-foreground/30' : event.severity === 'critical' ? 'bg-red-400' : event.severity === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`} /><span className="min-w-0 flex-1"><span className="block font-medium">{event.title}</span><span className="block text-sm text-muted-foreground">{event.message}</span></span><span className="shrink-0 text-xs text-muted-foreground">{formatDate(event.createdAt)}</span></button>)}
          </div>
        </section>
      </div>
    </main>
  );
}
