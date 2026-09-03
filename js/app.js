const CONFIG = window.CRISSYY_CONFIG;
const sb = window.supabaseClient;

let products = [];
let categories = [];
let cart = {}; // { productId: quantity }

const productGrid = document.getElementById("productGrid");
const sectionTabsEl = document.getElementById("sectionTabs");
let activeSectionId = null; // null/"__unsectioned__" are valid values too
const cartItemsEl = document.getElementById("cartItems");
const cartFooterEl = document.getElementById("cartFooter");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");

function formatPrice(amount) {
  return `${CONFIG.CURRENCY_SYMBOL}${Number(amount).toLocaleString()}`;
}

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("open");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("open");
}

document.getElementById("openCartBtn").addEventListener("click", openCart);
document.getElementById("closeCartBtn").addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

async function loadProducts() {
  const [productsRes, categoriesRes] = await Promise.all([
    sb.from("products").select("*").eq("is_active", true).order("created_at", { ascending: true }),
    sb.from("categories").select("*").order("sort_order", { ascending: true }),
  ]);

  if (productsRes.error) {
    productGrid.innerHTML = `<div class="empty-state">Couldn't load snacks right now. Please refresh.</div>`;
    console.error(productsRes.error);
    return;
  }

  products = productsRes.data || [];
  categories = categoriesRes.data || [];
  renderProducts();
}

function productCardHtml(p) {
  const outOfStock = p.quantity <= 0;
  const thumb = p.image_url
    ? `<img src="${p.image_url}" alt="${p.name}" />`
    : `<span class="placeholder-emoji">🍿</span>`;
  return `
    <div class="product-card">
      <div class="thumb">${thumb}</div>
      <h3>${p.name}</h3>
      <p class="desc">${p.description || ""}</p>
      <div class="price-row">
        <div>
          <div class="price">${formatPrice(p.price)}</div>
          <div class="stock-note">${outOfStock ? "Out of stock" : `${p.quantity} left`}</div>
        </div>
        <button class="add-btn" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>
          ${outOfStock ? "Sold out" : "Add"}
        </button>
      </div>
    </div>
  `;
}

function renderProducts() {
  if (!products.length) {
    sectionTabsEl.innerHTML = "";
    productGrid.innerHTML = `<div class="empty-state">No snacks available right now — check back soon!</div>`;
    return;
  }

  // Group products by section (category). Products with no section land
  // in a trailing "More snacks" tab, only shown if any exist.
  const grouped = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: products.filter((p) => p.category_id === c.id),
    }))
    .filter((g) => g.items.length);

  const unsectioned = products.filter((p) => !p.category_id);
  if (unsectioned.length) {
    grouped.push({ id: "__unsectioned__", name: "More snacks", items: unsectioned });
  }

  // Keep the currently active tab selected if it still has items,
  // otherwise fall back to the first available section.
  if (!grouped.some((g) => g.id === activeSectionId)) {
    activeSectionId = grouped.length ? grouped[0].id : null;
  }

  // Only show a tab bar when there's more than one section to switch between.
  sectionTabsEl.innerHTML =
    grouped.length > 1
      ? grouped
          .map(
            (g) => `
              <button class="tab-btn${g.id === activeSectionId ? " active" : ""}" data-section-id="${g.id}">
                ${g.name}
              </button>
            `
          )
          .join("")
      : "";

  sectionTabsEl.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeSectionId = btn.dataset.sectionId;
      renderProducts();
    });
  });

  const activeGroup = grouped.find((g) => g.id === activeSectionId);

  productGrid.innerHTML = activeGroup
    ? `<div class="product-grid">${activeGroup.items.map(productCardHtml).join("")}</div>`
    : `<div class="empty-state">No snacks available right now — check back soon!</div>`;

  productGrid.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.dataset.id));
  });
}

function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  const currentQty = cart[productId] || 0;
  if (currentQty + 1 > product.quantity) return; // don't exceed stock
  cart[productId] = currentQty + 1;
  renderCart();
}

