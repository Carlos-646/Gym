/* =========================================================
   CONFIGURACIÓN DE STRIPE (Payment Links)
   ---------------------------------------------------------
   1. Entra a tu panel de Stripe → Productos → Crea un
      producto/precio para cada plan.
   2. Crea un "Payment Link" para cada uno.
   3. Pega aquí las URLs que te da Stripe.
   Mientras estén vacías, el sitio simula el pago (demo).
   ========================================================= */
const STRIPE_LINKS = {
  "Mensual": "", // ej: "https://buy.stripe.com/xxxxxxxxxxxx"
  "Anual": ""    // ej: "https://buy.stripe.com/yyyyyyyyyyyy"
};

const PLAN_DURATION_DAYS = { "Mensual": 30, "Anual": 365 };

/* ---------- Navegación por pestañas ---------- */
const tabButtons = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.panel');

function goTab(name) {
  tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  panels.forEach(p => p.classList.toggle('active', p.id === name));
  if (name === 'perfil') renderProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
tabButtons.forEach(b => b.addEventListener('click', () => goTab(b.dataset.tab)));

/* ---------- Almacenamiento (demo, localStorage) ---------- */
function getUsers() { return JSON.parse(localStorage.getItem('ic_users') || '{}'); }
function saveUsers(u) { localStorage.setItem('ic_users', JSON.stringify(u)); }
function getSession() { return localStorage.getItem('ic_session'); }
function setSession(email) { localStorage.setItem('ic_session', email); }
function clearSession() { localStorage.removeItem('ic_session'); }

function currentUser() {
  const email = getSession();
  if (!email) return null;
  return getUsers()[email] || null;
}

/* ---------- Chip de usuario en el header ---------- */
function updateChip() {
  const u = currentUser();
  document.getElementById('userChip').innerHTML = u
    ? 'Sesión: <b>' + u.name + '</b>'
    : 'No has iniciado sesión';
}

/* ---------- Registro ---------- */
document.getElementById('registerForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPass').value;
  const users = getUsers();
  if (users[email]) { alert('Ya existe una cuenta con ese correo. Inicia sesión.'); return; }
  users[email] = { name, email, pass, plan: null, start: null, end: null };
  saveUsers(users);
  setSession(email);
  e.target.reset();
  updateChip();
  renderProfile();
});

/* ---------- Login ---------- */
document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('logEmail').value.trim().toLowerCase();
  const pass = document.getElementById('logPass').value;
  const users = getUsers();
  if (!users[email]) { alert('No existe una cuenta con ese correo. Regístrate primero.'); return; }
  if (users[email].pass !== pass) { alert('Contraseña incorrecta.'); return; }
  setSession(email);
  e.target.reset();
  updateChip();
  renderProfile();
});

function logout() {
  clearSession();
  updateChip();
  renderProfile();
}

/* ---------- Render del perfil ---------- */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
}
function daysLeft(end) {
  if (!end) return null;
  return Math.ceil((new Date(end) - new Date()) / (1000*60*60*24));
}

function renderProfile() {
  const u = currentUser();
  const authView = document.getElementById('authView');
  const profileView = document.getElementById('profileView');
  if (!u) { authView.style.display = 'block'; profileView.style.display = 'none'; return; }

  authView.style.display = 'none';
  profileView.style.display = 'block';

  document.getElementById('pfName').textContent = u.name;
  document.getElementById('pfEmail').textContent = u.email;
  document.getElementById('pfPlan').textContent = u.plan || 'Sin plan activo';
  document.getElementById('pfStart').textContent = fmtDate(u.start);
  document.getElementById('pfEnd').textContent = fmtDate(u.end);

  const alertBox = document.getElementById('planAlert');
  const renewBtn = document.getElementById('renewBtn');

  if (!u.plan) {
    alertBox.className = 'alert warn';
    alertBox.textContent = 'Aún no tienes un plan activo. ¡Compra uno para empezar a entrenar!';
    renewBtn.textContent = 'Comprar plan';
    return;
  }

  const left = daysLeft(u.end);
  if (left > 7) {
    alertBox.className = 'alert ok';
    alertBox.textContent = '✓ Tu plan ' + u.plan + ' está activo. Vence el ' + fmtDate(u.end) + ' (' + left + ' días restantes).';
    renewBtn.textContent = 'Renovar anticipadamente';
  } else if (left > 0) {
    alertBox.className = 'alert warn';
    alertBox.textContent = '⚠ Tu plan ' + u.plan + ' vence pronto: el ' + fmtDate(u.end) + ' (' + left + ' días). ¡Renueva ya!';
    renewBtn.textContent = 'Renovar ahora';
  } else {
    alertBox.className = 'alert danger';
    alertBox.textContent = '✕ Tu plan ' + u.plan + ' venció el ' + fmtDate(u.end) + '. Renueva para recuperar el acceso.';
    renewBtn.textContent = 'Renovar plan vencido';
  }
}

/* ---------- Selección de plan ---------- */
function selectPlan(plan, price) {
  document.getElementById('coPlan').value = plan;
  document.getElementById('selectedPlanLabel').textContent = plan + ' — $' + price.toLocaleString('es-MX');
  const u = currentUser();
  if (u) {
    document.getElementById('coFullName').value = u.name;
    document.getElementById('coEmail').value = u.email;
  }
  document.getElementById('checkoutForm').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('coPlan').addEventListener('change', e => {
  const plan = e.target.value;
  const prices = { "Mensual": 450, "Anual": 3900 };
  document.getElementById('selectedPlanLabel').textContent =
    plan ? plan + ' — $' + prices[plan].toLocaleString('es-MX') : 'Ninguno';
});

/* ---------- Checkout / pago ---------- */
document.getElementById('checkoutForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('coFullName').value.trim();
  const email = document.getElementById('coEmail').value.trim().toLowerCase();
  const plan = document.getElementById('coPlan').value;
  if (!plan) { alert('Selecciona un plan.'); return; }

  // Registrar/actualizar el plan en la cuenta del usuario (demo)
  const users = getUsers();
  if (!users[email]) {
    // Si no tiene cuenta, se crea una básica ligada al correo del pago
    users[email] = { name, email, pass: '', plan: null, start: null, end: null };
  }
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + PLAN_DURATION_DAYS[plan]);
  users[email].name = name;
  users[email].plan = plan;
  users[email].start = start.toISOString();
  users[email].end = end.toISOString();
  saveUsers(users);

  // Si hay un Payment Link de Stripe configurado, redirige al pago real
  const link = STRIPE_LINKS[plan];
  if (link) {
    const url = new URL(link);
    url.searchParams.set('prefilled_email', email);
    window.location.href = url.toString();
    return;
  }

  // Modo demo (sin enlace configurado)
  alert('Plan "' + plan + '" registrado para ' + name + '.\n\nVence el ' + fmtDate(users[email].end) +
        '.\n\n(Para cobrar de verdad, pega tus Stripe Payment Links en script.js: STRIPE_LINKS).');
  if (getSession() === email || !getSession()) {
    setSession(email);
    updateChip();
  }
  goTab('perfil');
});

/* ---------- Init ---------- */
updateChip();
