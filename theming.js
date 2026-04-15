import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {TaskbarManager} from './taskbarManager.js';

Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');
Gio._promisify(Gio.File.prototype, 'delete_async');

const FileName = 'XXXXXX-topappspro-stylesheet.css';
let _stylesheetGeneration = 0;

/**
 * Create and load a custom stylesheet file into global.stage St.Theme
 */
export function createStylesheet() {
    try {
        const [file] = Gio.File.new_tmp(FileName);
        _stylesheetGeneration++;
        TaskbarManager.customStylesheet = file;
        void updateStylesheet();
    } catch (e) {
        console.error(`AppIcons Taskbar - Error creating custom stylesheet: ${e}`);
    }
}

/**
 * Unload the custom stylesheet from global.stage St.Theme
 */
function unloadStylesheet() {
    if (!TaskbarManager.customStylesheet)
        return;

    const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
    theme.unload_stylesheet(TaskbarManager.customStylesheet);
}

/**
 * Delete and unload the custom stylesheet file from global.stage St.Theme
 */
export async function deleteStylesheet() {
    _stylesheetGeneration++;
    unloadStylesheet();

    const extension = TaskbarManager.getDefault?.() ? TaskbarManager.extension : null;
    const stylesheet = TaskbarManager.getDefault?.() ? TaskbarManager.customStylesheet : null;
    if (!stylesheet)
        return;

    try {
        if (stylesheet.query_exists(null))
            await stylesheet.delete_async(GLib.PRIORITY_DEFAULT, null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            console.error(`AppIcons Taskbar - Error deleting custom stylesheet: ${e}`);
    } finally {
        if (extension?.customStylesheet === stylesheet)
            delete extension.customStylesheet;
    }
}

/**
 * Write theme data to custom stylesheet and reload into global.stage St.Theme
 */
export async function updateStylesheet() {
    const extension = TaskbarManager.getDefault?.();
    if (!extension)
        return;

    const generation = _stylesheetGeneration;
    const {settings} = TaskbarManager;
    const stylesheet = TaskbarManager.customStylesheet;

    if (!stylesheet) {
        return;
    }

    unloadStylesheet();

    const [overridePanelHeight, panelHeight] = settings.get_value('main-panel-height').deep_unpack();

    let customStylesheetCSS = '';

    if (overridePanelHeight) {
        customStylesheetCSS += `.topAppsPro-panel{
            height: ${panelHeight}px;
        }`;
    }

    try {
        const bytes = new GLib.Bytes(customStylesheetCSS);
        const [success, etag_] = await stylesheet.replace_contents_bytes_async(bytes, null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null);

        if (!success) {
            console.error('AppIcons Taskbar - Failed to replace contents of custom stylesheet.');
            return;
        }

        if (_stylesheetGeneration !== generation || TaskbarManager.customStylesheet !== stylesheet)
            return;

        TaskbarManager.customStylesheet = stylesheet;
        const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        theme.load_stylesheet(TaskbarManager.customStylesheet);
    } catch (e) {
        console.error(`AppIcons Taskbar - Error updating custom stylesheet. ${e.message}`);
    }
}
