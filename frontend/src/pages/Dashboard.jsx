import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardHeader } from '../components/DashboardHeader';
import { SimpleAccordion } from '../components/SimpleAccordion';
import { StudentCard } from '../components/StudentCard';
import { CommandKSearch } from '../components/CommandKSearch';
import { SiteFooter } from '@/components/SiteFooter';
import { usePaginatedMarks, useStudentList } from '../hooks/usePaginatedMarks';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Dashboard({ 
  searchQuery, 
  setSearchQuery, 
  sortBy, 
  setSortBy, 
  onCompareClick,
  isAuthenticated,
  setIsAuthenticated,
}) {
  const [openedStudentPrn, setOpenedStudentPrn] = React.useState(null);
  const [isCommandKOpen, setIsCommandKOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const pageSize = 20;
  const studentRefs = React.useRef({});
  const isInitialMount = React.useRef(true);

  // Debounce search so we don't call the API on every keystroke
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when search or sort changes
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy]);

  // Scroll to top smoothly when page changes
  React.useEffect(() => {
    // Skip scroll on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // Paginated marks (server-side sort + search + pagination)
  const {
    students: pageStudents,
    total,
    totalPages,
    isLoading,
    isFetching,
  } = usePaginatedMarks(isAuthenticated, setIsAuthenticated, {
    page,
    pageSize,
    sortBy,
    search: debouncedSearch,
  });

  // Lightweight student list for Command-K search
  const { students: allStudentNames } = useStudentList(isAuthenticated, setIsAuthenticated);

  // Get all unique subjects from the current page (for subject sort dropdown)
  const allSubjects = React.useMemo(() => {
    // Use the full student list subjects if available from any page
    const subjects = new Set();
    pageStudents.forEach(student => {
      Object.keys(student.subjects || {}).forEach(subject => subjects.add(subject));
    });
    return Array.from(subjects).sort();
  }, [pageStudents]);

  React.useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (window.innerWidth >= 640) {
          setIsCommandKOpen(true);
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelectStudent = (student) => {
    // Set search to student's name so the paginated API returns them
    setSearchQuery(student.name);
    setPage(1);
    setOpenedStudentPrn(student.prn);
    
    // Scroll to student after data loads
    setTimeout(() => {
      const element = studentRefs.current[student.prn];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 400);
  };

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CommandKSearch
        isOpen={isCommandKOpen}
        onClose={() => setIsCommandKOpen(false)}
        students={allStudentNames}
        onSelectStudent={handleSelectStudent}
        currentSearch={searchQuery}
        onClearSearch={() => {
          setSearchQuery('');
          setPage(1);
          setOpenedStudentPrn(null);
        }}
      />

      <DashboardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onCompareClick={onCompareClick}
        onSearchClick={() => {
          if (window.innerWidth >= 640) {
            setIsCommandKOpen(true);
          }
        }}
        allSubjects={allSubjects}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6 space-y-4 sm:space-y-8 flex-1 w-full">
        <SimpleAccordion>
          {pageStudents.map((student, index) => (
            <div key={student.prn} ref={(el) => (studentRefs.current[student.prn] = el)}>
              <StudentCard
                student={student}
                index={(page - 1) * pageSize + index}
                sortBy={sortBy}
                isOpen={openedStudentPrn === student.prn}
                onOpen={() => setOpenedStudentPrn(student.prn)}
              />
            </div>
          ))}
        </SimpleAccordion>

        {pageStudents.length === 0 && debouncedSearch && (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-muted-foreground">No students found matching "{debouncedSearch}"</p>
            </CardContent>
          </Card>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2 pb-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  // Show first, last, current, and neighbors
                  if (p === 1 || p === totalPages) return true;
                  if (Math.abs(p - page) <= 1) return true;
                  return false;
                })
                .reduce((acc, p, idx, arr) => {
                  // Insert ellipsis between gaps
                  if (idx > 0 && p - arr[idx - 1] > 1) {
                    acc.push('...' + p);
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item) => {
                  if (typeof item === 'string') {
                    return (
                      <span key={item} className="px-1 text-muted-foreground text-sm">
                        …
                      </span>
                    );
                  }
                  return (
                    <Button
                      key={item}
                      variant={item === page ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </Button>
                  );
                })}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4 sm:ml-1" />
            </Button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
