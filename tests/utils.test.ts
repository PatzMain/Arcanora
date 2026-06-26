import { describe, it, expect } from 'vitest';
import { hpBar, progressBar, manaBar, staminaBar, petBar } from '../src/utils/embeds.js';

describe('Utility Systems — Embed Bars', () => {
  describe('hpBar', () => {
    it('should render correct filled/empty ratio at 50% HP', () => {
      // 5 out of 10 filled, 5 empty
      expect(hpBar(50, 100)).toBe('🟥🟥🟥🟥🟥⬛⬛⬛⬛⬛');
    });

    it('should render fully filled bar at 100% HP', () => {
      expect(hpBar(100, 100)).toBe('🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥');
    });

    it('should render fully empty bar at 0% HP', () => {
      expect(hpBar(0, 100)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
    });

    it('should gracefully handle negative current HP without throwing', () => {
      expect(hpBar(-20, 100)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
    });

    it('should gracefully handle current HP exceeding max HP without throwing', () => {
      expect(hpBar(150, 100)).toBe('🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥');
    });

    it('should gracefully handle max HP being zero or negative', () => {
      expect(hpBar(50, 0)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
      expect(hpBar(50, -10)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
    });

    it('should respect custom bar length', () => {
      expect(hpBar(2, 5, 5)).toBe('🟥🟥⬛⬛⬛');
    });
  });

  describe('progressBar', () => {
    it('should render correct filled/empty ratio', () => {
      expect(progressBar(5, 10)).toBe('🟨🟨🟨🟨🟨⬛⬛⬛⬛⬛');
    });

    it('should handle negative current value', () => {
      expect(progressBar(-5, 10)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
    });

    it('should handle current value exceeding total', () => {
      expect(progressBar(15, 10)).toBe('🟨🟨🟨🟨🟨🟨🟨🟨🟨🟨');
    });
  });

  describe('other bars', () => {
    it('should render manaBar with correct emojis', () => {
      expect(manaBar(50, 100)).toBe('🟦🟦🟦🟦🟦⬛⬛⬛⬛⬛');
    });

    it('should render staminaBar with correct emojis', () => {
      expect(staminaBar(50, 100)).toBe('🟪🟪🟪🟪🟪⬛⬛⬛⬛⬛');
    });

    it('should render petBar with correct emojis', () => {
      expect(petBar(50, 100)).toBe('🟩🟩🟩🟩🟩⬛⬛⬛⬛⬛');
    });
  });
});
