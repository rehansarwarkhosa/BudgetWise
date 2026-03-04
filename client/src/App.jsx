import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SettingsProvider } from './context/SettingsContext';
import BottomNav from './components/BottomNav';
import Budget from './pages/Budget';
import Routines from './pages/Routines';
import Savings from './pages/Savings';
import History from './pages/History';
import Settings from './pages/Settings';
import Notes from './pages/Notes';
import Guide from './pages/Guide';

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--toast-bg)',
              color: 'var(--toast-text)',
              border: '1px solid var(--toast-border)',
              fontSize: '14px',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Budget />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/guide" element={<Guide />} />
        </Routes>
        <BottomNav />
      </SettingsProvider>
    </BrowserRouter>
  );
}
