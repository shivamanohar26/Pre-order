// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');               // ← added (needed for sendFile)

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the current folder (so index.html, app.js, style.css work)
app.use(express.static(__dirname));         // e.g., C:\Users\...\preOrder\index.html

// ✅ Serve index.html at "/" explicitly (fixes some Windows/OneDrive cases)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------------- In-memory data ----------------
const users = [
  { id: 'u1', name: 'Shiva', email: 'user@example.com', password: '123456' }
];

const restaurants = [
  {
    id: 'r101',
    name: 'Pradise',
    location: 'Hyderabad',
    cuisine: 'Biryani • North Indian',
    rating: 4.4,
    eta: 15,
    image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/f3/37/e5/img-20200220-161954-largejpg.jpg?w=800&h=400&s=1', // biryani
    menu: [
      { id: 'm001', name: 'Hyderabadi Chicken Biryani', price: 220, discount: 20, veg: false, category: 'Main' },
      { id: 'm002', name: 'Veg Biryani', price: 180, discount: 0, veg: true, category: 'Main' },
      { id: 'm003', name: 'Paneer Butter Masala', price: 210, discount: 30, veg: true, category: 'Curry' },
      { id: 'm004', name: 'Tandoori Roti', price: 20, discount: 0, veg: true, category: 'Bread' }
    ]
  },
  {
    id: 'r202',
    name: 'Coastal Cravings',
    location: 'Visakhapatnam',
    cuisine: 'Seafood • South Indian',
    rating: 4.6,
    eta: 20,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=60&auto=format&fit=crop', // seafood thali
    menu: [
      { id: 'm101', name: 'Prawn Fry', price: 260, discount: 40, veg: false, category: 'Starter' },
      { id: 'm102', name: 'Fish Curry', price: 240, discount: 0, veg: false, category: 'Curry' },
      { id: 'm103', name: 'Curd Rice', price: 120, discount: 10, veg: true, category: 'Rice' },
      { id: 'm104', name: 'Neer Dosa (2 pcs)', price: 90, discount: 0, veg: true, category: 'Bread' }
    ]
  },
  {
    id: 'r303',
    name: 'pista house',
    location: 'Bengaluru',
    cuisine: 'Biryani • Fast Food',
    rating: 4.1,
    eta: 12,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&q=60&auto=format&fit=crop', // burgers
    menu: [
      { id: 'm201', name: 'Cheese Burger', price: 150, discount: 20, veg: false, category: 'Burger' },
      { id: 'm202', name: 'Veggie Burger', price: 120, discount: 10, veg: true, category: 'Burger' },
      { id: 'm203', name: 'French Fries', price: 80, discount: 0, veg: true, category: 'Snacks' },
      { id: 'm204', name: 'Coke (500ml)', price: 60, discount: 0, veg: true, category: 'Beverage' }
    ]
  }
];


const orders = []; // created orders

// ---------------- Helpers ----------------
const genId = (p='id') => p + '_' + crypto.randomBytes(6).toString('hex');
const genOTP = () => String(Math.floor(1000 + Math.random() * 9000));
const calcItemPrice = (item) => Math.max(0, (item.price || 0) - (item.discount || 0));

// ---------------- Auth (demo) ----------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials (demo user: user@example.com / 123456)' });
  return res.json({ token: 'demo-token', user: { id: user.id, name: user.name, email: user.email } });
});

// ---------------- Restaurants ----------------
app.get('/api/restaurants', (req, res) => {
  res.json({ restaurants });
});

app.get('/api/restaurants/:id/menu', (req, res) => {
  const r = restaurants.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ message: 'Restaurant not found' });
  res.json({ menu: r.menu });
});

// ---------------- Orders ----------------
app.post('/api/orders', (req, res) => {
  const { userId, restaurantId, items, pickupTime } = req.body || {};
  const user = users.find(u => u.id === userId);
  const restaurant = restaurants.find(r => r.id === restaurantId);
  if (!user) return res.status(400).json({ message: 'Invalid userId' });
  if (!restaurant) return res.status(400).json({ message: 'Invalid restaurantId' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Items required' });

  let subtotal = 0, discount = 0;
  const enriched = items.map(it => {
    const m = restaurant.menu.find(x => x.id === it.itemId);
    if (!m) return null;
    const qty = Math.max(1, it.qty || 1);
    subtotal += (m.price || 0) * qty;
    discount += (m.discount || 0) * qty;
    return { itemId: m.id, name: m.name, price: m.price, discount: m.discount || 0, qty };
  }).filter(Boolean);

  const finalPrice = Math.max(0, subtotal - discount);
  const otp = genOTP();
  const order = {
    id: genId('ord'),
    userId,
    restaurantId,
    items: enriched,
    subtotal,
    discountApplied: discount,
    finalPrice,
    pickupTime: pickupTime || 'ASAP',
    status: 'Paid',
    paymentStatus: 'Paid',
    qrData: `ORDER:${Date.now()}|RID:${restaurantId}`,
    otp,
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  res.status(201).json({ order });
});

app.get('/api/orders', (req, res) => {
  const { userId } = req.query;
  const list = userId ? orders.filter(o => o.userId === userId) : orders;
  res.json({ orders: list });
});

app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  const allowed = ['Pending', 'Cooking', 'Ready', 'Picked', 'Paid'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  const ord = orders.find(o => o.id === req.params.id);
  if (!ord) return res.status(404).json({ message: 'Order not found' });
  ord.status = status;
  res.json({ order: ord });
});

// ---------------- Start ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
