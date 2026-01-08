# Signer Soundscape Integration

## Overview

The "soundscape" feature is the integration between the Igloo threshold signer (BifrostNode) and the background audio system. When the signer starts, ambient audio begins playing to keep the iOS app alive in the background. When the signer stops, the audio stops.

## Purpose

The Igloo app runs a BifrostNode that:
- Connects to Nostr relays
- Listens for threshold signing requests
- Participates in distributed key signing ceremonies

Without background execution, iOS suspends the app within seconds of being backgrounded, making the signer unavailable. The soundscape keeps the signer operational 24/7.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
│  - Start/Stop signer button                                 │
│  - Signer status display                                    │
│  - Signing request notifications                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    IglooService                             │
│  services/igloo/IglooService.ts                             │
├─────────────────────────────────────────────────────────────┤
│  startSigner()                                              │
│    1. Create BifrostNode                                    │
│    2. Connect to relays                                     │
│    3. Set up event listeners                                │
│    4. ▶ audioService.play()  ← Start soundscape             │
│                                                             │
│  stopSigner(options?)                                       │
│    1. Emit disconnect events                                │
│    2. Clean up node                                         │
│    3. ◼ audioService.stop()  ← Stop soundscape              │
│       (unless options.keepAudio = true)                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    AudioService                             │
│  services/audio/AudioService.ts                             │
├─────────────────────────────────────────────────────────────┤
│  - Manages native BackgroundAudioModule                     │
│  - Checks native isPlaying() before starting                │
│  - Tracks playback state (synced with native)               │
│  - Handles errors gracefully                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                BackgroundAudioModule                        │
│  (Native Swift - keeps app alive)                           │
└─────────────────────────────────────────────────────────────┘
```

## IglooService Integration

### Starting the Signer

In `IglooService.startSigner()`, after the BifrostNode is successfully created and connected:

```typescript
// Start background audio to keep app alive in iOS background mode
try {
  await audioService.play();
} catch (error) {
  this.log('warn', 'system', 'Failed to start background audio', {
    error: error instanceof Error ? error.message : 'Unknown',
  });
}
```

**Key Design Decisions:**
- Audio starts **after** successful node creation (not before)
- Failure to start audio is a warning, not a fatal error
- The signer can still function in foreground even without audio

### Stopping the Signer

In `IglooService.stopSigner()`, the method accepts an options parameter:

```typescript
async stopSigner(options: { keepAudio?: boolean } = {}): Promise<void> {
  // ... node cleanup ...

  // Stop background audio (unless we're restarting)
  if (!options.keepAudio) {
    try {
      await audioService.stop();
    } catch (audioError) {
      this.log('warn', 'system', 'Failed to stop background audio', { ... });
    }
  }
}
```

**Key Design Decisions:**
- `keepAudio: true` preserves audio during signer restarts
- Prevents audio drops caused by React re-renders or Strict Mode
- Audio stop errors don't prevent signer from being marked as stopped

### Handling Signer Restarts

If `startSigner()` is called while already running, audio is preserved:

```typescript
async startSigner(...): Promise<void> {
  // Don't start if already running - restart with audio preserved
  if (this.node) {
    this.log('warn', 'system', 'Signer already running, restarting (keeping audio)...');
    await this.stopSigner({ keepAudio: true });
  }
  // ... continue with startup ...
}
```

This prevents audio interruptions during:
- React 18 Strict Mode (effects run twice in development)
- Component re-renders that trigger signer restart
- Navigation events

### Error Handling

If the signer encounters an error during operation:

```typescript
} catch (error) {
  // ... error handling ...

  // Also stop audio on error (unless we're restarting)
  if (!options.keepAudio) {
    try {
      await audioService.stop();
    } catch {
      // Ignore audio stop errors during error handling
    }
  }
}
```

## AudioService Integration

### Native State Verification

The AudioService checks native state before starting to prevent duplicate playback:

```typescript
async play(): Promise<void> {
  if (Platform.OS === 'ios' && BackgroundAudioModule) {
    // Check native state in case JS state is out of sync
    const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
    if (nativeIsPlaying) {
      console.log('[AudioService] Already playing (native confirmed)');
      this.isPlaying = true;
      return;
    }

    if (this.isPlaying) {
      console.log('[AudioService] Already playing (JS state)');
      return;
    }

    await BackgroundAudioModule.play();
    this.isPlaying = true;
  }
}
```

This handles cases where:
- JS state gets out of sync with native state
- Multiple components try to start audio simultaneously
- Rapid start/stop cycles from React re-renders

## Lifecycle States

```
┌─────────────┐     startSigner()     ┌─────────────┐
│   Stopped   │ ───────────────────▶  │ Connecting  │
│  (no audio) │                       │  (no audio) │
└─────────────┘                       └──────┬──────┘
       ▲                                     │
       │                                     │ Success
       │                                     ▼
       │                              ┌─────────────┐
       │  stopSigner()                │   Running   │
       │  (keepAudio: false)          │ (AUDIO ON)  │ ◀── Signer active,
       │                              └──────┬──────┘     audio playing
       │                                     │
       │                                     │ stopSigner({ keepAudio: true })
       │                                     │ (for restart)
       │                                     ▼
       │                              ┌─────────────┐
       │                              │ Restarting  │
       │                              │ (AUDIO ON)  │ ◀── Audio preserved
       │                              └──────┬──────┘
       │                                     │
       └─────────────────────────────────────┘
