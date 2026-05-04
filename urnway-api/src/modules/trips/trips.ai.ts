import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';

const itineraryDraftItemSchema = z.object({
  type: z.enum(['flight', 'hotel', 'activity', 'note', 'transport']),
  title: z.string().trim().min(1).max(80),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().trim(),
  note: z.string().trim(),
});

const itineraryDraftSchema = z.object({
  summary: z.string().trim().min(1).max(240),
  items: z.array(itineraryDraftItemSchema).min(1).max(24),
});

type GenerateTripItineraryDraftInput = {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budgetAmount: string;
  currency: string;
  note: string | null;
  preferences?: string;
};

const itineraryDraftJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'items'],
  properties: {
    summary: {
      type: 'string',
      description: 'A short explanation of the itinerary approach.',
    },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 24,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'date', 'location', 'note'],
        properties: {
          type: {
            type: 'string',
            enum: ['flight', 'hotel', 'activity', 'note', 'transport'],
          },
          title: {
            type: 'string',
          },
          date: {
            type: 'string',
            format: 'date',
          },
          location: {
            type: 'string',
          },
          note: {
            type: 'string',
          },
        },
      },
    },
  },
} as const;

function extractResponseText(responseJson: unknown) {
  if (
    responseJson &&
    typeof responseJson === 'object' &&
    'output_text' in responseJson &&
    typeof responseJson.output_text === 'string' &&
    responseJson.output_text.trim().length > 0
  ) {
    return responseJson.output_text;
  }

  if (
    responseJson &&
    typeof responseJson === 'object' &&
    'output' in responseJson &&
    Array.isArray(responseJson.output)
  ) {
    const outputParts: string[] = [];

    for (const outputItem of responseJson.output) {
      if (
        !outputItem ||
        typeof outputItem !== 'object' ||
        !('content' in outputItem) ||
        !Array.isArray(outputItem.content)
      ) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (!contentItem || typeof contentItem !== 'object') {
          continue;
        }

        if (
          'type' in contentItem &&
          contentItem.type === 'refusal' &&
          'refusal' in contentItem &&
          typeof contentItem.refusal === 'string'
        ) {
          throw new HttpError(
            502,
            `AI itinerary generation was refused: ${contentItem.refusal}`
          );
        }

        if (
          'type' in contentItem &&
          contentItem.type === 'output_text' &&
          'text' in contentItem &&
          typeof contentItem.text === 'string'
        ) {
          outputParts.push(contentItem.text);
        }
      }
    }

    if (outputParts.length > 0) {
      return outputParts.join('\n');
    }
  }

  throw new HttpError(
    502,
    'AI itinerary generation returned no structured text output'
  );
}

function isDateWithinTrip(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

export async function generateTripItineraryDraftWithAi(
  input: GenerateTripItineraryDraftInput
) {
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(
      503,
      'AI itinerary drafting is not configured on this API yet'
    );
  }

  const prompt = [
    `Trip name: ${input.title}`,
    `Destination: ${input.destination}`,
    `Dates: ${input.startDate} to ${input.endDate}`,
    `Budget: ${input.budgetAmount} ${input.currency}`,
    `Current trip note: ${input.note || 'None'}`,
    `Traveler preferences: ${input.preferences?.trim() || 'Balanced pace with a practical first draft'}`,
    'Generate a realistic day-by-day trip itinerary.',
    'Stay strictly within the provided trip dates.',
    'Return a mix of transport, flight, hotel, note, and activity items only when appropriate.',
    'Keep titles concise and keep location/note fields as empty strings when unknown.',
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'trip_itinerary_draft',
          strict: true,
          schema: itineraryDraftJsonSchema,
        },
      },
      temperature: 0.5,
      max_output_tokens: 2200,
    }),
  }).catch((error) => {
    throw new HttpError(
      502,
      error instanceof Error
        ? error.message
        : 'AI itinerary generation request failed'
    );
  });

  const responseJson = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const apiError =
      responseJson &&
      typeof responseJson === 'object' &&
      'error' in responseJson &&
      responseJson.error &&
      typeof responseJson.error === 'object' &&
      'message' in responseJson.error &&
      typeof responseJson.error.message === 'string'
        ? responseJson.error.message
        : 'AI itinerary generation failed';

    throw new HttpError(502, apiError);
  }

  const parsed = itineraryDraftSchema.parse(
    JSON.parse(extractResponseText(responseJson))
  );

  const items = parsed.items
    .filter((item) => isDateWithinTrip(item.date, input.startDate, input.endDate))
    .map((item) => ({
      draftId: randomUUID(),
      type: item.type,
      title: item.title.trim(),
      date: item.date,
      location: item.location.trim() || null,
      note: item.note.trim() || null,
    }));

  if (items.length === 0) {
    throw new HttpError(
      502,
      'AI itinerary generation returned no usable items within the trip dates'
    );
  }

  return {
    draft: {
      summary: parsed.summary.trim(),
      preferences: input.preferences?.trim() || null,
      generatedAt: new Date().toISOString(),
      model: env.OPENAI_MODEL,
      items,
      droppedItemCount: parsed.items.length - items.length,
    },
  };
}
