/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useId,
    useMemo,
    useRef,
    useState,
    type FocusEvent,
    type JSX,
    type MouseEvent,
    type Ref,
    type RefObject,
} from "react";
import { ActionBarView, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import type { EventStatus, Relations, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import {
    EventTileViewModel,
    type EventTileViewModelProps,
    type EventTileViewSnapshot,
} from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import RoomContext from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
import PosthogTrackers from "../../../../PosthogTrackers";
import { copyPlaintext } from "../../../../utils/strings";
import { EventTileView, type EventTileViewProps } from "./EventTileView";
import { _t } from "../../../../languageHandler";
import PlatformPeg from "../../../../PlatformPeg";
import { Layout } from "../../../../settings/enums/Layout";
import type LegacyCallEventGrouper from "../../../structures/LegacyCallEventGrouper";
import RoomAvatar from "../../avatars/RoomAvatar";
import ThreadSummary, { ThreadMessagePreview } from "../ThreadSummary";
import { UnreadNotificationBadge } from "../NotificationBadge/UnreadNotificationBadge";
import { AvatarSize, AvatarSubject, ThreadInfoMode } from "../../../../models/rooms/EventTileModel";
import type ReplyChain from "../../elements/ReplyChain";
import type { ComposerInsertPayload } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { type IReadReceiptPosition } from "../ReadReceiptMarker";
import type { MessageBodyProps, MessageBodyRenderTileProps } from "./MessageBody";
import type {
    EventTileContextMenuState,
    EventTileOps,
    GetRelationsForEvent,
    ReadReceiptProps,
} from "./types";
import { ThreadInfo } from "./ThreadInfo";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import ContextMenu, { aboveLeftOf, aboveRightOf } from "../../../structures/ContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import { EventTileActionBarViewModel } from "../../../../viewmodels/room/timeline/event-tile/actions/EventTileActionBarViewModel";
import type { EventTileActionBarViewModelProps } from "../../../../viewmodels/room/timeline/event-tile/actions/EventTileActionBarViewModel";
import { ThreadListActionBarViewModel } from "../../../../viewmodels/room/ThreadListActionBarViewModel";
import type { ThreadListActionBarViewModelProps } from "../../../../viewmodels/room/ThreadListActionBarViewModel";
import { CardContext } from "../../right_panel/context";
import { Sender } from "./Sender";
import { Avatar } from "./Avatar";
import { ReplyPreview } from "./ReplyPreview";
import { MessageStatus } from "./MessageStatus";
import { Footer } from "./Footer";
import { MessageBody } from "./MessageBody";
import { type EventTileCommandDeps } from "./EventTileCommands";
import { EventTileErrorBoundary } from "./EventTileErrorBoundary";

/** Ref handle for direct access to tile actions and the root element. */
export interface EventTileHandle extends EventTileOps {
    /** Ref to the tile root DOM element. */
    ref: RefObject<HTMLElement | null>;
    /** Recomputes derived tile state without changing props. */
    forceUpdate(): void;
}

/** Core event identity and imperative ref inputs for the tile. */
interface EventTileCoreProps {
    /** The Matrix event represented by this tile. */
    mxEvent: MatrixEvent;
    /** Optional send-status override for locally pending events. */
    eventSendStatus?: EventStatus;
    /** Optional ref used to expose the tile handle to callers. */
    ref?: Ref<EventTileHandle>;
}

/** Rendering flags and layout options that shape tile presentation. */
interface EventTileRenderingProps {
    /** Optional root element tag name override. */
    as?: string;
    /** The active room layout variant. */
    layout?: Layout;
    /** Whether timestamps should use a twelve-hour clock. */
    isTwelveHour?: boolean;
    /** Whether the tile is being rendered for export rather than live interaction. */
    forExport?: boolean;
    /** Whether timestamps should remain visible even when the tile is idle. */
    alwaysShowTimestamps?: boolean;
    /** Whether the event should be treated as redacted for rendering purposes. */
    isRedacted?: boolean;
    /** Whether the tile continues the previous sender block visually. */
    continuation?: boolean;
    /** Whether this is the last visible tile in the current list. */
    last?: boolean;
    /** Whether this is the last tile in its grouped section. */
    lastInSection?: boolean;
    /** Whether this event is the most recent successfully sent event. */
    lastSuccessful?: boolean;
    /** Whether the tile is shown in a contextual timeline. */
    contextual?: boolean;
    /** Whether this tile corresponds to the selected event. */
    isSelectedEvent?: boolean;
    /** Whether sender information should be hidden. */
    hideSender?: boolean;
    /** Whether timestamp rendering should be hidden. */
    hideTimestamp?: boolean;
    /** Whether interactive affordances should be disabled. */
    inhibitInteraction?: boolean;
    /** Whether moderation-hidden content is currently being revealed. */
    isSeeingThroughMessageHiddenForModeration?: boolean;
    /** Whether URL preview rendering should be enabled for supported events. */
    showUrlPreview?: boolean;
    /** Highlight tokens to emphasize within the message body. */
    highlights?: string[];
    /** Link target used to highlight matching content inside the tile. */
    highlightLink?: string;
}

/** Relation and receipt inputs used to enrich tile rendering. */
interface EventTileRelationProps {
    /** Optional relation lookup function for the current event. */
    getRelationsForEvent?: GetRelationsForEvent;
    /** Whether reactions should be shown. */
    showReactions?: boolean;
    /** Whether read receipts should be shown when available. */
    showReadReceipts?: boolean;
    /** Read receipt entries available for the tile. */
    readReceipts?: ReadReceiptProps[];
    /** Precomputed read receipt positions keyed by user ID. */
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
}

/** Editing-related inputs for tiles that participate in composer state. */
interface EventTileEditingProps {
    /** Current edit-state transfer object associated with the event. */
    editState?: EditorStateTransfer;
    /** Event ID of the replacement event currently being composed. */
    replacingEventId?: string;
    /** Optional callback used by child components to detect unmounting during async work. */
    checkUnmounting?: () => boolean;
}

/** Optional environment helpers supplied by the surrounding room view. */
interface EventTileEnvironmentProps {
    /** Optional resize observer used to monitor the rendered tile root. */
    resizeObserver?: ResizeObserver;
    /** Optional permalink helper used to generate event links. */
    permalinkCreator?: RoomPermalinkCreator;
    /** Optional helper used to group legacy call events. */
    callEventGrouper?: LegacyCallEventGrouper;
}

/** Props for the tile implementation, excluding the optional error boundary wrapper flag. */
type EventTileBaseProps = EventTileCoreProps &
    EventTileRenderingProps &
    EventTileRelationProps &
    EventTileEditingProps &
    EventTileEnvironmentProps;

/** Props for {@link EventTile}. */
export interface EventTileProps extends EventTileBaseProps {
    /** Wraps the tile in {@link EventTileErrorBoundary}. Defaults to `true`. */
    withErrorBoundary?: boolean;
}

/** Event handlers and room data returned from `useEventTileCommands`. */
type UseEventTileCommandsResult = {
    room: Room | null;
    openInRoom: (_anchor: HTMLElement | null) => void;
    copyLinkToThread: (_anchor: HTMLElement | null) => Promise<void>;
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
    onContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    onTimestampContextMenu: (ev: MouseEvent<HTMLElement>) => void;
};

type EventTileContentNodes = {
    sender: JSX.Element;
    avatar: JSX.Element;
    replyChain?: JSX.Element;
    messageBody: JSX.Element;
    actionBar?: JSX.Element;
    messageStatus: JSX.Element;
    footer: JSX.Element;
};

type EventTileThreadNodes = {
    info?: JSX.Element;
    replyCount?: number;
    preview?: JSX.Element;
    toolbar?: JSX.Element;
};

type UseEventTileNodesArgs = {
    props: EventTileBaseProps;
    roomContext: React.ContextType<typeof RoomContext>;
    snapshot: EventTileViewSnapshot;
    tileRef: RefObject<EventTileOps | null>;
    replyChainRef: RefObject<ReplyChain | null>;
    suppressReadReceiptAnimation: boolean;
    tileContentId: string;
    vm: EventTileViewModel;
    onActionBarFocusChange: (focused: boolean) => void;
    toggleThreadExpanded: () => void;
    openInRoom: (_anchor: HTMLElement | null) => void;
    copyLinkToThread: (_anchor: HTMLElement | null) => void | Promise<void>;
};

type UseEventTileContextMenuNodeArgs = {
    props: EventTileBaseProps;
    snapshot: EventTileViewSnapshot;
    tileRef: RefObject<EventTileOps | null>;
    replyChainRef: RefObject<ReplyChain | null>;
    vm: EventTileViewModel;
};

type ActionBarHostProps = {
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    isQuoteExpanded?: boolean;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFocusChange: (focused: boolean) => void;
    toggleThreadExpanded: () => void;
};

type ThreadToolbarHostProps = {
    onViewInRoomClick: (anchor: HTMLElement | null) => void;
    onCopyLinkClick: (anchor: HTMLElement | null) => void | Promise<void>;
};

type EventTileContextMenuHostProps = {
    contextMenu: EventTileContextMenuState;
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFinished: () => void;
};

function buildEventTileViewModelProps(
    props: EventTileBaseProps,
    readReceipts: EventTileViewModelProps["readReceipts"],
    cli: ReturnType<typeof useMatrixClientContext>,
    commandDeps: EventTileViewModelProps["commandDeps"],
    roomContext: Pick<
        React.ContextType<typeof RoomContext>,
        "timelineRenderingType" | "isRoomEncrypted" | "showHiddenEvents"
    >,
): EventTileViewModelProps {
    return {
        mxEvent: props.mxEvent,
        eventSendStatus: props.eventSendStatus,
        editState: props.editState,
        permalinkCreator: props.permalinkCreator,
        callEventGrouper: props.callEventGrouper,
        forExport: props.forExport,
        layout: props.layout,
        isTwelveHour: props.isTwelveHour,
        alwaysShowTimestamps: props.alwaysShowTimestamps,
        isRedacted: props.isRedacted,
        continuation: props.continuation,
        last: props.last,
        lastInSection: props.lastInSection,
        contextual: props.contextual,
        isSelectedEvent: props.isSelectedEvent,
        hideSender: props.hideSender,
        hideTimestamp: props.hideTimestamp,
        inhibitInteraction: props.inhibitInteraction,
        highlightLink: props.highlightLink,
        showReactions: props.showReactions,
        getRelationsForEvent: props.getRelationsForEvent,
        readReceipts,
        showReadReceipts: props.showReadReceipts,
        lastSuccessful: props.lastSuccessful,
        commandDeps,
        cli,
        timelineRenderingType: roomContext.timelineRenderingType,
        isRoomEncrypted: Boolean(roomContext.isRoomEncrypted),
        showHiddenEvents: roomContext.showHiddenEvents,
    };
}

function getAvatarMember(props: EventTileBaseProps, avatarSubject: AvatarSubject): RoomMember | null {
    switch (avatarSubject) {
        case AvatarSubject.Target:
            return props.mxEvent.target;
        case AvatarSubject.Sender:
            return props.mxEvent.sender;
        case AvatarSubject.None:
        default:
            return null;
    }
}

function useEventTileCommands(
    props: EventTileBaseProps,
    cli: ReturnType<typeof useMatrixClientContext>,
    vm: EventTileViewModel,
): UseEventTileCommandsResult {
    const roomId = props.mxEvent.getRoomId();
    const room = roomId ? cli.getRoom(roomId) : null;

    const onPermalinkClicked = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            vm.onPermalinkClicked(ev);
        },
        [vm],
    );
    const openInRoom = useCallback(
        (_anchor: HTMLElement | null): void => {
            vm.openInRoom();
        },
        [vm],
    );
    const copyLinkToThread = useCallback(
        async (_anchor: HTMLElement | null): Promise<void> => {
            await vm.copyLinkToThread();
        },
        [vm],
    );
    const onContextMenu = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            vm.openContextMenu(ev);
        },
        [vm],
    );
    const onTimestampContextMenu = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            const eventId = props.mxEvent.getId();
            vm.openContextMenu(ev, eventId ? props.permalinkCreator?.forEvent(eventId) : undefined);
        },
        [vm, props.permalinkCreator, props.mxEvent],
    );
    const onListTileClick = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            const target = ev.currentTarget;
            let index = -1;
            if (target.parentElement) index = Array.from(target.parentElement.children).indexOf(target);

            vm.onListTileClick(ev.nativeEvent, index);
        },
        [vm],
    );

    return useMemo(
        () => ({
            room,
            onPermalinkClicked,
            openInRoom,
            copyLinkToThread,
            onContextMenu,
            onTimestampContextMenu,
            onListTileClick,
        }),
        [
            room,
            onPermalinkClicked,
            openInRoom,
            copyLinkToThread,
            onContextMenu,
            onTimestampContextMenu,
            onListTileClick,
        ],
    );
}

