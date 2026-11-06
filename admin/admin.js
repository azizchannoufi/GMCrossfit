/**
 * Admin panel: auth guard (email/password + admin claim), CRUD, dashboard.
 */
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFirebase } from "../firebase-init.js";
import { uploadCompressedImage } from "./storage-upload.js";

const { auth, db } = getFirebase();

/* ─── Auth guard ─── */

/**
 * Require signed-in user with custom claim admin:true.
 * Redirects to login.html otherwise.
 * @returns {Promise<import('firebase/auth').User>}
 */
export function requireAdmin() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        redirectLogin();
        reject(new Error("not-authenticated"));
        return;
      }
      try {
        const token = await user.getIdTokenResult(true);
        if (token.claims.admin !== true) {
          await signOut(auth);
          redirectLogin("not-admin");
          reject(new Error("not-admin"));
          return;
        }
        resolve(user);
      } catch (err) {
        redirectLogin();
        reject(err);
      }
    });
  });
}

function redirectLogin(reason) {
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page === "login.html") return;
  const q = reason ? `?error=${encodeURIComponent(reason)}` : "";
  location.href = `login.html${q}`;
}

function currentAdminPage() {
  return (location.pathname.split("/").pop() || "index.html").toLowerCase();
}

/* ─── Shell ─── */

const NAV = [
  { href: "index.html", label: "Dashboard" },
  { href: "inventory.html", label: "Produits" },
  { href: "categories.html", label: "Catégories" },
  { href: "packs.html", label: "Packs" },
  { href: "orders.html", label: "Commandes" },
  { href: "settings.html", label: "Paramètres" },
];

export function renderShell(activeHref) {
  const shell = document.querySelector("[data-admin-shell]");
  if (!shell) return;
  const page = activeHref || currentAdminPage();
  shell.innerHTML = `
    <aside class="admin-sidebar">
      <a class="brand" href="index.html">
        <img src="../assets/logo.jpg" alt="">
        <span>GM Admin</span>
      </a>
      ${NAV.map(
        (n) =>
          `<a href="${n.href}" class="${n.href === page ? "is-active" : ""}">${n.label}</a>`
      ).join("")}
      <button type="button" class="btn" data-logout style="margin-top:auto;">Déconnexion</button>
      <a href="../index.html" style="font-size:0.8rem;color:var(--muted);">← Boutique</a>
    </aside>
    <div class="admin-main" data-admin-main></div>
  `;
  shell.querySelector("[data-logout]")?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "login.html";
  });
}

function main() {
  return document.querySelector("[data-admin-main]");
}

function showMsg(el, text, type = "ok") {
  if (!el) return;
  el.className = `msg msg-${type === "ok" ? "ok" : "error"}`;
  el.textContent = text;
  el.hidden = false;
}

/* ─── Login page ─── */

export function initLoginPage() {
  const form = document.querySelector("[data-login-form]");
  if (!form) return;

  const errEl = document.querySelector("[data-login-error]");
  const params = new URLSearchParams(location.search);
  if (params.get("error") === "not-admin") {
    showMsg(errEl, "Compte sans droit admin. Exécutez scripts/set-admin-claim.js.", "err");
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const token = await user.getIdTokenResult(true);
      if (token.claims.admin === true) {
        location.href = "index.html";
      }
    } catch {
      /* stay on login */
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdTokenResult(true);
      if (token.claims.admin !== true) {
        await signOut(auth);
        showMsg(errEl, "Ce compte n'a pas la claim admin:true.", "err");
        return;
      }
      location.href = "index.html";
    } catch (err) {
      showMsg(errEl, err.message || "Connexion impossible.", "err");
    } finally {
      btn.disabled = false;
    }
  });
}

/* ─── Dashboard ─── */

