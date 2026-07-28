// Atlas AI Decision Analysis Engine
// This module handles the decision analysis logic

export interface AnalysisResult {
  score: number;
  recommendation: string;
  advantages: string[];
  disadvantages: string[];
  alternatives: Array<{
    name: string;
    description: string;
    score: number;
  }>;
  reasoning: string;
  confidenceLevel: number; // 0-100
}

/**
 * Analyzes a user's decision question and returns a detailed report
 *
 * TODO: Replace mock implementation with OpenAI API integration
 *
 * Example OpenAI integration:
 *
 * ```typescript
 * import OpenAI from 'openai';
 *
 * const openai = new OpenAI({
 *   apiKey: import.meta.env.VITE_OPENAI_API_KEY,
 * });
 *
 * export async function analyzeDecision(question: string): Promise<AnalysisResult> {
 *   const completion = await openai.chat.completions.create({
 *     model: "gpt-4-turbo-preview",
 *     messages: [
 *       {
 *         role: "system",
 *         content: `Sen bir karar analizi uzmanısın. Kullanıcının sorusunu analiz et ve şu formatta yanıt ver:
 *
 * SCORE: [0-100 arası puan]
 * RECOMMENDATION: [Ana öneri]
 * ADVANTAGES: [Avantaj 1] | [Avantaj 2] | [Avantaj 3]
 * DISADVANTAGES: [Dezavantaj 1] | [Dezavantaj 2]
 * ALTERNATIVE_1: [İsim] - [Açıklama] - [Puan]
 * ALTERNATIVE_2: [İsim] - [Açıklama] - [Puan]
 * REASONING: [2-3 cümlelik açıklama]
 * CONFIDENCE: [0-100 arası güven skoru]`
 *       },
 *       {
 *         role: "user",
 *         content: question
 *       }
 *     ],
 *     temperature: 0.7,
 *   });
 *
 *   // Parse the response and structure it into AnalysisResult format
 *   const content = completion.choices[0].message.content || '';
 *   // ... parsing logic here ...
 *
 *   return parsedResult;
 * }
 * ```
 */
