import { describe, expect, it } from 'vitest';
import { dayKey, newCard, review, streak } from '../web/src/lib/srs';

const DAY = 86_400_000;

describe('review', () => {
  it('moves up one box per correct answer with growing intervals', () => {
    const now = Date.UTC(2026, 0, 1);
    let c = newCard('あ', 'read', now);
    c = review(c, true, now);
    expect(c.box).toBe(1);
    expect(c.due).toBe(now + DAY);
    c = review(c, true, now);
    expect(c.box).toBe(2);
    expect(c.due).toBe(now + 3 * DAY);
    for (let i = 0; i < 10; i++) c = review(c, true, now);
    expect(c.box).toBe(5);
    expect(c.due).toBe(now + 30 * DAY);
    expect(c.correct).toBe(12);
  });

  it('drops back to box 1 and returns soon when wrong', () => {
    const now = Date.UTC(2026, 0, 1);
    let c = { ...newCard('あ', 'read', now), box: 4 };
    c = review(c, false, now);
    expect(c.box).toBe(1);
    expect(c.due - now).toBeLessThan(DAY);
    expect(c.wrong).toBe(1);
    expect(review(newCard('い', 'read', now), false, now).box).toBe(0);
  });
});

describe('streak', () => {
  const day = (offset: number, base = new Date(2026, 5, 10, 12)) =>
    dayKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset));
  const now = new Date(2026, 5, 10, 12).getTime();

  it('counts consecutive days ending today', () => {
    expect(streak([day(0), day(-1), day(-2), day(-4)], now)).toBe(3);
  });
  it('still counts when today has no activity yet', () => {
    expect(streak([day(-1), day(-2)], now)).toBe(2);
  });
  it('is zero after a missed day', () => {
    expect(streak([day(-2), day(-3)], now)).toBe(0);
  });
  it('works across month boundaries', () => {
    const base = new Date(2026, 6, 1, 9);
    expect(streak([day(0, base), day(-1, base), day(-2, base)], base.getTime())).toBe(3);
  });
});
