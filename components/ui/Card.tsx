import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  variant?: 'default' | 'outlined' | 'elevated' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  default: 'bg-gray-800/50 border border-blue-900/30',
  outlined: 'bg-transparent border-2 border-blue-900/30',
  elevated: 'bg-gray-800/60 border border-blue-900/30 shadow-lg',
  glass: 'bg-gray-800/40 border border-blue-900/30 shadow-lg',
};

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <View
      className={`
        rounded-lg
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className || ''}
      `}
      {...props}
    >
      {children}
    </View>
  );
}
