# Top Apps Pro Architecture

This document provides a technical overview of the Top Apps Pro GNOME Shell extension. It is intended for developers debugging issues, performing refactors, or upgrading the extension to newer GNOME Shell versions.

---

## 1. HIGH LEVEL OVERVIEW

Top Apps Pro is a GNOME Shell extension that adds a highly customizable app icon taskbar to the top (or bottom) panel. It supports both the primary monitor's panel and custom panels on secondary monitors.

### Key Features:
- **Taskbar Integration:** Displays running and favorite apps directly in the GNOME Shell panel.
- **Multi-Monitor Support:** Can display panels and taskbars on all connected monitors, with options to isolate workspaces and monitors.
- **Intellihide:** Automatically hides the panel when a window overlaps with it or is maximized.
- **Window Previews:** Provides a popup menu with live clones of open windows when hovering over app icons.
- **Customization:** Allows extensive styling of the panel, icons, clock, and weather integration.
- **Unity Launcher API:** Supports the Unity Launcher D-Bus API for app badges and progress bars.

### GNOME Shell Integration:
- Uses `Main.panel` for the primary monitor and custom `PanelBox` (added via `Main.layoutManager.addChrome`) for secondary monitors.
- Injects logic into `Main.overview` to handle panel transparency and layout adjustments.
- Manages its own "Chrome" actors to ensure they don't interfere with the standard Shell layout unless intended (e.g., affecting struts).

---

## 2. FILE STRUCTURE BREAKDOWN

| File | Purpose | Key Classes / Functions |
| :--- | :--- | :--- |
| `extension.js` | Entry point | `TopAppsPro` (Extension class), `enable()`, `disable()` |
| `panelManager.js` | Orchestrates panel instances | `PanelManager` |
| `panel.js` | Custom panel implementation | `PanelBox`, `Panel` |
| `taskbarManager.js` | Global state singleton | `TaskbarManager` |
| `appIconsTaskbar.js` | Taskbar container | `AppIconsTaskbar` |
| `appIcon.js` | Individual app icon logic | `BaseButton`, `AppIcon`, `ShowAppsIcon` |
| `intellihide.js` | Auto-hide logic | `Intellihide` |
| `proximity.js` | Window overlap detection | `ProximityManager`, `ProximityWatch` |
| `windowPreview.js` | Window preview popup | `WindowPreviewMenu`, `WindowPreviewList` |
| `notificationsMonitor.js` | Tracks notifications | `NotificationsMonitor` |
| `appIconBadges.js` | Renders badges on icons | `AppIconBadges` |
| `appIconIndicator.js` | Renders running indicators | `AppIconIndicator` |
| `theming.js` | Dynamic CSS management | `updateStylesheet()`, `createStylesheet()` |
| `utils.js` | Shared helper functions | `getInterestingWindows()`, `addChildToParent()` |
| `unityLauncherAPI.js` | Unity D-Bus support | `LauncherEntryRemoteModel` |
| `desktopIconsIntegration.js`| Desktop icon layout adjustment| `DesktopIconsUsableAreaClass` |
| `updateNotifier.js` | Version update checks | `UpdateNotification` |

---

## 3. CORE COMPONENTS

### Panel Indicator & Manager (`PanelManager` & `Panel`)
- **Responsibilities:** Manages the lifecycle of the panel on a specific monitor. Handles elements like the clock, weather, and taskbar placement.
- **Lifecycle:** Created during `enable()` or when monitors change. Destroyed on `disable()`.
- **Dependencies:** `Main.panel`, `Main.layoutManager`, `TaskbarManager`.

### App Icon Taskbar (`AppIconsTaskbar`)
- **Responsibilities:** A scrollable container (`St.ScrollView`) that dynamically populates `AppIcon` instances based on running apps and favorites.
- **Lifecycle:** Created by `PanelManager`.
- **Signals:** `app-state-changed`, `windows-changed`, `favorites-changed`.

### Intellihide & Proximity
- **Responsibilities:** Monitors window positions and states to decide when to hide the panel.
- **Logic:** Uses a `PressureBarrier` for revealing and `ProximityManager` to detect overlaps.
- **Issues:** Complex signal chain; sensitive to layout changes.

---

## 4. SIGNAL & EVENT MAP

Top Apps Pro relies heavily on signals for reactivity. Below are the major connections:

| Object | Signal | Handler Location | Disconnected? |
| :--- | :--- | :--- | :--- |
| `settings` | `changed::*` | `extension.js`, `panelManager.js`, `appIconsTaskbar.js` | Yes |
| `Main.layoutManager` | `monitors-changed` | `extension.js` | Yes |
| `global.display` | `window-entered-monitor`| `appIconsTaskbar.js` | Yes |
| `global.display` | `notify::focus-window` | `appIcon.js` | Yes |
| `Shell.AppSystem` | `app-state-changed` | `appIconsTaskbar.js` | Yes |
| `Meta.Window` | `notify::minimized` | `appIcon.js` | Yes |
| `Main.messageTray` | `source-added` | `notificationsMonitor.js` | Yes |

