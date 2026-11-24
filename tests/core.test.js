const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../js/core.js");

const AS_OF = "2025-06-10";

test("Datumshilfen", () => {
  assert.equal(core.todayISO(new Date(2025, 5, 10)), "2025-06-10");
  assert.equal(core.addDaysISO("2025-06-10", -1), "2025-06-09");
  assert.equal(core.addDaysISO("2025-02-28", 1), "2025-03-01");
  assert.equal(core.daysBetween("2025-06-01", "2025-06-10"), 9);
});

test("Checkin setzen, toggeln, leeren Tag entfernen", () => {
  const s = core.emptyStore();
  core.setCheckin(s, AS_OF, "sport", true);
  assert.equal(core.getCheckin(s, AS_OF, "sport"), true);
  core.toggleCheckin(s, AS_OF, "sport");
  assert.equal(core.getCheckin(s, AS_OF, "sport"), false);
  assert.equal(s.checkins[AS_OF], undefined);
  assert.throws(() => core.setCheckin(s, AS_OF, "unbekannt", true));
  assert.throws(() => core.setCheckin(s, "kein-datum", "sport", true));
});

test("Erfüllung in Prozent, Zukunftstage werden ausgeschlossen", () => {
  const s = core.emptyStore();
  for (let i = 0; i < 7; i++) core.setCheckin(s, core.addDaysISO(AS_OF, -i), "lesen", true);
  const c = core.completion(s, "lesen", "2025-06-01", "2025-06-30", AS_OF);
  assert.equal(c.total, 10);
  assert.equal(c.done, 7);
  assert.equal(c.percent, 70);
});

test("Streak zählt rückwärts ab heute bzw. gestern", () => {
  const s = core.emptyStore();
  for (let i = 1; i <= 3; i++) core.setCheckin(s, core.addDaysISO(AS_OF, -i), "meditation", true);
  assert.equal(core.streak(s, "meditation", AS_OF), 3);
  core.setCheckin(s, AS_OF, "meditation", true);
  assert.equal(core.streak(s, "meditation", AS_OF), 4);
  assert.equal(core.streak(s, "lesen", AS_OF), 0);
});

test("Journal speichern und leeren Text löscht Eintrag", () => {
  const s = core.emptyStore();
  core.setJournal(s, AS_OF, "Heute war ein guter Tag");
  assert.equal(s.journal[AS_OF], "Heute war ein guter Tag");
  core.setJournal(s, AS_OF, "   ");
  assert.equal(s.journal[AS_OF], undefined);
});

test("Health-JSON parsen inkl. HealthKit-Aliasen, ungültige werden gemeldet", () => {
  const json = JSON.stringify([
    { date: "2025-06-10T07:00:00+02:00", type: "HKQuantityTypeIdentifierStepCount", value: 8432, unit: "count" },
    { date: "2025-06-10", type: "HKQuantityTypeIdentifierActiveEnergyBurned", value: 512, unit: "kcal" },
    { date: "2025-06-10", type: "HKQuantityTypeIdentifierBodyMass", value: 82.4, unit: "kg" },
    { date: "2025-06-10", type: "body_fat_percentage", value: 18.2, unit: "%" },
    { date: "2025-06-10", type: "irgendwas", value: 1 },
    { date: "kein-datum", type: "steps", value: 5 },
  ]);
  const res = core.parseHealth(json);
  assert.equal(res.samples.length, 4);
  assert.equal(res.errors.length, 2);
  assert.equal(res.samples[0].type, "steps");
  assert.equal(res.samples[0].date, "2025-06-10");
  assert.equal(res.samples[2].type, "weight");
  assert.equal(res.samples[3].type, "bodyFatPercent");
});

test("Health-CSV parsen", () => {
  const csv = "date,type,value,unit\n2025-06-10,steps,8000,count\n2025-06-10,weight,82.4,kg\n2025-06-11,unbekannt,1,x";
  const res = core.parseHealth(csv);
  assert.equal(res.samples.length, 2);
  assert.equal(res.errors.length, 1);
  assert.equal(res.samples[1].type, "weight");
});

