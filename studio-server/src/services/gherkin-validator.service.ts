export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  scenarioCount: number;
  hasFeature: boolean;
  hasTags: boolean;
}

const FEATURE_RE = /^\s*Feature:\s*.+$/m;
const SCENARIO_RE = /^\s*Scenario(?:\s+Outline)?:\s*.+$/gm;
const STEP_KEYWORDS_RE = /^\s*(Given|When|Then|And|But)\s+\S+/gm;
const TAG_RE = /^\s*@\S+/m;

export class GherkinValidatorService {
  validate(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const trimmed = content.trim();
    if (!trimmed) {
      errors.push('Empty feature file');
      return {
        ok: false,
        errors,
        warnings,
        scenarioCount: 0,
        hasFeature: false,
        hasTags: false,
      };
    }

    const hasFeature = FEATURE_RE.test(content);
    if (!hasFeature) errors.push('Missing "Feature:" line');

    const scenarios = content.match(SCENARIO_RE) ?? [];
    if (scenarios.length === 0) errors.push('No scenarios found');

    const steps = content.match(STEP_KEYWORDS_RE) ?? [];
    if (steps.length === 0) {
      errors.push('No Given/When/Then/And/But steps found');
    } else if (steps.length < 2) {
      warnings.push('Test has only 1 step — usually needs at least 2 (action + assertion)');
    }

    const hasTags = TAG_RE.test(content);
    if (!hasTags) warnings.push('No tags (@smoke, @regression, ...) — recommended for filtering');

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      scenarioCount: scenarios.length,
      hasFeature,
      hasTags,
    };
  }
}

export const gherkinValidator = new GherkinValidatorService();
