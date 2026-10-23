// FitTrack Application Logic - Approved Light Teal Design

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

// Global user state
let currentUser = { weight: 68, dailyGoal: 500, username: "User" };
let currentView = "dashboard";
let allExercisesCache = [];

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
  currentView = viewName;

  // Update nav item active state
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  // Hide all panels, activate current
  document.querySelectorAll(".view-panel").forEach(panel => {
    const isActive = panel.id === `view-${viewName}`;
    panel.classList.toggle("active", isActive);
    if (isActive) {
      // Re-trigger animation by forcing reflow
      panel.style.animation = "none";
      void panel.offsetWidth;
      panel.style.animation = "";
    }
  });

  // Close mobile drawer if open
  const drawer = document.getElementById("mobile-menu-drawer");
  if (drawer) drawer.classList.remove("open");

  // Update Main Header based on view
  updateHeaderForView(viewName);

  // Load view content
  if (viewName === "dashboard") loadDashboard();
  else if (viewName === "log") loadLogExerciseView();
  else if (viewName === "plans") loadPlans();
  else if (viewName === "history") loadHistory();
  else if (viewName === "profile") loadProfile();
}

function updateHeaderForView(viewName) {
  const mainTitle = document.getElementById("header-main-title");
  const subTitle = document.getElementById("header-sub-title");
  const btnWrap = document.getElementById("header-btn-wrap");
  const actionBtn = document.getElementById("header-action-btn");

  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  if (viewName === "dashboard") {
    mainTitle.textContent = getGreeting(currentUser.username || "User");
    subTitle.textContent = todayStr;
    btnWrap.style.display = "block";
    actionBtn.textContent = "Log exercise";
    actionBtn.onclick = () => switchView("log");
  } else if (viewName === "plans") {
    mainTitle.textContent = "Workout plans";
    subTitle.textContent = "Saved routines and target workouts";
    btnWrap.style.display = "block";
    actionBtn.textContent = "New plan";
    actionBtn.onclick = () => {
      const box = document.getElementById("new-plan-box");
      if (box) {
        box.style.display = box.style.display === "none" ? "block" : "none";
        if (box.style.display === "block") {
          document.getElementById("new-plan-name").focus();
        }
      }
    };
  } else if (viewName === "log") {
    mainTitle.textContent = "Log exercise";
    subTitle.textContent = "Record a workout session";
    btnWrap.style.display = "none";
  } else if (viewName === "history") {
    mainTitle.textContent = "History";
    subTitle.textContent = "All logged workouts by date";
    btnWrap.style.display = "none";
  } else if (viewName === "profile") {
    mainTitle.textContent = "Profile";
    subTitle.textContent = "Manage your fitness goals and metrics";
    btnWrap.style.display = "none";
  }
}

// 1. Dashboard View
async function loadDashboard() {
  try {
    const summary = await api("/api/summary");
    if (!summary) return;

    // Summary cards: 22px weight 500
    const todayCals = Math.round(summary.todayCalories || 0);
    const todayMins = summary.todayMinutes || 0;
    const streakDays = summary.streak || 0;
    const goal = Math.round(summary.goal || 500);

    document.getElementById("card-calories").textContent = `${todayCals} kcal`;
    document.getElementById("card-minutes").textContent = `${todayMins} min`;
    document.getElementById("card-streak").textContent = `${streakDays} ${streakDays === 1 ? "day" : "days"}`;

    // "Today" card: progress bar & goal text
    const progressPct = Math.min(100, Math.round((todayCals / goal) * 100));
    const progressBar = document.getElementById("goal-progress-bar");
    progressBar.style.setProperty("--progress-width", `${progressPct}%`);
    document.getElementById("goal-progress-text").textContent = `${todayCals} of ${goal} kcal goal`;

    // Today's exercises: full width --teal-50 boxes
    const todayList = document.getElementById("today-exercise-list");
    todayList.innerHTML = "";
    if (summary.today && summary.today.length > 0) {
      summary.today.forEach(ex => {
        const row = document.createElement("div");
        row.className = "exercise-row-box";
        const metaDetail = ex.type === "cardio"
          ? `${ex.durationMin} min (MET ${ex.met})`
          : `${ex.durationMin} min (${ex.sets} sets x ${ex.reps} reps)`;
        row.innerHTML = `
          <div>
            <div class="ex-name-500">${escapeHtml(ex.name)}</div>
            <div class="ex-min-muted">${metaDetail}</div>
          </div>
          <div class="ex-kcal-800">${Math.round(ex.calories)} kcal</div>
        `;
        todayList.appendChild(row);
      });
    } else {
      todayList.innerHTML = `<div class="empty-state-pale">No exercises logged today. Use the log exercise form to add one.</div>`;
    }

    // Weekly 7 large bars Mon to Sun
    renderWeeklyChart(summary);
  } catch (err) {
    console.error("Failed to load dashboard summary:", err);
  }
}

