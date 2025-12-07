import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { CustomTooltip } from './CustomTooltip';
import { calculateSubjectPointer } from '../utils/pointerCalculations';

const CHART_COLORS = {
  UT1: 'var(--color-chart-1)',
  UT2: 'var(--color-chart-2)',
  UT3: 'var(--color-chart-3)',
  SEE: 'var(--color-chart-4)',
};

export function SubjectChart({ subject, exams }) {
  const chartData = Object.entries(exams)
    .filter(([_, marks]) => marks !== null)
    .map(([examType, marks]) => ({
      name: examType,
      marks: marks,
      fill: CHART_COLORS[examType] || CHART_COLORS.UT1,
    }));

  const totalMarks = Object.values(exams).reduce(
    (sum, mark) => sum + (typeof mark === 'number' ? mark : 0),
    0
  );

  const pointer = calculateSubjectPointer(subject, exams);

  return (
    <div className="space-y-4">
      <div className="w-full h-48 sm:h-56 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="var(--muted-foreground)" 
              strokeOpacity={0.3}
            />
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'var(--foreground)', fontSize: 11 }}
            />
            <YAxis 
              domain={[0, 'auto']} 
              tick={{ fill: 'var(--foreground)', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="marks" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {Object.entries(exams).map(([examType, marks]) => (
          <div key={examType} className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">{examType}</div>
            <div className="text-lg font-semibold">
              {marks !== null ? marks : '-'}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 sm:pt-4 border-t space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-base sm:text-lg font-semibold">Total Marks</span>
          <Badge variant="default" className="text-sm sm:text-lg px-3 sm:px-4 py-1">
            {totalMarks}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-base sm:text-lg font-semibold">Pointer</span>
          <Badge variant="secondary" className="text-sm sm:text-lg px-3 sm:px-4 py-1">
            {pointer}
          </Badge>
        </div>
      </div>
    </div>
  );
}