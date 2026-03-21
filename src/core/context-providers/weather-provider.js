const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

const CITY_COORDINATES = {
  shanghai: { label: "Shanghai", latitude: 31.2304, longitude: 121.4737 },
  "上海": { label: "Shanghai", latitude: 31.2304, longitude: 121.4737 },
  beijing: { label: "Beijing", latitude: 39.9042, longitude: 116.4074 },
  "北京": { label: "Beijing", latitude: 39.9042, longitude: 116.4074 },
  shenzhen: { label: "Shenzhen", latitude: 22.5431, longitude: 114.0579 },
  "深圳": { label: "Shenzhen", latitude: 22.5431, longitude: 114.0579 },
  guangzhou: { label: "Guangzhou", latitude: 23.1291, longitude: 113.2644 },
  "广州": { label: "Guangzhou", latitude: 23.1291, longitude: 113.2644 },
  hangzhou: { label: "Hangzhou", latitude: 30.2741, longitude: 120.1551 },
  "杭州": { label: "Hangzhou", latitude: 30.2741, longitude: 120.1551 },
  chengdu: { label: "Chengdu", latitude: 30.5728, longitude: 104.0668 },
  "成都": { label: "Chengdu", latitude: 30.5728, longitude: 104.0668 },
  chongqing: { label: "Chongqing", latitude: 29.4316, longitude: 106.9123 },
  "重庆": { label: "Chongqing", latitude: 29.4316, longitude: 106.9123 },
  wuhan: { label: "Wuhan", latitude: 30.5928, longitude: 114.3055 },
  "武汉": { label: "Wuhan", latitude: 30.5928, longitude: 114.3055 },
  xian: { label: "Xi'an", latitude: 34.3416, longitude: 108.9398 },
  "西安": { label: "Xi'an", latitude: 34.3416, longitude: 108.9398 },
  nanjing: { label: "Nanjing", latitude: 32.0603, longitude: 118.7969 },
  "南京": { label: "Nanjing", latitude: 32.0603, longitude: 118.7969 }
};

const weatherCache = new Map();

function normalizeCityKey(city) {
  return String(city || "").trim().toLowerCase();
}

function mapWeatherCodeToCondition(code) {
  if (code === 0) {
    return "晴";
  }

  if ([1, 2].includes(code)) {
    return "多云";
  }

  if (code === 3) {
    return "阴";
  }

  if ([45, 48].includes(code)) {
    return "雾";
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return "毛毛雨";
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "下雨";
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "下雪";
  }

  if ([95, 96, 99].includes(code)) {
    return "雷雨";
  }

  return "天气变化";
}

function shouldUseCache(entry) {
  if (!entry) {
    return false;
  }

  return Date.now() - entry.cachedAt < WEATHER_CACHE_TTL_MS;
}

export async function getWeatherAwareness({
  config,
  fetchImpl = globalThis.fetch
} = {}) {
  try {
    if (typeof fetchImpl !== "function") {
      return null;
    }

    const city = config?.user?.location?.city;
    const cityEntry = CITY_COORDINATES[normalizeCityKey(city)];

    if (!cityEntry) {
      return null;
    }

    const cacheKey = cityEntry.label;
    const cached = weatherCache.get(cacheKey);

    if (shouldUseCache(cached)) {
      return cached.value;
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(cityEntry.latitude));
    url.searchParams.set("longitude", String(cityEntry.longitude));
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

    const weather = {
      city: cityEntry.label,
      temperature: Number.isFinite(Number(current.temperature_2m))
        ? Number(current.temperature_2m)
        : null,
      condition: mapWeatherCodeToCondition(Number(current.weather_code)),
      isRaining:
        Number(current.rain || 0) > 0 ||
        Number(current.precipitation || 0) > 0 ||
        [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(
          Number(current.weather_code)
        ),
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
  } catch {
    return null;
  }
}
