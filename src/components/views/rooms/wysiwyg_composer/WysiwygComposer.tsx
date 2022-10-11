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

import React, { useCallback, useState } from 'react';
import { useWysiwyg } from "@matrix-org/matrix-wysiwyg";
import { IEventRelation, MatrixEvent } from 'matrix-js-sdk/src/models/event';

import { useRoomContext } from '../../../../contexts/RoomContext';
import { sendMessage } from './message';
import { RoomPermalinkCreator } from '../../../../utils/permalinks/Permalinks';
import { useMatrixClientContext } from '../../../../contexts/MatrixClientContext';

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

    const [content, setContent] = useState<string>();
    const { ref, isWysiwygReady, wysiwyg } = useWysiwyg({ onChange: (_content) => {
        setContent(_content);
        onChange(_content);
    } });

    const memoizedSendMessage = useCallback(() => {
        sendMessage(content, { mxClient, roomContext, ...props });
        wysiwyg.clear();
        ref.current?.focus();
    }, [content, mxClient, roomContext, wysiwyg, props, ref]);

    return (
        <div className="mx_WysiwygComposer">
            <div className="mx_WysiwygComposer_container">
                <div className="mx_WysiwygComposer_content"
                    ref={ref}
                    contentEditable={!disabled && isWysiwygReady}
                    role="textbox"
                    aria-multiline="true"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    dir="auto"
                    aria-disabled={disabled || !isWysiwygReady}
                />
            </div>
            { children?.(memoizedSendMessage) }
        </div>
    );
}
