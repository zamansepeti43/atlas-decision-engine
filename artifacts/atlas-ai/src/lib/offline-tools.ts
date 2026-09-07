export interface OfflineUrlAnalysis { score: number; level: 'GÜVENLİ GÖRÜNÜYOR' | 'DİKKAT' | 'ŞÜPHELİ'; signals: string[]; recommendation: string; }

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'rb.gy'];
const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.zip', '.mov', '.work', '.live'];
const BRAND_WORDS = ['bank', 'banka', 'trendyol', 'hepsiburada', 'amazon', 'netflix', 'paypal', 'microsoft', 'google', 'apple'];

export function analyzeUrl(input: string): OfflineUrlAnalysis {
  const raw = input.trim();
  if (!raw) return { score: 0, level: 'GÜVENLİ GÖRÜNÜYOR', signals: [], recommendation: 'Bir bağlantı gir.' };
  let score = 5;
  const signals: string[] = [];
  let url: URL | null = null;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return { score: 95, level: 'ŞÜPHELİ', signals: ['Geçerli bir URL olarak çözümlenemedi.'], recommendation: 'Bağlantıyı açmadan önce göndereni doğrula.' }; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') { score += 20; signals.push('HTTPS kullanılmıyor.'); }
  if (SHORTENERS.some((x) => host === x || host.endsWith(`.${x}`))) { score += 25; signals.push('URL kısaltma servisi kullanıyor; gerçek hedef görünmüyor.'); }
  if (SUSPICIOUS_TLDS.some((x) => host.endsWith(x))) { score += 20; signals.push('Alan adı uzantısı kötüye kullanımla ilişkilendirilebilen bir uzantı.'); }
  if (host.includes('--') || /\d{5,}/.test(host)) { score += 12; signals.push('Alan adında olağandışı karakter/sayı kullanımı var.'); }
  const matchedBrand = BRAND_WORDS.find((brand) => host.includes(brand));
  if (matchedBrand && !host.endsWith(`${matchedBrand}.com`) && !host.endsWith(`${matchedBrand}.com.tr`)) { score += 25; signals.push(`Alan adı '${matchedBrand}' adını içeriyor ancak resmi alan adı olmayabilir.`); }
  if (url.username || url.password) { score += 25; signals.push('URL içinde kullanıcı adı/şifre bölümü bulunuyor.'); }
  score = Math.min(99, score);
  const level = score >= 70 ? 'ŞÜPHELİ' : score >= 35 ? 'DİKKAT' : 'GÜVENLİ GÖRÜNÜYOR';
  const recommendation = level === 'ŞÜPHELİ' ? 'Açma ve bilgi girme. Kurumu resmi uygulama/site üzerinden kendin açarak doğrula.' : level === 'DİKKAT' ? 'Acele etme; alan adını ve göndereni bağımsız bir kanaldan doğrula.' : 'Belirgin URL sinyali az. Bu analiz güvenlik garantisi değildir.';
  return { score, level, signals, recommendation };
}

export interface BudgetSummary { income: number; expenses: number; debt: number; saving: number; balance: number; savingRate: number; }
export function summarizeBudget(entries: Array<{ kind: 'income' | 'fixed_expense' | 'variable_expense' | 'debt' | 'saving'; amount: number }>): BudgetSummary {
  const income = entries.filter((e) => e.kind === 'income').reduce((s, e) => s + Math.max(0, e.amount), 0);
  const expenses = entries.filter((e) => e.kind === 'fixed_expense' || e.kind === 'variable_expense').reduce((s, e) => s + Math.max(0, e.amount), 0);
  const debt = entries.filter((e) => e.kind === 'debt').reduce((s, e) => s + Math.max(0, e.amount), 0);
  const saving = entries.filter((e) => e.kind === 'saving').reduce((s, e) => s + Math.max(0, e.amount), 0);
  const balance = income - expenses - debt - saving;
  return { income, expenses, debt, saving, balance, savingRate: income ? Math.round((saving / income) * 100) : 0 };
}

export function normalizeCommand(text: string): { action: 'task' | 'reminder' | 'track' | 'scam' | 'budget' | 'research' | 'conversation'; confidence: number } {
  const q = text.toLowerCase();
  if (/dolandır|şüpheli mesaj|güvenli mi|scam|sahte mi/.test(q)) return { action: 'scam', confidence: 96 };
  if (/hatırlat|unutma|hatırlatıcı/.test(q)) return { action: 'reminder', confidence: 94 };
  if (/takip et|fiyat düşünce|fiyatı izle|izle/.test(q)) return { action: 'track', confidence: 92 };
  if (/bütçe|borç|gider|gelir|tasarruf|para plan/.test(q)) return { action: 'budget', confidence: 91 };
  if (/araştır|incele|kaynak bul|derinlemesine/.test(q)) return { action: 'research', confidence: 90 };
  if (/görev|yapılacak|yapmam lazım|listeye ekle/.test(q)) return { action: 'task', confidence: 89 };
  return { action: 'conversation', confidence: 60 };
}
