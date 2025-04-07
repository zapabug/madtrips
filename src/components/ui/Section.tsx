import React, { ReactNode } from 'react';

/**
 * Reusable Section component for consistent UI sections used throughout the app
 * 
 * Provides a standard layout with title, description, and content area
 */
interface SectionProps {
  title: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

const Section: React.FC<SectionProps> = ({
  title,
  description,
  className = '',
  contentClassName = '',
  children
}) => {
  return (
    <section className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`}>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        {description && (
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            {description}
          </p>
        )}
      </div>
      
      <div className={`px-6 pb-6 ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
};

export default Section; 