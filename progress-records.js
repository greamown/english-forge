// Learning records keyed by item: {key: {...fields, at}}. `at` is when that item last changed (ms).
// A record holding only `at` marks a removal, so undoing progress syncs too.
// Merging keeps the newer record per key, so devices can sync in any order without erasing each other.
// ponytail: device clocks decide "newer"; a device with a badly skewed clock can win an edit it shouldn't.
var ProgressRecords = (() => {
  const isRecord = (r) => !!r && typeof r === "object" && !Array.isArray(r) && Number.isFinite(r.at);
  const sameFields = (a = {}, b = {}) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.delete("at");
    return [...keys].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  };
  const newer = (a, b) => a.at > b.at || (a.at === b.at && JSON.stringify(a) > JSON.stringify(b));
  return {
    // Records for `current` ({key: fields}); keys whose fields changed, or vanished, are stamped with `now`.
    stamp(records, current, now = Date.now()) {
      const out = { ...records };
      for (const [key, fields] of Object.entries(current)) if (!sameFields(records[key], fields)) out[key] = { ...fields, at: now };
      for (const key of Object.keys(records)) if (!(key in current) && !sameFields(records[key], {})) out[key] = { at: now };
      return out;
    },
    merge(a, b) {
      const out = { ...a };
      for (const [key, record] of Object.entries(b)) if (!out[key] || newer(record, out[key])) out[key] = record;
      return out;
    },
    equal(a, b) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((k) => b[k] && a[k].at === b[k].at && sameFields(a[k], b[k]));
    },
    // Untrusted input (storage, cloud, files) -> records; malformed entries are dropped.
    clean(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([key, r]) => key && isRecord(r)));
    },
    // {key: record} without removal markers.
    live(records) {
      return Object.fromEntries(Object.entries(records).filter(([, r]) => Object.keys(r).length > 1));
    },
    latest(records) {
      return Object.values(records).reduce((max, r) => Math.max(max, r.at), 0);
    },
  };
})();
if (typeof module === "object") module.exports = ProgressRecords;
