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

import React, { forwardRef, RefObject, useMemo } from 'react';
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { useRoomContext } from '../../../../contexts/RoomContext';
import { useMatrixClientContext } from '../../../../contexts/MatrixClientContext';
import EditorStateTransfer from '../../../../utils/EditorStateTransfer';
import { CommandPartCreator, Part } from '../../../../editor/parts';
import { IRoomState } from '../../../structures/RoomView';
import SettingsStore from '../../../../settings/SettingsStore';
import { parseEvent } from '../../../../editor/deserialize';
import { WysiwygComposer } from './components/WysiwygComposer';
import { EditionButtons } from './components/EditionButtons';
import { useWysiwygEditActionHandler } from './hooks/useWysiwygEditActionHandler';
import { endEditing } from './utils/editing';
import { editMessage } from './utils/message';

function parseEditorStateTransfer(
    editorStateTransfer: EditorStateTransfer,
    roomContext: IRoomState,
    mxClient: MatrixClient,
) {
    if (!roomContext.room) {
        return;
    }

    const { room } = roomContext;

    const partCreator = new CommandPartCreator(room, mxClient);

    let parts: Part[];
    if (editorStateTransfer.hasEditorState()) {
        // if restoring state from a previous editor,
        // restore serialized parts from the state
        parts = editorStateTransfer.getSerializedParts().map(p => partCreator.deserializePart(p));
    } else {
        // otherwise, either restore serialized parts from localStorage or parse the body of the event
        // TODO local storage
        // const restoredParts = this.restoreStoredEditorState(partCreator);

        if (editorStateTransfer.getEvent().getContent().format === 'org.matrix.custom.html') {
            return editorStateTransfer.getEvent().getContent().formatted_body || "";
        }

        parts = parseEvent(editorStateTransfer.getEvent(), partCreator, {
            shouldEscape: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
        });
    }

    return parts.reduce((content, part) => content + part.text, '');
    // Todo local storage
    // this.saveStoredEditorState();
}

interface ContentProps {
    disabled: boolean;
}

const Content = forwardRef<HTMLElement, ContentProps>(
    function Content({ disabled }: ContentProps, forwardRef: RefObject<HTMLElement>) {
        useWysiwygEditActionHandler(disabled, forwardRef);
        return null;
    },
);

interface EditWysiwygComposerProps {
    disabled?: boolean;
    onChange?: (content: string) => void;
    editorStateTransfer?: EditorStateTransfer;
}

export function EditWysiwygComposer({ editorStateTransfer, ...props }: EditWysiwygComposerProps) {
    const roomContext = useRoomContext();
    const mxClient = useMatrixClientContext();

    const initialContent = useMemo(() => {
        if (editorStateTransfer) {
            return parseEditorStateTransfer(editorStateTransfer, roomContext, mxClient);
        }
    }, [editorStateTransfer, roomContext, mxClient]);
    const isReady = !editorStateTransfer || Boolean(initialContent);

    return isReady && <WysiwygComposer initialContent={initialContent} {...props}>{ (ref, wysiwyg, content) => (
        <>
            <Content disabled={props.disabled} ref={ref} />
            <EditionButtons onCancelClick={() => endEditing(roomContext)} onSaveClick={() => editMessage(content, { roomContext, mxClient, editorStateTransfer })} />
        </>)
    }
    </WysiwygComposer>;
}
