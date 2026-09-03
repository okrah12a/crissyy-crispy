const sb = window.supabaseClient;
const CONFIG = window.CRISSYY_CONFIG || {};
const CURRENCY_SYMBOL = CONFIG.CURRENCY_SYMBOL || "₦";
const STORAGE_BUCKET = "product-images";

function formatPrice(amount) {
  return `${CURRENCY_SYMBOL}${Number(amount || 0).toLocaleString()}`;
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "orders") loadOrders(document.getElementById("orderMonthFilter").value);
  });
});

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

function flashRow(row) {
  row.style.background = "#e1f5e8";
  setTimeout(() => (row.style.background = ""), 600);
}

// ---------- Sections (categories) ----------

let categories = [];

async function loadCategories() {
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  const listEl = document.getElementById("sectionList");

  if (error) {
    listEl.innerHTML = `<span class="muted">Couldn't load sections: ${error.message}</span>`;
    return;
  }

  categories = data || [];

  if (!categories.length) {
    listEl.innerHTML = `<span class="muted">No sections yet — add one above.</span>`;
  } else {
    listEl.innerHTML = categories
      .map(
        (c) => `
        <span class="section-chip">
          ${escapeAttr(c.name)}
          <button data-id="${c.id}" title="Delete section">&times;</button>
        </span>
      `
      )
      .join("");

    listEl.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => deleteCategory(btn.dataset.id));
    });
  }

  populateCategorySelects();
}

function populateCategorySelects() {
  const options =
    `<option value="">No section</option>` +
    categories.map((c) => `<option value="${c.id}">${escapeAttr(c.name)}</option>`).join("");

  // "Add product" dropdown
  const newSelect = document.getElementById("newCategory");
  const prevValue = newSelect.value;
  newSelect.innerHTML = options;
  newSelect.value = prevValue;

  // Existing per-row dropdowns
  document.querySelectorAll(".f-category").forEach((select) => {
    const current = select.dataset.current || "";
    select.innerHTML = options;
    select.value = current;
  });
}

document.getElementById("addSectionBtn").addEventListener("click", async () => {
  const nameInput = document.getElementById("newSectionName");
  const name = nameInput.value.trim();
  if (!name) return;

  const { error } = await sb.from("categories").insert([{ name, sort_order: categories.length }]);
  if (error) {
    alert(`Couldn't add section: ${error.message}`);
    return;
  }
  nameInput.value = "";
  loadCategories();
});

async function deleteCategory(id) {
  if (!confirm("Delete this section? Products in it will become unsectioned, not deleted.")) return;
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) {
    alert(`Couldn't delete section: ${error.message}`);
    return;
  }
  loadCategories();
  loadProducts();
}

// ---------- Image upload ----------

async function uploadProductImage(file) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Products ----------

