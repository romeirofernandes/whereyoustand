import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PasswordGate } from './components/PasswordGate';
import { Dashboard } from './pages/Dashboard';
import { ComparePage } from './pages/ComparePage';
import { useAuth } from './hooks/useAuth';
import { Analytics } from "@vercel/analytics/react"

function App() {
  const { isAuthenticated, setIsAuthenticated } = useAuth();
  const [currentView, setCurrentView] = React.useState('dashboard');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState('none');

  if (!isAuthenticated) {
    return <PasswordGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  if (currentView === 'compare') {
    return (
      <ComparePage 
        onBack={() => setCurrentView('dashboard')}
        isAuthenticated={isAuthenticated}
        setIsAuthenticated={setIsAuthenticated}
      />
    );
  }

  return (
    <>
      <Analytics />
      <Dashboard
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onCompareClick={() => setCurrentView('compare')}
        isAuthenticated={isAuthenticated}
        setIsAuthenticated={setIsAuthenticated}
      />
    </>
  );
}

export default App;