function useEventTileNodes({
    props,
    roomContext,
    snapshot,
    tileRef,
    replyChainRef,
    suppressReadReceiptAnimation,
    tileContentId,
    vm,
    onActionBarFocusChange,
    toggleThreadExpanded,
    openInRoom,
    copyLinkToThread,
}: UseEventTileNodesArgs): { content: EventTileContentNodes; thread: EventTileThreadNodes } {
    const avatarMember = getAvatarMember(props, snapshot.avatarSubject);
    const onSenderProfileClick = useCallback((): void => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: props.mxEvent.getSender()!,
            timelineRenderingType: roomContext.timelineRenderingType,
        });
    }, [props.mxEvent, roomContext.timelineRenderingType]);
    const setQuoteExpanded = useCallback(
        (expanded: boolean): void => {
            vm.setQuoteExpanded(expanded);
        },
        [vm],
    );
    const renderTileProps = useMemo<MessageBodyRenderTileProps>(
        () => ({
            mxEvent: props.mxEvent,
            forExport: props.forExport,
            showUrlPreview: props.showUrlPreview,
            highlights: props.highlights,
            highlightLink: props.highlightLink,
            getRelationsForEvent: props.getRelationsForEvent,
            editState: props.editState,
            replacingEventId: props.replacingEventId,
            callEventGrouper: props.callEventGrouper,
            inhibitInteraction: props.inhibitInteraction,
        }),
        [
            props.mxEvent,
            props.forExport,
            props.showUrlPreview,
            props.highlights,
            props.highlightLink,
            props.getRelationsForEvent,
            props.editState,
            props.replacingEventId,
            props.callEventGrouper,
            props.inhibitInteraction,
        ],
    );
    const replyChain = useMemo(
        () =>
            snapshot.shouldRenderReplyPreview ? (
                <ReplyPreview
                    mxEvent={props.mxEvent}
                    forExport={props.forExport}
                    permalinkCreator={props.permalinkCreator}
                    layout={props.layout}
                    alwaysShowTimestamps={props.alwaysShowTimestamps}
                    getRelationsForEvent={props.getRelationsForEvent}
                    isQuoteExpanded={snapshot.isQuoteExpanded}
                    replyChainRef={replyChainRef}
                    setQuoteExpanded={setQuoteExpanded}
                />
            ) : undefined,
        [
            snapshot.shouldRenderReplyPreview,
            props.mxEvent,
            props.forExport,
            props.permalinkCreator,
            props.layout,
            props.alwaysShowTimestamps,
            props.getRelationsForEvent,
            snapshot.isQuoteExpanded,
            replyChainRef,
            setQuoteExpanded,
        ],
    );
    const actionBar = useMemo(
        () =>
            snapshot.shouldRenderActionBar ? (
                <EventTileActionBarHost
                    mxEvent={props.mxEvent}
                    permalinkCreator={props.permalinkCreator}
                    getRelationsForEvent={props.getRelationsForEvent}
                    reactions={snapshot.reactions}
                    isQuoteExpanded={snapshot.isQuoteExpanded}
                    tileRef={tileRef}
                    replyChainRef={replyChainRef}
                    onFocusChange={onActionBarFocusChange}
                    toggleThreadExpanded={toggleThreadExpanded}
                />
            ) : undefined,
        [
            snapshot.shouldRenderActionBar,
            props.mxEvent,
            props.permalinkCreator,
            props.getRelationsForEvent,
            snapshot.reactions,
            snapshot.isQuoteExpanded,
            tileRef,
            replyChainRef,
            onActionBarFocusChange,
            toggleThreadExpanded,
        ],
    );
    const sender = useMemo(
        () => <Sender mode={snapshot.senderMode} mxEvent={props.mxEvent} onClick={onSenderProfileClick} />,
        [snapshot.senderMode, props.mxEvent, onSenderProfileClick],
    );
    const avatar = useMemo(
        () => (
            <Avatar
                member={avatarMember}
                size={snapshot.avatarSize}
                viewUserOnClick={snapshot.avatarMemberUserOnClick}
                forceHistorical={snapshot.avatarForceHistorical}
            />
        ),
        [avatarMember, snapshot.avatarSize, snapshot.avatarMemberUserOnClick, snapshot.avatarForceHistorical],
    );
    const messageStatus = useMemo(
        () => (
            <MessageStatus
                messageState={props.eventSendStatus}
                shouldShowSentReceipt={snapshot.shouldShowSentReceipt}
                shouldShowSendingReceipt={snapshot.shouldShowSendingReceipt}
                showReadReceipts={snapshot.showReadReceipts}
                readReceipts={props.readReceipts}
                readReceiptMap={props.readReceiptMap}
                checkUnmounting={props.checkUnmounting}
                isTwelveHour={props.isTwelveHour}
                suppressReadReceiptAnimation={suppressReadReceiptAnimation}
            />
        ),
        [
            props.eventSendStatus,
            snapshot.shouldShowSentReceipt,
            snapshot.shouldShowSendingReceipt,
            snapshot.showReadReceipts,
            props.readReceipts,
            props.readReceiptMap,
            props.checkUnmounting,
            props.isTwelveHour,
            suppressReadReceiptAnimation,
        ],
    );
    const footer = useMemo(
        () => (
            <div className="mx_EventTile_footer">
                <Footer
                    layout={props.layout}
                    mxEvent={props.mxEvent}
                    isRedacted={props.isRedacted}
                    isPinned={snapshot.isPinned}
                    isOwnEvent={snapshot.isOwnEvent}
                    reactions={snapshot.reactions}
                    tileContentId={tileContentId}
                />
            </div>
        ),
        [
            props.layout,
            props.mxEvent,
            props.isRedacted,
            snapshot.isPinned,
            snapshot.isOwnEvent,
            snapshot.reactions,
            tileContentId,
        ],
    );
    const messageBodyProps = useMemo<MessageBodyProps>(
        () => ({
            mxEvent: props.mxEvent,
            isDecryptionFailure: snapshot.isEncryptionFailure,
            timelineRenderingType: roomContext.timelineRenderingType,
            tileRenderType: snapshot.tileRenderType,
            isSeeingThroughMessageHiddenForModeration: snapshot.isSeeingThroughMessageHiddenForModeration,
            renderTileProps,
            tileRef,
            permalinkCreator: props.permalinkCreator,
            showHiddenEvents: roomContext.showHiddenEvents,
        }),
        [
            props.mxEvent,
            snapshot.isEncryptionFailure,
            roomContext.timelineRenderingType,
            snapshot.tileRenderType,
            snapshot.isSeeingThroughMessageHiddenForModeration,
            renderTileProps,
            tileRef,
            props.permalinkCreator,
            roomContext.showHiddenEvents,
        ],
    );
    const messageBody = useMemo(() => <MessageBody {...messageBodyProps} />, [messageBodyProps]);
    const info = useMemo(
        () =>
            snapshot.threadInfoMode === ThreadInfoMode.None ? undefined : (
                <ThreadInfo
                    summary={
                        snapshot.threadInfoMode === ThreadInfoMode.Summary ? (
                            <ThreadSummary
                                key={snapshot.threadUpdateKey}
                                mxEvent={props.mxEvent}
                                thread={snapshot.thread!}
                                data-testid="thread-summary"
                            />
                        ) : undefined
                    }
                    href={snapshot.threadInfoHref}
                    label={snapshot.threadInfoLabel}
                />
            ),
        [
            snapshot.threadInfoMode,
            snapshot.threadUpdateKey,
            props.mxEvent,
            snapshot.thread,
            snapshot.threadInfoHref,
            snapshot.threadInfoLabel,
        ],
    );
    const preview = useMemo(
        () =>
            snapshot.shouldRenderThreadPreview && snapshot.thread ? (
                <ThreadMessagePreview key={snapshot.threadUpdateKey} thread={snapshot.thread} />
            ) : undefined,
        [snapshot.shouldRenderThreadPreview, snapshot.thread, snapshot.threadUpdateKey],
    );
    const toolbar = useMemo(
        () =>
            snapshot.shouldRenderThreadToolbar ? (
                <ThreadToolbarHost onViewInRoomClick={openInRoom} onCopyLinkClick={copyLinkToThread} />
            ) : undefined,
        [snapshot.shouldRenderThreadToolbar, openInRoom, copyLinkToThread],
    );

    return useMemo(
        () => ({
            content: {
                sender,
                avatar,
                replyChain,
                messageBody,
                actionBar,
                messageStatus,
                footer,
            },
            thread: {
                info,
                replyCount: snapshot.threadReplyCount,
                preview,
                toolbar,
            },
        }),
        [
            sender,
            avatar,
            replyChain,
            messageBody,
            actionBar,
            messageStatus,
            footer,
            info,
            snapshot.threadReplyCount,
            preview,
            toolbar,
        ],
    );
}

