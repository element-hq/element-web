/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type ReactNode, type TransitionEvent } from "react";
import classNames from "classnames";
import {
    type Room,
    type MatrixClient,
    RoomStateEvent,
    EventStatus,
    type MatrixEvent,
    EventType,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { isSupportedReceiptType } from "matrix-js-sdk/src/utils";

import shouldHideEvent from "../../shouldHideEvent";
import { formatDate, wantsDateSeparator } from "../../DateUtils";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import SettingsStore from "../../settings/SettingsStore";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import { Layout } from "../../settings/enums/Layout";
import EventTile, {
    type GetRelationsForEvent,
    type IReadReceiptProps,
    isEligibleForSpecialReceipt,
    type UnwrappedEventTile,
} from "../views/rooms/EventTile";
import IRCTimelineProfileResizer from "../views/elements/IRCTimelineProfileResizer";
import defaultDispatcher from "../../dispatcher/dispatcher";
import type LegacyCallEventGrouper from "./LegacyCallEventGrouper";
import WhoIsTypingTile from "../views/rooms/WhoIsTypingTile";
import ScrollPanel, { type IScrollState } from "./ScrollPanel";
import DateSeparator from "../views/messages/DateSeparator";
import TimelineSeparator, { SeparatorKind } from "../views/messages/TimelineSeparator";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import Spinner from "../views/elements/Spinner";
import { type RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import type EditorStateTransfer from "../../utils/EditorStateTransfer";
import { Action } from "../../dispatcher/actions";
import { getEventDisplayInfo } from "../../utils/EventRenderingUtils";
import { type IReadReceiptPosition } from "../views/rooms/ReadReceiptMarker";
import { haveRendererForEvent } from "../../events/EventTileFactory";
import { editorRoomKey } from "../../Editing";
import { hasThreadSummary } from "../../utils/EventUtils";
import { type BaseGrouper } from "./grouper/BaseGrouper";
import { MainGrouper } from "./grouper/MainGrouper";
import { CreationGrouper } from "./grouper/CreationGrouper";
import { _t } from "../../languageHandler";
import { getLateEventInfo } from "./grouper/LateEventGrouper";

const CONTINUATION_MAX_INTERVAL = 5 * 60 * 1000; // 5 minutes
const continuedTypes = [EventType.Sticker, EventType.RoomMessage];

// check if there is a previous event and it has the same sender as this event
// and the types are the same/is in continuedTypes and the time between them is <= CONTINUATION_MAX_INTERVAL
export function shouldFormContinuation(
    prevEvent: MatrixEvent | null,
    mxEvent: MatrixEvent,
    matrixClient: MatrixClient,
    showHiddenEvents: boolean,
    timelineRenderingType?: TimelineRenderingType,
): boolean {
    if (timelineRenderingType === TimelineRenderingType.ThreadsList) return false;
    // sanity check inputs
    if (!prevEvent?.sender || !mxEvent.sender) return false;
    // check if within the max continuation period
    if (mxEvent.getTs() - prevEvent.getTs() > CONTINUATION_MAX_INTERVAL) return false;

    // As we summarise redactions, do not continue a redacted event onto a non-redacted one and vice-versa
    if (mxEvent.isRedacted() !== prevEvent.isRedacted()) return false;

    // Some events should appear as continuations from previous events of different types.
    if (
        mxEvent.getType() !== prevEvent.getType() &&
        (!continuedTypes.includes(mxEvent.getType() as EventType) ||
            !continuedTypes.includes(prevEvent.getType() as EventType))
    )
        return false;

    // Check if the sender is the same and hasn't changed their displayname/avatar between these events
    if (
        mxEvent.sender.userId !== prevEvent.sender.userId ||
        mxEvent.sender.name !== prevEvent.sender.name ||
        mxEvent.sender.getMxcAvatarUrl() !== prevEvent.sender.getMxcAvatarUrl()
    )
        return false;

    // Thread summaries in the main timeline should break up a continuation on both sides
    if (
        (hasThreadSummary(mxEvent) || hasThreadSummary(prevEvent)) &&
        timelineRenderingType !== TimelineRenderingType.Thread
    ) {
        return false;
    }

    // if we don't have tile for previous event then it was shown by showHiddenEvents and has no SenderProfile
    if (!haveRendererForEvent(prevEvent, matrixClient, showHiddenEvents)) return false;

    return true;
}

interface IProps {
    // the list of MatrixEvents to display
    events: MatrixEvent[];

    // true to give the component a 'display: none' style.
    hidden?: boolean;

    // true to show a spinner at the top of the timeline to indicate
    // back-pagination in progress
    backPaginating?: boolean;

    // true to show a spinner at the end of the timeline to indicate
    // forward-pagination in progress
    forwardPaginating?: boolean;

    // ID of an event to highlight. If undefined, no event will be highlighted.
    highlightedEventId?: string;

    // The room these events are all in together, if any.
    // (The notification panel won't have a room here, for example.)
    room?: Room;

    // Should we show URL Previews
    showUrlPreview?: boolean;

    // event after which we should show a read marker
    readMarkerEventId?: string | null;

    // whether the read marker should be visible
    readMarkerVisible?: boolean;

    // the userid of our user. This is used to suppress the read marker
    // for pending messages.
    ourUserId?: string;

    // whether the timeline can visually go back any further
    canBackPaginate?: boolean;

    // whether to show read receipts
    showReadReceipts?: boolean;

    // true if updates to the event list should cause the scroll panel to
    // scroll down when we are at the bottom of the window. See ScrollPanel
    // for more details.
    stickyBottom?: boolean;

    // className for the panel
    className?: string;

    // show twelve hour timestamps
    isTwelveHour?: boolean;

    // show timestamps always
    alwaysShowTimestamps?: boolean;

    // whether to show reactions for an event
    showReactions?: boolean;

    // which layout to use
    layout?: Layout;

    resizeNotifier?: ResizeNotifier;
    permalinkCreator?: RoomPermalinkCreator;
    editState?: EditorStateTransfer;

    // callback which is called when the panel is scrolled.
    onScroll?(event: Event): void;

    // callback which is called when more content is needed.
    onFillRequest?(backwards: boolean): Promise<boolean>;

    // helper function to access relations for an event
    onUnfillRequest?(backwards: boolean, scrollToken: string | null): void;

    getRelationsForEvent?: GetRelationsForEvent;

    hideThreadedMessages?: boolean;
    disableGrouping?: boolean;

    callEventGroupers: Map<string, LegacyCallEventGrouper>;
}

interface IState {
    ghostReadMarkers: string[];
    showTypingNotifications: boolean;
    hideSender: boolean;
}

interface IReadReceiptForUser {
    lastShownEventId: string;
    receipt: IReadReceiptProps;
}

/* (almost) stateless UI component which builds the event tiles in the room timeline.
 */
export default class MessagePanel extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public static defaultProps = {
        disableGrouping: false,
    };

    // opaque readreceipt info for each userId; used by ReadReceiptMarker
    // to manage its animations
    private readReceiptMap: { [userId: string]: IReadReceiptPosition } = {};

    // Track read receipts by event ID. For each _shown_ event ID, we store
    // the list of read receipts to display:
    //   [
    //       {
    //           userId: string,
    //           member: RoomMember,
    //           ts: number,
    //       },
    //   ]
    // This is recomputed on each render. It's only stored on the component
    // for ease of passing the data around since it's computed in one pass
    // over all events.
    private readReceiptsByEvent: Map<string, IReadReceiptProps[]> = new Map();

    // Track read receipts by user ID. For each user ID we've ever shown a
    // a read receipt for, we store an object:
    //   {
    //       lastShownEventId: string,
    //       receipt: {
    //           userId: string,
    //           member: RoomMember,
    //           ts: number,
    //       },
    //   }
    // so that we can always keep receipts displayed by reverting back to
    // the last shown event for that user ID when needed. This may feel like
    // it duplicates the receipt storage in the room, but at this layer, we
    // are tracking _shown_ event IDs, which the JS SDK knows nothing about.
    // This is recomputed on each render, using the data from the previous
    // render as our fallback for any user IDs we can't match a receipt to a
    // displayed event in the current render cycle.
    private readReceiptsByUserId: Map<string, IReadReceiptForUser> = new Map();

    private readonly _showHiddenEvents: boolean;
    private unmounted = false;

    private readMarkerNode = createRef<HTMLLIElement>();
    private whoIsTyping = createRef<WhoIsTypingTile>();
    public scrollPanel = createRef<ScrollPanel>();

    private showTypingNotificationsWatcherRef?: string;
    private eventTiles: Record<string, UnwrappedEventTile> = {};

    // A map to allow groupers to maintain consistent keys even if their first event is uprooted due to back-pagination.
    public grouperKeyMap = new WeakMap<MatrixEvent, string>();

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

        this.state = {
            // previous positions the read marker has been in, so we can
            // display 'ghost' read markers that are animating away
            ghostReadMarkers: [],
            showTypingNotifications: SettingsStore.getValue("showTypingNotifications"),
            hideSender: this.shouldHideSender(),
        };

        // Cache these settings on mount since Settings is expensive to query,
        // and we check this in a hot code path. This is also cached in our
        // RoomContext, however we still need a fallback for roomless MessagePanels.
        this._showHiddenEvents = SettingsStore.getValue("showHiddenEventsInTimeline");
    }

    public componentDidMount(): void {
        this.unmounted = false;
        this.showTypingNotificationsWatcherRef = SettingsStore.watchSetting(
            "showTypingNotifications",
            null,
            this.onShowTypingNotificationsChange,
        );
        this.calculateRoomMembersCount();
        this.props.room?.currentState.on(RoomStateEvent.Update, this.calculateRoomMembersCount);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        this.props.room?.currentState.off(RoomStateEvent.Update, this.calculateRoomMembersCount);
        SettingsStore.unwatchSetting(this.showTypingNotificationsWatcherRef);
        this.readReceiptMap = {};
    }

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        if (prevProps.layout !== this.props.layout) {
            this.calculateRoomMembersCount();
        }

        if (
            prevProps.readMarkerVisible &&
            prevProps.readMarkerEventId &&
            this.props.readMarkerEventId !== prevProps.readMarkerEventId
        ) {
            const ghostReadMarkers = this.state.ghostReadMarkers;
            ghostReadMarkers.push(prevProps.readMarkerEventId);
            this.setState({
                ghostReadMarkers,
            });
        }

        const pendingEditItem = this.pendingEditItem;
        if (!this.props.editState && this.props.room && pendingEditItem) {
            const event = this.props.room.findEventById(pendingEditItem);
            defaultDispatcher.dispatch({
                action: Action.EditEvent,
                event: !event?.isRedacted() ? event : null,
                timelineRenderingType: this.context.timelineRenderingType,
            });
        }
    }

    private shouldHideSender(): boolean {
        return (
            !!this.props.room &&
            this.props.room.getInvitedAndJoinedMemberCount() <= 2 &&
            this.props.layout === Layout.Bubble
        );
    }

    private calculateRoomMembersCount = (): void => {
        this.setState({
            hideSender: this.shouldHideSender(),
        });
    };

    private onShowTypingNotificationsChange = (): void => {
        this.setState({
            showTypingNotifications: SettingsStore.getValue("showTypingNotifications"),
        });
    };

    /* get the DOM node representing the given event */
    public getNodeForEventId(eventId: string): HTMLElement | undefined {
        if (!this.eventTiles) {
            return undefined;
        }

        return this.eventTiles[eventId]?.ref?.current ?? undefined;
    }

    public getTileForEventId(eventId?: string): UnwrappedEventTile | undefined {
        if (!this.eventTiles || !eventId) {
            return undefined;
        }
        return this.eventTiles[eventId];
    }

    /* return true if the content is fully scrolled down right now; else false.
     */
    public isAtBottom(): boolean | undefined {
        return this.scrollPanel.current?.isAtBottom();
    }

    /* get the current scroll state. See ScrollPanel.getScrollState for
     * details.
     *
     * returns null if we are not mounted.
     */
    public getScrollState(): IScrollState | null {
        return this.scrollPanel.current?.getScrollState() ?? null;
    }

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is within the window
    //  +1: read marker is below the window
    public getReadMarkerPosition(): number | null {
        const readMarker = this.readMarkerNode.current;
        const messageWrapper = this.scrollPanel.current?.divScroll;

        if (!readMarker || !messageWrapper) {
            return null;
        }

        const wrapperRect = messageWrapper.getBoundingClientRect();
        const readMarkerRect = readMarker.getBoundingClientRect();

        // the read-marker pretends to have zero height when it is actually
        // two pixels high; +2 here to account for that.
        if (readMarkerRect.bottom + 2 < wrapperRect.top) {
            return -1;
        } else if (readMarkerRect.top < wrapperRect.bottom) {
            return 0;
        } else {
            return 1;
        }
    }

    /* jump to the top of the content.
     */
    public scrollToTop(): void {
        this.scrollPanel.current?.scrollToTop();
    }

    /* jump to the bottom of the content.
     */
    public scrollToBottom(): void {
        this.scrollPanel.current?.scrollToBottom();
    }

    /**
     * Scroll up/down in response to a scroll key
     *
     * @param {KeyboardEvent} ev: the keyboard event to handle
     */
    public handleScrollKey(ev: React.KeyboardEvent | KeyboardEvent): void {
        this.scrollPanel.current?.handleScrollKey(ev);
    }

    /* jump to the given event id.
     *
     * offsetBase gives the reference point for the pixelOffset. 0 means the
     * top of the container, 1 means the bottom, and fractional values mean
     * somewhere in the middle. If omitted, it defaults to 0.
     *
     * pixelOffset gives the number of pixels *above* the offsetBase that the
     * node (specifically, the bottom of it) will be positioned. If omitted, it
     * defaults to 0.
     */
    public scrollToEvent(eventId: string, pixelOffset?: number, offsetBase?: number): void {
        this.scrollPanel.current?.scrollToToken(eventId, pixelOffset, offsetBase);
    }

    public scrollToEventIfNeeded(eventId: string): void {
        const node = this.getNodeForEventId(eventId);
        if (node) {
            node.scrollIntoView({
                block: "nearest",
                behavior: "instant",
            });
        }
    }

    private isUnmounting = (): boolean => {
        return this.unmounted;
    };

    public get showHiddenEvents(): boolean {
        return this.context?.showHiddenEvents ?? this._showHiddenEvents;
    }

    // TODO: Implement granular (per-room) hide options
    public shouldShowEvent(mxEv: MatrixEvent, forceHideEvents = false): boolean {
        if (this.props.hideThreadedMessages && this.props.room) {
            const { shouldLiveInRoom } = this.props.room.eventShouldLiveIn(mxEv, this.props.events);
            if (!shouldLiveInRoom) {
                return false;
            }
        }

        if (MatrixClientPeg.safeGet().isUserIgnored(mxEv.getSender()!)) {
            return false; // ignored = no show (only happens if the ignore happens after an event was received)
        }

        if (this.showHiddenEvents && !forceHideEvents) {
            return true;
        }

        if (!haveRendererForEvent(mxEv, MatrixClientPeg.safeGet(), this.showHiddenEvents)) {
            return false; // no tile = no show
        }

        // Always show highlighted event
        if (this.props.highlightedEventId === mxEv.getId()) return true;

        return !shouldHideEvent(mxEv, this.context);
    }

    public readMarkerForEvent(eventId: string, isLastEvent: boolean): ReactNode {
        if (this.context.timelineRenderingType === TimelineRenderingType.File) return null;

        const visible = !isLastEvent && this.props.readMarkerVisible;

        if (this.props.readMarkerEventId === eventId) {
            let hr;
            // if the read marker comes at the end of the timeline (except
            // for local echoes, which are excluded from RMs, because they
            // don't have useful event ids), we don't want to show it, but
            // we still want to create the <li/> for it so that the
            // algorithms which depend on its position on the screen aren't
            // confused.
            if (visible) {
                hr = <hr style={{ opacity: 1, width: "99%" }} />;
            }

            return (
                <li
                    key={"readMarker_" + eventId}
                    ref={this.readMarkerNode}
                    className="mx_MessagePanel_myReadMarker"
                    data-scroll-tokens={eventId}
                >
                    {hr}
                </li>
            );
        } else if (this.state.ghostReadMarkers.includes(eventId)) {
            // We render 'ghost' read markers in the DOM while they
            // transition away. This allows the actual read marker
            // to be in the right place straight away without having
            // to wait for the transition to finish.
            // There are probably much simpler ways to do this transition,
            // possibly using react-transition-group which handles keeping
            // elements in the DOM whilst they transition out, although our
            // case is a little more complex because only some of the items
            // transition (ie. the read markers do but the event tiles do not)
            // and TransitionGroup requires that all its children are Transitions.
            const hr = (
                <hr
                    ref={this.collectGhostReadMarker}
                    onTransitionEnd={this.onGhostTransitionEnd}
                    data-eventid={eventId}
                />
            );

            // give it a key which depends on the event id. That will ensure that
            // we get a new DOM node (restarting the animation) when the ghost
            // moves to a different event.
            return (
                <li key={"_readuptoghost_" + eventId} className="mx_MessagePanel_myReadMarker">
                    {hr}
                </li>
            );
        }

        return null;
    }

    private collectGhostReadMarker = (node: HTMLElement | null): void => {
        if (node) {
            // now the element has appeared, change the style which will trigger the CSS transition
            requestAnimationFrame(() => {
                node.style.width = "10%";
                node.style.opacity = "0";
            });
        }
    };

    private onGhostTransitionEnd = (ev: TransitionEvent): void => {
        // we can now clean up the ghost element
        const finishedEventId = (ev.target as HTMLElement).dataset.eventid;
        this.setState({
            ghostReadMarkers: this.state.ghostReadMarkers.filter((eid) => eid !== finishedEventId),
        });
    };

    /**
     * Find the next event in the list, and the next visible event in the list.
     *
     * @param events     - the list of events to look in and whether they are shown
     * @param i          - where in the list we are now
     *
     * @returns { nextEvent, nextTile }
     *
     * nextEvent is the event after i in the supplied array.
     *
     * nextTile is the first event in the array after i that we will show a tile
     * for. It is used to to determine the 'last successful' flag when rendering
     * the tile.
     */
    private getNextEventInfo(
        events: WrappedEvent[],
        i: number,
    ): { nextEventAndShouldShow: WrappedEvent | null; nextTile: MatrixEvent | null } {
        // WARNING: this method is on a hot path.

        const nextEventAndShouldShow = i < events.length - 1 ? events[i + 1] : null;

        const nextTile = findFirstShownAfter(i, events);

        return { nextEventAndShouldShow, nextTile };
    }

    private get pendingEditItem(): string | null {
        if (!this.props.room) {
            return null;
        }

        try {
            return localStorage.getItem(editorRoomKey(this.props.room.roomId, this.context.timelineRenderingType));
        } catch (err) {
            logger.error(err);
            return null;
        }
    }

    private isSentState(ev: MatrixEvent): boolean {
        const status = ev.getAssociatedStatus();
        // A falsey state applies to events which have come down sync, including remote echoes
        return !status || status === EventStatus.SENT;
    }

    private getEventTiles(): ReactNode[] {
        // first figure out which is the last event in the list which we're
        // actually going to show; this allows us to behave slightly
        // differently for the last event in the list. (eg show timestamp)
        //
        // we also need to figure out which is the last event we show which isn't
        // a local echo, to manage the read-marker.
        let lastShownEvent: MatrixEvent | undefined;
        const events: WrappedEvent[] = this.props.events.map((event) => {
            return { event, shouldShow: this.shouldShowEvent(event) };
        });

        const userId = MatrixClientPeg.safeGet().getSafeUserId();

        let foundLastSuccessfulEvent = false;
        let lastShownNonLocalEchoIndex = -1;
        // Find the indices of the last successful event we sent and the last non-local-echo events shown
        for (let i = events.length - 1; i >= 0; i--) {
            const { event, shouldShow } = events[i];
            if (!shouldShow) {
                continue;
            }

            if (lastShownEvent === undefined) {
                lastShownEvent = event;
            }

            if (!foundLastSuccessfulEvent && this.isSentState(event) && isEligibleForSpecialReceipt(event)) {
                foundLastSuccessfulEvent = true;
                // If we are not sender of this last successful event eligible for special receipt then we stop here
                // As we do not want to render our sent receipt if there are more receipts below it and events sent
                // by other users get a synthetic read receipt for their sent events.
                if (event.getSender() === userId) {
                    events[i].lastSuccessfulWeSent = true;
                }
            }

            if (lastShownNonLocalEchoIndex < 0 && !event.status) {
                lastShownNonLocalEchoIndex = i;
            }

            if (lastShownNonLocalEchoIndex >= 0 && foundLastSuccessfulEvent) {
                break;
            }
        }

        const ret: ReactNode[] = [];
        let prevEvent: MatrixEvent | null = null; // the last event we showed

        // Note: the EventTile might still render a "sent/sending receipt" independent of
        // this information. When not providing read receipt information, the tile is likely
        // to assume that sent receipts are to be shown more often.
        this.readReceiptsByEvent = new Map();
        if (this.props.showReadReceipts) {
            this.readReceiptsByEvent = this.getReadReceiptsByShownEvent(events);
        }

        let grouper: BaseGrouper | null = null;

        for (let i = 0; i < events.length; i++) {
            const wrappedEvent = events[i];
            const { event, shouldShow } = wrappedEvent;
            const eventId = event.getId()!;
            const last = event === lastShownEvent;
            const { nextEventAndShouldShow, nextTile } = this.getNextEventInfo(events, i);

            if (grouper) {
                if (grouper.shouldGroup(wrappedEvent)) {
                    grouper.add(wrappedEvent);
                    continue;
                } else {
                    // not part of group, so get the group tiles, close the
                    // group, and continue like a normal event
                    ret.push(...grouper.getTiles());
                    prevEvent = grouper.getNewPrevEvent();
                    grouper = null;
                }
            }

            for (const Grouper of groupers) {
                if (Grouper.canStartGroup(this, wrappedEvent) && !this.props.disableGrouping) {
                    grouper = new Grouper(
                        this,
                        wrappedEvent,
                        prevEvent,
                        lastShownEvent,
                        nextEventAndShouldShow,
                        nextTile,
                    );
                    break; // break on first grouper
                }
            }

            if (!grouper) {
                if (shouldShow) {
                    // make sure we unpack the array returned by getTilesForEvent,
                    // otherwise React will auto-generate keys, and we will end up
                    // replacing all the DOM elements every time we paginate.
                    ret.push(
                        ...this.getTilesForEvent(
                            prevEvent,
                            wrappedEvent,
                            last,
                            false,
                            nextEventAndShouldShow,
                            nextTile,
                        ),
                    );
                    prevEvent = event;
                }

                const readMarker = this.readMarkerForEvent(eventId, i >= lastShownNonLocalEchoIndex);
                if (readMarker) ret.push(readMarker);
            }
        }

        if (grouper) {
            ret.push(...grouper.getTiles());
        }

        return ret;
    }

    public getTilesForEvent(
        prevEvent: MatrixEvent | null,
        wrappedEvent: WrappedEvent,
        last = false,
        isGrouped = false,
        nextEvent: WrappedEvent | null = null,
        nextEventWithTile: MatrixEvent | null = null,
    ): ReactNode[] {
        const mxEv = wrappedEvent.event;
        const ret: ReactNode[] = [];

        const isEditing = this.props.editState?.getEvent().getId() === mxEv.getId();
        // local echoes have a fake date, which could even be yesterday. Treat them as 'today' for the date separators.
        const ts1 = mxEv.getTs() ?? Date.now();

        // do we need a separator since the last event?
        const wantsSeparator = this.wantsSeparator(prevEvent, mxEv);
        if (!isGrouped && this.props.room) {
            if (wantsSeparator === SeparatorKind.Date) {
                ret.push(
                    <li key={ts1}>
                        <DateSeparator key={ts1} roomId={this.props.room.roomId} ts={ts1} />
                    </li>,
                );
            } else if (wantsSeparator === SeparatorKind.LateEvent) {
                const text = _t("timeline|late_event_separator", {
                    dateTime: formatDate(mxEv.getDate() ?? new Date()),
                });
                ret.push(
                    <li key={ts1}>
                        <TimelineSeparator key={ts1} label={text}>
                            {text}
                        </TimelineSeparator>
                    </li>,
                );
            }
        }

        const cli = MatrixClientPeg.safeGet();
        let lastInSection = true;
        if (nextEventWithTile) {
            const nextEv = nextEventWithTile;
            const willWantSeparator = this.wantsSeparator(mxEv, nextEv);
            lastInSection =
                willWantSeparator === SeparatorKind.Date ||
                mxEv.getSender() !== nextEv.getSender() ||
                getEventDisplayInfo(cli, nextEv, this.showHiddenEvents).isInfoMessage ||
                !shouldFormContinuation(mxEv, nextEv, cli, this.showHiddenEvents, this.context.timelineRenderingType);
        }

        // is this a continuation of the previous message?
        const continuation =
            wantsSeparator === SeparatorKind.None &&
            shouldFormContinuation(prevEvent, mxEv, cli, this.showHiddenEvents, this.context.timelineRenderingType);

        const eventId = mxEv.getId()!;
        const highlight = eventId === this.props.highlightedEventId;

        const readReceipts = this.readReceiptsByEvent.get(eventId);

        const callEventGrouper = this.props.callEventGroupers.get(mxEv.getContent().call_id);
        // use txnId as key if available so that we don't remount during sending
        ret.push(
            <EventTile
                key={mxEv.getTxnId() || eventId}
                as="li"
                ref={this.collectEventTile.bind(this, eventId)}
                alwaysShowTimestamps={this.props.alwaysShowTimestamps}
                mxEvent={mxEv}
                continuation={continuation}
                isRedacted={mxEv.isRedacted()}
                replacingEventId={mxEv.replacingEventId()}
                editState={isEditing ? this.props.editState : undefined}
                onHeightChanged={this.onHeightChanged}
                readReceipts={readReceipts}
                readReceiptMap={this.readReceiptMap}
                showUrlPreview={this.props.showUrlPreview}
                checkUnmounting={this.isUnmounting}
                eventSendStatus={mxEv.getAssociatedStatus() ?? undefined}
                isTwelveHour={this.props.isTwelveHour}
                permalinkCreator={this.props.permalinkCreator}
                last={last}
                lastInSection={lastInSection}
                lastSuccessful={wrappedEvent.lastSuccessfulWeSent}
                isSelectedEvent={highlight}
                getRelationsForEvent={this.props.getRelationsForEvent}
                showReactions={this.props.showReactions}
                layout={this.props.layout}
                showReadReceipts={this.props.showReadReceipts}
                callEventGrouper={callEventGrouper}
                hideSender={this.state.hideSender}
            />,
        );

        return ret;
    }

    public wantsSeparator(prevEvent: MatrixEvent | null, mxEvent: MatrixEvent): SeparatorKind {
        if (this.context.timelineRenderingType === TimelineRenderingType.ThreadsList) {
            return SeparatorKind.None;
        }

        if (prevEvent !== null) {
            // If the previous event was late but current is not then show a date separator for orientation
            // Otherwise if the current event is of a different late group than the previous show a late event separator
            const lateEventInfo = getLateEventInfo(mxEvent);
            if (lateEventInfo?.group_id !== getLateEventInfo(prevEvent)?.group_id) {
                return lateEventInfo !== undefined ? SeparatorKind.LateEvent : SeparatorKind.Date;
            }
        }

        // first event in the panel: depends on if we could back-paginate from here.
        if (prevEvent === null && !this.props.canBackPaginate) {
            return SeparatorKind.Date;
        }

        const nextEventDate = mxEvent.getDate() ?? new Date();
        if (prevEvent !== null && wantsDateSeparator(prevEvent.getDate() || undefined, nextEventDate)) {
            return SeparatorKind.Date;
        }

        return SeparatorKind.None;
    }

    // Get a list of read receipts that should be shown next to this event
    // Receipts are objects which have a 'userId', 'roomMember' and 'ts'.
    private getReadReceiptsForEvent(event: MatrixEvent): IReadReceiptProps[] | null {
        const myUserId = MatrixClientPeg.safeGet().credentials.userId;

        // get list of read receipts, sorted most recent first
        const { room } = this.props;
        if (!room) {
            return null;
        }

        const receiptDestination = this.context.threadId ? room.getThread(this.context.threadId) : room;

        const receipts: IReadReceiptProps[] = [];

        if (!receiptDestination) {
            logger.debug(
                "Discarding request, could not find the receiptDestination for event: " + this.context.threadId,
            );
            return receipts;
        }

        receiptDestination.getReceiptsForEvent(event).forEach((r) => {
            if (!r.userId || !isSupportedReceiptType(r.type) || r.userId === myUserId) {
                return; // ignore non-read receipts and receipts from self.
            }
            if (MatrixClientPeg.safeGet().isUserIgnored(r.userId)) {
                return; // ignore ignored users
            }
            const member = room.getMember(r.userId);
            receipts.push({
                userId: r.userId,
                roomMember: member,
                ts: r.data ? r.data.ts : 0,
            });
        });
        return receipts;
    }

    // Get an object that maps from event ID to a list of read receipts that
    // should be shown next to that event. If a hidden event has read receipts,
    // they are folded into the receipts of the last shown event.
    private getReadReceiptsByShownEvent(events: WrappedEvent[]): Map<string, IReadReceiptProps[]> {
        const receiptsByEvent: Map<string, IReadReceiptProps[]> = new Map();
        const receiptsByUserId: Map<string, IReadReceiptForUser> = new Map();

        let lastShownEventId: string | undefined;
        for (const event of this.props.events) {
            if (this.shouldShowEvent(event)) {
                lastShownEventId = event.getId();
            }
            if (!lastShownEventId) {
                continue;
            }

            const existingReceipts = receiptsByEvent.get(lastShownEventId) || [];
            const newReceipts = this.getReadReceiptsForEvent(event);
            if (!newReceipts) continue;
            receiptsByEvent.set(lastShownEventId, existingReceipts.concat(newReceipts));

            // Record these receipts along with their last shown event ID for
            // each associated user ID.
            for (const receipt of newReceipts) {
                receiptsByUserId.set(receipt.userId, {
                    lastShownEventId,
                    receipt,
                });
            }
        }

        // It's possible in some cases (for example, when a read receipt
        // advances before we have paginated in the new event that it's marking
        // received) that we can temporarily not have a matching event for
        // someone which had one in the last. By looking through our previous
        // mapping of receipts by user ID, we can cover recover any receipts
        // that would have been lost by using the same event ID from last time.
        for (const userId of this.readReceiptsByUserId.keys()) {
            if (receiptsByUserId.get(userId)) {
                continue;
            }
            const { lastShownEventId, receipt } = this.readReceiptsByUserId.get(userId)!;
            const existingReceipts = receiptsByEvent.get(lastShownEventId) || [];
            receiptsByEvent.set(lastShownEventId, existingReceipts.concat(receipt));
            receiptsByUserId.set(userId, { lastShownEventId, receipt });
        }
        this.readReceiptsByUserId = receiptsByUserId;

        // After grouping receipts by shown events, do another pass to sort each
        // receipt list.
        for (const receipts of receiptsByEvent.values()) {
            receipts.sort((r1, r2) => {
                return r2.ts - r1.ts;
            });
        }

        return receiptsByEvent;
    }

    private collectEventTile = (eventId: string, node: UnwrappedEventTile): void => {
        this.eventTiles[eventId] = node;
    };

    // once dynamic content in the events load, make the scrollPanel check the
    // scroll offsets.
    public onHeightChanged = (): void => {
        const scrollPanel = this.scrollPanel.current;
        if (scrollPanel) {
            scrollPanel.checkScroll();
        }
    };

    private onTypingShown = (): void => {
        const scrollPanel = this.scrollPanel.current;
        // this will make the timeline grow, so checkScroll
        scrollPanel?.checkScroll();
        if (scrollPanel && scrollPanel.getScrollState().stuckAtBottom) {
            scrollPanel.preventShrinking();
        }
    };

    private onTypingHidden = (): void => {
        const scrollPanel = this.scrollPanel.current;
        if (scrollPanel) {
            // as hiding the typing notifications doesn't
            // update the scrollPanel, we tell it to apply
            // the shrinking prevention once the typing notifs are hidden
            scrollPanel.updatePreventShrinking();
            // order is important here as checkScroll will scroll down to
            // reveal added padding to balance the notifs disappearing.
            scrollPanel.checkScroll();
        }
    };

    public updateTimelineMinHeight(): void {
        const scrollPanel = this.scrollPanel.current;

        if (scrollPanel) {
            const isAtBottom = scrollPanel.isAtBottom();
            const whoIsTyping = this.whoIsTyping.current;
            const isTypingVisible = whoIsTyping && whoIsTyping.isVisible();
            // when messages get added to the timeline,
            // but somebody else is still typing,
            // update the min-height, so once the last
            // person stops typing, no jumping occurs
            if (isAtBottom && isTypingVisible) {
                scrollPanel.preventShrinking();
            }
        }
    }

    public onTimelineReset(): void {
        const scrollPanel = this.scrollPanel.current;
        if (scrollPanel) {
            scrollPanel.clearPreventShrinking();
        }
    }

    public render(): React.ReactNode {
        let topSpinner;
        let bottomSpinner;
        if (this.props.backPaginating) {
            topSpinner = (
                <li key="_topSpinner">
                    <Spinner />
                </li>
            );
        }
        if (this.props.forwardPaginating) {
            bottomSpinner = (
                <li key="_bottomSpinner">
                    <Spinner />
                </li>
            );
        }

        const style = this.props.hidden ? { display: "none" } : {};

        let whoIsTyping;
        if (
            this.props.room &&
            this.state.showTypingNotifications &&
            this.context.timelineRenderingType === TimelineRenderingType.Room
        ) {
            whoIsTyping = (
                <WhoIsTypingTile
                    room={this.props.room}
                    onShown={this.onTypingShown}
                    onHidden={this.onTypingHidden}
                    ref={this.whoIsTyping}
                />
            );
        }

        let ircResizer: JSX.Element | undefined;
        if (this.props.layout == Layout.IRC) {
            ircResizer = (
                <IRCTimelineProfileResizer minWidth={20} maxWidth={600} roomId={this.props.room?.roomId ?? null} />
            );
        }

        const classes = classNames(this.props.className, {
            mx_MessagePanel_narrow: this.context.narrow,
        });

        return (
            <ErrorBoundary>
                <ScrollPanel
                    ref={this.scrollPanel}
                    className={classes}
                    onScroll={this.props.onScroll}
                    onFillRequest={this.props.onFillRequest}
                    onUnfillRequest={this.props.onUnfillRequest}
                    style={style}
                    stickyBottom={this.props.stickyBottom}
                    resizeNotifier={this.props.resizeNotifier}
                    fixedChildren={ircResizer}
                >
                    {topSpinner}
                    {this.getEventTiles()}
                    {whoIsTyping}
                    {bottomSpinner}
                </ScrollPanel>
            </ErrorBoundary>
        );
    }
}

/**
 * Holds on to an event, caching the information about it in the context of the current messages list.
 * Avoids calling shouldShowEvent more times than we need to.
 * Simplifies threading of event context like whether it's the last successful event we sent which cannot be determined
 * by a consumer from the event alone, so has to be done by the event list processing code earlier.
 */
export interface WrappedEvent {
    event: MatrixEvent;
    shouldShow?: boolean;
    lastSuccessfulWeSent?: boolean;
}

// all the grouper classes that we use, ordered by priority
const groupers = [CreationGrouper, MainGrouper];

/**
 * Look through the supplied list of WrappedEvent, and return the first
 * event that is >start items through the list, and is shown.
 */
function findFirstShownAfter(start: number, events: WrappedEvent[]): MatrixEvent | null {
    // Note: this could be done with something like:
    // events.slice(i + 1).find((e) => e.shouldShow)?.event ?? null;
    // but it is ~10% slower, and this is on the critical path.

    for (let n = start + 1; n < events.length; n++) {
        const { event, shouldShow } = events[n];
        if (shouldShow) {
            return event;
        }
    }
    return null;
}
