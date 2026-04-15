# GNOME Shell 50 API Changes Reference

This document tracks relevant and actionable API changes for upgrading extensions from GNOME Shell 49 to 50.

---

## 1. REMOVED APIs

### X11 & Restart Logic
- **`RunDialog._restart()`** → REMOVED
  - **What it did:** Triggered a shell restart.
  - **Why:** GNOME Shell 50 has completely removed X11 support; the shell no longer supports in-place restarts (which were X11-only).
  - **Replacement:** None. Extensions must not rely on shell restarts.
- **`global.display` signals (`restart`, `show-restart-message`)** → REMOVED
  - **Impact:** Any logic connecting to these signals will fail.

### Keyboard Management
- **`releaseKeyboard()` & `holdKeyboard()`** (from `misc/keyboardManager.js`) → REMOVED
  - **Impact:** No longer used by the shell and removed from the API.

---

## 2. DEPRECATED APIs

- **`GLib.idle_add()`** → Use `GLib.idle_add_once()` for one-shot tasks.
- **`GLib.timeout_add()`** → Use `GLib.timeout_add_once()` for one-shot tasks.
- **`GLib.timeout_add_seconds()`** → Use `GLib.timeout_add_seconds_once()` for one-shot tasks.
  - **Migration Note:** The `*_once` variants improve introspection and clarity when a callback should only run once.

---

## 3. REPLACEMENTS / NEW PATTERNS

### Asynchronous Animations
OLD:
`Clutter.Actor.ease()` (callback-based or fire-and-forget)

NEW:
`Clutter.Actor.easeAsync()` (returns a Promise)

Migration Example:
```js
// OLD Pattern
actor.ease({
    translation_y: 0,
    duration: 300,
    onComplete: () => {
        console.log('Animation finished');
    },
});

// NEW Pattern (Async/Await)
try {
    await actor.easeAsync({
        translation_y: 0,
        duration: 300,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
    console.log('Animation finished');
} catch (e) {
    // Handle cancellation (Gio.IOErrorEnum.CANCELLED)
    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
        return;
    logError(e);
}
```

---

## 4. SIGNAL HANDLING CHANGES

- **`TimeLimitsManager` Signals:** New `session-limits-changed` signal emitted when parental control limits are updated or reached.
- **Removed Signals:** `global.display.connect('restart', ...)` is now a no-op/error.

---

## 5. ACTOR / UI CHANGES

- **`St.Slider`:** New methods `addMark(value, position)` and `clearMarks()` for visual indicators on sliders.
- **Calendar:** Now respects the `org.gnome.desktop.calendar.week-start-day` GSetting. Extensions overriding calendar logic should use `_getWeekStartDay()` in `ui/calendar.js`.
- **Mic Mute Indicator:** `OutputIndicator` (volume.js) uses a new `_updatePrivacyIndicator()` method instead of relying solely on the `.privacy-indicator` CSS class.

---

## 6. LIFECYCLE EXPECTATIONS

- **Parental Controls Awareness:** Extensions that display time-sensitive or restrictive UI should check `Main.timeLimitsManager.parentalControlsSessionLimitsEnabled` and `ParentalControlsManager.getDefault().anyParentalControlsEnabled`.
- **Cleanup Requirements:** With the removal of X11, ensuring clean state in `disable()` is more critical as the shell is expected to be more stable and long-running without restarts.

---

## 7. BREAKING CHANGES SUMMARY

| Change | Impact |
| :--- | :--- |
| **X11 Support Removed** | Any code relying on X11-specific features or shell restarts WILL break. |
| **Animation API** | `easeAsync()` is now the standard for sequential or awaited UI transitions. |
| **Keyboard Management** | Removal of `releaseKeyboard()` affects custom input handling extensions. |
| **Global Signals** | Disappearance of `restart` signals affects debug/management tools. |

---
*Generated based on Official GJS Upgrade Guide*
