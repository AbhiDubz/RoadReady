"use client";

import type { KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/app-state";
import type { LocationSuggestion } from "@/lib/location-search";
import { generateRoutePlan, getRecommendations } from "@/lib/logic";
import { getStateMetadataByCode } from "@/lib/mock-data";
import { DifficultyLevel } from "@/lib/types";

const PracticeMap = dynamic(
  () => import("@/components/routes/practice-map").then((module) => module.PracticeMap),
  {
    ssr: false,
    loading: () => <div className="map-loading">Loading map...</div>
  }
);

function buildGoogleMapsUrl(latitude: number, longitude: number) {
  const query = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function buildGoogleMapsDirectionsUrl(origin: { latitude: number; longitude: number }, destination: {
  latitude: number;
  longitude: number;
}) {
  const originQuery = encodeURIComponent(`${origin.latitude},${origin.longitude}`);
  const destinationQuery = encodeURIComponent(`${destination.latitude},${destination.longitude}`);
  return `https://www.google.com/maps/dir/?api=1&origin=${originQuery}&destination=${destinationQuery}&travelmode=driving`;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  if (roundedMinutes < 60) {
    return `${roundedMinutes} min`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function formatGeneratedTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function isApproximateStop(stop?: {
  source?: "resolved" | "fallback";
  verificationStatus?: "verified" | "approximate";
}) {
  return stop?.source === "fallback" || stop?.verificationStatus === "approximate";
}

export function RouteBuilder() {
  const { state, readiness, saveRoute, isPending } = useAppState();
  const stateMetadata = getStateMetadataByCode(state.profile.stateCode);
  const defaultStartLocation = `${stateMetadata.defaultCity}, ${state.profile.stateCode}`;
  const defaultStartCoordinates = {
    latitude: stateMetadata.latitude,
    longitude: stateMetadata.longitude
  };
  const [startLocation, setStartLocation] = useState(defaultStartLocation);
  const [startLocationQuery, setStartLocationQuery] = useState(defaultStartLocation);
  const [startCoordinates, setStartCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(defaultStartCoordinates);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("balanced");
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [routeFeedback, setRouteFeedback] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>(
    readiness.topRecommendations.map((item) => item.skillId).slice(0, 2)
  );
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const recommendations = useMemo(
    () => getRecommendations(state.profile, state.skills, state.progress),
    [state.profile, state.progress, state.skills]
  );

  useEffect(() => {
    setStartLocation(defaultStartLocation);
    setStartLocationQuery(defaultStartLocation);
    setStartCoordinates(defaultStartCoordinates);
  }, [defaultStartLocation, stateMetadata.latitude, stateMetadata.longitude]);

  const quickLocationSuggestions = useMemo(
    () =>
      [
        defaultStartLocation,
        state.profile.stateCode === "WA" ? "Bothell, Washington" : null,
        state.profile.stateCode === "WA" ? "Bellevue, Washington" : null,
        state.profile.stateCode === "WA" ? "Redmond, Washington" : null
      ].filter((value): value is string => Boolean(value)),
    [defaultStartLocation, state.profile.stateCode]
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setIsSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const trimmedQuery = startLocationQuery.trim();
    if (trimmedQuery.length < 2) {
      setLocationSuggestions([]);
      setIsSearching(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const response = await fetch(
          `/api/locations/search?q=${encodeURIComponent(trimmedQuery)}&lat=${stateMetadata.latitude}&lon=${stateMetadata.longitude}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          setLocationSuggestions([]);
          return;
        }

        const data = (await response.json()) as { suggestions?: LocationSuggestion[] };
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        setLocationSuggestions(suggestions);
        setIsSuggestionsOpen(true);
        setActiveSuggestionIndex(suggestions.length ? 0 : -1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setLocationSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [startLocationQuery, stateMetadata.latitude, stateMetadata.longitude]);

  const latestRoute = state.latestRoute;
  const routeWaypointCoordinates = useMemo(() => {
    if (!latestRoute) {
      return [];
    }

    return [
      { latitude: latestRoute.startLatitude, longitude: latestRoute.startLongitude },
      ...latestRoute.segments.map((segment) => ({
        latitude: segment.latitude,
        longitude: segment.longitude
      })),
      { latitude: latestRoute.startLatitude, longitude: latestRoute.startLongitude }
    ];
  }, [latestRoute]);

  function toggleSkill(skillId: string) {
    setActiveSkillIds((current) => {
      if (current.includes(skillId)) {
        setSelectionMessage(null);
        return current.filter((entry) => entry !== skillId);
      }

      if (current.length >= 3) {
        setSelectionMessage("You can choose up to 3 target skills at a time.");
        return current;
      }

      setSelectionMessage(null);
      return [...current, skillId];
    });
  }

  function chooseLocationSuggestion(suggestion: LocationSuggestion | string) {
    const nextValue = typeof suggestion === "string" ? suggestion : suggestion.value;
    const nextQuery = typeof suggestion === "string" ? suggestion : suggestion.label;
    setStartLocation(nextValue);
    setStartLocationQuery(nextQuery);
    setStartCoordinates(
      typeof suggestion === "string"
        ? suggestion === defaultStartLocation
          ? defaultStartCoordinates
          : null
        : {
            latitude: suggestion.latitude,
            longitude: suggestion.longitude
          }
    );
    setLocationMessage(null);
    setLocationSuggestions([]);
    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Current location is not supported in this browser.");
      return;
    }

    setIsLocating(true);
    setLocationMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        const coordinates = `${latitude}, ${longitude}`;
        setStartLocation(coordinates);
        setStartLocationQuery(coordinates);
        setStartCoordinates({
          latitude: Number(latitude),
          longitude: Number(longitude)
        });
        setLocationSuggestions([]);
        setIsSuggestionsOpen(false);
        setLocationMessage("Using your current coordinates as the start location.");
        setIsLocating(false);
      },
      () => {
        setLocationMessage("Location access was blocked. You can still search or choose a quick pick below.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  }

  async function handleGenerate() {
    const payload = {
      skills: state.skills,
      recommendations,
      request: {
        startLocation,
        startLatitude: startCoordinates?.latitude,
        startLongitude: startCoordinates?.longitude,
        difficulty,
        skillIds: activeSkillIds
      }
    };

    setIsGeneratingRoute(true);
    setRouteFeedback("Generating your route and directions...");

    try {
      try {
        const response = await fetch("/api/routes/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          saveRoute(data.route);
          setRouteFeedback("Route generated with directions.");
          return;
        }
      } catch {
        // Fall back to local route generation below.
      }

      saveRoute(generateRoutePlan(state.skills, recommendations, payload.request));
      setRouteFeedback("Route generated using fallback routing.");
      return;
    } finally {
      setIsGeneratingRoute(false);
    }
  }

  function handleLocationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!locationSuggestions.length) {
      if (event.key === "Escape") {
        setIsSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }

      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsSuggestionsOpen(true);
      setActiveSuggestionIndex((current) => (current + 1) % locationSuggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsSuggestionsOpen(true);
      setActiveSuggestionIndex((current) => (current <= 0 ? locationSuggestions.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && isSuggestionsOpen && activeSuggestionIndex >= 0) {
      event.preventDefault();
      chooseLocationSuggestion(locationSuggestions[activeSuggestionIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
    }
  }

  return (
    <div className="stack-lg">
      <section className="panel route-builder-panel">
        <div className="panel-head">
          <div>
            <h1>Build the next practice route</h1>
            <p className="subtle-text">
              Search for a starting point, pick the skills that need reps, and generate a nearby loop with practice
              stops.
            </p>
          </div>
          <span className="route-status-pill">
            {isGeneratingRoute
              ? "Generating route..."
              : latestRoute
                ? `Generated ${formatGeneratedTime(latestRoute.createdAt)}`
                : "Ready to search"}
          </span>
        </div>

        <div className="route-builder-layout">
          <div className="route-builder-main">
            <div className="form-grid route-form-grid">
              <label className="full-width">
                <span>Start location</span>
                <div className="location-input-stack" ref={searchContainerRef}>
                  <div className="location-search-shell">
                    <input
                      value={startLocationQuery}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setStartLocationQuery(nextValue);
                        setStartLocation(nextValue);
                        setStartCoordinates(null);
                        setIsSuggestionsOpen(true);
                      }}
                      onFocus={() => {
                        if (locationSuggestions.length) {
                          setIsSuggestionsOpen(true);
                        }
                      }}
                      onKeyDown={handleLocationKeyDown}
                      placeholder="Search a city, neighborhood, or address"
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={isSuggestionsOpen}
                      aria-controls="start-location-suggestions"
                    />
                    <div className="location-search-meta">
                      <span>{isSearching ? "Searching..." : "Live suggestions"}</span>
                    </div>
                    {isSuggestionsOpen && (locationSuggestions.length > 0 || startLocationQuery.trim().length >= 2) ? (
                      <div className="location-suggestion-popover" id="start-location-suggestions" role="listbox">
                        {locationSuggestions.length ? (
                          locationSuggestions.map((suggestion, index) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              className={
                                index === activeSuggestionIndex
                                  ? "location-suggestion-button active"
                                  : "location-suggestion-button"
                              }
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => chooseLocationSuggestion(suggestion)}
                              role="option"
                              aria-selected={index === activeSuggestionIndex}
                            >
                              <strong>{suggestion.label}</strong>
                              {suggestion.detail ? <span>{suggestion.detail}</span> : null}
                            </button>
                          ))
                        ) : (
                          <div className="location-suggestion-empty">
                            No matching places yet. Keep typing a city, neighborhood, or street.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="inline-action-row">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleUseCurrentLocation}
                      disabled={isLocating}
                    >
                      {isLocating ? "Finding current location..." : "Use current location"}
                    </button>
                    {quickLocationSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="chip"
                        onClick={() => chooseLocationSuggestion(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <p className="subtle-text location-help">
                    Start typing and RoadReady will surface matching places immediately.
                  </p>
                  {startLocation !== startLocationQuery ? (
                    <p className="location-selection-pill">Using: {startLocation}</p>
                  ) : null}
                  {locationMessage ? <p className="location-help">{locationMessage}</p> : null}
                </div>
              </label>
              <label>
                <span>Difficulty</span>
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyLevel)}>
                  <option value="gentle">Gentle</option>
                  <option value="balanced">Balanced</option>
                  <option value="stretch">Stretch</option>
                </select>
              </label>
            </div>

            <div className="route-skill-panel">
              <div className="panel-head">
                <h2>Target skills</h2>
                <span className="subtle-text">{activeSkillIds.length}/3 selected</span>
              </div>
              <p className="subtle-text route-selection-help">
                Choose up to 3 priorities. Tap a selected skill again to remove it.
              </p>
              <div className="chip-wrap">
                {recommendations.slice(0, 6).map((recommendation) => (
                  <button
                    key={recommendation.skillId}
                    type="button"
                    className={activeSkillIds.includes(recommendation.skillId) ? "chip active" : "chip"}
                    onClick={() => toggleSkill(recommendation.skillId)}
                  >
                    {recommendation.label}
                  </button>
                ))}
              </div>
              {selectionMessage ? <p className="route-selection-message">{selectionMessage}</p> : null}
            </div>

            <button
              type="button"
              className="primary-button route-generate-button"
              disabled={isPending || isGeneratingRoute || activeSkillIds.length === 0}
              onClick={handleGenerate}
            >
              {isGeneratingRoute ? "Generating route..." : "Generate recommended route"}
            </button>
            {routeFeedback ? (
              <div className="route-feedback-banner">
                <strong>{routeFeedback}</strong>
                <span>
                  {latestRoute?.generationSource === "ai-assisted"
                    ? "AI selected the practice stops and road routing filled in the directions."
                    : "RoadReady generated the route with its built-in planner."}
                </span>
              </div>
            ) : null}
          </div>

          <aside className="route-builder-sidebar">
            <div className="route-callout-card">
              <span className="eyebrow">How it works</span>
              <strong>Search, select, generate</strong>
              <p className="subtle-text">
                Live place suggestions help you start from the right area, then RoadReady builds a focused loop around
                your weakest skills.
              </p>
            </div>
            <div className="route-callout-card">
              <span className="eyebrow">Best results</span>
              <strong>Try a real neighborhood or intersection</strong>
              <p className="subtle-text">
                More specific places usually produce better practice stops and a cleaner map route.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {latestRoute ? (
        <section className="two-column-grid">
          <article className="panel route-map-panel">
            <div className="panel-head">
              <h2>Route overview</h2>
              <div className="route-panel-meta">
                <span className="subtle-text">{latestRoute.estimatedMinutes} minutes</span>
                {latestRoute.generationSource === "ai-assisted" ? (
                  <span className="route-ai-pill">Powered by AI</span>
                ) : null}
                <span className="route-engine-pill">
                  {latestRoute.routingSource === "road-route" ? "Road directions ready" : "Straight-line fallback"}
                </span>
              </div>
            </div>
            <PracticeMap route={latestRoute} />
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Why this route was chosen</h2>
              <div className="route-panel-meta">
                <span className="subtle-text">{latestRoute.difficulty} difficulty</span>
                {latestRoute.generationSource === "ai-assisted" ? (
                  <span className="route-ai-pill">AI-assisted planner</span>
                ) : (
                  <span className="route-engine-pill">Rules-based planner</span>
                )}
              </div>
            </div>
            {latestRoute.warnings?.length ? (
              <div className="route-feedback-banner">
                <strong>Preview before driving</strong>
                <span>{latestRoute.warnings.join(" ")}</span>
              </div>
            ) : null}
            <p className="route-explanation">{latestRoute.explanation}</p>
            <p>
              <a
                href={buildGoogleMapsUrl(latestRoute.startLatitude, latestRoute.startLongitude)}
                target="_blank"
                rel="noreferrer"
                className="route-link"
              >
                Open start location in Google Maps
              </a>
            </p>
            <div className="timeline-list">
              {latestRoute.routeLegs?.length
                ? latestRoute.routeLegs.map((leg, index) => {
                    const origin = routeWaypointCoordinates[index];
                    const destination = routeWaypointCoordinates[index + 1];
                    const targetSegment = latestRoute.segments[index];

                    return (
                      <div key={leg.id} className="timeline-item">
                        <div className="route-leg-head">
                          <strong>{leg.toLabel}</strong>
                          <span className="subtle-text">
                            {formatDuration(leg.durationSeconds)} • {formatDistance(leg.distanceMeters)}
                          </span>
                        </div>
                        <p className="route-leg-summary">
                          {leg.fromLabel} to {leg.toLabel}
                        </p>
                        {isApproximateStop(targetSegment) ? (
                          <span className="route-warning-pill">Approximate stop</span>
                        ) : null}
                        {targetSegment?.focusSkillLabels?.length ? (
                          <p className="route-focus-line">Targets: {targetSegment.focusSkillLabels.join(", ")}</p>
                        ) : null}
                        <p>{targetSegment?.address ?? latestRoute.startLocation}</p>
                        <p>{targetSegment?.reason ?? "Return to your starting point."}</p>
                        <div className="route-steps-list">
                          {leg.steps.slice(0, 5).map((step, stepIndex) => (
                            <div key={`${leg.id}-${stepIndex}`} className="route-step-item">
                              <span>{step.instruction}</span>
                              <span className="subtle-text">
                                {formatDuration(step.durationSeconds)} • {formatDistance(step.distanceMeters)}
                              </span>
                            </div>
                          ))}
                          {leg.steps.length > 5 ? (
                            <p className="subtle-text route-step-more">
                              +{leg.steps.length - 5} more steps available on the map route
                            </p>
                          ) : null}
                        </div>
                        {origin && destination ? (
                          <p>
                            <a
                              href={buildGoogleMapsDirectionsUrl(origin, destination)}
                              target="_blank"
                              rel="noreferrer"
                              className="route-link"
                            >
                              Open driving directions
                            </a>
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                : latestRoute.segments.map((segment) => (
                    <div key={segment.id} className="timeline-item">
                      <strong>{segment.title}</strong>
                      {isApproximateStop(segment) ? (
                        <span className="route-warning-pill">Approximate stop</span>
                      ) : null}
                      {segment.focusSkillLabels?.length ? (
                        <p className="route-focus-line">Targets: {segment.focusSkillLabels.join(", ")}</p>
                      ) : null}
                      <p>{segment.address}</p>
                      <p>{segment.etaMinutes} min in - {segment.reason}</p>
                      <p>
                        <a
                          href={buildGoogleMapsUrl(segment.latitude, segment.longitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="route-link"
                        >
                          Open in Google Maps
                        </a>
                      </p>
                    </div>
                  ))}
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}
