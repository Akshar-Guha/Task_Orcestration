// ========================================
// DAILY DIARY SYSTEM TYPES
// Part of: Refined Lifetime Goal Tracking System
// ========================================

// Import and re-export MoodLevel from types.ts
import type { MoodLevel as MoodLevelType } from './types';
export type MoodLevel = MoodLevelType;

// ========================================
// ENUMS & BASE TYPES
// ========================================

export type QuestionCategory = 
  | 'general' 
  | 'reflection' 
  | 'productivity' 
  | 'goals' 
  | 'habits' 
  | 'challenges' 
  | 'gratitude' 
  | 'planning';

export type EnergyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ========================================
// PRODUCTIVITY DATA (JSONB)
// ========================================

export interface ProductivityData {
  deep_work?: number;      // minutes
  shallow_work?: number;
  meetings?: number;
  exercise?: number;
  leisure?: number;
  waste?: number;
  [key: string]: number | undefined;  // Allow custom categories
}

// ========================================
// CORE ENTITIES
// ========================================

// Main daily entry record
export interface DailyEntry {
  id: string;
  userId: string;
  date: string;  // "2026-01-17"
  
  // Core metrics
  mood?: MoodLevel;
  energyLevel?: EnergyLevel;
  
  // Free-form reflection
  summary?: string;
  wins?: string[];
  challenges?: string[];
  
  // Flexible structured data
  productivityData: ProductivityData;
  customFields?: Record<string, unknown>;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Question bank (system + user-defined)
export interface Question {
  id: string;
  userId?: string;  // null = system question
  questionText: string;
  category: QuestionCategory;
  isAdaptive: boolean;
  adaptiveRule?: {
    triggerField?: string;
    triggerContains?: string;
    condition?: string;
    value?: unknown;
  };
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Answer to a question for a specific entry
export interface QuestionAnswer {
  id: string;
  entryId: string;
  questionId: string;
  answer: string;
  metadata?: {
    confidence?: number;
    extractedFrom?: 'voice' | 'text' | 'llm';
  };
  createdAt: string;
}

// Photo attachment for a diary entry
export interface DiaryImage {
  id: string;
  entryId: string;
  storagePath: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  caption?: string;
  createdAt: string;
}

// Reference table for productivity categories
export interface ProductivityCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isDefault: boolean;
  createdAt: string;
}

// ========================================
// INPUT TYPES
// ========================================

export interface CreateDailyEntryInput {
  date: string;
  mood?: MoodLevel;
  energyLevel?: EnergyLevel;
  summary?: string;
  wins?: string[];
  challenges?: string[];
  productivityData?: ProductivityData;
}

export interface UpdateDailyEntryInput extends Partial<CreateDailyEntryInput> {
  id: string;
}

export interface CreateQuestionInput {
  questionText: string;
  category?: QuestionCategory;
  isAdaptive?: boolean;
  adaptiveRule?: Question['adaptiveRule'];
  displayOrder?: number;
}

export interface CreateQuestionAnswerInput {
  entryId: string;
  questionId: string;
  answer: string;
  metadata?: QuestionAnswer['metadata'];
}

// ========================================
// STREAK & ANALYTICS
// ========================================

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate?: string;
}

export interface DiaryStats {
  totalEntries: number;
  entriesThisWeek: number;
  entriesThisMonth: number;
  averageMood?: number;
  averageEnergy?: number;
  streak: StreakInfo;
}

// ========================================
// DATABASE ROW TYPES (snake_case for Supabase)
// ========================================

export interface DailyEntryRow {
  id: string;
  user_id: string;
  date: string;
  mood: number | null;
  energy_level: number | null;
  summary: string | null;
  wins: string[] | null;
  challenges: string[] | null;
  productivity_data: ProductivityData;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionRow {
  id: string;
  user_id: string | null;
  question_text: string;
  category: string;
  is_adaptive: boolean;
  adaptive_rule: Record<string, unknown>;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionAnswerRow {
  id: string;
  entry_id: string;
  question_id: string;
  answer: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ImageRow {
  id: string;
  entry_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  created_at: string;
}

export interface ProductivityCategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  is_default: boolean;
  created_at: string;
}

// ========================================
// CONVERSION HELPERS
// ========================================

export function rowToDailyEntry(row: DailyEntryRow): DailyEntry {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    mood: row.mood as MoodLevel | undefined,
    energyLevel: row.energy_level as EnergyLevel | undefined,
    summary: row.summary ?? undefined,
    wins: row.wins ?? undefined,
    challenges: row.challenges ?? undefined,
    productivityData: row.productivity_data ?? {},
    customFields: row.custom_fields ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    questionText: row.question_text,
    category: row.category as QuestionCategory,
    isAdaptive: row.is_adaptive,
    adaptiveRule: row.adaptive_rule as Question['adaptiveRule'],
    displayOrder: row.display_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
