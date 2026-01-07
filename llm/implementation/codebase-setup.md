# Igloo iOS - Implementation Details

## Expo Router Architecture

Expo Router implements file-based routing, similar to Next.js. The file structure in `app/` directly maps to navigation routes.

### Route Hierarchy

```
app/
├── _layout.tsx          → Root layout (wraps everything)
├── (tabs)/              → Tab group (parentheses = layout group)
│   ├── _layout.tsx      → Tab navigator configuration
│   ├── signer.tsx       → /signer route
│   ├── sessions.tsx     → /sessions route
│   └── settings.tsx     → /settings route
├── +html.tsx            → Web-only HTML template
└── +not-found.tsx       → 404 catch-all route
```

### Special File Conventions

| File | Purpose |
|------|---------|
| `_layout.tsx` | Layout wrapper for sibling routes |
| `+html.tsx` | Web HTML document template |
| `+not-found.tsx` | Catch-all 404 route |
| `(group)/` | Layout group (no URL segment) |
| `[param].tsx` | Dynamic route parameter |

---

## App Layout Structure

### Root Layout (`app/_layout.tsx`)

The root layout handles global concerns:

```typescript
// 1. Import global CSS for NativeWind
import '../global.css';

// 2. Font loading
const [loaded, error] = useFonts({
  SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  ...FontAwesome.font,
});

// 3. Splash screen management
SplashScreen.preventAutoHideAsync();
useEffect(() => {
  if (loaded) SplashScreen.hideAsync();
}, [loaded]);

// 4. SafeAreaProvider + Theme provider wrapping navigation
<SafeAreaProvider>
  <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  </ThemeProvider>
</SafeAreaProvider>
```

**Key responsibilities:**
- Load custom fonts (SpaceMono) and icon fonts (FontAwesome)
- Manage splash screen visibility
- Provide safe area context (required by react-navigation)
- Provide theme context (light/dark)
- Define root navigation stack

### Tab Layout (`app/(tabs)/_layout.tsx`)

Configures the bottom tab navigator:

```typescript
function TabBarIcon(props: { name: FontAwesome['name']; color: string }) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

<Tabs screenOptions={{
  tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
  headerShown: true,
}}>
  <Tabs.Screen
    name="signer"
    options={{
      title: 'Signer',
      tabBarIcon: ({ color }) => <TabBarIcon name="key" color={color} />,
    }}
  />
  <Tabs.Screen
    name="sessions"
    options={{
      title: 'Sessions',
      tabBarIcon: ({ color }) => <TabBarIcon name="link" color={color} />,
    }}
  />
  <Tabs.Screen
    name="settings"
    options={{
      title: 'Settings',
      tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
    }}
  />
</Tabs>
```

**Tab icons:**
- Signer: `key` (FontAwesome)
- Sessions: `link` (FontAwesome)
- Settings: `cog` (FontAwesome)

---

## Tab Screens

### Screen Pattern

Each tab screen follows a consistent pattern using NativeWind:

```typescript
import { View, Text } from 'react-native';

export default function ScreenName() {
  return (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center p-6">
      <View className="bg-frost-100 dark:bg-frost-900 rounded-2xl p-8 items-center">
        <Text className="text-4xl mb-4">EMOJI</Text>
        <Text className="text-2xl font-bold text-frost-800 dark:text-frost-200 mb-2">
          Title
        </Text>
        <Text className="text-gray-600 dark:text-gray-400 text-center">
          Description text
        </Text>
      </View>
    </View>
  );
}
```

### Screen Purposes

| Screen | Purpose | Future Implementation |
|--------|---------|----------------------|
| **Signer** | Sign Nostr events | FROST signing UI, event preview, signature status |
| **Sessions** | Manage signing sessions | Active session list, join/create session, participant status |
| **Settings** | App configuration | Key share management, relay configuration, preferences |

---

## NativeWind Integration

NativeWind enables Tailwind CSS in React Native through a multi-layer configuration:

### 1. Babel Configuration (`babel.config.js`)

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

- Sets NativeWind as JSX import source
- Enables className prop transformation

### 2. Metro Configuration (`metro.config.js`)

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

- Wraps Metro with NativeWind transformer
- Processes `global.css` for Tailwind classes

### 3. Tailwind Configuration (`tailwind.config.js`)

```javascript
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        frost: { /* custom palette */ },
      },
    },
  },
};
```

- Scans app/ and components/ for class usage
- Uses NativeWind preset for RN compatibility
- Extends theme with custom "frost" colors

### 4. Global CSS (`global.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 5. TypeScript Types (`nativewind-env.d.ts`)

```typescript
/// <reference types="nativewind/types" />
```

### 6. Root Import (`app/_layout.tsx`)

```typescript
import '../global.css';
```

---

## TypeScript Configuration

### `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts"
  ]
}
```

### Strict Mode Features

With `strict: true`, TypeScript enforces:
- `strictNullChecks` - No implicit null/undefined
- `strictFunctionTypes` - Correct function parameter types
- `strictBindCallApply` - Type-safe bind/call/apply
- `strictPropertyInitialization` - Class property initialization
- `noImplicitAny` - No implicit any types
- `noImplicitThis` - No implicit this binding

### Path Aliases

Import from root with `@/`:

```typescript
// Instead of:
import Colors from '../../../constants/Colors';

// Use:
import Colors from '@/constants/Colors';
```

---

## Component Architecture

### Styling Approach

**All screens use NativeWind** with `className` props for styling. This is the primary and only styling pattern in use:

```typescript
import { View, Text } from 'react-native';

// Use className with dark: variants for theme support
<View className="flex-1 bg-white dark:bg-gray-900">
  <Text className="text-frost-500 dark:text-frost-400">
    Themed text
  </Text>
</View>
```

**Why NativeWind over StyleSheet:**
- Consistent with Tailwind CSS patterns
- Built-in dark mode via `dark:` variants
- Uses custom `frost-*` brand colors from `tailwind.config.js`
- No boilerplate (no `StyleSheet.create`)

### Platform Hooks

**`useColorScheme.ts`**
```typescript
export { useColorScheme } from 'react-native';
```

**`useClientOnlyValue.ts`**
```typescript
// Returns different values for server vs client rendering
// Useful for Expo Router's static rendering on web
```

### External Links (`components/ExternalLink.tsx`)

Platform-aware external link handling:

```typescript
export function ExternalLink(props: { href: string; ... }) {
  return (
    <Link
      target="_blank"
      href={props.href}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          e.preventDefault();
          WebBrowser.openBrowserAsync(props.href);
        }
      }}
    />
  );
}
```

- Web: Opens in new tab
- Native: Opens in-app browser via expo-web-browser

---

## Dark Mode Implementation

### Detection

```typescript
import { useColorScheme } from '@/components/useColorScheme';

const colorScheme = useColorScheme(); // 'light' | 'dark' | null
```

### React Navigation Theme

```typescript
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';

<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
  {/* Navigation */}
</ThemeProvider>
```

### NativeWind Dark Variants

Use `dark:` prefix for dark mode styles:

```jsx
<View className="bg-white dark:bg-gray-900">
  <Text className="text-black dark:text-white">
    Adapts to theme
  </Text>
</View>
```

### App Configuration

In `app.json`:
```json
{
  "expo": {
    "userInterfaceStyle": "automatic"
  }
}
```

---

## Static Type Generation

Expo Router generates route types automatically:

```json
// app.json
{
  "experiments": {
    "typedRoutes": true
  }
}
```

Types are generated in `.expo/types/` and provide autocomplete for:
- `<Link href="...">` paths
- `router.push()` arguments
- Route parameters
