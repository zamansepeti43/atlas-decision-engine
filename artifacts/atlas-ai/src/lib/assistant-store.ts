import type {
  AssistantState,
  BudgetEntry,
  Goal,
  Reminder,
  ScoutEvent,
  Subscription,
  Task,
  TrackedProduct,
} from './assistant-types';

const STORAGE_KEY = 'atlas_assistant_state_v1';
const CHANGE_EVENT = 'atlas-assistant-state-change';

const EMPTY_STATE: AssistantState = {
  version: 1,
  tasks: [],
  reminders: [],
  goals: [],
  trackedProducts: [],
  priceSnapshots: [],
  subscriptions: [],
  budgetEntries: [],
  events: [],
};

let cachedState: AssistantState | null = null;

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

function parseState(raw: string | null): AssistantState {
  if (!raw) return { ...EMPTY_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<AssistantState>;
    return {
      ...EMPTY_STATE,
      ...parsed,
      version: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      trackedProducts: Array.isArray(parsed.trackedProducts) ? parsed.trackedProducts : [],
      priceSnapshots: Array.isArray(parsed.priceSnapshots) ? parsed.priceSnapshots : [],
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      budgetEntries: Array.isArray(parsed.budgetEntries) ? parsed.budgetEntries : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function getAssistantState(): AssistantState {
  if (cachedState) return cachedState;
  if (typeof window === 'undefined') return EMPTY_STATE;
  cachedState = parseState(window.localStorage.getItem(STORAGE_KEY));
  return cachedState;
}

function persist(next: AssistantState): AssistantState {
  cachedState = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The active session still works when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return next;
}

function update(transform: (current: AssistantState) => AssistantState): AssistantState {
  return persist(transform(getAssistantState()));
}

export function subscribeAssistantState(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  const storageListener = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cachedState = parseState(event.newValue);
    listener();
  };
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', storageListener);
  };
}

function appendEvent(state: AssistantState, event: Omit<ScoutEvent, 'id' | 'createdAt' | 'read'>): AssistantState {
  if (event.dedupeKey && state.events.some((item) => item.dedupeKey === event.dedupeKey)) return state;
  const nextEvent: ScoutEvent = { ...event, id: uid(), createdAt: now(), read: false };
  return { ...state, events: [nextEvent, ...state.events].slice(0, 100) };
}

export function addTask(input: Pick<Task, 'title'> & Partial<Pick<Task, 'dueAt' | 'recurrence' | 'goalId'>>): Task {
  const createdAt = now();
  const task: Task = { id: uid(), title: input.title, status: 'active', createdAt, updatedAt: createdAt, ...(input.dueAt && { dueAt: input.dueAt }), ...(input.recurrence && { recurrence: input.recurrence }), ...(input.goalId && { goalId: input.goalId }) };
  update((state) => ({ ...state, tasks: [task, ...state.tasks] }));
  return task;
}

export function setTaskCompleted(id: string, completed: boolean): void {
  update((state) => ({ ...state, tasks: state.tasks.map((task) => task.id === id ? { ...task, status: completed ? 'completed' : 'active', updatedAt: now() } : task) }));
}

export function addReminder(input: Pick<Reminder, 'message' | 'scheduledAt'> & Partial<Pick<Reminder, 'recurrence'>>): Reminder {
  const reminder: Reminder = { id: uid(), message: input.message, scheduledAt: input.scheduledAt, status: 'pending', createdAt: now(), ...(input.recurrence && { recurrence: input.recurrence }) };
  update((state) => ({ ...state, reminders: [reminder, ...state.reminders] }));
  return reminder;
}

export function addGoal(input: Pick<Goal, 'title'> & Partial<Pick<Goal, 'targetAmount' | 'currentAmount' | 'targetDate'>>): Goal {
  const createdAt = now();
  const goal: Goal = { id: uid(), title: input.title, status: 'active', currentAmount: input.currentAmount ?? 0, createdAt, updatedAt: createdAt, ...(input.targetAmount !== undefined && { targetAmount: input.targetAmount }), ...(input.targetDate && { targetDate: input.targetDate }) };
  update((state) => ({ ...state, goals: [goal, ...state.goals] }));
  return goal;
}

export function updateGoalProgress(id: string, currentAmount: number): void {
  update((state) => {
    const goal = state.goals.find((item) => item.id === id);
    if (!goal) return state;
    const completed = goal.targetAmount !== undefined && currentAmount >= goal.targetAmount;
    const next = { ...state, goals: state.goals.map((item) => item.id === id ? { ...item, currentAmount, status: completed ? 'completed' as const : item.status, updatedAt: now() } : item) };
    const percent = goal.targetAmount ? Math.min(100, Math.round((currentAmount / goal.targetAmount) * 100)) : 0;
    return appendEvent(next, { type: completed ? 'TARGET_REACHED' : 'GOAL_PROGRESS', severity: completed ? 'success' : 'info', title: completed ? 'Hedef tamamlandı' : 'Hedef ilerledi', message: `${goal.title}: %${percent}`, entityId: id, dedupeKey: `goal:${id}:${currentAmount}` });
  });
}

export function addTrackedProduct(input: Pick<TrackedProduct, 'name'> & Partial<Pick<TrackedProduct, 'url' | 'targetPrice' | 'currentPrice' | 'source'>>): TrackedProduct {
  const createdAt = now();
  const product: TrackedProduct = { id: uid(), name: input.name, currency: 'TRY', status: input.source ? 'active' : 'unavailable', createdAt, updatedAt: createdAt, ...(input.url && { url: input.url }), ...(input.targetPrice !== undefined && { targetPrice: input.targetPrice }), ...(input.currentPrice !== undefined && { currentPrice: input.currentPrice }), ...(input.source && { source: input.source, lastCheckedAt: createdAt }) };
  update((state) => {
    let next = { ...state, trackedProducts: [product, ...state.trackedProducts] };
    if (!input.source) next = appendEvent(next, { type: 'SOURCE_UNAVAILABLE', severity: 'warning', title: 'Kaynak bekleniyor', message: `${product.name} kaydedildi; fiyat kontrolü için doğrulanabilir bir kaynak gerekiyor.`, entityId: product.id, dedupeKey: `source:${product.id}` });
    return next;
  });
  return product;
}

export function recordTrackedPrice(id: string, price: number, source: string, checkedAt = now()): void {
  if (!Number.isFinite(price) || price <= 0 || !source.trim()) return;
  update((state) => {
    const product = state.trackedProducts.find((item) => item.id === id);
    if (!product) return state;
    const snapshot = { id: uid(), trackedProductId: id, price, currency: 'TRY' as const, source, checkedAt };
    const updated: TrackedProduct = { ...product, previousPrice: product.currentPrice, currentPrice: price, source, status: 'active', lastCheckedAt: checkedAt, updatedAt: now() };
    let next = { ...state, trackedProducts: state.trackedProducts.map((item) => item.id === id ? updated : item), priceSnapshots: [snapshot, ...state.priceSnapshots].slice(0, 500) };
    if (product.currentPrice !== undefined && product.currentPrice !== price) {
      const dropped = price < product.currentPrice;
      next = appendEvent(next, { type: dropped ? 'PRICE_DROP' : 'PRICE_RISE', severity: dropped ? 'success' : 'warning', title: dropped ? 'Fiyat düştü' : 'Fiyat yükseldi', message: `${product.name} ${product.currentPrice.toLocaleString('tr-TR')} TL'den ${price.toLocaleString('tr-TR')} TL'ye ${dropped ? 'düştü' : 'yükseldi'}.`, entityId: id, dedupeKey: `price:${id}:${checkedAt}:${price}` });
    }
    if (product.targetPrice !== undefined && price <= product.targetPrice) next = appendEvent(next, { type: 'TARGET_REACHED', severity: 'critical', title: 'Hedef fiyat yakalandı', message: `${product.name} hedef fiyatın altında: ${price.toLocaleString('tr-TR')} TL.`, entityId: id, dedupeKey: `target:${id}:${price}` });
    return next;
  });
}

export function addSubscription(input: Pick<Subscription, 'name' | 'renewalAt'> & Partial<Pick<Subscription, 'monthlyCost'>>): Subscription {
  const createdAt = now();
  const subscription: Subscription = { id: uid(), name: input.name, renewalAt: input.renewalAt, status: 'active', createdAt, updatedAt: createdAt, ...(input.monthlyCost !== undefined && { monthlyCost: input.monthlyCost }) };
  update((state) => ({ ...state, subscriptions: [subscription, ...state.subscriptions] }));
  return subscription;
}

export function addBudgetEntry(input: Omit<BudgetEntry, 'id' | 'createdAt'>): BudgetEntry {
  const entry: BudgetEntry = { ...input, id: uid(), createdAt: now() };
  update((state) => ({ ...state, budgetEntries: [entry, ...state.budgetEntries] }));
  return entry;
}

export function markEventRead(id: string): void {
  update((state) => ({ ...state, events: state.events.map((event) => event.id === id ? { ...event, read: true } : event) }));
}

export function runIzciCheck(referenceDate = new Date()): void {
  const timestamp = referenceDate.getTime();
  const day = 24 * 60 * 60 * 1000;
  update((state) => {
    let next = state;
    for (const task of state.tasks) {
      if (task.status === 'active' && task.dueAt && new Date(task.dueAt).getTime() <= timestamp) next = appendEvent(next, { type: 'TASK_DUE', severity: 'warning', title: 'Görev zamanı', message: task.title, entityId: task.id, dedupeKey: `task:${task.id}:${task.dueAt}` });
    }
    for (const reminder of state.reminders) {
      if (reminder.status === 'pending' && new Date(reminder.scheduledAt).getTime() <= timestamp) next = appendEvent(next, { type: 'REMINDER_DUE', severity: 'critical', title: 'Hatırlatıcı', message: reminder.message, entityId: reminder.id, dedupeKey: `reminder:${reminder.id}:${reminder.scheduledAt}` });
    }
    for (const subscription of state.subscriptions) {
      const remaining = new Date(subscription.renewalAt).getTime() - timestamp;
      if (subscription.status === 'active' && remaining >= 0 && remaining <= 7 * day) next = appendEvent(next, { type: 'SUBSCRIPTION_RENEWAL', severity: remaining <= day ? 'critical' : 'warning', title: 'Abonelik yenileniyor', message: `${subscription.name}: ${Math.max(0, Math.ceil(remaining / day))} gün kaldı.`, entityId: subscription.id, dedupeKey: `subscription:${subscription.id}:${subscription.renewalAt}` });
    }
    return next;
  });
}

export function assistantContextSnapshot(state = getAssistantState()): string[] {
  const unread = state.events.filter((event) => !event.read).slice(0, 5);
  return [
    ...state.goals.filter((goal) => goal.status === 'active').slice(0, 4).map((goal) => `Aktif hedef: ${goal.title}${goal.targetAmount ? ` (${goal.currentAmount ?? 0}/${goal.targetAmount} TL)` : ''}`),
    ...state.tasks.filter((task) => task.status === 'active').slice(0, 4).map((task) => `Aktif görev: ${task.title}${task.dueAt ? `, tarih ${task.dueAt}` : ''}`),
    ...state.trackedProducts.slice(0, 4).map((product) => `Takip: ${product.name}, durum ${product.status}${product.currentPrice ? `, fiyat ${product.currentPrice} TL` : ''}`),
    ...unread.map((event) => `İzci uyarısı: ${event.message}`),
  ];
}