test("Import dedupliziert exakte Duplikate", () => {
  const s = core.emptyStore();
  const samples = [
    { date: "2025-06-10", type: "weight", value: 82.4, unit: "kg" },
    { date: "2025-06-10", type: "steps", value: 8000, unit: "count" },
  ];
  let r = core.addHealthSamples(s, samples);
  assert.deepEqual(r, { added: 2, skipped: 0 });
  r = core.addHealthSamples(s, samples);
  assert.deepEqual(r, { added: 0, skipped: 2 });
});

test("Gewichtsreihe: letzter Wert pro Tag, Statistik mit Delta", () => {
  const s = core.emptyStore();
  core.addHealthSamples(s, [
    { date: "2025-06-01", type: "weight", value: 84.0, unit: "kg" },
    { date: "2025-06-05", type: "weight", value: 83.1, unit: "kg" },
    { date: "2025-06-05", type: "weight", value: 83.2, unit: "kg" },
    { date: "2025-06-10", type: "weight", value: 82.6, unit: "kg" },
    { date: "2025-06-10", type: "bodyFatPercent", value: 18.0, unit: "%" },
  ]);
  const series = core.weightSeries(s, "2025-06-01", AS_OF);
  assert.deepEqual(series.map((p) => p.value), [84.0, 83.2, 82.6]);
  const stats = core.weightStats(s);
  assert.equal(stats.delta, -1.4);
  assert.equal(stats.count, 3);
  assert.equal(stats.min, 82.6);
  assert.equal(stats.max, 84.0);
});

test("Sport-Aggregation gesamt und pro Woche (Woche beginnt Montag)", () => {
  const s = core.emptyStore();
  core.addHealthSamples(s, [
    { date: "2025-06-09", type: "activeEnergy", value: 300, unit: "kcal" },
    { date: "2025-06-10", type: "activeEnergy", value: 200, unit: "kcal" },
    { date: "2025-06-10", type: "workoutMinutes", value: 30, unit: "min" },
    { date: "2025-06-10", type: "steps", value: 5000, unit: "count" },
    { date: "2025-06-02", type: "workoutMinutes", value: 45, unit: "min" },
  ]);
  const sum = core.sportSummary(s, "2025-06-01", AS_OF);
  assert.equal(sum.totals.activeEnergy, 500);
  assert.equal(sum.totals.workoutMinutes, 75);
  assert.equal(sum.totals.workouts, 2);
  assert.equal(sum.totals.steps, 5000);
  assert.equal(sum.weeks.length, 2);
  const current = sum.weeks.find((w) => w.week === "2025-06-09");
  assert.equal(current.activeEnergy, 500);
  assert.equal(current.workouts, 1);
  assert.equal(current.workoutMinutes, 30);
});

test("aggregate sortiert Themen nach Erfüllung und rechnet Zeitraum", () => {
  const s = core.emptyStore();
  for (let i = 0; i < 10; i++) core.setCheckin(s, core.addDaysISO(AS_OF, -i), "lesen", true);
  for (let i = 0; i < 5; i++) core.setCheckin(s, core.addDaysISO(AS_OF, -i), "sport", true);
  const agg = core.aggregate(s, 10, AS_OF);
  assert.equal(agg.from, "2025-06-01");
  assert.equal(agg.to, AS_OF);
  assert.equal(agg.topics[0].key, "lesen");
  assert.equal(agg.topics[0].percent, 100);
  assert.equal(agg.topics[0].streak, 10);
  assert.equal(agg.daily.total, 7);
});

test("loadStore mit kaputten Daten liefert leeren Store", () => {
  const fake = { getItem: () => "{kaputt", setItem: () => {} };
  assert.deepEqual(core.loadStore(fake), core.emptyStore());
});

test("loadStore/saveStore roundtrip", () => {
  const mem = {};
  const fake = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = v; },
  };
  const s = core.emptyStore();
  core.setCheckin(s, AS_OF, "kaelte", true);
  core.setJournal(s, AS_OF, "Eisbad um 6 Uhr");
  core.addHealthSamples(s, [{ date: AS_OF, type: "weight", value: 80, unit: "kg" }]);
  core.saveStore(fake, s);
  const loaded = core.loadStore(fake);
  assert.equal(core.getCheckin(loaded, AS_OF, "kaelte"), true);
  assert.equal(loaded.journal[AS_OF], "Eisbad um 6 Uhr");
  assert.equal(loaded.health.length, 1);
});
