// ========================================
// DIARY VALIDATION SCHEMAS (Zod)
// Part of: Refined Lifetime Goal Tracking System
// ========================================

import { z } from 'zod';

// ========================================
// BASE SCHEMAS
// ========================================

export const moodSchema = z.number().int().min(1).max(5);
export const energyLevelSchema = z.number().int().min(1).max(10);

export const questionCategorySchema = z.enum([
  'general',
  'reflection',
  'productivity',
  'goals',
  'habits',
  'challenges',
  'gratitude',
  'planning',
]);

// ========================================
// PRODUCTIVITY DATA SCHEMA
// ========================================

export const productivityDataSchema = z.record(z.string(), z.number().nonnegative().optional());

// ========================================
// DAILY ENTRY SCHEMAS
// ========================================

export const createDailyEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mood: moodSchema.optional(),
  energyLevel: energyLevelSchema.optional(),
  summary: z.string().max(10000).optional(),
  wins: z.array(z.string().max(500)).max(20).optional(),
  challenges: z.array(z.string().max(500)).max(20).optional(),
  productivityData: productivityDataSchema.optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateDailyEntrySchema = createDailyEntrySchema.partial().extend({
  id: z.string().uuid(),
});

// ========================================
// QUESTION SCHEMAS
// ========================================

export const adaptiveRuleSchema = z.object({
  triggerField: z.string().optional(),
  triggerContains: z.string().optional(),
  condition: z.string().optional(),
  value: z.unknown().optional(),
}).optional();

export const createQuestionSchema = z.object({
  questionText: z.string().min(1).max(1000),
  category: questionCategorySchema.optional().default('general'),
  isAdaptive: z.boolean().optional().default(false),
  adaptiveRule: adaptiveRuleSchema,
  displayOrder: z.number().int().nonnegative().optional().default(0),
});

// ========================================
// QUESTION ANSWER SCHEMAS
// ========================================

export const createQuestionAnswerSchema = z.object({
  entryId: z.string().uuid(),
  questionId: z.string().uuid(),
  answer: z.string().min(1).max(10000),
  metadata: z.object({
    confidence: z.number().min(0).max(1).optional(),
    extractedFrom: z.enum(['voice', 'text', 'llm']).optional(),
  }).optional(),
});

// ========================================
// IMAGE SCHEMAS
// ========================================

export const uploadImageSchema = z.object({
  entryId: z.string().uuid(),
  file: z.instanceof(File).refine(
    (file) => file.size <= 5 * 1024 * 1024,
    'File size must be less than 5MB'
  ).refine(
    (file) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
    'File must be an image (JPEG, PNG, GIF, or WebP)'
  ),
  caption: z.string().max(500).optional(),
});

// ========================================
// TYPE EXPORTS
// ========================================

export type CreateDailyEntryInput = z.infer<typeof createDailyEntrySchema>;
export type UpdateDailyEntryInput = z.infer<typeof updateDailyEntrySchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type CreateQuestionAnswerInput = z.infer<typeof createQuestionAnswerSchema>;
export type UploadImageInput = z.infer<typeof uploadImageSchema>;
