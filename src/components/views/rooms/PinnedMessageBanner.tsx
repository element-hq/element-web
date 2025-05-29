/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useEffect, useRef, useState } from "react";
import PinIcon from "@vector-im/compound-design-tokens/assets/web/icons/pin-solid";
import { Button } from "@vector-im/compound-web";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { usePinnedEvents, useSortedFetchedPinnedEvents } from "../../../hooks/usePinnedEvents";
import { _t } from "../../../languageHandler";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import dis from "../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import MessageEvent from "../messages/MessageEvent";
import PosthogTrackers from "../../../PosthogTrackers.ts";
import { EventPreview } from "./EventPreview.tsx";
import type ResizeNotifier from "../../../utils/ResizeNotifier";

/**
 * The props for the {@link PinnedMessageBanner} component.
 */
interface PinnedMessageBannerProps {
    /**
     * The permalink creator to use.
     */
    permalinkCreator: RoomPermalinkCreator;
    /**
     * The room where the banner is displayed
     */
    room: Room;
    /**
     * The resize notifier to notify the timeline to resize itself when the banner is displayed or hidden.
     */
    resizeNotifier: ResizeNotifier;
}

/**
 * A banner that displays the pinned messages in a room.
 */
export function PinnedMessageBanner({
    room,
    permalinkCreator,
    resizeNotifier,
}: PinnedMessageBannerProps): JSX.Element | null {
    const pinnedEventIds = usePinnedEvents(room);
    const pinnedEvents = useSortedFetchedPinnedEvents(room, pinnedEventIds);
    const eventCount = pinnedEvents.length;
    const isSinglePinnedEvent = eventCount === 1;

    const [currentEventIndex, setCurrentEventIndex] = useState(eventCount - 1);
    // When the number of pinned messages changes, we want to display the last message
    useEffect(() => {
        setCurrentEventIndex(() => eventCount - 1);
    }, [eventCount]);

    const pinnedEvent = pinnedEvents[currentEventIndex];
    useNotifyTimeline(pinnedEvent, resizeNotifier);

    if (!pinnedEvent) return null;

    const shouldUseMessageEvent = pinnedEvent.isRedacted() || pinnedEvent.isDecryptionFailure();

    const onBannerClick = (): void => {
        PosthogTrackers.trackInteraction("PinnedMessageBannerClick");

        // Scroll to the pinned message
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: pinnedEvent.getId(),
            highlighted: true,
            room_id: room.roomId,
            metricsTrigger: undefined, // room doesn't change
        });

        // Cycle through the pinned messages
        // When we reach the first message, we go back to the last message
        setCurrentEventIndex((currentEventIndex) => (--currentEventIndex === -1 ? eventCount - 1 : currentEventIndex));
    };

    return (
        <div
            className="mx_PinnedMessageBanner"
            data-single-message={isSinglePinnedEvent}
            aria-label={_t("room|pinned_message_banner|description")}
            data-testid="pinned-message-banner"
        >
            <button
                aria-label={_t("room|pinned_message_banner|go_to_message")}
                type="button"
                className="mx_PinnedMessageBanner_main"
                onClick={onBannerClick}
            >
                <div className="mx_PinnedMessageBanner_content">
                    <Indicators count={eventCount} currentIndex={currentEventIndex} />
                    <PinIcon width="20px" height="20px" className="mx_PinnedMessageBanner_PinIcon" />
                    {!isSinglePinnedEvent && (
                        <div className="mx_PinnedMessageBanner_title" data-testid="banner-counter">
                            {_t(
                                "room|pinned_message_banner|title",
                                {
                                    index: currentEventIndex + 1,
                                    length: eventCount,
                                },
                                { bold: (sub) => <span className="mx_PinnedMessageBanner_title_counter">{sub}</span> },
                            )}
                        </div>
                    )}
                    <EventPreview
                        mxEvent={pinnedEvent}
                        className="mx_PinnedMessageBanner_message"
                        data-testid="banner-message"
                    />
                    {/* In case of redacted event, we want to display the nice sentence of the message event like in the timeline or in the pinned message list */}
                    {shouldUseMessageEvent && (
                        <div className="mx_PinnedMessageBanner_redactedMessage">
                            <MessageEvent
                                mxEvent={pinnedEvent}
                                maxImageHeight={20}
                                permalinkCreator={permalinkCreator}
                                replacingEventId={pinnedEvent.replacingEventId()}
                            />
                        </div>
                    )}
                </div>
            </button>
            {!isSinglePinnedEvent && <BannerButton room={room} />}
        </div>
    );
}

