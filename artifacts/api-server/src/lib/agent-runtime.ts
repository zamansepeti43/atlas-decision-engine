import { assertPurchaseAuthorized, type PurchaseAuthorization, type WebAgentPolicy } from "./atlas-capability-contracts.js";

export interface AgentTask {
  goal: string;
  allowedDomains: string[];
  maxActions: number;
  requireConfirmationFor: WebAgentPolicy["requireConfirmationFor"];
}

export function buildAgentTask(goal: string, allowedDomains: string[] = [], maxActions = 12): AgentTask {
  return {
    goal: goal.trim().slice(0, 2000),
    allowedDomains: allowedDomains.map((domain) => domain.toLowerCase().replace(/^https?:\/\//, "").split("/")[0]).filter(Boolean).slice(0, 30),
    maxActions: Math.max(1, Math.min(50, maxActions)),
    requireConfirmationFor: ["login", "payment", "purchase", "message", "account-change"],
  };
}

export async function runControlledWebAgent(task: AgentTask, confirmed = false): Promise<unknown> {
  const workerUrl = process.env.ATLAS_BROWSER_WORKER_URL?.trim();
  if (!workerUrl) throw new Error("ATLAS_BROWSER_WORKER_URL yapılandırılmamış.");
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.ATLAS_BROWSER_WORKER_TOKEN ? { Authorization: `Bearer ${process.env.ATLAS_BROWSER_WORKER_TOKEN}` } : {}) },
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
