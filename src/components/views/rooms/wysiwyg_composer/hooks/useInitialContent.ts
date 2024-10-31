/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { useMemo } from "react";

import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { useRoomContext } from "../../../../../contexts/RoomContext";
import { parseEvent } from "../../../../../editor/deserialize";
import { CommandPartCreator, Part } from "../../../../../editor/parts";
import SettingsStore from "../../../../../settings/SettingsStore";
import EditorStateTransfer from "../../../../../utils/EditorStateTransfer";

function getFormattedContent(editorStateTransfer: EditorStateTransfer): string {
    return (
        editorStateTransfer
            .getEvent()
            .getContent()
            .formatted_body?.replace(/<mx-reply>.*<\/mx-reply>/, "") || ""
    );
}

export function parseEditorStateTransfer(
    editorStateTransfer: EditorStateTransfer,
    room: Room,
    mxClient: MatrixClient,
): string {
    const partCreator = new CommandPartCreator(room, mxClient);

    let parts: (Part | undefined)[] = [];
    if (editorStateTransfer.hasEditorState()) {
        // if restoring state from a previous editor,
        // restore serialized parts from the state
        const serializedParts = editorStateTransfer.getSerializedParts();
        if (serializedParts !== null) {
            parts = serializedParts.map((p) => partCreator.deserializePart(p));
        }
    } else {
        // otherwise, either restore serialized parts from localStorage or parse the body of the event
        // TODO local storage
        // const restoredParts = this.restoreStoredEditorState(partCreator);

        if (editorStateTransfer.getEvent().getContent().format === "org.matrix.custom.html") {
            return getFormattedContent(editorStateTransfer);
        }

        parts = parseEvent(editorStateTransfer.getEvent(), partCreator, {
            shouldEscape: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
        });
    }

    return parts.reduce((content, part) => content + part?.text, "");
    // Todo local storage
    // this.saveStoredEditorState();
}

export function useInitialContent(editorStateTransfer: EditorStateTransfer): string | undefined {
    const roomContext = useRoomContext();
    const mxClient = useMatrixClientContext();

    return useMemo<string | undefined>(() => {
        if (editorStateTransfer && roomContext.room && mxClient) {
            return parseEditorStateTransfer(editorStateTransfer, roomContext.room, mxClient);
        }
    }, [editorStateTransfer, roomContext, mxClient]);
}
