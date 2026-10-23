import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-slate-900 text-white hover:bg-slate-800 border-transparent shadow-sm focus:ring-slate-900';
      case 'secondary':
        return 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-sm focus:ring-slate-500';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700 border-transparent shadow-sm focus:ring-red-500';
      case 'outline':
        return 'bg-transparent text-slate-700 hover:bg-slate-100 border-slate-300 focus:ring-slate-500';
      case 'ghost':
        return 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent focus:ring-slate-500';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-2.5 py-1.5 text-xs';
      case 'lg':
        return 'px-5 py-2.5 text-base';
      default:
        return 'px-3.5 py-2 text-sm';
    }
  };

  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getVariantStyles()} ${getSizeStyles()} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : icon ? (
        <span className="mr-2 flex items-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
