# Top Apps Pro Code Quality Audit

This report identifies dead code, memory leak risks, signal issues, and inefficient patterns in the Top Apps Pro extension codebase.

---

### 1. Unused Imports

| File | Import Line | Recommendation |
| :--- | :--- | :--- |
| `extension.js` | `import Shell from 'gi://Shell';` (Used only for ActionMode, keep) | N/A |
| `panel.js` | `import * as Config from 'resource:///org/gnome/shell/misc/config.js';` | **REMOVE** (ShellVersion is defined but used only for `_tryDragWindow` which could use `Config.PACKAGE_VERSION` directly or be refactored) |
| `proximity.js` | `import * as Utils from './utils.js';` | (Checked: Used for `timeoutAddOnce` and `safeSourceRemove`. Keep.) |
| `appIconIndicator.js`| `import Cogl from 'gi://Cogl';` | **REMOVE** (Used only as fallback for `Clutter.Color`, but `Clutter.Color` is standard in GJS environments now). |

---

### 2. Dead Code / Unused Functions

- **File:** `panelManager.js`
  - **Function:** `_updateOverviewPanelStyle()`
  - **Issue:** It disconnects `Main.overview` from `this._panel` before connecting again. However, if `transparencyEnabled` is false, it just disconnects and doesn't connect.
  - **Recommendation:** Refactor to use `connectObject` properly to avoid manual disconnects.

- **File:** `appIcon.js`
  - **Code:** `const [ShellVersion] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));`
  - **Issue:** Redundant if used only once in a logic block that could be simplified.
  - **Recommendation:** Centralize `ShellVersion` in `utils.js` instead of redefining it in 5+ files.

---

### 3. Memory Leak Risks

- **File:** `panel.js`
  - **Location:** `_removePanelMenu(propName)`
  - **Code Snippet:**
    ```js
    TaskbarManager.persistentStorage[propName].push(panelMenu);
    ```
  - **Issue:** ❌ **Architectural Leak.** To avoid upstream Shell crashes, the extension caches `QuickSettings`, `DateMenuButton`, and `Activities` buttons in a global persistent storage instead of destroying them. These objects are never truly destroyed until the shell restarts.
  - **Recommendation:** Investigate if modern GNOME Shell versions (45+) still require this hack.

- **File:** `notificationsMonitor.js`
  - **Location:** `_checkNotifications()`
  - **Issue:** ⚠️ **Potential Leak.** This function clears `this._signalsHandler` by disconnecting every ID. However, it recreates many connections every time a notification is added/removed.
  - **Recommendation:** Use `connectObject(this)` on the source objects instead of manual management in a Map.

- **File:** `proximity.js`
  - **Location:** `destroy()`
  - **Issue:** ❌ **Leak Risk.** If `_isDestroyed` flag is not checked correctly, multiple calls to `destroy()` could occur, though it is currently guarded.

---

### 4. Signal Issues

- **File:** `extension.js`
  - **Location:** `disable()`
  - **Issue:** ❌ **Improper Disconnection.**
    ```js
    global.disconnectObject(this);
    ```
    This disconnects signals connected to `global` using `this` as owner. However, in `enable()`, `Theming.deleteStylesheet()` is connected to `global`'s `shutdown` signal.
    Also, `Main.layoutManager` is disconnected manually, which is good.

- **File:** `panelManager.js`
  - **Location:** `destroy()`
  - **Issue:** ❌ **Orphan Signal.**
    ```js
    Main.overview.disconnectObject(this._panel);
    ```
    This is called in `destroy()`. If `this.isMainPanel` is true, it disconnects signals from `Main.panel`. This is correct, but the logic in `_updateOverviewPanelStyle` is convoluted.

---

### 5. Redundant Logic

- **File:** `appIcon.js`
  - **Issue:** `updateIcon()` is called multiple times during initialization and style updates.
  - **Recommendation:** Batch icon updates to avoid redundant texture creation.

- **File:** `utils.js`
  - **Issue:** Multiple functions like `getScrollViewAdjustments` and `addChildToParent` contain compatibility checks for GNOME 45 vs 46.
  - **Recommendation:** Since the extension now targets 45-49, some of these can be simplified if the "old" way is completely removed in 46+.

---

### 6. Inefficient Patterns

- **File:** `intellihide.js`
  - **Location:** `_checkMousePointer(x, y)`
  - **Issue:** Called every 200ms via `PointerWatcher`.
  - **Impact:** While 200ms is not extremely high, the bounds checking logic runs on every tick.
  - **Recommendation:** Use `Clutter.EnterEvent` / `LeaveEvent` on a transparent trigger actor instead of a global `PointerWatcher` for better efficiency.

- **File:** `proximity.js`
  - **Location:** `_queueUpdate()`
  - **Issue:** Uses `GLib.timeout_add` with 200ms delay for debouncing.
  - **Recommendation:** Use `Main.queueDeferredWork` for layout-related updates.

---

### 7. Files to Remove

| File | Reason |
| :--- | :--- |
| `Makefile` | Redundant. Packaging can be done via `gnome-extensions pack`. |
| `.gitlab-ci.yml` | Only relevant if using GitLab CI; can be removed for local dev / GitHub. |

---

### 8. Logging Cleanup

- **File:** `theming.js`
  - **Lines:** 23, 55, 96, 107
  - **Issue:** Uses `log()` for error reporting.
  - **Recommendation:** Switch to `console.error()` or `console.warn()` for better visibility in modern journals.

- **File:** `settings/panelPage.js`
  - **Line:** 842
  - **Issue:** `console.log(e)` in catch block.
  - **Recommendation:** Use `console.error(e)`.

---

### 9. Optimization Opportunities

- **Dynamic Styling:** `theming.js` writes a temporary file to disk and reloads the whole theme.
  - **Optimization:** Use `St.Settings.get().set_custom_css()` or inline styles for specific actors (`this.set_style()`) to avoid disk I/O and full CSS re-parsing.
- **Icon Caching:** `AppIconsTaskbar` maintains a `Map` of icons. Ensure it doesn't grow indefinitely if apps are opened/closed frequently with different IDs.

---
*Generated on 2026-04-15*
