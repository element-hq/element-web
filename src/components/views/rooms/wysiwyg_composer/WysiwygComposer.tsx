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

import React, { useCallback, useEffect } from 'react';
import { IEventRelation, MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { useWysiwyg, Wysiwyg, WysiwygInputEvent } from "@matrix-org/matrix-wysiwyg";

import { Editor } from './Editor';
import { FormattingButtons } from './FormattingButtons';
import { RoomPermalinkCreator } from '../../../../utils/permalinks/Permalinks';
import { sendMessage } from './message';
import { useMatrixClientContext } from '../../../../contexts/MatrixClientContext';
import { useRoomContext } from '../../../../contexts/RoomContext';
import { useWysiwygActionHandler } from './useWysiwygActionHandler';
import { useSettingValue } from '../../../../hooks/useSettings';

interface WysiwygProps {
    disabled?: boolean;
    onChange: (content: string) => void;
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
    permalinkCreator: RoomPermalinkCreator;
    includeReplyLegacyFallback?: boolean;
    children?: (sendMessage: () => void) => void;
}

export function WysiwygComposer(
    { disabled = false, onChange, children, ...props }: WysiwygProps,
) {
    const roomContext = useRoomContext();
    const mxClient = useMatrixClientContext();
    const ctrlEnterToSend = useSettingValue("MessageComposerInput.ctrlEnterToSend");

    function inputEventProcessor(event: WysiwygInputEvent, wysiwyg: Wysiwyg): WysiwygInputEvent | null {
        if (event instanceof ClipboardEvent) {
            return event;
        }

        if (
            (event.inputType === 'insertParagraph' && !ctrlEnterToSend) ||
            event.inputType === 'sendMessage'
        ) {
            sendMessage(content, { mxClient, roomContext, ...props });
            wysiwyg.actions.clear();
            ref.current?.focus();
            return null;
        }

        return event;
    }

    const { ref, isWysiwygReady, content, formattingStates, wysiwyg } = useWysiwyg({ inputEventProcessor });

    useEffect(() => {
        if (!disabled && content !== null) {
            onChange(content);
        }
    }, [onChange, content, disabled]);

    const memoizedSendMessage = useCallback(() => {
        sendMessage(content, { mxClient, roomContext, ...props });
        wysiwyg.clear();
        ref.current?.focus();
    }, [content, mxClient, roomContext, wysiwyg, props, ref]);

    useWysiwygActionHandler(disabled, ref);

    return (
        <div className="mx_WysiwygComposer">
            <FormattingButtons composer={wysiwyg} formattingStates={formattingStates} />
            <Editor ref={ref} disabled={!isWysiwygReady || disabled} />
            { children?.(memoizedSendMessage) }
        </div>
    );
}
