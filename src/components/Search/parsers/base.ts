import { UiState } from 'instantsearch.js';
import { z } from 'zod';

const searchIndexes = ['models', 'images', 'articles', 'users'] as const;
export type SearchIndex = (typeof searchIndexes)[number];

export const searchParamsSchema = z.object({
  query: z.coerce.string().optional(),
  page: z.coerce.number().optional(),
});

export type InstantSearchRoutingParser = {
  parseURL: (params: { location: Location }) => UiState;
  routeToState: (routeState: UiState) => UiState;
  stateToRoute: (routeState: UiState) => UiState;
};
