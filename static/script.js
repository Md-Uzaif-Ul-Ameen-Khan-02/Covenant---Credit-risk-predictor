(() => {
  const form = document.getElementById("riskForm");
  const submitBtn = document.getElementById("submitBtn");
  const errorNote = document.getElementById("errorNote");
  const verdict = document.getElementById("verdict");

  const incomeInput = document.getElementById("person_income");
  const amountInput = document.getElementById("loan_amnt");
  const percentInput = document.getElementById("loan_percent_income");

  const sealBadge = document.getElementById("sealBadge");
  const sealMark = document.getElementById("sealMark");
  const sealLabel = document.getElementById("sealLabel");

  const scaleMarker = document.getElementById("scaleMarker");
  const scaleThreshold = document.getElementById("scaleThreshold");

  const factProb = document.getElementById("factProb");
  const factThreshold = document.getElementById("factThreshold");
  const factResult = document.getElementById("factResult");

  const apiDot = document.getElementById("apiDot");
  const apiStatusText = document.getElementById("apiStatusText");

  const CHECK_PATH = "M21 33 L28 40 L44 24";
  const CROSS_PATH = "M23 23 L41 41 M41 23 L23 41";

  // ---------- Auto-calculate loan-to-income ratio ----------
  function recalcPercent() {
    const income = parseFloat(incomeInput.value);
    const amount = parseFloat(amountInput.value);
    if (income > 0 && amount >= 0) {
      percentInput.value = (amount / income).toFixed(2);
    }
  }
  incomeInput.addEventListener("input", recalcPercent);
  amountInput.addEventListener("input", recalcPercent);
  recalcPercent();

  // ---------- Service status check ----------
  fetch("/openapi.json", { method: "GET" })
    .then((res) => {
      if (res.ok) {
        apiDot.classList.add("ok");
        apiStatusText.textContent = "service ready";
      } else {
        throw new Error("bad status");
      }
    })
    .catch(() => {
      apiDot.classList.add("down");
      apiStatusText.textContent = "service unreachable";
    });

  // ---------- Section rail: scroll-spy navigation ----------
  const railItems = Array.from(document.querySelectorAll(".rail__item"));
  const sections = railItems
    .map((item) => document.getElementById(item.dataset.target))
    .filter(Boolean);

  if (sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            railItems.forEach((item) => item.classList.remove("active"));
            const active = railItems.find((i) => i.dataset.target === entry.target.id);
            if (active) active.classList.add("active");
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
  }

  railItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(item.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // ---------- Helpers ----------
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
    submitBtn.querySelector(".btn-label").textContent = isLoading
      ? "Reviewing application…"
      : "Assess application";
  }

  function showError(message) {
    errorNote.textContent = message;
    errorNote.hidden = false;
  }

  function clearError() {
    errorNote.hidden = true;
    errorNote.textContent = "";
  }

  function renderVerdict(data) {
    const probabilityPct = data.default_probability * 100;
    const thresholdPct = data.threshold * 100;
    const isHighRisk = data.default_prediction === 1;

    verdict.hidden = false;
    verdict.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Scale bar
    scaleThreshold.style.left = `${thresholdPct}%`;
    scaleMarker.classList.toggle("risk-high", isHighRisk);
    requestAnimationFrame(() => {
      scaleMarker.style.left = `${probabilityPct}%`;
    });

    // Seal
    sealBadge.classList.remove("stamp-in", "risk-high");
    void sealBadge.offsetWidth; // restart animation
    sealMark.setAttribute("d", isHighRisk ? CROSS_PATH : CHECK_PATH);
    sealLabel.textContent = isHighRisk ? "High risk" : "Low risk";
    if (isHighRisk) sealBadge.classList.add("risk-high");
    requestAnimationFrame(() => sealBadge.classList.add("stamp-in"));

    // Facts
    factProb.textContent = `${probabilityPct.toFixed(1)}%`;
    factThreshold.textContent = `${thresholdPct.toFixed(1)}%`;
    factResult.textContent = data.Result;
  }

  // ---------- Submit ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    const payload = {
      person_age: parseInt(document.getElementById("person_age").value, 10),
      person_income: parseFloat(incomeInput.value),
      person_home_ownership: document.getElementById("person_home_ownership").value,
      person_emp_length: parseFloat(document.getElementById("person_emp_length").value),
      loan_intent: document.getElementById("loan_intent").value,
      loan_grade: document.getElementById("loan_grade").value,
      loan_amnt: parseFloat(amountInput.value),
      loan_int_rate: parseFloat(document.getElementById("loan_int_rate").value),
      loan_percent_income: parseFloat(percentInput.value),
      cb_person_default_on_file: document.getElementById("cb_person_default_on_file").value,
      cb_person_cred_hist_length: parseInt(document.getElementById("cb_person_cred_hist_length").value, 10),
    };

    try {
      const res = await fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body && body.detail ? JSON.stringify(body.detail) : `HTTP ${res.status}`;
        throw new Error(detail);
      }

      const data = await res.json();
      renderVerdict(data);
    } catch (err) {
      showError(`Could not reach Covenant. ${err.message || "Check the service is running."}`);
    } finally {
      setLoading(false);
    }
  });
})();
