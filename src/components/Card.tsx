import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[#111114] border border-[#1e1e24] rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}
