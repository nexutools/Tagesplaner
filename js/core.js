(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TagesplanerCore = api;
  }
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const STORAGE_KEY = "tagesplaner.v1";

  const TOPICS = [
    { key: "affirmationen", label: "Affirmationen" },
    { key: "meditation", label: "Meditation" },
    { key: "kaelte", label: "Kälte (Dusche / Eisbad)" },
    { key: "sport", label: "Sport" },
    { key: "lesen", label: "Lesen" },
    { key: "dankbarkeit", label: "Dankbarkeit" },
    { key: "visualisierung", label: "Visualisierung" },
  ];

  const HEALTH_TYPES = [
    "steps",
    "activeEnergy",
    "workoutMinutes",
    "distance",
    "weight",
    "bodyFatPercent",
    "muscleMass",
    "boneMass",
    "waterPercent",
    "restingHeartRate",
    "vo2max",
  ];

  const HEALTH_TYPE_ALIASES = {
    steps: "steps",
    stepcount: "steps",
    hkquantitytypeidentifierstepcount: "steps",
    activeenergy: "activeEnergy",
    activeenergyburned: "activeEnergy",
    hkquantitytypeidentifieractiveenergyburned: "activeEnergy",
    workoutminutes: "workoutMinutes",
    workout: "workoutMinutes",
    workouts: "workoutMinutes",
    distance: "distance",
    distancewalkingrunning: "distance",
    hkquantitytypeidentifierdistancewalkingrunning: "distance",
    weight: "weight",
    bodymass: "weight",
    hkquantitytypeidentifierbodymass: "weight",
    bodyfatpercent: "bodyFatPercent",
    bodyfatpercentage: "bodyFatPercent",
    hkquantitytypeidentifierbodyfatpercentage: "bodyFatPercent",
    musclemass: "muscleMass",
    leanbodymass: "muscleMass",
    hkquantitytypeidentifierleanbodymass: "muscleMass",
    bonemass: "boneMass",
    hkquantitytypeidentifierbonemass: "boneMass",
    waterpercent: "waterPercent",
    hkquantitytypeidentifierbodywaterpercentage: "waterPercent",
    restingheartrate: "restingHeartRate",
    hkquantitytypeidentifierrestingheartrate: "restingHeartRate",
    vo2max: "vo2max",
    hkquantitytypeidentifiervo2max: "vo2max",
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function todayISO(now) {
    return toISODate(now || new Date());
  }

  function parseISODate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function addDaysISO(iso, days) {
    const d = parseISODate(iso);
    if (!d) return null;
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  function daysBetween(fromISO, toISO) {
    const a = parseISODate(fromISO);
    const b = parseISODate(toISO);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  }

  function rangeDates(fromISO, toISO) {
    const out = [];
    const n = daysBetween(fromISO, toISO);
    for (let i = 0; i <= n; i++) out.push(addDaysISO(fromISO, i));
    return out;
  }

  function emptyStore() {
    return { version: 1, checkins: {}, journal: {}, health: [] };
  }

  function loadStore(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw);
      return {
        version: 1,
        checkins: parsed.checkins && typeof parsed.checkins === "object" ? parsed.checkins : {},
        journal: parsed.journal && typeof parsed.journal === "object" ? parsed.journal : {},
        health: Array.isArray(parsed.health) ? parsed.health : [],
      };
    } catch (e) {
      return emptyStore();
    }
  }

  function saveStore(storage, store) {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function isTopic(key) {
    return TOPICS.some((t) => t.key === key);
  }

  function setCheckin(store, date, topicKey, done) {
    if (!isTopic(topicKey)) throw new Error("Unbekanntes Thema: " + topicKey);
    if (!parseISODate(date)) throw new Error("Ungültiges Datum: " + date);
    if (!store.checkins[date]) store.checkins[date] = {};
    if (done) store.checkins[date][topicKey] = true;
    else delete store.checkins[date][topicKey];
    if (Object.keys(store.checkins[date]).length === 0) delete store.checkins[date];
    return store;
  }

  function toggleCheckin(store, date, topicKey) {
    const current = !!(store.checkins[date] && store.checkins[date][topicKey]);
    return setCheckin(store, date, topicKey, !current);
  }

  function getCheckin(store, date, topicKey) {
    return !!(store.checkins[date] && store.checkins[date][topicKey]);
  }

  function setJournal(store, date, text) {
    if (!parseISODate(date)) throw new Error("Ungültiges Datum: " + date);
    if (text && text.trim()) store.journal[date] = text;
    else delete store.journal[date];
    return store;
  }

  function normalizeType(raw) {
    if (raw === undefined || raw === null) return null;
    const key = String(raw).trim().toLowerCase().replace(/[\s_]+/g, "");
    return HEALTH_TYPE_ALIASES[key] || null;
  }

  function normalizeDate(raw) {
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim();
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    if (m && parseISODate(m[1])) return m[1];
    const d = new Date(s);
    if (!isNaN(d.getTime())) return toISODate(d);
    return null;
  }

  function makeSample(raw) {
    if (!raw || typeof raw !== "object") return null;
    const type = normalizeType(raw.type || raw.kind || raw.identifier);
    const date = normalizeDate(raw.date || raw.startDate || raw.start);
    const value = Number(raw.value);
    if (!type || !date || !isFinite(value)) return null;
    return { date: date, type: type, value: value, unit: raw.unit ? String(raw.unit) : "" };
  }

  function parseHealthJSON(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { samples: [], errors: ["Kein gültiges JSON: " + e.message] };
    }
    let arr;
    if (Array.isArray(data)) arr = data;
    else if (Array.isArray(data.samples)) arr = data.samples;
    else if (Array.isArray(data.records)) arr = data.records;
    else arr = [data];
    const samples = [];
    const errors = [];
    arr.forEach((item, i) => {
      if (item && Array.isArray(item.samples)) {
        item.samples.forEach((s) => {
          const m = makeSample(Object.assign({}, s, { type: s.type || item.type }));
          if (m) samples.push(m);
          else errors.push("Eintrag " + i + " ( verschachtelt )");
        });
      } else {
        const m = makeSample(item);
        if (m) samples.push(m);
        else errors.push("Eintrag " + (i + 1) + ": " + JSON.stringify(item).slice(0, 80));
      }
    });
    return { samples: samples, errors: errors };
  }

  function parseHealthCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { samples: [], errors: ["Leere Eingabe"] };
    const header = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
    const idx = {
      date: header.findIndex((h) => h === "date" || h === "datum"),
      type: header.findIndex((h) => h === "type" || h === "typ" || h === "metric"),
      value: header.findIndex((h) => h === "value" || h === "wert"),
      unit: header.findIndex((h) => h === "unit" || h === "einheit"),
    };
    if (idx.date < 0 || idx.type < 0 || idx.value < 0) {
      return { samples: [], errors: ["CSV-Header benötigt: date,type,value[,unit]"] };
    }
    const samples = [];
    const errors = [];
    lines.slice(1).forEach((line, i) => {
      const cols = line.split(/[;,]/);
      const m = makeSample({
        date: cols[idx.date],
        type: cols[idx.type],
        value: cols[idx.value],
        unit: idx.unit >= 0 ? cols[idx.unit] : "",
      });
      if (m) samples.push(m);
      else errors.push("Zeile " + (i + 2));
    });
    return { samples: samples, errors: errors };
  }

  function parseHealth(text) {
    const t = String(text).trim();
    if (t.startsWith("[") || t.startsWith("{")) return parseHealthJSON(t);
    return parseHealthCSV(t);
  }

  function sampleKey(s) {
    return s.date + "|" + s.type + "|" + s.value + "|" + s.unit;
  }

  function addHealthSamples(store, samples) {
    const existing = new Set(store.health.map(sampleKey));
    let added = 0;
    let skipped = 0;
    for (const s of samples) {
      const k = sampleKey(s);
      if (existing.has(k)) {
        skipped++;
        continue;
      }
      store.health.push(s);
      existing.add(k);
      added++;
    }
    store.health.sort((a, b) => (a.date + "|" + a.type).localeCompare(b.date + "|" + b.type));
    return { added: added, skipped: skipped };
  }

  function rangeClamped(fromISO, toISO, asOfISO) {
    const to = toISO <= asOfISO ? toISO : asOfISO;
    return rangeDates(fromISO, to);
  }

  function completion(store, topicKey, fromISO, toISO, asOfISO) {
    const asOf = asOfISO || todayISO();
    const days = rangeClamped(fromISO, toISO, asOf);
    let done = 0;
    for (const d of days) if (getCheckin(store, d, topicKey)) done++;
    return {
      done: done,
      total: days.length,
      percent: days.length ? Math.round((done / days.length) * 100) : 0,
    };
  }

  function streak(store, topicKey, asOfISO) {
    const today = asOfISO || todayISO();
    let start = getCheckin(store, today, topicKey) ? today : addDaysISO(today, -1);
    if (!getCheckin(store, start, topicKey)) return 0;
    let s = 0;
    let d = start;
    while (getCheckin(store, d, topicKey)) {
      s++;
      d = addDaysISO(d, -1);
    }
    return s;
  }

  function dailyCompletion(store, date) {
    const done = TOPICS.filter((t) => getCheckin(store, date, t.key)).length;
    return {
      done: done,
      total: TOPICS.length,
      percent: Math.round((done / TOPICS.length) * 100),
    };
  }

  function weekKey(iso) {
    const d = parseISODate(iso);
    if (!d) return iso;
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return toISODate(d);
  }

  function weightSeries(store, fromISO, toISO) {
    const byDay = {};
    for (const s of store.health) {
      if (s.type !== "weight") continue;
      if (fromISO && s.date < fromISO) continue;
      if (toISO && s.date > toISO) continue;
      byDay[s.date] = s.value;
    }
    return Object.keys(byDay)
      .sort()
      .map((d) => ({ date: d, value: byDay[d] }));
  }

  function weightStats(store) {
    const series = weightSeries(store);
    if (!series.length) return null;
    const values = series.map((p) => p.value);
    return {
      count: series.length,
      first: series[0],
      last: series[series.length - 1],
      delta: Math.round((series[series.length - 1].value - series[0].value) * 100) / 100,
      min: Math.min.apply(null, values),
      max: Math.max.apply(null, values),
    };
  }

  function sportSummary(store, fromISO, toISO) {
    const totals = { steps: 0, activeEnergy: 0, workoutMinutes: 0, workouts: 0, distance: 0 };
    const perWeek = {};
    for (const s of store.health) {
      if (fromISO && s.date < fromISO) continue;
      if (toISO && s.date > toISO) continue;
      const wk = weekKey(s.date);
      if (!perWeek[wk]) {
        perWeek[wk] = { steps: 0, activeEnergy: 0, workoutMinutes: 0, workouts: 0, distance: 0 };
      }
      if (s.type === "steps") {
        totals.steps += s.value;
        perWeek[wk].steps += s.value;
      } else if (s.type === "activeEnergy") {
        totals.activeEnergy += s.value;
        perWeek[wk].activeEnergy += s.value;
      } else if (s.type === "workoutMinutes") {
        totals.workoutMinutes += s.value;
        totals.workouts += 1;
        perWeek[wk].workoutMinutes += s.value;
        perWeek[wk].workouts += 1;
      } else if (s.type === "distance") {
        totals.distance += s.value;
        perWeek[wk].distance += s.value;
      }
    }
    const weeks = Object.keys(perWeek)
      .sort()
      .map((wk) => Object.assign({ week: wk }, perWeek[wk]));
    return { totals: totals, weeks: weeks };
  }

  function aggregate(store, days, asOfISO) {
    const asOf = asOfISO || todayISO();
    const from = addDaysISO(asOf, -(days - 1));
    const topics = TOPICS.map((t) => {
      const c = completion(store, t.key, from, asOf, asOf);
      return {
        key: t.key,
        label: t.label,
        done: c.done,
        total: c.total,
        percent: c.percent,
        streak: streak(store, t.key, asOf),
      };
    });
    topics.sort((a, b) => b.percent - a.percent || b.streak - a.streak);
    return {
      from: from,
      to: asOf,
      days: days,
      topics: topics,
      daily: dailyCompletion(store, asOf),
      weight: weightStats(store),
      weightSeries: weightSeries(store, from, asOf),
      sport: sportSummary(store, from, asOf),
      journalDays: Object.keys(store.journal).filter((d) => d >= from && d <= asOf).length,
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    TOPICS: TOPICS,
    HEALTH_TYPES: HEALTH_TYPES,
    toISODate: toISODate,
    todayISO: todayISO,
    parseISODate: parseISODate,
    addDaysISO: addDaysISO,
    daysBetween: daysBetween,
    rangeDates: rangeDates,
    emptyStore: emptyStore,
    loadStore: loadStore,
    saveStore: saveStore,
    isTopic: isTopic,
    setCheckin: setCheckin,
    toggleCheckin: toggleCheckin,
    getCheckin: getCheckin,
    setJournal: setJournal,
    normalizeType: normalizeType,
    normalizeDate: normalizeDate,
    makeSample: makeSample,
    parseHealthJSON: parseHealthJSON,
    parseHealthCSV: parseHealthCSV,
    parseHealth: parseHealth,
    addHealthSamples: addHealthSamples,
    completion: completion,
    streak: streak,
    dailyCompletion: dailyCompletion,
    weekKey: weekKey,
    weightSeries: weightSeries,
    weightStats: weightStats,
    sportSummary: sportSummary,
    aggregate: aggregate,
  };
});
