import { assertPurchaseAuthorized, type PurchaseAuthorization, type WebAgentPolicy } from "./atlas-capability-contracts.js";

export interface AgentAction {
  type: string;
  url?: string;
  domain?: string;
  selector?: string;
  value?: string;
  key?: string;
  query?: string;
}

export interface AgentTask {
  goal: string;
  allowedDomains: string[];
  maxActions: number;
  requireConfirmationFor: WebAgentPolicy["requireConfirmationFor"];
  actions: AgentAction[];
}

export function buildAgentTask(
  goal: string,
  allowedDomains: string[] = [],
  maxActions = 12,
  actions: AgentAction[] = [],
): AgentTask {
  return {
    goal: goal.trim().slice(0, 2000),
    allowedDomains: allowedDomains
      .map((domain) => domain.toLowerCase().replace(/^https?:\/\//, "").split("/")[0])
      .filter(Boolean)
      .slice(0, 30),
    maxActions: Math.max(1, Math.min(50, maxActions)),
    requireConfirmationFor: ["login", "payment", "purchase", "message", "account-change"],
    actions: actions.slice(0, 50).map((action) => ({
      type: String(action?.type ?? "").slice(0, 50),
      url: action?.url ? String(action.url).slice(0, 2000) : undefined,
      domain: action?.domain ? String(action.domain).slice(0, 255) : undefined,
      selector: action?.selector ? String(action.selector).slice(0, 500) : undefined,
      value: action?.value ? String(action.value).slice(0, 2000) : undefined,
      key: action?.key ? String(action.key).slice(0, 50) : undefined,
      query: action?.query ? String(action.query).slice(0, 500) : undefined,
    })),
  };
}

export async function runControlledWebAgent(task: AgentTask, confirmed = false): Promise<unknown> {
  const workerUrl = process.env.ATLAS_BROWSER_WORKER_URL?.trim();
  if (!workerUrl) throw new Error("ATLAS_BROWSER_WORKER_URL yapılandırılmamış.");
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ATLAS_BROWSER_WORKER_TOKEN
        ? { Authorization: `Bearer ${process.env.ATLAS_BROWSER_WORKER_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ task, confirmed }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Browser worker ${response.status} döndürdü.`);
  return response.json();
}

export function authorizePurchase(auth: PurchaseAuthorization): PurchaseAuthorization {
  assertPurchaseAuthorized(auth);
  return auth;
}
