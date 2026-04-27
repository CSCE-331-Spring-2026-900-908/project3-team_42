const ACTIVE_PORTAL_STORAGE_KEY = 'active_portal_path';

const ALLOWED_PORTAL_PATHS = new Set([
  '/manager',
  '/cashier',
  '/customer',
  '/menuboard',
]);

export function isAllowedPortalPath(path) {
  return ALLOWED_PORTAL_PATHS.has(path);
}

export function getActivePortalPath() {
  try {
    const path = sessionStorage.getItem(ACTIVE_PORTAL_STORAGE_KEY);
    return isAllowedPortalPath(path) ? path : null;
  } catch {
    return null;
  }
}

export function setActivePortalPath(path) {
  if (!isAllowedPortalPath(path)) return;

  try {
    sessionStorage.setItem(ACTIVE_PORTAL_STORAGE_KEY, path);
  } catch {
    /* ignore storage failures */
  }
}

export function clearActivePortalPath() {
  try {
    sessionStorage.removeItem(ACTIVE_PORTAL_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}