function changeQty(productId, delta) {
  const product = products.find((p) => p.id === productId);
  const nextQty = (cart[productId] || 0) + delta;
  if (nextQty <= 0) {
    delete cart[productId];
  } else if (product && nextQty > product.quantity) {
    return; // don't exceed stock
  } else {
    cart[productId] = nextQty;
  }
  renderCart();
}

function removeFromCart(productId) {
  delete cart[productId];
  renderCart();
}

function cartLines() {
  return Object.entries(cart)
    .map(([id, qty]) => {
      const product = products.find((p) => p.id === id);
      return product ? { product, qty } : null;
    })
    .filter(Boolean);
}

function renderCart() {
  const lines = cartLines();
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  cartCountEl.textContent = count;

  if (!lines.length) {
    cartItemsEl.innerHTML = `<p class="cart-empty-note">Your cart is empty. Add a snack to get started.</p>`;
    cartFooterEl.style.display = "none";
    return;
  }

  cartFooterEl.style.display = "block";

  cartItemsEl.innerHTML = lines
    .map(({ product, qty }) => {
      const thumb = product.image_url
        ? `<img src="${product.image_url}" alt="${product.name}" />`
        : `<span class="placeholder-emoji">🍿</span>`;
      return `
        <div class="cart-item">
          <div class="thumb-sm">${thumb}</div>
          <div class="cart-item-info">
            <div class="name">${product.name}</div>
            <div class="unit-price">${formatPrice(product.price)} each</div>
          </div>
          <div class="qty-control">
            <button data-id="${product.id}" data-delta="-1">−</button>
            <span>${qty}</span>
            <button data-id="${product.id}" data-delta="1">+</button>
          </div>
          <button class="remove-item" data-id="${product.id}" data-remove="1">Remove</button>
        </div>
      `;
    })
    .join("");

  cartItemsEl.querySelectorAll("[data-delta]").forEach((btn) => {
    btn.addEventListener("click", () =>
      changeQty(btn.dataset.id, Number(btn.dataset.delta))
    );
  });
  cartItemsEl.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => removeFromCart(btn.dataset.id));
  });

  const total = lines.reduce((sum, l) => sum + l.qty * Number(l.product.price), 0);
  cartTotalEl.textContent = formatPrice(total);
}

function buildWhatsAppMessage(lines, total, ref, name, phone, address) {
  const itemLines = lines
    .map(
      (l) =>
        `• ${l.product.name} x${l.qty} — ${formatPrice(l.qty * Number(l.product.price))}`
    )
    .join("\n");

  return (
    `Hi ${CONFIG.BRAND_NAME}! I'd like to order:\n\n` +
    `${itemLines}\n\n` +
    `Total: ${formatPrice(total)}\n\n` +
    `Name: ${name}\n` +
    `Phone: ${phone}\n` +
    `Delivery address: ${address}\n\n` +
    `Order ref: ${ref}`
  );
}

async function checkout() {
  const lines = cartLines();
  if (!lines.length) return;

  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const address = document.getElementById("customerAddress").value.trim();

  if (!name || !phone || !address) {
    alert("Please fill in your name, phone number, and delivery address.");
    return;
  }

  const checkoutBtn = document.getElementById("checkoutBtn");
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Placing order…";

  const ref = `CC-${Date.now().toString().slice(-6)}`;
  const total = lines.reduce((sum, l) => sum + l.qty * Number(l.product.price), 0);

  try {
    const rows = lines.map((l) => ({
      product_id: l.product.id,
      quantity: l.qty,
      customer_name: name,
      customer_phone: phone,
      delivery_address: address,
      status: "pending",
      whatsapp_order_ref: ref,
    }));
    const { error } = await sb.from("orders").insert(rows);
    if (error) console.error("Order save failed:", error);
  } catch (err) {
    console.error(err);
  }

  const message = buildWhatsAppMessage(lines, total, ref, name, phone, address);
  const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");

  cart = {};
  renderCart();
  checkoutBtn.disabled = false;
  checkoutBtn.textContent = "Send order on WhatsApp";
  closeCart();
}

document.getElementById("checkoutBtn").addEventListener("click", checkout);

loadProducts();
