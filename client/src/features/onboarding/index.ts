// Onboarding Feature Exports

// Main wizard component
export { OnboardingWizard, default as OnboardingWizardDefault } from './OnboardingWizard';

// Individual step components
export { WelcomeStep } from './steps/WelcomeStep';
export { BusinessProfileStep } from './steps/BusinessProfileStep';
export { StatementUploadStep } from './steps/StatementUploadStep';
export { CategorySetupStep } from './steps/CategorySetupStep';
export { TaxSetupStep } from './steps/TaxSetupStep';
export { GoalsStep } from './steps/GoalsStep';
export { CompletionStep } from './steps/CompletionStep';

// Types and utilities
export type { OnboardingData, OnboardingStepProps } from './types';
export {
    ENTITY_TYPES,
    INDUSTRIES,
    DEFAULT_CATEGORIES,
    FINANCIAL_GOALS,
    ONBOARDING_STORAGE_KEY,
    createInitialOnboardingData,
} from './types';
