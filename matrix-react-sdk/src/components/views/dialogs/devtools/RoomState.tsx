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

import React, { useContext, useEffect, useMemo, useState } from "react";
import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import classNames from "classnames";

import { _t } from "../../../../languageHandler";
import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { EventEditor, EventViewer, eventTypeField, stateKeyField, IEditorProps, stringify } from "./Event";
import FilteredList from "./FilteredList";

export const StateEventEditor: React.FC<IEditorProps> = ({ mxEvent, onBack }) => {
    const context = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(
        () => [eventTypeField(mxEvent?.getType()), stateKeyField(mxEvent?.getStateKey())],
        [mxEvent],
    );

    const onSend = async ([eventType, stateKey]: string[], content?: IContent): Promise<void> => {
        await cli.sendStateEvent(context.room.roomId, eventType, content, stateKey);
    };

    const defaultContent = mxEvent ? stringify(mxEvent.getContent()) : undefined;
    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};

interface StateEventButtonProps {
    label: string;
    onClick(): void;
}

const StateEventButton: React.FC<StateEventButtonProps> = ({ label, onClick }) => {
    const trimmed = label.trim();

    return (
        <button
            className={classNames("mx_DevTools_button", {
                mx_DevTools_RoomStateExplorer_button_hasSpaces: trimmed.length !== label.length,
                mx_DevTools_RoomStateExplorer_button_emptyString: !trimmed,
            })}
            onClick={onClick}
        >
            {trimmed ? label : _t("<%(count)s spaces>", { count: label.length })}
        </button>
    );
};

interface IEventTypeProps extends Pick<IDevtoolsProps, "onBack"> {
    eventType: string;
}

const RoomStateExplorerEventType: React.FC<IEventTypeProps> = ({ eventType, onBack }) => {
    const context = useContext(DevtoolsContext);
    const [query, setQuery] = useState("");
    const [event, setEvent] = useState<MatrixEvent | null>(null);

    const events = context.room.currentState.events.get(eventType)!;

    useEffect(() => {
        if (events.size === 1 && events.has("")) {
            setEvent(events.get("")!);
        } else {
            setEvent(null);
        }
    }, [events]);

    if (event) {
        const _onBack = (): void => {
            if (events?.size === 1 && events.has("")) {
                onBack();
            } else {
                setEvent(null);
            }
        };
        return <EventViewer mxEvent={event} onBack={_onBack} Editor={StateEventEditor} />;
    }

    return (
        <BaseTool onBack={onBack}>
            <FilteredList query={query} onChange={setQuery}>
                {Array.from(events.entries()).map(([stateKey, ev]) => (
                    <StateEventButton key={stateKey} label={stateKey} onClick={() => setEvent(ev)} />
                ))}
            </FilteredList>
        </BaseTool>
    );
};

export const RoomStateExplorer: React.FC<IDevtoolsProps> = ({ onBack, setTool }) => {
    const context = useContext(DevtoolsContext);
    const [query, setQuery] = useState("");
    const [eventType, setEventType] = useState<string | null>(null);

    const events = context.room.currentState.events;

    if (eventType !== null) {
        const onBack = (): void => {
            setEventType(null);
        };
        return <RoomStateExplorerEventType eventType={eventType} onBack={onBack} />;
    }

    const onAction = async (): Promise<void> => {
        setTool(_t("Send custom state event"), StateEventEditor);
    };

    return (
        <BaseTool onBack={onBack} actionLabel={_t("Send custom state event")} onAction={onAction}>
            <FilteredList query={query} onChange={setQuery}>
                {Array.from(events.keys()).map((eventType) => (
                    <StateEventButton key={eventType} label={eventType} onClick={() => setEventType(eventType)} />
                ))}
            </FilteredList>
        </BaseTool>
    );
};