// 7-Bar Chart Mon to Sun
function renderWeeklyChart(summary) {
  const chart = document.getElementById("week-chart");
  chart.innerHTML = "";

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  const currentDayIndex = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6

  // Map API week data by day abbreviation
  const caloriesByDay = {};
  (summary.week || []).forEach(w => {
    caloriesByDay[w.day] = w.calories;
  });
  caloriesByDay[days[currentDayIndex]] = summary.todayCalories || 0;

  // Highest value in the week to scale percentage heights
  let maxVal = 100;
  for (let i = 0; i <= currentDayIndex; i++) {
    const val = caloriesByDay[days[i]] || 0;
    if (val > maxVal) maxVal = val;
  }

  days.forEach((dayName, idx) => {
    const col = document.createElement("div");
    col.className = "chart-bar-cell";
    col.style.setProperty("--bar-i", idx);

    let rectClass = "";
    let calValue = 0;
    let heightPercent = 0;
    let labelVal = "";
    const isToday = (idx === currentDayIndex);

    if (idx < currentDayIndex) {
      // Past days: --teal-300
      rectClass = "rect-past";
      calValue = caloriesByDay[dayName] || 0;
      heightPercent = maxVal > 0 ? Math.max(8, Math.round((calValue / maxVal) * 100)) : 8;
      labelVal = calValue > 0 ? `${Math.round(calValue)}` : "";
    } else if (isToday) {
      // Today: --teal-800 with its calorie value above it and a bold day label
      rectClass = "rect-today";
      calValue = summary.todayCalories || 0;
      heightPercent = maxVal > 0 ? Math.max(8, Math.round((calValue / maxVal) * 100)) : 8;
      labelVal = `${Math.round(calValue)}`;
    } else {
      // Future days: dashed outlines in --teal-500 at a fixed ghost height
      rectClass = "rect-ghost";
      heightPercent = 0;
      labelVal = "";
    }

    col.innerHTML = `
      <div class="bar-num-top">${labelVal}</div>
      <div class="bar-lane">
        <div class="bar-rect ${rectClass}" style="${heightPercent > 0 ? `height: ${heightPercent}%;` : ''}"></div>
      </div>
      <div class="bar-day-tag ${isToday ? 'bar-day-today' : ''}">${dayName}</div>
    `;
    chart.appendChild(col);
  });
}

