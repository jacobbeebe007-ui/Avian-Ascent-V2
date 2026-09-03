# AGENTS_ANDROID.md

## Capacitor Android specific instructions

### What this is
Avian Ascent — Android is a **Capacitor-wrapped** version of the static browser game. The Android project resides in the `android/` directory and serves the web assets via a native WebView.

### Syncing & Assets (Critical)
Native assets for the Android app are located in `android/app/src/main/assets/public/`. 
1. **Rebuild the bundle** in the root: `node scripts/build-bundle.js`.
2. **Sync the platform**: `npx cap sync android`. This is required to push changes from the root web files into the Android project.
**Note**: The Android app loads `index.html` and the bundle from its internal assets. If you edit source files in `js/` without running the sync command, the device will continue running the old build.

### Run & Deploy
- **Deployment**: Use `npx cap run android` or Android Studio's Play button.
- **Module**: In Android Studio, the target module is `:app`.
- **Activity**: The main entry point is `com.jacobbeebe.avianascent.MainActivity`.

### Debugging
- **Web Layer**: Use Chrome Remote Debugging. Connect the device via USB and navigate to `chrome://inspect/#devices` in your desktop browser to inspect the WebView.
- **Native Layer**: Use Android Studio's **Logcat** to monitor bridge activity and native plugin logs.

### Troubleshooting
- **Missing Bundle**: If the app alerts that `avian-game.bundle.js` is missing, ensure the bundle exists in the root and run `npx cap sync android`.
- **Stale Assets**: If the UI looks old after a sync, use the "Clear cached data" option in the game's **Supplies** menu to invalidate the Service Worker cache.
