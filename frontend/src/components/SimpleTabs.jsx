import React from 'react';

export function SimpleTabs({ tabs, defaultTab }) {
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  if (!tabs || tabs.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b pb-2 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}
