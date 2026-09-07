export interface BankingConnectionStart {
  authorizationUrl: string;
  state: string;
  provider: "configured-open-banking";
}

export interface ImportedTransaction {
  date: string;
  description: string;
  amountTRY: number;
  type: "income" | "expense";
}

function safeBase64(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

export function createBankingConnectionStart(redirectUri: string): BankingConnectionStart | null {
  const baseUrl = process.env.OPEN_BANKING_AUTHORIZE_URL?.trim();
  if (!baseUrl) return null;
  const clientId = process.env.OPEN_BANKING_CLIENT_ID?.trim();
  if (!clientId) return null;
  const state = safeBase64(`${Date.now()}:${Math.random()}`);
  const url = new URL(baseUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return { authorizationUrl: url.toString(), state, provider: "configured-open-banking" };
}

export function parseBankCsv(csv: string): ImportedTransaction[] {
  const rows = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) return [];
  return rows.slice(1).flatMap((row) => {
    const columns = row.split(/[;,]/).map((part) => part.trim().replace(/^"|"$/g, ""));
    if (columns.length < 3) return [];
    const date = columns[0];
    const description = columns[1];
    const normalized = columns[2].replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const amountTRY = Number(normalized);
    if (!date || !description || !Number.isFinite(amountTRY)) return [];
    return [{ date, description, amountTRY: Math.abs(amountTRY), type: amountTRY >= 0 ? "income" : "expense" }];
  });
}
