/**
 * Shared constants for the Predinex frontend UI.
 */

/**
 * Standard sizes for Lucide icons (numeric)
 */
export const ICON_SIZE = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * Standard CSS classes for Lucide icons
 */
export const ICON_CLASS = {
  xs: 'w-3 h-3', // 12px
  sm: 'w-4 h-4', // 16px
  md: 'w-5 h-5', // 20px
  lg: 'w-6 h-6', // 24px
  xl: 'w-8 h-8', // 32px
} as const;

/**
 * Common animation duration classes
 */
export const ANIMATION_DURATION = {
  fast: 'duration-150',
  base: 'duration-300',
  slow: 'duration-500',
} as const;

export const CONTRACT_ADDRESS = "SP2WWKKF25SED3K5P6ETY7MDDNBQH50GPSP8EJM8N";
export const CONTRACT_NAME = "predinex-pool-v1";
