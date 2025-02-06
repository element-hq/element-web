/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, useMemo, useState } from "react";
import { type IContent, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { _t, _td } from "../../../../languageHandler";
import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { EventEditor, EventViewer, eventTypeField, stateKeyField, type IEditorProps, stringify } from "./Event";
import FilteredList from "./FilteredList";
import Spinner from "../../elements/Spinner";
import SyntaxHighlight from "../../elements/SyntaxHighlight";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";

export const StateEventEditor: React.FC<IEditorProps> = ({ mxEvent, onBack }) => {
    const context = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(
        () => [eventTypeField(mxEvent?.getType()), stateKeyField(mxEvent?.getStateKey())],
        [mxEvent],
    );

    const onSend = async ([eventType, stateKey]: string[], content: IContent): Promise<void> => {
        await cli.sendStateEvent(context.room.roomId, eventType as any, content, stateKey);
    };

    const defaultContent = mxEvent ? stringify(mxEvent.getContent()) : undefined;
    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};

interface StateEventButtonProps {
    label: string;
    onClick(): void;
}

const RoomStateHistory: React.FC<{
    mxEvent: MatrixEvent;
    onBack(): void;
}> = ({ mxEvent, onBack }) => {
    const cli = useContext(MatrixClientContext);
    const events = useAsyncMemo(
        async () => {
            const events = [mxEvent.event];
            while (!!events[0].unsigned?.replaces_state) {
                try {
                    events.unshift(await cli.fetchRoomEvent(mxEvent.getRoomId()!, events[0].unsigned.replaces_state));
                } catch (e) {
                    events.unshift({
                        event_id: events[0].unsigned.replaces_state,
                        unsigned: {
                            error: e instanceof Error ? e.message : String(e),
                        },
                    });
                }
            }
            return events;
        },
        [cli, mxEvent],
        null,
    );

    let body = <Spinner />;
    if (events !== null) {
        body = (
            <>
                {events.map((ev) => (
                    <SyntaxHighlight language="json" key={ev.event_id}>
                        {stringify(ev)}
                    </SyntaxHighlight>
                ))}
            </>
        );
    }

    return <BaseTool onBack={onBack}>{body}</BaseTool>;
};

const StateEventButton: React.FC<StateEventButtonProps> = ({ label, onClick }) => {
    const trimmed = label.trim();

    let content = label;
    if (!trimmed) {
        content = label.length > 0 ? _t("devtools|spaces", { count: label.length }) : _t("devtools|empty_string");
    }

    return (
        <button
            className={classNames("mx_DevTools_button", {
                mx_DevTools_RoomStateExplorer_button_hasSpaces: trimmed.length !== label.length,
                mx_DevTools_RoomStateExplorer_button_emptyString: !trimmed,
            })}
            onClick={onClick}
        >
            {content}
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
    const [history, setHistory] = useState(false);

    const events = context.room.currentState.events.get(eventType)!;

    useEffect(() => {
        if (events.size === 1 && events.has("")) {
            setEvent(events.get("")!);
        } else {
            setEvent(null);
        }
    }, [events]);

    if (event && history) {
        const _onBack = (): void => {
            setHistory(false);
        };
        return <RoomStateHistory mxEvent={event} onBack={_onBack} />;
    }
    if (event) {
        const _onBack = (): void => {
            if (events?.size === 1 && events.has("")) {
                onBack();
            } else {
                setEvent(null);
            }
        };
        const onHistoryClick = (): void => {
            setHistory(true);
        };
        const extraButton = <button onClick={onHistoryClick}>{_t("devtools|see_history")}</button>;
        return <EventViewer mxEvent={event} onBack={_onBack} Editor={StateEventEditor} extraButton={extraButton} />;
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
        setTool(_td("devtools|send_custom_state_event"), StateEventEditor);
    };

    return (
        <BaseTool onBack={onBack} actionLabel={_td("devtools|send_custom_state_event")} onAction={onAction}>
            <FilteredList query={query} onChange={setQuery}>
                {Array.from(events.keys()).map((eventType) => (
                    <StateEventButton key={eventType} label={eventType} onClick={() => setEventType(eventType)} />
                ))}
            </FilteredList>
        </BaseTool>
    );
};
