/**
 * Khoj API Client
 * 
 * Server-side client for interacting with Khoj AI.
 * This client should ONLY be used in server-side code (API routes, server components).
 */

import { khojConfig } from '../config/khoj.config';

interface SearchResult {
  title?: string;
  content: string;
  score: number;
  source?: string;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

interface SyncFile {
  path: string;
  content: string;
}

interface SyncResponse {
  success: boolean;
  indexed: number;
  error?: string;
}

class KhojClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = khojConfig.url;
    this.apiKey = khojConfig.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Khoj not configured. Set KHOJ_URL and KHOJ_API_KEY.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Khoj API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string }> {
    return this.request(khojConfig.endpoints.health);
  }

  /**
   * Semantic search across all indexed content
   */
  async search(query: string, limit?: number): Promise<SearchResponse> {
    const n = Math.min(
      limit || khojConfig.search.defaultLimit,
      khojConfig.search.maxLimit
    );

    return this.request(khojConfig.endpoints.search, {
      method: 'POST',
      body: JSON.stringify({ q: query, n }),
    });
  }

  /**
   * Push files to Khoj for indexing
   */
  async syncFiles(files: SyncFile[]): Promise<SyncResponse> {
    return this.request(khojConfig.endpoints.content, {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  }

  /**
   * Delete a file from Khoj index
   */
  async deleteFile(path: string): Promise<{ success: boolean }> {
    return this.request(khojConfig.endpoints.content, {
      method: 'DELETE',
      body: JSON.stringify({ path }),
    });
  }

  /**
   * Chat with Khoj (uses placeholder for now, will use Ollama later)
   */
  async chat(message: string, context?: string): Promise<{ response: string }> {
    // PLACEHOLDER: Will be replaced with proper Ollama/HuggingFace integration
    console.log('[Khoj] Chat is placeholder - will integrate HuggingFace LLM via Ollama');
    
    return {
      response: `[PLACEHOLDER] Chat functionality will use HuggingFace LLM via Ollama. Query: "${message}"`
    };
  }
}

// Export singleton instance
export const khojClient = new KhojClient();
