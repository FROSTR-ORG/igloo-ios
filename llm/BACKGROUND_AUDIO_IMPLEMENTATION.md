# Background Audio Implementation

## Overview

This document describes the native iOS background audio implementation for the Igloo app. The implementation uses Expo Modules API with Swift/AVFoundation to enable reliable background audio playback that keeps the app alive when backgrounded.

## Purpose

iOS aggressively suspends apps when they go to the background to conserve battery. However, apps with the `audio` background mode capability can continue running while playing audio. We leverage this to keep the Nostr threshold signer (BifrostNode) operational when users switch to other apps.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Layer                         │
├─────────────────────────────────────────────────────────────┤
│  AudioService.ts                                            │
│  - Singleton wrapper for native module                      │
│  - Platform checks (iOS only)                               │
│  - Native state verification before play                    │
│  - Error handling and logging                               │
└───────────────────────┬─────────────────────────────────────┘
                        │ Expo Modules API
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Native Swift Layer                       │
├─────────────────────────────────────────────────────────────┤
│  BackgroundAudioModule.swift                                │
│  - AVAudioSession configuration (.playback category)        │
│  - AVAudioPlayer for looped audio                           │
│  - AudioPlayerDelegate for playback callbacks               │
│  - Interruption handling (phone calls, Siri, etc.)          │
│  - Route change handling (headphones, Bluetooth)            │
│  - Runs on iOS main thread (not JS bridge)                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    iOS System Layer                         │
├─────────────────────────────────────────────────────────────┤
│  - AVFoundation framework                                   │
│  - UIBackgroundModes: ["audio"] in Info.plist               │
│  - iOS Audio Session management                             │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
modules/background-audio/
├── expo-module.config.json    # Expo module configuration
├── index.ts                   # Module entry point
├── src/
│   └── BackgroundAudioModule.ts  # TypeScript interface/types
└── ios/
    ├── BackgroundAudio.podspec   # CocoaPods specification
    └── BackgroundAudioModule.swift  # Native implementation

services/audio/
├── AudioService.ts            # High-level service wrapper
└── index.ts                   # Export barrel

ios/Igloo/
└── hum.wav                    # Audio file (ocean waves, ~70 seconds)
```

## Native Module Implementation

### BackgroundAudioModule.swift

The Swift module uses Expo Modules API (`ExpoModulesCore`) for New Architecture compatibility. Key features:

1. **Separate AudioPlayerDelegate class** - Required because Expo's `Module` class cannot inherit from `NSObject` (needed for Objective-C protocols like `AVAudioPlayerDelegate`)
2. **Audio session configured at playback time** - Not during module init, for better real device compatibility
3. **Route change handling** - Resumes playback after headphone/Bluetooth changes
4. **Step-by-step logging** - Detailed diagnostics for debugging

```swift
import ExpoModulesCore
import AVFoundation

// Separate delegate class since Module can't inherit from NSObject
private class AudioPlayerDelegate: NSObject, AVAudioPlayerDelegate {
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    print("[BackgroundAudio] Delegate: finished playing, success: \(flag)")
  }

  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
    print("[BackgroundAudio] Delegate: DECODE ERROR: \(error?.localizedDescription ?? "unknown")")
  }
}

public class BackgroundAudioModule: Module {
  private var audioPlayer: AVAudioPlayer?
  private var audioDelegate = AudioPlayerDelegate()
  private var playing: Bool = false

  public func definition() -> ModuleDefinition {
    Name("BackgroundAudio")

    OnCreate {
      print("[BackgroundAudio] Module created")
      self.setupNotificationHandlers()
    }

    AsyncFunction("play") { () -> Bool in
      return try await self.startPlayback()
    }

    AsyncFunction("stop") { () -> Bool in
      return await self.stopPlayback()
    }

    AsyncFunction("setVolume") { (volume: Double) -> Bool in
      await MainActor.run {
        self.audioPlayer?.volume = Float(max(0, min(1, volume)))
      }
      return true
    }

    AsyncFunction("isPlaying") { () -> Bool in
      return self.playing
    }
  }