export async function initDashboard() {
  await requireAdmin();
  renderShell("index.html");
  const el = main();
  el.innerHTML = `<p class="muted">Chargement…</p>`;

  const ordersSnap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  const productsSnap = await getDocs(collection(db, "products"));
  let revenue = 0;
  let pending = 0;
  ordersSnap.forEach((d) => {
    const o = d.data();
    if (o.status !== "cancelled") revenue += Number(o.total) || 0;
    if (o.status === "pending") pending++;
  });

  const recent = ordersSnap.docs.slice(0, 8);

  el.innerHTML = `
    <div class="admin-top">
      <h1>Dashboard</h1>
    </div>
    <div class="stats">
      <div class="stat-card"><span class="muted">Commandes</span><strong>${ordersSnap.size}</strong></div>
      <div class="stat-card"><span class="muted">En attente</span><strong>${pending}</strong></div>
      <div class="stat-card"><span class="muted">CA (hors annulées)</span><strong>${revenue.toFixed(0)} MAD</strong></div>
      <div class="stat-card"><span class="muted">Produits</span><strong>${productsSnap.size}</strong></div>
    </div>
    <div class="panel">
      <h2>Dernières commandes</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Client</th><th>Total</th><th>Statut</th><th>Date</th></tr></thead>
          <tbody>
            ${
              recent.length
                ? recent
                    .map((d) => {
                      const o = d.data();
                      const date = o.createdAt?.toDate
                        ? o.createdAt.toDate().toLocaleString("fr-FR")
                        : "—";
                      return `<tr>
                        <td><a href="orders.html#${d.id}">${d.id.slice(0, 8)}…</a></td>
                        <td>${esc(o.customer?.name || "")}</td>
                        <td>${o.total} MAD</td>
                        <td><span class="status-pill status-${esc(o.status)}">${esc(o.status)}</span></td>
                        <td>${date}</td>
                      </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="5">Aucune commande</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ─── Inventory (products) ─── */

function emptyProduct() {
  return {
    name: "",
    description: "",
    price: 0,
    oldPrice: null,
    category: "",
    gender: "unisex",
    imageUrl: "",
    storagePath: "",
    images: [],
    imageHover: "",
    sizes: ["S", "M", "L", "XL"],
    colors: [{ name: "Noir", hex: "#111111" }],
    stockBySize: { S: 10, M: 10, L: 10, XL: 10 },
    isNew: true,
    isHot: false,
    specs: {},
    benefits: [],
  };
}

export async function initInventory() {
  await requireAdmin();
  renderShell("inventory.html");
  const el = main();
  el.innerHTML = `
    <div class="admin-top">
      <h1>Produits</h1>
      <button type="button" class="btn btn-accent" data-new-product>Nouveau produit</button>
    </div>
    <div data-msg hidden></div>
    <div class="panel hidden" data-editor></div>
    <div class="table-wrap" data-list></div>`;

  const listEl = el.querySelector("[data-list]");
  const editor = el.querySelector("[data-editor]");
  const msg = el.querySelector("[data-msg]");

  async function refresh() {
    const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
    listEl.innerHTML = `
      <table>
        <thead><tr><th></th><th>Nom</th><th>Cat.</th><th>Prix</th><th>Stock</th><th></th></tr></thead>
        <tbody>
          ${snap.docs
            .map((d) => {
              const p = d.data();
              const stock =
                typeof p.stock === "number"
                  ? p.stock
                  : Object.values(p.stockBySize || {}).reduce((a, b) => a + Number(b || 0), 0);
              return `<tr>
                <td><img class="thumb" src="${esc(p.imageUrl || "../assets/logo.jpg")}" alt=""></td>
                <td>${esc(p.name)}</td>
                <td>${esc(p.category || "")}</td>
                <td>${p.price} MAD</td>
                <td>${stock}</td>
                <td class="actions">
                  <button type="button" class="btn" data-edit="${d.id}">Éditer</button>
                  <button type="button" class="btn btn-danger" data-del="${d.id}">Suppr.</button>
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }

  function openEditor(id, data) {
    editor.classList.remove("hidden");
    editor.innerHTML = `
      <h2>${id ? "Modifier" : "Nouveau"} produit</h2>
      <form class="form-grid two" data-product-form>
        <input type="hidden" name="id" value="${esc(id || "")}">
        <label class="full">Nom <input name="name" required value="${esc(data.name)}"></label>
        <label class="full">Description <textarea name="description" rows="3">${esc(data.description || "")}</textarea></label>
        <label>Prix (MAD) <input name="price" type="number" min="0" step="1" required value="${data.price || 0}"></label>
        <label>Ancien prix <input name="oldPrice" type="number" min="0" step="1" value="${data.oldPrice ?? ""}"></label>
        <label>Catégorie <input name="category" value="${esc(data.category || "")}"></label>
        <label>Genre
          <select name="gender">
            <option value="men" ${data.gender === "men" ? "selected" : ""}>Homme</option>
            <option value="women" ${data.gender === "women" ? "selected" : ""}>Femme</option>
            <option value="unisex" ${data.gender === "unisex" || !data.gender ? "selected" : ""}>Unisexe</option>
          </select>
        </label>
        <label>Tailles (CSV) <input name="sizes" value="${esc((data.sizes || []).join(","))}"></label>
        <label>Couleurs JSON <input name="colors" value='${esc(JSON.stringify(data.colors || []))}'></label>
        <label>StockBySize JSON <input name="stockBySize" value='${esc(JSON.stringify(data.stockBySize || {}))}'></label>
        <label>Benefits (une par ligne) <textarea name="benefits" rows="3">${esc((data.benefits || []).join("\n"))}</textarea></label>
        <label><span><input type="checkbox" name="isNew" ${data.isNew ? "checked" : ""}> New</span></label>
        <label><span><input type="checkbox" name="isHot" ${data.isHot ? "checked" : ""}> Hot</span></label>
        <label class="full">Image principale
          <input type="file" name="imageFile" accept="image/*">
          <input type="hidden" name="imageUrl" value="${esc(data.imageUrl || "")}">
          <input type="hidden" name="storagePath" value="${esc(data.storagePath || "")}">
          ${data.imageUrl ? `<img class="preview" src="${esc(data.imageUrl)}" alt="">` : ""}
        </label>
        <label class="full">Image hover (URL optionnelle) <input name="imageHover" value="${esc(data.imageHover || "")}"></label>
        <div class="full actions">
          <button type="submit" class="btn btn-accent">Enregistrer</button>
          <button type="button" class="btn" data-cancel-edit>Annuler</button>
        </div>
      </form>`;

    editor.querySelector("[data-cancel-edit]")?.addEventListener("click", () => {
      editor.classList.add("hidden");
    });

    editor.querySelector("[data-product-form]")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        let imageUrl = form.imageUrl.value;
        let storagePath = form.storagePath.value;
        const file = form.imageFile.files[0];
        if (file) {
          const up = await uploadCompressedImage(file, "products");
          imageUrl = up.url;
          storagePath = up.storagePath;
        }
        const sizes = form.sizes.value
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        let colors = [];
        let stockBySize = {};
        try {
          colors = JSON.parse(form.colors.value || "[]");
        } catch {
          throw new Error("JSON couleurs invalide");
        }
        try {
          stockBySize = JSON.parse(form.stockBySize.value || "{}");
        } catch {
          throw new Error("JSON stock invalide");
        }
        const payload = {
          name: form.name.value.trim(),
          description: form.description.value.trim(),
          price: Number(form.price.value),
          oldPrice: form.oldPrice.value ? Number(form.oldPrice.value) : null,
          category: form.category.value.trim(),
          gender: form.gender.value,
          sizes,
          colors,
          stockBySize,
          isNew: form.isNew.checked,
          isHot: form.isHot.checked,
          imageUrl,
          storagePath,
          imageHover: form.imageHover.value.trim(),
          benefits: form.benefits.value
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          specs: data.specs || {},
          images: data.images || (imageUrl ? [imageUrl] : []),
          updatedAt: serverTimestamp(),
        };
        const existingId = form.id.value;
        if (existingId) {
          await updateDoc(doc(db, "products", existingId), payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "products"), payload);
        }
        showMsg(msg, "Produit enregistré.", "ok");
        editor.classList.add("hidden");
        await refresh();
      } catch (err) {
        showMsg(msg, err.message || "Erreur", "err");
      } finally {
        btn.disabled = false;
      }
    });
  }

  el.querySelector("[data-new-product]")?.addEventListener("click", () =>
    openEditor(null, emptyProduct())
  );

  listEl.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (edit) {
      const id = edit.dataset.edit;
      const snap = await getDoc(doc(db, "products", id));
      if (snap.exists()) openEditor(id, snap.data());
    }
    if (del) {
      if (!confirm("Supprimer ce produit ?")) return;
      await deleteDoc(doc(db, "products", del.dataset.del));
      showMsg(msg, "Supprimé.", "ok");
      await refresh();
    }
  });

  await refresh();
}

