// FitTrack Application Logic

// API helper with Bearer token and 401 redirect
async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.replace("login.html");
    return null;
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options.headers || {})
  };

  try {
    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      window.location.replace("login.html");
      return null;
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  } catch (err) {
    throw err;
  }
}

// Global user cache
let currentUser = null;

// Helper: Initials
function getInitials(name) {
  if (!name) return "U";
  const parts = name.split(/[_\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Helper: Greeting
function getGreeting(name) {
  const hour = new Date().getHours();
  let timeStr = "Good morning";
  if (hour >= 12 && hour < 17) timeStr = "Good afternoon";
  else if (hour >= 17) timeStr = "Good evening";
  return `${timeStr}, ${name}`;
}

// View switcher
function switchView(viewName) {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  document.querySelectorAll(".view-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `view-${viewName}`);
  });

  if (viewName === "dashboard") loadDashboard();
  else if (viewName === "plans") loadPlans();
  else if (viewName === "history") loadHistory();
}

// 1. Dashboard View
async function loadDashboard() {
  try {
    const summary = await api("/api/summary");
    if (!summary) return;

    // Summary cards
    document.getElementById("card-calories").textContent = `${Math.round(summary.todayCalories || 0)} kcal`;
    document.getElementById("card-minutes").textContent = `${summary.todayMinutes || 0} min`;
    document.getElementById("card-streak").textContent = `${summary.streak || 0} ${summary.streak === 1 ? "day" : "days"}`;

    const goal = summary.goal || 500;
    document.getElementById("card-goal-subtext").textContent = `Target: ${Math.round(goal)} kcal`;

    // Progress bar
    const todayCals = Math.round(summary.todayCalories || 0);
    const progressPct = Math.min(100, Math.round((todayCals / goal) * 100));
    const progressBar = document.getElementById("goal-progress-bar");
    progressBar.style.setProperty("--progress-width", `${progressPct}%`);
    document.getElementById("goal-progress-text").textContent = `${todayCals} of ${Math.round(goal)} kcal goal`;

    // Today's exercises list
    const todayList = document.getElementById("today-exercise-list");
    todayList.innerHTML = "";
    if (summary.today && summary.today.length > 0) {
      summary.today.forEach(ex => {
        const row = document.createElement("div");
        row.className = "exercise-row";
        const metaDetail = ex.type === "cardio"
          ? `${ex.durationMin} min (MET ${ex.met})`
          : `${ex.durationMin} min (${ex.sets} sets x ${ex.reps} reps)`;
        row.innerHTML = `
          <div>
            <div class="ex-info-name">${escapeHtml(ex.name)}</div>
            <div class="ex-info-sub">${metaDetail}</div>
          </div>
          <div class="ex-info-cal">${Math.round(ex.calories)} kcal</div>
        `;
        todayList.appendChild(row);
      });
    } else {
      todayList.innerHTML = `<div class="empty-state">No exercises logged today. Use the log exercise form to add one.</div>`;
    }

    // Weekly 7-bar chart
    renderWeeklyChart(summary);
  } catch (err) {
    console.error("Failed to load dashboard summary:", err);
  }
}

// Render 7-bar chart for current week (Mon-Sun)
function renderWeeklyChart(summary) {
  const chart = document.getElementById("week-chart");
  chart.innerHTML = "";

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  const currentDayIndex = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6

  // Map API week data by day abbreviation
  const caloriesByDay = {};
  let maxCal = Math.max(summary.goal || 500, 100);

  if (summary.week && Array.isArray(summary.week)) {
    summary.week.forEach(w => {
      caloriesByDay[w.day] = w.calories;
      if (w.calories > maxCal) maxCal = w.calories;
    });
  }

  days.forEach((dayName, idx) => {
    const col = document.createElement("div");
    col.className = "chart-col";

    let barClass = "";
    let calValue = 0;
    let heightPercent = 0;
    let labelVal = "";

    if (idx < currentDayIndex) {
      // Past day
      barClass = "bar-past";
      calValue = caloriesByDay[dayName] || 0;
      heightPercent = Math.max(4, Math.round((calValue / maxCal) * 100));
      labelVal = calValue > 0 ? `${Math.round(calValue)}` : "";
    } else if (idx === currentDayIndex) {
      // Today
      barClass = "bar-today";
      calValue = summary.todayCalories || 0;
      heightPercent = Math.max(4, Math.round((calValue / maxCal) * 100));
      labelVal = `${Math.round(calValue)}`;
    } else {
      // Future day
      barClass = "bar-future";
      heightPercent = 100;
      labelVal = "";
    }

    col.innerHTML = `
      <div class="col-val">${labelVal}</div>
      <div class="bar-track">
        <div class="bar-fill ${barClass}" style="--bar-height: ${heightPercent}%;"></div>
      </div>
      <div class="col-label">${dayName}</div>
    `;
    chart.appendChild(col);
  });
}

// 2. Log Exercise View Setup
function setupLogExerciseForm() {
  const typeSelect = document.getElementById("log-type");
  const cardioFields = document.getElementById("cardio-fields");
  const strengthFields = document.getElementById("strength-fields");
  const form = document.getElementById("log-exercise-form");
  const msg = document.getElementById("log-form-msg");

  typeSelect.addEventListener("change", () => {
    const isCardio = typeSelect.value === "cardio";
    cardioFields.style.display = isCardio ? "block" : "none";
    strengthFields.style.display = isCardio ? "none" : "block";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "msg-line";
    msg.textContent = "";

    const type = typeSelect.value;
    const name = document.getElementById("log-name").value.trim();
    const durationMin = parseInt(document.getElementById("log-duration").value, 10);

    if (!name || isNaN(durationMin) || durationMin <= 0) {
      msg.className = "msg-line msg-error";
      msg.textContent = "Please provide valid exercise name and duration.";
      return;
    }

    const payload = { type, name, durationMin };
    if (type === "cardio") {
      const met = parseFloat(document.getElementById("log-met").value);
      payload.met = isNaN(met) ? 6.0 : met;
    } else {
      const sets = parseInt(document.getElementById("log-sets").value, 10);
      const reps = parseInt(document.getElementById("log-reps").value, 10);
      payload.sets = isNaN(sets) ? 3 : sets;
      payload.reps = isNaN(reps) ? 10 : reps;
    }

    try {
      const res = await api("/api/exercises", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (res) {
        msg.className = "msg-line msg-success";
        msg.textContent = `Logged ${escapeHtml(res.name)} (${Math.round(res.calories)} kcal).`;
        document.getElementById("log-name").value = "";
      }
    } catch (err) {
      msg.className = "msg-line msg-error";
      msg.textContent = err.message || "Failed to log exercise.";
    }
  });
}

// 3. Workout Plans View
async function loadPlans() {
  const container = document.getElementById("plans-container");
  const select = document.getElementById("plan-select");
  container.innerHTML = "";
  select.innerHTML = `<option value="">Select a plan</option>`;

  try {
    const plans = await api("/api/plans");
    if (!plans || plans.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No workout plans created yet. Create a plan to get started.</div>`;
      return;
    }

    plans.forEach(p => {
      // Add to plan card grid
      const card = document.createElement("div");
      card.className = "plan-card";

      let exercisesHtml = "";
      if (p.exercises && p.exercises.length > 0) {
        exercisesHtml = p.exercises.map(ex => {
          const detail = ex.type === "cardio"
            ? `${ex.durationMin} min (MET ${ex.met})`
            : `${ex.sets} sets x ${ex.reps} reps`;
          return `
            <div class="plan-item">
              <span>${escapeHtml(ex.name)} (${detail})</span>
              <span>${Math.round(ex.calories)} kcal</span>
            </div>
          `;
        }).join("");
      } else {
        exercisesHtml = `<div class="card-subtext" style="padding: 4px 0;">No exercises in this plan yet.</div>`;
      }

      card.innerHTML = `
        <div class="plan-header">
          <div class="plan-title">${escapeHtml(p.planName)}</div>
          <div class="plan-totals">${p.totalDuration} min · ${Math.round(p.totalCalories)} kcal</div>
        </div>
        <div class="plan-items">${exercisesHtml}</div>
      `;
      container.appendChild(card);

      // Populate select dropdown
      const opt = document.createElement("option");
      opt.value = p.planName;
      opt.textContent = p.planName;
      select.appendChild(opt);
    });
  } catch (err) {
    container.innerHTML = `<div class="msg-line msg-error">Failed to load plans: ${escapeHtml(err.message)}</div>`;
  }
}

function setupPlansForms() {
  // Create Plan Form
  const createForm = document.getElementById("create-plan-form");
  const createMsg = document.getElementById("create-plan-msg");

  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    createMsg.className = "msg-line";
    createMsg.textContent = "";

    const planName = document.getElementById("new-plan-name").value.trim();
    if (!planName) {
      createMsg.className = "msg-line msg-error";
      createMsg.textContent = "Please enter a plan name.";
      return;
    }

    try {
      await api("/api/plans", {
        method: "POST",
        body: JSON.stringify({ planName })
      });
      createMsg.className = "msg-line msg-success";
      createMsg.textContent = "Plan created.";
      document.getElementById("new-plan-name").value = "";
      loadPlans();
    } catch (err) {
      createMsg.className = "msg-line msg-error";
      createMsg.textContent = err.message || "Failed to create plan.";
    }
  });

  // Add Exercise to Plan Form
  const addForm = document.getElementById("add-to-plan-form");
  const addMsg = document.getElementById("add-plan-msg");
  const planExType = document.getElementById("plan-ex-type");
  const planCardioFields = document.getElementById("plan-cardio-fields");
  const planStrengthFields = document.getElementById("plan-strength-fields");

  planExType.addEventListener("change", () => {
    const isCardio = planExType.value === "cardio";
    planCardioFields.style.display = isCardio ? "block" : "none";
    planStrengthFields.style.display = isCardio ? "none" : "block";
  });

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    addMsg.className = "msg-line";
    addMsg.textContent = "";

    const planName = document.getElementById("plan-select").value;
    const type = planExType.value;
    const name = document.getElementById("plan-ex-name").value.trim();
    const durationMin = parseInt(document.getElementById("plan-ex-duration").value, 10);

    if (!planName || !name || isNaN(durationMin) || durationMin <= 0) {
      addMsg.className = "msg-line msg-error";
      addMsg.textContent = "Please fill in all exercise fields.";
      return;
    }

    const payload = { type, name, durationMin };
    if (type === "cardio") {
      const met = parseFloat(document.getElementById("plan-ex-met").value);
      payload.met = isNaN(met) ? 6.0 : met;
    } else {
      const sets = parseInt(document.getElementById("plan-ex-sets").value, 10);
      const reps = parseInt(document.getElementById("plan-ex-reps").value, 10);
      payload.sets = isNaN(sets) ? 3 : sets;
      payload.reps = isNaN(reps) ? 10 : reps;
    }

    try {
      await api(`/api/plans/${encodeURIComponent(planName)}/exercises`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      addMsg.className = "msg-line msg-success";
      addMsg.textContent = "Exercise added to plan.";
      document.getElementById("plan-ex-name").value = "";
      loadPlans();
    } catch (err) {
      addMsg.className = "msg-line msg-error";
      addMsg.textContent = err.message || "Failed to add exercise.";
    }
  });
}

// 4. History View
async function loadHistory() {
  const tbody = document.getElementById("history-table-body");
  const emptyState = document.getElementById("history-empty");
  tbody.innerHTML = "";

  try {
    const list = await api("/api/exercises");
    if (!list || list.length === 0) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    list.forEach(ex => {
      const tr = document.createElement("tr");
      tr.className = "exercise-row";
      const typeLabel = ex.type === "cardio" ? "Cardio" : "Strength";
      tr.innerHTML = `
        <td>${escapeHtml(ex.date)}</td>
        <td><strong>${escapeHtml(ex.name)}</strong></td>
        <td>${typeLabel}</td>
        <td>${ex.durationMin} min</td>
        <td>${Math.round(ex.calories)} kcal</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    emptyState.style.display = "block";
    emptyState.textContent = "Failed to load history.";
  }
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// App Initialization
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.replace("login.html");
    return;
  }

  // Load user profile
  try {
    currentUser = await api("/api/me");
    if (currentUser) {
      document.getElementById("user-display-name").textContent = currentUser.username;
      document.getElementById("user-display-weight").textContent = `${currentUser.weight} kg`;
      document.getElementById("user-initials").textContent = getInitials(currentUser.username);
      document.getElementById("greeting-text").textContent = getGreeting(currentUser.username);
    }
  } catch (err) {
    console.error("Failed to fetch user profile:", err);
  }

  // Set today's date formatted
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  document.getElementById("today-date-text").textContent = new Date().toLocaleDateString(undefined, options);

  // Nav buttons event listeners
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.view);
    });
  });

  // Header "Log exercise" button
  const headerLogBtn = document.getElementById("header-log-btn");
  if (headerLogBtn) {
    headerLogBtn.addEventListener("click", () => {
      switchView("log");
    });
  }

  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await api("/api/logout", { method: "POST" });
      } catch (err) {
        // proceed anyway
      }
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      window.location.replace("login.html");
    });
  }

  setupLogExerciseForm();
  setupPlansForms();

  // Load default view (Dashboard)
  loadDashboard();
});
