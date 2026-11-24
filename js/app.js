(function () {
  "use strict";
  const core = window.TagesplanerCore;
  const storage = window.localStorage;
  let store = core.loadStore(storage);
  let viewDate = core.todayISO();

  const $ = (id) => document.getElementById(id);

  function save() {
    core.saveStore(storage, store);
  }

  function fmt(n) {
    return Number(n).toLocaleString("de-DE");
  }

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
      if (btn.dataset.tab === "dashboard") renderDashboard();
      if (btn.dataset.tab === "daten") renderDaten();
    });
  });

  function renderToday() {
    $("day-picker").value = viewDate;
    const dc = core.dailyCompletion(store, viewDate);
    $("day-summary").textContent =
      viewDate + " – " + dc.done + "/" + dc.total + " erledigt (" + dc.percent + " %)";
    const grid = $("topic-grid");
    grid.innerHTML = "";
    core.TOPICS.forEach((t) => {
      const done = core.getCheckin(store, viewDate, t.key);
      const btn = document.createElement("button");
      btn.className = "topic" + (done ? " done" : "");
      const check = document.createElement("span");
      check.className = "check";
      check.textContent = done ? "✓" : "";
      const label = document.createElement("span");
      label.textContent = t.label;
      btn.appendChild(check);
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        core.toggleCheckin(store, viewDate, t.key);
        save();
        renderToday();
      });
      grid.appendChild(btn);
    });
    const journal = $("journal");
    if (document.activeElement !== journal) journal.value = store.journal[viewDate] || "";
    $("journal-status").textContent = "";
  }

  $("day-picker").addEventListener("change", (e) => {
    viewDate = e.target.value || core.todayISO();
    renderToday();
  });
  $("prev-day").addEventListener("click", () => {
    viewDate = core.addDaysISO(viewDate, -1);
    renderToday();
  });
  $("next-day").addEventListener("click", () => {
    viewDate = core.addDaysISO(viewDate, 1);
    renderToday();
  });
  $("today-btn").addEventListener("click", () => {
    viewDate = core.todayISO();
    renderToday();
  });

  let journalTimer = null;
  $("journal").addEventListener("input", (e) => {
    clearTimeout(journalTimer);
    journalTimer = setTimeout(() => {
      core.setJournal(store, viewDate, e.target.value);
      save();
      $("journal-status").textContent = "Gespeichert um " + new Date().toLocaleTimeString("de-DE");
    }, 400);
  });

  function bar(label, percent, extra) {
    return (
      '<div class="bar-row"><div class="bar-label">' + label +
      (extra ? ' <span class="muted">' + extra + "</span>" : "") +
      '</div><div class="bar"><div class="bar-fill" style="width:' + percent + '%"></div></div>' +
      '<div class="bar-pct">' + percent + " %</div></div>"
    );
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function drawLineChart(svg, points) {
    svg.innerHTML = "";
    if (!points.length) return;
    const W = 560, H = 180, P = 32;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    const ys = points.map((p) => p.y);
    const min = Math.min.apply(null, ys);
    const max = Math.max.apply(null, ys);
    const span = max - min || 1;
    const x = (i) => P + (i * (W - 2 * P)) / Math.max(points.length - 1, 1);
    const y = (v) => H - P - ((v - min) / span) * (H - 2 * P);
    const tMax = svgEl("text", { x: 2, y: 14, "class": "chart-label" });
    tMax.textContent = fmt(max);
    svg.appendChild(tMax);
    const tMin = svgEl("text", { x: 2, y: H - P + 16, "class": "chart-label" });
    tMin.textContent = fmt(min);
    svg.appendChild(tMin);
    const d = points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.y).toFixed(1)).join(" ");
    svg.appendChild(svgEl("path", { d: d, fill: "none", stroke: "#38bdf8", "stroke-width": 2 }));
    const step = Math.max(1, Math.ceil(points.length / 12));
    points.forEach((p, i) => {
      svg.appendChild(svgEl("circle", { cx: x(i), cy: y(p.y), r: 3, fill: "#38bdf8" }));
      if (i % step === 0 || i === points.length - 1) {
        const tx = svgEl("text", { x: x(i), y: H - 6, "class": "chart-label", "text-anchor": "middle" });
        tx.textContent = p.x.slice(5);
        svg.appendChild(tx);
      }
    });
  }

  function drawBarChart(svg, bars) {
    svg.innerHTML = "";
    if (!bars.length) return;
    const W = 560, H = 180, P = 20;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    const max = Math.max.apply(null, bars.map((b) => b.y).concat([1]));
    const bw = (W - 2 * P) / bars.length;
    const step = Math.max(1, Math.ceil(bars.length / 14));
    bars.forEach((b, i) => {
      const h = (b.y / max) * (H - 2 * P - 14);
      svg.appendChild(
        svgEl("rect", {
          x: P + i * bw + 2,
          y: H - P - h,
          width: Math.max(bw - 4, 2),
          height: Math.max(h, 1),
          rx: 3,
          fill: "#34d399",
        })
      );
      if (i % step === 0 || i === bars.length - 1) {
        const tx = svgEl("text", {
          x: P + i * bw + bw / 2,
          y: H - 4,
          "class": "chart-label",
          "text-anchor": "middle",
        });
        tx.textContent = b.x;
        svg.appendChild(tx);
      }
    });
  }

  function renderDashboard() {
    const days = Number($("range").value);
    const agg = core.aggregate(store, days);

    $("dash-overall").innerHTML =
      '<div class="cards">' +
      '<div class="card"><div class="card-num">' + agg.daily.percent + " %</div><div class=\"card-label\">heute erledigt</div></div>" +
      '<div class="card"><div class="card-num">' + (agg.weight ? fmt(agg.weight.delta) + " kg" : "–") + '</div><div class="card-label">Gewichtsänderung gesamt</div></div>' +
      '<div class="card"><div class="card-num">' + fmt(Math.round(agg.sport.totals.activeEnergy)) + '</div><div class="card-label">aktive kcal / ' + days + " Tage</div></div>" +
      '<div class="card"><div class="card-num">' + agg.sport.totals.workouts + '</div><div class="card-label">Workouts</div></div>' +
      '<div class="card"><div class="card-num">' + fmt(Math.round(agg.sport.totals.steps)) + '</div><div class="card-label">Schritte</div></div>' +
      '<div class="card"><div class="card-num">' + agg.journalDays + '</div><div class="card-label">Journal-Tage</div></div>' +
      "</div>";

    $("dash-topics").innerHTML = agg.topics
      .map((t) => bar(t.label, t.percent, t.done + "/" + t.total + " Tage · Streak " + t.streak))
      .join("");

    const w = agg.weight;
    if (w && agg.weightSeries.length > 1) {
      $("dash-weight").innerHTML =
        "<p>Von <b>" + fmt(w.first.value) + " kg</b> (" + w.first.date + ") auf <b>" + fmt(w.last.value) +
        " kg</b> (" + w.last.date + ") – Δ " + fmt(w.delta) + " kg</p>";
      drawLineChart($("weight-chart"), agg.weightSeries.map((p) => ({ x: p.date, y: p.value })));
    } else if (w) {
      $("dash-weight").innerHTML = "<p>Aktuell: <b>" + fmt(w.last.value) + " kg</b> (" + w.last.date + ")</p>";
      $("weight-chart").innerHTML = "";
    } else {
      $("dash-weight").innerHTML = '<p class="muted">Noch keine Gewichtsdaten – Import über den Tab „Daten“.</p>';
      $("weight-chart").innerHTML = "";
    }

    const s = agg.sport;
    if (s.weeks.length) {
      $("dash-sport").innerHTML =
        "<p>" + fmt(Math.round(s.totals.workoutMinutes)) + " min Training · " + s.totals.workouts +
        " Workouts · Ø " + fmt(Math.round(s.totals.activeEnergy / days)) + " aktive kcal/Tag</p>";
      drawBarChart($("sport-chart"), s.weeks.map((wk) => ({ x: wk.week.slice(5), y: wk.activeEnergy })));
    } else {
      $("dash-sport").innerHTML = '<p class="muted">Noch keine Sportdaten – Import über den Tab „Daten“ (Kurzbefehle-Export aus Apple Health).</p>';
      $("sport-chart").innerHTML = "";
    }
  }

  $("range").addEventListener("change", renderDashboard);

  function renderDaten() {
    const days = Object.keys(store.checkins).length;
    const j = Object.keys(store.journal).length;
    $("store-stats").textContent =
      store.health.length + " Health-Messwerte · " + days + " Check-in-Tage · " + j +
      " Journal-Tage – alles lokal in diesem Browser (localStorage)";
  }

  $("import-btn").addEventListener("click", () => {
    const text = $("import-text").value.trim();
    if (!text) {
      $("import-status").textContent = "Bitte JSON/CSV einfügen oder eine Datei wählen.";
      return;
    }
    const res = core.parseHealth(text);
    if (!res.samples.length) {
      $("import-status").textContent = "Keine gültigen Daten gefunden. Fehler: " + res.errors.join("; ");
      return;
    }
    const r = core.addHealthSamples(store, res.samples);
    save();
    $("import-status").textContent =
      r.added + " Messwerte importiert, " + r.skipped + " Duplikate übersprungen." +
      (res.errors.length ? " Ungültige Einträge: " + res.errors.length : "");
    $("import-text").value = "";
    renderDaten();
  });

  $("import-file").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("import-text").value = String(reader.result);
    };
    reader.readAsText(f);
  });

  $("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tagesplaner-export-" + core.todayISO() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("wipe-btn").addEventListener("click", () => {
    if (window.confirm("Wirklich ALLE lokalen Daten löschen?")) {
      storage.removeItem(core.STORAGE_KEY);
      store = core.loadStore(storage);
      renderToday();
      renderDaten();
      $("import-status").textContent = "Alle lokalen Daten wurden gelöscht.";
    }
  });

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js");
  }

  renderToday();
})();
