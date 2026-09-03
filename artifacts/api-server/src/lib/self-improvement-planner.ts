import {
  DEFAULT_SELF_IMPROVEMENT_POLICY,
  type ImprovementProposal,
  type SelfImprovementPolicy,
} from "./self-improvement-types.js";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "atlas-improvement";

const normalizeFiles = (files: string[], policy: SelfImprovementPolicy) => {
  const unique = [...new Set(files.map((file) => file.trim()).filter(Boolean))];
  return unique.slice(0, policy.maxChangedFilesPerRun);
};

export function buildImprovementPlan(input: {
  title: string;
  reason: string;
  summary: string;
  targetFiles?: string[];
  source?: ImprovementProposal["source"];
  policy?: SelfImprovementPolicy;
}): ImprovementProposal {
  const policy = input.policy ?? DEFAULT_SELF_IMPROVEMENT_POLICY;
  const targetFiles = normalizeFiles(input.targetFiles ?? [], policy);
  const dependencyChange = targetFiles.some((file) =>
    /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(file),
  );

  const risk = dependencyChange || targetFiles.length > 8 ? "medium" : "low";
  const blockedActions = [
    `Never write directly to protected branches: ${policy.protectedBranches.join(", ")}`,
    "Never merge a self-generated change without explicit user approval",
    ...(policy.requireTestsBeforePr ? ["Do not open a PR until required tests/build checks pass"] : []),
    ...(!policy.allowDependencyChanges && dependencyChange
      ? ["Dependency/lockfile changes are blocked by the default policy"]
      : []),
  ];

  return {
    id: `imp_${Date.now().toString(36)}`,
    title: input.title.trim() || "Atlas improvement",
    reason: input.reason.trim(),
    summary: input.summary.trim(),
    source: input.source ?? "manual",
    targetFiles,
    risk,
    status: "proposed",
    policy,
    blockedActions,
    createdAt: new Date().toISOString(),
  };
}

export function buildImprovementBranchName(proposal: ImprovementProposal) {
  return `atlas/improve/${slugify(proposal.title)}-${proposal.id}`;
}

export function canTransitionToMerge(
  proposal: ImprovementProposal,
  run: { testPassed?: boolean; diffReviewed?: boolean },
) {
  if (!proposal.policy.requireApprovalBeforeMerge) return false;
  return proposal.status === "approved" && run.testPassed === true && run.diffReviewed === true;
}
