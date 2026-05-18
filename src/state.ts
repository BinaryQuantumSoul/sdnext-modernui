/* Shared mutable state for the ModernUI extension */

export const state = {
  appUiUx: null as HTMLElement | null,
  uiFlagInitialized: false,
  uiFlagPortalInitialized: false,
  portalTotal: 0,
  asideFocusTracker: 0,
};