async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });

  const body = document.getElementById("productsBody");

  if (error) {
    body.innerHTML = `<tr><td colspan="8" class="muted">Couldn't load products: ${error.message}</td></tr>`;
    return;
  }

  if (!data.length) {
    body.innerHTML = `<tr><td colspan="8" class="muted">No products yet — add one above.</td></tr>`;
    return;
  }

  body.innerHTML = data
    .map((p) => {
      const thumb = p.image_url
        ? `<img src="${p.image_url}" alt="${escapeAttr(p.name)}" />`
        : `<span class="placeholder-emoji">🍿</span>`;
      return `
      <tr data-id="${p.id}">
        <td class="photo-cell">
          <div class="thumb-cell">${thumb}</div>
        </td>
        <td class="name-cell"><input type="text" class="f-name" value="${escapeAttr(p.name)}" /></td>
        <td><input type="text" class="f-desc" value="${escapeAttr(p.description || "")}" /></td>
        <td><select class="f-category" data-current="${p.category_id || ""}"></select></td>
        <td class="num-cell"><input type="number" class="f-price" value="${p.price}" min="0" /></td>
        <td class="num-cell"><input type="number" class="f-qty" value="${p.quantity}" min="0" /></td>
        <td>
          <select class="f-active">
            <option value="true" ${p.is_active ? "selected" : ""}>Yes</option>
            <option value="false" ${!p.is_active ? "selected" : ""}>No</option>
          </select>
        </td>
        <td class="image-cell">
          <input type="file" class="f-image-file" accept="image/*" />
          <div class="row-actions">
            <button class="btn btn-save" data-action="save">Save</button>
            <button class="btn btn-delete" data-action="delete">Delete</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  populateCategorySelects();

  body.querySelectorAll('[data-action="save"]').forEach((btn) => {
    btn.addEventListener("click", () => saveProduct(btn.closest("tr")));
  });
  body.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => deleteProduct(btn.closest("tr")));
  });
}

async function saveProduct(row) {
  const id = row.dataset.id;
  const saveBtn = row.querySelector('[data-action="save"]');
  const fileInput = row.querySelector(".f-image-file");

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const update = {
      name: row.querySelector(".f-name").value.trim(),
      description: row.querySelector(".f-desc").value.trim(),
      category_id: row.querySelector(".f-category").value || null,
      price: Number(row.querySelector(".f-price").value),
      quantity: Number(row.querySelector(".f-qty").value),
      is_active: row.querySelector(".f-active").value === "true",
    };

    if (fileInput.files && fileInput.files[0]) {
      update.image_url = await uploadProductImage(fileInput.files[0]);
    }

    const { error } = await sb.from("products").update(update).eq("id", id);
    if (error) throw error;

    flashRow(row);
    loadProducts();
  } catch (err) {
    alert(`Couldn't save: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

async function deleteProduct(row) {
  if (!confirm("Delete this product? This can't be undone.")) return;
  const id = row.dataset.id;
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) {
    alert(`Couldn't delete: ${error.message}`);
  } else {
    row.remove();
  }
}

document.getElementById("addProductBtn").addEventListener("click", async () => {
  const name = document.getElementById("newName").value.trim();
  const price = Number(document.getElementById("newPrice").value);
  const quantity = Number(document.getElementById("newQty").value);
  const description = document.getElementById("newDesc").value.trim();
  const category_id = document.getElementById("newCategory").value || null;
  const fileInput = document.getElementById("newImageFile");
  const statusEl = document.getElementById("uploadStatus");
  const addBtn = document.getElementById("addProductBtn");

  if (!name || !price) {
    alert("Please enter at least a name and price.");
    return;
  }

  addBtn.disabled = true;
  addBtn.textContent = "Adding…";
  statusEl.textContent = "";

  try {
    let image_url = "";
    if (fileInput.files && fileInput.files[0]) {
      statusEl.textContent = "Uploading photo…";
      image_url = await uploadProductImage(fileInput.files[0]);
    }

    const { error } = await sb.from("products").insert([
      { name, price, quantity: quantity || 0, image_url, description, category_id, is_active: true },
    ]);
    if (error) throw error;

    ["newName", "newPrice", "newQty", "newDesc"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    fileInput.value = "";
    document.getElementById("newCategory").value = "";
    statusEl.textContent = "";
    loadProducts();
  } catch (err) {
    statusEl.textContent = `Couldn't add product: ${err.message}`;
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = "Add product";
  }
});

// ---------- Orders ----------

function currentMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function monthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

const orderMonthFilterEl = document.getElementById("orderMonthFilter");
orderMonthFilterEl.value = currentMonthValue();
orderMonthFilterEl.addEventListener("change", () => {
  loadOrders(orderMonthFilterEl.value || currentMonthValue());
});

async function loadOrders(monthValue) {
  const month = monthValue || currentMonthValue();
  const body = document.getElementById("ordersBody");
  const totalEl = document.getElementById("ordersTotal");
  body.innerHTML = `<tr><td colspan="9" class="muted">Loading orders…</td></tr>`;
  totalEl.textContent = formatPrice(0);

  const { start, end } = monthRange(month);

  const { data, error } = await sb
    .from("orders")
    .select("*, products(name, price)")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="9" class="muted">Couldn't load orders: ${error.message}</td></tr>`;
    return;
  }

  if (!data.length) {
    body.innerHTML = `<tr><td colspan="9" class="muted">No orders for this month yet.</td></tr>`;
    return;
  }

  body.innerHTML = data
    .map((o) => {
      const placed = new Date(o.created_at).toLocaleString();
      const itemName = o.products ? o.products.name : "(deleted product)";
      const unitPrice = o.products ? Number(o.products.price) : 0;
      const amount = unitPrice * Number(o.quantity || 0);
      return `
        <tr data-id="${o.id}" data-amount="${amount}">
          <td>${o.whatsapp_order_ref || o.id.slice(0, 8)}</td>
          <td>${itemName}</td>
          <td>${o.quantity}</td>
          <td>${formatPrice(amount)}</td>
          <td>${o.customer_name || ""}</td>
          <td>${o.customer_phone || ""}</td>
          <td>${o.delivery_address || ""}</td>
          <td>
            <select class="f-status">
              <option value="pending" ${o.status === "pending" ? "selected" : ""}>Pending</option>
              <option value="fulfilled" ${o.status === "fulfilled" ? "selected" : ""}>Fulfilled</option>
              <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </td>
          <td>${placed}</td>
        </tr>
      `;
    })
    .join("");

  recomputeOrdersTotal();

  body.querySelectorAll(".f-status").forEach((select) => {
    select.addEventListener("change", async () => {
      const row = select.closest("tr");
      const { error } = await sb
        .from("orders")
        .update({ status: select.value })
        .eq("id", row.dataset.id);
      if (error) {
        alert(`Couldn't update status: ${error.message}`);
        return;
      }
      flashRow(row);
      recomputeOrdersTotal();
    });
  });
}

function recomputeOrdersTotal() {
  const totalEl = document.getElementById("ordersTotal");
  let total = 0;
  document.querySelectorAll("#ordersBody tr[data-id]").forEach((row) => {
    const statusSelect = row.querySelector(".f-status");
    if (statusSelect && statusSelect.value === "fulfilled") {
      total += Number(row.dataset.amount || 0);
    }
  });
  totalEl.textContent = formatPrice(total);
}

loadCategories();
loadProducts();
