/**
 * Khoj Module Barrel Export
 * 
 * Clean exports for Khoj integration.
 * Import from '@/khoj' for all Khoj-related functionality.
 */

// Config
export { khojConfig } from './config/khoj.config';
export type { KhojConfig } from './config/khoj.config';

// Client
export { khojClient } from './lib/khoj-client';

// Converters
export {
  goalToMarkdown,
  taskToMarkdown,
  timeSlotToMarkdown,
  memoryToMarkdown,
  sleepLogToMarkdown,
} from './lib/markdown-converter';

// Components
export { default as SemanticSearch } from './components/SemanticSearch';
