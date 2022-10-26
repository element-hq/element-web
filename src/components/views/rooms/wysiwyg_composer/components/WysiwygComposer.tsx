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

import React, { memo, MutableRefObject, ReactNode, useEffect } from 'react';
import { useWysiwyg, FormattingFunctions } from "@matrix-org/matrix-wysiwyg";

import { FormattingButtons } from './FormattingButtons';
import { Editor } from './Editor';
import { useInputEventProcessor } from '../hooks/useInputEventProcessor';
import { useSetCursorPosition } from '../hooks/useSetCursorPosition';

interface WysiwygComposerProps {
    disabled?: boolean;
    onChange?: (content: string) => void;
    onSend: () => void;
    initialContent?: string;
    className?: string;
    children?: (
        ref: MutableRefObject<HTMLDivElement | null>,
        wysiwyg: FormattingFunctions,
    ) => ReactNode;
}

export const WysiwygComposer = memo(function WysiwygComposer(
    { disabled = false, onChange, onSend, initialContent, className, children }: WysiwygComposerProps,
) {
    const inputEventProcessor = useInputEventProcessor(onSend);

    const { ref, isWysiwygReady, content, formattingStates, wysiwyg } =
        useWysiwyg({ initialContent, inputEventProcessor });

    useEffect(() => {
        if (!disabled && content !== null) {
            onChange?.(content);
        }
    }, [onChange, content, disabled]);

    const isReady = isWysiwygReady && !disabled;
    useSetCursorPosition(!isReady, ref);

    return (
        <div data-testid="WysiwygComposer" className={className}>
            <FormattingButtons composer={wysiwyg} formattingStates={formattingStates} />
            <Editor ref={ref} disabled={!isReady} />
            { children?.(ref, wysiwyg) }
        </div>
    );
});