/* ─── Categories ─── */

export async function initCategories() {
  await requireAdmin();
  renderShell("categories.html");
  const el = main();
  el.innerHTML = `
    <div class="admin-top"><h1>Catégories</h1></div>
    <div data-msg hidden></div>
    <div class="panel">
      <form class="form-grid two" data-cat-form>
        <input type="hidden" name="id">
        <label>Nom <input name="name" required></label>
        <label>Ordre <input name="order" type="number" value="0"></label>
        <label class="full">Image <input type="file" name="imageFile" accept="image/*">
          <input type="hidden" name="imageUrl">
        </label>
        <div class="full"><button class="btn btn-accent" type="submit">Enregistrer</button></div>
      </form>
    </div>
    <div class="table-wrap" data-list></div>`;

  const msg = el.querySelector("[data-msg]");
  const listEl = el.querySelector("[data-list]");
  const form = el.querySelector("[data-cat-form]");

  async function refresh() {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));
    listEl.innerHTML = `
      <table>
        <thead><tr><th></th><th>Nom</th><th>Ordre</th><th></th></tr></thead>
        <tbody>
          ${snap.docs
            .map(
              (d) => `<tr>
              <td><img class="thumb" src="${esc(d.data().imageUrl || "../assets/logo.jpg")}" alt=""></td>
              <td>${esc(d.data().name)}</td>
              <td>${d.data().order ?? 0}</td>
              <td class="actions">
                <button type="button" class="btn" data-edit='${esc(JSON.stringify({ id: d.id, ...d.data() }))}'>Éditer</button>
                <button type="button" class="btn btn-danger" data-del="${d.id}">Suppr.</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      let imageUrl = form.imageUrl.value;
      if (form.imageFile.files[0]) {
        const up = await uploadCompressedImage(form.imageFile.files[0], "categories");
        imageUrl = up.url;
      }
      const payload = {
        name: form.name.value.trim(),
        order: Number(form.order.value) || 0,
        imageUrl,
      };
      if (form.id.value) {
        await updateDoc(doc(db, "categories", form.id.value), payload);
      } else {
        await addDoc(collection(db, "categories"), payload);
      }
      form.reset();
      form.id.value = "";
      showMsg(msg, "Catégorie enregistrée.", "ok");
      await refresh();
    } catch (err) {
      showMsg(msg, err.message, "err");
    } finally {
      btn.disabled = false;
    }
  });

  listEl.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (edit) {
      const data = JSON.parse(edit.dataset.edit);
      form.id.value = data.id;
      form.name.value = data.name || "";
      form.order.value = data.order ?? 0;
      form.imageUrl.value = data.imageUrl || "";
    }
    if (del) {
      if (!confirm("Supprimer ?")) return;
      await deleteDoc(doc(db, "categories", del.dataset.del));
      await refresh();
    }
  });

  await refresh();
}

