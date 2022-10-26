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

import React, { forwardRef, RefObject } from 'react';

import { useWysiwygSendActionHandler } from './hooks/useWysiwygSendActionHandler';
import { WysiwygComposer } from './components/WysiwygComposer';
import { PlainTextComposer } from './components/PlainTextComposer';
import { ComposerFunctions } from './types';

interface ContentProps {
    disabled: boolean;
    composerFunctions: ComposerFunctions;
}

const Content = forwardRef<HTMLElement, ContentProps>(
    function Content({ disabled, composerFunctions }: ContentProps, forwardRef: RefObject<HTMLElement>) {
        useWysiwygSendActionHandler(disabled, forwardRef, composerFunctions);
        return null;
    },
);

interface SendWysiwygComposerProps {
    initialContent?: string;
    isRichTextEnabled: boolean;
    disabled?: boolean;
    onChange: (content: string) => void;
    onSend: () => void;
}

export function SendWysiwygComposer({ isRichTextEnabled, ...props }: SendWysiwygComposerProps) {
    const Composer = isRichTextEnabled ? WysiwygComposer : PlainTextComposer;

    return <Composer className="mx_SendWysiwygComposer" {...props}>
        { (ref, composerFunctions) => (
            <Content disabled={props.disabled} ref={ref} composerFunctions={composerFunctions} />
        ) }
    </Composer>;
}
