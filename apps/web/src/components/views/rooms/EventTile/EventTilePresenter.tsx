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
import classNames from "classnames";
import { ActionBarView, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import {
    EventStatus,
    EventType,
    MsgType,
    type Relations,
    type MatrixEvent,
    type Room,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { DecryptionFailureCode, EventShieldColour, EventShieldReason } from "matrix-js-sdk/src/crypto-api";

import {
    EventTileViewModel,
    type EventTileViewModelProps,
    type EventTileViewSnapshot,
} from "../../../../viewmodels/room/EventTileViewModel";
import RoomContext, { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { type ShowThreadPayload } from "../../../../dispatcher/payloads/ShowThreadPayload";
import PosthogTrackers from "../../../../PosthogTrackers";
import { copyPlaintext } from "../../../../utils/strings";
import { EventTileView, type EventTileViewProps } from "./EventTileView";
import { _t } from "../../../../languageHandler";
import PlatformPeg from "../../../../PlatformPeg";
import { ElementCallEventType } from "../../../../call-types";
import { type Layout } from "../../../../settings/enums/Layout";
import { getLateEventInfo } from "../../../structures/grouper/LateEventGrouper";
import type LegacyCallEventGrouper from "../../../structures/LegacyCallEventGrouper";
import RoomAvatar from "../../avatars/RoomAvatar";
import ThreadSummary, { ThreadMessagePreview } from "../ThreadSummary";
import { UnreadNotificationBadge } from "../NotificationBadge/UnreadNotificationBadge";
import {
    AvatarSize,
    AvatarSubject,
    ClickMode,
    EventTileRenderMode,
    ThreadInfoMode,
    ThreadPanelMode,
} from "../../../../models/rooms/EventTileModel";
import type ReplyChain from "../../elements/ReplyChain";
import type { ComposerInsertPayload } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { type IReadReceiptPosition } from "../ReadReceiptMarker";
import type { MessageBodyProps, MessageBodyRenderTileProps } from "./MessageBody";
import type {
    EventTileOps,
    GetRelationsForEvent,
    ReadReceiptProps,
} from "../../../../viewmodels/room/EventTileContracts";
import { type ReplyPreviewProps } from "./ReplyPreview";
import { ThreadInfo } from "./ThreadInfo";
import { MediaEventHelper as TileMediaEventHelper } from "../../../../utils/MediaEventHelper";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import ContextMenu, { aboveLeftOf, aboveRightOf } from "../../../structures/ContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import { EventTileActionBarViewModel } from "../../../../viewmodels/room/EventTileActionBarViewModel";
import { ThreadListActionBarViewModel } from "../../../../viewmodels/room/ThreadListActionBarViewModel";
import { CardContext } from "../../right_panel/context";
import { Sender } from "./Sender";
import { Avatar } from "./Avatar";
import { ReplyPreview } from "./ReplyPreview";
import { MessageStatus } from "./MessageStatus";
import { Footer } from "./Footer";
import { MessageBody } from "./MessageBody";

/** Ref handle for direct access to tile actions and the root element. */
export interface EventTileHandle extends EventTileOps {
    /** Ref to the tile root DOM element. */
    ref: RefObject<HTMLElement | null>;
    /** Recomputes derived tile state without changing props. */
    forceUpdate(): void;
}

/** Core event identity and imperative ref inputs for the presenter. */
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

/** Props consumed by {@link EventTilePresenter}. */
export type EventTileProps = EventTileCoreProps &
    EventTileRenderingProps &
    EventTileRelationProps &
    EventTileEditingProps &
    EventTileEnvironmentProps;

function buildEventTileViewModelProps(
    props: Omit<EventTileViewModelProps, "cli" | "timelineRenderingType" | "isRoomEncrypted" | "showHiddenEvents">,
    cli: ReturnType<typeof useMatrixClientContext>,
    roomContext: Pick<
        React.ContextType<typeof RoomContext>,
        "timelineRenderingType" | "isRoomEncrypted" | "showHiddenEvents"
    >,
): EventTileViewModelProps {
    return {
        ...props,
        cli,
        timelineRenderingType: roomContext.timelineRenderingType,
        isRoomEncrypted: Boolean(roomContext.isRoomEncrypted),
        showHiddenEvents: roomContext.showHiddenEvents,
    };
}

/** Result returned from `useEventTileViewModel`. */
type UseEventTileViewModelResult = {
    /** The current Matrix client instance. */
    cli: ReturnType<typeof useMatrixClientContext>;
    /** Room-level timeline context for the current render tree. */
    roomContext: React.ContextType<typeof RoomContext>;
    /** Stable ID assigned to the tile content region. */
    tileContentId: string;
    /** Ref to the tile root element. */
    rootRef: RefObject<HTMLElement | null>;
    /** Ref to imperative tile operations. */
    tileRef: RefObject<EventTileOps | null>;
    /** Ref to the reply chain preview when rendered. */
    replyChainRef: RefObject<ReplyChain | null>;
    /** Whether initial read receipt animations should be suppressed. */
    suppressReadReceiptAnimation: boolean;
    /** Current context menu state, if the menu is open. */
    contextMenuState?: ContextMenuState;
    /** Setter for the current context menu state. */
    setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | undefined>>;
    /** The event tile view model instance. */
    vm: EventTileViewModel;
    /** The current derived tile snapshot. */
    snapshot: EventTileViewSnapshot;
};

/** Event handlers and room data returned from `useEventTileActions`. */
type UseEventTileActionsResult = {
    /** The room that owns the event, if it can be resolved from the client. */
    room: Room | null;
    /** Opens the event in the full room timeline. */
    openInRoom: (_anchor: HTMLElement | null) => void;
    /** Copies a permalink to the event thread when available. */
    copyLinkToThread: (_anchor: HTMLElement | null) => Promise<void>;
    /** Handles timestamp permalink clicks. */
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    /** Handles clicks on list-style tiles. */
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
    /** Handles context menu requests from the main tile body. */
    onContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    /** Handles context menu requests from the timestamp element. */
    onTimestampContextMenu: (ev: MouseEvent<HTMLElement>) => void;
};

/** Presenter-owned child content injected into {@link EventTileView}. */
type EventTileViewRenderContent = {
    /** Reply chain preview props when reply UI should be rendered. */
    replyChain?: ReplyPreviewProps;
    /** Action bar node for the tile controls. */
    actionBar?: JSX.Element;
    /** Context menu node when the menu is open. */
    contextMenu?: JSX.Element;
    /** Thread toolbar node for thread list and notification views. */
    threadToolbar?: JSX.Element;
};

interface ContextMenuState {
    position: Pick<DOMRect, "top" | "left" | "bottom">;
    link?: string;
}

/** Event handlers passed through to {@link EventTileView}. */
type EventTileViewActions = {
    /** Opens the event in the owning room from the thread toolbar. */
    openInRoom: (_anchor: HTMLElement | null) => void;
    /** Copies a permalink to the thread for this event from the thread toolbar. */
    copyLinkToThread: (_anchor: HTMLElement | null) => Promise<void>;
    /** Handles clicks on the timestamp permalink. */
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    /** Handles list tile click behavior. */
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
    /** Handles context menu requests from the tile body. */
    onContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    /** Handles context menu requests from the timestamp. */
    onTimestampContextMenu: (ev: MouseEvent<HTMLElement>) => void;
};

/** Inputs required to build the final {@link EventTileViewProps} object. */
type UseEventTileViewPropsArgs = {
    /** Presenter props for the current tile. */
    props: EventTileProps;
    /** The event tile view model instance. */
    vm: EventTileViewModel;
    /** The current derived tile snapshot. */
    snapshot: EventTileViewSnapshot;
    /** Room timeline context for the current render tree. */
    roomContext: React.ContextType<typeof RoomContext>;
    /** The room containing the event, if resolved. */
    room: Room | null;
    /** Stable ID assigned to the content region. */
    tileContentId: string;
    /** Ref to the tile root element. */
    rootRef: RefObject<HTMLElement | null>;
    /** Ref to imperative tile operations. */
    tileRef: RefObject<EventTileOps | null>;
    /** Whether initial read receipt animations should be suppressed. */
    suppressReadReceiptAnimation: boolean;
    /** Presenter-owned child content to inject into the view. */
    renderedContent: EventTileViewRenderContent;
    /** Event handlers to wire into the view. */
    actions: EventTileViewActions;
};

function getContentClassName(mxEvent: MatrixEvent): string {
    const isProbablyMedia = TileMediaEventHelper.isEligible(mxEvent);

    return classNames("mx_EventTile_line", {
        mx_EventTile_mediaLine: isProbablyMedia,
        mx_EventTile_image:
            mxEvent.getType() === EventType.RoomMessage && mxEvent.getContent().msgtype === MsgType.Image,
        mx_EventTile_sticker: mxEvent.getType() === EventType.Sticker,
        mx_EventTile_emote:
            mxEvent.getType() === EventType.RoomMessage && mxEvent.getContent().msgtype === MsgType.Emote,
    });
}

function getEncryptionIndicatorTitle(
    mxEvent: MatrixEvent,
    snapshot: EventTileViewSnapshot,
    isRoomEncrypted: boolean,
): string | undefined {
    const event = mxEvent.replacingEvent() ?? mxEvent;

    if (event.isDecryptionFailure()) {
        switch (event.decryptionFailureReason) {
            case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
            case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                return undefined;
            default:
                return _t("timeline|undecryptable_tooltip");
        }
    }

    if (snapshot.shieldColour !== EventShieldColour.NONE) {
        switch (snapshot.shieldReason) {
            case EventShieldReason.UNVERIFIED_IDENTITY:
                return _t("encryption|event_shield_reason_unverified_identity");
            case EventShieldReason.UNSIGNED_DEVICE:
                return _t("encryption|event_shield_reason_unsigned_device");
            case EventShieldReason.UNKNOWN_DEVICE:
                return _t("encryption|event_shield_reason_unknown_device");
            case EventShieldReason.AUTHENTICITY_NOT_GUARANTEED:
                return _t("encryption|event_shield_reason_authenticity_not_guaranteed");
            case EventShieldReason.MISMATCHED_SENDER_KEY:
                return _t("encryption|event_shield_reason_mismatched_sender_key");
            case EventShieldReason.SENT_IN_CLEAR:
                return _t("common|unencrypted");
            case EventShieldReason.VERIFICATION_VIOLATION:
                return _t("timeline|decryption_failure|sender_identity_previously_verified");
            case EventShieldReason.MISMATCHED_SENDER:
                return _t("encryption|event_shield_reason_mismatched_sender");
            default:
                return _t("error|unknown");
        }
    }

    if (isRoomEncrypted && !event.isEncrypted() && !event.isState() && !event.isRedacted()) {
        if (event.status === EventStatus.ENCRYPTING) return undefined;
        if (event.status === EventStatus.NOT_SENT) return undefined;
        return _t("common|unencrypted");
    }

    return undefined;
}

function useEventTileViewModel(
    props: EventTileProps,
    forwardedRef: Ref<EventTileHandle> | undefined,
): UseEventTileViewModelResult {
    const roomContext = useContext(RoomContext);
    const cli = useMatrixClientContext();
    const {
        mxEvent,
        forExport,
        showReactions,
        getRelationsForEvent,
        readReceipts,
        lastSuccessful,
        eventSendStatus,
        isRedacted,
        continuation,
        last,
        lastInSection,
        contextual,
        isSelectedEvent,
        isTwelveHour,
        layout,
        editState,
        permalinkCreator,
        alwaysShowTimestamps,
        hideSender,
        hideTimestamp,
        inhibitInteraction,
        showReadReceipts,
        highlightLink,
        callEventGrouper,
    } = props;
    const { showHiddenEvents, isRoomEncrypted, timelineRenderingType } = roomContext;
    const tileContentId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const tileRef = useRef<EventTileOps>(null);
    const replyChainRef = useRef<ReplyChain>(null);
    const [suppressReadReceiptAnimation, setSuppressReadReceiptAnimation] = useState(true);
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState>();
    const vmReadReceipts = useMemo(
        () => readReceipts?.map(({ userId, ts, roomMember }) => ({ userId, ts, roomMember })),
        [readReceipts],
    );
    const viewModelProps = useMemo(
        () =>
            buildEventTileViewModelProps(
                {
                    mxEvent,
                    forExport,
                    showReactions,
                    getRelationsForEvent,
                    readReceipts: vmReadReceipts,
                    lastSuccessful,
                    eventSendStatus,
                    isRedacted,
                    continuation,
                    last,
                    lastInSection,
                    contextual,
                    isSelectedEvent,
                    isTwelveHour,
                    layout,
                    editState,
                    permalinkCreator,
                    alwaysShowTimestamps,
                    hideSender,
                    hideTimestamp,
                    inhibitInteraction,
                    showReadReceipts,
                    highlightLink,
                    callEventGrouper,
                },
                cli,
                {
                    showHiddenEvents,
                    isRoomEncrypted,
                    timelineRenderingType,
                },
            ),
        [
            cli,
            mxEvent,
            forExport,
            showReactions,
            getRelationsForEvent,
            vmReadReceipts,
            lastSuccessful,
            eventSendStatus,
            isRedacted,
            continuation,
            last,
            lastInSection,
            contextual,
            isSelectedEvent,
            isTwelveHour,
            layout,
            editState,
            permalinkCreator,
            alwaysShowTimestamps,
            hideSender,
            hideTimestamp,
            inhibitInteraction,
            showReadReceipts,
            highlightLink,
            callEventGrouper,
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

    return {
        cli,
        roomContext,
        tileContentId,
        rootRef,
        tileRef,
        replyChainRef,
        suppressReadReceiptAnimation,
        contextMenuState,
        setContextMenuState,
        vm,
        snapshot,
    };
}

function useEventTileActions(
    props: EventTileProps,
    cli: ReturnType<typeof useMatrixClientContext>,
    roomContext: React.ContextType<typeof RoomContext>,
    setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | undefined>>,
    vm: EventTileViewModel,
    snapshot: EventTileViewSnapshot,
): UseEventTileActionsResult {
    const roomId = props.mxEvent.getRoomId();
    const room = roomId ? cli.getRoom(roomId) : null;

    const onPermalinkClicked = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            ev.preventDefault();
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                event_id: props.mxEvent.getId(),
                highlighted: true,
                room_id: props.mxEvent.getRoomId(),
                metricsTrigger: snapshot.openedFromSearch ? "MessageSearch" : undefined,
            });
        },
        [props.mxEvent, snapshot.openedFromSearch],
    );

    const openInRoom = useCallback(
        (_anchor: HTMLElement | null): void => {
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                event_id: props.mxEvent.getId(),
                highlighted: true,
                room_id: props.mxEvent.getRoomId(),
                metricsTrigger: undefined,
            });
        },
        [props.mxEvent],
    );

    const copyLinkToThread = useCallback(
        async (_anchor: HTMLElement | null): Promise<void> => {
            if (!props.permalinkCreator) return;
            const eventId = props.mxEvent.getId();
            if (!eventId) return;
            await copyPlaintext(props.permalinkCreator.forEvent(eventId));
        },
        [props.permalinkCreator, props.mxEvent],
    );

    const showContextMenu = useCallback(
        (ev: MouseEvent<HTMLElement>, permalink?: string): void => {
            const clickTarget = ev.target;
            if (!(clickTarget instanceof HTMLElement) || clickTarget instanceof HTMLImageElement) return;
            const anchorElement = clickTarget instanceof HTMLAnchorElement ? clickTarget : clickTarget.closest("a");

            if (!PlatformPeg.get()?.allowOverridingNativeContextMenus() && anchorElement) return;
            if (props.editState) return;

            ev.preventDefault();
            ev.stopPropagation();
            setContextMenuState({
                position: {
                    left: ev.clientX,
                    top: ev.clientY,
                    bottom: ev.clientY,
                },
                link: anchorElement?.href || permalink,
            });
            vm.onContextMenuOpen();
        },
        [props.editState, setContextMenuState, vm],
    );

    const onContextMenu = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            showContextMenu(ev);
        },
        [showContextMenu],
    );

    const onTimestampContextMenu = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            const eventId = props.mxEvent.getId();
            showContextMenu(ev, eventId ? props.permalinkCreator?.forEvent(eventId) : undefined);
        },
        [showContextMenu, props.permalinkCreator, props.mxEvent],
    );

    const onListTileClick = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            const target = ev.currentTarget;
            let index = -1;
            if (target.parentElement) index = Array.from(target.parentElement.children).indexOf(target);

            switch (snapshot.tileClickMode) {
                case ClickMode.ViewRoom:
                    openInRoom(null);
                    break;
                case ClickMode.ShowThread:
                    dis.dispatch<ShowThreadPayload>({
                        action: Action.ShowThread,
                        rootEvent: props.mxEvent,
                        push: true,
                    });
                    PosthogTrackers.trackInteraction("WebThreadsPanelThreadItem", ev, index);
                    break;
            }
        },
        [snapshot.tileClickMode, openInRoom, props.mxEvent],
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
}: ActionBarHostProps): JSX.Element {
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
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new EventTileActionBarViewModel({
                mxEvent,
                timelineRenderingType: roomContext.timelineRenderingType,
                canSendMessages: roomContext.canSendMessages,
                canReact: roomContext.canReact,
                isSearch,
                isCard,
                isQuoteExpanded,
                onToggleThreadExpanded: toggleThreadExpanded,
                onOptionsClick: handleOptionsClick,
                onReactionsClick: handleReactionsClick,
                getRelationsForEvent,
            }),
    );

    useEffect(() => {
        vm.setProps({
            mxEvent,
            timelineRenderingType: roomContext.timelineRenderingType,
            canSendMessages: roomContext.canSendMessages,
            canReact: roomContext.canReact,
            isSearch,
            isCard,
            isQuoteExpanded,
            getRelationsForEvent,
            onToggleThreadExpanded: toggleThreadExpanded,
            onOptionsClick: handleOptionsClick,
            onReactionsClick: handleReactionsClick,
        });
    }, [
        vm,
        mxEvent,
        roomContext.timelineRenderingType,
        roomContext.canSendMessages,
        roomContext.canReact,
        isSearch,
        isCard,
        isQuoteExpanded,
        getRelationsForEvent,
        handleOptionsClick,
        handleReactionsClick,
        toggleThreadExpanded,
    ]);

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