/* ─── Packs admin ─── */

export async function initPacksAdmin() {
  await requireAdmin();
  renderShell("packs.html");
  const el = main();
  el.innerHTML = `
    <div class="admin-top"><h1>Packs</h1></div>
    <div data-msg hidden></div>
    <div class="panel">
      <form class="form-grid two" data-pack-form>
        <input type="hidden" name="id">
        <label class="full">Nom <input name="name" required></label>
        <label class="full">Description <textarea name="description" rows="3"></textarea></label>
        <label>Prix <input name="price" type="number" min="0" required></label>
        <label>Product IDs (CSV) <input name="productIds" placeholder="id1,id2"></label>
        <label class="full">Image <input type="file" accept="image/*" name="imageFile">
          <input type="hidden" name="imageUrl">
        </label>
        <div class="full"><button class="btn btn-accent" type="submit">Enregistrer</button></div>
      </form>
    </div>
    <div class="table-wrap" data-list></div>`;

  const form = el.querySelector("[data-pack-form]");
  const listEl = el.querySelector("[data-list]");
  const msg = el.querySelector("[data-msg]");

  async function refresh() {
    const snap = await getDocs(collection(db, "packs"));
    listEl.innerHTML = `
      <table>
        <thead><tr><th></th><th>Nom</th><th>Prix</th><th>Produits</th><th></th></tr></thead>
        <tbody>
          ${snap.docs
            .map((d) => {
              const p = d.data();
              return `<tr>
                <td><img class="thumb" src="${esc(p.imageUrl || "../assets/logo.jpg")}" alt=""></td>
                <td>${esc(p.name)}</td>
                <td>${p.price} MAD</td>
                <td>${(p.productIds || []).length}</td>
                <td class="actions">
                  <button type="button" class="btn" data-edit="${d.id}">Éditer</button>
                  <button type="button" class="btn btn-danger" data-del="${d.id}">Suppr.</button>
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      let imageUrl = form.imageUrl.value;
      if (form.imageFile.files[0]) {
        const up = await uploadCompressedImage(form.imageFile.files[0], "packs");
        imageUrl = up.url;
      }
      const payload = {
        name: form.name.value.trim(),
        description: form.description.value.trim(),
        price: Number(form.price.value),
        productIds: form.productIds.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        imageUrl,
      };
      if (form.id.value) await updateDoc(doc(db, "packs", form.id.value), payload);
      else await addDoc(collection(db, "packs"), payload);
      form.reset();
      form.id.value = "";
      showMsg(msg, "Pack enregistré.", "ok");
      await refresh();
    } catch (err) {
      showMsg(msg, err.message, "err");
    }
  });

  listEl.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (edit) {
      const snap = await getDoc(doc(db, "packs", edit.dataset.edit));
      const p = snap.data();
      form.id.value = snap.id;
      form.name.value = p.name || "";
      form.description.value = p.description || "";
      form.price.value = p.price || 0;
      form.productIds.value = (p.productIds || []).join(",");
      form.imageUrl.value = p.imageUrl || "";
    }
    if (del) {
      if (!confirm("Supprimer ?")) return;
      await deleteDoc(doc(db, "packs", del.dataset.del));
      await refresh();
    }
  });

  await refresh();
}

