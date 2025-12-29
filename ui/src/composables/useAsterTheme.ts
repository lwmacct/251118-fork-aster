import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

/**
 * Aster UI Protocol Theme System
 *
 * Provides theming support using CSS custom properties.
 * Themes can be applied via:
 * 1. Protocol styles in BeginRenderingMessage
 * 2. Programmatic theme switching
 * 3. CSS class-based theming (dark mode)
 */

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Theme variables that can be customized
 */
export interface AsterThemeVariables {
  // Primary Colors
  '--aster-primary'?: string;
  '--aster-primary-hover'?: string;
  '--aster-primary-light'?: string;
  '--aster-primary-dark'?: string;
  '--aster-primary-contrast'?: string;

  // Secondary Colors
  '--aster-secondary'?: string;
  '--aster-secondary-hover'?: string;
  '--aster-secondary-light'?: string;
  '--aster-secondary-dark'?: string;
  '--aster-secondary-contrast'?: string;

  // Surface Colors
  '--aster-surface'?: string;
  '--aster-surface-hover'?: string;
  '--aster-surface-elevated'?: string;

  // Background Colors
  '--aster-background'?: string;
  '--aster-background-alt'?: string;

  // Border Colors
  '--aster-border'?: string;
  '--aster-border-focus'?: string;

  // Text Colors
  '--aster-text'?: string;
  '--aster-text-secondary'?: string;
  '--aster-text-muted'?: string;
  '--aster-text-inverse'?: string;

  // Status Colors
  '--aster-success'?: string;
  '--aster-success-light'?: string;
  '--aster-warning'?: string;
  '--aster-warning-light'?: string;
  '--aster-error'?: string;
  '--aster-error-light'?: string;
  '--aster-info'?: string;
  '--aster-info-light'?: string;

  // Typography
  '--aster-font-family'?: string;
  '--aster-font-family-mono'?: string;
  '--aster-font-size-xs'?: string;
  '--aster-font-size-sm'?: string;
  '--aster-font-size-base'?: string;
  '--aster-font-size-lg'?: string;
  '--aster-font-size-xl'?: string;
  '--aster-font-size-2xl'?: string;
  '--aster-font-size-3xl'?: string;

  // Spacing
  '--aster-spacing-xs'?: string;
  '--aster-spacing-sm'?: string;
  '--aster-spacing-md'?: string;
  '--aster-spacing-lg'?: string;
  '--aster-spacing-xl'?: string;
  '--aster-spacing-2xl'?: string;

  // Border Radius
  '--aster-radius-sm'?: string;
  '--aster-radius-md'?: string;
  '--aster-radius-lg'?: string;
  '--aster-radius-xl'?: string;
  '--aster-radius-full'?: string;

  // Shadows
  '--aster-shadow-sm'?: string;
  '--aster-shadow-md'?: string;
  '--aster-shadow-lg'?: string;
  '--aster-shadow-xl'?: string;

  // Transitions
  '--aster-transition-fast'?: string;
  '--aster-transition-normal'?: string;
  '--aster-transition-slow'?: string;
  '--aster-transition-easing'?: string;

  // Allow any custom CSS variable
  [key: `--${string}`]: string | undefined;
}

/**
 * Theme preset definition
 */
export interface AsterThemePreset {
  name: string;
  mode: ThemeMode;
  variables: AsterThemeVariables;
}

/**
 * Default light theme preset
 */
export const LIGHT_THEME: AsterThemePreset = {
  name: 'light',
  mode: 'light',
  variables: {},
};

/**
 * Default dark theme preset
 */
export const DARK_THEME: AsterThemePreset = {
  name: 'dark',
  mode: 'dark',
  variables: {},
};

/**
 * Global theme state
 */
const globalThemeMode = ref<ThemeMode>('system');
const globalCustomVariables = ref<AsterThemeVariables>({});

/**
 * Check if system prefers dark mode
 */
function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Get effective theme mode (resolves 'system' to actual mode)
 */
function getEffectiveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemPrefersDark() ? 'dark' : 'light';
  }
  return mode;
}

/**
 * Apply theme mode to document
 */
function applyThemeModeToDocument(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const effectiveMode = getEffectiveMode(mode);
  const html = document.documentElement;

  if (effectiveMode === 'dark') {
    html.classList.add('dark');
    html.setAttribute('data-theme', 'dark');
  }
  else {
    html.classList.remove('dark');
    html.setAttribute('data-theme', 'light');
  }
}

/**
 * Apply CSS variables to an element
 */
function applyCSSVariables(
  element: HTMLElement,
  variables: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(variables)) {
    if (key.startsWith('--') && value) {
      element.style.setProperty(key, value);
    }
  }
}

/**
 * Remove CSS variables from an element
 */
function removeCSSVariables(
  element: HTMLElement,
  variables: Record<string, string>,
): void {
  for (const key of Object.keys(variables)) {
    if (key.startsWith('--')) {
      element.style.removeProperty(key);
    }
  }
}

/**
 * Convert protocol styles to CSS style object
 * Validates that only CSS custom properties are applied
 */
