/**
 * Cart in localStorage (key: gmc_cart).
 * Dispatches "cart:updated" CustomEvent on every mutation.
 */
const CART_KEY = "gmc_cart";

/**
 * @typedef {{ productId: string, name: string, price: number, size: string, color: string, qty: number, imageUrl?: string }} CartItem
 */

/**
 * @returns {CartItem[]}
 */
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {CartItem[]} items
 */
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(
    new CustomEvent("cart:updated", { detail: { items, count: cartCount(items) } })
  );
}

/**
 * @param {CartItem[]} [items]
 */
export function cartCount(items = getCart()) {
  return items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
}

/**
 * @param {CartItem[]} [items]
 */
export function cartSubtotal(items = getCart()) {
  return items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
}

/**
 * Add or merge identical product+size+color lines.
 * @param {Omit<CartItem, 'qty'> & { qty?: number }} item
 */
export function addToCart(item) {
  if (!item?.productId || !item.size || !item.color) {
    throw new Error("Taille et couleur requises.");
  }
  const qty = Math.max(1, Math.min(10, Number(item.qty) || 1));
  const cart = getCart();
  const idx = cart.findIndex(
    (c) =>
      c.productId === item.productId &&
      c.size === item.size &&
      c.color.toLowerCase() === item.color.toLowerCase()
  );
  if (idx >= 0) {
    cart[idx].qty = Math.min(10, cart[idx].qty + qty);
    if (item.imageUrl) cart[idx].imageUrl = item.imageUrl;
    if (item.name) cart[idx].name = item.name;
    if (typeof item.price === "number") cart[idx].price = item.price;
  } else {
    cart.push({
      productId: item.productId,
      name: item.name || "Produit",
      price: Number(item.price) || 0,
      size: item.size,
      color: item.color,
      qty,
      imageUrl: item.imageUrl || "",
    });
  }
  saveCart(cart);
  return cart;
}

/**
 * @param {number} index
 */
export function removeFromCart(index) {
  const cart = getCart();
  if (index < 0 || index >= cart.length) return cart;
  cart.splice(index, 1);
  saveCart(cart);
  return cart;
}

/**
 * Remove by productId + size + color.
 */
export function removeCartLine(productId, size, color) {
  const cart = getCart().filter(
    (c) =>
      !(
        c.productId === productId &&
        c.size === size &&
        c.color.toLowerCase() === String(color).toLowerCase()
      )
  );
  saveCart(cart);
  return cart;
}

/**
 * @param {number} index
 * @param {number} qty
 */
export function updateQty(index, qty) {
  const cart = getCart();
  if (index < 0 || index >= cart.length) return cart;
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 1) {
    return removeFromCart(index);
  }
  cart[index].qty = Math.min(10, n);
  saveCart(cart);
  return cart;
}

export function clearCart() {
  saveCart([]);
}

/**
 * Payload for createOrder callable (no client prices trusted server-side).
 */
export function toCheckoutPayload() {
  return getCart().map((c) => ({
    productId: c.productId,
    size: c.size,
    color: c.color,
    qty: c.qty,
  }));
}
