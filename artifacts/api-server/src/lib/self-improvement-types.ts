export type ImprovementStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "implemented"
  | "tested"
  | "failed";

export type ImprovementStage =
  | "analyze"
  | "branch"
  | "implement"
  | "test"
  | "diff"
  | "pr"
  | "awaiting_approval"
  | "merge";

export interface SelfImprovementPolicy {
  protectedBranches: string[];
  requireApprovalBeforeMerge: boolean;
  requireTestsBeforePr: boolean;
  allowDependencyChanges: boolean;
  maxChangedFilesPerRun: number;
}

export interface ImprovementProposal {
  id: string;
  title: string;
  reason: string;
  summary: string;
  source: "user_feedback" | "error" | "test_failure" | "performance" | "manual";
  targetFiles: string[];
  risk: "low" | "medium" | "high";
  status: ImprovementStatus;
  policy: SelfImprovementPolicy;
  blockedActions: string[];
  createdAt: string;
}

export interface ImprovementRun {
  proposalId: string;
  stage: ImprovementStage;
  branch?: string;
  testPassed?: boolean;
  diffReviewed?: boolean;
  pullRequestUrl?: string;
  updatedAt: string;
}

export const DEFAULT_SELF_IMPROVEMENT_POLICY: SelfImprovementPolicy = {
  protectedBranches: ["main", "master", "production"],
  requireApprovalBeforeMerge: true,
  requireTestsBeforePr: true,
  allowDependencyChanges: false,
  maxChangedFilesPerRun: 12,
};
