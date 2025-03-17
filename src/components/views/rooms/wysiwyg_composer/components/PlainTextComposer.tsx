/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import { type IEventRelation } from "matrix-js-sdk/src/matrix";
import React, { type MutableRefObject, type ReactNode } from "react";

import { useComposerFunctions } from "../hooks/useComposerFunctions";
import { useIsFocused } from "../hooks/useIsFocused";
import { usePlainTextInitialization } from "../hooks/usePlainTextInitialization";
import { usePlainTextListeners } from "../hooks/usePlainTextListeners";
import { useSetCursorPosition } from "../hooks/useSetCursorPosition";
import { type ComposerFunctions } from "../types";
import { Editor } from "./Editor";
import { WysiwygAutocomplete } from "./WysiwygAutocomplete";
import { useSettingValue } from "../../../../../hooks/useSettings";

interface PlainTextComposerProps {
    disabled?: boolean;
    onChange?: (content: string) => void;
    onSend?: () => void;
    placeholder?: string;
    initialContent?: string;
    className?: string;
    leftComponent?: ReactNode;
    rightComponent?: ReactNode;
    children?: (ref: MutableRefObject<HTMLDivElement | null>, composerFunctions: ComposerFunctions) => ReactNode;
    eventRelation?: IEventRelation;
}

export function PlainTextComposer({
    className,
    disabled = false,
    onSend,
    onChange,
    children,
    placeholder,
    initialContent,
    leftComponent,
    rightComponent,
    eventRelation,
}: PlainTextComposerProps): JSX.Element {
    const isAutoReplaceEmojiEnabled = useSettingValue("MessageComposerInput.autoReplaceEmoji");
    const {
        ref: editorRef,
        autocompleteRef,
        onBeforeInput,
        onInput,
        onPaste,
        onKeyDown,
        content,
        setContent,
        suggestion,
        onSelect,
        handleCommand,
        handleMention,
        handleAtRoomMention,
    } = usePlainTextListeners(initialContent, onChange, onSend, eventRelation, isAutoReplaceEmojiEnabled);
    const composerFunctions = useComposerFunctions(editorRef, setContent);
    usePlainTextInitialization(initialContent, editorRef);
    useSetCursorPosition(disabled, editorRef);
    const { isFocused, onFocus } = useIsFocused();
    const computedPlaceholder = (!content && placeholder) || undefined;
    return (
        <div
            data-testid="PlainTextComposer"
            className={classNames(className, { [`${className}-focused`]: isFocused })}
            onFocus={onFocus}
            onBlur={onFocus}
            onBeforeInput={onBeforeInput}
            onInput={onInput}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            onSelect={onSelect}
        >
            <WysiwygAutocomplete
                ref={autocompleteRef}
                suggestion={suggestion}
                handleMention={handleMention}
                handleCommand={handleCommand}
                handleAtRoomMention={handleAtRoomMention}
            />
            <Editor
                ref={editorRef}
                disabled={disabled}
                leftComponent={leftComponent}
                rightComponent={rightComponent}
                placeholder={computedPlaceholder}
            />
            {children?.(editorRef, composerFunctions)}
        </div>
    );
}
