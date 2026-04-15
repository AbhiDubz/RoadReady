"use client";

import { useEffect } from "react";
import { divIcon, LatLngBounds, LatLngExpression } from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { isValidRoutePlan } from "@/lib/logic";
import { RoutePlan } from "@/lib/types";

const startIcon = divIcon({
  className: "route-marker-shell",
  html: '<div class="route-marker start">S</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

function createStopIcon(index: number) {
  return divIcon({
    className: "route-marker-shell",
    html: `<div class="route-marker stop">${index + 1}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function buildGoogleMapsUrl(latitude: number, longitude: number) {
  const query = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function describeStopVerification(stop: RoutePlan["segments"][number]) {
  return stop.verificationStatus === "verified"
    ? "Map-verified practice feature"
    : "Approximate practice area; preview this stop in Maps before driving it.";
}

function FitRouteBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 1) {
      const bounds = new LatLngBounds(points);
      map.fitBounds(bounds, { padding: [28, 28] });
    } else if (points[0]) {
      map.setView(points[0], 15);
    }
  }, [map, points]);

  return null;
}

export function PracticeMap({ route }: { route: RoutePlan }) {
  if (!isValidRoutePlan(route)) {
    return <div className="map-loading">Route coordinates are unavailable. Generate the route again.</div>;
  }

  const center: LatLngExpression = [route.startLatitude, route.startLongitude];
  const fallbackPath: LatLngExpression[] = [
    [route.startLatitude, route.startLongitude],
    ...route.segments.map((segment) => [segment.latitude, segment.longitude] as LatLngExpression),
    [route.startLatitude, route.startLongitude]
  ];
  const path: LatLngExpression[] =
    route.routePath?.map((point) => [point.latitude, point.longitude] as LatLngExpression) ?? fallbackPath;
  const allPoints: LatLngExpression[] = [
    ...path,
    center,
    ...route.segments.map((segment) => [segment.latitude, segment.longitude] as LatLngExpression)
  ];

  return (
    <div className="leaflet-shell">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="leaflet-map">
        <FitRouteBounds points={allPoints} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Polyline positions={path} pathOptions={{ color: "#2dd4bf", weight: 5, opacity: 0.85 }} />

        <Marker position={center} icon={startIcon}>
          <Popup>
            <strong>Start / finish</strong>
            <br />
            {route.startLocation}
            <br />
            {route.routingSource === "road-route" ? "Road-following route enabled" : "Straight-line fallback route"}
            <br />
            <a
              href={buildGoogleMapsUrl(route.startLatitude, route.startLongitude)}
              target="_blank"
              rel="noreferrer"
              className="route-link"
            >
              Open in Google Maps
            </a>
          </Popup>
        </Marker>

        {route.segments.map((segment, index) => (
          <Marker
            key={segment.id}
            position={[segment.latitude, segment.longitude]}
            icon={createStopIcon(index)}
          >
            <Popup>
              <strong>{segment.title}</strong>
              <br />
              {segment.address}
              <br />
              ETA: {segment.etaMinutes} min
              <br />
              {describeStopVerification(segment)}
              <br />
              <a
                href={buildGoogleMapsUrl(segment.latitude, segment.longitude)}
                target="_blank"
                rel="noreferrer"
                className="route-link"
              >
                Open in Google Maps
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
