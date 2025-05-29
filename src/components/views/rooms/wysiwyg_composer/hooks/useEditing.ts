/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ISendEventResponse } from "matrix-js-sdk/src/matrix";
import { useCallback, useState } from "react";

import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import type EditorStateTransfer from "../../../../../utils/EditorStateTransfer";
import { endEditing } from "../utils/editing";
import { editMessage } from "../utils/message";
import { useScopedRoomContext } from "../../../../../contexts/ScopedRoomContext.tsx";

export function useEditing(
    editorStateTransfer: EditorStateTransfer,
    initialContent?: string,
): {
    isSaveDisabled: boolean;
    onChange(content: string): void;
    editMessage(): Promise<ISendEventResponse | undefined>;
    endEditing(): void;
} {
    const roomContext = useScopedRoomContext("timelineRenderingType");
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
