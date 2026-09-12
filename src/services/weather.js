const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const EHRMAN_CREST = {
  latitude: 40.7408743,
  longitude: -80.1052344
};
const CACHE_MILLISECONDS = 30 * 60 * 1000;
const DUTY_HOURS = new Set([8, 15]);

const WEATHER_CODES = new Map([
  [0, "Clear"],
  [1, "Mostly clear"],
  [2, "Partly cloudy"],
  [3, "Overcast"],
  [45, "Fog"],
  [48, "Freezing fog"],
  [51, "Light drizzle"],
  [53, "Drizzle"],
  [55, "Heavy drizzle"],
  [56, "Light freezing drizzle"],
  [57, "Freezing drizzle"],
  [61, "Slight rain"],
  [63, "Rain"],
  [65, "Heavy rain"],
  [66, "Light freezing rain"],
  [67, "Freezing rain"],
  [71, "Slight snow"],
  [73, "Snow"],
  [75, "Heavy snow"],
  [77, "Snow grains"],
  [80, "Slight rain showers"],
  [81, "Rain showers"],
  [82, "Heavy rain showers"],
  [85, "Slight snow showers"],
  [86, "Heavy snow showers"],
  [95, "Thunderstorm"],
  [96, "Thunderstorm with hail"],
  [99, "Severe thunderstorm with hail"]
]);

function unavailableSummary() {
  return {
    status: "unavailable",
    stale: false,
    label: "Weather unavailable",
    detail: "Schedule remains available."
  };
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function degrees(value) {
  return `${Math.round(value)}°F`;
}

function speed(value) {
  return `${Math.round(value)} mph`;
}

function percent(value) {
  return `${Math.round(value)}%`;
}

function condition(code) {
  return WEATHER_CODES.get(code) ?? "Conditions not classified";
}

function hourFromLocalTimestamp(value) {
  const match = typeof value === "string" ? value.match(/T(\d{2}):\d{2}$/) : null;
  return match ? Number(match[1]) : null;
}

function timeLabel(value) {
  const hour = hourFromLocalTimestamp(value);
  if (!Number.isInteger(hour)) return "Time not entered";
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:00 ${period}`;
}

function hourlyValue(hourly, field, index) {
  const values = hourly?.[field];
  return Array.isArray(values) ? values[index] : undefined;
}

function dutyForecasts(hourly) {
  if (!Array.isArray(hourly?.time)) return [];
  return hourly.time.flatMap((time, index) => {
    const hour = hourFromLocalTimestamp(time);
    if (!DUTY_HOURS.has(hour)) return [];
    const precipitationProbability = hourlyValue(
      hourly,
      "precipitation_probability",
      index
    );
    const temperature = hourlyValue(hourly, "temperature_2m", index);
    const feelsLike = hourlyValue(hourly, "apparent_temperature", index);
    const weatherCode = hourlyValue(hourly, "weather_code", index);
    const wind = hourlyValue(hourly, "wind_speed_10m", index);
    if (
      !finiteNumber(precipitationProbability) ||
      !finiteNumber(temperature) ||
      !finiteNumber(feelsLike) ||
      !finiteNumber(weatherCode) ||
      !finiteNumber(wind)
    ) {
      return [];
    }
    return [{
      time,
      timeLabel: timeLabel(time),
      condition: condition(weatherCode),
      precipitationProbability: percent(precipitationProbability),
      temperature: degrees(temperature),
      feelsLike: degrees(feelsLike),
      wind: speed(wind)
    }];
  });
}

export function getWeatherSummary(payload) {
  const current = payload?.current;
  if (
    !finiteNumber(current?.temperature_2m) ||
    !finiteNumber(current?.apparent_temperature) ||
    !finiteNumber(current?.precipitation) ||
    !finiteNumber(current?.weather_code) ||
    !finiteNumber(current?.wind_speed_10m)
  ) {
    return unavailableSummary();
  }

  const currentModel = {
    time: current.time ?? null,
    weatherCode: current.weather_code,
    temperature: degrees(current.temperature_2m),
    feelsLike: degrees(current.apparent_temperature),
    precipitation: `${current.precipitation} in`,
    condition: condition(current.weather_code),
    wind: speed(current.wind_speed_10m)
  };
  return {
    status: "ready",
    stale: false,
    label: `${currentModel.temperature}, feels ${currentModel.feelsLike}`,
    detail: `${currentModel.condition} | Rain now ${currentModel.precipitation} | Wind ${currentModel.wind}`,
    current: currentModel,
    dutyForecasts: dutyForecasts(payload.hourly)
  };
}

function requestUrl() {
  const url = new URL(WEATHER_ENDPOINT);
  url.searchParams.set("latitude", String(EHRMAN_CREST.latitude));
  url.searchParams.set("longitude", String(EHRMAN_CREST.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
  );
  url.searchParams.set(
    "hourly",
    "precipitation_probability,temperature_2m,apparent_temperature,weather_code,wind_speed_10m"
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "America/New_York");
  url.searchParams.set("forecast_days", "1");
  return url.toString();
}

function staleSummary(summary) {
  return {
    ...structuredClone(summary),
    status: "stale",
    stale: true,
    label: `${summary.label} (stale)`,
    detail: `Last available forecast | ${summary.detail}`
  };
}

export function createWeatherService({
  fetchImpl = globalThis.fetch,
  clock = { now: () => Date.now() },
  timeoutMilliseconds = 10000
} = {}) {
  let cache = null;
  let pending = null;

  return {
    async load({ force = false } = {}) {
      if (pending) return structuredClone(await pending);
      const currentTime = clock.now();
      if (!force && cache && currentTime - cache.savedAt < CACHE_MILLISECONDS) {
        return structuredClone(cache.summary);
      }
      pending = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMilliseconds);
        try {
          if (typeof fetchImpl !== "function") throw new Error("fetch unavailable");
          const response = await fetchImpl(requestUrl(), { signal: controller.signal });
          if (!response?.ok) throw new Error("weather request failed");
          const summary = getWeatherSummary(await response.json());
          if (summary.status !== "ready") throw new Error("weather response incomplete");
          cache = { savedAt: clock.now(), summary: structuredClone(summary) };
          return summary;
        } catch {
          return cache ? staleSummary(cache.summary) : unavailableSummary();
        } finally {
          clearTimeout(timer);
        }
      })();
      try {
        return structuredClone(await pending);
      } finally {
        pending = null;
      }
    }
  };
}
