const POINTER_CATEGORIES = {
  category1: ['DLRL', 'HMI', 'Operating Systems', 'Data Warehousing and Mining', 'TCSCC', 'Computer Network'],
  category2: ['IPDL', 'NLP', 'OSINT'],
  category3: ['ESI', 'HWP', 'SCM', 'IoT', '3D Printing', 'E-Vehicle']
};

const CATEGORY_MULTIPLIERS = {
  category1: 3,
  category2: 1,
  category3: 2
};

const CATEGORY_TOTALS = {
  category1: 150,
  category2: 50,
  category3: 100
};

export function getPointerFromPercentage(percentage) {
  if (percentage >= 85) return 10;
  if (percentage >= 80) return 9;
  if (percentage >= 70) return 8;
  if (percentage >= 60) return 7;
  if (percentage >= 50) return 6;
  if (percentage >= 45) return 5;
  if (percentage >= 40) return 4;
  return 0; // Fail
}

export function getSubjectCategory(subject) {
  if (POINTER_CATEGORIES.category1.includes(subject)) return 'category1';
  if (POINTER_CATEGORIES.category2.includes(subject)) return 'category2';
  if (POINTER_CATEGORIES.category3.includes(subject)) return 'category3';
  return null;
}

export function calculateSubjectPointer(subject, exams) {
  // Sum all exam marks
  const totalMarks = Object.values(exams).reduce(
    (sum, mark) => sum + (typeof mark === 'number' ? mark : 0),
    0
  );
  
  // Round from 0.5 upwards
  const roundedMarks = Math.round(totalMarks);
  
  // Get the category to determine the total
  const category = getSubjectCategory(subject);
  if (!category) return 0;
  
  const categoryTotal = CATEGORY_TOTALS[category];
  
  // Calculate percentage
  const percentage = (roundedMarks / categoryTotal) * 100;
  
  return getPointerFromPercentage(percentage);
}

export function calculateOverallPointer(subjects) {
  let totalWeightedPointer = 0;
  
  Object.entries(subjects).forEach(([subject, exams]) => {
    const category = getSubjectCategory(subject);
    if (!category) return;
    
    const pointer = calculateSubjectPointer(subject, exams);
    const multiplier = CATEGORY_MULTIPLIERS[category];
    
    totalWeightedPointer += pointer * multiplier;
  });
  
  // Divide by 20 to get overall pointer
  const overallPointer = totalWeightedPointer / 20;
  
  return overallPointer.toFixed(2);
}