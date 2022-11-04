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

import classNames from 'classnames';
import React, { MutableRefObject, ReactNode } from 'react';

import { useComposerFunctions } from '../hooks/useComposerFunctions';
import { useIsFocused } from '../hooks/useIsFocused';
import { usePlainTextInitialization } from '../hooks/usePlainTextInitialization';
import { usePlainTextListeners } from '../hooks/usePlainTextListeners';
import { useSetCursorPosition } from '../hooks/useSetCursorPosition';
import { ComposerFunctions } from '../types';
import { Editor } from "./Editor";

interface PlainTextComposerProps {
    disabled?: boolean;
    onChange?: (content: string) => void;
    onSend?: () => void;
    initialContent?: string;
    className?: string;
    leftComponent?: ReactNode;
    rightComponent?: ReactNode;
    children?: (
        ref: MutableRefObject<HTMLDivElement | null>,
        composerFunctions: ComposerFunctions,
    ) => ReactNode;
}

export function PlainTextComposer({
    className,
    disabled = false,
    onSend,
    onChange,
    children,
    initialContent,
    leftComponent,
    rightComponent,
}: PlainTextComposerProps,
) {
    const { ref, onInput, onPaste, onKeyDown } = usePlainTextListeners(onChange, onSend);
    const composerFunctions = useComposerFunctions(ref);
    usePlainTextInitialization(initialContent, ref);
    useSetCursorPosition(disabled, ref);
    const { isFocused, onFocus } = useIsFocused();

    return <div
        data-testid="PlainTextComposer"
        className={classNames(className, { [`${className}-focused`]: isFocused })}
        onFocus={onFocus}
        onBlur={onFocus}
        onInput={onInput}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
    >
        <Editor ref={ref} disabled={disabled} leftComponent={leftComponent} rightComponent={rightComponent} />
        { children?.(ref, composerFunctions) }
    </div>;
}
