export interface LocationSuggestion {
  id: string;
  value: string;
  label: string;
  detail: string;
  latitude: number;
  longitude: number;
}

type PhotonFeature = {
  properties?: {
    osm_id?: number | string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

function cleanParts(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

function formatPhotonLabel(feature: PhotonFeature) {
  const props = feature.properties ?? {};
  const streetLine = cleanParts([
    [props.housenumber, props.street].filter(Boolean).join(" ").trim() || undefined
  ])[0];

  return cleanParts([props.name, streetLine, props.city ?? props.district ?? props.county]).join(", ");
}

function formatPhotonDetail(feature: PhotonFeature) {
  const props = feature.properties ?? {};
  return cleanParts([props.state, props.postcode, props.country]).join(", ");
}

function formatPhotonValue(feature: PhotonFeature) {
  const props = feature.properties ?? {};
  const streetLine = cleanParts([
    [props.housenumber, props.street].filter(Boolean).join(" ").trim() || undefined
  ])[0];

  return cleanParts([
    streetLine,
    props.name && props.name !== streetLine ? props.name : undefined,
    props.city ?? props.district ?? props.county,
    props.state,
    props.postcode,
    props.country
  ]).join(", ");
}

export async function searchLocationSuggestions(
  query: string,
  anchor?: { latitude: number; longitude: number }
): Promise<LocationSuggestion[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  const url = new URL("https://photon.komoot.io/api");
  url.searchParams.set("limit", "6");
  url.searchParams.set("q", trimmedQuery);
  url.searchParams.set("lang", "en");
  url.searchParams.set("location_bias_scale", "0.2");
  url.searchParams.set("zoom", "10");
  url.searchParams.set("dedupe", "1");

  if (anchor) {
    url.searchParams.set("lat", String(anchor.latitude));
    url.searchParams.set("lon", String(anchor.longitude));
  }

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "RoadReady/0.1 (location search)"
    },
    next: {
      revalidate: 0
    }
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    features?: PhotonFeature[];
  };
  const features = Array.isArray(data.features) ? data.features : [];
  const seen = new Set<string>();

  return features
    .filter((feature) => {
      const coordinates = feature.geometry?.coordinates;
      const id = String(feature.properties?.osm_id ?? "");

      if (!coordinates || coordinates.length < 2 || !id || seen.has(id)) {
        return false;
      }

      const [longitude, latitude] = coordinates;
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return false;
      }

      seen.add(id);
      return true;
    })
    .map((feature) => {
      const [longitude, latitude] = feature.geometry!.coordinates!;
      const label = formatPhotonLabel(feature);
      const value = formatPhotonValue(feature);

      return {
        id: String(feature.properties?.osm_id),
        value: value || label,
        label: label || value || trimmedQuery,
        detail: formatPhotonDetail(feature),
        latitude,
        longitude
      };
    })
    .filter((suggestion) => {
      if (!suggestion.value) {
        return false;
      }

      if (seen.has(`mapped:${suggestion.id}`)) {
        return false;
      }

      seen.add(`mapped:${suggestion.id}`);
      return true;
    });
}
