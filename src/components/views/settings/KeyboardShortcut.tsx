/*
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React from "react";

import { ALTERNATE_KEY_NAME, KEY_ICON } from "../../../accessibility/KeyboardShortcuts";
import { KeyCombo } from "../../../KeyBindingsManager";
import { IS_MAC, Key } from "../../../Keyboard";
import { _t } from "../../../languageHandler";

interface IKeyboardKeyProps {
    name: string;
    last?: boolean;
}

export const KeyboardKey: React.FC<IKeyboardKeyProps> = ({ name, last }) => {
    const icon = KEY_ICON[name];
    const alternateName = ALTERNATE_KEY_NAME[name];

    return (
        <React.Fragment>
            <kbd> {icon || (alternateName && _t(alternateName)) || name} </kbd>
            {!last && "+"}
        </React.Fragment>
    );
};

interface IKeyboardShortcutProps {
    value: KeyCombo;
    className?: string;
}

export const KeyboardShortcut: React.FC<IKeyboardShortcutProps> = ({ value, className = "mx_KeyboardShortcut" }) => {
    if (!value) return null;

    const modifiersElement: JSX.Element[] = [];
    if (value.ctrlOrCmdKey) {
        modifiersElement.push(<KeyboardKey key="ctrlOrCmdKey" name={IS_MAC ? Key.META : Key.CONTROL} />);
    } else if (value.ctrlKey) {
        modifiersElement.push(<KeyboardKey key="ctrlKey" name={Key.CONTROL} />);
    } else if (value.metaKey) {
        modifiersElement.push(<KeyboardKey key="metaKey" name={Key.META} />);
    }
    if (value.altKey) {
        modifiersElement.push(<KeyboardKey key="altKey" name={Key.ALT} />);
    }
    if (value.shiftKey) {
        modifiersElement.push(<KeyboardKey key="shiftKey" name={Key.SHIFT} />);
    }

    return (
        <div className={className}>
            {modifiersElement}
            <KeyboardKey name={value.key} last />
        </div>
    );
};
