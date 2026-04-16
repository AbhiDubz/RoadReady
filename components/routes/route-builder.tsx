"use client";

import type { KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/app-state";
import type { LocationSuggestion } from "@/lib/location-search";
import { getRecommendations } from "@/lib/logic";
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

function buildRouteFeedbackDetail(route?: {
  generationSource?: "ai-assisted" | "rules-based";
  routingSource?: "road-route" | "straight-line";
  segments?: Array<{
    source?: "resolved" | "fallback";
    verificationStatus?: "verified" | "approximate";
  }>;
}) {
  if (!route) {
    return "RoadReady is using AI to plan candidate maneuvers, expand nearby search anchors, and verify each stop against map data.";
  }

  if (route.routingSource === "road-route") {
    return route.generationSource === "ai-assisted"
      ? "AI planned the maneuver sequence, generated alternate nearby search anchors, and RoadReady map-verified every stop before building turn-by-turn directions."
      : "RoadReady map-verified each stop and connected the route with road directions.";
  }

  return "This saved route came from an older fallback path. Generate a fresh route to get the verified AI route engine.";
}

function buildRouteSuccessMessage(route: {
  generationSource?: "ai-assisted" | "rules-based";
  routingSource?: "road-route" | "straight-line";
  segments?: Array<{
    source?: "resolved" | "fallback";
    verificationStatus?: "verified" | "approximate";
  }>;
}) {
  if (route.routingSource !== "road-route") {
    return "Legacy fallback route loaded.";
  }

  return route.generationSource === "ai-assisted"
    ? "AI-planned verified route ready."
    : "Verified route ready.";
}

export function RouteBuilder() {
  const { account, state, readiness, saveRoute, updatePlanning, isPending } = useAppState();
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
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(state.planning.preferredDifficulty);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [routeFeedback, setRouteFeedback] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>(
    state.planning.selectedSkillIds.length
      ? state.planning.selectedSkillIds.slice(0, 3)
      : readiness.topRecommendations.map((item) => item.skillId).slice(0, 3)
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

  useEffect(() => {
    if (state.planning.selectedSkillIds.length) {
      setActiveSkillIds(state.planning.selectedSkillIds.slice(0, 3));
    }

    setDifficulty(state.planning.preferredDifficulty);
  }, [state.planning.preferredDifficulty, state.planning.selectedSkillIds]);

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

      const next = [...current, skillId];
      setSelectionMessage(null);
      return next;
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
    updatePlanning({
      selectedSkillIds: activeSkillIds,
      preferredDifficulty: difficulty
    });

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
    setRouteFeedback("Building your practice route...");
    setRouteError(null);

    try {
      const response = await fetch("/api/routes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        route?: (typeof state.latestRoute);
      };

      if (!response.ok || !data.route) {
        setRouteFeedback(null);
        setRouteError(
          data.message ??
            "RoadReady could not generate a verified route for that start point. Try a more specific address or intersection."
        );
        return;
      }

      saveRoute(data.route);
      setRouteFeedback(buildRouteSuccessMessage(data.route));
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
              ? "Building route..."
              : latestRoute
                ? `Generated ${formatGeneratedTime(latestRoute.createdAt)}`
                : "Ready to search"}
          </span>
        </div>

        <div className="route-builder-layout">
          <div className="route-builder-main">
            {latestRoute?.generationSource === "ai-assisted" ? (
              <div className="route-feedback-banner">
                <strong>AI-powered route plan</strong>
                <span>
                  AI selected the maneuver strategy, drafted alternate nearby search anchors, and wrote the coaching summary. RoadReady only shows the route after map-verifying each stop and connecting it to road directions.
                </span>
              </div>
            ) : null}
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
                <select
                  value={difficulty}
                  onChange={(event) => {
                    const nextDifficulty = event.target.value as DifficultyLevel;
                    setDifficulty(nextDifficulty);
                    updatePlanning({ preferredDifficulty: nextDifficulty });
                  }}
                >
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
              {isGeneratingRoute ? "Building route..." : "Generate recommended route"}
            </button>
            {isGeneratingRoute ? (
              <div className="route-generation-card" aria-live="polite">
                <div className="route-generation-spinner" aria-hidden="true" />
                <div className="route-generation-copy">
                  <strong>Building the route now</strong>
                  <span>
                    AI is planning the maneuver sequence, expanding nearby search options, and verifying each stop before RoadReady connects the full road route.
                  </span>
                </div>
              </div>
            ) : null}
            {routeFeedback ? (
              <div className="route-feedback-banner">
                <strong>{routeFeedback}</strong>
                <span>{buildRouteFeedbackDetail(latestRoute)}</span>
              </div>
            ) : null}
            {routeError ? (
              <div className="route-feedback-banner" style={{ borderColor: "rgba(248, 113, 113, 0.32)", background: "linear-gradient(180deg, rgba(127, 29, 29, 0.28), rgba(14, 27, 49, 0.92))" }}>
                <strong>Verified route unavailable</strong>
                <span>{routeError}</span>
              </div>
            ) : null}
            {state.planning.requireRouteApproval && latestRoute?.approvalStatus === "pending" ? (
              <div className="route-feedback-banner">
                <strong>Waiting for parent approval</strong>
                <span>
                  {account.role === "parent"
                    ? "Review this route in Parent View and approve, reject, or request changes."
                    : "This route stays in review until a parent or instructor approves it."}
                </span>
              </div>
            ) : null}
          </div>

          <aside className="route-builder-sidebar">
            <div className="route-callout-card">
              <span className="eyebrow">How it works</span>
              <strong>AI plan, map verify, drive</strong>
              <p className="subtle-text">
                Live place suggestions get you to the right area, AI plans the best nearby maneuver mix, and RoadReady verifies every stop before drawing the route.
              </p>
            </div>
            <div className="route-callout-card">
              <span className="eyebrow">Best results</span>
              <strong>Give the AI a strong starting point</strong>
              <p className="subtle-text">
                Real intersections, neighborhood entries, and freeway access roads give the planner better nearby maneuvers to verify.
              </p>
            </div>
            <div className="route-callout-card">
              <span className="eyebrow">Approval flow</span>
              <strong>{state.planning.requireRouteApproval ? "Parent approval is on" : "Route approval is optional"}</strong>
              <p className="subtle-text">
                {state.planning.requireRouteApproval
                  ? "Newly generated routes stay pending until a parent or instructor approves them."
                  : "Generated routes are ready to use as soon as they are created."}
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
                  {latestRoute.routingSource === "road-route" ? "Verified road route" : "Legacy fallback"}
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
                <span className="route-engine-pill">{latestRoute.approvalStatus.replace("_", " ")}</span>
                {latestRoute.generationSource === "ai-assisted" ? (
                  <span className="route-ai-pill">AI planner + map verification</span>
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
            {latestRoute.coachNote ? (
              <p className="insight-block" style={{ marginTop: 12 }}>
                Coach note: {latestRoute.coachNote}
              </p>
            ) : null}
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
                          <span className="route-warning-pill">Legacy approximate stop</span>
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
                        <span className="route-warning-pill">Legacy approximate stop</span>
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
