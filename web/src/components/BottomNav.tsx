const TABS = [
  { path: '', label: 'Home', ico: '🏠' },
  { path: 'learn', label: 'Learn', ico: '📚' },
  { path: 'practice', label: 'Practice', ico: '🎯' },
  { path: 'chart', label: 'Chart', ico: 'あ' },
  { path: 'stats', label: 'Stats', ico: '📈' },
];

export function BottomNav({ current }: { current: string }) {
  return (
    <nav className="bottom-nav">
      <ul>
        {TABS.map((t) => (
          <li key={t.path}>
            <a href={`#/${t.path}`} className={current === t.path ? 'active' : ''}>
              <span className={`ico ${t.ico === 'あ' ? 'kana' : ''}`}>{t.ico}</span>
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