function useEventTileContextMenuNode({
    props,
    snapshot,
    tileRef,
    replyChainRef,
    vm,
}: UseEventTileContextMenuNodeArgs): JSX.Element | undefined {
    const closeContextMenu = useCallback((): void => {
        vm.closeContextMenu();
    }, [vm]);

    return snapshot.contextMenuState && snapshot.isContextMenuOpen ? (
        <EventTileContextMenuHost
            mxEvent={props.mxEvent}
            permalinkCreator={props.permalinkCreator}
            getRelationsForEvent={props.getRelationsForEvent}
            reactions={snapshot.reactions}
            contextMenu={snapshot.contextMenuState}
            tileRef={tileRef}
            replyChainRef={replyChainRef}
            onFinished={closeContextMenu}
        />
    ) : undefined;
}

function buildEventTileActionBarViewModelProps(
    props: Pick<ActionBarHostProps, "mxEvent" | "isQuoteExpanded" | "getRelationsForEvent" | "toggleThreadExpanded">,
    roomContext: Pick<React.ContextType<typeof RoomContext>, "timelineRenderingType" | "canSendMessages" | "canReact">,
    isSearch: boolean,
    isCard: boolean,
    handleOptionsClick: NonNullable<EventTileActionBarViewModelProps["onOptionsClick"]>,
    handleReactionsClick: NonNullable<EventTileActionBarViewModelProps["onReactionsClick"]>,
): EventTileActionBarViewModelProps {
    return {
        mxEvent: props.mxEvent,
        timelineRenderingType: roomContext.timelineRenderingType,
        canSendMessages: roomContext.canSendMessages,
        canReact: roomContext.canReact,
        isSearch,
        isCard,
        isQuoteExpanded: props.isQuoteExpanded,
        onToggleThreadExpanded: props.toggleThreadExpanded,
        onOptionsClick: handleOptionsClick,
        onReactionsClick: handleReactionsClick,
        getRelationsForEvent: props.getRelationsForEvent,
    };
}

