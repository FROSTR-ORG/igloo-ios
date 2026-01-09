import { View, Text, Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';

interface SwitchProps extends Omit<RNSwitchProps, 'value' | 'onValueChange'> {
  label?: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function Switch({
  label,
  description,
  value,
  onValueChange,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <View className="flex-row items-center justify-between">
      {(label || description) && (
        <View className="flex-1 mr-4">
          {label && (
            <Text
              className={`
                text-base font-medium
                ${disabled ? 'text-gray-500' : 'text-gray-100'}
              `}
            >
              {label}
            </Text>
          )}
          {description && (
            <Text className="text-sm text-gray-400 mt-0.5">
              {description}
            </Text>
          )}
        </View>
      )}
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        // RNSwitch requires hex values - mapped from Tailwind colors
        trackColor={{
          false: '#374151', // Tailwind gray-700
          true: '#2563eb',  // Tailwind blue-600 (igloo-button primary)
        }}
        thumbColor={value ? '#ffffff' : '#6b7280'} // white : Tailwind gray-500
        ios_backgroundColor="#374151" // Tailwind gray-700
        {...props}
      />
    </View>
  );
}
