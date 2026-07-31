import { Router } from "express";
import { askGemini } from "../services/gemini.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { message, history = [] } = req.body as {
      message?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!message) {
      return res.status(400).json({
        error: "Mesaj gerekli.",
      });
    }

    const prompt = history.length
      ? [
          ...history.map((entry) => `${entry.role === "user" ? "Kullanıcı" : "Atlas"}: ${entry.content}`),
          `Kullanıcı: ${message}`,
        ].join("\n")
      : message;

    const reply = await askGemini(prompt);
    const responseHistory = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ];

    return res.json({
      success: true,
      reply,
      history: responseHistory,
    });
  } catch (error) {
    console.error("CHAT HATASI:", error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;