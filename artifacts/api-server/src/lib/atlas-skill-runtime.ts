export interface AtlasSkill {
  name: string;
  description: string;
  triggers: string[];
  instructions: string[];
}

export const ATLAS_SKILLS: AtlasSkill[] = [
  {
    name: "atlas-project-development",
    description: "Disciplined software development workflow.",
    triggers: ["kod", "proje", "uygulama", "site", "hata", "bug", "build", "deploy", "github", "vercel"],
    instructions: [
      "Önce mevcut yapıyı ve ilgili dosyaları incele.",
      "Görevi küçük, doğrulanabilir adımlara böl.",
      "Değişiklikten sonra typecheck/build/test çalıştır.",
      "Başarısız doğrulamayı başarı olarak raporlama; düzelt ve tekrar dene.",
    ],
  },
  {
    name: "webapp-testing",
    description: "Web uygulaması doğrulama yaklaşımı.",
    triggers: ["test", "tarayıcı", "browser", "ui", "arayüz", "buton", "form", "localhost"],
    instructions: [
      "Dinamik web uygulamasında önce sayfanın gerçekten yüklendiğini doğrula.",
      "Eylemden önce rendered state ve selector'ları keşfet.",
      "Kritik kullanıcı akışlarını doğrula ve sonucu açıkça raporla.",
    ],
  },
  {
    name: "playwright-browser-automation",
    description: "Tarayıcı otomasyonu ve UI doğrulaması.",
    triggers: ["playwright", "chrome", "tarayıcı", "browser", "screenshot", "ekran görüntüsü"],
    instructions: [
      "Önce gözlemle, sonra eylem gerçekleştir.",
      "Selector'ları rendered sayfadan keşfet; varsayılan selector uydurma.",
      "İşlem sonunda beklenen UI durumunu yeniden doğrula.",
    ],
  },
  {
    name: "using-git-worktrees",
    description: "İzole Git çalışma alanı yaklaşımı.",
    triggers: ["git", "branch", "worktree", "pull request", "pr", "commit"],
    instructions: [
      "Büyük veya riskli değişiklikleri izole bir çalışma alanında ele al.",
      "Ana dalı gereksiz yere bozma.",
      "Değişiklikleri küçük ve gözden geçirilebilir tut.",
    ],
  },
  {
    name: "subagent-driven-development",
    description: "Karmaşık işleri kontrollü alt görevlere ayırma.",
    triggers: ["büyük", "kapsamlı", "birden fazla", "hepsini", "tamamla", "otomatik"],
    instructions: [
      "Karmaşık işi bağımsız alt görevlere ayır.",
      "Her alt görevin çıktısını bir sonraki adıma girdi yap.",
      "Birleştirmeden önce bütünsel doğrulama yap.",
    ],
  },
  {
    name: "skill-creator",
    description: "Yeni uzmanlık skill'i tasarlama ve iyileştirme.",
    triggers: ["skill", "yetenek", "uzman", "öğret", "öğrensin"],
    instructions: [
      "Tekrarlanan bir görevi tanımla ve tetikleyicilerini belirle.",
      "İş akışını kısa, prosedürel ve yeniden kullanılabilir talimatlara ayır.",
      "Gerekirse script, referans ve varlıkları ayrı kaynaklar olarak tanımla.",
    ],
  },
];

export function selectAtlasSkills(message: string): AtlasSkill[] {
  const text = message.toLocaleLowerCase("tr-TR");
  const scored = ATLAS_SKILLS.map((skill) => ({
    skill,
    score: skill.triggers.reduce((score, trigger) => score + (text.includes(trigger) ? 1 : 0), 0),
  }));

  const selected = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.skill);
  return selected.length > 0 ? selected.slice(0, 3) : [ATLAS_SKILLS[0]];
}

export function formatSelectedSkills(message: string): string {
  return selectAtlasSkills(message)
    .map((skill) => `SKILL: ${skill.name}\n${skill.instructions.map((instruction) => `- ${instruction}`).join("\n")}`)
    .join("\n\n");
}
