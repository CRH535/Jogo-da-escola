import { createRoot } from 'react-dom/client';
import { App } from '../../client/src/app/App';
import '../../client/src/app/global.css';

// Regression harness for the stage-10 executor; production always selects rooms.
createRoot(document.getElementById('root')!).render(<App rooms={false} />);
