export type RadarRange = "1d" | "7d";

export type AttackRoute = {
  id: string;
  origin: {
    code: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  };
  target: {
    code: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  };
  percent: number;
  sameCountry: boolean;
};

export type AttackSnapshot = {
  range: RadarRange;
  window: {
    startTime: string;
    endTime: string;
  };
  lastUpdated: string;
  fetchedAt: string;
  normalization: "PERCENTAGE";
  units: string[];
  routes: AttackRoute[];
};

type RadarPair = {
  originCode: string;
  originName: string;
  targetCode: string;
  targetName: string;
  percent: number;
};

type RadarPairData = {
  pairs: RadarPair[];
  startTime: string;
  endTime: string;
  lastUpdated: string;
  normalization: unknown;
  units: unknown;
};

type Location = {
  latitude: number;
  longitude: number;
};

export class InvalidRadarDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRadarDataError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const isLatitude = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90);

const isLongitude = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180);

export function isAttackSnapshot(value: unknown): value is AttackSnapshot {
  if (!isRecord(value) || (value.range !== "1d" && value.range !== "7d")) {
    return false;
  }

  if (
    value.normalization !== "PERCENTAGE" ||
    !isTimestamp(value.lastUpdated) ||
    !isTimestamp(value.fetchedAt) ||
    !isRecord(value.window) ||
    !isTimestamp(value.window.startTime) ||
    !isTimestamp(value.window.endTime) ||
    Date.parse(value.window.endTime) <= Date.parse(value.window.startTime) ||
    !Array.isArray(value.units) ||
    !value.units.every((unit) => typeof unit === "string") ||
    !Array.isArray(value.routes) ||
    value.routes.length > 40
  ) {
    return false;
  }

  return value.routes.every((route) => {
    if (
      !isRecord(route) ||
      typeof route.id !== "string" ||
      typeof route.percent !== "number" ||
      !Number.isFinite(route.percent) ||
      route.percent < 0 ||
      route.percent > 100 ||
      typeof route.sameCountry !== "boolean" ||
      !isRecord(route.origin) ||
      !isRecord(route.target)
    ) {
      return false;
    }

    const origin = route.origin;
    const target = route.target;
    return (
      typeof origin.code === "string" &&
      /^[A-Z]{2}$/.test(origin.code) &&
      typeof origin.name === "string" &&
      isLatitude(origin.latitude) &&
      isLongitude(origin.longitude) &&
      typeof target.code === "string" &&
      /^[A-Z]{2}$/.test(target.code) &&
      typeof target.name === "string" &&
      isLatitude(target.latitude) &&
      isLongitude(target.longitude) &&
      route.sameCountry === (origin.code === target.code)
    );
  });
}

const getPairData = (payload: unknown): RadarPairData => {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.result)) {
    throw new InvalidRadarDataError("Radar returned an invalid attack response.");
  }

  const { result } = payload;
  const meta = result.meta;
  if (!isRecord(meta) || !Array.isArray(result.top_0)) {
    throw new InvalidRadarDataError("Radar omitted attack rows or metadata.");
  }

  const dateRange = meta.dateRange;
  const firstWindow = Array.isArray(dateRange) ? dateRange[0] : null;
  if (
    !isRecord(firstWindow) ||
    !isTimestamp(firstWindow.startTime) ||
    !isTimestamp(firstWindow.endTime) ||
    Date.parse(firstWindow.endTime) <= Date.parse(firstWindow.startTime) ||
    !isTimestamp(meta.lastUpdated)
  ) {
    throw new InvalidRadarDataError("Radar returned an invalid data window.");
  }

  const pairs = result.top_0.flatMap((row): RadarPair[] => {
    if (!isRecord(row)) return [];

    const originCode = row.originCountryAlpha2;
    const originName = row.originCountryName;
    const targetCode = row.targetCountryAlpha2;
    const targetName = row.targetCountryName;
    const percent = typeof row.value === "string" ? Number(row.value) : Number.NaN;

    if (
      typeof originCode !== "string" ||
      !/^[A-Z]{2}$/.test(originCode) ||
      typeof targetCode !== "string" ||
      !/^[A-Z]{2}$/.test(targetCode) ||
      typeof originName !== "string" ||
      typeof targetName !== "string" ||
      typeof row.value !== "string" ||
      !/^\d+(?:\.\d+)?$/.test(row.value) ||
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > 100
    ) {
      return [];
    }

    return [{ originCode, originName, targetCode, targetName, percent }];
  });

  if (result.top_0.length > 0 && pairs.length === 0) {
    throw new InvalidRadarDataError("Radar returned no valid attack rows.");
  }

  return {
    pairs: pairs.slice(0, 40),
    startTime: firstWindow.startTime,
    endTime: firstWindow.endTime,
    lastUpdated: meta.lastUpdated,
    normalization: meta.normalization,
    units: meta.units,
  };
};

export function getRadarLocationCodes(payload: unknown): string[] {
  const { pairs } = getPairData(payload);
  return [...new Set(pairs.flatMap((pair) => [pair.originCode, pair.targetCode]))];
}

const getLocations = (payload: unknown): Map<string, Location> => {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.result)) {
    throw new InvalidRadarDataError("Radar returned an invalid locations response.");
  }

  const rows = payload.result.locations;
  if (!Array.isArray(rows)) {
    throw new InvalidRadarDataError("Radar omitted country locations.");
  }

  return new Map(
    rows.flatMap((row): Array<[string, Location]> => {
      if (!isRecord(row) || typeof row.alpha2 !== "string" || !/^[A-Z]{2}$/.test(row.alpha2)) {
        return [];
      }

      const latitude = typeof row.latitude === "string" ? Number(row.latitude) : Number.NaN;
      const longitude = typeof row.longitude === "string" ? Number(row.longitude) : Number.NaN;
      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return [];
      }

      const location = { latitude, longitude };
      return [[row.alpha2, location]];
    }),
  );
};

export function normalizeRadarSnapshot(
  pairPayload: unknown,
  locationPayload: unknown,
  range: RadarRange,
  fetchedAt: string,
): AttackSnapshot {
  const pairData = getPairData(pairPayload);
  if (pairData.normalization !== "PERCENTAGE") {
    throw new InvalidRadarDataError("Radar did not return percentage-normalized data.");
  }
  if (!isTimestamp(fetchedAt)) {
    throw new InvalidRadarDataError("Snapshot fetch time is invalid.");
  }

  const locations = getLocations(locationPayload);
  const routes = pairData.pairs.map((pair, index): AttackRoute => {
    const origin = locations.get(pair.originCode);
    const target = locations.get(pair.targetCode);

    return {
      id: `${pair.originCode}-${pair.targetCode}-${index}`,
      origin: {
        code: pair.originCode,
        name: pair.originName,
        latitude: origin?.latitude ?? null,
        longitude: origin?.longitude ?? null,
      },
      target: {
        code: pair.targetCode,
        name: pair.targetName,
        latitude: target?.latitude ?? null,
        longitude: target?.longitude ?? null,
      },
      percent: pair.percent,
      sameCountry: pair.originCode === pair.targetCode,
    };
  });

  const units = Array.isArray(pairData.units)
    ? pairData.units.flatMap((unit): string[] =>
        isRecord(unit) && typeof unit.value === "string" ? [unit.value] : [],
      )
    : [];

  return {
    range,
    window: {
      startTime: pairData.startTime,
      endTime: pairData.endTime,
    },
    lastUpdated: pairData.lastUpdated,
    fetchedAt,
    normalization: "PERCENTAGE",
    units: [...new Set(units)],
    routes,
  };
}
