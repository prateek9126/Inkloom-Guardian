import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'critical'
  | 'supported'
  | 'contradicted'
  | 'unverified'
  | 'review';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const getVariantStyles = (): string => {
    switch (variant) {
      case 'success':
      case 'supported':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'warning':
      case 'review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'danger':
      case 'contradicted':
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'info':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'unverified':
      case 'neutral':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${getVariantStyles()} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
};
