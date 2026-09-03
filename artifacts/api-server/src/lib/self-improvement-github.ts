import type { ImprovementProposal } from "./self-improvement-types.js";
import { buildImprovementBranchName } from "./self-improvement-planner.js";
import { SelfImprovementGuard } from "./self-improvement-orchestrator.js";

export interface GitHubWorkerPort {
  createBranch(branch: string, base: string): Promise<void>;
  writeFile(input: {
    branch: string;
    path: string;
    content: string;
    message: string;
  }): Promise<void>;
  createPullRequest(input: {
    branch: string;
    base: string;
    title: string;
    body: string;
    draft?: boolean;
  }): Promise<{ url: string }>;
}

export interface PreparedChange {
  path: string;
  content: string;
}

export async function applyPreparedChanges(
  worker: GitHubWorkerPort,
  proposal: ImprovementProposal,
  changes: PreparedChange[],
  baseBranch = "main",
) {
  const guard = new SelfImprovementGuard(proposal.policy);
  const branch = buildImprovementBranchName(proposal);
  guard.assertSafeBranch(branch);

  const allowed = new Set(proposal.targetFiles);
  const unique = new Map(changes.map((change) => [change.path, change]));

  if (unique.size > proposal.policy.maxChangedFilesPerRun) {
    throw new Error("Self-improvement change set exceeds the configured file limit");
  }

  for (const change of unique.values()) {
    if (!allowed.has(change.path)) {
      throw new Error(`Change outside approved target files: ${change.path}`);
    }
    if (!proposal.policy.allowDependencyChanges && /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(change.path)) {
      throw new Error(`Dependency change blocked by self-improvement policy: ${change.path}`);
    }
  }

  await worker.createBranch(branch, baseBranch);

  for (const change of unique.values()) {
    await worker.writeFile({
      branch,
      path: change.path,
      content: change.content,
      message: `Atlas improvement: ${proposal.title}`,
    });
  }

  return { branch, changedFiles: [...unique.keys()] };
}
