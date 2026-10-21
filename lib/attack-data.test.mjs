import assert from "node:assert/strict";
import test from "node:test";
import {
  getRadarLocationCodes,
  InvalidRadarDataError,
  isAttackSnapshot,
  normalizeRadarSnapshot,
} from "./attack-data.ts";

const pairPayload = {
  success: true,
  result: {
    meta: {
      dateRange: [
        {
          startTime: "2026-10-16T00:00:00Z",
          endTime: "2026-10-17T00:00:00Z",
        },
      ],
      lastUpdated: "2026-10-17T00:00:00Z",
      normalization: "PERCENTAGE",
      units: [{ name: "*", value: "requests" }],
    },
    top_0: [
      {
        originCountryAlpha2: "US",
        originCountryName: "United States",
        targetCountryAlpha2: "FR",
        targetCountryName: "France",
        value: "4.323214",
      },
      {
        originCountryAlpha2: "DE",
        originCountryName: "Germany",
        targetCountryAlpha2: "DE",
        targetCountryName: "Germany",
        value: "0.75",
      },
      {
        originCountryAlpha2: "JP",
        originCountryName: "Japan",
        targetCountryAlpha2: "CA",
        targetCountryName: "Canada",
        value: "101",
      },
    ],
  },
};

const locationPayload = {
  success: true,
  result: {
    locations: [
      { alpha2: "US", latitude: "37.0902", longitude: "-95.7129" },
      { alpha2: "FR", latitude: "46.2276", longitude: "2.2137" },
      { alpha2: "DE", latitude: "51.1657", longitude: "10.4515" },
    ],
  },
};

test("normalizes pair percentages, metadata, and country coordinates", () => {
  const snapshot = normalizeRadarSnapshot(
    pairPayload,
    [locationPayload],
    "1d",
    "2026-10-17T00:05:00Z",
  );

  assert.equal(snapshot.normalization, "PERCENTAGE");
  assert.equal(snapshot.units[0], "requests");
  assert.equal(snapshot.window.startTime, "2026-10-16T00:00:00Z");
  assert.equal(snapshot.lastUpdated, "2026-10-17T00:00:00Z");
  assert.equal(snapshot.fetchedAt, "2026-10-17T00:05:00Z");
  assert.equal(snapshot.routes.length, 2);
  assert.equal(snapshot.routes[0].percent, 4.323214);
  assert.deepEqual(snapshot.routes[0].origin, {
    code: "US",
    name: "United States",
    latitude: 37.0902,
    longitude: -95.7129,
  });
  assert.equal(snapshot.routes[0].sameCountry, false);
  assert.equal(snapshot.routes[1].sameCountry, true);
  assert.equal(snapshot.routes[1].percent, 0.75);
  assert.equal(isAttackSnapshot(snapshot), true);
});

test("rejects malformed client snapshots", () => {
  const snapshot = normalizeRadarSnapshot(
    pairPayload,
    [locationPayload],
    "1d",
    "2026-10-17T00:05:00Z",
  );
  snapshot.routes[0].origin.latitude = 91;

  assert.equal(isAttackSnapshot(snapshot), false);
});

test("keeps valid routes without coordinates and requests only relevant locations", () => {
  const snapshot = normalizeRadarSnapshot(
    pairPayload,
    [{ success: true, result: { locations: [] } }],
    "7d",
    "2026-10-17T00:05:00Z",
  );

  assert.equal(snapshot.range, "7d");
  assert.equal(snapshot.routes[0].origin.latitude, null);
  assert.equal(snapshot.routes[0].target.longitude, null);
  assert.deepEqual(getRadarLocationCodes(pairPayload), ["US", "FR", "DE"]);
});

test("merges country coordinates from multiple lookup batches", () => {
  const snapshot = normalizeRadarSnapshot(
    pairPayload,
    [
      { success: true, result: { locations: locationPayload.result.locations.slice(0, 2) } },
      { success: true, result: { locations: locationPayload.result.locations.slice(2) } },
    ],
    "1d",
    "2026-10-17T00:05:00Z",
  );

  assert.equal(snapshot.routes[0].origin.latitude, 37.0902);
  assert.equal(snapshot.routes[1].origin.latitude, 51.1657);
});

test("rejects response data with a different normalization", () => {
  const wrongNormalization = structuredClone(pairPayload);
  wrongNormalization.result.meta.normalization = "RAW_VALUES";

  assert.throws(
    () =>
      normalizeRadarSnapshot(
        wrongNormalization,
        [locationPayload],
        "1d",
        "2026-10-17T00:05:00Z",
      ),
    InvalidRadarDataError,
  );
});

test("rejects an invalid time window", () => {
  const invalidWindow = structuredClone(pairPayload);
  invalidWindow.result.meta.dateRange[0].startTime = "not-a-timestamp";

  assert.throws(
    () =>
      normalizeRadarSnapshot(
        invalidWindow,
        [locationPayload],
        "1d",
        "2026-10-17T00:05:00Z",
      ),
    InvalidRadarDataError,
  );
});

test("accepts empty pair results without country lookups", () => {
  const payload = structuredClone(pairPayload);
  payload.result.top_0 = [];
  const snapshot = normalizeRadarSnapshot(payload, [], "1d", "2026-10-17T00:05:00Z");

  assert.deepEqual(snapshot.routes, []);
  assert.deepEqual(getRadarLocationCodes(payload), []);
  assert.equal(isAttackSnapshot(snapshot), true);
});

