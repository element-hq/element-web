/*
Copyright 2016 - 2023 The Matrix.org Foundation C.I.C.

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

import React, { createRef, ReactNode } from "react";
import ReactDOM from "react-dom";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/models/event";
import { EventTimelineSet, IRoomTimelineData } from "matrix-js-sdk/src/models/event-timeline-set";
import { Direction, EventTimeline } from "matrix-js-sdk/src/models/event-timeline";
import { TimelineWindow } from "matrix-js-sdk/src/timeline-window";
import { EventType, RelationType } from "matrix-js-sdk/src/@types/event";
import { SyncState } from "matrix-js-sdk/src/sync";
import { RoomMember, RoomMemberEvent } from "matrix-js-sdk/src/models/room-member";
import { debounce, findLastIndex, throttle } from "lodash";
import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/client";
import { Thread, ThreadEvent } from "matrix-js-sdk/src/models/thread";
import { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";
import { MatrixError } from "matrix-js-sdk/src/http-api";
import { Relations } from "matrix-js-sdk/src/models/relations";

import SettingsStore from "../../settings/SettingsStore";
import { Layout } from "../../settings/enums/Layout";
import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import UserActivity from "../../UserActivity";
import Modal from "../../Modal";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import Timer from "../../utils/Timer";
import shouldHideEvent from "../../shouldHideEvent";
import { arrayFastClone } from "../../utils/arrays";
import MessagePanel from "./MessagePanel";
import { IScrollState } from "./ScrollPanel";
import { ActionPayload } from "../../dispatcher/payloads";
import ResizeNotifier from "../../utils/ResizeNotifier";
import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import Spinner from "../views/elements/Spinner";
import EditorStateTransfer from "../../utils/EditorStateTransfer";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import LegacyCallEventGrouper, { buildLegacyCallEventGroupers } from "./LegacyCallEventGrouper";
import { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { getKeyBindingsManager } from "../../KeyBindingsManager";
import { KeyBindingAction } from "../../accessibility/KeyboardShortcuts";
import { haveRendererForEvent } from "../../events/EventTileFactory";

const PAGINATE_SIZE = 20;
const INITIAL_SIZE = 20;
const READ_RECEIPT_INTERVAL_MS = 500;

const READ_MARKER_DEBOUNCE_MS = 100;

// How far off-screen a decryption failure can be for it to still count as "visible"
const VISIBLE_DECRYPTION_FAILURE_MARGIN = 100;

const debuglog = (...args: any[]): void => {
    if (SettingsStore.getValue("debug_timeline_panel")) {
        logger.log.call(console, "TimelinePanel debuglog:", ...args);
    }
};

const overlaysBefore = (overlayEvent: MatrixEvent, mainEvent: MatrixEvent): boolean =>
    overlayEvent.localTimestamp < mainEvent.localTimestamp;

const overlaysAfter = (overlayEvent: MatrixEvent, mainEvent: MatrixEvent): boolean =>
    overlayEvent.localTimestamp >= mainEvent.localTimestamp;

interface IProps {
    // The js-sdk EventTimelineSet object for the timeline sequence we are
    // representing.  This may or may not have a room, depending on what it's
    // a timeline representing.  If it has a room, we maintain RRs etc for
    // that room.
    timelineSet: EventTimelineSet;
    // overlay events from a second timelineset on the main timeline
    // added to support virtual rooms
    // events from the overlay timeline set will be added by localTimestamp
    // into the main timeline
    overlayTimelineSet?: EventTimelineSet;
    // filter events from overlay timeline
    overlayTimelineSetFilter?: (event: MatrixEvent) => boolean;
    showReadReceipts?: boolean;
    // Enable managing RRs and RMs. These require the timelineSet to have a room.
    manageReadReceipts?: boolean;
    sendReadReceiptOnLoad?: boolean;
    manageReadMarkers?: boolean;

    // true to give the component a 'display: none' style.
    hidden?: boolean;

    // ID of an event to highlight. If undefined, no event will be highlighted.
    // typically this will be either 'eventId' or undefined.
    highlightedEventId?: string;

    // id of an event to jump to. If not given, will go to the end of the live timeline.
    eventId?: string;

    // whether we should scroll the event into view
    eventScrollIntoView?: boolean;

    // where to position the event given by eventId, in pixels from the bottom of the viewport.
    // If not given, will try to put the event half way down the viewport.
    eventPixelOffset?: number;

    // Should we show URL Previews
    showUrlPreview?: boolean;

    // maximum number of events to show in a timeline
    timelineCap?: number;

    // classname to use for the messagepanel
    className?: string;

    // placeholder to use if the timeline is empty
    empty?: ReactNode;

    // whether to show reactions for an event
    showReactions?: boolean;

    // which layout to use
    layout?: Layout;

    // whether to always show timestamps for an event
    alwaysShowTimestamps?: boolean;

    resizeNotifier?: ResizeNotifier;
    editState?: EditorStateTransfer;
    permalinkCreator?: RoomPermalinkCreator;
    membersLoaded?: boolean;

    // callback which is called when the panel is scrolled.
    onScroll?(event: Event): void;

    onEventScrolledIntoView?(eventId?: string): void;

    // callback which is called when the read-up-to mark is updated.
    onReadMarkerUpdated?(): void;

    // callback which is called when we wish to paginate the timeline window.
    onPaginationRequest?(timelineWindow: TimelineWindow, direction: string, size: number): Promise<boolean>;

    hideThreadedMessages?: boolean;
    disableGrouping?: boolean;
}

interface IState {
    // All events, including still-pending events being sent by us
    events: MatrixEvent[];
    // Only events that are actually in the live timeline
    liveEvents: MatrixEvent[];
    // track whether our room timeline is loading
    timelineLoading: boolean;

    // the index of the first event that is to be shown
    firstVisibleEventIndex: number;

    // canBackPaginate == false may mean:
    //
    // * we haven't (successfully) loaded the timeline yet, or:
    //
    // * we have got to the point where the room was created, or:
    //
    // * the server indicated that there were no more visible events
    //  (normally implying we got to the start of the room), or:
    //
    // * we gave up asking the server for more events
    canBackPaginate: boolean;

    // canForwardPaginate == false may mean:
    //
    // * we haven't (successfully) loaded the timeline yet
    //
    // * we have got to the end of time and are now tracking the live
    //   timeline, or:
    //
    // * the server indicated that there were no more visible events
    //   (not sure if this ever happens when we're not at the live
    //   timeline), or:
    //
    // * we are looking at some historical point, but gave up asking
    //   the server for more events
    canForwardPaginate: boolean;

    // start with the read-marker visible, so that we see its animated
    // disappearance when switching into the room.
    readMarkerVisible: boolean;

    readMarkerEventId: string | null;

    backPaginating: boolean;
    forwardPaginating: boolean;

    // cache of matrixClient.getSyncState() (but from the 'sync' event)
    clientSyncState: SyncState | null;

    // should the event tiles have twelve hour times
    isTwelveHour: boolean;

    // always show timestamps on event tiles?
    alwaysShowTimestamps: boolean;

    // how long to show the RM for when it's visible in the window
    readMarkerInViewThresholdMs: number;

    // how long to show the RM for when it's scrolled off-screen
    readMarkerOutOfViewThresholdMs: number;

    editState?: EditorStateTransfer;
}

interface IEventIndexOpts {
    ignoreOwn?: boolean;
    allowPartial?: boolean;
}

/*
 * Component which shows the event timeline in a room view.
 *
 * Also responsible for handling and sending read receipts.
 */
