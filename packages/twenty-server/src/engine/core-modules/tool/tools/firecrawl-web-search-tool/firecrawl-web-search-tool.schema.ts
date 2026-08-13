import { z } from 'zod';

export const FirecrawlWebSearchInputZodSchema = z.object({
  query: z
    .string()
    .describe('The search query to find relevant information, leads, or companies on the web.'),
});

export type FirecrawlWebSearchInput = z.infer<
  typeof FirecrawlWebSearchInputZodSchema
>;