  // ... notification handlers, audio session config, playback methods
}
```

### AVAudioSession Configuration

The audio session is configured with the `.playback` category right before playback (not during module initialization):

```swift
private func configureAndActivateAudioSession() throws {
  let session = AVAudioSession.sharedInstance()

  print("[BackgroundAudio] Current category: \(session.category.rawValue)")
  print("[BackgroundAudio] Is other audio playing: \(session.isOtherAudioPlaying)")

  try session.setCategory(.playback, mode: .default, options: [])
  try session.setActive(true, options: [])

  print("[BackgroundAudio] Audio session activated successfully")
  print("[BackgroundAudio] Output routes: \(session.currentRoute.outputs.map { $0.portName })")
}
```

The `.playback` category:
- Allows audio to continue when the app is backgrounded
- Plays audio even when the device is in silent mode
- Requires `UIBackgroundModes: ["audio"]` in Info.plist

### Notification Handlers

The module handles two types of system notifications:

**1. Audio Interruptions** (phone calls, Siri, alarms):
```swift
private func handleInterruption(notification: Notification) {
  // Parse interruption type
  switch type {
  case .began:
    print("[BackgroundAudio] Interruption BEGAN")
  case .ended:
    print("[BackgroundAudio] Interruption ENDED")
    if playing {
      try AVAudioSession.sharedInstance().setActive(true, options: [])
      audioPlayer?.play()
    }
  }
}
```

**2. Route Changes** (headphones connected/disconnected, Bluetooth):
```swift
private func handleRouteChange(notification: Notification) {
  print("[BackgroundAudio] Route changed, reason: \(reason.rawValue)")
  print("[BackgroundAudio] New output routes: \(session.currentRoute.outputs.map { $0.portName })")

  // Resume playback if it stopped due to route change
  if playing && audioPlayer?.isPlaying == false {
    print("[BackgroundAudio] Player stopped due to route change, resuming...")
    audioPlayer?.play()
  }
}
```

### Playback Implementation

The `startPlayback()` method uses step-by-step logging for debugging:

```swift
@MainActor
private func startPlayback() async throws -> Bool {
  print("[BackgroundAudio] ========== START PLAYBACK ==========")

  // Step 1: Configure audio session
  try configureAndActivateAudioSession()

  // Step 2: Find audio file
  guard let audioPath = Bundle.main.path(forResource: "hum", ofType: "wav") else {
    throw NSError(domain: "BackgroundAudio", code: 1, ...)
  }

  // Step 3: Create player
  audioPlayer = try AVAudioPlayer(contentsOf: audioURL)
  audioPlayer?.delegate = audioDelegate
  audioPlayer?.numberOfLoops = -1  // Infinite loop
  audioPlayer?.volume = 0.3

  // Step 4: Prepare to play
  let prepared = audioPlayer?.prepareToPlay() ?? false

  // Step 5: Start playback (verify result!)
  let playResult = audioPlayer?.play() ?? false
  if playResult {
    playing = true
    print("[BackgroundAudio] Playback started successfully!")
  } else {
    throw NSError(domain: "BackgroundAudio", code: 2, ...)
  }

  return true
}
```

## TypeScript Interface

### BackgroundAudioModule.ts

```typescript
import { NativeModule, requireNativeModule } from 'expo-modules-core';

declare class BackgroundAudioModuleType extends NativeModule {
  play(): Promise<boolean>;
  stop(): Promise<boolean>;
  setVolume(volume: number): Promise<boolean>;
  isPlaying(): Promise<boolean>;
}

// Gracefully handle missing native module (e.g., Expo Go)
let BackgroundAudioModule: BackgroundAudioModuleType | null = null;

if (Platform.OS === 'ios') {
  try {
    BackgroundAudioModule = requireNativeModule<BackgroundAudioModuleType>('BackgroundAudio');
  } catch (error) {
    console.warn('[BackgroundAudio] Native module not available.');
  }
}

export default BackgroundAudioModule;
```

### AudioService.ts

The service provides a high-level API with native state verification:

```typescript
class AudioService {
  private isPlaying: boolean = false;

  async play(): Promise<void> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      // Check native state in case JS state is out of sync
      const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
      if (nativeIsPlaying) {
        this.isPlaying = true;
        return;
      }

