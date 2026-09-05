export type EntityStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type TrackingStatus = 'active' | 'paused' | 'unavailable' | 'error';
export type ScoutEventType =
  | 'PRICE_DROP'
  | 'PRICE_RISE'
  | 'TARGET_REACHED'
  | 'TASK_DUE'
  | 'REMINDER_DUE'
  | 'GOAL_PROGRESS'
  | 'SUBSCRIPTION_RENEWAL'
  | 'NEW_DEAL'
  | 'TRACKING_ERROR'
  | 'SOURCE_UNAVAILABLE'
  | 'IMPORTANT_CHANGE';

export interface Task {
  id: string;
  title: string;
  status: EntityStatus;
  dueAt?: string;
  recurrence?: 'daily' | 'weekly' | 'monthly';
  goalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  message: string;
  scheduledAt: string;
  recurrence?: 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'triggered' | 'dismissed';
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TrackedProduct {
  id: string;
  name: string;
  url?: string;
  currentPrice?: number;
  previousPrice?: number;
  targetPrice?: number;
  currency: 'TRY';
  source?: string;
  status: TrackingStatus;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceSnapshot {
  id: string;
  trackedProductId: string;
  price: number;
  currency: 'TRY';
  source: string;
  checkedAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  monthlyCost?: number;
  renewalAt: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetEntry {
  id: string;
  kind: 'income' | 'fixed_expense' | 'variable_expense' | 'debt' | 'saving';
  category: string;
  amount: number;
  occurredAt: string;
  note?: string;
  createdAt: string;
}

export interface ScoutEvent {
  id: string;
  type: ScoutEventType;
  createdAt: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  entityId: string;
  read: boolean;
  dedupeKey?: string;
}

export interface AssistantState {
  version: 1;
  tasks: Task[];
  reminders: Reminder[];
  goals: Goal[];
  trackedProducts: TrackedProduct[];
  priceSnapshots: PriceSnapshot[];
  subscriptions: Subscription[];
  budgetEntries: BudgetEntry[];
  events: ScoutEvent[];
}
