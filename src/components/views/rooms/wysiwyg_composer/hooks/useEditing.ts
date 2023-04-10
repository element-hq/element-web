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

import { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import { useCallback, useState } from "react";

import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { useRoomContext } from "../../../../../contexts/RoomContext";
import EditorStateTransfer from "../../../../../utils/EditorStateTransfer";
import { endEditing } from "../utils/editing";
import { editMessage } from "../utils/message";

export function useEditing(
    editorStateTransfer: EditorStateTransfer,
    initialContent?: string,
): {
    isSaveDisabled: boolean;
    onChange(content: string): void;
    editMessage(): Promise<ISendEventResponse | undefined>;
    endEditing(): void;
} {
    const roomContext = useRoomContext();
    const mxClient = useMatrixClientContext();

    const [isSaveDisabled, setIsSaveDisabled] = useState(true);
    const [content, setContent] = useState(initialContent);
    const onChange = useCallback(
        (_content: string) => {
            setContent(_content);
            setIsSaveDisabled((_isSaveDisabled) => _isSaveDisabled && _content === initialContent);
        },
        [initialContent],
    );

    const editMessageMemoized = useCallback(async () => {
        if (mxClient === undefined || content === undefined) {
            return;
        }
        return editMessage(content, { roomContext, mxClient, editorStateTransfer });
    }, [content, roomContext, mxClient, editorStateTransfer]);

    const endEditingMemoized = useCallback(() => endEditing(roomContext), [roomContext]);
    return { onChange, editMessage: editMessageMemoized, endEditing: endEditingMemoized, isSaveDisabled };
}
