/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { MouseEventHandler } from "react";
import { FormattingFunctions, FormattingStates } from "@matrix-org/matrix-wysiwyg";
import classNames from "classnames";

import AccessibleTooltipButton from "../../../elements/AccessibleTooltipButton";
import { Alignment } from "../../../elements/Tooltip";
import { KeyboardShortcut } from "../../../settings/KeyboardShortcut";
import { KeyCombo } from "../../../../../KeyBindingsManager";
import { _td } from "../../../../../languageHandler";

interface TooltipProps {
    label: string;
    keyCombo?: KeyCombo;
}

function Tooltip({ label, keyCombo }: TooltipProps) {
    return <div className="mx_FormattingButtons_Tooltip">
        { label }
        { keyCombo && <KeyboardShortcut value={keyCombo} className="mx_FormattingButtons_Tooltip_KeyboardShortcut" /> }
    </div>;
}

interface ButtonProps extends TooltipProps {
    className: string;
    isActive: boolean;
    onClick: MouseEventHandler<HTMLButtonElement>;
}

function Button({ label, keyCombo, onClick, isActive, className }: ButtonProps) {
    return <AccessibleTooltipButton
        element="button"
        onClick={onClick}
        title={label}
        className={
            classNames('mx_FormattingButtons_Button', className, { 'mx_FormattingButtons_active': isActive })}
        tooltip={keyCombo && <Tooltip label={label} keyCombo={keyCombo} />}
        alignment={Alignment.Top}
    />;
}

interface FormattingButtonsProps {
    composer: FormattingFunctions;
    formattingStates: FormattingStates;
}

export function FormattingButtons({ composer, formattingStates }: FormattingButtonsProps) {
    return <div className="mx_FormattingButtons">
        <Button isActive={formattingStates.bold === 'reversed'} label={_td("Bold")} keyCombo={{ ctrlOrCmdKey: true, key: 'b' }} onClick={() => composer.bold()} className="mx_FormattingButtons_Button_bold" />
        <Button isActive={formattingStates.italic === 'reversed'} label={_td('Italic')} keyCombo={{ ctrlOrCmdKey: true, key: 'i' }} onClick={() => composer.italic()} className="mx_FormattingButtons_Button_italic" />
        <Button isActive={formattingStates.underline === 'reversed'} label={_td('Underline')} keyCombo={{ ctrlOrCmdKey: true, key: 'u' }} onClick={() => composer.underline()} className="mx_FormattingButtons_Button_underline" />
        <Button isActive={formattingStates.strikeThrough === 'reversed'} label={_td('Strikethrough')} onClick={() => composer.strikeThrough()} className="mx_FormattingButtons_Button_strikethrough" />
    </div>;
}
