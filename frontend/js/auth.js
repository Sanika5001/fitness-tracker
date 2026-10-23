document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const authMsg = document.getElementById("auth-msg");

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("registered") === "1" && authMsg) {
    authMsg.className = "msg-line msg-success";
    authMsg.textContent = "Account created. Please log in.";
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      authMsg.className = "msg-line msg-error";
      authMsg.textContent = "";

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;

      if (!username || !password) {
        authMsg.textContent = "Please fill in all fields.";
        return;
      }

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) {
          authMsg.textContent = data.error || "Login failed.";
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("username", username);
        window.location.href = "dashboard.html";
      } catch (err) {
        authMsg.textContent = "Unable to connect to server.";
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      authMsg.className = "msg-line msg-error";
      authMsg.textContent = "";

      const username = document.getElementById("reg-username").value.trim();
      const password = document.getElementById("reg-password").value;
      const confirm = document.getElementById("reg-confirm").value;
      const weight = parseFloat(document.getElementById("reg-weight").value);

      if (!username || !password || !confirm || isNaN(weight)) {
        authMsg.textContent = "Please fill in all fields correctly.";
        return;
      }

      if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        authMsg.textContent = "Username must be 3-20 letters, numbers, or underscores.";
        return;
      }

      if (password.length < 6) {
        authMsg.textContent = "Password must be at least 6 characters.";
        return;
      }

      if (password !== confirm) {
        authMsg.textContent = "Passwords do not match.";
        return;
      }

      if (weight < 20 || weight > 300) {
        authMsg.textContent = "Weight must be between 20 and 300 kg.";
        return;
      }

      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, weight })
        });

        const data = await res.json();
        if (!res.ok) {
          authMsg.textContent = data.error || "Registration failed.";
          return;
        }

        window.location.href = "login.html?registered=1";
      } catch (err) {
        authMsg.textContent = "Unable to connect to server.";
      }
    });
  }
});
