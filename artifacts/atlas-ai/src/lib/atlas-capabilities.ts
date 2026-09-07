export type AtlasCapabilityId =
  | 'shopping'
  | 'finance'
  | 'scam-shield'
  | 'automotive'
  | 'real-estate'
  | 'career'
  | 'family'
  | 'learning'
  | 'memory'
  | 'tasks'
  | 'research';

export interface AtlasCapability {
  id: AtlasCapabilityId;
  title: string;
  description: string;
  examples: string[];
}

export const ATLAS_CAPABILITIES: AtlasCapability[] = [
  { id: 'shopping', title: 'Akıllı Alışveriş', description: 'Ürünleri, fiyatları, özellikleri ve değeri birlikte değerlendirir.', examples: ['Telefon bul', 'En iyi fiyatı karşılaştır', 'Fiyat düşünce haber ver'] },
  { id: 'finance', title: 'Para Asistanı', description: 'Bütçe, gider, borç ve hedefleri birlikte planlamaya yardım eder.', examples: ['Bu ay bütçemi planla', 'Borçlarımı sırala', '50 bin TL ile plan yap'] },
  { id: 'scam-shield', title: 'Dolandırıcılık Kalkanı', description: 'Mesaj, bağlantı veya ekran görüntüsündeki dolandırıcılık işaretlerini açıklar.', examples: ['Bu mesaj güvenli mi?', 'Bu link şüpheli mi?', 'Annemin aldığı mesajı kontrol et'] },
  { id: 'automotive', title: 'Otomobil', description: 'Araç ilanlarını, fiyatı, kullanım maliyetini ve riskleri karşılaştırır.', examples: ['900 bin TL altı otomatik araç bul', 'Bu iki aracı karşılaştır'] },
  { id: 'real-estate', title: 'Ev & Emlak', description: 'Kira ve satın alma seçeneklerini toplam maliyet ve ihtiyaçlara göre değerlendirir.', examples: ['25 bin TL civarı ev bul', 'Bu ilan mantıklı mı?'] },
  { id: 'career', title: 'Kariyer', description: 'İş, CV, beceri ve kariyer hedeflerini tek akışta ele alır.', examples: ['Bana uygun işler bul', 'CV mi değerlendir', 'Hangi beceriyi öğrenmeliyim?'] },
  { id: 'family', title: 'Aile', description: 'Aile görevleri, önemli tarihler ve ortak planları düzenlemeye yardımcı olur.', examples: ['Aile takvimi oluştur', 'Çocuğun ihtiyaçlarını listele'] },
  { id: 'learning', title: 'Öğrenme', description: 'Kişisel seviyeye göre öğretir, tekrar ve gelişim planı oluşturur.', examples: ['Bana İngilizce öğret', 'Bu konuyu basitçe anlat'] },
  { id: 'memory', title: 'Hafıza', description: 'Kullanıcının açıkça paylaştığı tercih ve karar bağlamını sonraki konuşmalarda kullanır.', examples: ['Benim için kamera önemli', 'Daha önceki tercihlerimi kullan'] },
  { id: 'tasks', title: 'Görevler & İzci', description: 'Atlas görev oluşturur; İzci takip eder ve değişiklikleri görünür kılar.', examples: ['Bunu takip et', 'Fiyat düşerse haber ver', 'Bana hatırlat'] },
  { id: 'research', title: 'Araştırma', description: 'Bir konu için kaynaklı araştırma ve karar özeti hazırlamaya uygundur.', examples: ['Derin araştır', 'Piyasayı incele'] },
];

export interface ScamAnalysis {
  score: number;
  level: 'DÜŞÜK RİSK' | 'ORTA RİSK' | 'YÜKSEK RİSK' | 'ÇOK YÜKSEK RİSK';
  signals: string[];
  recommendation: string;
}

const SCAM_PATTERNS: Array<[RegExp, string, number]> = [
  [/acil|hemen|son\s*şans|şimdi/i, 'Acil davranmaya zorlayan dil kullanıyor.', 14],
  [/ödül|kazandınız|çekiliş|hediye|50[\s.]?000|100[\s.]?000/i, 'Beklenmedik ödül veya para vaadi içeriyor.', 18],
  [/şifre|otp|doğrulama kodu|sms kodu|kart bilg|iban|tc kimlik/i, 'Hassas kimlik veya finans bilgisi talep ediyor.', 25],
  [/link|bağlantı|tıkla|giriş yap|hesabını doğrula/i, 'Bağlantıya tıklama veya hesap doğrulama çağrısı yapıyor.', 16],
  [/hesabınız kapanacak|bloke|ceza|icra|mahkeme/i, 'Korku veya hesap kapatma tehdidi kullanıyor.', 18],
  [/yatırım|kripto|garanti kazanç|katla|yüksek kazanç/i, 'Gerçek dışı veya aşırı kazanç vaadi içeriyor.', 18],
];

export function analyzeScamText(text: string): ScamAnalysis {
  const normalized = text.trim();
  if (!normalized) return { score: 0, level: 'DÜŞÜK RİSK', signals: [], recommendation: 'Analiz için bir mesaj veya bağlantı içeriği gir.' };

  let score = 8;
  const signals: string[] = [];
  for (const [pattern, signal, weight] of SCAM_PATTERNS) {
    if (pattern.test(normalized)) {
      score += weight;
      signals.push(signal);
    }
  }
  if (/https?:\/\//i.test(normalized)) {
    score += 8;
    signals.push('Mesajda dış bağlantı bulunuyor; alan adı ayrıca doğrulanmalı.');
  }
  score = Math.min(99, score);
  const level = score >= 80 ? 'ÇOK YÜKSEK RİSK' : score >= 60 ? 'YÜKSEK RİSK' : score >= 35 ? 'ORTA RİSK' : 'DÜŞÜK RİSK';
  const recommendation = score >= 60
    ? 'Bağlantıyı açma, ödeme yapma ve doğrulama kodu paylaşma. Kurumu kendi resmi kanalından doğrula.'
    : score >= 35
      ? 'İşlemi aceleye getirme; göndereni ve bağlantıyı bağımsız bir kanaldan doğrula.'
      : 'Belirgin dolandırıcılık sinyali az, ancak bu sonuç güvenlik garantisi değildir.';
  return { score, level, signals, recommendation };
}
