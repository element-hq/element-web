/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { ALTERNATE_KEY_NAME, KEY_ICON } from "../../../accessibility/KeyboardShortcuts";
import { type KeyCombo } from "../../../KeyBindingsManager";
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
