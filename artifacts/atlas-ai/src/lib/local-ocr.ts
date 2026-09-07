export interface OcrResult {
  text: string;
  confidence: number;
  provider: "tesseract.js" | "native-text-detector";
  language: "tur";
}

type TesseractModule = {
  createWorker: (language?: string, oem?: number, options?: Record<string, unknown>) => Promise<{
    recognize: (image: File | Blob | string) => Promise<{ data: { text: string; confidence?: number } }>;
    terminate: () => Promise<void>;
  }>;
};

let workerPromise: Promise<Awaited<ReturnType<NonNullable<TesseractModule["createWorker"]>>> | null = null;

async function loadTesseract(): Promise<TesseractModule> {
  // Tesseract.js is loaded only when the user explicitly asks for OCR. This keeps
  // the main bundle light and keeps OCR local in the browser (no image upload API).
  const moduleUrl = "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.esm.min.js";
  return (await import(/* @vite-ignore */ moduleUrl)) as unknown as TesseractModule;
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = loadTesseract().then((module) => module.createWorker("tur"));
  }
  return workerPromise;
}

export async function extractTurkishText(image: File | Blob): Promise<OcrResult> {
  if (!image) throw new Error("OCR için bir görsel seçilmelidir.");

  const worker = await getWorker();
  try {
    const result = await worker.recognize(image);
    const text = result.data.text.trim();
    return {
      text,
      confidence: Math.max(0, Math.min(100, Number(result.data.confidence ?? 0))),
      provider: "tesseract.js",
      language: "tur",
    };
  } finally {
    // Worker is deliberately kept alive between scans for faster follow-up OCR.
  }
}

export function releaseOcrWorker(): void {
  const current = workerPromise;
  workerPromise = null;
  void current?.then((worker) => worker.terminate()).catch(() => undefined);
}