/* ─── Orders ─── */

export async function initOrders() {
  await requireAdmin();
  renderShell("orders.html");
  const el = main();
  el.innerHTML = `
    <div class="admin-top"><h1>Commandes</h1></div>
    <div data-msg hidden></div>
    <div class="table-wrap" data-list></div>`;

  const listEl = el.querySelector("[data-list]");
  const msg = el.querySelector("[data-msg]");
  const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

  async function refresh() {
    const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
    listEl.innerHTML = `
      <table>
        <thead>
          <tr><th>ID</th><th>Client</th><th>Articles</th><th>Total</th><th>Statut</th><th>Date</th></tr>
        </thead>
        <tbody>
          ${snap.docs
            .map((d) => {
              const o = d.data();
              const date = o.createdAt?.toDate
                ? o.createdAt.toDate().toLocaleString("fr-FR")
                : "—";
              const items = (o.items || [])
                .map((i) => `${i.name} (${i.size}/${i.color}×${i.qty})`)
                .join("<br>");
              return `<tr id="${d.id}">
                <td><code>${d.id.slice(0, 10)}…</code></td>
                <td>
                  <strong>${esc(o.customer?.name)}</strong><br>
                  <span class="muted">${esc(o.customer?.phone)} · ${esc(o.customer?.city)}</span><br>
                  <span class="muted">${esc(o.customer?.address)}</span>
                </td>
                <td>${items}</td>
                <td>${o.total} MAD</td>
                <td>
                  <select data-status="${d.id}">
                    ${STATUSES.map(
                      (s) =>
                        `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`
                    ).join("")}
                  </select>
                </td>
                <td>${date}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }

  listEl.addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-status]");
    if (!sel) return;
    try {
      await updateDoc(doc(db, "orders", sel.dataset.status), { status: sel.value });
      showMsg(msg, "Statut mis à jour.", "ok");
    } catch (err) {
      showMsg(msg, err.message, "err");
    }
  });

  await refresh();
  const hash = location.hash.replace("#", "");
  if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
}