test("caps normalized routes at 40 and rejects oversized browser snapshots", () => {
  const payload = structuredClone(pairPayload);
  payload.result.top_0 = Array.from({ length: 41 }, () => payload.result.top_0[0]);
  const snapshot = normalizeRadarSnapshot(payload, [], "1d", "2026-10-17T00:05:00Z");

  assert.equal(snapshot.routes.length, 40);
  assert.equal(new Set(snapshot.routes.map((route) => route.id)).size, 40);
  assert.equal(isAttackSnapshot(snapshot), true);
  snapshot.routes.push(snapshot.routes[0]);
  assert.equal(isAttackSnapshot(snapshot), false);
});

test("rejects nonempty responses with no valid percentage rows", () => {
  for (const value of ["", " ", "-1", "100.01", "NaN", "Infinity", "1e2", "4%", 4, null]) {
    const payload = structuredClone(pairPayload);
    payload.result.top_0 = [{ ...payload.result.top_0[0], value }];
    assert.throws(
      () => normalizeRadarSnapshot(payload, [], "1d", "2026-10-17T00:05:00Z"),
      InvalidRadarDataError,
      `Invalid percentage: ${String(value)}`,
    );
  }
});

test("preserves zero and 100 percent without rescaling", () => {
  const payload = structuredClone(pairPayload);
  payload.result.top_0 = [
    { ...payload.result.top_0[0], value: "0" },
    { ...payload.result.top_0[1], value: "100" },
  ];
  const snapshot = normalizeRadarSnapshot(payload, [], "1d", "2026-10-17T00:05:00Z");

  assert.deepEqual(snapshot.routes.map((route) => route.percent), [0, 100]);
  assert.equal(isAttackSnapshot(snapshot), true);
  for (const percent of [-1, 100.01, NaN, Infinity, "4"]) {
    const invalid = structuredClone(snapshot);
    invalid.routes[0].percent = percent;
    assert.equal(isAttackSnapshot(invalid), false);
  }
});

test("rejects zero and reversed reporting windows at both boundaries", () => {
  for (const endTime of ["2026-10-16T00:00:00Z", "2026-10-15T00:00:00Z"]) {
    const payload = structuredClone(pairPayload);
    payload.result.meta.dateRange[0].endTime = endTime;
    assert.throws(
      () => normalizeRadarSnapshot(payload, [], "1d", "2026-10-17T00:05:00Z"),
      InvalidRadarDataError,
    );
    const snapshot = normalizeRadarSnapshot(pairPayload, [], "1d", "2026-10-17T00:05:00Z");
    snapshot.window.endTime = endTime;
    assert.equal(isAttackSnapshot(snapshot), false);
  }
});

test("keeps routes unmapped when coordinate strings are invalid", () => {
  for (const [latitude, longitude] of [
    ["", "2"], ["46", " "], ["91", "2"], ["46", "181"],
    ["NaN", "2"], ["46", "Infinity"], [null, "2"], ["46", 2],
  ]) {
    const locations = {
      success: true,
      result: { locations: [{ alpha2: "US", latitude, longitude }] },
    };
    const snapshot = normalizeRadarSnapshot(pairPayload, [locations], "1d", "2026-10-17T00:05:00Z");

    assert.equal(snapshot.routes.length, 2);
    assert.equal(snapshot.routes[0].origin.latitude, null, `Latitude: ${String(latitude)}`);
    assert.equal(snapshot.routes[0].origin.longitude, null, `Longitude: ${String(longitude)}`);
    assert.equal(isAttackSnapshot(snapshot), true);
  }
});

test("accepts explicit zero and geographic coordinate limits", () => {
  for (const [latitude, longitude] of [["0", "0"], ["90", "180"], ["-90", "-180"]]) {
    const locations = {
      success: true,
      result: { locations: [{ alpha2: "US", latitude, longitude }] },
    };
    const snapshot = normalizeRadarSnapshot(pairPayload, [locations], "1d", "2026-10-17T00:05:00Z");

    assert.equal(snapshot.routes[0].origin.latitude, Number(latitude));
    assert.equal(snapshot.routes[0].origin.longitude, Number(longitude));
    assert.equal(isAttackSnapshot(snapshot), true);
  }
});

test("rejects malformed country codes and inconsistent same-country flags", () => {
  for (const code of ["us", "USA", "", "1A", null]) {
    const payload = structuredClone(pairPayload);
    payload.result.top_0 = [{ ...payload.result.top_0[0], originCountryAlpha2: code }];
    assert.throws(
      () => normalizeRadarSnapshot(payload, [], "1d", "2026-10-17T00:05:00Z"),
      InvalidRadarDataError,
    );
  }
  const snapshot = normalizeRadarSnapshot(pairPayload, [], "1d", "2026-10-17T00:05:00Z");
  snapshot.routes[0].sameCountry = true;
  assert.equal(isAttackSnapshot(snapshot), false);
});

test("rejects unsuccessful provider envelopes and invalid fetch times", () => {
  for (const payload of [null, {}, { success: false }, { success: true, result: {} }]) {
    assert.throws(
      () => normalizeRadarSnapshot(payload, [], "1d", "2026-10-17T00:05:00Z"),
      InvalidRadarDataError,
    );
    assert.equal(isAttackSnapshot(payload), false);
  }
  assert.throws(
    () => normalizeRadarSnapshot(pairPayload, [], "1d", "not-a-time"),
    InvalidRadarDataError,
  );
});
