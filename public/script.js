const login = document.getElementById("login");
const app = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");

const token = localStorage.getItem("ff_token");

if (token) {
  showApp();
  loadDashboard();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  loginMsg.textContent = "Logging in...";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      loginMsg.textContent = data.error || "Login failed";
      return;
    }

    localStorage.setItem("ff_token", data.token);
    localStorage.setItem("ff_user", username);

    showApp();
    loadDashboard();

  } catch (err) {
    loginMsg.textContent = "Backend is not connected yet.";
  }
});

function showApp() {
  login.classList.add("hidden");
  app.classList.remove("hidden");
}

document.getElementById("logout").onclick = () => {
  localStorage.removeItem("ff_token");
  localStorage.removeItem("ff_user");
  location.reload();
};

async function loadDashboard() {
  try {
    const res = await fetch("/api/accounts", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("ff_token")}`
      }
    });

    if (!res.ok) {
      localStorage.removeItem("ff_token");
      location.reload();
      return;
    }

    const accounts = await res.json();

    renderAccounts(accounts);

    document.getElementById("active").textContent =
      accounts.filter(a => a.status === "online").length;

    document.getElementById("started").textContent =
      accounts.reduce(
        (sum, a) => sum + Number(a.matches_started || 0),
        0
      );

    document.getElementById("done").textContent =
      accounts.reduce(
        (sum, a) => sum + Number(a.matches_done || a.played || 0),
        0
      );

    document.getElementById("totalExp").textContent =
      "+" +
      accounts.reduce(
        (sum, a) => sum + Number(a.exp_gained || 0),
        0
      );

    document.getElementById("count").textContent = accounts.length;

    document.getElementById("who").textContent =
      localStorage.getItem("ff_user") || "Admin";

  } catch (err) {
    console.error(err);
  }
}

function renderAccounts(accounts) {
  const container = document.getElementById("accounts");

  container.innerHTML = "";

  if (!accounts.length) {
    container.innerHTML =
      `<p style="color:#666;text-align:center">
        No accounts added.
      </p>`;
    return;
  }

  accounts.forEach(account => {

    const expInitial = Number(account.initial_exp || 0);
    const currentExp = Number(account.current_exp || 0);

    const gained = Number(
      account.exp_gained ||
      Math.max(0, currentExp - expInitial)
    );

    const level = Number(account.level || 1);
    const played = Number(account.played || 0);

    const card = document.createElement("div");

    card.className = "account";

    card.innerHTML = `
      <div class="tags">

        <span class="tag">
          👤 ${escapeHtml(account.name || "unknown")}
        </span>

        <span class="tag">
          🌐 ${escapeHtml(account.region || "IND")}
        </span>

        <span class="tag">
          🆔 ${escapeHtml(String(account.uid || ""))}
        </span>

        <span class="tag online">
          ● ${escapeHtml(account.status || "offline")}
        </span>

      </div>

      <div class="head">

        <div class="avatar">K</div>

        <div>
          <div class="name">
            ${escapeHtml(account.name || "Account")}
          </div>

          <div class="uid">
            UID: ${escapeHtml(String(account.uid || ""))}
          </div>
        </div>

        <div class="level">
          Lv. ${level}
        </div>

      </div>

      <div class="row">
        <span>PLAYED</span>
        <b>${played}</b>
      </div>

      <div class="progress-label">
        <span>Level ${level}</span>
        <span>Matches: ${played}</span>
      </div>

      <div class="progress">
        <div
          class="bar"
          style="width:${Math.min(
            100,
            (currentExp / 5000) * 100
          )}%"
        ></div>
      </div>

      <div class="exp">

        <div class="box">
          <small>INITIAL EXP</small>
          <strong>${expInitial}</strong>
        </div>

        <div class="box">
          <small>CURRENT EXP</small>
          <strong>${currentExp}</strong>
        </div>

        <div class="box">
          <small>EXP GAINED</small>
          <strong class="gain">+${gained}</strong>
        </div>

      </div>

      <div class="actions">

        <button
          onclick="refreshAccount('${escapeAttr(account.id)}')">
          ⟳ REFRESH
        </button>

        <button
          class="delete"
          onclick="deleteAccount('${escapeAttr(account.id)}')">
          🗑 DELETE
        </button>

      </div>
    `;

    container.appendChild(card);
  });
}

async function refreshAccount(id) {

  const token = localStorage.getItem("ff_token");

  const res = await fetch(`/api/accounts/${id}/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (res.ok) {
    loadDashboard();
  } else {
    alert("Refresh failed");
  }
}

async function deleteAccount(id) {

  if (!confirm("Delete this account?")) {
    return;
  }

  const token = localStorage.getItem("ff_token");

  const res = await fetch(`/api/accounts/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (res.ok) {
    loadDashboard();
  } else {
    alert("Delete failed");
  }
}

document.getElementById("add").onclick = async () => {

  const name = prompt("Account name:");

  if (!name) {
    return;
  }

  const uid = prompt("Account UID:");

  if (!uid) {
    return;
  }

  const token = localStorage.getItem("ff_token");

  const res = await fetch("/api/accounts", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },

    body: JSON.stringify({
      name,
      uid,
      region: "IND",
      status: "offline",
      level: 1,
      played: 0,
      initial_exp: 0,
      current_exp: 0,
      exp_gained: 0
    })
  });

  if (res.ok) {
    loadDashboard();
  } else {
    alert("Could not add account");
  }
};

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return String(value).replace(/'/g, "\\'");
}
