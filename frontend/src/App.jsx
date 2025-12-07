import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PasswordGate } from './components/PasswordGate';
import { Dashboard } from './pages/Dashboard';
import { ComparePage } from './pages/ComparePage';
import { useAuth } from './hooks/useAuth';
import { useStudentData } from './hooks/useStudentData';
import { Analytics } from "@vercel/analytics/react"

function App() {
  const { isAuthenticated, setIsAuthenticated } = useAuth();
  const { studentsWithMarks, isLoading } = useStudentData(isAuthenticated, setIsAuthenticated);
  const [currentView, setCurrentView] = React.useState('dashboard');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState('none');

  if (!isAuthenticated) {
    return <PasswordGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
          <Skeleton className="h-10 sm:h-12 w-48 sm:w-64" />
          <Skeleton className="h-64 sm:h-96 w-full" />
        </div>
      </div>
    );
  }

  if (currentView === 'compare') {
    return (
      <ComparePage 
        students={studentsWithMarks} 
        onBack={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <>
      <Analytics />
      <Dashboard
      studentsWithMarks={studentsWithMarks}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      sortBy={sortBy}
      setSortBy={setSortBy}
      onCompareClick={() => setCurrentView('compare')}
      />
    </>
  );
}

export default App;
