import { Groq } from "groq-sdk";

const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function askGroq(prompt: string | GroqMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("AI servisi yapılandırılmamış. GROQ_API_KEY eksik.");

  const messages = typeof prompt === "string"
    ? [{ role: "user" as const, content: prompt }]
    : prompt;
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature: 0.35,
    max_tokens: 900,
  });
  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("AI servisi boş yanıt döndürdü.");
  return content;
}