export async function analyzeDecision(question: string): Promise<AnalysisResult> {
  // Simulate API delay — 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Mock data — replace with actual OpenAI API call
  const mockResults: Record<string, AnalysisResult> = {
    default: {
      score: 78,
      recommendation: "Samsung Galaxy S24 sizin için en uygun seçenek",
      advantages: [
        "Mükemmel kamera kalitesi ve AI destekli fotoğraf özellikleri",
        "Uzun pil ömrü — 5.000 mAh batarya ile tam gün kullanım",
        "Snapdragon 8 Gen 3 ile sektörün en güçlü performansı",
        "120Hz AMOLED ekran ile sinema kalitesinde görüntü",
      ],
      disadvantages: [
        "Bütçenizin üst limitinde — yaklaşık 39.999 TL",
        "Şarj aleti ve kulaklık kutuya dahil değil",
        "Hafıza kartı desteği bulunmuyor",
      ],
      alternatives: [
        {
          name: "iPhone 15",
          description: "Apple ekosistemi, 5 yıl yazılım desteği, A16 Bionic",
          score: 74,
        },
        {
          name: "Google Pixel 8",
          description: "Saf Android, yapay zeka ile en iyi fotoğraf kalitesi",
          score: 71,
        },
        {
          name: "OnePlus 12",
          description: "En iyi fiyat/performans, 100W hızlı şarj",
          score: 76,
        },
      ],
      reasoning:
        "40.000 TL bütçeniz ve günlük kullanım ihtiyaçlarınız göz önüne alındığında Samsung Galaxy S24, en iyi değer-performans dengesini sunmaktadır. Fotoğraf kalitesi, pil ömrü ve işlemci performansı açısından rakiplerini geride bırakmaktadır. Özellikle AI destekli özellikleriyle uzun vadede sizin için en akıllı yatırım olacaktır.",
      confidenceLevel: 91,
    },
    laptop: {
      score: 82,
      recommendation: "MacBook Air M3 (13 inç) en dengeli seçim",
      advantages: [
        "M3 çipi ile olağanüstü performans ve enerji verimliliği",
        "18 saate kadar kesintisiz pil ömrü",
        "Tamamen sessiz çalışma — fanız yok, ısı sorunu yok",
        "macOS ekosistemi ve 7 yıl yazılım güncellemesi garantisi",
      ],
      disadvantages: [
        "RAM ve depolama sonradan yükseltilemiyor",
        "Sadece 2 Thunderbolt portu — dongle gerekebilir",
        "Windows oyunları çalıştırmak için Crossover veya VM şart",
      ],
      alternatives: [
        {
          name: "Dell XPS 13 Plus",
          description: "Windows, Intel Core Ultra, daha geniş port çeşitliliği",
          score: 77,
        },
        {
          name: "ThinkPad X1 Carbon",
          description: "İş dünyası standardı, askeri sertifikalı dayanıklılık",
          score: 75,
        },
        {
          name: "ASUS Zenbook 14 OLED",
          description: "Parlak OLED ekran, AMD Ryzen 7, uygun fiyat",
          score: 73,
        },
      ],
      reasoning:
        "Taşınabilir bir dizüstü bilgisayar arıyorsanız MacBook Air M3, pil ömrü, performans ve sessiz çalışma konularında rakipsizdir. Özellikle kreatif işler ve günlük verimlilik görevleri için hem şimdiki hem de gelecekteki ihtiyaçlarınızı karşılayacak kapasitede bir yatırımdır.",
      confidenceLevel: 88,
    },
    araba: {
      score: 85,
      recommendation: "Toyota Corolla Hybrid sizin için en akıllı tercih",
      advantages: [
        "Yakıt tüketimi 4.5 L/100km ile sınıfının en ekonomiği",
        "Hybrid teknolojisi ile uzun vadede ciddi tasarruf",
        "Toyota'nın efsanevi güvenilirlik sicili ve yaygın servis ağı",
        "5 yıl fabrika garantisi",
      ],
      disadvantages: [
        "Benzer büyüklükteki rakiplerine göre daha yüksek liste fiyatı",
        "Dizel alternatiflere kıyasla uzun yol performansı daha mütevazı",
      ],
      alternatives: [
        {
          name: "Volkswagen Golf 1.5 eTSI",
          description: "Avrupa sınıfının zirvesi, hafif hibrit teknoloji",
          score: 80,
        },
        {
          name: "Honda Civic e:HEV",
          description: "Tam hibrit, sporif tasarım, düşük emisyon",
          score: 78,
        },
        {
          name: "Hyundai Elantra Hybrid",
          description: "Üstün fiyat/değer oranı, 5 yıl garanti",
          score: 76,
        },
      ],
      reasoning:
        "Günlük şehir kullanımı ve uzun yol seyahati için Corolla Hybrid, yakıt tasarrufu ve güvenilirlik kriterlerinde öne çıkmaktadır. İlk alış maliyeti yüksek görünse de 3 yılda yakıt tasarrufuyla farkı fazlasıyla kapatmaktadır.",
      confidenceLevel: 94,
    },
  };

  // Keyword detection for demo purposes
  const lowerQuestion = question.toLowerCase();

  if (
    lowerQuestion.includes('laptop') ||
    lowerQuestion.includes('bilgisayar') ||
    lowerQuestion.includes('dizüstü') ||
    lowerQuestion.includes('macbook') ||
    lowerQuestion.includes('notebook')
  ) {
    return mockResults.laptop;
  }

  if (
    lowerQuestion.includes('araba') ||
    lowerQuestion.includes('araç') ||
    lowerQuestion.includes('otomobil') ||
    lowerQuestion.includes('toyota') ||
    lowerQuestion.includes('volkswagen')
  ) {
    return mockResults.araba;
  }

  return mockResults.default;
}
