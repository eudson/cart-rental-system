/**
 * Runtime theming token names that organizations may override in Phase 2.
 * These map directly to CSS custom properties defined in apps/web/src/index.css.
 */
export const ORGANIZATION_THEME_TOKEN_NAMES = [
  '--color-primary',
  '--color-primary-foreground',
  '--color-secondary',
  '--color-secondary-foreground',
  '--color-accent',
  '--color-accent-foreground',
] as const;

export type OrganizationThemeTokenName =
  (typeof ORGANIZATION_THEME_TOKEN_NAMES)[number];

export type OrganizationThemeTokenValue = string;

/**
 * Canonical token payload shape shared between API and web for runtime theming.
 */
export type OrganizationThemeTokens = Record<
  OrganizationThemeTokenName,
  OrganizationThemeTokenValue
>;