### ❌ Critical Signal Issues:
- **`global.display` signals:** If not disconnected properly, they can cause "Invalid object" errors after the extension is disabled.
- **`Meta.Window` signals:** Connected for each window in `appIcon.js`. Must be meticulously cleared in `_onDestroy()`.

---

## 5. LIFECYCLE ANALYSIS

### `enable()`
1. Creates `TaskbarManager` (singleton).
2. Initializes `Theming` (creates temporary CSS file).
3. Sets up `NotificationsMonitor` and `UnityLauncherAPI`.
4. Connects to `settings` and `Main.layoutManager`.
5. Calls `_createPanels()`, which instantiates `PanelManager` for each monitor.
6. Overrides `vfunc_allocate` of `overviewControls` (injection).

### `disable()`
1. Removes keybindings.
2. Clears `InjectionManager` (reverts overrides).
3. Deletes temporary stylesheet.
4. Destroys `PanelManager` instances, which in turn destroy `AppIconsTaskbar`.
5. **Leak Risk:** `TaskbarManager.persistentStorage` is used to cache `DateMenuButton` and `QuickSettings` actors. These are **never destroyed** to avoid GNOME Shell crashes, which is a known architectural leak.

### ❌ Known Lifecycle Problems:
- **Orphan Actors:** If `PanelManager.destroy()` fails to remove `PanelBox` from `Main.layoutManager`'s Chrome, the panel remains visible or blocking clicks.
- **Double Disconnect:** Some `disconnectObject(this)` calls might be redundant or miss specific IDs if `connect()` was used instead of `connectObject()`.

---

## 6. GNOME SHELL API USAGE

- **Clutter:** Used for animations (`ease`), gestures, and basic actor management.
- **St:** Used for all UI elements (`BoxLayout`, `Button`, `Label`, `Icon`).
- **Mtk:** Used for rectangle math (`Mtk.Rectangle`).
- **Meta:** Used for window management and barriers.

### ❌ Deprecated / Removed APIs:
- **`Clutter.ClickAction` / `TapAction`:** Removed in GNOME 49. The codebase contains a compatibility layer in `appIcon.js` using `Clutter.ClickGesture` for newer versions.
- **`St.BoxLayout.vertical`:** Replaced by `orientation` in GNOME 48. Handled by `Utils.getOrientationProp()`.
- **`actor.add_actor()`:** Replaced by `add_child()`. Handled by `Utils.addChildToParent()`.

---

## 7. FULLSCREEN & PANEL BEHAVIOR FLOW

1. **Fullscreen Detection:** `Main.layoutManager` tracks fullscreen state. `PanelBox` is added as Chrome with `trackFullscreen: true`.
2. **Visibility Logic:**
   - If monitor is in fullscreen, `panelBox` is usually hidden unless `intellihide-show-in-fullscreen` is true.
   - If `Intellihide` is enabled, `translation_y` is used to slide the panel out of view.
3. **Edge Trigger:** When hidden, a 1px trigger area (or pressure barrier) detects the mouse at the screen edge to reveal the panel temporarily (`revealAndHold`).

---

## 8. POTENTIAL PROBLEM AREAS

- **Flickering:** Often caused by `vfunc_allocate` loops or `Main.layoutManager._queueUpdateRegions()` being called too frequently during animations.
- **Layout Thrashing:** Changing `affectsStruts` dynamically in `Intellihide` triggers expensive full-shell relayouts.
- **Window Previews:** Cloning many windows with `Clutter.Clone` can be heavy on the GPU and might lead to "Invalid actor" errors if the window is closed while the preview is being generated.

---

## 9. UNUSED / UNNECESSARY FILES

- `appIconIndicator.js` vs `appIconBadges.js`: Ensure both are actively used; they handle different visual elements (running state vs notification count).
- `unityLauncherAPI.js`: While functional, it's only useful for apps supporting this specific D-Bus API. Could be considered an "extra" component.
- `Makefile`: Often redundant if using `gnome-extensions` tool for packaging.

---

## 10. UPGRADE READINESS (GNOME 50)

### Risks:
- **`Main.panel` refactors:** GNOME 50 might change how the status area or panel boxes are structured.
- **Further Clutter removals:** Ensure no remaining `Clutter.ClickAction` references exist in unreachable code paths.
- **`St` Theme changes:** GNOME 50 often updates the default stylesheet, which might break the extension's `theming.js` overrides.
- **`Mtk` vs `Meta`:** Transition of more geometry types to `Mtk`.

---
*Generated on 2026-04-15*
