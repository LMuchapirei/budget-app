import BudgetApp from './src/BudgetApp';
import { initSentry, wrapWithSentry } from './src/services/sentry';

initSentry();

function App() {
  return <BudgetApp />;
}

export default wrapWithSentry(App);
