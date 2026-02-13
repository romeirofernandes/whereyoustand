import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users } from 'lucide-react';

export function DashboardHeader({ 
  searchQuery, 
  onSearchChange, 
  sortBy, 
  onSortChange, 
  onCompareClick,
  onSearchClick,
  allSubjects = []
}) {
  return (
    <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Where You Stand
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">Real-time academic performance tracking</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={onSearchClick}
              className="relative flex-1 sm:flex-initial sm:w-64 md:w-80 hidden sm:block"
            >
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-16 py-5 w-full"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-muted border rounded text-xs font-mono pointer-events-none hidden sm:inline-block">
                ⌘ K
              </kbd>
            </button>
            
            {/* Mobile search input */}
            <div className="relative flex-1 sm:hidden">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 py-5 w-full"
              />
            </div>

            <div className="flex gap-3">
              <Select value={sortBy} onValueChange={onSortChange}>
                <SelectTrigger className="w-[140px] py-5 sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sort by</SelectItem>
                  <SelectItem value="highest">Highest Total</SelectItem>
                  <SelectItem value="lowest">Lowest Total</SelectItem>
                  <SelectItem value="pointer">Highest Pointer</SelectItem>
                  {allSubjects.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">By Subject</div>
                      {allSubjects.map(subject => (
                        <SelectItem key={subject} value={`subject:${subject}`}>
                          {subject.length > 20 ? subject.substring(0, 20) + '...' : subject}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>

              <Button 
                onClick={onCompareClick}
                className="py-5 whitespace-nowrap"
              >
                <Users className="w-4 h-4" />
                <span className="sm:inline">Compare</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