function EventTileActionBarHost({
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    isQuoteExpanded,
    tileRef,
    replyChainRef,
    onFocusChange,
    toggleThreadExpanded,
}: Readonly<ActionBarHostProps>): JSX.Element {
    const roomContext = useContext(RoomContext);
    const { isCard } = useContext(CardContext);
    const [optionsMenuAnchorRect, setOptionsMenuAnchorRect] = useState<DOMRect | null>(null);
    const [reactionsMenuAnchorRect, setReactionsMenuAnchorRect] = useState<DOMRect | null>(null);
    const isSearch = Boolean(roomContext.search);
    const handleOptionsClick = useCallback((anchor: HTMLElement | null): void => {
        setOptionsMenuAnchorRect(anchor?.getBoundingClientRect() ?? null);
    }, []);
    const handleReactionsClick = useCallback((anchor: HTMLElement | null): void => {
        setReactionsMenuAnchorRect(anchor?.getBoundingClientRect() ?? null);
    }, []);
    const actionBarViewModelProps = useMemo(
        () =>
            buildEventTileActionBarViewModelProps(
                { mxEvent, isQuoteExpanded, getRelationsForEvent, toggleThreadExpanded },
                roomContext,
                isSearch,
                isCard,
                handleOptionsClick,
                handleReactionsClick,
            ),
        [
            mxEvent,
            isQuoteExpanded,
            getRelationsForEvent,
            toggleThreadExpanded,
            roomContext,
            isSearch,
            isCard,
            handleOptionsClick,
            handleReactionsClick,
        ],
    );
    const vm = useCreateAutoDisposedViewModel(() => new EventTileActionBarViewModel(actionBarViewModelProps));

    useEffect(() => {
        vm.setProps(actionBarViewModelProps);
    }, [vm, actionBarViewModelProps]);
    useEffect(() => {
        onFocusChange(Boolean(optionsMenuAnchorRect || reactionsMenuAnchorRect));
    }, [onFocusChange, optionsMenuAnchorRect, reactionsMenuAnchorRect]);
    useEffect(() => {
        setOptionsMenuAnchorRect(null);
        setReactionsMenuAnchorRect(null);
    }, [mxEvent]);

    const closeOptionsMenu = useCallback((): void => {
        setOptionsMenuAnchorRect(null);
    }, []);
    const closeReactionsMenu = useCallback((): void => {
        setReactionsMenuAnchorRect(null);
    }, []);
    const collapseReplyChain = replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined;

    return (
        <>
            <ActionBarView vm={vm} className="mx_MessageActionBar" />
            {optionsMenuAnchorRect ? (
                <MessageContextMenu
                    {...aboveLeftOf(optionsMenuAnchorRect)}
                    mxEvent={mxEvent}
                    permalinkCreator={permalinkCreator}
                    eventTileOps={tileRef.current ?? undefined}
                    collapseReplyChain={collapseReplyChain}
                    onFinished={closeOptionsMenu}
                    getRelationsForEvent={getRelationsForEvent}
                />
            ) : null}
            {reactionsMenuAnchorRect ? (
                <ContextMenu
                    {...aboveLeftOf(reactionsMenuAnchorRect)}
                    onFinished={closeReactionsMenu}
                    managed={false}
                    focusLock
                >
                    <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeReactionsMenu} />
                </ContextMenu>
            ) : null}
        </>
    );
}

