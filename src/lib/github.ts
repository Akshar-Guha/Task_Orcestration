/**
 * GitHub API Wrapper
 * 
 * Handles all GitHub API interactions for syncing data to Obsidian vault.
 * Uses GitHub REST API to create/update/delete files.
 */

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

interface GitHubFile {
  path: string;
  content: string;
  sha?: string;
}

interface GitHubFileResponse {
  content: {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string;
    type: string;
    content: string;
    encoding: string;
  };
  commit: {
    sha: string;
    message: string;
  };
}

interface GitHubError {
  message: string;
  documentation_url?: string;
}

class GitHubAPI {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor() {
    this.config = {
      token: process.env.GITHUB_TOKEN || '',
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      branch: process.env.GITHUB_BRANCH || 'main',
    };
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  /**
   * Check if GitHub is configured
   */
  isConfigured(): boolean {
    return !!(this.config.token && this.config.owner && this.config.repo);
  }

  /**
   * Get file content from GitHub
   */
  async getFile(path: string): Promise<{ content: string; sha: string } | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`,
        { headers: this.headers }
      );

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);

      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      return { content, sha: data.sha };
    } catch (error) {
      console.error('[GitHub] Failed to get file:', path, error);
      return null;
    }
  }

  /**
   * Create or update a file in GitHub
   */
  async upsertFile(file: GitHubFile, message: string): Promise<GitHubFileResponse | null> {
    if (!this.isConfigured()) {
      console.warn('[GitHub] Not configured, skipping upsert');
      return null;
    }

    try {
      // Get existing file SHA if updating
      let sha = file.sha;
      if (!sha) {
        const existing = await this.getFile(file.path);
        sha = existing?.sha;
      }

      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${file.path}`,
        {
          method: 'PUT',
          headers: this.headers,
          body: JSON.stringify({
            message,
            content: Buffer.from(file.content).toString('base64'),
            branch: this.config.branch,
            ...(sha && { sha }),
          }),
        }
      );

      if (!response.ok) {
        const error: GitHubError = await response.json();
        throw new Error(`GitHub API error: ${error.message}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[GitHub] Failed to upsert file:', file.path, error);
      return null;
    }
  }

  /**
   * Delete a file from GitHub (move to trash folder instead)
   */
  async softDeleteFile(path: string, message: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      // Get the file first
      const existing = await this.getFile(path);
      if (!existing) return true; // Already deleted

      // Move to trash instead of hard delete
      const trashPath = `trash/${path}`;
      await this.upsertFile(
        { path: trashPath, content: existing.content },
        `[MTO] Move to trash: ${path}`
      );

      // Now delete original
      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`,
        {
          method: 'DELETE',
          headers: this.headers,
          body: JSON.stringify({
            message,
            sha: existing.sha,
            branch: this.config.branch,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('[GitHub] Failed to delete file:', path, error);
      return false;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string): Promise<string[]> {
    if (!this.isConfigured()) return [];

    try {
      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`,
        { headers: this.headers }
      );

      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data)) return [];

      return data.map((item: { path: string }) => item.path);
    } catch (error) {
      console.error('[GitHub] Failed to list files:', path, error);
      return [];
    }
  }

  /**
   * Batch upsert multiple files (with rate limiting)
   */
  async batchUpsert(
    files: GitHubFile[],
    messagePrefix: string,
    delayMs = 500
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const file of files) {
      const result = await this.upsertFile(
        file,
        `${messagePrefix}: ${file.path.split('/').pop()}`
      );
      
      if (result) {
        success++;
      } else {
        failed++;
      }

      // Rate limiting to avoid GitHub API limits
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { success, failed };
  }
}

// Export singleton instance
export const github = new GitHubAPI();

// Export types
export type { GitHubFile, GitHubFileResponse, GitHubConfig };
