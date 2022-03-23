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

import React, { useContext, useEffect, useMemo, useState } from "react";
import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import classNames from "classnames";

import { _t } from "../../../../languageHandler";
import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { EventEditor, EventViewer, eventTypeField, stateKeyField, IEditorProps, stringify } from "./Event";
import FilteredList from "./FilteredList";

export const StateEventEditor = ({ mxEvent, onBack }: IEditorProps) => {
    const context = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(() => [
        eventTypeField(mxEvent?.getType()),
        stateKeyField(mxEvent?.getStateKey()),
    ], [mxEvent]);

    const onSend = ([eventType, stateKey]: string[], content?: IContent) => {
        return cli.sendStateEvent(context.room.roomId, eventType, content, stateKey);
    };

    const defaultContent = mxEvent ? stringify(mxEvent.getContent()) : undefined;
    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};

interface IEventTypeProps extends Pick<IDevtoolsProps, "onBack"> {
    eventType: string;
}

const RoomStateExplorerEventType = ({ eventType, onBack }: IEventTypeProps) => {
    const context = useContext(DevtoolsContext);
    const [query, setQuery] = useState("");
    const [event, setEvent] = useState<MatrixEvent>(null);

    const events = context.room.currentState.events.get(eventType);

    useEffect(() => {
        if (events.size === 1 && events.has("")) {
            setEvent(events.get(""));
        } else {
            setEvent(null);
        }
    }, [events]);

    if (event) {
        const onBack = () => {
            setEvent(null);
        };
        return <EventViewer mxEvent={event} onBack={onBack} Editor={StateEventEditor} />;
    }

    return <BaseTool onBack={onBack}>
        <FilteredList query={query} onChange={setQuery}>
            {
                Array.from(events.entries()).map(([stateKey, ev]) => {
                    const trimmed = stateKey.trim();
                    const onClick = () => {
                        setEvent(ev);
                    };

                    return <button
                        className={classNames("mx_DevTools_button", {
                            mx_DevTools_RoomStateExplorer_button_hasSpaces: trimmed.length !== stateKey.length,
                            mx_DevTools_RoomStateExplorer_button_emptyString: !trimmed,
                        })}
                        key={stateKey}
                        onClick={onClick}
                    >
                        { trimmed ? stateKey : _t("<%(count)s spaces>", { count: stateKey.length }) }
                    </button>;
                })
            }
        </FilteredList>
    </BaseTool>;
};

export const RoomStateExplorer = ({ onBack, setTool }: IDevtoolsProps) => {
    const context = useContext(DevtoolsContext);
    const [query, setQuery] = useState("");
    const [eventType, setEventType] = useState<string>(null);

    const events = context.room.currentState.events;

    if (eventType) {
        const onBack = () => {
            setEventType(null);
        };
        return <RoomStateExplorerEventType eventType={eventType} onBack={onBack} />;
    }

    const onAction = async () => {
        setTool(_t("Send custom state event"), StateEventEditor);
    };

    return <BaseTool onBack={onBack} actionLabel={_t("Send custom state event")} onAction={onAction}>
        <FilteredList query={query} onChange={setQuery}>
            {
                Array.from(events.keys()).map((eventType) => {
                    const onClick = () => {
                        setEventType(eventType);
                    };

                    return <button
                        className="mx_DevTools_button"
                        key={eventType}
                        onClick={onClick}
                    >
                        { eventType }
                    </button>;
                })
            }
        </FilteredList>
    </BaseTool>;
};
