import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ArrowLeft, Users, X } from 'lucide-react';
import { CustomTooltip } from '../components/CustomTooltip';
import { useStudentData } from '../hooks/useStudentData';

const STUDENT_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
];

const ELECTIVE_GROUPS = {
  'PE-II': ['DLRL', 'HMI'],
  'PEL-II': ['IPDL', 'NLP', 'OSINT'],
  'Mandatory': ['ESI', 'HWP'],
  'OE-I': ['SCM', 'IoT', '3D Printing', 'E-Vehicle']
};

function getElectiveGroup(subject) {
  for (const [groupName, subjects] of Object.entries(ELECTIVE_GROUPS)) {
    if (subjects.includes(subject)) {
      return groupName;
    }
  }
  return null;
}

export function ComparePage({ onBack, isAuthenticated, setIsAuthenticated }) {
  const { studentsWithMarks: students, isLoading } = useStudentData(isAuthenticated, setIsAuthenticated);
  const [selectedStudents, setSelectedStudents] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredStudents = React.useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.prn.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const toggleStudent = (student) => {
    if (selectedStudents.find(s => s.prn === student.prn)) {
      setSelectedStudents(selectedStudents.filter(s => s.prn !== student.prn));
    } else if (selectedStudents.length < 4) {
      setSelectedStudents([...selectedStudents, student]);
    }
  };

  const comparisonData = React.useMemo(() => {
    if (selectedStudents.length === 0) return null;

    const allSubjects = new Set();
    const electiveGroupsUsed = new Set();

    selectedStudents.forEach(student => {
      Object.keys(student.subjects || {}).forEach(subject => {
        const electiveGroup = getElectiveGroup(subject);
        if (electiveGroup) {
          electiveGroupsUsed.add(electiveGroup);
        } else {
          allSubjects.add(subject);
        }
      });
    });

    const subjectComparisons = {};

    // Handle regular subjects
    allSubjects.forEach(subject => {
      const examTypes = new Set();
      selectedStudents.forEach(student => {
        if (student.subjects[subject]) {
          Object.keys(student.subjects[subject]).forEach(exam => examTypes.add(exam));
        }
      });

      const chartData = Array.from(examTypes).map(examType => {
        const dataPoint = { exam: examType };
        selectedStudents.forEach(student => {
          dataPoint[student.name] = student.subjects[subject]?.[examType] || 0;
        });
        return dataPoint;
      });

      subjectComparisons[subject] = chartData;
    });

    electiveGroupsUsed.forEach(groupName => {
      const electiveSubjects = ELECTIVE_GROUPS[groupName];
      const examTypes = new Set();

      const studentElectives = {};
      selectedStudents.forEach(student => {
        electiveSubjects.forEach(electiveSubject => {
          if (student.subjects[electiveSubject]) {
            studentElectives[student.name] = electiveSubject;
            Object.keys(student.subjects[electiveSubject]).forEach(exam => examTypes.add(exam));
          }
        });
      });

      const chartData = Array.from(examTypes).map(examType => {
        const dataPoint = { exam: examType };
        selectedStudents.forEach(student => {
          let marks = 0;
          for (const electiveSubject of electiveSubjects) {
            if (student.subjects[electiveSubject]?.[examType] !== undefined) {
              marks = student.subjects[electiveSubject][examType];
              break;
            }
          }
          dataPoint[student.name] = marks;
        });
        return dataPoint;
      });

      const subjectNames = selectedStudents
        .map(s => studentElectives[s.name] || '')
        .filter(Boolean)
        .join(' / ');

      subjectComparisons[subjectNames || groupName] = chartData;
    });

    return subjectComparisons;
  }, [selectedStudents]);

  const radarData = React.useMemo(() => {
    if (selectedStudents.length === 0) return [];

    const subjects = new Set();
    const electiveGroupsUsed = new Set();

    selectedStudents.forEach(student => {
      Object.keys(student.subjects || {}).forEach(subject => {
        const electiveGroup = getElectiveGroup(subject);
        if (electiveGroup) {
          electiveGroupsUsed.add(electiveGroup);
        } else {
          subjects.add(subject);
        }
      });
    });

    const dataPoints = [];

    // Add regular subjects
    subjects.forEach(subject => {
      const dataPoint = { 
        subject: subject.length > 15 ? subject.substring(0, 15) + '...' : subject 
      };
      selectedStudents.forEach(student => {
        const total = Object.values(student.subjects[subject] || {}).reduce(
          (sum, mark) => sum + (typeof mark === 'number' ? mark : 0),
          0
        );
        dataPoint[student.name] = total;
      });
      dataPoints.push(dataPoint);
    });

    // Add elective groups, but show each student's actual elective subject as the label
    electiveGroupsUsed.forEach(groupName => {
      const electiveSubjects = ELECTIVE_GROUPS[groupName];
      // Get the subject code for each student
      const studentElectives = {};
      selectedStudents.forEach(student => {
        electiveSubjects.forEach(electiveSubject => {
          if (student.subjects[electiveSubject]) {
            studentElectives[student.name] = electiveSubject;
          }
        });
      });

      // Compose a label like "DLRL / HMI"
      const label = selectedStudents
        .map(s => studentElectives[s.name] || '')
        .filter(Boolean)
        .join(' / ') || groupName;

      const dataPoint = { subject: label };
      selectedStudents.forEach(student => {
        let total = 0;
        for (const electiveSubject of electiveSubjects) {
          if (student.subjects[electiveSubject]) {
            total = Object.values(student.subjects[electiveSubject]).reduce(
              (sum, mark) => sum + (typeof mark === 'number' ? mark : 0),
              0
            );
            break;
          }
        }
        dataPoint[student.name] = total;
      });
      dataPoints.push(dataPoint);
    });

    return dataPoints;
  }, [selectedStudents]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button variant="secondary" size="sm" onClick={onBack} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Compare Students</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Select up to 4 students to compare
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-sm self-start sm:self-auto">
              {selectedStudents.length}/4 selected
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
        {/* Student Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Students</CardTitle>
            <CardDescription>Choose students to compare their marks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <Input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {filteredStudents.map((student) => {
                const isSelected = selectedStudents.find(s => s.prn === student.prn);
                const isDisabled = !isSelected && selectedStudents.length >= 4;
                return (
                  <button
                    key={student.prn}
                    onClick={() => toggleStudent(student)}
                    disabled={isDisabled}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : isDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="font-medium text-sm truncate">{student.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{student.prn}</div>
                  </button>
                );
              })}
            </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Comparison Results */}
        {selectedStudents.length > 0 && (
          <>
            {/* Show selected students on top with unselect option */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedStudents.map((student) => (
                <div
                  key={student.prn}
                  className="flex items-center gap-2 bg-muted/70 border rounded-lg px-3 py-1.5"
                >
                  <span className="font-medium truncate max-w-[120px]">{student.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setSelectedStudents(selectedStudents.filter((s) => s.prn !== student.prn))
                    }
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                    <span className="sr-only">Unselect</span>
                  </Button>
                </div>
              ))}
            </div>

            {/* Overall Performance Radar */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Performance</CardTitle>
                <CardDescription>Total marks comparison across all subjects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64 sm:h-80 md:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--muted-foreground)" strokeOpacity={0.3} />
                      <PolarAngleAxis 
                        dataKey="subject" 
                        tick={{ fill: 'var(--foreground)', fontSize: 11 }}
                      />
                      <PolarRadiusAxis 
                        tick={{ fill: 'var(--foreground)', fontSize: 10 }}
                      />
                      {selectedStudents.map((student, idx) => (
                        <Radar
                          key={student.prn}
                          name={student.name}
                          dataKey={student.name}
                          stroke={STUDENT_COLORS[idx]}
                          fill={STUDENT_COLORS[idx]}
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend 
                        wrapperStyle={{ fontSize: '12px' }}
                        iconType="circle"
                      />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Subject-wise Comparison */}
            {comparisonData && Object.entries(comparisonData).map(([subject, data]) => (
              <Card key={subject}>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">{subject}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-56 sm:h-64 md:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="var(--muted-foreground)" 
                          strokeOpacity={0.3}
                        />
                        <XAxis 
                          dataKey="exam" 
                          tick={{ fill: 'var(--foreground)', fontSize: 11 }}
                        />
                        <YAxis 
                          tick={{ fill: 'var(--foreground)', fontSize: 11 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                          wrapperStyle={{ fontSize: '12px' }}
                          iconType="circle"
                        />
                        {selectedStudents.map((student, idx) => (
                          <Bar
                            key={student.prn}
                            dataKey={student.name}
                            fill={STUDENT_COLORS[idx]}
                            radius={[4, 4, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {selectedStudents.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select students above to start comparing their performance</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
