/* =======================================================
   Gold Prediction AI Lite
   Author: Revvanth
   Description: Predicts Chennai Gold Trend (Rise / Dip / Flat)
   ======================================================= */

const OZT_TO_G = 31.1034768;
const ding = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_125f739d7e.mp3");

/* 🧮 Helper Functions */
function classify(deltaPct) {
  const eps = 0.10;
  if (deltaPct > eps) return "Rise";
  if (deltaPct < -eps) return "Dip";
  return "Flat";
}
function fmtPct(x) {
  return (x > 0 ? "+" : "") + x.toFixed(2) + "%";
}
function moneyINR(x) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(x);
}
function badgeClass(v) {
  return v === "Rise" ? "vb rise" : v === "Dip" ? "vb dip" : "vb flat";
}
function speakVerdict(text) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    u.lang = "en-IN";
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function showOverlay(show) {
  document.getElementById("loadingOverlay").style.display = show ? "grid" : "none";
}

/* 🌊 Ripple Effect */
function addRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.left = e.clientX - rect.left + "px";
  ripple.style.top = e.clientY - rect.top + "px";
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

/* 📸 Capture Verdict Card */
async function captureCard() {
  const node = document.getElementById("verdictCard");
  const canvas = await html2canvas(node, { backgroundColor: null, scale: 2 });
  return new Promise((resolve) =>
    canvas.toBlob(
      (b) => resolve({ blob: b, dataUrl: canvas.toDataURL("image/png") }),
      "image/png"
    )
  );
}

