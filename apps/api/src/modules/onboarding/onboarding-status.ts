export const ONBOARDING_STEP_IDS = ["account", "session", "store", "line", "context", "activation"] as const;
export type OnboardingStepId = typeof ONBOARDING_STEP_IDS[number];

export interface OnboardingReadiness {
  store: boolean;
  line: boolean;
  context: boolean;
  activation: boolean;
}

// Later steps cannot bypass a missing prerequisite, even if records already exist.
export function buildOnboardingProgress(readiness: OnboardingReadiness) {
  const confirmations = [true, true, readiness.store, readiness.line, readiness.context, readiness.activation];
  let prerequisitesComplete = true;
  let currentAssigned = false;
  const steps = ONBOARDING_STEP_IDS.map((id, index) => {
    const completed = prerequisitesComplete && confirmations[index];
    prerequisitesComplete = completed;
    const state = completed ? "completed" : currentAssigned ? "pending" : "current";
    if (!completed) currentAssigned = true;
    return { id, state };
  });
  const completedSteps = steps.filter((step) => step.state === "completed").length;
  return { steps, completedSteps, progress: Math.round(completedSteps / ONBOARDING_STEP_IDS.length * 100), complete: completedSteps === ONBOARDING_STEP_IDS.length };
}