// 2. Log Exercise View
async function loadLogExerciseView() {
  // Set default date to today
  const dateInput = document.getElementById("log-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  // Update estimated burn calculation
  updateLiveEstimate();

  // Load recent 3 entries
  loadRecentEntries();
}

function updateLiveEstimate() {
  const type = document.getElementById("log-type").value;
  const duration = parseFloat(document.getElementById("log-duration").value) || 0;
  let estimated = 0;
  const weight = currentUser.weight || 68;

  if (type === "cardio") {
    const met = parseFloat(document.getElementById("log-met").value) || 7.0;
    estimated = Math.round(met * weight * (duration / 60));
    document.getElementById("est-burn-calc").textContent = `${duration} min at MET ${met} for ${weight} kg`;
  } else {
    const sets = parseInt(document.getElementById("log-sets").value, 10) || 3;
    const reps = parseInt(document.getElementById("log-reps").value, 10) || 10;
    estimated = Math.round(sets * reps * 0.5);
    document.getElementById("est-burn-calc").textContent = `${sets} sets x ${reps} reps (0.5 kcal / rep)`;
  }

  const numEl = document.getElementById("est-burn-val");
  if (numEl.textContent !== String(estimated)) {
    numEl.textContent = estimated;
    numEl.classList.remove("pop-anim");
    void numEl.offsetWidth; // trigger reflow
    numEl.classList.add("pop-anim");
  }
}

async function loadRecentEntries() {
  const recentList = document.getElementById("recent-exercises-list");
  if (!recentList) return;
  recentList.innerHTML = "";

  try {
    const list = await api("/api/exercises");
    allExercisesCache = list || [];
    const recents = allExercisesCache.slice(0, 3);

    if (recents.length === 0) {
      recentList.innerHTML = `<div style="font-size: 12px; color: var(--muted); padding: 4px 0;">No exercises yet.</div>`;
      return;
    }

    recents.forEach(ex => {
      const row = document.createElement("div");
      row.className = "exercise-row-box";
      row.innerHTML = `
        <div>
          <div class="ex-name-500">${escapeHtml(ex.name)}</div>
          <div class="ex-min-muted">${ex.durationMin} min · ${ex.date}</div>
        </div>
        <div class="ex-kcal-800">${Math.round(ex.calories)} kcal</div>
      `;
      recentList.appendChild(row);
    });
  } catch (err) {
    recentList.innerHTML = `<div style="font-size: 11px; color: var(--error);">Failed to load recent workouts.</div>`;
  }
}

function setupLogExerciseForm() {
  const segCardio = document.getElementById("seg-cardio");
  const segStrength = document.getElementById("seg-strength");
  const logTypeInput = document.getElementById("log-type");
  const cardioFields = document.getElementById("cardio-fields");
  const strengthFields = document.getElementById("strength-fields");
  const form = document.getElementById("log-exercise-form");
  const msg = document.getElementById("log-form-msg");

  // Segmented control toggle
  segCardio.addEventListener("click", () => {
    segCardio.classList.add("active");
    segStrength.classList.remove("active");
    logTypeInput.value = "cardio";
    cardioFields.style.display = "block";
    strengthFields.style.display = "none";
    updateLiveEstimate();
  });

  segStrength.addEventListener("click", () => {
    segStrength.classList.add("active");
    segCardio.classList.remove("active");
    logTypeInput.value = "strength";
    cardioFields.style.display = "none";
    strengthFields.style.display = "block";
    updateLiveEstimate();
  });

  // Inputs listen for live estimate updates
  ["log-duration", "log-met", "log-sets", "log-reps"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateLiveEstimate);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "msg-line";
    msg.textContent = "";

    const type = logTypeInput.value;
    const name = document.getElementById("log-name").value.trim();
    const durationMin = parseInt(document.getElementById("log-duration").value, 10);
    const date = document.getElementById("log-date").value;

    if (!name || isNaN(durationMin) || durationMin <= 0) {
      msg.className = "msg-line msg-error";
      msg.textContent = "Please provide valid exercise name and duration.";
      return;
    }

    const payload = { type, name, durationMin };
    if (date) payload.date = date;

    if (type === "cardio") {
      const met = parseFloat(document.getElementById("log-met").value);
      payload.met = isNaN(met) ? 7.0 : met;
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
        loadRecentEntries();
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
      container.innerHTML = `
        <div class="card-teal-200 empty-state-pale" style="grid-column: 1 / -1; text-align: center;">
          <p style="margin-bottom: 8px;">No plans yet. Create your first plan.</p>
          <button class="btn btn-primary" onclick="document.getElementById('new-plan-box').style.display='block'; document.getElementById('new-plan-name').focus();">New plan</button>
        </div>
      `;
      return;
    }

    plans.forEach((p, idx) => {
      const card = document.createElement("div");
      // Cycle shades by position: 1st --teal-800, 2nd --teal-600, 3rd --teal-300
      const shadeNum = (idx % 3) + 1;
      card.className = `plan-card-item plan-shade-${shadeNum}`;
      card.style.animationDelay = `${idx * 0.08}s`;

      let exercisesHtml = "";
      if (p.exercises && p.exercises.length > 0) {
        exercisesHtml = p.exercises.map((ex, exIdx) => {
          return `
            <div class="plan-inner-row" style="animation-delay: ${(idx * 0.08) + (exIdx * 0.04)}s;">
              <span>${escapeHtml(ex.name)}</span>
              <span class="plan-inner-detail">${ex.durationMin} min, ${Math.round(ex.calories)} kcal</span>
            </div>
          `;
        }).join("");
      } else {
        exercisesHtml = `<div style="font-size: 11px; opacity: 0.8; padding: 4px 0;">No exercises in this plan yet.</div>`;
      }

      card.innerHTML = `
        <div class="plan-title-head">${escapeHtml(p.planName)}</div>
        <div class="plan-sub-tag">${p.exercises ? p.exercises.length : 0} exercises, ${p.totalDuration} min</div>
        <div class="plan-rows-stack">${exercisesHtml}</div>
      `;
      container.appendChild(card);

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
      setTimeout(() => {
        document.getElementById("new-plan-box").style.display = "none";
        createMsg.textContent = "";
      }, 1200);
      loadPlans();
    } catch (err) {
      createMsg.className = "msg-line msg-error";
      createMsg.textContent = err.message || "Failed to create plan.";
    }
  });

  const addForm = document.getElementById("add-to-plan-form");
  const addMsg = document.getElementById("add-plan-msg");
  const planExType = document.getElementById("plan-ex-type");

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
      payload.met = 7.0;
    } else {
      payload.sets = 3;
      payload.reps = 10;
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

// 4. History View: Grouped by date
async function loadHistory() {
  const container = document.getElementById("history-groups-wrap");
  const emptyState = document.getElementById("history-empty");
  container.innerHTML = "";

  try {
    const list = await api("/api/exercises");
    if (!list || list.length === 0) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    // Group entries by date (newest first)
    const groups = {};
    list.forEach(ex => {
      const d = ex.date || "Unknown date";
      if (!groups[d]) groups[d] = [];
      groups[d].push(ex);
    });

    // Render each day as a --teal-150 card containing --teal-50 rows
    Object.keys(groups).forEach((dateStr, groupIdx) => {
      const items = groups[dateStr];
      const dayTotalCals = Math.round(items.reduce((sum, item) => sum + (item.calories || 0), 0));

      // Heading with date on left and total on right
      const heading = document.createElement("div");
      heading.className = "history-date-heading";
      heading.innerHTML = `
        <span>${formatDateHeading(dateStr)}</span>
        <strong style="color: var(--teal-800);">${dayTotalCals} kcal</strong>
      `;
      container.appendChild(heading);

      // Day card on --teal-150
      const dayCard = document.createElement("div");
      dayCard.className = "history-day-card";
      dayCard.style.animationDelay = `${groupIdx * 0.06}s`;

      items.forEach(item => {
        const row = document.createElement("div");
        row.className = "exercise-row-box";
        const metaDetail = item.type === "cardio"
          ? `${item.durationMin} min (MET ${item.met})`
          : `${item.durationMin} min (${item.sets} sets x ${item.reps} reps)`;
        row.innerHTML = `
          <div>
            <div class="ex-name-500">${escapeHtml(item.name)}</div>
            <div class="ex-min-muted">${metaDetail}</div>
          </div>
          <div class="ex-kcal-800">${Math.round(item.calories)} kcal</div>
        `;
        dayCard.appendChild(row);
      });

      container.appendChild(dayCard);
    });
  } catch (err) {
    emptyState.style.display = "block";
    emptyState.textContent = "Failed to load history.";
  }
}

function formatDateHeading(dateStr) {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }
  } catch (e) {}
  return dateStr;
}