export function convertProtocolStyles(
  styles: Record<string, string> | undefined,
): Record<string, string> {
  if (!styles) return {};

  const cssVariables: Record<string, string> = {};

  for (const [key, value] of Object.entries(styles)) {
    // Only allow CSS custom properties (starting with --)
    if (key.startsWith('--') && typeof value === 'string') {
      cssVariables[key] = value;
    }
  }

  return cssVariables;
}

/**
 * Composable options
 */
export interface UseAsterThemeOptions {
  /** Initial theme mode */
  initialMode?: ThemeMode;
  /** Initial custom variables */
  initialVariables?: AsterThemeVariables;
  /** Whether to sync with global theme state */
  syncGlobal?: boolean;
}

/**
 * Composable return type
 */
export interface UseAsterThemeReturn {
  /** Current theme mode */
  themeMode: Ref<ThemeMode>;
  /** Effective theme mode (resolved from 'system') */
  effectiveMode: ComputedRef<'light' | 'dark'>;
  /** Whether dark mode is active */
  isDark: ComputedRef<boolean>;
  /** Custom theme variables */
  customVariables: Ref<AsterThemeVariables>;
  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => void;
  /** Set custom variables */
  setCustomVariables: (variables: AsterThemeVariables) => void;
  /** Apply theme to an element */
  applyTheme: (element: HTMLElement, variables?: Record<string, string>) => void;
  /** Remove theme from an element */
  removeTheme: (element: HTMLElement, variables?: Record<string, string>) => void;
  /** Toggle between light and dark mode */
  toggleTheme: () => void;
  /** Convert protocol styles to CSS variables */
  convertStyles: typeof convertProtocolStyles;
}

/**
 * Aster Theme Composable
 *
 * Provides theme management for Aster UI components.
 *
 * @example
 * ```ts
 * const { themeMode, isDark, setThemeMode, applyTheme } = useAsterTheme();
 *
 * // Set theme mode
 * setThemeMode('dark');
 *
 * // Apply custom variables to an element
 * applyTheme(element, { '--aster-primary': '#ff0000' });
 * ```
 */
export function useAsterTheme(options: UseAsterThemeOptions = {}): UseAsterThemeReturn {
  const {
    initialMode = 'system',
    initialVariables = {},
    syncGlobal = true,
  } = options;

  // Local state (synced with global if syncGlobal is true)
  const themeMode = syncGlobal ? globalThemeMode : ref<ThemeMode>(initialMode);
  const customVariables = syncGlobal ? globalCustomVariables : ref<AsterThemeVariables>(initialVariables);

  // Initialize if not syncing global
  if (!syncGlobal) {
    themeMode.value = initialMode;
    customVariables.value = initialVariables;
  }

  // Computed effective mode
  const effectiveMode = computed(() => getEffectiveMode(themeMode.value));

  // Computed isDark
  const isDark = computed(() => effectiveMode.value === 'dark');

  // Watch theme mode changes and apply to document
  watch(
    themeMode,
    (mode) => {
      applyThemeModeToDocument(mode);
    },
    { immediate: true },
  );

  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themeMode.value === 'system') {
        applyThemeModeToDocument('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
  }

  /**
   * Set theme mode
   */
  function setThemeMode(mode: ThemeMode): void {
    themeMode.value = mode;
  }

  /**
   * Set custom variables
   */
  function setCustomVariables(variables: AsterThemeVariables): void {
    customVariables.value = { ...customVariables.value, ...variables };
  }

  /**
   * Apply theme to an element
   */
  function applyTheme(element: HTMLElement, variables?: Record<string, string>): void {
    const varsToApply = variables ?? customVariables.value;
    applyCSSVariables(element, varsToApply as Record<string, string>);
  }

  /**
   * Remove theme from an element
   */
  function removeTheme(element: HTMLElement, variables?: Record<string, string>): void {
    const varsToRemove = variables ?? customVariables.value;
    removeCSSVariables(element, varsToRemove as Record<string, string>);
  }

  /**
   * Toggle between light and dark mode
   */
  function toggleTheme(): void {
    if (themeMode.value === 'system') {
      // If system, switch to opposite of current effective mode
      themeMode.value = effectiveMode.value === 'dark' ? 'light' : 'dark';
    }
    else {
      themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark';
    }
  }

  return {
    themeMode,
    effectiveMode,
    isDark,
    customVariables,
    setThemeMode,
    setCustomVariables,
    applyTheme,
    removeTheme,
    toggleTheme,
    convertStyles: convertProtocolStyles,
  };
}

/**
 * Create a theme preset
 */
export function createThemePreset(
  name: string,
  mode: ThemeMode,
  variables: AsterThemeVariables,
): AsterThemePreset {
  return { name, mode, variables };
}

/**
 * Merge theme variables
 */
export function mergeThemeVariables(
  ...themes: (AsterThemeVariables | undefined)[]
): AsterThemeVariables {
  return themes.reduce<AsterThemeVariables>((acc, theme) => {
    if (theme) {
      return { ...acc, ...theme };
    }
    return acc;
  }, {});
}
