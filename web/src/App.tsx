import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { useStore } from './lib/store';
import { BottomNav } from './components/BottomNav';
import { Home } from './screens/Home';
import { Learn } from './screens/Learn';
import { Lesson } from './screens/Lesson';
import { Practice, PRACTICE_MODES, type PracticeMode } from './screens/Practice';
import { DailyTest } from './screens/DailyTest';
import { Chart } from './screens/Chart';
import { KanaDetail } from './screens/KanaDetail';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { Pin } from './screens/Pin';

export function App() {
  const [page = '', param] = useRoute();
  const theme = useStore((s) => s.settings.theme);
  const status = useStore((s) => s.syncStatus);

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (status === 'auth') return <div className="app fullscreen"><Pin /></div>;

  const practiceMode = PRACTICE_MODES.includes(param as PracticeMode) ? (param as PracticeMode) : undefined;
  const fullscreen = page === 'lesson' || page === 'test' || (page === 'practice' && !!practiceMode);

  let screen;
  switch (page) {
    case 'learn': screen = <Learn />; break;
    case 'lesson': screen = <Lesson key={param} id={param} />; break;
    case 'practice': screen = <Practice key={param ?? ''} mode={practiceMode} />; break;
    case 'test': screen = <DailyTest />; break;
    case 'chart': screen = <Chart />; break;
    case 'kana': screen = <KanaDetail key={param} char={param} />; break;
    case 'stats': screen = <Stats />; break;
    case 'settings': screen = <Settings />; break;
    default: screen = <Home />;
  }

  return (
    <>
      <main className={`app ${fullscreen ? 'fullscreen' : ''}`}>{screen}</main>
      {!fullscreen && <BottomNav current={page === 'kana' ? 'chart' : page === 'settings' ? '' : page} />}
    </>
  );
}
