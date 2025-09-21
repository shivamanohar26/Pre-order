// ===== API base detection (works with 5000, 5500, or file://) =====
const DEFAULT_API_ORIGIN = 'http://localhost:5000';
const here = location.origin;
const USE_DEFAULT =
  here.startsWith('http://127.0.0.1:5500') ||
  here.startsWith('http://localhost:5500') ||
  here.startsWith('file://');
const API_ORIGIN = USE_DEFAULT ? DEFAULT_API_ORIGIN : here;
const API = `${API_ORIGIN}/api`;

// ===== App state =====
const state = {
  user: null,
  restaurants: [],
  filtered: [],
  cart: [], // { itemId, name, price, discount, qty, restaurantId }
  viewingRestaurant: null,
};

// ===== Helpers =====
function inr(n){ return (Math.round((+n || 0)*100)/100).toLocaleString('en-IN'); }
function calcItemPrice(it){ return Math.max(0, (+it.price||0) - (+it.discount||0)); }
function qs(id){ return document.getElementById(id); }
function show(el, v){ if(el) el.classList.toggle('hidden', !v); }
function safeRating(r){ const n = parseFloat(r); return isNaN(n) ? 'N/A' : n.toFixed(1); }
// Always prefer backend image; fallback to a FOOD photo (not random non-food)
function imgFor(r){
  return r.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=60&auto=format&fit=crop';
}

// ===== Toasts =====
function showToast(msg, type='info', ms=2200){
  const box = qs('toasts'); 
  if(!box){ alert(msg); return; }
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = msg;
  box.appendChild(div);
  setTimeout(()=> div.remove(), ms);
}

// ===== Load restaurants =====
async function loadRestaurants(){
  try{
    const res = await fetch(`${API}/restaurants`, { headers: { 'Accept':'application/json' } });
    if(!res.ok) throw new Error(`API status ${res.status}`);
    const data = await res.json();
    state.restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];
    state.filtered = [...state.restaurants];
    renderRestaurants(state.filtered);
  }catch(e){
    console.error('Fetch /api/restaurants failed:', e);
    const grid = qs('restaurantsGrid');
    if(grid){
      grid.innerHTML =
        `<p class="muted">Failed to load restaurants. Is the server running at ${API_ORIGIN} ?</p>`;
    }
  }
}

// ===== Render restaurant cards =====
function renderRestaurants(list){
  const grid = qs('restaurantsGrid');
  if(!grid) return;
  grid.innerHTML = '';

  if(!list.length){
    grid.innerHTML = `<p class="muted">No restaurants found.</p>`;
    return;
  }

  list.forEach(r => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="img" src="${imgFor(r)}" alt="${r.name}">
      <div class="body">
        <h4>${r.name}</h4>
        <div class="meta">${r.location} • ${r.cuisine}</div>
        <div>
          <span class="chip">⭐ ${safeRating(r.rating)}</span>
          <span class="chip">⏱️ ~${r.eta} mins</span>
        </div>
        <div style="margin-top:10px">
          <button class="btn secondary" data-id="${r.id}">View Menu</button>
        </div>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => openMenu(r.id));
    grid.appendChild(card);
  });
}

// ===== Open & render menu =====
async function openMenu(restaurantId){
  try{
    const r = state.restaurants.find(x => x.id === restaurantId);
    if(!r) return;
    state.viewingRestaurant = r;
    qs('menuTitle').textContent = `${r.name} • Menu`;

    const res = await fetch(`${API}/restaurants/${restaurantId}/menu`, { headers: { 'Accept':'application/json' } });
    if(!res.ok) throw new Error(`API status ${res.status}`);
    const data = await res.json();
    const menu = Array.isArray(data.menu) ? data.menu : [];

    const body = qs('menuBody');
    body.innerHTML = '';
    menu.forEach(m => {
      const price = calcItemPrice(m);
      const row = document.createElement('div');
      row.className = 'menu-item';
      row.innerHTML = `
        <div>
          <div style="font-weight:700">${m.name}</div>
          <div class="small muted">${m.veg ? 'Veg' : 'Non-veg'} • ${m.category}</div>
        </div>
        <div style="text-align:right">
          <div class="price">
            ${m.discount ? `<span class="strike">₹${inr(m.price)}</span>` : ''}
            ₹${inr(price)}
          </div>
          <div style="margin-top:6px">
            <button class="btn" data-add="${m.id}">Add</button>
          </div>
        </div>
      `;
      row.querySelector('[data-add]').addEventListener('click', () => {
        addToCart({ itemId: m.id, name: m.name, price: m.price, discount: m.discount || 0, qty: 1, restaurantId });
        showToast('Added to cart', 'success');
      });
      body.appendChild(row);
    });
    show(qs('menuModal'), true);
  }catch(e){
    console.error('Fetch menu failed:', e);
    showToast('Failed to load menu', 'error');
  }
}

// ===== Cart logic =====
function addToCart(item){
  if(state.cart.length && state.cart[0].restaurantId !== item.restaurantId){
    if(!confirm('Cart has items from another restaurant. Clear cart?')) return;
    state.cart = [];
  }
  const f = state.cart.find(x => x.itemId === item.itemId);
  if(f) f.qty += item.qty; else state.cart.push(item);
  updateCartUI();
  show(qs('cartDrawer'), true);
}

