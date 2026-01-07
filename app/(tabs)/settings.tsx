import { View, Text } from 'react-native';

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center p-6">
      <View className="bg-frost-100 dark:bg-frost-900 rounded-2xl p-8 items-center">
        <Text className="text-4xl mb-4">⚙️</Text>
        <Text className="text-2xl font-bold text-frost-800 dark:text-frost-200 mb-2">
          Settings
        </Text>
        <Text className="text-gray-600 dark:text-gray-400 text-center">
          Configure your Igloo app and key shares
        </Text>
      </View>
    </View>
  );
}
