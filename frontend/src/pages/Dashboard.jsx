import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardHeader } from '../components/DashboardHeader';
import { SimpleAccordion } from '../components/SimpleAccordion';
import { StudentCard } from '../components/StudentCard';
import { CommandKSearch } from '../components/CommandKSearch';
import { calculateOverallPointer } from '../utils/pointerCalculations';

export function Dashboard({ 
  studentsWithMarks, 
  searchQuery, 
  setSearchQuery, 
  sortBy, 
  setSortBy, 
  onCompareClick 
}) {
  const [openedStudentPrn, setOpenedStudentPrn] = React.useState(null);
  const [isCommandKOpen, setIsCommandKOpen] = React.useState(false);

  // Get all unique subjects
  const allSubjects = React.useMemo(() => {
    const subjects = new Set();
    studentsWithMarks.forEach(student => {
      Object.keys(student.subjects || {}).forEach(subject => subjects.add(subject));
    });
    return Array.from(subjects).sort();
  }, [studentsWithMarks]);

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

  const filteredStudentsWithMarks = React.useMemo(() => {
    let filtered = studentsWithMarks;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(query) ||
          student.prn.toLowerCase().includes(query)
      );
    }
    
    // Apply sort
    if (sortBy !== 'none') {
      if (sortBy === 'highest' || sortBy === 'lowest') {
        filtered = [...filtered].sort((a, b) => {
          const getTotalMarks = (student) => {
            return Object.values(student.subjects || {}).reduce((total, exams) => {
              return total + Object.values(exams).reduce(
                (sum, mark) => sum + (typeof mark === 'number' ? mark : 0),
                0
              );
            }, 0);
          };
          
          const aTotal = getTotalMarks(a);
          const bTotal = getTotalMarks(b);
          
          return sortBy === 'highest' ? bTotal - aTotal : aTotal - bTotal;
        });
      } else if (sortBy === 'pointer') {
        // Sort by overall pointer
        filtered = [...filtered].sort((a, b) => {
          const aPointer = parseFloat(calculateOverallPointer(a.subjects));
          const bPointer = parseFloat(calculateOverallPointer(b.subjects));
          return bPointer - aPointer; // Highest pointer first
        });
      } else if (sortBy.startsWith('subject:')) {
        const subject = sortBy.replace('subject:', '');
        // Filter students who have this subject
        filtered = filtered.filter(student => student.subjects[subject]);
        // Sort by marks in this subject
        filtered = [...filtered].sort((a, b) => {
          const getTotalMarksForSubject = (student) => {
            return Object.values(student.subjects[subject] || {}).reduce(
              (sum, mark) => sum + (typeof mark === 'number' ? mark : 0),
              0
            );
          };
          
          const aTotal = getTotalMarksForSubject(a);
          const bTotal = getTotalMarksForSubject(b);
          
          return bTotal - aTotal; // Highest first
        });
      }
    }
    
    return filtered;
  }, [studentsWithMarks, searchQuery, sortBy]);

  const handleSelectStudent = (student) => {
    setOpenedStudentPrn(student.prn);
    // Small delay to ensure the accordion has time to open
    setTimeout(() => {
      const element = document.getElementById(student.prn);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  return (
    <div className="min-h-screen bg-background">
      <CommandKSearch
        isOpen={isCommandKOpen}
        onClose={() => setIsCommandKOpen(false)}
        students={studentsWithMarks}
        onSelectStudent={handleSelectStudent}
      />

      <DashboardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onCompareClick={onCompareClick}
        onSearchClick={() => {
          // Only open command K modal on desktop
          if (window.innerWidth >= 640) {
            setIsCommandKOpen(true);
          }
        }}
        allSubjects={allSubjects}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
        <SimpleAccordion>
          {filteredStudentsWithMarks.map((student, index) => (
            <StudentCard
              key={student.prn}
              student={student}
              index={index}
              sortBy={sortBy}
              isOpen={openedStudentPrn === student.prn}
              onOpen={() => setOpenedStudentPrn(student.prn)}
            />
          ))}
        </SimpleAccordion>

        {filteredStudentsWithMarks.length === 0 && searchQuery && (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-muted-foreground">No students found matching "{searchQuery}"</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