function removeFromCart(itemId){
  state.cart = state.cart.filter(x => x.itemId !== itemId);
  updateCartUI();
  showToast('Removed from cart', 'info');
}

function updateCartUI(){
  const count = state.cart.reduce((s, it) => s + it.qty, 0);
  const cartCount = qs('cartCount');
  if(cartCount) cartCount.textContent = String(count);

  const itemsEl = qs('cartItems');
  if(!itemsEl) return;
  itemsEl.innerHTML = '';

  const checkoutBtn = qs('checkoutBtn');

  // empty state
  if(!state.cart.length){
    itemsEl.innerHTML = `<div class="empty-cart">Your cart is empty</div>`;
    qs('subtotal').textContent = '0';
    qs('discount').textContent = '0';
    qs('grandTotal').textContent = '0';
    if(checkoutBtn) checkoutBtn.disabled = true;
    return;
  }
  if(checkoutBtn) checkoutBtn.disabled = false;

  let subtotal = 0, discount = 0;
  state.cart.forEach(it => {
    subtotal += (+it.price||0) * it.qty;
    discount += (+it.discount||0) * it.qty;
    const linePrice = calcItemPrice(it) * it.qty;

    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div>
        ${it.name}
        <span class="small" style="margin-left:8px;">
          <button class="icon-btn" data-dec title="Decrease">−</button>
          <strong>${it.qty}</strong>
          <button class="icon-btn" data-inc title="Increase">+</button>
        </span>
      </div>
      <div>₹${inr(linePrice)}</div>
      <button class="icon-btn" title="Remove">🗑️</button>
    `;

    row.querySelector('[data-inc]').addEventListener('click', () => { it.qty++; updateCartUI(); });
    row.querySelector('[data-dec]').addEventListener('click', () => { it.qty = Math.max(1, it.qty-1); updateCartUI(); });
    row.querySelector('[title="Remove"]').addEventListener('click', () => removeFromCart(it.itemId));

    itemsEl.appendChild(row);
  });

  const grand = Math.max(0, subtotal - discount);
  qs('subtotal').textContent = inr(subtotal);
  qs('discount').textContent = inr(discount);
  qs('grandTotal').textContent = inr(grand);
}

// ===== Search =====
function applySearch(){
  const q = (qs('searchInput')?.value || '').trim().toLowerCase();
  state.filtered = !q ? [...state.restaurants] :
    state.restaurants.filter(r =>
      String(r.name).toLowerCase().includes(q) ||
      String(r.cuisine).toLowerCase().includes(q) ||
      String(r.location).toLowerCase().includes(q)
    );
  renderRestaurants(state.filtered);
}

// ===== Checkout =====
async function checkout(){
  try{
    if(!state.user){ showToast('Please login first', 'info'); return; }
    if(!state.cart.length){ showToast('Cart is empty', 'info'); return; }

    const restaurantId = state.cart[0].restaurantId;
    const items = state.cart.map(it => ({ itemId: it.itemId, qty: it.qty }));
    const body = { userId: state.user.id, restaurantId, items, pickupTime: '7:30 PM' };

    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept':'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.message || `API status ${res.status}`);
    }
    const { order } = await res.json();

    qs('otpCode').textContent = order.otp;
    const qrWrap = document.getElementById('qrcode');
    qrWrap.innerHTML = '';
    new QRCode(qrWrap, { text: order.qrData || ('ORDER:' + order.id), width: 160, height: 160 });

    show(qs('checkoutModal'), true);
    state.cart = [];
    updateCartUI();
    showToast('Order placed! OTP generated.', 'success');
  }catch(e){
    console.error('Checkout failed:', e);
    showToast('Order failed: ' + e.message, 'error');
  }
}

// ===== Demo login =====
async function demoLogin(e){
  e.preventDefault();
  try{
    const email = qs('email').value.trim();
    const password = qs('password').value.trim();
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept':'application/json' },
      body: JSON.stringify({ email, password })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.message || `API status ${res.status}`);
    }
    const data = await res.json();
    state.user = data.user;
    showToast(`Welcome ${state.user.name}!`, 'success');
    show(qs('loginModal'), false);
  }catch(e){
    console.error('Login failed:', e);
    showToast('Login failed: ' + e.message, 'error');
  }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  // clear any leftover search text (prevents filtering to 1)
  const si = qs('searchInput'); if(si) si.value = '';

  loadRestaurants();

  qs('searchBtn')?.addEventListener('click', applySearch);
  qs('searchInput')?.addEventListener('keydown', e => { if(e.key==='Enter') applySearch(); });

  qs('menuClose')?.addEventListener('click', () => show(qs('menuModal'), false));
  qs('cartBtn')?.addEventListener('click', () => show(qs('cartDrawer'), true));
  qs('cartClose')?.addEventListener('click', () => show(qs('cartDrawer'), false));
  qs('checkoutBtn')?.addEventListener('click', checkout);
  qs('checkoutClose')?.addEventListener('click', () => {
    qs('qrcode').innerHTML = '';
    show(qs('checkoutModal'), false);
  });

  qs('loginBtn')?.addEventListener('click', () => show(qs('loginModal'), true));
  qs('loginClose')?.addEventListener('click', () => show(qs('loginModal'), false));
  qs('loginForm')?.addEventListener('submit', demoLogin);
});
