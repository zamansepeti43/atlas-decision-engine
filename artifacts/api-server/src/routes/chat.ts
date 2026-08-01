import { Router } from "express";
import { buildAtlasPrompt } from "../lib/atlas-prompt.js";
import { askGemini } from "../services/gemini.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { message, history = [], memorySummary = "" } = req.body as {
      message?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      memorySummary?: string;
    };

    if (!message) {
      return res.status(400).json({
        error: "Mesaj gerekli.",
      });
    }

    const orderedHistory = history.length
      ? [...history, { role: 'user' as const, content: message }]
      : [{ role: 'user' as const, content: message }];

    const promptMessages = buildAtlasPrompt({
      message,
      history: orderedHistory,
      memorySummary,
    });
    const reply = await askGemini(promptMessages);
    const responseHistory = [
      ...orderedHistory,
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