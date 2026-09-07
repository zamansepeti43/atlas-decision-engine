import { addGoal, addReminder, addSubscription, addTask, addTrackedProduct } from './assistant-store';
import { formatMemoryResult, formatScamResult, formatUrlResult } from './local-intelligence';

export interface AssistantActionResult {
  handled: boolean;
  reply?: string;
}

function parseAmount(value: string): number | undefined {
  const match = value.match(/(\d[\d.]*(?:,\d+)?)\s*(bin)?\s*(?:tl|lira|₺)/i);
  if (!match) return undefined;
  const parsed = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed * (match[2] ? 1_000 : 1) : undefined;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseDate(text: string, now = new Date()): Date | undefined {
  const result = new Date(now);
  if (/yarın/i.test(text)) result.setDate(result.getDate() + 1);
  else {
    const months = text.match(/(\d+)\s*ay\s*içinde/i);
    if (months) return addMonths(result, Number(months[1]));
    const day = text.match(/(?:ayın|ayının)\s*(\d{1,2})['’]?(?:inde|ında|ünde|unda)?/i);
    if (day) {
      result.setDate(Number(day[1]));
      if (result.getTime() <= now.getTime()) result.setMonth(result.getMonth() + 1);
    } else return undefined;
  }
  const time = text.match(/saat\s*(\d{1,2})(?::(\d{2}))?/i);
  result.setHours(time ? Number(time[1]) : 9, time?.[2] ? Number(time[2]) : 0, 0, 0);
  return result;
}

function cleanSubject(text: string): string {
  return text
    .replace(/\b(bunu|şunu|bu)\b/gi, '')
    .replace(/\b(takip et|takibe al|hatırlat|hatırlatıcı oluştur|görev oluştur|görev ekle|hedef oluştur)\b/gi, '')
    .replace(/\b(yarın|bugün)\b/gi, '')
    .replace(/\bsaat\s*\d{1,2}(?::\d{2})?\b/gi, '')
    .replace(/\bher\s+ayın\s+\d{1,2}['’]?(?:inde|ında|ünde|unda)?\b/gi, '')
    .replace(/\bay(?:ın|ının)\s+\d{1,2}['’]?(?:inde|ında|ünde|unda)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.:;\s]+|[,.:;\s]+$/g, '')
    .trim();
}

export function handleAssistantAction(message: string, referenceDate = new Date()): AssistantActionResult {
  const trimmed = message.trim();
  const lower = trimmed.toLocaleLowerCase('tr-TR');

  // API-free safety tools run locally and do not send message contents anywhere.
  if (/(dolandır|sahte|phishing|oltalama|şüpheli mesaj|güvenli mi|güvenilir mi)/i.test(lower) && !/ürün|telefon|araba|almalıyım/i.test(lower)) {
    return { handled: true, reply: formatScamResult(trimmed) };
  }

  if (/(link|url|bağlantı).*(güven|güvenli|şüpheli|kontrol|incele)|https?:\/\//i.test(trimmed) && /güven|kontrol|şüpheli|incele/i.test(lower)) {
    return { handled: true, reply: formatUrlResult(trimmed) };
  }

  if (/(hafıza|hatırla|hatırlıyor musun|unut|tercihimi)/i.test(lower)) {
    return { handled: true, reply: formatMemoryResult() };
  }

  if (/(hatırlat|hatırlatıcı)/i.test(lower)) {
    const scheduled = parseDate(trimmed, referenceDate);
    if (!scheduled) return { handled: true, reply: 'Hatırlatıcıyı kaydetmem için tarih veya zamanı netleştirir misin?' };
    const subject = cleanSubject(trimmed) || 'Hatırlatıcı';
    const recurrence = /her ay/i.test(lower) ? 'monthly' as const : undefined;
    addReminder({ message: subject, scheduledAt: scheduled.toISOString(), ...(recurrence && { recurrence }) });
    addTask({ title: subject, dueAt: scheduled.toISOString(), ...(recurrence && { recurrence }) });
    return { handled: true, reply: `Hatırlatıcı ve görev kaydedildi: ${subject}. İzci ${scheduled.toLocaleString('tr-TR')} tarihinde takip edecek.` };
  }

  if (/(hedef oluştur|biriktirmek istiyorum|hedefim)/i.test(lower)) {
    const targetAmount = parseAmount(trimmed);
    const targetDate = parseDate(trimmed, referenceDate)?.toISOString();
    const goal = addGoal({ title: cleanSubject(trimmed) || trimmed, ...(targetAmount !== undefined && { targetAmount }), ...(targetDate && { targetDate }) });
    return { handled: true, reply: `Hedef oluşturuldu: ${goal.title}.${targetAmount ? ` Hedef tutar ${targetAmount.toLocaleString('tr-TR')} TL.` : ''} İzci ilerlemeyi takip edecek.` };
  }

  if (/(takip et|takibe al)/i.test(lower)) {
    const url = trimmed.match(/https?:\/\/\S+/i)?.[0];
    const targetMatch = trimmed.match(/hedef(?: fiyat)?[^\d]*(\d[\d.]*(?:,\d+)?)\s*(bin)?\s*(?:tl|lira|₺)/i);
    const targetPrice = targetMatch ? parseAmount(targetMatch[0]) : undefined;
    const trackingSubject = trimmed.replace(url ?? '', '').replace(targetMatch?.[0] ?? '', '').replace(/[,;]\s*$/, '');
    const name = cleanSubject(trackingSubject) || 'Ürün';
    const product = addTrackedProduct({ name, ...(url && { url, source: new URL(url).hostname }), ...(targetPrice !== undefined && { targetPrice }) });
    const sourceNote = product.status === 'unavailable' ? ' Doğrulanabilir kaynak eklenene kadar durum unavailable olarak kalacak.' : '';
    return { handled: true, reply: `${product.name} takip listesine eklendi.${sourceNote}` };
  }

  if (/(görev oluştur|görev ekle)/i.test(lower)) {
    const dueAt = parseDate(trimmed, referenceDate)?.toISOString();
    const task = addTask({ title: cleanSubject(trimmed) || trimmed, ...(dueAt && { dueAt }) });
    return { handled: true, reply: `Görev kaydedildi: ${task.title}. İzci görev durumunu izleyecek.` };
  }

  if (/(aboneliğ|abonelik)/i.test(lower) && /(ekle|yenilen|kaydet)/i.test(lower)) {
    const renewalAt = parseDate(trimmed, referenceDate);
    if (!renewalAt) return { handled: true, reply: 'Aboneliği kaydetmem için yenileme tarihini belirtir misin?' };
    const monthlyCost = parseAmount(trimmed);
    const name = trimmed.match(/^([\p{L}\p{N} ._-]+?)\s+aboneli/iu)?.[1]?.trim() || 'Abonelik';
    addSubscription({ name, renewalAt: renewalAt.toISOString(), ...(monthlyCost !== undefined && { monthlyCost }) });
    return { handled: true, reply: `${name} aboneliği kaydedildi. İzci yenileme yaklaştığında uygulama içinde uyaracak.` };
  }

  return { handled: false };
}
