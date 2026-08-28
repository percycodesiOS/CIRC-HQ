import assert from "node:assert/strict";
import test from "node:test";

import {
  createWeatherService,
  getWeatherSummary
} from "../src/services/weather.js";

function validPayload() {
  return {
    current: {
      time: "2026-08-28T08:30",
      temperature_2m: 58,
      apparent_temperature: 56,
      precipitation: 0.01,
      weather_code: 3,
      wind_speed_10m: 8
    },
    current_units: {
      temperature_2m: "°F",
      apparent_temperature: "°F",
      precipitation: "inch",
      wind_speed_10m: "mph"
    },
    hourly: {
      time: [
        "2026-08-28T08:00",
        "2026-08-28T09:00",
        "2026-08-28T15:00"
      ],
      precipitation_probability: [20, 30, 45],
      temperature_2m: [57, 59, 72],
      apparent_temperature: [55, 57, 73],
      weather_code: [2, 3, 61],
      wind_speed_10m: [7, 8, 12]
    },
    hourly_units: {
      precipitation_probability: "%",
      temperature_2m: "°F",
      apparent_temperature: "°F",
      wind_speed_10m: "mph"
    }
  };
}

test("normalizes valid current conditions and both duty-hour forecasts", () => {
  const summary = getWeatherSummary(validPayload());

  assert.equal(summary.status, "ready");
  assert.equal(summary.label, "58°F, feels 56°F");
  assert.equal(summary.current.condition, "Overcast");
  assert.equal(summary.current.wind, "8 mph");
  assert.equal(summary.dutyForecasts.length, 2);
  assert.deepEqual(
    summary.dutyForecasts.map((forecast) => ({
      time: forecast.timeLabel,
      condition: forecast.condition,
      rain: forecast.precipitationProbability,
      temperature: forecast.temperature,
      wind: forecast.wind
    })),
    [
      {
        time: "8:00 AM",
        condition: "Partly cloudy",
        rain: "20%",
        temperature: "57°F",
        wind: "7 mph"
      },
      {
        time: "3:00 PM",
        condition: "Slight rain",
        rain: "45%",
        temperature: "72°F",
        wind: "12 mph"
      }
    ]
  );
});

test("returns a stable unavailable model when required fields are missing", () => {
  assert.deepEqual(getWeatherSummary({ current: {}, hourly: {} }), {
    status: "unavailable",
    stale: false,
    label: "Weather unavailable",
    detail: "Schedule remains available."
  });
});

test("builds the exact local forecast request and caches success for 30 minutes", async () => {
  let now = Date.parse("2026-08-28T08:00:00-04:00");
  const calls = [];
  const service = createWeatherService({
    clock: { now: () => now },
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => validPayload() };
    }
  });

  const first = await service.load();
  now += 29 * 60 * 1000;
  const cached = await service.load();

  assert.equal(first.status, "ready");
  assert.equal(cached.status, "ready");
  assert.equal(calls.length, 1);
  const url = new URL(calls[0]);
  assert.equal(url.hostname, "api.open-meteo.com");
  assert.equal(url.searchParams.get("latitude"), "40.7408743");
  assert.equal(url.searchParams.get("longitude"), "-80.1052344");
  assert.equal(
    url.searchParams.get("current"),
    "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
  );
  assert.equal(
    url.searchParams.get("hourly"),
    "precipitation_probability,temperature_2m,apparent_temperature,weather_code,wind_speed_10m"
  );
  assert.equal(url.searchParams.get("temperature_unit"), "fahrenheit");
  assert.equal(url.searchParams.get("wind_speed_unit"), "mph");
  assert.equal(url.searchParams.get("timezone"), "America/New_York");
  assert.equal(url.searchParams.get("forecast_days"), "1");
});

test("network failure stays unavailable and never throws without a cache", async () => {
  const service = createWeatherService({
    fetchImpl: async () => {
      throw new Error("offline");
    }
  });
  assert.deepEqual(await service.load(), {
    status: "unavailable",
    stale: false,
    label: "Weather unavailable",
    detail: "Schedule remains available."
  });
});

test("network failure returns the last successful value marked stale", async () => {
  let now = Date.parse("2026-08-28T08:00:00-04:00");
  let fail = false;
  const service = createWeatherService({
    clock: { now: () => now },
    fetchImpl: async () => {
      if (fail) throw new Error("offline");
      return { ok: true, json: async () => validPayload() };
    }
  });

  await service.load();
  now += 31 * 60 * 1000;
  fail = true;
  const stale = await service.load();

  assert.equal(stale.status, "stale");
  assert.equal(stale.stale, true);
  assert.equal(stale.label, "58°F, feels 56°F (stale)");
  assert.match(stale.detail, /Last available forecast/);
});
