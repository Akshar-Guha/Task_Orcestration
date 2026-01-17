/**
 * Khoj Configuration
 * 
 * Central configuration for Khoj AI integration.
 * All Khoj-related settings should be defined here.
 */

export const khojConfig = {
  // API Configuration
  url: process.env.KHOJ_URL || '',
  apiKey: process.env.KHOJ_API_KEY || '',
  
  // Endpoints
  endpoints: {
    search: '/api/search',
    content: '/api/content/computer',
    health: '/api/health',
    chat: '/api/chat',
  },
  
  // Sync Configuration
  sync: {
    // Tables to sync to Khoj
    tables: ['goals', 'tasks', 'memories', 'time_slots'],
    // Batch size for sync
    batchSize: 50,
    // Sync interval (in ms) - 5 minutes
    interval: 5 * 60 * 1000,
  },
  
  // Search Configuration
  search: {
    defaultLimit: 10,
    maxLimit: 50,
    minQueryLength: 2,
  },
  
  // LLM Configuration (Ollama on Oracle Cloud ARM64)
  llm: {
    provider: 'ollama',
    // Primary: RAG search and knowledge queries
    ragModel: 'qwen2.5:7b',  // ~5GB, proven with Khoj, excellent reasoning
    // Secondary: Morning briefing and summarization
    briefingModel: 'llama3.2:3b',  // ~2GB, fast, instruction-tuned for summaries
    // Ollama pull commands:
    // ollama pull qwen2.5:7b
    // ollama pull llama3.2:3b
    // Total RAM: ~7GB (fits well in 24GB Oracle Cloud)
  },
} as const;

export type KhojConfig = typeof khojConfig;
