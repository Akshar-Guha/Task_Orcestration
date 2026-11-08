/**
 * Markdown "## Body" section for a day's notes (PLAN.md B6).
 * Pure, no DB imports, safe in browser and server code.
 *
 * PRIVACY: this section is for the user-controlled Obsidian vault / self-hosted
 * Khoj only. Never include it in prompts sent to Groq or any LLM; use
 * stripBodySection() on any markdown that might be forwarded to one.
 */
import type { HealthDay } from './health/types';

export const BODY_SECTION_HEADING = '## Body';

export type BodyFields = Partial<
  Pick<
    HealthDay,
    | 'sleep_minutes'
    | 'sleep_score'
    | 'hrv_night'
    | 'rhr'
    | 'recovery'
    | 'readiness'
    | 'strain'
    | 'stress_avg'
    | 'high_stress_minutes'
    | 'bb_at_wake'
    | 'illness_flag'
  >
>;

/** Columns to select from health_day for the Body section. */
export const BODY_COLUMNS =
  'date,sleep_minutes,sleep_score,hrv_night,rhr,recovery,readiness,strain,stress_avg,high_stress_minutes,bb_at_wake,illness_flag';

const r = (v: number) => Math.round(v);

/** Returns the "## Body" markdown block, or '' when there is no data. */
export function bodySectionMarkdown(h: BodyFields | null | undefined): string {
  if (!h) return '';
  const lines: string[] = [];
  if (h.sleep_minutes != null) {
    const dur = `${Math.floor(h.sleep_minutes / 60)}h ${r(h.sleep_minutes % 60)}m`;
    lines.push(`- **Sleep:** ${dur}${h.sleep_score != null ? ` (score ${r(h.sleep_score)})` : ''}`);
  }
  if (h.hrv_night != null) lines.push(`- **HRV:** ${r(h.hrv_night)} ms`);
  if (h.rhr != null) lines.push(`- **Resting HR:** ${r(h.rhr)} bpm`);
  if (h.recovery != null) lines.push(`- **Recovery:** ${r(h.recovery)}/100`);
  if (h.readiness != null) lines.push(`- **Readiness:** ${r(h.readiness)}/100`);
  if (h.strain != null) lines.push(`- **Strain:** ${Math.round(h.strain * 10) / 10}/21`);
  if (h.stress_avg != null) {
    const high = h.high_stress_minutes != null ? ` (${r(h.high_stress_minutes)} min high)` : '';
    lines.push(`- **Stress:** avg ${r(h.stress_avg)}${high}`);
  }
  if (h.bb_at_wake != null) lines.push(`- **Body Battery at wake:** ${r(h.bb_at_wake)}`);
  if (h.illness_flag) lines.push(`- **Illness flag:** yes #illness`);
  if (lines.length === 0) return '';
  return `${BODY_SECTION_HEADING}\n${lines.join('\n')}\n`;
}

/** Removes a "## Body" section (up to the next "## " heading or end) from markdown. */
export function stripBodySection(markdown: string): string {
  return markdown.replace(/^## Body[^\n]*\n(?:(?!## )[^\n]*\n?)*/gm, '');
}