/* ─── Settings ─── */

export async function initSettings() {
  await requireAdmin();
  renderShell("settings.html");
  const el = main();
  const snap = await getDoc(doc(db, "settings", "public"));
  const s = snap.exists()
    ? snap.data()
    : {
        whatsappNumber: "",
        delivery: { fee: 30, freeThreshold: 500 },
        banner: { active: false, text: "", link: "" },
        flashSale: { active: false, title: "", discountPercent: 20, productIds: [] },
        promos: [],
      };

  const flashStart = toLocalInput(s.flashSale?.startAt);
  const flashEnd = toLocalInput(s.flashSale?.endAt);

  el.innerHTML = `
    <div class="admin-top"><h1>Paramètres</h1></div>
    <div data-msg hidden></div>
    <form class="panel form-grid two" data-settings-form>
      <h2 class="full">WhatsApp & livraison</h2>
      <label>N° WhatsApp (indicatif pays, sans +) <input name="whatsappNumber" value="${esc(s.whatsappNumber || "")}" placeholder="2126xxxxxxxx"></label>
      <label>Frais de livraison <input name="deliveryFee" type="number" value="${s.delivery?.fee ?? 30}"></label>
      <label>Seuil livraison offerte <input name="freeThreshold" type="number" value="${s.delivery?.freeThreshold ?? 500}"></label>

      <h2 class="full">Bannière</h2>
      <label><span><input type="checkbox" name="bannerActive" ${s.banner?.active ? "checked" : ""}> Active</span></label>
      <label>Texte <input name="bannerText" value="${esc(s.banner?.text || "")}"></label>
      <label class="full">Lien <input name="bannerLink" value="${esc(s.banner?.link || "")}"></label>

      <h2 class="full">Vente Flash</h2>
      <label><span><input type="checkbox" name="flashActive" ${s.flashSale?.active ? "checked" : ""}> Active</span></label>
      <label>Titre <input name="flashTitle" value="${esc(s.flashSale?.title || "Vente Flash")}"></label>
      <label>Réduction % <input name="flashPct" type="number" min="1" max="90" value="${s.flashSale?.discountPercent ?? 20}"></label>
      <label>Début <input name="flashStart" type="datetime-local" value="${flashStart}"></label>
      <label>Fin <input name="flashEnd" type="datetime-local" value="${flashEnd}"></label>
      <label class="full">Product IDs (CSV, vide = tous les Hot) <input name="flashIds" value="${esc((s.flashSale?.productIds || []).join(","))}"></label>

      <h2 class="full">Codes promo</h2>
      <div class="full" data-promos>
        ${(s.promos || [])
          .map(
            (p, i) => `
          <div class="promo-row">
            <label>Code <input name="promoCode_${i}" value="${esc(p.code || "")}"></label>
            <label>Type
              <select name="promoType_${i}">
                <option value="percent" ${p.type === "percent" ? "selected" : ""}>%</option>
                <option value="fixed" ${p.type === "fixed" ? "selected" : ""}>Fixe MAD</option>
              </select>
            </label>
            <label>Valeur <input name="promoValue_${i}" type="number" value="${p.value ?? 0}"></label>
            <label><span><input type="checkbox" name="promoActive_${i}" ${p.active !== false ? "checked" : ""}> Actif</span></label>
          </div>`
          )
          .join("")}
      </div>
      <div class="full">
        <button type="button" class="btn" data-add-promo>Ajouter un code</button>
      </div>
      <div class="full">
        <button type="submit" class="btn btn-accent">Enregistrer les paramètres</button>
      </div>
    </form>
    <p class="muted">Les secrets Telegram (token / chat id) ne sont <strong>jamais</strong> stockés ici — utilisez Firebase Secret Manager.</p>`;

  const form = el.querySelector("[data-settings-form]");
  const msg = el.querySelector("[data-msg]");
  let promoCount = (s.promos || []).length;

  el.querySelector("[data-add-promo]")?.addEventListener("click", () => {
    const wrap = el.querySelector("[data-promos]");
    const i = promoCount++;
    const row = document.createElement("div");
    row.className = "promo-row";
    row.innerHTML = `
      <label>Code <input name="promoCode_${i}"></label>
      <label>Type <select name="promoType_${i}"><option value="percent">%</option><option value="fixed">Fixe MAD</option></select></label>
      <label>Valeur <input name="promoValue_${i}" type="number" value="10"></label>
      <label><span><input type="checkbox" name="promoActive_${i}" checked> Actif</span></label>`;
    wrap.appendChild(row);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const promos = [];
    for (let i = 0; i < promoCount; i++) {
      const code = form[`promoCode_${i}`]?.value?.trim();
      if (!code) continue;
      promos.push({
        code: code.toUpperCase(),
        type: form[`promoType_${i}`].value,
        value: Number(form[`promoValue_${i}`].value) || 0,
        active: form[`promoActive_${i}`].checked,
      });
    }

    const payload = {
      whatsappNumber: form.whatsappNumber.value.trim(),
      delivery: {
        fee: Number(form.deliveryFee.value) || 0,
        freeThreshold: Number(form.freeThreshold.value) || 0,
      },
      banner: {
        active: form.bannerActive.checked,
        text: form.bannerText.value.trim(),
        link: form.bannerLink.value.trim(),
        dismissible: true,
      },
      flashSale: {
        active: form.flashActive.checked,
        title: form.flashTitle.value.trim(),
        discountPercent: Number(form.flashPct.value) || 0,
        startAt: form.flashStart.value ? new Date(form.flashStart.value).toISOString() : null,
        endAt: form.flashEnd.value ? new Date(form.flashEnd.value).toISOString() : null,
        productIds: form.flashIds.value
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      },
      promos,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "settings", "public"), payload, { merge: true });
      showMsg(msg, "Paramètres enregistrés.", "ok");
    } catch (err) {
      showMsg(msg, err.message, "err");
    }
  });
}

/* ─── Helpers ─── */

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toLocalInput(value) {
  if (!value) return "";
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ─── Auto-boot per page ─── */

const page = currentAdminPage();
if (page === "login.html") {
  initLoginPage();
} else if (page === "index.html" || page === "" || page === "admin") {
  initDashboard().catch(() => {});
} else if (page === "inventory.html") {
  initInventory().catch(() => {});
} else if (page === "categories.html") {
  initCategories().catch(() => {});
} else if (page === "packs.html") {
  initPacksAdmin().catch(() => {});
} else if (page === "orders.html") {
  initOrders().catch(() => {});
} else if (page === "settings.html") {
  initSettings().catch(() => {});
}