/**
 * When the banner is displayed or hidden, we want to notify the timeline to resize itself.
 * @param pinnedEvent
 * @param resizeNotifier
 */
function useNotifyTimeline(pinnedEvent: MatrixEvent | null, resizeNotifier: ResizeNotifier): void {
    const previousEvent = useRef<MatrixEvent | null>(null);
    useEffect(() => {
        // If we switch from a pinned message to no pinned message or the opposite, we want to resize the timeline
        if ((previousEvent.current && !pinnedEvent) || (!previousEvent.current && pinnedEvent)) {
            resizeNotifier.notifyTimelineHeightChanged();
        }

        previousEvent.current = pinnedEvent;
    }, [pinnedEvent, resizeNotifier]);
}

const MAX_INDICATORS = 3;

/**
 * The props for the {@link IndicatorsProps} component.
 */
interface IndicatorsProps {
    /**
     * The number of messages pinned
     */
    count: number;
    /**
     * The current index of the pinned message
     */
    currentIndex: number;
}

/**
 * A component that displays vertical indicators for the pinned messages.
 */
function Indicators({ count, currentIndex }: IndicatorsProps): JSX.Element {
    // We only display a maximum of 3 indicators at one time.
    // When there is more than 3 messages pinned, we will cycle through the indicators

    // If there is only 2 messages pinned, we will display 2 indicators
    // In case of 1 message pinned, the indicators are not displayed, see {@link PinnedMessageBanner} logic.
    const numberOfIndicators = Math.min(count, MAX_INDICATORS);
    // The index of the active indicator
    const index = currentIndex % numberOfIndicators;

    // We hide the indicators when we are on the last cycle and there are less than 3 remaining messages pinned
    const numberOfCycles = Math.ceil(count / numberOfIndicators);
    // If the current index is greater than the last cycle index, we are on the last cycle
    const isLastCycle = currentIndex >= (numberOfCycles - 1) * MAX_INDICATORS;
    // The index of the last message in the last cycle
    const lastCycleIndex = numberOfIndicators - (numberOfCycles * numberOfIndicators - count);

    return (
        <div className="mx_PinnedMessageBanner_Indicators">
            {Array.from({ length: numberOfIndicators }).map((_, i) => (
                <Indicator key={i} active={i === index} hidden={isLastCycle && lastCycleIndex <= i} />
            ))}
        </div>
    );
}

/**
 * The props for the {@link Indicator} component.
 */
interface IndicatorProps {
    /**
     * Whether the indicator is active
     */
    active: boolean;
    /**
     * Whether the indicator is hidden
     */
    hidden: boolean;
}

/**
 * A component that displays a vertical indicator for a pinned message.
 */
function Indicator({ active, hidden }: IndicatorProps): JSX.Element {
    return (
        <div
            data-testid="banner-indicator"
            className={classNames("mx_PinnedMessageBanner_Indicator", {
                "mx_PinnedMessageBanner_Indicator--active": active,
                "mx_PinnedMessageBanner_Indicator--hidden": hidden,
            })}
        />
    );
}

function getRightPanelPhase(roomId: string): RightPanelPhases | null {
    if (!RightPanelStore.instance.isOpenForRoom(roomId)) return null;
    return RightPanelStore.instance.currentCard.phase;
}

/**
 * The props for the {@link BannerButton} component.
 */
interface BannerButtonProps {
    /**
     * The room where the banner is displayed
     */
    room: Room;
}

/**
 * A button that allows the user to view or close the list of pinned messages.
 */
function BannerButton({ room }: BannerButtonProps): JSX.Element {
    const [currentPhase, setCurrentPhase] = useState<RightPanelPhases | null>(getRightPanelPhase(room.roomId));
    useEventEmitter(RightPanelStore.instance, UPDATE_EVENT, () => setCurrentPhase(getRightPanelPhase(room.roomId)));
    const isPinnedMessagesPhase = currentPhase === RightPanelPhases.PinnedMessages;

    return (
        <Button
            className="mx_PinnedMessageBanner_actions"
            kind="tertiary"
            onClick={() => {
                if (isPinnedMessagesPhase) PosthogTrackers.trackInteraction("PinnedMessageBannerCloseListButton");
                else PosthogTrackers.trackInteraction("PinnedMessageBannerViewAllButton");

                RightPanelStore.instance.showOrHidePhase(RightPanelPhases.PinnedMessages);
            }}
        >
            {isPinnedMessagesPhase
                ? _t("room|pinned_message_banner|button_close_list")
                : _t("room|pinned_message_banner|button_view_all")}
        </Button>
    );
}
