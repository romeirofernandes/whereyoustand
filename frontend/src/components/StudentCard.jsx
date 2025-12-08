import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar, Award } from 'lucide-react';
import { SimpleAccordionItem } from './SimpleAccordion';
import { SimpleTabs } from './SimpleTabs';
import { SubjectChart } from './SubjectChart';
import { calculateOverallPointer } from '../utils/pointerCalculations';

export function StudentCard({ 
  student, 
  index, 
  sortBy, 
  isOpen, 
  onOpen 
}) {
  const subjectTabs = Object.entries(student.subjects).map(([subject, exams]) => ({
    id: subject,
    label: subject.length > 25 ? subject.substring(0, 25) + '...' : subject,
    content: <SubjectChart subject={subject} exams={exams} />
  }));

  const overallPointer = React.useMemo(() => {
    return calculateOverallPointer(student.subjects);
  }, [student.subjects]);

  return (
    <SimpleAccordionItem
      key={student.prn}
      id={student.prn}
      defaultOpen={isOpen}
      onOpen={onOpen}
      trigger={
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-left w-full">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base sm:text-lg truncate flex items-center gap-2">
              {sortBy !== 'none' && (
                <span className="text-primary">{index + 1}.</span>
              )}
              {student.name}
            </h3>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
              <Calendar className="w-3 h-3 shrink-0" />
              <span className="truncate">
                Last updated: {student.updated_at
                  ? new Date(student.updated_at).toLocaleString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Never'}
              </span>
            </div>
          </div>
          {/* <div className="flex items-center gap-2 sm:gap-3">
            <Badge 
              variant="default" 
              className="self-start sm:ml-auto text-xs sm:text-sm shrink-0 bg-primary hover:bg-primary/90 flex items-center gap-1.5"
            >
              <span className="font-medium text-md">{overallPointer}</span>
            </Badge>
          </div> */}
        </div>
      }
      content={
        <SimpleTabs tabs={subjectTabs} defaultTab={subjectTabs[0]?.id} />
      }
    />
  );
}