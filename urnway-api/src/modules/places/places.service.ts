import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { isLiteApiConfigured, searchLiteApiHotelSuggestions } from '../bookings/liteapi.service.js';
import type { LocationSuggestion, LocationSuggestionScope } from '@urnway/contracts';
import { searchFlightLocationSuggestions } from './flight-locations.js';

type AutocompletePlacesInput = {
  q: string;
  scope: LocationSuggestionScope;
};

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      place?: string;
      placeId?: string;
      text?: {
        text?: string;
      };
      structuredFormat?: {
        mainText?: {
          text?: string;
        };
        secondaryText?: {
          text?: string;
        };
      };
    };
    queryPrediction?: {
      text?: {
        text?: string;
      };
    };
  }>;
  error?: {
    message?: string;
  };
};

const googlePlacesApiBaseUrl = 'https://places.googleapis.com/v1';

const fallbackTripLocations = [
  'London',
  'Paris',
  'Barcelona',
  'Madrid',
  'Lisbon',
  'Rome',
  'Dubai',
  'Lagos',
  'Abuja',
  'Accra',
  'Amsterdam',
  'Berlin',
  'Istanbul',
  'Nairobi',
  'New York',
];

function searchFallbackTripSuggestions(query: string): LocationSuggestion[] {
  const normalized = query.trim().toLowerCase();

  return fallbackTripLocations
    .filter((item) => item.toLowerCase().includes(normalized))
    .slice(0, 8)
    .map((item) => ({
      id: `trip:${item.toLowerCase().replace(/\s+/g, '-')}`,
      placeId: null,
      label: item,
      primaryText: item,
      secondaryText: null,
      searchValue: item,
      source: 'local',
    }));
}

async function googleAutocomplete(
  query: string,
  scope: Extract<LocationSuggestionScope, 'stay' | 'trip'>
) {
  if (!env.GOOGLE_MAPS_API_KEY) {
    return [];
  }

  const response = await fetch(`${googlePlacesApiBaseUrl}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.queryPrediction.text.text',
    },
    body: JSON.stringify({
      input: query,
      languageCode: 'en',
      ...(env.GOOGLE_MAPS_REGION_CODE
        ? { regionCode: env.GOOGLE_MAPS_REGION_CODE }
        : {}),
      includeQueryPredictions: scope !== 'stay',
    }),
  });

  const payload = (await response.json().catch(() => null)) as GoogleAutocompleteResponse | null;

  if (!response.ok) {
    throw new HttpError(
      response.status >= 400 && response.status < 600 ? response.status : 502,
      payload?.error?.message ?? 'Google Places autocomplete failed'
    );
  }

  return (payload?.suggestions ?? [])
    .map((suggestion, index): LocationSuggestion | null => {
      if (suggestion.placePrediction) {
        const primaryText =
          suggestion.placePrediction.structuredFormat?.mainText?.text ??
          suggestion.placePrediction.text?.text ??
          '';
        const secondaryText =
          suggestion.placePrediction.structuredFormat?.secondaryText?.text ?? null;
        const label =
          suggestion.placePrediction.text?.text ??
          [primaryText, secondaryText].filter(Boolean).join(', ');

        if (!label) {
          return null;
        }

        return {
          id: `google:${suggestion.placePrediction.placeId ?? index}`,
          placeId: suggestion.placePrediction.placeId ?? null,
          label,
          primaryText: primaryText || label,
          secondaryText,
          searchValue: label,
          source: 'google',
        };
      }

      if (suggestion.queryPrediction?.text?.text) {
        const label = suggestion.queryPrediction.text.text;

        return {
          id: `google-query:${index}:${label}`,
          placeId: null,
          label,
          primaryText: label,
          secondaryText: null,
          searchValue: label,
          source: 'google',
        };
      }

      return null;
    })
    .filter((suggestion): suggestion is LocationSuggestion => Boolean(suggestion))
    .slice(0, 8);
}

export async function autocompletePlaces(input: AutocompletePlacesInput) {
  const query = input.q.trim();

  let suggestions: LocationSuggestion[] = [];

  if (input.scope === 'flight') {
    suggestions = searchFlightLocationSuggestions(query);
  } else if (env.GOOGLE_MAPS_API_KEY) {
    suggestions = await googleAutocomplete(query, input.scope);
  } else if (input.scope === 'stay' && isLiteApiConfigured()) {
    suggestions = await searchLiteApiHotelSuggestions(query);
  } else {
    suggestions = searchFallbackTripSuggestions(query);
  }

  return {
    query: {
      q: query,
      scope: input.scope,
    },
    suggestions,
  };
}
