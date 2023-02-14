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

import React, { MouseEventHandler, ReactNode } from "react";
import { FormattingFunctions, AllActionStates, ActionState } from "@matrix-org/matrix-wysiwyg";
import classNames from "classnames";

import { Icon as BoldIcon } from "../../../../../../res/img/element-icons/room/composer/bold.svg";
import { Icon as ItalicIcon } from "../../../../../../res/img/element-icons/room/composer/italic.svg";
import { Icon as UnderlineIcon } from "../../../../../../res/img/element-icons/room/composer/underline.svg";
import { Icon as StrikeThroughIcon } from "../../../../../../res/img/element-icons/room/composer/strikethrough.svg";
import { Icon as QuoteIcon } from "../../../../../../res/img/element-icons/room/composer/quote.svg";
import { Icon as InlineCodeIcon } from "../../../../../../res/img/element-icons/room/composer/inline_code.svg";
import { Icon as LinkIcon } from "../../../../../../res/img/element-icons/room/composer/link.svg";
import { Icon as BulletedListIcon } from "../../../../../../res/img/element-icons/room/composer/bulleted_list.svg";
import { Icon as NumberedListIcon } from "../../../../../../res/img/element-icons/room/composer/numbered_list.svg";
import { Icon as CodeBlockIcon } from "../../../../../../res/img/element-icons/room/composer/code_block.svg";
import { Icon as IndentIcon } from "../../../../../../res/img/element-icons/room/composer/indent_increase.svg";
import { Icon as UnIndentIcon } from "../../../../../../res/img/element-icons/room/composer/indent_decrease.svg";
import AccessibleTooltipButton from "../../../elements/AccessibleTooltipButton";
import { Alignment } from "../../../elements/Tooltip";
import { KeyboardShortcut } from "../../../settings/KeyboardShortcut";
import { KeyCombo } from "../../../../../KeyBindingsManager";
import { _td } from "../../../../../languageHandler";
import { ButtonEvent } from "../../../elements/AccessibleButton";
import { openLinkModal } from "./LinkModal";
import { useComposerContext } from "../ComposerContext";

interface TooltipProps {
    label: string;
    keyCombo?: KeyCombo;
}

function Tooltip({ label, keyCombo }: TooltipProps): JSX.Element {
    return (
        <div className="mx_FormattingButtons_Tooltip">
            {label}
            {keyCombo && (
                <KeyboardShortcut value={keyCombo} className="mx_FormattingButtons_Tooltip_KeyboardShortcut" />
            )}
        </div>
    );
}

interface ButtonProps extends TooltipProps {
    icon: ReactNode;
    actionState: ActionState;
    onClick: MouseEventHandler<HTMLButtonElement>;
}

function Button({ label, keyCombo, onClick, actionState, icon }: ButtonProps): JSX.Element {
    return (
        <AccessibleTooltipButton
            element="button"
            onClick={onClick as (e: ButtonEvent) => void}
            title={label}
            className={classNames("mx_FormattingButtons_Button", {
                mx_FormattingButtons_active: actionState === "reversed",
                mx_FormattingButtons_Button_hover: actionState === "enabled",
                mx_FormattingButtons_disabled: actionState === "disabled",
            })}
            tooltip={keyCombo && <Tooltip label={label} keyCombo={keyCombo} />}
            forceHide={actionState === "disabled"}
            alignment={Alignment.Top}
        >
            {icon}
        </AccessibleTooltipButton>
    );
}

interface FormattingButtonsProps {
    composer: FormattingFunctions;
    actionStates: AllActionStates;
}

export function FormattingButtons({ composer, actionStates }: FormattingButtonsProps): JSX.Element {
    const composerContext = useComposerContext();
    const isInList = actionStates.unorderedList === "reversed" || actionStates.orderedList === "reversed";
    return (
        <div className="mx_FormattingButtons">
            <Button
                actionState={actionStates.bold}
                label={_td("Bold")}
                keyCombo={{ ctrlOrCmdKey: true, key: "b" }}
                onClick={() => composer.bold()}
                icon={<BoldIcon className="mx_FormattingButtons_Icon" />}
            />
            <Button
                actionState={actionStates.italic}
                label={_td("Italic")}
                keyCombo={{ ctrlOrCmdKey: true, key: "i" }}
                onClick={() => composer.italic()}
                icon={<ItalicIcon className="mx_FormattingButtons_Icon" />}
            />
            <Button
                actionState={actionStates.underline}
                label={_td("Underline")}
                keyCombo={{ ctrlOrCmdKey: true, key: "u" }}
                onClick={() => composer.underline()}
                icon={<UnderlineIcon className="mx_FormattingButtons_Icon" />}
            />
            <Button
                actionState={actionStates.strikeThrough}
                label={_td("Strikethrough")}
                onClick={() => composer.strikeThrough()}
                icon={<StrikeThroughIcon className="mx_FormattingButtons_Icon" />}
            />
            <Button
                actionState={actionStates.unorderedList}
                label={_td("Bulleted list")}
                onClick={() => composer.unorderedList()}
                icon={<BulletedListIcon className="mx_FormattingButtons_Icon" />}
            />
            <Button
                actionState={actionStates.orderedList}
                label={_td("Numbered list")}
                onClick={() => composer.orderedList()}
                icon={<NumberedListIcon className="mx_FormattingButtons_Icon" />}
            />
            {isInList && (
                <Button
                    actionState={actionStates.indent}
                    label={_td("Indent increase")}
                    onClick={() => composer.indent()}
                    icon={<IndentIcon className="mx_FormattingButtons_Icon" />}
                />
            )}
            {isInList && (
                <Button
                    actionState={actionStates.unindent}
                    label={_td("Indent decrease")}
                    onClick={() => composer.unindent()}
                    icon={<UnIndentIcon className="mx_FormattingButtons_Icon" />}
                />
            )}
            <Button
                actionState={actionStates.quote}
                label={_td("Quote")}
                onClick={() => composer.quote()}
                icon={<QuoteIcon className="mx_FormattingButtons_Icon" />}
            />
            <Button
                actionState={actionStates.inlineCode}
                label={_td("Code")}
                keyCombo={{ ctrlOrCmdKey: true, key: "e" }}
                onClick={() => composer.inlineCode()}
                icon={<InlineCodeIcon className="mx_FormattingButtons_Icon" />}
            />
            <Button
                actionState={actionStates.codeBlock}
                label={_td("Code block")}
                onClick={() => composer.codeBlock()}
                icon={<CodeBlockIcon className="mx_FormattingButtons_Icon" />}
            />
            <Button
                actionState={actionStates.link}
                label={_td("Link")}
                onClick={() => openLinkModal(composer, composerContext, actionStates.link === "reversed")}
                icon={<LinkIcon className="mx_FormattingButtons_Icon" />}
            />
        </div>
    );
}
