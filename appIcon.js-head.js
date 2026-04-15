import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Graphene from 'gi://Graphene';
import GObject from 'gi://GObject';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {AppIconBadges} from './appIconBadges.js';
import {AppIconIndicator} from './appIconIndicator.js';
import {PanelLocation} from './extension.js';
import {TaskbarManager} from './taskbarManager.js';
import * as Utils from './utils.js';
import {WindowPreviewMenu} from './windowPreview.js';

import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const ShellVersion = Utils.ShellVersion;

const MAX_MULTI_WINDOW_DASHES = 3;
const LONG_PRESS_TIMEOUT_MS = 500;
const TRANSLATION_UP = 3;
const TRANSLATION_DOWN = -3;

const ClickAction = {
    CYCLE: 0,
    CYCLE_MINIMIZE: 1,
    PREVIEW: 2,
    NO_TOGGLE_CYCLE: 3,
    RAISE: 4,
    MINIMIZE: 5,
    QUIT: 6,
    LAUNCH: 7,
    RAISE_HERE: 8,
};

const ScrollAction = {
    CYCLE: 0,
    NO_ACTION: 1,
};

const AppIconStyle = {
    REGULAR: 0,
    SYMBOLIC: 1,
};

export const AppState = {
    RUNNING: 0,
    FOCUSED: 1,
    NOT_RUNNING: 2,
};

export const MultiWindowIndicatorStyle = {
    INDICATOR: 0,
    MULTI_DASH: 1,
};
