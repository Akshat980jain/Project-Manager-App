/**
 * Terminal Command History
 *
 * Persists command history to localStorage under a per-user key.
 * Exposes up()/down() for keyboard navigation.
 */

const MAX_HISTORY = 500;
const STORAGE_KEY_PREFIX = "devpilot_terminal_history_";

export class TerminalHistory {
  private entries: string[] = [];
  private cursor: number = -1; // -1 = not navigating
  private storageKey: string;

  constructor(userId: string) {
    this.storageKey = STORAGE_KEY_PREFIX + userId;
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed.slice(-MAX_HISTORY);
        }
      }
    } catch {
      this.entries = [];
    }
  }

  private save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {
      // localStorage full — evict oldest half
      this.entries = this.entries.slice(-Math.floor(MAX_HISTORY / 2));
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
      } catch {
        // Ignore if still fails
      }
    }
  }

  /** Append a new command. Resets cursor to end. */
  push(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Deduplicate consecutive identical entries
    if (this.entries[this.entries.length - 1] !== trimmed) {
      this.entries.push(trimmed);
      if (this.entries.length > MAX_HISTORY) {
        this.entries.shift();
      }
      this.save();
    }
    this.cursor = -1;
  }

  /** Navigate up (older) — returns the entry to show, or undefined if at start. */
  up(currentInput: string): string | undefined {
    if (this.entries.length === 0) return undefined;

    if (this.cursor === -1) {
      // Just started navigating — go to last entry
      this.cursor = this.entries.length - 1;
    } else if (this.cursor > 0) {
      this.cursor--;
    }

    return this.entries[this.cursor];
  }

  /** Navigate down (newer) — returns the entry to show, or empty string if past end. */
  down(): string {
    if (this.cursor === -1) return "";

    this.cursor++;

    if (this.cursor >= this.entries.length) {
      this.cursor = -1;
      return "";
    }

    return this.entries[this.cursor];
  }

  /** Reset cursor (called on any manual edit of the input) */
  resetCursor() {
    this.cursor = -1;
  }

  /** Get all entries (newest last) */
  getAll(): string[] {
    return [...this.entries];
  }

  /** Clear all history */
  clear() {
    this.entries = [];
    this.cursor = -1;
    localStorage.removeItem(this.storageKey);
  }
}
