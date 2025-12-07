import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export function SimpleAccordion({ children }) {
  return <div className="space-y-4">{children}</div>;
}

export function SimpleAccordionItem({ id, trigger, content, defaultOpen = false, onOpen }) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    if (defaultOpen && !isOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && onOpen) {
      onOpen();
    }
  };

  return (
    <motion.div 
      className="border rounded-lg overflow-hidden bg-card" 
      id={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }} 
    >
      <button
        className="w-full px-4 sm:px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer flex items-center justify-between gap-4"
        onClick={handleToggle}
      >
        <div className="flex-1 min-w-0">
          {trigger}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }} 
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.6, ease: [0.25, 0.8, 0.25, 1] }, 
              opacity: { duration: 0.3, ease: "easeInOut" },
            }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-6 pb-6">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