// 5. Profile View
async function loadProfile() {
  try {
    currentUser = await api("/api/me");
    const exercises = await api("/api/exercises");

    if (currentUser) {
      document.getElementById("profile-username").value = currentUser.username;
      document.getElementById("profile-weight").value = currentUser.weight;
      document.getElementById("profile-goal").value = currentUser.dailyGoal;
    }

    if (exercises && Array.isArray(exercises)) {
      const totalWorkouts = exercises.length;
      const totalMins = exercises.reduce((sum, x) => sum + (x.durationMin || 0), 0);
      const totalCals = Math.round(exercises.reduce((sum, x) => sum + (x.calories || 0), 0));

      document.getElementById("stat-total-workouts").textContent = totalWorkouts;
      document.getElementById("stat-total-mins").textContent = totalMins;
      document.getElementById("stat-total-kcal").textContent = totalCals;
    }
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

function setupProfileForm() {
  const form = document.getElementById("profile-form");
  const msg = document.getElementById("profile-msg");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "msg-line";
    msg.textContent = "";

    const weight = parseFloat(document.getElementById("profile-weight").value);
    const dailyGoal = parseFloat(document.getElementById("profile-goal").value);

    if (isNaN(weight) || weight < 20 || weight > 300) {
      msg.className = "msg-line msg-error";
      msg.textContent = "Weight must be between 20 and 300 kg.";
      return;
    }
    if (isNaN(dailyGoal) || dailyGoal < 100 || dailyGoal > 10000) {
      msg.className = "msg-line msg-error";
      msg.textContent = "Daily goal must be between 100 and 10000 kcal.";
      return;
    }

    try {
      const updated = await api("/api/me", {
        method: "PUT",
        body: JSON.stringify({ weight, dailyGoal })
      });
      if (updated) {
        currentUser = updated;
        msg.className = "msg-line msg-success";
        msg.textContent = "Profile updated.";
        updateUserProfileUI(updated);
        loadProfile();
      }
    } catch (err) {
      msg.className = "msg-line msg-error";
      msg.textContent = err.message || "Failed to update profile.";
    }
  });
}

