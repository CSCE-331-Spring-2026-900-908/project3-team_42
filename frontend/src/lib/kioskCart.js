export const CUSTOMER_KIOSK_CART_STORAGE_KEY = 'customer_kiosk_active_cart';

export function loadActiveKioskCart() {
  try {
    const saved = sessionStorage.getItem(CUSTOMER_KIOSK_CART_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveActiveKioskCart(cart) {
  try {
    if (!Array.isArray(cart) || cart.length === 0) {
      sessionStorage.removeItem(CUSTOMER_KIOSK_CART_STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(CUSTOMER_KIOSK_CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* ignore storage failures */
  }
}

export function clearActiveKioskCart() {
  try {
    sessionStorage.removeItem(CUSTOMER_KIOSK_CART_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}
