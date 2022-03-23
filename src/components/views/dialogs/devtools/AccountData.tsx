/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

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

export const AccountDataEventEditor = ({ mxEvent, onBack }: IEditorProps) => {
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(() => [
        eventTypeField(mxEvent?.getType()),
    ], [mxEvent]);

    const onSend = ([eventType]: string[], content?: IContent) => {
        return cli.setAccountData(eventType, content);
    };

    const defaultContent = mxEvent ? stringify(mxEvent.getContent()) : undefined;
    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};

export const RoomAccountDataEventEditor = ({ mxEvent, onBack }: IEditorProps) => {
    const context = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(() => [
        eventTypeField(mxEvent?.getType()),
    ], [mxEvent]);

    const onSend = ([eventType]: string[], content?: IContent) => {
        return cli.setRoomAccountData(context.room.roomId, eventType, content);
    };

    const defaultContent = mxEvent ? stringify(mxEvent.getContent()) : undefined;
    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};

interface IProps extends IDevtoolsProps {
    events: Record<string, MatrixEvent>;
    Editor: React.FC<IEditorProps>;
    actionLabel: string;
}

const BaseAccountDataExplorer = ({ events, Editor, actionLabel, onBack, setTool }: IProps) => {
    const [query, setQuery] = useState("");
    const [event, setEvent] = useState<MatrixEvent>(null);

    if (event) {
        const onBack = () => {
            setEvent(null);
        };
        return <EventViewer mxEvent={event} onBack={onBack} Editor={Editor} />;
    }

    const onAction = async () => {
        setTool(actionLabel, Editor);
    };

    return <BaseTool onBack={onBack} actionLabel={actionLabel} onAction={onAction}>
        <FilteredList query={query} onChange={setQuery}>
            {
                Object.entries(events).map(([eventType, ev]) => {
                    const onClick = () => {
                        setEvent(ev);
                    };

                    return <button className="mx_DevTools_button" key={eventType} onClick={onClick}>
                        { eventType }
                    </button>;
                })
            }
        </FilteredList>
    </BaseTool>;
};

export const AccountDataExplorer = ({ onBack, setTool }: IDevtoolsProps) => {
    const cli = useContext(MatrixClientContext);

    return <BaseAccountDataExplorer
        events={cli.store.accountData}
        Editor={AccountDataEventEditor}
        actionLabel={_t("Send custom account data event")}
        onBack={onBack}
        setTool={setTool}
    />;
};

export const RoomAccountDataExplorer = ({ onBack, setTool }: IDevtoolsProps) => {
    const context = useContext(DevtoolsContext);

    return <BaseAccountDataExplorer
        events={context.room.accountData}
        Editor={RoomAccountDataEventEditor}
        actionLabel={_t("Send custom room account data event")}
        onBack={onBack}
        setTool={setTool}
    />;
};
