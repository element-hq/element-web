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

import React, { MutableRefObject, ReactNode, useEffect } from 'react';
import { useWysiwyg } from "@matrix-org/matrix-wysiwyg";

import { FormattingButtons } from './FormattingButtons';
import { Editor } from './Editor';
import { Wysiwyg } from '../types';

interface WysiwygComposerProps {
    disabled?: boolean;
    onChange?: (content: string) => void;
    initialContent?: string;
    children?: (ref: MutableRefObject<HTMLDivElement | null>, wysiwyg: Wysiwyg, content: string) => ReactNode;
}

export function WysiwygComposer(
    { disabled = false, onChange, initialContent, children }: WysiwygComposerProps,
) {
    const { ref, isWysiwygReady, content, formattingStates, wysiwyg } = useWysiwyg({ initialContent });

    useEffect(() => {
        if (!disabled && content !== null) {
            onChange?.(content);
        }
    }, [onChange, content, disabled]);

    return (
        <div className="mx_WysiwygComposer">
            <FormattingButtons composer={wysiwyg} formattingStates={formattingStates} />
            <Editor ref={ref} disabled={!isWysiwygReady || disabled} />
            { children?.(ref, wysiwyg, content) }
        </div>
    );
}