function buildThreadToolbarViewModelProps({
    onViewInRoomClick,
    onCopyLinkClick,
}: ThreadToolbarHostProps): ThreadListActionBarViewModelProps {
    return {
        onViewInRoomClick,
        onCopyLinkClick,
    };
}

function ThreadToolbarHost({ onViewInRoomClick, onCopyLinkClick }: Readonly<ThreadToolbarHostProps>): JSX.Element {
    const threadToolbarViewModelProps = useMemo(
        () => buildThreadToolbarViewModelProps({ onViewInRoomClick, onCopyLinkClick }),
        [onViewInRoomClick, onCopyLinkClick],
    );
    const vm = useCreateAutoDisposedViewModel(() => new ThreadListActionBarViewModel(threadToolbarViewModelProps));

    useEffect(() => {
        vm.setProps(threadToolbarViewModelProps);
    }, [vm, threadToolbarViewModelProps]);

    return <ActionBarView vm={vm} className="mx_ThreadActionBar" />;
}

function EventTileContextMenuHost({
    contextMenu,
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    tileRef,
    replyChainRef,
    onFinished,
}: Readonly<EventTileContextMenuHostProps>): JSX.Element {
    return (
        <MessageContextMenu
            {...aboveRightOf(contextMenu.position)}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            eventTileOps={tileRef.current ?? undefined}
            collapseReplyChain={replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined}
            onFinished={onFinished}
            rightClick={true}
            reactions={reactions}
            link={contextMenu.link}
            getRelationsForEvent={getRelationsForEvent}
        />
    );
}

