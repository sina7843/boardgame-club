# Cafe Bazaar Android app

A Capacitor WebView shell over https://boardgameverse.ir. A site deploy updates the app without a new release.
The app sells nothing for money because Bazaar requires its own billing for digital goods. See DECISIONS.md.

## One-time setup (this machine)
- JDK 17+ and the Android SDK at `%USERPROFILE%\Android\sdk` (platforms;android-36, build-tools;36.0.0, platform-tools).
- `android/local.properties` with `sdk.dir=...` (git-ignored).
- From Iran, Google hosts are blocked. Keep the local proxy (127.0.0.1:10808) on. `~/.gradle/init.d/google-mirror.gradle`
  and `~/.gradle/gradle.properties` route Google Maven through it.
- Run `create-keystore.cmd` once and back up `%USERPROFILE%\.bgv\` somewhere safe. Without it you cannot update the app.

## Build
```
pnpm --filter @bg/android aab    # android/app/build/outputs/bundle/release/app-release.aab  -> upload to Bazaar
pnpm --filter @bg/android apk    # android/app/build/outputs/apk/release/app-release.apk
```
Raise `versionCode` (and `versionName`) in `android/app/build.gradle` before every new Bazaar release.
