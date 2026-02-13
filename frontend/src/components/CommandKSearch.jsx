import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, X, Keyboard, ArrowUp, ArrowDown } from 'lucide-react';

export function CommandKSearch({ isOpen, onClose, students, onSelectStudent, currentSearch = '', onClearSearch }) {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null); 

  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      // Prefill with current search when opening
      setQuery(currentSearch);
    }
  }, [isOpen, currentSearch]);

  const filteredStudents = React.useMemo(() => {
    if (!query.trim()) return students.slice(0, 8);
    const q = query.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.prn.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [students, query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [filteredStudents]);

  React.useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const items = listRef.current.querySelectorAll('button');
    const el = items[selectedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, filteredStudents, isOpen]);

  React.useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredStudents.length - 1 ? prev + 1 : prev
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => prev > 0 ? prev - 1 : 0);
      }
      if (e.key === 'Enter' && filteredStudents.length > 0) {
        e.preventDefault();
        const selectedStudent = filteredStudents[selectedIndex];
        onSelectStudent(selectedStudent);
        onClose();
        setQuery('');
        setSelectedIndex(0);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', down);
      return () => document.removeEventListener('keydown', down);
    }
  }, [isOpen, onClose, onSelectStudent, filteredStudents, selectedIndex]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4 animate-in zoom-in-95 slide-in-from-top-[20%] duration-200">
        <Card className="shadow-2xl border-border/50">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search students by name or PRN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            />
            <button
              onClick={() => {
                if (query) {
                  setQuery('');
                  if (onClearSearch) onClearSearch();
                } else {
                  onClose();
                }
              }}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors shrink-0"
              title={query ? 'Clear search' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="max-h-96 overflow-y-auto" ref={listRef}>
            {filteredStudents.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                No students found
              </div>
            ) : (
              <div className="py-2">
                {filteredStudents.map((student, index) => (
                  <button
                    key={student.prn}
                    onClick={() => {
                      onSelectStudent(student);
                      onClose();
                      setQuery('');
                      setSelectedIndex(0);
                    }}
                    className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between group ${
                      index === selectedIndex 
                        ? 'bg-primary/10 border-l-2 border-primary' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{student.name}</div>
                      <div className="text-sm text-muted-foreground truncate">{student.prn}</div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 shrink-0 transition-opacity ${
                        index === selectedIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      8 subjects
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 pb-0 pt-4 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs font-mono flex items-center gap-0.5">
                    <ArrowUp className="w-3 h-3" />
                  </kbd>
                  <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs font-mono flex items-center gap-0.5">
                    <ArrowDown className="w-3 h-3" />
                  </kbd>
                </div>
                <span className="hidden sm:inline">Navigate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">↵</kbd>
                <span className="hidden sm:inline">Select</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">ESC</kbd>
              <span className="hidden sm:inline">Close</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