```

## User Experience

### When Signer Starts
1. User taps "Start Signer"
2. App connects to relays
3. Status changes to "Running"
4. Background audio begins (ocean waves at low volume)
5. User can now switch to other apps

### While Signer Runs
- Audio plays continuously at low volume (0.3)
- App stays active in background
- Signing requests are processed automatically
- User can check status anytime by returning to app

### When Signer Stops
1. User taps "Stop Signer" (or error occurs)
2. Node disconnects from relays
3. Audio stops immediately
4. Status changes to "Stopped"
5. App will be suspended normally when backgrounded

## Audio Configuration

### Current Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| Volume | 0.3 | Low enough to not disturb, high enough for iOS to consider "playing" |
| Loop | Infinite | Continuous operation required |
| File | hum.wav | Ocean waves ambient sound (~70 seconds) |
| Category | .playback | Required for background audio, overrides silent switch |

### Future Considerations

- **User volume control**: Allow users to adjust soundscape volume
- **Sound selection**: Multiple ambient sounds to choose from
- **Mute option**: Allow muting while keeping signer active (would require different approach)
- **Notifications**: Play different sounds for signing events

## Testing the Integration

### Manual Test Procedure

1. **Start signer**
   - Verify audio begins playing
   - Check logs for `[AudioService] Native playback started`

2. **Background the app**
   - Press home button
   - Wait 2+ minutes
   - Check Control Center for audio indicator

3. **Verify signer still running**
   - Return to app
   - Check signer status shows "Running"
   - Verify uptime has increased
   - Check relay connections still active

4. **Stop signer**
   - Tap stop button
   - Verify audio stops
   - Verify status shows "Stopped"

5. **Error scenario**
   - Start signer with invalid credentials
   - Verify audio doesn't start (or stops if started)
   - Verify app handles error gracefully

6. **Restart scenario**
   - Start signer
   - Trigger a restart (navigate away and back, or call startSigner again)
   - Verify audio doesn't drop/restart (should be continuous)

### Expected Log Sequence

```
[IglooService] Starting signer node...
[IglooService] Signer node started successfully
[AudioService] Calling native play...
[BackgroundAudio] ========== START PLAYBACK ==========
[BackgroundAudio] Step 1: Configuring audio session...
[BackgroundAudio] Audio session activated successfully
[BackgroundAudio] Step 2: Looking for audio file...
[BackgroundAudio] Found audio file at: /var/.../hum.wav
[BackgroundAudio] Step 3: Creating AVAudioPlayer...
[BackgroundAudio] Player created successfully
[BackgroundAudio] - Duration: 70.8 seconds
[BackgroundAudio] Step 4: Preparing to play...
[BackgroundAudio] Prepare result: true
[BackgroundAudio] Step 5: Starting playback...
[BackgroundAudio] Play result: true
[BackgroundAudio] Playback started successfully!
[BackgroundAudio] ========== END START PLAYBACK ==========
[AudioService] Native playback started
```

### Restart Log Sequence (No Audio Drop)

```
[IglooService] Signer already running, restarting (keeping audio)...
[IglooService] Stopping signer node... { keepAudio: true }
[IglooService] Signer node stopped
[IglooService] Starting signer node...
[AudioService] Calling native play...
[AudioService] Already playing (native confirmed)
[IglooService] Signer node started successfully
```

## Limitations

1. **Battery Impact**: Continuous audio playback uses battery, though the low-volume ambient sound minimizes this.

2. **Audio Interruptions**: Phone calls, Siri, or other apps taking audio focus will pause the soundscape (and potentially the signer). The native module handles resuming after interruptions end.

3. **iOS Restrictions**: Apple may reject apps that abuse background audio. The soundscape must serve a legitimate user-facing purpose.

4. **No True Silent Mode**: iOS requires actual audio output for the background mode to work. A truly silent/muted mode would need a different approach (like VoIP).

5. **Route Changes**: Plugging/unplugging headphones or Bluetooth changes can briefly interrupt audio. The native module handles resuming automatically.

## Files Involved

```
services/
├── igloo/
│   ├── IglooService.ts      # Main integration point (startSigner, stopSigner)
│   └── types.ts             # Type definitions
└── audio/
    ├── AudioService.ts      # Audio service wrapper (native state checks)
    └── index.ts             # Exports

modules/background-audio/    # Native module (see BACKGROUND_AUDIO_IMPLEMENTATION.md)

ios/Igloo/
├── hum.wav                  # Audio file (ocean waves)
└── Info.plist               # UIBackgroundModes config
```

## Related Documentation

- [BACKGROUND_AUDIO_IMPLEMENTATION.md](./BACKGROUND_AUDIO_IMPLEMENTATION.md) - Technical details of the native audio module
