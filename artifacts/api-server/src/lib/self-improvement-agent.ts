import type { ImprovementProposal, ImprovementRun } from "./self-improvement-types.js";
import { SelfImprovementGuard } from "./self-improvement-orchestrator.js";

export interface CodingAgentContext {
  proposal: ImprovementProposal;
  run: ImprovementRun;
  repository: string;
  baseBranch: string;
  branch: string;
  instructions: string;
}

export interface CodingAgentResult {
  changedFiles: string[];
  summary: string;
  testCommand?: string;
  buildCommand?: string;
}

export interface CodingAgent {
  implement(context: CodingAgentContext): Promise<CodingAgentResult>;
}

/**
 * Produces a constrained coding-agent job. The actual model/worker is injected
 * separately so Atlas can use Ollama, a hosted model, or another agent runtime.
 */
export function buildCodingAgentContext(
  proposal: ImprovementProposal,
  run: ImprovementRun,
  repository: string,
  baseBranch = "main"
): CodingAgentContext {
  const branch = run.branch;
  if (!branch) throw new Error("A self-improvement branch is required before implementation");

  new SelfImprovementGuard(proposal.policy).assertSafeBranch(branch);

  return {
    proposal,
    run,
    repository,
    baseBranch,
    branch,
    instructions: [
      "Work only on the approved target files.",
      "Do not modify protected branches.",
      "Do not change dependencies unless explicitly allowed by policy.",
      "Preserve existing behavior outside the requested improvement.",
      "Add or update tests when behavior changes.",
      "Return a concise summary and the exact changed files.",
    ].join("\n"),
  };
}
