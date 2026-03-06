/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ChangeEvent, useContext, useEffect, useMemo, useState } from "react";
import { Pill } from "@element-hq/web-shared-components";
import { MatrixEvent, type IContent, RoomStickyEventsEvent } from "matrix-js-sdk/src/matrix";
import { Form, SettingsToggleInput } from "@vector-im/compound-web";
import { v4 as uuidv4 } from "uuid";
import { logger } from "nx/src/utils/logger";

import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool.tsx";
import { _t, _td, UserFriendlyError } from "../../../../languageHandler.tsx";
import {
    EventEditor,
    eventTypeField,
    EventViewer,
    type IEditorProps,
    stickyDurationField,
    stringify,
} from "./Event.tsx";
import Field from "../../elements/Field.tsx";
import MatrixClientContext from "../../../../contexts/MatrixClientContext.tsx";

/**
 * Devtool to explore sticky events in the current room.
 * It allows you to see all sticky events, filter them by type, and view their content.
 * @param onBack - handle back navigation in devtools
 * @param setTool - callback to switch to a different devtool (StickyEventEditor) when the user wants to send a new sticky event
 */
export const StickyStateExplorer: React.FC<IDevtoolsProps> = ({ onBack, setTool }) => {
    const context = useContext(DevtoolsContext);
    const [eventType, setEventType] = useState<string | null>(null);
    const [event, setEvent] = useState<MatrixEvent | null>(null);

    const [events, setEvents] = useState<MatrixEvent[]>(() => [...context.room._unstable_getStickyEvents()]);

    // Listen for updates to the sticky events and refresh the list when they change
    useEffect(() => {
        const refresh = (): void => setEvents([...context.room._unstable_getStickyEvents()]);
        context.room.on(RoomStickyEventsEvent.Update, refresh);

        return () => {
            context.room.off(RoomStickyEventsEvent.Update, refresh);
        };
    }, [context.room]);

    // If an event is selected, show the single event view, which allows viewing the content of the event
    // and sending a new one with the same sticky key.
    if (event) {
        return renderSingleEvent(setEvent, event);
    }

    // If an event type is selected, show the list of events of that type,
    // with a filter and the option to show/hide "empty" events (empty sticky event is a way to clear state).
    if (eventType) {
        return (
            <StickyEventListPerType
                eventType={eventType}
                setTool={setTool}
                events={events.filter((ev) => ev.getType() === eventType)}
                onBack={() => setEventType(null)}
                setEvent={setEvent}
            />
        );
    }

    // Get the list of different types.
    const uniqueEventTypes = Array.from(new Set(events.map((event) => event.getType())));

    if (uniqueEventTypes.length === 0) {
        return <p>{_t("devtools|no_sticky_events")}</p>;
    }

    const onAction = async (): Promise<void> => {
        setTool(_td("devtools|send_custom_sticky_event"), StickyEventEditor);
    };
    return (
        <BaseTool onBack={onBack} actionLabel={_td("devtools|send_custom_sticky_event")} onAction={onAction}>
            <p>
                {uniqueEventTypes.map((eventType) => (
                    <button key={eventType} className="mx_DevTools_button" onClick={() => setEventType(eventType)}>
                        {eventType}
                    </button>
                ))}
            </p>
        </BaseTool>
    );
};

interface StateEventButtonProps {
    userId: string;
    stickyKey?: string;
    expiresAt: number;
    onClick(this: void): void;
}

/**
 * A single row in the sticky event list, showing the userId, sticky key and time until expiration for a sticky event.
 * @param userId - the sender of the sticky event
 * @param stickyKey - the sticky key of the event
 * @param expiresAt - the timestamp when the sticky event will expire
 * @param onClick - callback to show the event details when the row is clicked
 */
