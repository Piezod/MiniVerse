/** Level story: timed or blocking dialogue lines triggered at the start or when the player enters a zone. */

export interface StoryLine {
  /** Speaker id (e.g. "luma", "piezod", "transmision"); shown in capitals. */
  speaker: string;
  text: string;
  /** Alternative text for touch devices (button names instead of keys). */
  touchText?: string;
  /** Seconds the line stays after it has been typed (default 2.2). */
  duration?: number;
}

export type StoryTrigger = { type: 'start' } | { type: 'event' } | { type: 'zone'; col: number; row: number; width: number; height: number };

export interface StoryBeat {
  id: string;
  trigger: StoryTrigger;
  /** Freezes the action until the player advances every line (ENTER, SPACE or tap). */
  blocking: boolean;
  /** Plays only once per level run (default true). */
  once: boolean;
  lines: StoryLine[];
}

export interface StoryIssue {
  index: number;
  message: string;
}
