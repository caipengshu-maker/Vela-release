const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const LOCATION_CACHE_TTL_MS = 60 * 60 * 1000;

const CITY_COORDINATES = {
  shanghai: { label: "Shanghai", latitude: 31.2304, longitude: 121.4737 },
  "\u4e0a\u6d77": { label: "Shanghai", latitude: 31.2304, longitude: 121.4737 },
  beijing: { label: "Beijing", latitude: 39.9042, longitude: 116.4074 },
  "\u5317\u4eac": { label: "Beijing", latitude: 39.9042, longitude: 116.4074 },
  shenzhen: { label: "Shenzhen", latitude: 22.5431, longitude: 114.0579 },
  "\u6df1\u5733": { label: "Shenzhen", latitude: 22.5431, longitude: 114.0579 },
  guangzhou: { label: "Guangzhou", latitude: 23.1291, longitude: 113.2644 },
  "\u5e7f\u5dde": { label: "Guangzhou", latitude: 23.1291, longitude: 113.2644 },
  hangzhou: { label: "Hangzhou", latitude: 30.2741, longitude: 120.1551 },
  "\u676d\u5dde": { label: "Hangzhou", latitude: 30.2741, longitude: 120.1551 },
  chengdu: { label: "Chengdu", latitude: 30.5728, longitude: 104.0668 },
  "\u6210\u90fd": { label: "Chengdu", latitude: 30.5728, longitude: 104.0668 },
  chongqing: { label: "Chongqing", latitude: 29.4316, longitude: 106.9123 },
  "\u91cd\u5e86": { label: "Chongqing", latitude: 29.4316, longitude: 106.9123 },
  wuhan: { label: "Wuhan", latitude: 30.5928, longitude: 114.3055 },
  "\u6b66\u6c49": { label: "Wuhan", latitude: 30.5928, longitude: 114.3055 },
  xian: { label: "Xi'an", latitude: 34.3416, longitude: 108.9398 },
  "\u897f\u5b89": { label: "Xi'an", latitude: 34.3416, longitude: 108.9398 },
  nanjing: { label: "Nanjing", latitude: 32.0603, longitude: 118.7969 },
  "\u5357\u4eac": { label: "Nanjing", latitude: 32.0603, longitude: 118.7969 }
};

const weatherCache = new Map();
let browserLocationCache = null;

function normalizeCityKey(city) {
  return String(city || "").trim().toLowerCase();
}

function isFreshTimestamp(cachedAt, ttlMs) {
  const timestamp = Date.parse(cachedAt || "");
  return Number.isFinite(timestamp) && Date.now() - timestamp < ttlMs;
}

function normalizeLocation(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const lat = Number(location.lat ?? location.latitude);
  const lon = Number(location.lon ?? location.longitude);
  const cachedAt = String(location.cachedAt || "").trim() || new Date().toISOString();

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    cachedAt
  };
}

function locationCacheKey(location) {
  return `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
}

function shouldUseCache(entry) {
  if (!entry) {
    return false;
  }

  return Date.now() - entry.cachedAt < WEATHER_CACHE_TTL_MS;
}

function mapWeatherCodeToCondition(code) {
  if (code === 0) {
    return "\u6674";
  }

  if ([1, 2].includes(code)) {
    return "\u591a\u4e91";
  }

  if (code === 3) {
    return "\u9634";
  }

  if ([45, 48].includes(code)) {
    return "\u96fe";
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return "\u6bdb\u6bdb\u96e8";
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "\u4e0b\u96e8";
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "\u4e0b\u96ea";
  }

  if ([95, 96, 99].includes(code)) {
    return "\u96f7\u96e8";
  }

  return "\u5929\u6c14\u53d8\u5316";
}

function isRainingCode(code) {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(
    code
  );
}

async function resolveBrowserPosition(navigatorImpl = globalThis.navigator) {
  const geolocation = navigatorImpl?.geolocation;

  if (!geolocation?.getCurrentPosition) {
    return null;
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position?.coords?.latitude);
        const lon = Number(position?.coords?.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          resolve(null);
          return;
        }

        const cachedLocation = {
          lat,
          lon,
          cachedAt: new Date().toISOString()
        };
        browserLocationCache = cachedLocation;
        resolve(cachedLocation);
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: LOCATION_CACHE_TTL_MS
      }
    );
  });
}

export async function getLocationFromBrowser({
  persistedState = null,
  navigatorImpl = globalThis.navigator
} = {}) {
  const persistedLocation = normalizeLocation(persistedState?.cachedLocation);

  if (persistedLocation && isFreshTimestamp(persistedLocation.cachedAt, LOCATION_CACHE_TTL_MS)) {
    browserLocationCache = persistedLocation;
    return persistedLocation;
  }

  if (
    browserLocationCache &&
    isFreshTimestamp(browserLocationCache.cachedAt, LOCATION_CACHE_TTL_MS)
  ) {
    return browserLocationCache;
  }

  return resolveBrowserPosition(navigatorImpl);
}

async function fetchWeatherAtCoordinates({
  latitude,
  longitude,
  cacheKey,
  cityLabel = null,
  fetchImpl
}) {
  const cached = weatherCache.get(cacheKey);

  if (shouldUseCache(cached)) {
    return cached.value;
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,rain"
  );
  url.searchParams.set("timezone", "Asia/Shanghai");

  const response = await fetchImpl(url.toString());

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const current = payload?.current;

  if (!current) {
    return null;
  }

  const weatherCode = Number(current.weather_code);
  const weather = {
    city: cityLabel || null,
    latitude,
    longitude,
    temperature: Number.isFinite(Number(current.temperature_2m))
      ? Number(current.temperature_2m)
      : null,
    condition: mapWeatherCodeToCondition(weatherCode),
    isRaining:
      Number(current.rain || 0) > 0 ||
      Number(current.precipitation || 0) > 0 ||
      isRainingCode(weatherCode),
    humidity: Number.isFinite(Number(current.relative_humidity_2m))
      ? Number(current.relative_humidity_2m)
      : null,
    windSpeed: Number.isFinite(Number(current.wind_speed_10m))
      ? Number(current.wind_speed_10m)
      : null,
    observedAt: current.time || null
  };

  weatherCache.set(cacheKey, {
    cachedAt: Date.now(),
    value: weather
  });

  return weather;
}

export async function getWeatherAwareness({
  config,
  persistedState = null,
  fetchImpl = globalThis.fetch,
  navigatorImpl = globalThis.navigator
} = {}) {
  try {
    if (typeof fetchImpl !== "function") {
      return null;
    }

    const browserLocation = await getLocationFromBrowser({
      persistedState,
      navigatorImpl
    });

    if (browserLocation) {
      return fetchWeatherAtCoordinates({
        latitude: browserLocation.lat,
        longitude: browserLocation.lon,
        cacheKey: `location:${locationCacheKey(browserLocation)}`,
        fetchImpl
      });
    }

    const city = config?.user?.location?.city;
    const cityEntry = CITY_COORDINATES[normalizeCityKey(city)];

    if (!cityEntry) {
      return null;
    }

    return fetchWeatherAtCoordinates({
      latitude: cityEntry.latitude,
      longitude: cityEntry.longitude,
      cacheKey: `city:${cityEntry.label}`,
      cityLabel: cityEntry.label,
      fetchImpl
    });
  } catch {
    return null;
  }
}
