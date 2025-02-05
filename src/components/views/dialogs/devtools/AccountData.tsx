/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useMemo, useState } from "react";
import { type AccountDataEvents, type IContent, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { EventEditor, EventViewer, eventTypeField, type IEditorProps, stringify } from "./Event";
import FilteredList from "./FilteredList";
import { _td, type TranslationKey } from "../../../../languageHandler";

export const AccountDataEventEditor: React.FC<IEditorProps> = ({ mxEvent, onBack }) => {
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(() => [eventTypeField(mxEvent?.getType())], [mxEvent]);

    const onSend = async ([eventType]: Array<keyof AccountDataEvents>, content?: IContent): Promise<void> => {
        await cli.setAccountData(eventType, content || {});
    };

    const defaultContent = mxEvent ? stringify(mxEvent.getContent()) : undefined;
    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};

export const RoomAccountDataEventEditor: React.FC<IEditorProps> = ({ mxEvent, onBack }) => {
    const context = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(() => [eventTypeField(mxEvent?.getType())], [mxEvent]);

    const onSend = async ([eventType]: string[], content?: IContent): Promise<void> => {
        await cli.setRoomAccountData(context.room.roomId, eventType, content || {});
    };

    const defaultContent = mxEvent ? stringify(mxEvent.getContent()) : undefined;
    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};

interface IProps extends IDevtoolsProps {
    events: Map<string, MatrixEvent>;
    Editor: React.FC<IEditorProps>;
    actionLabel: TranslationKey;
}

const BaseAccountDataExplorer: React.FC<IProps> = ({ events, Editor, actionLabel, onBack, setTool }) => {
    const [query, setQuery] = useState("");
    const [event, setEvent] = useState<MatrixEvent | null>(null);

    if (event) {
        const onBack = (): void => {
            setEvent(null);
        };
        return <EventViewer mxEvent={event} onBack={onBack} Editor={Editor} />;
    }

    const onAction = async (): Promise<void> => {
        setTool(actionLabel, Editor);
    };

    return (
        <BaseTool onBack={onBack} actionLabel={actionLabel} onAction={onAction}>
            <FilteredList query={query} onChange={setQuery}>
                {Array.from(events.entries()).map(([eventType, ev]) => {
                    const onClick = (): void => {
                        setEvent(ev);
                    };

                    return (
                        <button className="mx_DevTools_button" key={eventType} onClick={onClick}>
                            {eventType}
                        </button>
                    );
                })}
            </FilteredList>
        </BaseTool>
    );
};

export const AccountDataExplorer: React.FC<IDevtoolsProps> = ({ onBack, setTool }) => {
    const cli = useContext(MatrixClientContext);

    return (
        <BaseAccountDataExplorer
            events={cli.store.accountData}
            Editor={AccountDataEventEditor}
            actionLabel={_td("devtools|send_custom_account_data_event")}
            onBack={onBack}
            setTool={setTool}
        />
    );
};

export const RoomAccountDataExplorer: React.FC<IDevtoolsProps> = ({ onBack, setTool }) => {
    const context = useContext(DevtoolsContext);

    return (
        <BaseAccountDataExplorer
            events={context.room.accountData}
            Editor={RoomAccountDataEventEditor}
            actionLabel={_td("devtools|send_custom_room_account_data_event")}
            onBack={onBack}
            setTool={setTool}
        />
    );
};
