import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppProvider } from './lib/state';
import type { PublicConfig } from './lib/types';
import { Admin } from './screens/Admin';
import { Go } from './screens/Go';
import { History } from './screens/History';
import { Landing } from './screens/Landing';
import { LocationScreen } from './screens/Location';
import { NotFound } from './screens/NotFound';
import { Opportunity } from './screens/Opportunity';
import { Results } from './screens/Results';
import { Settings } from './screens/Settings';
import { Tell } from './screens/Tell';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="tell" element={<Tell />} />
        <Route path="location" element={<LocationScreen />} />
        <Route path="results" element={<Results />} />
        <Route path="opportunity/:id" element={<Opportunity />} />
        <Route path="go/:id" element={<Go />} />
        <Route path="history" element={<History />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App({ initialConfig }: { initialConfig?: PublicConfig }) {
  return (
    <AppProvider initialConfig={initialConfig}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
