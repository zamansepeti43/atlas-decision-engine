import {
  DEFAULT_SELF_IMPROVEMENT_POLICY,
  type ImprovementProposal,
  type ImprovementRun,
  type ImprovementStage,
  type SelfImprovementPolicy,
} from "./self-improvement-types.js";

const STAGE_ORDER: ImprovementStage[] = [
  "analyze",
  "branch",
  "implement",
  "test",
  "diff",
  "pr",
  "awaiting_approval",
  "merge",
];

export class SelfImprovementGuard {
  constructor(
    private readonly policy: SelfImprovementPolicy = DEFAULT_SELF_IMPROVEMENT_POLICY
  ) {}

  createRun(proposal: ImprovementProposal): ImprovementRun {
    if (this.policy.protectedBranches.includes("main")) {
      return {
        proposalId: proposal.id,
        stage: "analyze",
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      proposalId: proposal.id,
      stage: "analyze",
      updatedAt: new Date().toISOString(),
    };
  }

  canAdvance(run: ImprovementRun, nextStage: ImprovementStage): boolean {
    const currentIndex = STAGE_ORDER.indexOf(run.stage);
    const nextIndex = STAGE_ORDER.indexOf(nextStage);

    if (currentIndex < 0 || nextIndex !== currentIndex + 1) return false;
    if (nextStage === "pr" && this.policy.requireTestsBeforePr && run.testPassed !== true) return false;
    if (nextStage === "merge" && this.policy.requireApprovalBeforeMerge) return false;

    return true;
  }

  advance(
    run: ImprovementRun,
    nextStage: ImprovementStage,
    patch: Partial<ImprovementRun> = {}
  ): ImprovementRun {
    if (!this.canAdvance(run, nextStage)) {
      throw new Error(`Blocked self-improvement transition: ${run.stage} -> ${nextStage}`);
    }

    return {
      ...run,
      ...patch,
      stage: nextStage,
      updatedAt: new Date().toISOString(),
    };
  }

  assertSafeBranch(branch: string): void {
    if (this.policy.protectedBranches.includes(branch)) {
      throw new Error(`Protected branch cannot be modified by self-improvement: ${branch}`);
    }
  }
}