/* 📤 Share Verdict */
async function shareImage() {
  try {
    const { blob } = await captureCard();
    const file = new File([blob], "gold-prediction.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Gold Prediction",
        text: "Tomorrow in Chennai – auto verdict",
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gold-prediction.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (e) {
    alert("Share failed. Downloading instead.");
    document.getElementById("btnDownload").click();
  }
}

/* 🎉 Emoji Burst */
function burst(verdict) {
  const container = document.getElementById("burst");
  const emojis =
    verdict === "Rise"
      ? ["💹", "📈", "✨", "💎"]
      : verdict === "Dip"
      ? ["📉", "💨", "🧊", "⚠️"]
      : ["➖", "🔔", "🌙", "✨"];
  for (let i = 0; i < 18; i++) {
    const span = document.createElement("span");
    span.className = "burst-item";
    span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    span.style.left = 10 + Math.random() * 80 + "vw";
    span.style.top = 10 + Math.random() * 10 + "vh";
    span.style.animationDelay = Math.random() * 0.3 + "s";
    container.appendChild(span);
    setTimeout(() => span.remove(), 1400);
  }
}

/* 🔔 Sound Feedback */
function playVerdictSound(verdict) {
  const on = localStorage.getItem("soundOn") === "true";
  if (!on) return;
  if (verdict === "Rise") {
    try {
      ding.currentTime = 0;
      ding.play();
    } catch (e) {}
  }
}

/* 🎯 Confidence Calculation */
function confidenceFrom(absPct, agreeScore) {
  let conf = 40 + absPct * 55 + agreeScore;
  if (conf < 35) conf = 35;
  if (conf > 92) conf = 92;
  return Math.round(conf);
}

/* 📊 Weighted Prediction */
function computePrediction(xau1730, xau2300, inr1730, inr2300, y10_1730, y10_2300) {
  const dXAU = ((xau2300 - xau1730) / xau1730) * 100;
  const dFX = ((inr2300 - inr1730) / inr1730) * 100; // USD/INR up = gold pressure
  const d10Y = ((y10_2300 - y10_1730) / y10_1730) * 100; // 10Y up = negative for gold
  const pred = 0.55 * dXAU - 0.25 * dFX - 0.20 * d10Y;

  // agreement score
  const dir = pred > 0 ? 1 : pred < 0 ? -1 : 0;
  let agree = 0;
  if ((dXAU > 0 ? 1 : -1) === dir) agree++;
  if ((dFX < 0 ? 1 : -1) === dir) agree++; // FX inverted
  if ((d10Y < 0 ? 1 : -1) === dir) agree++; // 10Y inverted
  const agreeScore = agree >= 2 ? 5 : agree === 0 ? -5 : 0;

  return { predPct: pred, dXAU, dFX, d10Y, agreeScore };
}

/* 💬 Show Result */
function show(predPct, xau2300, inr2300, today1g, details) {
  const verdict = classify(predPct);
  const conf = confidenceFrom(Math.abs(predPct), details.agreeScore);
  const colorClass =
    verdict === "Rise"
      ? "text-danger"
      : verdict === "Flat"
      ? "text-warning"
      : "text-success";

  $("#verdictCard").show();
  $("#verdictText").attr("class", "h2 fw-bold mb-0 " + colorClass).text(verdict.toUpperCase());
  $("#verdictBadge").attr("class", badgeClass(verdict)).html(`<i class="bi bi-shield-check"></i> ${verdict}`);
  $("#confidenceText").text(`Confidence ~ ${conf}%`);
  $("#pctChange").text(fmtPct(predPct));

  const xauInrOz_2300 = xau2300 * inr2300;
  const perGram_2300 = xauInrOz_2300 / OZT_TO_G;
  const baseToday =
    today1g && !isNaN(parseFloat(today1g)) && parseFloat(today1g) > 0
      ? parseFloat(today1g)
      : perGram_2300;

  const deltaPerGram = baseToday * (predPct / 100);
  const predicted1g = baseToday * (1 + predPct / 100);
  $("#amtPerGram").text(moneyINR(deltaPerGram));
  $("#predictedPrice1g").text(moneyINR(predicted1g));

  $("#whyText").html(
    `Weighted model: <code>0.55×Δ(XAU/USD)</code> − <code>0.25×Δ(USD/INR)</code> − <code>0.20×Δ(US10Y)</code>.
     FX & 10Y act inversely to gold. Confidence includes agreement bonus.<br/>
     Signals → XAU ${fmtPct(details.dXAU)}, USD/INR ${fmtPct(details.dFX)} (inv), US10Y ${fmtPct(details.d10Y)} (inv).`
  );

  burst(verdict);
  playVerdictSound(verdict);
  speakVerdict(
    `Tomorrow in Chennai, gold is likely to ${
      verdict === "Rise" ? "rise" : verdict === "Dip" ? "dip" : "stay flat"
    }. Confidence around ${conf} percent. Predicted one gram price is ${Math.round(predicted1g)} rupees.`
  );
}

/* 🧠 Initialize UI */
function initUI() {
  document
    .querySelectorAll("[data-bs-toggle='tooltip']")
    .forEach((el) => new bootstrap.Tooltip(el));

  const toggle = document.getElementById("soundToggle");
  const saved = localStorage.getItem("soundOn");
  toggle.checked = saved === null ? true : saved === "true";
  toggle.addEventListener("change", () => localStorage.setItem("soundOn", toggle.checked));

  // Add ripple to buttons
  ["#btnPredict", "#btnDownload", "#btnShare", "#btnSpeak"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener("click", addRipple);
  });
}

/* 🚀 Main */
$(function () {
  $("#datePick").val(new Date().toISOString().slice(0, 10));
  initUI();

  $("#btnPredict").on("click", async function () {
    const xau1730 = parseFloat($("#xau1730").val());
    const xau2300 = parseFloat($("#xau2300").val());
    const inr1730 = parseFloat($("#inr1730").val());
    const inr2300 = parseFloat($("#inr2300").val());
    const y10_1730 = parseFloat($("#y10_1730").val());
    const y10_2300 = parseFloat($("#y10_2300").val());
    const today1g = $("#inr1gToday").val();

    if ([xau1730, xau2300, inr1730, inr2300, y10_1730, y10_2300].some((v) => isNaN(v) || v <= 0)) {
      alert("Enter all values: XAU/USD, USD/INR, and US 10Y for both 5:30 & 11:00 PM.");
      return;
    }

    showOverlay(true);
    try {
      const details = computePrediction(xau1730, xau2300, inr1730, inr2300, y10_1730, y10_2300);
      await new Promise((r) => setTimeout(r, 450));
      show(details.predPct, xau2300, inr2300, today1g, details);
    } catch (e) {
      alert("Prediction failed: " + e.message);
    } finally {
      showOverlay(false);
    }
  });

  $("#btnDownload").on("click", async function () {
    const { blob } = await captureCard();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gold-prediction.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("#btnShare").on("click", shareImage);

  $("#btnSpeak").on("click", function () {
    const vt = $("#verdictText").text() || "";
    if (!vt || vt === "—") {
      alert("Run a prediction first.");
      return;
    }
    speakVerdict(`Tomorrow in Chennai, gold is likely to ${vt.toLowerCase()}.`);
  });
});
