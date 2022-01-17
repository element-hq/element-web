/*
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import classNames from "classnames";
import React from "react";

import { Categories, DIGITS, IShortcut, Modifiers, shortcuts } from "../../../../../accessibility/KeyboardShortcuts";
import { isMac, Key } from "../../../../../Keyboard";
import { _t, _td } from "../../../../../languageHandler";

// TS: once languageHandler is TS we can probably inline this into the enum
_td("Alt");
_td("Alt Gr");
_td("Shift");
_td("Super");
_td("Ctrl");
_td("Navigation");
_td("Calls");
_td("Composer");
_td("Room List");
_td("Autocomplete");

const categoryOrder = [
    Categories.COMPOSER,
    Categories.AUTOCOMPLETE,
    Categories.ROOM,
    Categories.ROOM_LIST,
    Categories.NAVIGATION,
    Categories.CALLS,
];

const modifierIcon: Record<string, string> = {
    [Modifiers.COMMAND]: "⌘",
};

if (isMac) {
    modifierIcon[Modifiers.ALT] = "⌥";
}

const alternateKeyName: Record<string, string> = {
    [Key.PAGE_UP]: _td("Page Up"),
    [Key.PAGE_DOWN]: _td("Page Down"),
    [Key.ESCAPE]: _td("Esc"),
    [Key.ENTER]: _td("Enter"),
    [Key.SPACE]: _td("Space"),
    [Key.HOME]: _td("Home"),
    [Key.END]: _td("End"),
    [DIGITS]: _td("[number]"),
};
const keyIcon: Record<string, string> = {
    [Key.ARROW_UP]: "↑",
    [Key.ARROW_DOWN]: "↓",
    [Key.ARROW_LEFT]: "←",
    [Key.ARROW_RIGHT]: "→",
};

interface IShortcutProps {
    shortcut: IShortcut;
}

const Shortcut: React.FC<IShortcutProps> = ({ shortcut }) => {
    const classes = classNames({
        "mx_KeyboardShortcutsDialog_inline": shortcut.keybinds.every(k => !k.modifiers || k.modifiers.length === 0),
    });

    return <div className={classes}>
        <h5>{ _t(shortcut.description) }</h5>
        { shortcut.keybinds.map(s => {
            let text = s.key;
            if (alternateKeyName[s.key]) {
                text = _t(alternateKeyName[s.key]);
            } else if (keyIcon[s.key]) {
                text = keyIcon[s.key];
            }

            return <div key={s.key}>
                { s.modifiers && s.modifiers.map(m => {
                    return <React.Fragment key={m}>
                        <kbd>{ modifierIcon[m] || _t(m) }</kbd>+
                    </React.Fragment>;
                }) }
                <kbd>{ text }</kbd>
            </div>;
        }) }
    </div>;
};

const KeyboardUserSettingsTab: React.FC = () => {
    return <div className="mx_SettingsTab mx_KeyboardUserSettingsTab">
        <div className="mx_SettingsTab_heading">{ _t("Keyboard") }</div>
        <div className="mx_SettingsTab_section">
            { categoryOrder.map(category => {
                const list = shortcuts[category];
                return <div className="mx_KeyboardShortcutsDialog_category" key={category}>
                    <h3>{ _t(category) }</h3>
                    <div>{ list.map(shortcut => <Shortcut key={shortcut.description} shortcut={shortcut} />) }</div>
                </div>;
            }) }
        </div>
    </div>;
};

export default KeyboardUserSettingsTab;