function EventTileBody({ ref: forwardedRef, ...props }: Readonly<EventTileBaseProps>): JSX.Element {
    const roomContext = useContext(RoomContext);
    const cli = useMatrixClientContext();
    const commandDeps = useMemo<EventTileCommandDeps>(
        () => ({
            dispatch: (payload) => dis.dispatch(payload),
            copyPlaintext,
            trackInteraction: (name, ev, index) => PosthogTrackers.trackInteraction(name, ev, index),
            allowOverridingNativeContextMenus: () => Boolean(PlatformPeg.get()?.allowOverridingNativeContextMenus()),
        }),
        [],
    );
    const tileContentId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const tileRef = useRef<EventTileOps>(null);
    const replyChainRef = useRef<ReplyChain>(null);
    const [suppressReadReceiptAnimation, setSuppressReadReceiptAnimation] = useState(true);
    const vmReadReceipts = useMemo(
        () => props.readReceipts?.map(({ userId, ts, roomMember }) => ({ userId, ts, roomMember })),
        [props.readReceipts],
    );
    const { showHiddenEvents, isRoomEncrypted, timelineRenderingType } = roomContext;
    const {
        mxEvent,
        eventSendStatus,
        editState,
        permalinkCreator,
        callEventGrouper,
        forExport,
        layout,
        isTwelveHour,
        alwaysShowTimestamps,
        isRedacted,
        continuation,
        last,
        lastInSection,
        contextual,
        isSelectedEvent,
        hideSender,
        hideTimestamp,
        inhibitInteraction,
        highlightLink,
        showReactions,
        getRelationsForEvent,
        showReadReceipts,
        lastSuccessful,
    } = props;
    const viewModelProps = useMemo(
        () =>
            buildEventTileViewModelProps(
                {
                    mxEvent,
                    eventSendStatus,
                    editState,
                    permalinkCreator,
                    callEventGrouper,
                    forExport,
                    layout,
                    isTwelveHour,
                    alwaysShowTimestamps,
                    isRedacted,
                    continuation,
                    last,
                    lastInSection,
                    contextual,
                    isSelectedEvent,
                    hideSender,
                    hideTimestamp,
                    inhibitInteraction,
                    highlightLink,
                    showReactions,
                    getRelationsForEvent,
                    readReceipts: props.readReceipts,
                    showReadReceipts,
                    lastSuccessful,
                },
                vmReadReceipts,
                cli,
                commandDeps,
                {
                    showHiddenEvents,
                    isRoomEncrypted,
                    timelineRenderingType,
                },
            ),
        [
            mxEvent,
            eventSendStatus,
            editState,
            permalinkCreator,
            callEventGrouper,
            forExport,
            layout,
            isTwelveHour,
            alwaysShowTimestamps,
            isRedacted,
            continuation,
            last,
            lastInSection,
            contextual,
            isSelectedEvent,
            hideSender,
            hideTimestamp,
            inhibitInteraction,
            highlightLink,
            showReactions,
            getRelationsForEvent,
            props.readReceipts,
            showReadReceipts,
            lastSuccessful,
            vmReadReceipts,
            cli,
            commandDeps,
            showHiddenEvents,
            isRoomEncrypted,
            timelineRenderingType,
        ],
    );
    const vm = useCreateAutoDisposedViewModel(() => new EventTileViewModel(viewModelProps));

    useEffect(() => {
        vm.refreshVerification();
    }, [vm]);
    useImperativeHandle(
        forwardedRef,
        (): EventTileHandle => ({
            ref: rootRef,
            forceUpdate: () => vm.refreshDerivedState(),
            isWidgetHidden: () => tileRef.current?.isWidgetHidden?.() ?? false,
            unhideWidget: () => tileRef.current?.unhideWidget?.(),
            getMediaHelper: () => tileRef.current?.getMediaHelper?.(),
        }),
        [vm],
    );
    useEffect(() => {
        vm.updateProps(viewModelProps);
    }, [viewModelProps, vm]);

    const snapshot = useViewModel(vm);

    useEffect(() => {
        const rootNode = rootRef.current;
        if (!props.resizeObserver || !rootNode) return;

        props.resizeObserver.observe(rootNode);

        return () => {
            props.resizeObserver?.unobserve(rootNode);
        };
    }, [props.resizeObserver, props.as, roomContext.timelineRenderingType, snapshot.hasRenderer]);
    useEffect(() => {
        setSuppressReadReceiptAnimation(false);
    }, []);

    const {
        room,
        onPermalinkClicked,
        openInRoom,
        copyLinkToThread,
        onContextMenu,
        onTimestampContextMenu,
        onListTileClick,
    } = useEventTileCommands(props, cli, vm);
    const onActionBarFocusChange = useCallback(
        (focused: boolean): void => {
            vm.onActionBarFocusChange(focused, rootRef.current?.matches(":hover") ?? false);
        },
        [vm, rootRef],
    );
    const toggleThreadExpanded = useCallback((): void => {
        vm.toggleQuoteExpanded();
    }, [vm]);
    const nodes = useEventTileNodes({
        props,
        roomContext,
        snapshot,
        tileRef,
        replyChainRef,
        suppressReadReceiptAnimation,
        tileContentId,
        vm,
        onActionBarFocusChange,
        toggleThreadExpanded,
        openInRoom,
        copyLinkToThread,
    });
    const contextMenuNode = useEventTileContextMenuNode({
        props,
        snapshot,
        tileRef,
        replyChainRef,
        vm,
    });
    const notificationRoomLabel = room
        ? _t(
              "timeline|in_room_name",
              { room: snapshot.notificationView.roomName ?? room.name },
              { strong: (sub) => <strong>{sub}</strong> },
          )
        : undefined;
    const onMouseEnter = useCallback((): void => vm.setHover(true), [vm]);
    const onMouseLeave = useCallback((): void => vm.setHover(false), [vm]);
    const onFocus = useCallback(
        (event: FocusEvent<HTMLElement>): void => {
            const target = event.target as HTMLElement;
            const showActionBarFromFocus =
                target.matches(":focus-visible") || document.body.dataset.whatinput === "keyboard";
            vm.onFocusEnter(showActionBarFromFocus);
        },
        [vm],
    );
    const onBlur = useCallback(
        (event: FocusEvent<HTMLElement>): void => {
            if (event.currentTarget.contains(event.relatedTarget)) {
                return;
            }

            vm.onFocusLeave();
        },
        [vm],
    );
    const eventTileViewProps = useMemo<EventTileViewProps>(
        () => ({
            as: props.as,
            rootRef,
            contentId: tileContentId,
            eventId: snapshot.eventId,
            layout: props.layout,
            timelineRenderingType: roomContext.timelineRenderingType,
            rootClassName: snapshot.rootClassName,
            contentClassName: snapshot.contentClassName,
            ariaLive: snapshot.ariaLive,
            scrollTokens: snapshot.scrollToken,
            isOwnEvent: snapshot.isOwnEvent,
            content: {
                sender: nodes.content.sender,
                avatar: nodes.content.avatar,
                replyChain: nodes.content.replyChain,
                messageStatus: nodes.content.messageStatus,
                messageBody: nodes.content.messageBody,
                actionBar: nodes.content.actionBar,
                footer: snapshot.hasFooter ? nodes.content.footer : undefined,
                contextMenu: contextMenuNode,
            },
            threads: {
                info: nodes.thread.info,
                replyCount: nodes.thread.replyCount,
                preview: nodes.thread.preview,
                toolbar: nodes.thread.toolbar,
            },
            timestamp: {
                ...snapshot.timestampView,
                isTwelveHour: props.isTwelveHour,
                onPermalinkClicked,
                onContextMenu: onTimestampContextMenu,
            },
            encryption: snapshot.encryptionView,
            notification: {
                enabled: snapshot.notificationView.enabled,
                roomLabel: notificationRoomLabel,
                roomAvatar: room ? (
                    <div className="mx_EventTile_avatar">
                        <RoomAvatar room={room} size={AvatarSize.Medium} />
                    </div>
                ) : undefined,
                unreadBadge: room ? (
                    <UnreadNotificationBadge room={room} threadId={props.mxEvent.getId()} forceDot={true} />
                ) : undefined,
            },
            handlers: {
                onClick: snapshot.isListLikeTile ? onListTileClick : undefined,
                onContextMenu,
                onMouseEnter,
                onMouseLeave,
                onFocus,
                onBlur,
            },
        }),
        [
            props.as,
            props.layout,
            props.isTwelveHour,
            props.mxEvent,
            rootRef,
            tileContentId,
            snapshot.eventId,
            snapshot.rootClassName,
            snapshot.contentClassName,
            snapshot.ariaLive,
            snapshot.scrollToken,
            snapshot.isOwnEvent,
            snapshot.hasFooter,
            snapshot.timestampView,
            snapshot.encryptionView,
            snapshot.isListLikeTile,
            snapshot.notificationView,
            roomContext.timelineRenderingType,
            nodes.content.sender,
            nodes.content.avatar,
            nodes.content.replyChain,
            nodes.content.messageStatus,
            nodes.content.messageBody,
            nodes.content.actionBar,
            nodes.content.footer,
            nodes.thread.info,
            nodes.thread.replyCount,
            nodes.thread.preview,
            nodes.thread.toolbar,
            contextMenuNode,
            onPermalinkClicked,
            onTimestampContextMenu,
            notificationRoomLabel,
            room,
            onListTileClick,
            onContextMenu,
            onMouseEnter,
            onMouseLeave,
            onFocus,
            onBlur,
        ],
    );

    if (snapshot.shouldRenderMissingRendererFallback) {
        return (
            <div ref={rootRef as React.Ref<HTMLDivElement>} className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
            </div>
        );
    }

    return <EventTileView {...eventTileViewProps} />;
}

/** Renders a single timeline event tile directly from its view model. */
export function EventTile(props: Readonly<EventTileProps>): JSX.Element {
    const { withErrorBoundary = true, layout = Layout.Group, forExport = false, ...rest } = props;
    const tileProps = { ...rest, layout, forExport };
    const tile = <EventTileBody {...tileProps} />;

    if (!withErrorBoundary) {
        return tile;
    }

    return (
        <EventTileErrorBoundary mxEvent={tileProps.mxEvent} layout={tileProps.layout}>
            {tile}
        </EventTileErrorBoundary>
    );
}
