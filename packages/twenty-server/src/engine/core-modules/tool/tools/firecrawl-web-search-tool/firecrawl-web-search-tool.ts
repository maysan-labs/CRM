import { Injectable } from '@nestjs/common';
import { isAxiosError } from 'axios';

import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { FirecrawlWebSearchInputZodSchema } from 'src/engine/core-modules/tool/tools/firecrawl-web-search-tool/firecrawl-web-search-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class FirecrawlWebSearchTool implements Tool {
  description =
    'Search the web using Firecrawl to find leads, research companies, and extract information. Returns the search results with raw markdown content.';
  inputSchema = FirecrawlWebSearchInputZodSchema;

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly secureHttpClientService: SecureHttpClientService,
  ) {}

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const { query } = parameters;

    try {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      const baseUrl = process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev';

      if (!apiKey) {
        return {
          success: false,
          message: 'Firecrawl API key is not configured in the server environment (FIRECRAWL_API_KEY).',
        };
      }

      const endpoint = `${baseUrl}/v1/search`;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };

      const httpClient = this.secureHttpClientService.getHttpClient();

      const response = await httpClient.post(
        endpoint,
        { 
          query, 
          limit: 3,
          scrapeOptions: {
            formats: ['markdown']
          }
        },
        { headers },
      );

      const results = response.data?.data || [];

      if (results.length === 0) {
        return {
          success: true,
          message: `No search results found on the web for "${query}"`,
          result: [],
        };
      }

      // We map the results to only include the URL, title, and markdown content
      // to avoid overwhelming the LLM context window.
      const conciseResults = results.map((r: any) => ({
        url: r.url,
        title: r.title,
        content: r.markdown,
      }));

      return {
        success: true,
        message: `Found ${results.length} relevant search results for "${query}"`,
        result: conciseResults,
      };
    } catch (error) {
      const errorDetail = isAxiosError(error)
        ? error.response?.data?.error || error.message
        : error instanceof Error
          ? error.message
          : 'Web search failed';

      return {
        success: false,
        message: `Failed to search the web for "${query}" using Firecrawl`,
        error: errorDetail,
      };
    }
  }
}