      await BackgroundAudioModule.play();
      this.isPlaying = true;
    }
  }

  async stop(): Promise<void> { ... }
  async setVolume(volume: number): Promise<void> { ... }
  getIsPlaying(): boolean { return this.isPlaying; }
}

export const audioService = new AudioService();
```

## Configuration

### Info.plist

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

### Podfile

```ruby
target 'Igloo' do
  use_expo_modules!

  # Local BackgroundAudio Expo module
  pod 'BackgroundAudio', :path => '../modules/background-audio/ios'
end
```

### expo-module.config.json

```json
{
  "platforms": ["ios"],
  "ios": {
    "modules": ["BackgroundAudioModule"]
  }
}
```

## Why This Approach?

### Failed Approaches

1. **expo-av (JavaScript)**: The JS bridge gets suspended when iOS backgrounds the app, causing audio to stop immediately.

2. **RCT_EXTERN_MODULE (Old Native Modules)**: Not compatible with React Native New Architecture (required by react-native-reanimated).

3. **Audio session in OnCreate**: Configuring the audio session during module initialization doesn't work reliably on physical devices.

### Why This Works

- Native Swift code runs on the iOS main thread, independent of the JS bridge
- AVAudioPlayer continues playing when the app backgrounds
- Audio session configured at playback time (not init time) works on real devices
- Expo Modules API is fully compatible with New Architecture
- Separate delegate class allows AVAudioPlayerDelegate conformance

## Audio File

The `hum.wav` file is ocean waves ambient sound that:
- Loops infinitely (`numberOfLoops = -1`)
- Plays at low volume (0.3) to be unobtrusive
- Is ~70 seconds, ~12.5MB
- Located in `ios/Igloo/hum.wav` (bundled with the app)
- Must be added to Xcode's "Copy Bundle Resources" build phase

**Important**: If you replace the audio file, you must:
1. Put the new file at `ios/Igloo/hum.wav`
2. Clean Xcode's DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData/Igloo-*`
3. Rebuild the app

## Building

```bash
# From project root
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npx expo run:ios

# For physical device
npx expo run:ios --device
```

## Debugging

### Expected Logs (Success)

```
[BackgroundAudio] Module created
[AudioService] Expo BackgroundAudioModule available
[AudioService] Calling native play...
[BackgroundAudio] ========== START PLAYBACK ==========
[BackgroundAudio] Step 1: Configuring audio session...
[BackgroundAudio] Current category: AVAudioSessionCategorySoloAmbient
[BackgroundAudio] Audio session activated successfully
[BackgroundAudio] Output routes: ["Speaker"]
[BackgroundAudio] Step 2: Looking for audio file...
[BackgroundAudio] Found audio file at: /var/.../Igloo.app/hum.wav
[BackgroundAudio] Step 3: Creating AVAudioPlayer...
[BackgroundAudio] Player created successfully
[BackgroundAudio] - Duration: 70.8 seconds
[BackgroundAudio] - Channels: 2
[BackgroundAudio] Step 4: Preparing to play...
[BackgroundAudio] Prepare result: true
[BackgroundAudio] Step 5: Starting playback...
[BackgroundAudio] Play result: true
[BackgroundAudio] Playback started successfully!
[BackgroundAudio] ========== END START PLAYBACK ==========
[AudioService] Native playback started
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Module not available" | Running in Expo Go | Use `npx expo run:ios` for development build |
| "Audio file not found" | File not in Copy Bundle Resources | Add to Xcode project, clean DerivedData, rebuild |
| Audio stops on background | UIBackgroundModes not configured | Check Info.plist has `audio` in UIBackgroundModes |
| No audio on real device | Audio session configured too early | Ensure session is configured at playback time (current implementation) |
| Old audio playing | Cached build | Clean DerivedData and rebuild |

### Testing on Physical Device

Use Xcode to run on device and see native logs:
```bash
open ios/Igloo.xcworkspace
# Select your device, press Play (⌘R)
# View logs in Debug Console
```

## Testing Background Mode

1. Start the signer (audio starts automatically)
2. Press the home button to background the app
3. Wait 60+ seconds
4. Return to the app - signer should still be running
5. Check Control Center to verify audio is still "playing"