type ThreadToolbarHostProps = {
    onViewInRoomClick: (anchor: HTMLElement | null) => void;
    onCopyLinkClick: (anchor: HTMLElement | null) => void | Promise<void>;
};

function ThreadToolbarHost({ onViewInRoomClick, onCopyLinkClick }: ThreadToolbarHostProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ThreadListActionBarViewModel({
                onViewInRoomClick,
                onCopyLinkClick,
            }),
    );

    useEffect(() => {
        vm.setProps({
            onViewInRoomClick,
            onCopyLinkClick,
        });
    }, [vm, onViewInRoomClick, onCopyLinkClick]);

    return <ActionBarView vm={vm} className="mx_ThreadActionBar" />;
}

type EventTileContextMenuHostProps = {
    contextMenu: ContextMenuState;
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFinished: () => void;
};

function EventTileContextMenuHost({
    contextMenu,
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    tileRef,
    replyChainRef,
    onFinished,
}: EventTileContextMenuHostProps): JSX.Element {
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

/** Headless presenter that wires {@link EventTileViewModel} to {@link EventTileView}. */
export function EventTilePresenter({ ref: forwardedRef, ...props }: EventTileProps): JSX.Element {
    const {
        cli,
        roomContext,
        tileContentId,
        rootRef,
        tileRef,
        replyChainRef,
        suppressReadReceiptAnimation,
        contextMenuState,
        setContextMenuState,
        vm,
        snapshot: vmSnapshot,
    } = useEventTileViewModel(props, forwardedRef);
    const {
        room,
        onPermalinkClicked,
        openInRoom,
        copyLinkToThread,
        onContextMenu,
        onTimestampContextMenu,
        onListTileClick,
    } = useEventTileActions(props, cli, roomContext, setContextMenuState, vm, vmSnapshot);
    const setQuoteExpanded = useCallback((expanded: boolean): void => vm.setQuoteExpanded(expanded), [vm]);
    const onActionBarFocusChange = useCallback(
        (focused: boolean): void => {
            vm.onActionBarFocusChange(focused, rootRef.current?.matches(":hover") ?? false);
        },
        [vm, rootRef],
    );
    const toggleThreadExpanded = useCallback((): void => {
        vm.setQuoteExpanded(!vmSnapshot.isQuoteExpanded);
    }, [vm, vmSnapshot.isQuoteExpanded]);
    const closeContextMenu = useCallback((): void => {
        setContextMenuState(undefined);
        vm.onContextMenuClose();
    }, [setContextMenuState, vm]);

    const replyChain = useMemo(
        (): ReplyPreviewProps | undefined =>
            vmSnapshot.shouldRenderReplyPreview
                ? {
                      mxEvent: props.mxEvent,
                      forExport: props.forExport,
                      permalinkCreator: props.permalinkCreator,
                      layout: props.layout,
                      alwaysShowTimestamps: props.alwaysShowTimestamps,
                      getRelationsForEvent: props.getRelationsForEvent,
                      hover: vmSnapshot.hover,
                      focusWithin: vmSnapshot.focusWithin,
                      isQuoteExpanded: vmSnapshot.isQuoteExpanded,
                      replyChainRef,
                      setQuoteExpanded,
                  }
                : undefined,
        [
            vmSnapshot.shouldRenderReplyPreview,
            props.mxEvent,
            props.forExport,
            props.permalinkCreator,
            props.layout,
            props.alwaysShowTimestamps,
            props.getRelationsForEvent,
            replyChainRef,
            setQuoteExpanded,
            vmSnapshot.hover,
            vmSnapshot.focusWithin,
            vmSnapshot.isQuoteExpanded,
        ],
    );

    const actionBar = useMemo(
        (): JSX.Element | undefined =>
            vmSnapshot.shouldRenderActionBar ? (
                <EventTileActionBarHost
                    mxEvent={props.mxEvent}
                    permalinkCreator={props.permalinkCreator}
                    getRelationsForEvent={props.getRelationsForEvent}
                    reactions={vmSnapshot.reactions}
                    isQuoteExpanded={vmSnapshot.isQuoteExpanded}
                    tileRef={tileRef}
                    replyChainRef={replyChainRef}
                    onFocusChange={onActionBarFocusChange}
                    toggleThreadExpanded={toggleThreadExpanded}
                />
            ) : undefined,
        [
            vmSnapshot.shouldRenderActionBar,
            props.mxEvent,
            props.permalinkCreator,
            props.getRelationsForEvent,
            vmSnapshot.reactions,
            vmSnapshot.isQuoteExpanded,
            tileRef,
            replyChainRef,
            onActionBarFocusChange,
            toggleThreadExpanded,
        ],
    );
    const threadToolbar = useMemo(
        (): JSX.Element | undefined =>
            vmSnapshot.threadPanelMode === ThreadPanelMode.Toolbar ||
            vmSnapshot.threadPanelMode === ThreadPanelMode.SummaryWithToolbar ? (
                <ThreadToolbarHost onViewInRoomClick={openInRoom} onCopyLinkClick={copyLinkToThread} />
            ) : undefined,
        [vmSnapshot.threadPanelMode, openInRoom, copyLinkToThread],
    );

    const contextMenu = useMemo(
        (): JSX.Element | undefined =>
            contextMenuState && vmSnapshot.isContextMenuOpen ? (
                <EventTileContextMenuHost
                    mxEvent={props.mxEvent}
                    permalinkCreator={props.permalinkCreator}
                    getRelationsForEvent={props.getRelationsForEvent}
                    reactions={vmSnapshot.reactions}
                    contextMenu={contextMenuState}
                    tileRef={tileRef}
                    replyChainRef={replyChainRef}
                    onFinished={closeContextMenu}
                />
            ) : undefined,
        [
            props.mxEvent,
            props.permalinkCreator,
            props.getRelationsForEvent,
            vmSnapshot.reactions,
            vmSnapshot.isContextMenuOpen,
            contextMenuState,
            tileRef,
            replyChainRef,
            closeContextMenu,
        ],
    );

    const eventTileViewProps = useEventTileViewProps({
        props,
        vm,
        snapshot: vmSnapshot,
        roomContext,
        room,
        tileContentId,
        rootRef,
        tileRef,
        suppressReadReceiptAnimation,
        renderedContent: {
            actionBar,
            contextMenu,
            replyChain,
            threadToolbar,
        },
        actions: {
            onContextMenu,
            onPermalinkClicked,
            onTimestampContextMenu,
            openInRoom: openInRoom,
            copyLinkToThread: copyLinkToThread,
            onListTileClick,
        },
    });

    if (vmSnapshot.renderMode === EventTileRenderMode.MissingRendererFallback) {
        return (
            <div ref={rootRef as React.Ref<HTMLDivElement>} className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
            </div>
        );
    }

    return <EventTileView {...eventTileViewProps} />;
}

function useEventTileViewProps({
    props,
    vm,
    snapshot,
    roomContext,
    room,
    tileContentId,
    rootRef,
    tileRef,
    suppressReadReceiptAnimation,
    renderedContent,
    actions,
}: UseEventTileViewPropsArgs): EventTileViewProps {
    const renderTileProps = useMemo(
        (): MessageBodyRenderTileProps => ({
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
    const rootClassName = useMemo(() => {
        const eventType = props.mxEvent.getType();
        const msgtype = props.mxEvent.getContent().msgtype;
        const isRenderingNotification = roomContext.timelineRenderingType === TimelineRenderingType.Notification;

        return classNames({
            mx_EventTile_bubbleContainer: snapshot.isBubbleMessage,
            mx_EventTile_leftAlignedBubble: snapshot.isLeftAlignedBubbleMessage,
            mx_EventTile: true,
            mx_EventTile_isEditing: snapshot.isEditing,
            mx_EventTile_info: snapshot.isInfoMessage,
            mx_EventTile_12hr: props.isTwelveHour,
            mx_EventTile_sending: !snapshot.isEditing && snapshot.isSending,
            mx_EventTile_highlight: snapshot.isHighlighted,
            mx_EventTile_selected: props.isSelectedEvent || snapshot.isContextMenuOpen,
            mx_EventTile_continuation:
                snapshot.isContinuation ||
                eventType === EventType.CallInvite ||
                ElementCallEventType.matches(eventType),
            mx_EventTile_last: props.last,
            mx_EventTile_lastInSection: props.lastInSection,
            mx_EventTile_contextual: props.contextual,
            mx_EventTile_actionBarFocused: snapshot.actionBarFocused,
            mx_EventTile_bad: snapshot.isEncryptionFailure,
            mx_EventTile_emote: msgtype === MsgType.Emote,
            mx_EventTile_noSender: !snapshot.showSender,
            mx_EventTile_clamp:
                roomContext.timelineRenderingType === TimelineRenderingType.ThreadsList || isRenderingNotification,
            mx_EventTile_noBubble: snapshot.noBubbleEvent,
        });
    }, [
        props.mxEvent,
        props.isTwelveHour,
        props.isSelectedEvent,
        props.last,
        props.lastInSection,
        props.contextual,
        snapshot,
        roomContext.timelineRenderingType,
    ]);
    const contentClassName = useMemo(() => getContentClassName(props.mxEvent), [props.mxEvent]);
    const avatarMember = useMemo(() => getAvatarMember(props, snapshot.avatarSubject), [props, snapshot.avatarSubject]);
    const onSenderProfileClick = useCallback((): void => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: props.mxEvent.getSender()!,
            timelineRenderingType: roomContext.timelineRenderingType,
        });
    }, [props.mxEvent, roomContext.timelineRenderingType]);
    const threadInfo = useMemo(
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
                    href={snapshot.threadInfoMode === ThreadInfoMode.SearchLink ? props.highlightLink : undefined}
                    label={
                        snapshot.threadInfoMode === ThreadInfoMode.SearchLink ||
                        snapshot.threadInfoMode === ThreadInfoMode.SearchText
                            ? _t("timeline|thread_info_basic")
                            : undefined
                    }
                />
            ),
        [snapshot.threadInfoMode, snapshot.threadUpdateKey, snapshot.thread, props.mxEvent, props.highlightLink],
    );
    const threadPanelReplyCount = useMemo(
        () =>
            (snapshot.threadPanelMode === ThreadPanelMode.Summary ||
                snapshot.threadPanelMode === ThreadPanelMode.SummaryWithToolbar) &&
            snapshot.thread
                ? snapshot.thread.length
                : undefined,
        [snapshot.threadPanelMode, snapshot.thread],
    );
    const threadPanelPreview = useMemo(
        () =>
            (snapshot.threadPanelMode === ThreadPanelMode.Summary ||
                snapshot.threadPanelMode === ThreadPanelMode.SummaryWithToolbar) &&
            snapshot.thread ? (
                <ThreadMessagePreview key={snapshot.threadUpdateKey} thread={snapshot.thread} />
            ) : undefined,
        [snapshot.threadPanelMode, snapshot.thread, snapshot.threadUpdateKey],
    );
    const notificationRoomLabel = useMemo(
        () =>
            room
                ? _t("timeline|in_room_name", { room: room.name }, { strong: (sub) => <strong>{sub}</strong> })
                : undefined,
        [room],
    );
    const notificationRoomAvatar = useMemo(
        () =>
            room ? (
                <div className="mx_EventTile_avatar">
                    <RoomAvatar room={room} size={AvatarSize.Medium} />
                </div>
            ) : undefined,
        [room],
    );
    const unreadBadge = useMemo(
        () =>
            room ? <UnreadNotificationBadge room={room} threadId={props.mxEvent.getId()} forceDot={true} /> : undefined,
        [room, props.mxEvent],
    );
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
    const handlers = useMemo(
        () => ({
            onClick: undefined,
            onContextMenu: actions.onContextMenu,
            onMouseEnter,
            onMouseLeave,
            onFocus,
            onBlur,
        }),
        [actions.onContextMenu, onMouseEnter, onMouseLeave, onFocus, onBlur],
    );
    const encryptionIndicatorTitle = useMemo(
        () => getEncryptionIndicatorTitle(props.mxEvent, snapshot, Boolean(roomContext.isRoomEncrypted)),
        [props.mxEvent, snapshot, roomContext.isRoomEncrypted],
    );
    const sender = useMemo(
        (): JSX.Element => <Sender mode={snapshot.senderMode} mxEvent={props.mxEvent} onClick={onSenderProfileClick} />,
        [snapshot.senderMode, props.mxEvent, onSenderProfileClick],
    );
    const avatar = useMemo(
        (): JSX.Element => (
            <Avatar
                member={avatarMember}
                size={snapshot.avatarSize}
                viewUserOnClick={snapshot.avatarMemberUserOnClick}
                forceHistorical={snapshot.avatarForceHistorical}
            />
        ),
        [avatarMember, snapshot.avatarSize, snapshot.avatarMemberUserOnClick, snapshot.avatarForceHistorical],
    );
    const replyPreview = useMemo(
        (): JSX.Element | undefined =>
            renderedContent.replyChain ? <ReplyPreview {...renderedContent.replyChain} /> : undefined,
        [renderedContent.replyChain],
    );
    const messageStatus = useMemo(
        (): JSX.Element => (
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
        (): JSX.Element => (
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
    const messageBodyProps: MessageBodyProps = useMemo(
        () => ({
            mxEvent: props.mxEvent,
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
            renderTileProps,
            tileRef,
            props.permalinkCreator,
            roomContext.timelineRenderingType,
            roomContext.showHiddenEvents,
            snapshot.tileRenderType,
            snapshot.isSeeingThroughMessageHiddenForModeration,
        ],
    );
    const messageBody = useMemo((): JSX.Element => <MessageBody {...messageBodyProps} />, [messageBodyProps]);
    const content = useMemo(
        (): EventTileViewProps["content"] => ({
            sender,
            avatar,
            replyChain: replyPreview,
            messageStatus,
            messageBody,
            actionBar: renderedContent.actionBar,
            footer: snapshot.hasFooter ? footer : undefined,
            contextMenu: renderedContent.contextMenu,
        }),
        [
            sender,
            avatar,
            replyPreview,
            messageStatus,
            messageBody,
            renderedContent.actionBar,
            snapshot.hasFooter,
            footer,
            renderedContent.contextMenu,
        ],
    );
    const threads = useMemo(
        (): EventTileViewProps["threads"] => ({
            info: threadInfo,
            replyCount: threadPanelReplyCount,
            preview: threadPanelPreview,
            toolbar: renderedContent.threadToolbar,
        }),
        [threadInfo, threadPanelReplyCount, threadPanelPreview, renderedContent.threadToolbar],
    );
    const timestamp = useMemo(
        (): EventTileViewProps["timestamp"] => ({
            displayMode: snapshot.timestampDisplayMode,
            formatMode: snapshot.timestampFormatMode,
            ts: snapshot.timestampTs,
            receivedTs: getLateEventInfo(props.mxEvent)?.received_ts,
            isTwelveHour: props.isTwelveHour,
            permalink: snapshot.permalink,
            onPermalinkClicked: actions.onPermalinkClicked,
            onContextMenu: actions.onTimestampContextMenu,
        }),
        [
            snapshot.timestampDisplayMode,
            snapshot.timestampFormatMode,
            snapshot.timestampTs,
            props.mxEvent,
            props.isTwelveHour,
            snapshot.permalink,
            actions.onPermalinkClicked,
            actions.onTimestampContextMenu,
        ],
    );
    const encryption = useMemo(
        (): EventTileViewProps["encryption"] => ({
            padlockMode: snapshot.padlockMode,
            mode: snapshot.encryptionIndicatorMode,
            indicatorTitle: encryptionIndicatorTitle,
            sharedKeysUserId: snapshot.sharedKeysUserId,
            sharedKeysRoomId: snapshot.sharedKeysRoomId,
        }),
        [
            snapshot.padlockMode,
            snapshot.encryptionIndicatorMode,
            encryptionIndicatorTitle,
            snapshot.sharedKeysUserId,
            snapshot.sharedKeysRoomId,
        ],
    );
    const notification = useMemo(
        (): EventTileViewProps["notification"] => ({
            enabled: roomContext.timelineRenderingType === TimelineRenderingType.Notification,
            roomLabel: notificationRoomLabel,
            roomAvatar: notificationRoomAvatar,
            unreadBadge,
        }),
        [roomContext.timelineRenderingType, notificationRoomLabel, notificationRoomAvatar, unreadBadge],
    );

    const commonProps: EventTileViewProps = useMemo(
        () => ({
            as: props.as,
            rootRef,
            contentId: tileContentId,
            eventId: props.mxEvent.getId() ?? undefined,
            layout: props.layout,
            timelineRenderingType: roomContext.timelineRenderingType,
            rootClassName,
            contentClassName,
            ariaLive: props.eventSendStatus === null ? undefined : "off",
            scrollTokens: snapshot.scrollToken,
            isOwnEvent: snapshot.isOwnEvent,
            content,
            threads,
            timestamp,
            encryption,
            notification,
            handlers,
        }),
        [
            props.as,
            rootRef,
            tileContentId,
            props.mxEvent,
            props.layout,
            roomContext.timelineRenderingType,
            rootClassName,
            contentClassName,
            props.eventSendStatus,
            snapshot.scrollToken,
            snapshot.isOwnEvent,
            content,
            threads,
            timestamp,
            encryption,
            notification,
            handlers,
        ],
    );

    if (
        roomContext.timelineRenderingType === TimelineRenderingType.Notification ||
        roomContext.timelineRenderingType === TimelineRenderingType.ThreadsList
    ) {
        return {
            ...commonProps,
            handlers: {
                ...commonProps.handlers,
                onClick: actions.onListTileClick,
            },
        };
    }

    return {
        ...commonProps,
    };
}

function getAvatarMember(props: EventTileProps, avatarSubject: AvatarSubject): RoomMember | null {
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
