const menuBtn = document.getElementById("menuBtn");
const navMenu = document.getElementById("navMenu");
const form = document.getElementById("leadForm");
const formMsg = document.getElementById("formMsg");

if (menuBtn && navMenu) {
  menuBtn.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  });

  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });
}

const revealItems = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, index) => {
      if (!entry.isIntersecting) return;
      const delay = index * 60;
      setTimeout(() => entry.target.classList.add("is-visible"), delay);
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.18 }
);

revealItems.forEach((item) => revealObserver.observe(item));

const counters = document.querySelectorAll(".stat-number");
const countObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const target = Number(el.dataset.target || "0");
      const duration = 1100;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        el.textContent = Math.floor(progress * target).toString();
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
      countObserver.unobserve(el);
    });
  },
  { threshold: 0.5 }
);

counters.forEach((counter) => countObserver.observe(counter));

if (form && formMsg) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();

    if (name.length < 2) {
      formMsg.textContent = "Digite um nome valido.";
      formMsg.style.color = "#b03030";
      return;
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      formMsg.textContent = "Digite um email valido.";
      formMsg.style.color = "#b03030";
      return;
    }

    formMsg.textContent = "Cadastro enviado com sucesso. Retorno em breve.";
    formMsg.style.color = "#0f7c63";
    form.reset();
  });
}