function updateUserProfileUI(user) {
  if (!user) return;
  const initials = getInitials(user.username);
  const weightText = `${user.weight} kg`;

  // Desktop sidebar
  document.getElementById("user-display-name").textContent = user.username;
  document.getElementById("user-display-weight").textContent = weightText;
  document.getElementById("user-initials").textContent = initials;

  // Mobile drawer
  const mUser = document.getElementById("mobile-user-name");
  const mWeight = document.getElementById("mobile-user-weight");
  const mInitials = document.getElementById("mobile-user-initials");
  if (mUser) mUser.textContent = user.username;
  if (mWeight) mWeight.textContent = weightText;
  if (mInitials) mInitials.textContent = initials;
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
      updateUserProfileUI(currentUser);
    }
  } catch (err) {
    console.error("Failed to fetch user profile:", err);
  }

  // Nav buttons event listeners (Desktop & Mobile)
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.view);
    });
  });

  // Mobile hamburger menu toggle
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileDrawer = document.getElementById("mobile-menu-drawer");
  if (mobileMenuBtn && mobileDrawer) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileDrawer.classList.toggle("open");
    });
  }

  // Logout handlers
  const handleLogout = async () => {
    try {
      await api("/api/logout", { method: "POST" });
    } catch (err) {}
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.replace("login.html");
  };

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener("click", handleLogout);

  setupLogExerciseForm();
  setupPlansForms();
  setupProfileForm();

  // Load default view (Dashboard)
  switchView("dashboard");
});