class TimelinePanel extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    // a map from room id to read marker event timestamp
    public static roomReadMarkerTsMap: Record<string, number> = {};

    public static defaultProps = {
        // By default, disable the timelineCap in favour of unpaginating based on
        // event tile heights. (See _unpaginateEvents)
        timelineCap: Number.MAX_VALUE,
        className: "mx_RoomView_messagePanel",
        sendReadReceiptOnLoad: true,
        hideThreadedMessages: true,
        disableGrouping: false,
    };

    private lastRRSentEventId: string | null | undefined = undefined;
    private lastRMSentEventId: string | null | undefined = undefined;

    private readonly messagePanel = createRef<MessagePanel>();
    private readonly dispatcherRef: string;
    private timelineWindow?: TimelineWindow;
    private overlayTimelineWindow?: TimelineWindow;
    private unmounted = false;
    private readReceiptActivityTimer: Timer | null = null;
    private readMarkerActivityTimer: Timer | null = null;

    // A map of <callId, LegacyCallEventGrouper>
    private callEventGroupers = new Map<string, LegacyCallEventGrouper>();
    private initialReadMarkerId: string | null = null;

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);
        this.context = context;

        debuglog("mounting");

        // XXX: we could track RM per TimelineSet rather than per Room.
        // but for now we just do it per room for simplicity.
        if (this.props.manageReadMarkers) {
            const readmarker = this.props.timelineSet.room?.getAccountData("m.fully_read");
            if (readmarker) {
                this.initialReadMarkerId = readmarker.getContent().event_id;
            } else {
                this.initialReadMarkerId = this.getCurrentReadReceipt();
            }
        }

        this.state = {
            events: [],
            liveEvents: [],
            timelineLoading: true,
            firstVisibleEventIndex: 0,
            canBackPaginate: false,
            canForwardPaginate: false,
            readMarkerVisible: true,
            readMarkerEventId: this.initialReadMarkerId,
            backPaginating: false,
            forwardPaginating: false,
            clientSyncState: MatrixClientPeg.get().getSyncState(),
            isTwelveHour: SettingsStore.getValue("showTwelveHourTimestamps"),
            alwaysShowTimestamps: SettingsStore.getValue("alwaysShowTimestamps"),
            readMarkerInViewThresholdMs: SettingsStore.getValue("readMarkerInViewThresholdMs"),
            readMarkerOutOfViewThresholdMs: SettingsStore.getValue("readMarkerOutOfViewThresholdMs"),
        };

        this.dispatcherRef = dis.register(this.onAction);
        const cli = MatrixClientPeg.get();
        cli.on(RoomEvent.Timeline, this.onRoomTimeline);
        cli.on(RoomEvent.TimelineReset, this.onRoomTimelineReset);
        cli.on(RoomEvent.Redaction, this.onRoomRedaction);
        if (SettingsStore.getValue("feature_msc3531_hide_messages_pending_moderation")) {
            // Make sure that events are re-rendered when their visibility-pending-moderation changes.
            cli.on(MatrixEventEvent.VisibilityChange, this.onEventVisibilityChange);
            cli.on(RoomMemberEvent.PowerLevel, this.onVisibilityPowerLevelChange);
        }
        // same event handler as Room.redaction as for both we just do forceUpdate
        cli.on(RoomEvent.RedactionCancelled, this.onRoomRedaction);
        cli.on(RoomEvent.Receipt, this.onRoomReceipt);
        cli.on(RoomEvent.LocalEchoUpdated, this.onLocalEchoUpdated);
        cli.on(RoomEvent.AccountData, this.onAccountData);
        cli.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        cli.on(MatrixEventEvent.Replaced, this.onEventReplaced);
        cli.on(ClientEvent.Sync, this.onSync);

        this.props.timelineSet.room?.on(ThreadEvent.Update, this.onThreadUpdate);
    }

    public componentDidMount(): void {
        if (this.props.manageReadReceipts) {
            this.updateReadReceiptOnUserActivity();
        }
        if (this.props.manageReadMarkers) {
            this.updateReadMarkerOnUserActivity();
        }
        this.initTimeline(this.props);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (prevProps.timelineSet !== this.props.timelineSet) {
            // throw new Error("changing timelineSet on a TimelinePanel is not supported");

            // regrettably, this does happen; in particular, when joining a
            // room with /join. In that case, there are two Rooms in
            // circulation - one which is created by the MatrixClient.joinRoom
            // call and used to create the RoomView, and a second which is
            // created by the sync loop once the room comes back down the /sync
            // pipe. Once the latter happens, our room is replaced with the new one.
            //
            // for now, just warn about this. But we're going to end up paginating
            // both rooms separately, and it's all bad.
            logger.warn("Replacing timelineSet on a TimelinePanel - confusion may ensue");
        }

        this.props.timelineSet.room?.off(ThreadEvent.Update, this.onThreadUpdate);
        this.props.timelineSet.room?.on(ThreadEvent.Update, this.onThreadUpdate);

        const differentEventId = prevProps.eventId != this.props.eventId;
        const differentHighlightedEventId = prevProps.highlightedEventId != this.props.highlightedEventId;
        const differentAvoidJump = prevProps.eventScrollIntoView && !this.props.eventScrollIntoView;
        const differentOverlayTimeline = prevProps.overlayTimelineSet !== this.props.overlayTimelineSet;
        if (differentEventId || differentHighlightedEventId || differentAvoidJump) {
            logger.log(
                `TimelinePanel switching to eventId ${this.props.eventId} (was ${prevProps.eventId}), ` +
                    `scrollIntoView: ${this.props.eventScrollIntoView} (was ${prevProps.eventScrollIntoView})`,
            );
            this.initTimeline(this.props);
        } else if (differentOverlayTimeline) {
            logger.log(`TimelinePanel updating overlay timeline.`);
            this.initTimeline(this.props);
        }
    }

    public componentWillUnmount(): void {
        // set a boolean to say we've been unmounted, which any pending
        // promises can use to throw away their results.
        //
        // (We could use isMounted, but facebook have deprecated that.)
        this.unmounted = true;
        if (this.readReceiptActivityTimer) {
            this.readReceiptActivityTimer.abort();
            this.readReceiptActivityTimer = null;
        }
        if (this.readMarkerActivityTimer) {
            this.readMarkerActivityTimer.abort();
            this.readMarkerActivityTimer = null;
        }

        dis.unregister(this.dispatcherRef);

        const client = MatrixClientPeg.get();
        if (client) {
            client.removeListener(RoomEvent.Timeline, this.onRoomTimeline);
            client.removeListener(RoomEvent.TimelineReset, this.onRoomTimelineReset);
            client.removeListener(RoomEvent.Redaction, this.onRoomRedaction);
            client.removeListener(RoomEvent.RedactionCancelled, this.onRoomRedaction);
            client.removeListener(RoomEvent.Receipt, this.onRoomReceipt);
            client.removeListener(RoomEvent.LocalEchoUpdated, this.onLocalEchoUpdated);
            client.removeListener(RoomEvent.AccountData, this.onAccountData);
            client.removeListener(RoomMemberEvent.PowerLevel, this.onVisibilityPowerLevelChange);
            client.removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
            client.removeListener(MatrixEventEvent.Replaced, this.onEventReplaced);
            client.removeListener(MatrixEventEvent.VisibilityChange, this.onEventVisibilityChange);
            client.removeListener(ClientEvent.Sync, this.onSync);
            this.props.timelineSet.room?.removeListener(ThreadEvent.Update, this.onThreadUpdate);
        }
    }

    /**
     * Logs out debug info to describe the state of the TimelinePanel and the
     * events in the room according to the matrix-js-sdk. This is useful when
     * debugging problems like messages out of order, or messages that should
     * not be showing up in a thread, etc.
     *
     * It's too expensive and cumbersome to do all of these calculations for
     * every message change so instead we only log it out when asked.
     */
    private onDumpDebugLogs = (): void => {
        const room = this.props.timelineSet?.room;
        // Get a list of the event IDs used in this TimelinePanel.
        // This includes state and hidden events which we don't render
        const eventIdList = this.state?.events?.map((ev) => ev.getId());

        // Get the list of actually rendered events seen in the DOM.
        // This is useful to know for sure what's being shown on screen.
        // And we can suss out any corrupted React `key` problems.
        let renderedEventIds: string[] | undefined;
        try {
            const messagePanel = this.messagePanel.current;
            if (messagePanel) {
                const messagePanelNode = ReactDOM.findDOMNode(messagePanel) as Element;
                if (messagePanelNode) {
                    const actuallyRenderedEvents = messagePanelNode.querySelectorAll("[data-event-id]");
                    renderedEventIds = [...actuallyRenderedEvents].map((renderedEvent) => {
                        return renderedEvent.getAttribute("data-event-id")!;
                    });
                }
            }
        } catch (err) {
            logger.error(`onDumpDebugLogs: Failed to get the actual event ID's in the DOM`, err);
        }

        // Get the list of events and threads for the room as seen by the
        // matrix-js-sdk.
        let serializedEventIdsFromTimelineSets: { [key: string]: string[] }[] | undefined;
        let serializedEventIdsFromThreadsTimelineSets: { [key: string]: string[] }[] | undefined;
        const serializedThreadsMap: { [key: string]: any } = {};
        if (room) {
            const timelineSets = room.getTimelineSets();
            const threadsTimelineSets = room.threadsTimelineSets;

            try {
                // Serialize all of the timelineSets and timelines in each set to their event IDs
                serializedEventIdsFromTimelineSets = serializeEventIdsFromTimelineSets(timelineSets);
                serializedEventIdsFromThreadsTimelineSets = serializeEventIdsFromTimelineSets(threadsTimelineSets);
            } catch (err) {
                logger.error(`onDumpDebugLogs: Failed to serialize event IDs from timelinesets`, err);
            }

            try {
                // Serialize all threads in the room from theadId -> event IDs in the thread
                room.getThreads().forEach((thread) => {
                    serializedThreadsMap[thread.id] = {
                        events: thread.events.map((ev) => ev.getId()),
                        numTimelines: thread.timelineSet.getTimelines().length,
                        liveTimeline: thread.timelineSet.getLiveTimeline().getEvents().length,
                        prevTimeline: thread.timelineSet
                            .getLiveTimeline()
                            .getNeighbouringTimeline(Direction.Backward)
                            ?.getEvents().length,
                        nextTimeline: thread.timelineSet
                            .getLiveTimeline()
                            .getNeighbouringTimeline(Direction.Forward)
                            ?.getEvents().length,
                    };
                });
            } catch (err) {
                logger.error(`onDumpDebugLogs: Failed to serialize event IDs from the threads`, err);
            }
        }

        let timelineWindowEventIds: string[] | undefined;
        try {
            timelineWindowEventIds = this.timelineWindow?.getEvents().map((ev) => ev.getId()!);
        } catch (err) {
            logger.error(`onDumpDebugLogs: Failed to get event IDs from the timelineWindow`, err);
        }
        let pendingEventIds: string[] | undefined;
        try {
            pendingEventIds = this.props.timelineSet.getPendingEvents().map((ev) => ev.getId()!);
        } catch (err) {
            logger.error(`onDumpDebugLogs: Failed to get pending event IDs`, err);
        }

        logger.debug(
            `TimelinePanel(${this.context.timelineRenderingType}): Debugging info for ${room?.roomId}\n` +
                `\tevents(${eventIdList.length})=${JSON.stringify(eventIdList)}\n` +
                `\trenderedEventIds(${renderedEventIds?.length ?? 0})=` +
                `${JSON.stringify(renderedEventIds)}\n` +
                `\tserializedEventIdsFromTimelineSets=${JSON.stringify(serializedEventIdsFromTimelineSets)}\n` +
                `\tserializedEventIdsFromThreadsTimelineSets=` +
                `${JSON.stringify(serializedEventIdsFromThreadsTimelineSets)}\n` +
                `\tserializedThreadsMap=${JSON.stringify(serializedThreadsMap)}\n` +
                `\ttimelineWindowEventIds(${timelineWindowEventIds?.length})=${JSON.stringify(
                    timelineWindowEventIds,
                )}\n` +
                `\tpendingEventIds(${pendingEventIds?.length})=${JSON.stringify(pendingEventIds)}`,
        );
    };

    private onMessageListUnfillRequest = (backwards: boolean, scrollToken: string): void => {
        // If backwards, unpaginate from the back (i.e. the start of the timeline)
        const dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;
        debuglog("unpaginating events in direction", dir);

        // All tiles are inserted by MessagePanel to have a scrollToken === eventId, and
        // this particular event should be the first or last to be unpaginated.
        const eventId = scrollToken;

        // The event in question could belong to either the main timeline or
        // overlay timeline; let's check both
        const mainEvents = this.timelineWindow!.getEvents();
        const overlayEvents = this.overlayTimelineWindow?.getEvents() ?? [];

        let marker = mainEvents.findIndex((ev) => ev.getId() === eventId);
        let overlayMarker: number;
        if (marker === -1) {
            // The event must be from the overlay timeline instead
            overlayMarker = overlayEvents.findIndex((ev) => ev.getId() === eventId);
            marker = backwards
                ? findLastIndex(mainEvents, (ev) => overlaysAfter(overlayEvents[overlayMarker], ev))
                : mainEvents.findIndex((ev) => overlaysBefore(overlayEvents[overlayMarker], ev));
        } else {
            overlayMarker = backwards
                ? findLastIndex(overlayEvents, (ev) => overlaysBefore(ev, mainEvents[marker]))
                : overlayEvents.findIndex((ev) => overlaysAfter(ev, mainEvents[marker]));
        }

        // The number of events to unpaginate from the main timeline
        let count: number;
        if (marker === -1) {
            count = 0;
        } else {
            count = backwards ? marker + 1 : mainEvents.length - marker;
        }

        // The number of events to unpaginate from the overlay timeline
        let overlayCount: number;
        if (overlayMarker === -1) {
            overlayCount = 0;
        } else {
            overlayCount = backwards ? overlayMarker + 1 : overlayEvents.length - overlayMarker;
        }

        if (count > 0) {
            debuglog("Unpaginating", count, "in direction", dir);
            this.timelineWindow!.unpaginate(count, backwards);
        }

        if (overlayCount > 0) {
            debuglog("Unpaginating", count, "from overlay timeline in direction", dir);
            this.overlayTimelineWindow!.unpaginate(overlayCount, backwards);
        }

        const { events, liveEvents, firstVisibleEventIndex } = this.getEvents();
        this.buildLegacyCallEventGroupers(events);
        this.setState({
            events,
            liveEvents,
            firstVisibleEventIndex,
        });

        // We can now paginate in the unpaginated direction
        if (backwards) {
            this.setState({ canBackPaginate: true });
        } else {
            this.setState({ canForwardPaginate: true });
        }
    };

    private onPaginationRequest = (
        timelineWindow: TimelineWindow,
        direction: Direction,
        size: number,
    ): Promise<boolean> => {
        if (this.props.onPaginationRequest) {
            return this.props.onPaginationRequest(timelineWindow, direction, size);
        } else {
            return timelineWindow.paginate(direction, size);
        }
    };

    // set off a pagination request.
    private onMessageListFillRequest = (backwards: boolean): Promise<boolean> => {
        if (!this.shouldPaginate()) return Promise.resolve(false);

        const dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;
        const canPaginateKey = backwards ? "canBackPaginate" : "canForwardPaginate";
        const paginatingKey = backwards ? "backPaginating" : "forwardPaginating";

        if (!this.state[canPaginateKey]) {
            debuglog("have given up", dir, "paginating this timeline");
            return Promise.resolve(false);
        }

        if (!this.timelineWindow?.canPaginate(dir)) {
            debuglog("can't", dir, "paginate any further");
            this.setState<null>({ [canPaginateKey]: false });
            return Promise.resolve(false);
        }

        if (backwards && this.state.firstVisibleEventIndex !== 0) {
            debuglog("won't", dir, "paginate past first visible event");
            return Promise.resolve(false);
        }

        debuglog("Initiating paginate; backwards:" + backwards);
        this.setState<null>({ [paginatingKey]: true });

        return this.onPaginationRequest(this.timelineWindow, dir, PAGINATE_SIZE).then(async (r) => {
            if (this.unmounted) {
                return false;
            }

            if (this.overlayTimelineWindow) {
                await this.extendOverlayWindowToCoverMainWindow();
            }

            debuglog("paginate complete backwards:" + backwards + "; success:" + r);

            const { events, liveEvents, firstVisibleEventIndex } = this.getEvents();
            this.buildLegacyCallEventGroupers(events);
            const newState: Partial<IState> = {
                [paginatingKey]: false,
                [canPaginateKey]: r,
                events,
                liveEvents,
                firstVisibleEventIndex,
            };

            // moving the window in this direction may mean that we can now
            // paginate in the other where we previously could not.
            const otherDirection = backwards ? EventTimeline.FORWARDS : EventTimeline.BACKWARDS;
            const canPaginateOtherWayKey = backwards ? "canForwardPaginate" : "canBackPaginate";
            if (!this.state[canPaginateOtherWayKey] && this.timelineWindow?.canPaginate(otherDirection)) {
                debuglog("can now", otherDirection, "paginate again");
                newState[canPaginateOtherWayKey] = true;
            }

            // Don't resolve until the setState has completed: we need to let
            // the component update before we consider the pagination completed,
            // otherwise we'll end up paginating in all the history the js-sdk
            // has in memory because we never gave the component a chance to scroll
            // itself into the right place
            return new Promise((resolve) => {
                this.setState<null>(newState, () => {
                    // we can continue paginating in the given direction if:
                    // - timelineWindow.paginate says we can
                    // - we're paginating forwards, or we won't be trying to
                    //   paginate backwards past the first visible event
                    resolve(r && (!backwards || firstVisibleEventIndex === 0));
                });
            });
        });
    };

    private onMessageListScroll = (e: Event): void => {
        this.props.onScroll?.(e);
        if (this.props.manageReadMarkers) {
            this.doManageReadMarkers();
        }
    };

    /*
     * Debounced function to manage read markers because we don't need to
     * do this on every tiny scroll update. It also sets state which causes
     * a component update, which can in turn reset the scroll position, so
     * it's important we allow the browser to scroll a bit before running this
     * (hence trailing edge only and debounce rather than throttle because
     * we really only need to update this once the user has finished scrolling,
     * not periodically while they scroll).
     */
    private doManageReadMarkers = debounce(
        () => {
            const rmPosition = this.getReadMarkerPosition();
            if (rmPosition === null) return;
            // we hide the read marker when it first comes onto the screen, but if
            // it goes back off the top of the screen (presumably because the user
            // clicks on the 'jump to bottom' button), we need to re-enable it.
            if (rmPosition < 0) {
                this.setState({ readMarkerVisible: true });
            }

            // if read marker position goes between 0 and -1/1,
            // (and user is active), switch timeout
            const timeout = this.readMarkerTimeout(rmPosition);
            // NO-OP when timeout already has set to the given value
            this.readMarkerActivityTimer?.changeTimeout(timeout);
        },
        READ_MARKER_DEBOUNCE_MS,
        { leading: false, trailing: true },
    );

    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case "ignore_state_changed":
                this.forceUpdate();
                break;
            case Action.DumpDebugLogs:
                this.onDumpDebugLogs();
                break;
        }
    };

    private onRoomTimeline = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        // ignore events for other timeline sets
        if (
            data.timeline.getTimelineSet() !== this.props.timelineSet &&
            data.timeline.getTimelineSet() !== this.props.overlayTimelineSet
        ) {
            return;
        }

        if (!Thread.hasServerSideSupport && this.context.timelineRenderingType === TimelineRenderingType.Thread) {
            if (toStartOfTimeline && !this.state.canBackPaginate) {
                this.setState({
                    canBackPaginate: true,
                });
            }
            if (!toStartOfTimeline && !this.state.canForwardPaginate) {
                this.setState({
                    canForwardPaginate: true,
                });
            }
        }

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        if (!this.messagePanel.current?.getScrollState()) return;

        if (!this.messagePanel.current.getScrollState()?.stuckAtBottom) {
            // we won't load this event now, because we don't want to push any
            // events off the other end of the timeline. But we need to note
            // that we can now paginate.
            this.setState({ canForwardPaginate: true });
            return;
        }

        // tell the timeline window to try to advance itself, but not to make
        // a http request to do so.
        //
        // we deliberately avoid going via the ScrollPanel for this call - the
        // ScrollPanel might already have an active pagination promise, which
        // will fail, but would stop us passing the pagination request to the
        // timeline window.
        //
        // see https://github.com/vector-im/vector-web/issues/1035
        this.timelineWindow!.paginate(EventTimeline.FORWARDS, 1, false)
            .then(() => {
                if (this.overlayTimelineWindow) {
                    return this.overlayTimelineWindow.paginate(EventTimeline.FORWARDS, 1, false);
                }
            })
            .then(() => {
                if (this.unmounted) {
                    return;
                }

                const { events, liveEvents, firstVisibleEventIndex } = this.getEvents();
                this.buildLegacyCallEventGroupers(events);
                const lastLiveEvent = liveEvents[liveEvents.length - 1];

                const updatedState: Partial<IState> = {
                    events,
                    liveEvents,
                    firstVisibleEventIndex,
                };

                let callRMUpdated = false;
                if (this.props.manageReadMarkers) {
                    // when a new event arrives when the user is not watching the
                    // window, but the window is in its auto-scroll mode, make sure the
                    // read marker is visible.
                    //
                    // We ignore events we have sent ourselves; we don't want to see the
                    // read-marker when a remote echo of an event we have just sent takes
                    // more than the timeout on userActiveRecently.
                    //
                    const myUserId = MatrixClientPeg.get().credentials.userId;
                    callRMUpdated = false;
                    if (ev.getSender() !== myUserId && !UserActivity.sharedInstance().userActiveRecently()) {
                        updatedState.readMarkerVisible = true;
                    } else if (lastLiveEvent && this.getReadMarkerPosition() === 0) {
                        // we know we're stuckAtBottom, so we can advance the RM
                        // immediately, to save a later render cycle

                        this.setReadMarker(lastLiveEvent.getId() ?? null, lastLiveEvent.getTs(), true);
                        updatedState.readMarkerVisible = false;
                        updatedState.readMarkerEventId = lastLiveEvent.getId();
                        callRMUpdated = true;
                    }
                }

                this.setState(updatedState as IState, () => {
                    this.messagePanel.current?.updateTimelineMinHeight();
                    if (callRMUpdated) {
                        this.props.onReadMarkerUpdated?.();
                    }
                });
            });
    };

    private hasTimelineSetFor(roomId: string | undefined): boolean {
        return (
            (roomId !== undefined && roomId === this.props.timelineSet.room?.roomId) ||
            roomId === this.props.overlayTimelineSet?.room?.roomId
        );
    }

    private onRoomTimelineReset = (room: Room | undefined, timelineSet: EventTimelineSet): void => {
        if (timelineSet !== this.props.timelineSet && timelineSet !== this.props.overlayTimelineSet) return;

        if (this.canResetTimeline()) {
            this.loadTimeline();
        }
    };

    public canResetTimeline = (): boolean => this.messagePanel?.current?.isAtBottom() === true;

    private onRoomRedaction = (ev: MatrixEvent, room: Room): void => {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (!this.hasTimelineSetFor(room.roomId)) return;

        // we could skip an update if the event isn't in our timeline,
        // but that's probably an early optimisation.
        this.forceUpdate();
    };

    private onThreadUpdate = (thread: Thread): void => {
        if (this.unmounted) {
            return;
        }

        // ignore events for other rooms
        if (!this.hasTimelineSetFor(thread.roomId)) return;

        // we could skip an update if the event isn't in our timeline,
        // but that's probably an early optimisation.
        const tile = this.messagePanel.current?.getTileForEventId(thread.id);
        if (tile) {
            tile.forceUpdate();
        }
    };

    // Called whenever the visibility of an event changes, as per
    // MSC3531. We typically need to re-render the tile.
    private onEventVisibilityChange = (ev: MatrixEvent): void => {
        if (this.unmounted) {
            return;
        }

        // ignore events for other rooms
        if (!this.hasTimelineSetFor(ev.getRoomId())) return;

        // we could skip an update if the event isn't in our timeline,
        // but that's probably an early optimisation.
        const tile = this.messagePanel.current?.getTileForEventId(ev.getId());
        if (tile) {
            tile.forceUpdate();
        }
    };

    private onVisibilityPowerLevelChange = (ev: MatrixEvent, member: RoomMember): void => {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (!this.hasTimelineSetFor(member.roomId)) return;

        // ignore events for other users
        if (member.userId != MatrixClientPeg.get().credentials?.userId) return;

        // We could skip an update if the power level change didn't cross the
        // threshold for `VISIBILITY_CHANGE_TYPE`.
        for (const event of this.state.events) {
            const tile = this.messagePanel.current?.getTileForEventId(event.getId());
            if (!tile) {
                // The event is not visible, nothing to re-render.
                continue;
            }
            tile.forceUpdate();
        }

        this.forceUpdate();
    };

    private onEventReplaced = (replacedEvent: MatrixEvent): void => {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (!this.hasTimelineSetFor(replacedEvent.getRoomId())) return;

        // we could skip an update if the event isn't in our timeline,
        // but that's probably an early optimisation.
        this.forceUpdate();
    };

    private onRoomReceipt = (ev: MatrixEvent, room: Room): void => {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (room !== this.props.timelineSet.room) return;

        this.forceUpdate();
    };

    private onLocalEchoUpdated = (ev: MatrixEvent, room: Room, oldEventId?: string): void => {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (!this.hasTimelineSetFor(room.roomId)) return;

        this.reloadEvents();
    };

    private onAccountData = (ev: MatrixEvent, room: Room): void => {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (room !== this.props.timelineSet.room) return;

        if (ev.getType() !== EventType.FullyRead) return;

        // XXX: roomReadMarkerTsMap not updated here so it is now inconsistent. Replace
        // this mechanism of determining where the RM is relative to the view-port with
        // one supported by the server (the client needs more than an event ID).
        this.setState(
            {
                readMarkerEventId: ev.getContent().event_id,
            },
            this.props.onReadMarkerUpdated,
        );
    };

    private onEventDecrypted = (ev: MatrixEvent): void => {
        // Can be null for the notification timeline, etc.
        if (!this.props.timelineSet.room) return;

        if (!this.hasTimelineSetFor(ev.getRoomId())) return;

        if (!this.state.events.includes(ev)) return;

        this.recheckFirstVisibleEventIndex();

        // Need to update as we don't display event tiles for events that
        // haven't yet been decrypted. The event will have just been updated
        // in place so we just need to re-render.
        // TODO: We should restrict this to only events in our timeline,
        // but possibly the event tile itself should just update when this
        // happens to save us re-rendering the whole timeline.
        this.buildLegacyCallEventGroupers(this.state.events);
        this.forceUpdate();
    };

    private onSync = (clientSyncState: SyncState, prevState: SyncState | null, data?: object): void => {
        if (this.unmounted) return;
        this.setState({ clientSyncState });
    };

    private recheckFirstVisibleEventIndex = throttle(
        (): void => {
            const firstVisibleEventIndex = this.checkForPreJoinUISI(this.state.events);
            if (firstVisibleEventIndex !== this.state.firstVisibleEventIndex) {
                this.setState({ firstVisibleEventIndex });
            }
        },
        500,
        { leading: true, trailing: true },
    );

    private readMarkerTimeout(readMarkerPosition: number | null): number {
        return readMarkerPosition === 0
            ? this.context?.readMarkerInViewThresholdMs ?? this.state.readMarkerInViewThresholdMs
            : this.context?.readMarkerOutOfViewThresholdMs ?? this.state.readMarkerOutOfViewThresholdMs;
    }

    private async updateReadMarkerOnUserActivity(): Promise<void> {
        const initialTimeout = this.readMarkerTimeout(this.getReadMarkerPosition());
        this.readMarkerActivityTimer = new Timer(initialTimeout);

        while (this.readMarkerActivityTimer) {
            //unset on unmount
            UserActivity.sharedInstance().timeWhileActiveRecently(this.readMarkerActivityTimer);
            try {
                await this.readMarkerActivityTimer.finished();
            } catch (e) {
                continue; /* aborted */
            }
            // outside of try/catch to not swallow errors
            await this.updateReadMarker();
        }
    }

    private async updateReadReceiptOnUserActivity(): Promise<void> {
        this.readReceiptActivityTimer = new Timer(READ_RECEIPT_INTERVAL_MS);
        while (this.readReceiptActivityTimer) {
            //unset on unmount
            UserActivity.sharedInstance().timeWhileActiveNow(this.readReceiptActivityTimer);
            try {
                await this.readReceiptActivityTimer.finished();
            } catch (e) {
                continue; /* aborted */
            }
            // outside of try/catch to not swallow errors
            await this.sendReadReceipts();
        }
    }

    /**
     * Whether to send public or private receipts.
     */
    private async determineReceiptType(client: MatrixClient): Promise<ReceiptType> {
        const roomId = this.props.timelineSet.room?.roomId ?? null;
        const shouldSendPublicReadReceipts = SettingsStore.getValue("sendReadReceipts", roomId);

        if (shouldSendPublicReadReceipts) {
            return ReceiptType.Read;
        }

        if (
            !(await client.doesServerSupportUnstableFeature("org.matrix.msc2285.stable")) ||
            !(await client.isVersionSupported("v1.4"))
        ) {
            logger.warn(
                "Falling back to public instead of private receipts because the homeserver does not support them",
            );

            // The server does not support private read receipt. Fall back to public ones.
            return ReceiptType.Read;
        }

        return ReceiptType.ReadPrivate;
    }

    /**
     * Whether a fully_read marker should be send.
     */
    private shouldSendFullyReadMarker(fullyReadMarkerEventId: string | null): fullyReadMarkerEventId is string {
        if (!this.state.readMarkerEventId) {
            // Nothing that can be send.
            return false;
        }

        if (this.lastRMSentEventId && this.lastRMSentEventId === this.state.readMarkerEventId) {
            // Prevent sending the same receipt twice.
            return false;
        }

        if (this.state.readMarkerEventId && this.state.readMarkerEventId === this.initialReadMarkerId) {
            // The initial read marker is the one stored in the room account data.
            // It makes no sense to send a read marker for it,
            // because if it is in the room account data, a read marker must have been sent before.
            return false;
        }

        if (this.props.timelineSet.thread) {
            // Read marker for threads are not supported per spec.
            return false;
        }

        return true;
    }

    /**
     * Whether a read receipt should be send.
     */
    private shouldSendReadReceipt(
        currentReadReceiptEventId: string | null,
        currentReadReceiptEventIndex: number | null,
        lastReadEvent: MatrixEvent | null,
        lastReadEventIndex: number | null,
    ): lastReadEvent is MatrixEvent {
        if (!lastReadEvent) return false;

        // We want to avoid sending out read receipts when we are looking at
        // events in the past which are before the latest RR.
        //
        // For now, let's apply a heuristic: if (a) the event corresponding to
        // the latest RR (either from the server, or sent by ourselves) doesn't
        // appear in our timeline, and (b) we could forward-paginate the event
        // timeline, then don't send any more RRs.
        //
        // This isn't watertight, as we could be looking at a section of
        // timeline which is *after* the latest RR (so we should actually send
        // RRs) - but that is a bit of a niche case. It will sort itself out when
        // the user eventually hits the live timeline.

        if (
            currentReadReceiptEventId &&
            currentReadReceiptEventIndex === null &&
            this.timelineWindow?.canPaginate(EventTimeline.FORWARDS)
        ) {
            return false;
        }
        // Only send a RR if the last read event is ahead in the timeline relative to the current RR event.
        // Only send a RR if the last RR set != the one we would send
        return (
            (lastReadEventIndex === null ||
                currentReadReceiptEventIndex === null ||
                lastReadEventIndex > currentReadReceiptEventIndex) &&
            (!this.lastRRSentEventId || this.lastRRSentEventId !== lastReadEvent?.getId())
        );
    }

    private sendReadReceipts = async (): Promise<void> => {
        if (SettingsStore.getValue("lowBandwidth")) return;
        if (!this.messagePanel.current) return;
        if (!this.props.manageReadReceipts) return;

        // This happens on user_activity_end which is delayed, and it's
        // very possible have logged out within that timeframe, so check
        // we still have a client.
        const client = MatrixClientPeg.get();
        // if no client or client is guest don't send RR or RM
        if (!client || client.isGuest()) return;

        // "current" here means the receipts that have already been sent
        const currentReadReceiptEventId = this.getCurrentReadReceipt(true);
        const currentReadReceiptEventIndex = this.indexForEventId(currentReadReceiptEventId);

        // "last" here means the last displayed event
        const lastReadEventIndex = this.getLastDisplayedEventIndex({
            ignoreOwn: true,
        });
        const lastReadEvent: MatrixEvent | null = this.state.events[lastReadEventIndex ?? 0] ?? null;

        const shouldSendReadReceipt = this.shouldSendReadReceipt(
            currentReadReceiptEventId,
            currentReadReceiptEventIndex,
            lastReadEvent,
            lastReadEventIndex,
        );
        const fullyReadMarkerEventId = this.state.readMarkerEventId;
        const shouldSendFullyReadMarker = this.shouldSendFullyReadMarker(fullyReadMarkerEventId);
        const roomId = this.props.timelineSet.room?.roomId;

        debuglog(`Sending Read Markers for ${roomId}: `, {
            shouldSendReadReceipt,
            shouldSendFullyReadMarker,
            currentReadReceiptEventId,
            currentReadReceiptEventIndex,
            lastReadEventId: lastReadEvent?.getId(),
            lastReadEventIndex,
            readMarkerEventId: this.state.readMarkerEventId,
        });

        const proms: Array<Promise<void>> = [];

        if (shouldSendReadReceipt) {
            proms.push(this.sendReadReceipt(client, lastReadEvent));
        }

        if (shouldSendFullyReadMarker) {
            const readMarkerEvent = this.props.timelineSet.findEventById(fullyReadMarkerEventId);

            if (readMarkerEvent) {
                // Empty room Id should not happen here.
                // Either way fall back to empty string and let further functions handle it.
                proms.push(this.sendFullyReadMarker(client, roomId ?? "", fullyReadMarkerEventId));
            }
        }

        await Promise.all(proms);
    };

    /**
     * Sends a read receipt for event.
     * Resets the last sent event Id in case of an error, so that it will be retried next time.
     */
    private async sendReadReceipt(client: MatrixClient, event: MatrixEvent): Promise<void> {
        this.lastRRSentEventId = event.getId();
        const receiptType = await this.determineReceiptType(client);

        try {
            await client.sendReadReceipt(event, receiptType);
        } catch (err) {
            // it failed, so allow retries next time the user is active
            this.lastRRSentEventId = undefined;

            logger.error("Error sending receipt", {
                room: this.props.timelineSet.room?.roomId,
                error: err,
            });
        }
    }

    /**
     * Sends a fully_read marker for readMarkerEvent.
     * Resets the last sent event Id in case of an error, so that it will be retried next time.
     */
    private async sendFullyReadMarker(
        client: MatrixClient,
        roomId: string,
        fullyReadMarkerEventId: string,
    ): Promise<void> {
        this.lastRMSentEventId = this.state.readMarkerEventId;

        try {
            await client.setRoomReadMarkers(roomId, fullyReadMarkerEventId);
        } catch (error) {
            // it failed, so allow retries next time the user is active
            this.lastRMSentEventId = undefined;

            logger.error("Error sending fully_read", {
                roomId,
                error,
            });
        }
    }

    // if the read marker is on the screen, we can now assume we've caught up to the end
    // of the screen, so move the marker down to the bottom of the screen.
    private updateReadMarker = async (): Promise<void> => {
        if (!this.props.manageReadMarkers) return;
        if (this.getReadMarkerPosition() === 1) {
            // the read marker is at an event below the viewport,
            // we don't want to rewind it.
            return;
        }
        // move the RM to *after* the message at the bottom of the screen. This
        // avoids a problem whereby we never advance the RM if there is a huge
        // message which doesn't fit on the screen.
        const lastDisplayedIndex = this.getLastDisplayedEventIndex({
            allowPartial: true,
        });

        if (lastDisplayedIndex === null) {
            return;
        }
        const lastDisplayedEvent = this.state.events[lastDisplayedIndex];
        this.setReadMarker(lastDisplayedEvent.getId()!, lastDisplayedEvent.getTs());

        // the read-marker should become invisible, so that if the user scrolls
        // down, they don't see it.
        if (this.state.readMarkerVisible) {
            this.setState({
                readMarkerVisible: false,
            });
        }

        // Send the updated read marker (along with read receipt) to the server
        await this.sendReadReceipts();
    };

    // advance the read marker past any events we sent ourselves.
    private advanceReadMarkerPastMyEvents(): void {
        if (!this.props.manageReadMarkers || !this.timelineWindow) return;

        // we call `timelineWindow.getEvents()` rather than using
        // `this.state.liveEvents`, because React batches the update to the
        // latter, so it may not have been updated yet.
        const events = this.timelineWindow.getEvents();

        // first find where the current RM is
        let i: number;
        for (i = 0; i < events.length; i++) {
            if (events[i].getId() == this.state.readMarkerEventId) {
                break;
            }
        }
        if (i >= events.length) {
            return;
        }

        // now think about advancing it
        const myUserId = MatrixClientPeg.get().credentials.userId;
        for (i++; i < events.length; i++) {
            const ev = events[i];
            if (ev.getSender() !== myUserId) {
                break;
            }
        }
        // i is now the first unread message which we didn't send ourselves.
        i--;

        const ev = events[i];
        this.setReadMarker(ev.getId()!, ev.getTs());
    }

    /* jump down to the bottom of this room, where new events are arriving
     */
    public jumpToLiveTimeline = (): void => {
        // if we can't forward-paginate the existing timeline, then there
        // is no point reloading it - just jump straight to the bottom.
        //
        // Otherwise, reload the timeline rather than trying to paginate
        // through all of space-time.
        if (this.timelineWindow?.canPaginate(EventTimeline.FORWARDS)) {
            this.loadTimeline();
        } else {
            this.messagePanel.current?.scrollToBottom();
        }
    };

    public scrollToEventIfNeeded = (eventId: string): void => {
        this.messagePanel.current?.scrollToEventIfNeeded(eventId);
    };

    /* scroll to show the read-up-to marker. We put it 1/3 of the way down
     * the container.
     */
    public jumpToReadMarker = (): void => {
        if (!this.props.manageReadMarkers) return;
        if (!this.messagePanel.current) return;
        if (!this.state.readMarkerEventId) return;

        // we may not have loaded the event corresponding to the read-marker
        // into the timelineWindow. In that case, attempts to scroll to it
        // will fail.
        //
        // a quick way to figure out if we've loaded the relevant event is
        // simply to check if the messagepanel knows where the read-marker is.
        const ret = this.messagePanel.current.getReadMarkerPosition();
        if (ret !== null) {
            // The messagepanel knows where the RM is, so we must have loaded
            // the relevant event.
            this.messagePanel.current.scrollToEvent(this.state.readMarkerEventId, 0, 1 / 3);
            return;
        }

        // Looks like we haven't loaded the event corresponding to the read-marker.
        // As with jumpToLiveTimeline, we want to reload the timeline around the
        // read-marker.
        this.loadTimeline(this.state.readMarkerEventId, 0, 1 / 3);
    };

    /**
     * update the read-up-to marker to match the read receipt
     */
    public forgetReadMarker = async (): Promise<void> => {
        if (!this.props.manageReadMarkers) return;

        // Find the read receipt - we will set the read marker to this
        const rmId = this.getCurrentReadReceipt();

        // Look up the timestamp if we can find it
        const tl = this.props.timelineSet.getTimelineForEvent(rmId ?? "");
        let rmTs: number | undefined;
        if (tl) {
            const event = tl.getEvents().find((e) => {
                return e.getId() == rmId;
            });
            if (event) {
                rmTs = event.getTs();
            }
        }

        // Update the read marker to the values we found
        this.setReadMarker(rmId, rmTs);

        // Send the receipts to the server immediately (don't wait for activity)
        await this.sendReadReceipts();
    };

    /* return true if the content is fully scrolled down and we are
     * at the end of the live timeline.
     */
    public isAtEndOfLiveTimeline = (): boolean | undefined => {
        return (
            this.messagePanel.current?.isAtBottom() &&
            this.timelineWindow &&
            !this.timelineWindow.canPaginate(EventTimeline.FORWARDS)
        );
    };

    /* get the current scroll state. See ScrollPanel.getScrollState for
     * details.
     *
     * returns null if we are not mounted.
     */
    public getScrollState = (): IScrollState | null => {
        if (!this.messagePanel.current) {
            return null;
        }
        return this.messagePanel.current.getScrollState();
    };

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is visible
    //  +1: read marker is below the window
    public getReadMarkerPosition = (): number | null => {
        if (!this.props.manageReadMarkers) return null;
        if (!this.messagePanel.current) return null;
        if (!this.props.timelineSet.room) return null;

        const ret = this.messagePanel.current.getReadMarkerPosition();
        if (ret !== null) {
            return ret;
        }

        // the messagePanel doesn't know where the read marker is.
        // if we know the timestamp of the read marker, make a guess based on that.
        const rmTs = TimelinePanel.roomReadMarkerTsMap[this.props.timelineSet.room.roomId];
        if (rmTs && this.state.events.length > 0) {
            if (rmTs < this.state.events[0].getTs()) {
                return -1;
            } else {
                return 1;
            }
        }

        return null;
    };

    public canJumpToReadMarker = (): boolean => {
        // 1. Do not show jump bar if neither the RM nor the RR are set.
        // 3. We want to show the bar if the read-marker is off the top of the screen.
        // 4. Also, if pos === null, the event might not be paginated - show the unread bar
        const pos = this.getReadMarkerPosition();
        const ret =
            this.state.readMarkerEventId !== null && // 1.
            (pos === null || pos < 0); // 3., 4.
        return ret;
    };

    /*
     * called by the parent component when PageUp/Down/etc is pressed.
     *
     * We pass it down to the scroll panel.
     */
    public handleScrollKey = (ev: React.KeyboardEvent | KeyboardEvent): void => {
        if (!this.messagePanel.current) return;

        // jump to the live timeline on ctrl-end, rather than the end of the
        // timeline window.
        const action = getKeyBindingsManager().getRoomAction(ev);
        if (action === KeyBindingAction.JumpToLatestMessage) {
            this.jumpToLiveTimeline();
        } else {
            this.messagePanel.current.handleScrollKey(ev);
        }
    };

    private initTimeline(props: IProps): void {
        const initialEvent = props.eventId;
        const pixelOffset = props.eventPixelOffset;

        // if a pixelOffset is given, it is relative to the bottom of the
        // container. If not, put the event in the middle of the container.
        let offsetBase = 1;
        if (pixelOffset == null) {
            offsetBase = 0.5;
        }

        return this.loadTimeline(initialEvent, pixelOffset, offsetBase, props.eventScrollIntoView);
    }

    private scrollIntoView(eventId?: string, pixelOffset?: number, offsetBase?: number): void {
        const doScroll = (): void => {
            if (!this.messagePanel.current) return;
            if (eventId) {
                debuglog(
                    "TimelinePanel scrolling to eventId " +
                        eventId +
                        " at position " +
                        offsetBase! * 100 +
                        "% + " +
                        pixelOffset,
                );
                this.messagePanel.current.scrollToEvent(eventId, pixelOffset, offsetBase);
            } else {
                debuglog("TimelinePanel scrolling to bottom");
                this.messagePanel.current.scrollToBottom();
            }
        };

        debuglog("TimelinePanel scheduling scroll to event");
        this.props.onEventScrolledIntoView?.(eventId);
        // Ensure the correct scroll position pre render, if the messages have already been loaded to DOM,
        // to avoid it jumping around
        doScroll();

        // Ensure the correct scroll position post render for correct behaviour.
        //
        // requestAnimationFrame runs our code immediately after the DOM update but before the next repaint.
        //
        // If the messages have just been loaded for the first time, this ensures we'll repeat setting the
        // correct scroll position after React has re-rendered the TimelinePanel and MessagePanel and
        // updated the DOM.
        window.requestAnimationFrame(() => {
            doScroll();
        });
    }

    private async extendOverlayWindowToCoverMainWindow(): Promise<void> {
        const mainWindow = this.timelineWindow!;
        const overlayWindow = this.overlayTimelineWindow!;
        const mainEvents = mainWindow.getEvents();

        if (mainEvents.length > 0) {
            let paginationRequests: Promise<unknown>[];

            // Keep paginating until the main window is covered
            do {
                paginationRequests = [];
                const overlayEvents = overlayWindow.getEvents();

                if (
                    overlayWindow.canPaginate(EventTimeline.BACKWARDS) &&
                    (overlayEvents.length === 0 ||
                        overlaysAfter(overlayEvents[0], mainEvents[0]) ||
                        !mainWindow.canPaginate(EventTimeline.BACKWARDS))
                ) {
                    // Paginating backwards could reveal more events to be overlaid in the main window
                    paginationRequests.push(
                        this.onPaginationRequest(overlayWindow, EventTimeline.BACKWARDS, PAGINATE_SIZE),
                    );
                }

                if (
                    overlayWindow.canPaginate(EventTimeline.FORWARDS) &&
                    (overlayEvents.length === 0 ||
                        overlaysBefore(overlayEvents.at(-1)!, mainEvents.at(-1)!) ||
                        !mainWindow.canPaginate(EventTimeline.FORWARDS))
                ) {
                    // Paginating forwards could reveal more events to be overlaid in the main window
                    paginationRequests.push(
                        this.onPaginationRequest(overlayWindow, EventTimeline.FORWARDS, PAGINATE_SIZE),
                    );
                }

                await Promise.all(paginationRequests);
            } while (paginationRequests.length > 0);
        }
    }

    /**
     * (re)-load the event timeline, and initialise the scroll state, centered
     * around the given event.
     *
     * @param {string?}  eventId the event to focus on. If undefined, will
     *    scroll to the bottom of the room.
     *
     * @param {number?} pixelOffset   offset to position the given event at
     *    (pixels from the offsetBase). If omitted, defaults to 0.
     *
     * @param {number?} offsetBase the reference point for the pixelOffset. 0
     *     means the top of the container, 1 means the bottom, and fractional
     *     values mean somewhere in the middle. If omitted, it defaults to 0.
     *
     * @param {boolean?} scrollIntoView whether to scroll the event into view.
     */
    private loadTimeline(eventId?: string, pixelOffset?: number, offsetBase?: number, scrollIntoView = true): void {
        const cli = MatrixClientPeg.get();
        this.timelineWindow = new TimelineWindow(cli, this.props.timelineSet, { windowLimit: this.props.timelineCap });
        this.overlayTimelineWindow = this.props.overlayTimelineSet
            ? new TimelineWindow(cli, this.props.overlayTimelineSet, { windowLimit: this.props.timelineCap })
            : undefined;

        const onLoaded = (): void => {
            if (this.unmounted) return;

            // clear the timeline min-height when (re)loading the timeline
            this.messagePanel.current?.onTimelineReset();
            this.reloadEvents();

            // If we switched away from the room while there were pending
            // outgoing events, the read-marker will be before those events.
            // We need to skip over any which have subsequently been sent.
            this.advanceReadMarkerPastMyEvents();

            this.setState(
                {
                    canBackPaginate:
                        (this.timelineWindow?.canPaginate(EventTimeline.BACKWARDS) ||
                            this.overlayTimelineWindow?.canPaginate(EventTimeline.BACKWARDS)) ??
                        false,
                    canForwardPaginate:
                        (this.timelineWindow?.canPaginate(EventTimeline.FORWARDS) ||
                            this.overlayTimelineWindow?.canPaginate(EventTimeline.FORWARDS)) ??
                        false,
                    timelineLoading: false,
                },
                () => {
                    // initialise the scroll state of the message panel
                    if (!this.messagePanel.current) {
                        // this shouldn't happen - we know we're mounted because
                        // we're in a setState callback, and we know
                        // timelineLoading is now false, so render() should have
                        // mounted the message panel.
                        logger.log("can't initialise scroll state because messagePanel didn't load");
                        return;
                    }

                    if (scrollIntoView) {
                        this.scrollIntoView(eventId, pixelOffset, offsetBase);
                    }

                    if (this.props.sendReadReceiptOnLoad) {
                        this.sendReadReceipts().catch((err) => {
                            logger.warn("Error sending receipts on load", err);
                        });
                    }
                },
            );
        };

        const onError = (error: MatrixError): void => {
            if (this.unmounted) return;

            this.setState({ timelineLoading: false });
            logger.error(`Error loading timeline panel at ${this.props.timelineSet.room?.roomId}/${eventId}`, error);

            let onFinished: (() => void) | undefined;

            // if we were given an event ID, then when the user closes the
            // dialog, let's jump to the end of the timeline. If we weren't,
            // something has gone badly wrong and rather than causing a loop of
            // undismissable dialogs, let's just give up.
            if (eventId) {
                onFinished = () => {
                    // go via the dispatcher so that the URL is updated
                    dis.dispatch<ViewRoomPayload>({
                        action: Action.ViewRoom,
                        room_id: this.props.timelineSet.room.roomId,
                        metricsTrigger: undefined, // room doesn't change
                    });
                };
            }

            let description: string;
            if (error.errcode == "M_FORBIDDEN") {
                description = _t(
                    "Tried to load a specific point in this room's timeline, but you " +
                        "do not have permission to view the message in question.",
                );
            } else {
                description = _t("Tried to load a specific point in this room's timeline, but was unable to find it.");
            }

            Modal.createDialog(ErrorDialog, {
                title: _t("Failed to load timeline position"),
                description,
                onFinished,
            });
        };

        // if we already have the event in question, TimelineWindow.load
        // returns a resolved promise.
        //
        // In this situation, we don't really want to defer the update of the
        // state to the next event loop, because it makes room-switching feel
        // quite slow. So we detect that situation and shortcut straight to
        // calling _reloadEvents and updating the state.

        // This is a hot-path optimization by skipping a promise tick
        // by repeating a no-op sync branch in
        // TimelineSet.getTimelineForEvent & MatrixClient.getEventTimeline
        if (this.props.timelineSet.getTimelineForEvent(eventId) && !this.overlayTimelineWindow) {
            // if we've got an eventId, and the timeline exists, we can skip
            // the promise tick.
            this.timelineWindow.load(eventId, INITIAL_SIZE);
            // in this branch this method will happen in sync time
            onLoaded();
            return;
        }

        const prom = this.timelineWindow.load(eventId, INITIAL_SIZE).then(async (): Promise<void> => {
            if (this.overlayTimelineWindow) {
                // TODO: use timestampToEvent to load the overlay timeline
                // with more correct position when main TL eventId is truthy
                await this.overlayTimelineWindow.load(undefined, INITIAL_SIZE);
                await this.extendOverlayWindowToCoverMainWindow();
            }
        });
        this.buildLegacyCallEventGroupers();
        this.setState({
            events: [],
            liveEvents: [],
            canBackPaginate: false,
            canForwardPaginate: false,
            timelineLoading: true,
        });
        prom.then(onLoaded, onError);
    }

    // handle the completion of a timeline load or localEchoUpdate, by
    // reloading the events from the timelinewindow and pending event list into
    // the state.
    private reloadEvents(): void {
        // we might have switched rooms since the load started - just bin
        // the results if so.
        if (this.unmounted) return;

        const state = this.getEvents();
        this.buildLegacyCallEventGroupers(state.events);
        this.setState(state);
    }

    // Force refresh the timeline before threads support pending events
    public refreshTimeline(eventId?: string): void {
        this.loadTimeline(eventId, undefined, undefined, false);
        this.reloadEvents();
    }

    // get the list of events from the timeline windows and the pending event list
    private getEvents(): Pick<IState, "events" | "liveEvents" | "firstVisibleEventIndex"> {
        const mainEvents = this.timelineWindow!.getEvents();
        let overlayEvents = this.overlayTimelineWindow?.getEvents() ?? [];
        if (this.props.overlayTimelineSetFilter !== undefined) {
            overlayEvents = overlayEvents.filter(this.props.overlayTimelineSetFilter);
        }

        // maintain the main timeline event order as returned from the HS
        // merge overlay events at approximately the right position based on local timestamp
        const events = overlayEvents.reduce(
            (acc: MatrixEvent[], overlayEvent: MatrixEvent) => {
                // find the first main tl event with a later timestamp
                const index = acc.findIndex((event) => overlaysBefore(overlayEvent, event));
                // insert overlay event into timeline at approximately the right place
                // if it's beyond the edge of the main window, hide it so that expanding
                // the main window doesn't cause new events to pop in and change its position
                if (index === -1) {
                    if (!this.timelineWindow!.canPaginate(EventTimeline.FORWARDS)) {
                        acc.push(overlayEvent);
                    }
                } else if (index === 0) {
                    if (!this.timelineWindow!.canPaginate(EventTimeline.BACKWARDS)) {
                        acc.unshift(overlayEvent);
                    }
                } else {
                    acc.splice(index, 0, overlayEvent);
                }
                return acc;
            },
            [...mainEvents],
        );

        // `arrayFastClone` performs a shallow copy of the array
        // we want the last event to be decrypted first but displayed last
        // `reverse` is destructive and unfortunately mutates the "events" array
        arrayFastClone(events)
            .reverse()
            .forEach((event) => {
                const client = MatrixClientPeg.get();
                client.decryptEventIfNeeded(event);
            });

        const firstVisibleEventIndex = this.checkForPreJoinUISI(events);

        // Hold onto the live events separately. The read receipt and read marker
        // should use this list, so that they don't advance into pending events.
        const liveEvents = [...events];

        // if we're at the end of the live timeline, append the pending events
        if (!this.timelineWindow!.canPaginate(EventTimeline.FORWARDS)) {
            const pendingEvents = this.props.timelineSet.getPendingEvents();
            events.push(
                ...pendingEvents.filter((event) => {
                    const { shouldLiveInRoom, threadId } = this.props.timelineSet.room!.eventShouldLiveIn(
                        event,
                        pendingEvents,
                    );

                    if (this.context.timelineRenderingType === TimelineRenderingType.Thread) {
                        return threadId === this.context.threadId;
                    }
                    {
                        return shouldLiveInRoom;
                    }
                }),
            );
        }

        return {
            events,
            liveEvents,
            firstVisibleEventIndex,
        };
    }

    /**
     * Check for undecryptable messages that were sent while the user was not in
     * the room.
     *
     * @param {Array<MatrixEvent>} events The timeline events to check
     *
     * @return {Number} The index within `events` of the event after the most recent
     * undecryptable event that was sent while the user was not in the room.  If no
     * such events were found, then it returns 0.
     */
    private checkForPreJoinUISI(events: MatrixEvent[]): number {
        const cli = MatrixClientPeg.get();
        const room = this.props.timelineSet.room;

        const isThreadTimeline = [TimelineRenderingType.Thread, TimelineRenderingType.ThreadsList].includes(
            this.context.timelineRenderingType,
        );
        if (events.length === 0 || !room || !cli.isRoomEncrypted(room.roomId) || isThreadTimeline) {
            logger.info("checkForPreJoinUISI: showing all messages, skipping check");
            return 0;
        }

        const userId = cli.getSafeUserId();

        // get the user's membership at the last event by getting the timeline
        // that the event belongs to, and traversing the timeline looking for
        // that event, while keeping track of the user's membership
        let i = events.length - 1;
        let userMembership = "leave";
        for (; i >= 0; i--) {
            const timeline = this.props.timelineSet.getTimelineForEvent(events[i].getId()!);
            if (!timeline) {
                // Somehow, it seems to be possible for live events to not have
                // a timeline, even though that should not happen. :(
                // https://github.com/vector-im/element-web/issues/12120
                logger.warn(
                    `Event ${events[i].getId()} in room ${room.roomId} is live, ` + `but it does not have a timeline`,
                );
                continue;
            }

            userMembership = timeline.getState(EventTimeline.FORWARDS)?.getMember(userId)?.membership ?? "leave";
            const timelineEvents = timeline.getEvents();
            for (let j = timelineEvents.length - 1; j >= 0; j--) {
                const event = timelineEvents[j];
                if (event.getId() === events[i].getId()) {
                    break;
                } else if (event.getStateKey() === userId && event.getType() === EventType.RoomMember) {
                    userMembership = event.getPrevContent().membership || "leave";
                }
            }
            break;
        }

        // now go through the rest of the events and find the first undecryptable
        // one that was sent when the user wasn't in the room
        for (; i >= 0; i--) {
            const event = events[i];
            if (event.getStateKey() === userId && event.getType() === EventType.RoomMember) {
                userMembership = event.getPrevContent().membership || "leave";
            } else if (userMembership === "leave" && (event.isDecryptionFailure() || event.isBeingDecrypted())) {
                // reached an undecryptable message when the user wasn't in the room -- don't try to load any more
                // Note: for now, we assume that events that are being decrypted are
                // not decryptable - we will be called once more when it is decrypted.
                logger.info("checkForPreJoinUISI: reached a pre-join UISI at index ", i);
                return i + 1;
            }
        }

        logger.info("checkForPreJoinUISI: did not find pre-join UISI");
        return 0;
    }

    private indexForEventId(evId: string | null): number | null {
        if (evId === null) {
            return null;
        }
        /* Threads do not have server side support for read receipts and the concept
        is very tied to the main room timeline, we are forcing the timeline to
        send read receipts for threaded events */
        if (this.context.timelineRenderingType === TimelineRenderingType.Thread) {
            return 0;
        }
        const index = this.state.events.findIndex((ev) => ev.getId() === evId);
        return index > -1 ? index : null;
    }

    /**
     * Get a list of undecryptable events currently visible on-screen.
     *
     * @param {boolean} addMargin Whether to add an extra margin beyond the viewport
     * where events are still considered "visible"
     *
     * @returns {MatrixEvent[] | null} A list of undecryptable events, or null if
     *     the list of events could not be determined.
     */
    public getVisibleDecryptionFailures(addMargin?: boolean): MatrixEvent[] | null {
        const messagePanel = this.messagePanel.current;
        if (!messagePanel) return null;

        const messagePanelNode = ReactDOM.findDOMNode(messagePanel) as Element;
        if (!messagePanelNode) return null; // sometimes this happens for fresh rooms/post-sync
        const wrapperRect = messagePanelNode.getBoundingClientRect();
        const margin = addMargin ? VISIBLE_DECRYPTION_FAILURE_MARGIN : 0;
        const screenTop = wrapperRect.top - margin;
        const screenBottom = wrapperRect.bottom + margin;

        const result: MatrixEvent[] = [];
        for (const ev of this.state.liveEvents) {
            const eventId = ev.getId();
            if (!eventId) continue;
            const node = messagePanel.getNodeForEventId(eventId);
            if (!node) continue;

            const boundingRect = node.getBoundingClientRect();
            if (boundingRect.top > screenBottom) {
                // we have gone past the visible section of timeline
                break;
            } else if (boundingRect.bottom >= screenTop) {
                // the tile for this event is in the visible part of the screen (or just above/below it).
                if (ev.isDecryptionFailure()) result.push(ev);
            }
        }
        return result;
    }

    private getLastDisplayedEventIndex(opts: IEventIndexOpts = {}): number | null {
        const ignoreOwn = opts.ignoreOwn || false;
        const allowPartial = opts.allowPartial || false;

        const messagePanel = this.messagePanel.current;
        if (!messagePanel) return null;

        const messagePanelNode = ReactDOM.findDOMNode(messagePanel) as Element;
        if (!messagePanelNode) return null; // sometimes this happens for fresh rooms/post-sync
        const wrapperRect = messagePanelNode.getBoundingClientRect();
        const myUserId = MatrixClientPeg.get().credentials.userId;

        const isNodeInView = (node?: HTMLElement): boolean => {
            if (node) {
                const boundingRect = node.getBoundingClientRect();
                if (
                    (allowPartial && boundingRect.top <= wrapperRect.bottom) ||
                    (!allowPartial && boundingRect.bottom <= wrapperRect.bottom)
                ) {
                    return true;
                }
            }
            return false;
        };

        // We keep track of how many of the adjacent events didn't have a tile
        // but should have the read receipt moved past them, so
        // we can include those once we find the last displayed (visible) event.
        // The counter is not started for events we don't want
        // to send a read receipt for (our own events, local echos).
        let adjacentInvisibleEventCount = 0;
        // Use `liveEvents` here because we don't want the read marker or read
        // receipt to advance into pending events.
        for (let i = this.state.liveEvents.length - 1; i >= 0; --i) {
            const ev = this.state.liveEvents[i];

            const node = messagePanel.getNodeForEventId(ev.getId()!);
            const isInView = isNodeInView(node);

            // when we've reached the first visible event, and the previous
            // events were all invisible (with the first one not being ignored),
            // return the index of the first invisible event.
            if (isInView && adjacentInvisibleEventCount !== 0) {
                return i + adjacentInvisibleEventCount;
            }
            if (node && !isInView) {
                // has node but not in view, so reset adjacent invisible events
                adjacentInvisibleEventCount = 0;
            }

            const shouldIgnore =
                !!ev.status || // local echo
                (ignoreOwn && ev.getSender() === myUserId); // own message
            const isWithoutTile =
                !haveRendererForEvent(ev, this.context?.showHiddenEvents) || shouldHideEvent(ev, this.context);

            if (isWithoutTile || !node) {
                // don't start counting if the event should be ignored,
                // but continue counting if we were already so the offset
                // to the previous invisble event that didn't need to be ignored
                // doesn't get messed up
                if (!shouldIgnore || (shouldIgnore && adjacentInvisibleEventCount !== 0)) {
                    ++adjacentInvisibleEventCount;
                }
                continue;
            }

            if (shouldIgnore) {
                continue;
            }

            if (isInView) {
                return i;
            }
        }

        return null;
    }

    /**
     * Get the id of the event corresponding to our user's latest read-receipt.
     *
     * @param {Boolean} ignoreSynthesized If true, return only receipts that
     *                                    have been sent by the server, not
     *                                    implicit ones generated by the JS
     *                                    SDK.
     * @return {String} the event ID
     */
    private getCurrentReadReceipt(ignoreSynthesized = false): string | null {
        const client = MatrixClientPeg.get();
        // the client can be null on logout
        if (client == null) {
            return null;
        }

        const myUserId = client.getSafeUserId();
        const receiptStore = this.props.timelineSet.thread ?? this.props.timelineSet.room;
        return receiptStore?.getEventReadUpTo(myUserId, ignoreSynthesized) ?? null;
    }

    private setReadMarker(eventId: string | null, eventTs: number, inhibitSetState = false): void {
        const roomId = this.props.timelineSet.room?.roomId;

        // don't update the state (and cause a re-render) if there is
        // no change to the RM.
        if (eventId === this.state.readMarkerEventId || eventId === null) {
            return;
        }

        // in order to later figure out if the read marker is
        // above or below the visible timeline, we stash the timestamp.
        TimelinePanel.roomReadMarkerTsMap[roomId ?? ""] = eventTs;

        if (inhibitSetState) {
            return;
        }

        // Do the local echo of the RM
        // run the render cycle before calling the callback, so that
        // getReadMarkerPosition() returns the right thing.
        this.setState(
            {
                readMarkerEventId: eventId,
            },
            this.props.onReadMarkerUpdated,
        );
    }

    private shouldPaginate(): boolean {
        // don't try to paginate while events in the timeline are
        // still being decrypted. We don't render events while they're
        // being decrypted, so they don't take up space in the timeline.
        // This means we can pull quite a lot of events into the timeline
        // and end up trying to render a lot of events.
        return !this.state.events.some((e) => {
            return e.isBeingDecrypted();
        });
    }

    private getRelationsForEvent = (
        eventId: string,
        relationType: RelationType | string,
        eventType: EventType | string,
    ): Relations | undefined =>
        this.props.timelineSet.relations?.getChildEventsForEvent(eventId, relationType, eventType);

    private buildLegacyCallEventGroupers(events?: MatrixEvent[]): void {
        this.callEventGroupers = buildLegacyCallEventGroupers(this.callEventGroupers, events);
    }

    public render(): React.ReactNode {
        // just show a spinner while the timeline loads.
        //
        // put it in a div of the right class (mx_RoomView_messagePanel) so
        // that the order in the roomview flexbox is correct, and
        // mx_RoomView_messageListWrapper to position the inner div in the
        // right place.
        //
        // Note that the click-on-search-result functionality relies on the
        // fact that the messagePanel is hidden while the timeline reloads,
        // but that the RoomHeader (complete with search term) continues to
        // exist.
        if (this.state.timelineLoading) {
            return (
                <div className="mx_RoomView_messagePanelSpinner">
                    <Spinner />
                </div>
            );
        }

        if (this.state.events.length == 0 && !this.state.canBackPaginate && this.props.empty) {
            return (
                <div className={this.props.className + " mx_RoomView_messageListWrapper"}>
                    <div className="mx_RoomView_empty">{this.props.empty}</div>
                </div>
            );
        }

        // give the messagepanel a stickybottom if we're at the end of the
        // live timeline, so that the arrival of new events triggers a
        // scroll.
        //
        // Make sure that stickyBottom is *false* if we can paginate
        // forwards, otherwise if somebody hits the bottom of the loaded
        // events when viewing historical messages, we get stuck in a loop
        // of paginating our way through the entire history of the room.
        const stickyBottom = !this.timelineWindow.canPaginate(EventTimeline.FORWARDS);

        // If the state is PREPARED or CATCHUP, we're still waiting for the js-sdk to sync with
        // the HS and fetch the latest events, so we are effectively forward paginating.
        const forwardPaginating =
            this.state.forwardPaginating || ["PREPARED", "CATCHUP"].includes(this.state.clientSyncState!);
        const events = this.state.firstVisibleEventIndex
            ? this.state.events.slice(this.state.firstVisibleEventIndex)
            : this.state.events;
        return (
            <MessagePanel
                ref={this.messagePanel}
                room={this.props.timelineSet.room}
                permalinkCreator={this.props.permalinkCreator}
                hidden={this.props.hidden}
                backPaginating={this.state.backPaginating}
                forwardPaginating={forwardPaginating}
                events={events}
                highlightedEventId={this.props.highlightedEventId}
                readMarkerEventId={this.state.readMarkerEventId}
                readMarkerVisible={this.state.readMarkerVisible}
                canBackPaginate={this.state.canBackPaginate && this.state.firstVisibleEventIndex === 0}
                showUrlPreview={this.props.showUrlPreview}
                showReadReceipts={this.props.showReadReceipts}
                ourUserId={MatrixClientPeg.get().getSafeUserId()}
                stickyBottom={stickyBottom}
                onScroll={this.onMessageListScroll}
                onFillRequest={this.onMessageListFillRequest}
                onUnfillRequest={this.onMessageListUnfillRequest}
                isTwelveHour={this.context?.showTwelveHourTimestamps ?? this.state.isTwelveHour}
                alwaysShowTimestamps={
                    this.props.alwaysShowTimestamps ??
                    this.context?.alwaysShowTimestamps ??
                    this.state.alwaysShowTimestamps
                }
                className={this.props.className}
                resizeNotifier={this.props.resizeNotifier}
                getRelationsForEvent={this.getRelationsForEvent}
                editState={this.props.editState}
                showReactions={this.props.showReactions}
                layout={this.props.layout}
                hideThreadedMessages={this.props.hideThreadedMessages}
                disableGrouping={this.props.disableGrouping}
                callEventGroupers={this.callEventGroupers}
            />
        );
    }
}

/**
 * Iterate across all of the timelineSets and timelines inside to expose all of
 * the event IDs contained inside.
 *
 * @return An event ID list for every timeline in every timelineSet
 */
function serializeEventIdsFromTimelineSets(timelineSets: EventTimelineSet[]): { [key: string]: string[] }[] {
    const serializedEventIdsInTimelineSet = timelineSets.map((timelineSet) => {
        const timelineMap: Record<string, string[]> = {};

        const timelines = timelineSet.getTimelines();
        const liveTimeline = timelineSet.getLiveTimeline();

        timelines.forEach((timeline, index) => {
            // Add a special label when it is the live timeline so we can tell
            // it apart from the others
            const isLiveTimeline = timeline === liveTimeline;
            timelineMap[isLiveTimeline ? "liveTimeline" : `${index}`] = timeline.getEvents().map((ev) => ev.getId()!);
        });

        return timelineMap;
    });

    return serializedEventIdsInTimelineSet;
}

export default TimelinePanel;