const StickyEventTableLine: React.FC<StateEventButtonProps> = ({ userId, stickyKey, expiresAt, onClick }) => {
    const [timeRemaining, setTimeRemaining] = useState<string>("");
    const [isExpired, setIsExpired] = useState<boolean>(false);
    const [hover, setHover] = useState<boolean>(false);
    const [focused, setFocused] = useState<boolean>(false);
    // showFocus indicates the focus outline should be shown - we set it on keyboard interaction
    const [showFocus, setShowFocus] = useState<boolean>(false);

    useEffect(() => {
        const updateCountdown = (): void => {
            const now = Date.now();
            const remaining = expiresAt - now;

            if (remaining <= 0) {
                setIsExpired(true);
                setTimeRemaining("");
                return;
            }

            setIsExpired(false);

            // Calculate time remaining
            const totalSeconds = Math.floor(remaining / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            // Format the display
            if (days > 0) {
                setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
            } else if (hours > 0) {
                setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
            } else if (minutes > 0) {
                setTimeRemaining(`${minutes}m ${seconds}s`);
            } else {
                setTimeRemaining(`${seconds}s`);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    // Small reusable cell styles used to keep layout tidy in this devtool
    // Give more space to the userId column to avoid truncation in typical cases
    const userCellStyle: React.CSSProperties = {
        maxWidth: "36ch",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        padding: "8px 12px",
    };
    const keyCellStyle: React.CSSProperties = {
        maxWidth: "48ch",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        padding: "8px 12px",
    };
    const expiresCellStyle: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap", padding: "8px 12px" };

    const rowStyle: React.CSSProperties = {
        cursor: "pointer",
        background: hover ? "rgba(0,0,0,0.03)" : "transparent",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
    };
    const focusStyle: React.CSSProperties = { outline: "2px solid rgba(0,120,212,0.25)", outlineOffset: "2px" };

    return (
        <tr
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onMouseDown={() => setShowFocus(false)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
                setFocused(false);
                setShowFocus(false);
            }}
            onKeyDown={(e) => {
                // show focus when using keyboard keys (Tab/Enter/Space)
                if (e.key === "Tab" || e.key === "Enter" || e.key === " ") setShowFocus(true);
                // Activate on Enter or Space for keyboard users
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
            tabIndex={0}
            role="button"
            style={{ ...rowStyle, ...(focused && showFocus ? focusStyle : {}) }}
        >
            <td style={userCellStyle}>{userId}</td>
            <td style={keyCellStyle}>{stickyKey ?? <i>unkeyed</i>}</td>
            <td style={expiresCellStyle}>{isExpired ? _t("devtools|expired") : timeRemaining}</td>
        </tr>
    );
};

interface StickyEventListPerTypeProps {
    eventType: string;
    events: MatrixEvent[];
    onBack: () => void;
    setEvent: (event: MatrixEvent | null) => void;
    setTool: IDevtoolsProps["setTool"];
}

const StickyEventListPerType: React.FC<StickyEventListPerTypeProps> = ({
    eventType,
    events,
    onBack,
    setEvent,
    setTool,
}) => {
    const onAction = async (): Promise<void> => {
        setTool(_td("devtools|send_custom_sticky_event"), StickyEventEditor);
    };

    const [query, setQuery] = useState("");
    const [showEmptyState, setShowEmptyState] = useState(true);

    return (
        <BaseTool onBack={onBack} actionLabel={_td("devtools|send_custom_sticky_event")} onAction={onAction}>
            <p>
                <Pill label={eventType} />
            </p>

            <Field
                label={_t("common|filter_results")}
                autoFocus={true}
                size={64}
                type="text"
                autoComplete="off"
                value={query}
                onChange={(ev: ChangeEvent<HTMLInputElement>) => setQuery(ev.target.value)}
                className="mx_TextInputDialog_input mx_DevTools_RoomStateExplorer_query"
            />

            <Form.Root
                onSubmit={(evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                }}
            >
                <SettingsToggleInput
                    name="decrypted_toggle"
                    label={_t("devtools|show_empty_content_events")}
                    onChange={(e) => setShowEmptyState(e.target.checked)}
                    checked={showEmptyState}
                />
            </Form.Root>

            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: 8 }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: "left", padding: "8px 12px", width: "35%" }}>{_t("devtools|users")}</th>
                        <th style={{ textAlign: "left", padding: "8px 12px", width: "50%" }}>
                            {_t("devtools|sticky_key")}
                        </th>
                        <th style={{ textAlign: "right", padding: "8px 12px", width: "15%" }}>
                            {_t("devtools|expires_in")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {events
                        .filter((eventType) => {
                            if (showEmptyState) return true;

                            // An empty sticky event has a single content key "msc4354_sticky_key" and no other keys, as the sticky key is required but content can otherwise be empty
                            const contentKeys = Object.keys(eventType.getContent());
                            const isEmpty = contentKeys.length === 1 && contentKeys[0] === "msc4354_sticky_key";
                            return !isEmpty;
                        })
                        .filter((ev) => {
                            // No filtering, return all events
                            if (!query) return true;
                            // Filter by sender or sticky key
                            if (ev.getSender()!.includes(query)) {
                                logger.log(`Filtering by sender ${ev.getSender()} matched query ${query}`);
                                return true;
                            }
                            if (ev.getContent().msc4354_sticky_key?.includes(query)) {
                                logger.log(
                                    `Filtering by sticky key ${ev.getContent().msc4354_sticky_key} matched query ${query}`,
                                );
                                return true;
                            }

                            logger.log(`Filtering did not match query ${query}`);
                            return false;
                        })
                        .sort((a, b) => {
                            return (a.unstableStickyExpiresAt ?? 0) - (b.unstableStickyExpiresAt ?? 0);
                        })
                        .map((ev) => (
                            <StickyEventTableLine
                                key={ev.getId()}
                                userId={ev.getSender()!}
                                stickyKey={ev.getContent().msc4354_sticky_key}
                                expiresAt={ev.unstableStickyExpiresAt!}
                                onClick={() => setEvent(ev)}
                            />
                        ))}
                </tbody>
            </table>
        </BaseTool>
    );
};

function renderSingleEvent(setEvent: (value: MatrixEvent | null) => void, event: MatrixEvent): React.JSX.Element {
    const _onBack = (): void => {
        setEvent(null);
    };

    // If the event is encrypted, getEffectiveEvent will return the event
    // as it would appear if it was unencrypted.
    const effectiveEvent = event.getEffectiveEvent();
    const clear = new MatrixEvent(effectiveEvent);

    return <EventViewer mxEvent={clear} onBack={_onBack} Editor={StickyEventEditor} />;
}

export const StickyEventEditor: React.FC<IEditorProps> = ({ mxEvent, onBack }) => {
    const context = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(
        () => [eventTypeField(mxEvent?.getType()), stickyDurationField(3600000 /* 1 hour in ms */)],
        [mxEvent],
    );

    const onSend = async ([eventType, stickyDuration]: string[], content: IContent): Promise<void> => {
        // Parse and validate stickyDuration. It must be an integer number of milliseconds
        // between 0 and 3,600,000 (inclusive) — 1 hour max.
        const parsed = Number.parseInt(String(stickyDuration), 10);
        if (Number.isNaN(parsed)) {
            throw new UserFriendlyError("devtools|error_sticky_duration_must_be_a_number");
        }
        if (parsed < 0 || parsed > 3600000) {
            throw new UserFriendlyError("devtools|error_sticky_duration_out_of_range");
        }

        await cli._unstable_sendStickyEvent(context.room.roomId, parsed, null, eventType as any, content);
    };

    const defaultContent = mxEvent
        ? stringify(mxEvent.getContent())
        : stringify({
              msc4354_sticky_key: uuidv4(),
          });
    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};
