/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React, { useContext, useMemo, useState } from "react";
import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";

import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { EventEditor, EventViewer, eventTypeField, IEditorProps, stringify } from "./Event";
import FilteredList from "./FilteredList";
import { _t } from "../../../../languageHandler";

export const AccountDataEventEditor: React.FC<IEditorProps> = ({ mxEvent, onBack }) => {
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(() => [eventTypeField(mxEvent?.getType())], [mxEvent]);

    const onSend = async ([eventType]: string[], content?: IContent): Promise<void> => {
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
    actionLabel: string;
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
            actionLabel={_t("Send custom account data event")}
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
            actionLabel={_t("Send custom room account data event")}
            onBack={onBack}
            setTool={setTool}
        />
    );
};
