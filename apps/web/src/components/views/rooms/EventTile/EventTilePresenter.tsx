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
} from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import RoomContext, { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
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
    EventTileContextMenuState,
    EventTileOps,
    GetRelationsForEvent,
    ReadReceiptProps,
} from "../../../../models/rooms/EventTileTypes";
import { ThreadInfo } from "./ThreadInfo";
import { MediaEventHelper as TileMediaEventHelper } from "../../../../utils/MediaEventHelper";
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
import {
    buildContextMenuState,
    copyLinkToThread as copyLinkToThreadCommand,
    onListTileClick as onListTileClickCommand,
    onPermalinkClicked as onPermalinkClickedCommand,
    openEventInRoom,
    type EventTileCommandContext,
    type EventTileCommandDeps,
} from "./EventTileCommands";

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
    props: EventTileProps,
    readReceipts: EventTileViewModelProps["readReceipts"],
    cli: ReturnType<typeof useMatrixClientContext>,
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
        cli,
        timelineRenderingType: roomContext.timelineRenderingType,
        isRoomEncrypted: Boolean(roomContext.isRoomEncrypted),
        showHiddenEvents: roomContext.showHiddenEvents,
    };
}

/** Result returned from `useEventTileVmState`. */
type UseEventTileVmStateResult = {
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
    contextMenuState?: EventTileContextMenuState;
    /** Setter for the current context menu state. */
    setContextMenuState: React.Dispatch<React.SetStateAction<EventTileContextMenuState | undefined>>;
    /** The event tile view model instance. */
    vm: EventTileViewModel;
    /** The current derived tile snapshot. */
    snapshot: EventTileViewSnapshot;
};

/** Event handlers and room data returned from `useEventTileCommands`. */
type UseEventTileCommandsResult = {
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

/** Presenter-owned body nodes injected into {@link EventTileView}. */
type EventTileContentNodes = {
    sender: JSX.Element;
    avatar: JSX.Element;
    replyChain?: JSX.Element;
    messageBody: JSX.Element;
    actionBar?: JSX.Element;
    messageStatus: JSX.Element;
    footer: JSX.Element;
};

/** Presenter-owned thread nodes injected into {@link EventTileView}. */
type EventTileThreadNodes = {
    info?: JSX.Element;
    replyCount?: number;
    preview?: JSX.Element;
    toolbar?: JSX.Element;
};

/** Presenter-owned nodes injected into {@link EventTileView}. */
type EventTileNodes = {
    content: EventTileContentNodes;
    thread: EventTileThreadNodes;
};

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
    /** Presenter-owned body nodes to inject into the view. */
    contentNodes: EventTileContentNodes;
    /** Presenter-owned thread nodes to inject into the view. */
    threadNodes: EventTileThreadNodes;
    /** Presenter-owned context menu node when open. */
    contextMenuNode?: JSX.Element;
    /** Event handlers to wire into the view. */
    actions: EventTileViewActions;
};

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

function useEventTileVmState(
    props: EventTileProps,
    forwardedRef: Ref<EventTileHandle> | undefined,
): UseEventTileVmStateResult {
    const roomContext = useContext(RoomContext);
    const cli = useMatrixClientContext();
    const { showHiddenEvents, isRoomEncrypted, timelineRenderingType } = roomContext;
    const tileContentId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const tileRef = useRef<EventTileOps>(null);
    const replyChainRef = useRef<ReplyChain>(null);
    const [suppressReadReceiptAnimation, setSuppressReadReceiptAnimation] = useState(true);
    const [contextMenuState, setContextMenuState] = useState<EventTileContextMenuState>();
    const vmReadReceipts = useMemo(
        () => props.readReceipts?.map(({ userId, ts, roomMember }) => ({ userId, ts, roomMember })),
        [props.readReceipts],
    );
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

function useEventTileCommands(
    props: EventTileProps,
    cli: ReturnType<typeof useMatrixClientContext>,
    setContextMenuState: React.Dispatch<React.SetStateAction<EventTileContextMenuState | undefined>>,
    vm: EventTileViewModel,
    snapshot: EventTileViewSnapshot,
): UseEventTileCommandsResult {
    const roomId = props.mxEvent.getRoomId();
    const room = roomId ? cli.getRoom(roomId) : null;
    const commandDeps = useMemo<EventTileCommandDeps>(
        () => ({
            dispatch: (payload) => dis.dispatch(payload),
            copyPlaintext,
            trackInteraction: (name, ev, index) => PosthogTrackers.trackInteraction(name, ev, index),
            allowOverridingNativeContextMenus: () => Boolean(PlatformPeg.get()?.allowOverridingNativeContextMenus()),
        }),
        [],
    );
    const commandContext = useMemo<EventTileCommandContext>(
        () => ({
            mxEvent: props.mxEvent,
            permalinkCreator: props.permalinkCreator,
            openedFromSearch: snapshot.openedFromSearch,
            tileClickMode: snapshot.tileClickMode,
            editState: props.editState,
        }),
        [props.mxEvent, props.permalinkCreator, snapshot.openedFromSearch, snapshot.tileClickMode, props.editState],
    );

    const onPermalinkClicked = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            onPermalinkClickedCommand(commandDeps, commandContext, ev);
        },
        [commandDeps, commandContext],
    );

    const openInRoom = useCallback(
        (_anchor: HTMLElement | null): void => {
            openEventInRoom(commandDeps, commandContext);
        },
        [commandDeps, commandContext],
    );

    const copyLinkToThread = useCallback(
        async (_anchor: HTMLElement | null): Promise<void> => {
            await copyLinkToThreadCommand(commandDeps, commandContext);
        },
        [commandDeps, commandContext],
    );

    const showContextMenu = useCallback(
        (ev: MouseEvent<HTMLElement>, permalink?: string): void => {
            const nextContextMenuState = buildContextMenuState(commandDeps, commandContext, ev, permalink);
            if (!nextContextMenuState) return;

            setContextMenuState(nextContextMenuState);
            vm.onContextMenuOpen();
        },
        [commandDeps, commandContext, setContextMenuState, vm],
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

            onListTileClickCommand(commandDeps, commandContext, ev.nativeEvent, index);
        },
        [commandDeps, commandContext],
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

type UseEventTileNodesArgs = {
    props: EventTileProps;
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
}: UseEventTileNodesArgs): EventTileNodes {
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
                    href={snapshot.threadInfoMode === ThreadInfoMode.SearchLink ? props.highlightLink : undefined}
                    label={
                        snapshot.threadInfoMode === ThreadInfoMode.SearchLink ||
                        snapshot.threadInfoMode === ThreadInfoMode.SearchText
                            ? _t("timeline|thread_info_basic")
                            : undefined
                    }
                />
            ),
        [snapshot.threadInfoMode, snapshot.threadUpdateKey, props.mxEvent, snapshot.thread, props.highlightLink],
    );
    const replyCount =
        (snapshot.threadPanelMode === ThreadPanelMode.Summary ||
            snapshot.threadPanelMode === ThreadPanelMode.SummaryWithToolbar) &&
        snapshot.thread
            ? snapshot.thread.length
            : undefined;
    const preview = useMemo(
        () =>
            (snapshot.threadPanelMode === ThreadPanelMode.Summary ||
                snapshot.threadPanelMode === ThreadPanelMode.SummaryWithToolbar) &&
            snapshot.thread ? (
                <ThreadMessagePreview key={snapshot.threadUpdateKey} thread={snapshot.thread} />
            ) : undefined,
        [snapshot.threadPanelMode, snapshot.thread, snapshot.threadUpdateKey],
    );
    const toolbar = useMemo(
        () =>
            snapshot.threadPanelMode === ThreadPanelMode.Toolbar ||
            snapshot.threadPanelMode === ThreadPanelMode.SummaryWithToolbar ? (
                <ThreadToolbarHost onViewInRoomClick={openInRoom} onCopyLinkClick={copyLinkToThread} />
            ) : undefined,
        [snapshot.threadPanelMode, openInRoom, copyLinkToThread],
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
                replyCount,
                preview,
                toolbar,
            },
        }),
        [sender, avatar, replyChain, messageBody, actionBar, messageStatus, footer, info, replyCount, preview, toolbar],
    );
}

type UseEventTileContextMenuNodeArgs = {
    props: EventTileProps;
    snapshot: EventTileViewSnapshot;
    contextMenuState?: EventTileContextMenuState;
    tileRef: RefObject<EventTileOps | null>;
    replyChainRef: RefObject<ReplyChain | null>;
    setContextMenuState: React.Dispatch<React.SetStateAction<EventTileContextMenuState | undefined>>;
    vm: EventTileViewModel;
};

function useEventTileContextMenuNode({
    props,
    snapshot,
    contextMenuState,
    tileRef,
    replyChainRef,
    setContextMenuState,
    vm,
}: UseEventTileContextMenuNodeArgs): JSX.Element | undefined {
    const closeContextMenu = useCallback((): void => {
        setContextMenuState(undefined);
        vm.onContextMenuClose();
    }, [setContextMenuState, vm]);

    return contextMenuState && snapshot.isContextMenuOpen ? (
        <EventTileContextMenuHost
            mxEvent={props.mxEvent}
            permalinkCreator={props.permalinkCreator}
            getRelationsForEvent={props.getRelationsForEvent}
            reactions={snapshot.reactions}
            contextMenu={contextMenuState}
            tileRef={tileRef}
            replyChainRef={replyChainRef}
            onFinished={closeContextMenu}
        />
    ) : undefined;
}

function useEventTileViewProps({
    props,
    vm,
    snapshot,
    roomContext,
    room,
    tileContentId,
    rootRef,
    contentNodes,
    threadNodes,
    contextMenuNode,
    actions,
}: UseEventTileViewPropsArgs): EventTileViewProps {
    const eventType = props.mxEvent.getType();
    const msgtype = props.mxEvent.getContent().msgtype;
    const isNotification = roomContext.timelineRenderingType === TimelineRenderingType.Notification;
    const isListLikeTile =
        roomContext.timelineRenderingType === TimelineRenderingType.Notification ||
        roomContext.timelineRenderingType === TimelineRenderingType.ThreadsList;
    const rootClassName = classNames({
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
            snapshot.isContinuation || eventType === EventType.CallInvite || ElementCallEventType.matches(eventType),
        mx_EventTile_last: props.last,
        mx_EventTile_lastInSection: props.lastInSection,
        mx_EventTile_contextual: props.contextual,
        mx_EventTile_actionBarFocused: snapshot.actionBarFocused,
        mx_EventTile_bad: snapshot.isEncryptionFailure,
        mx_EventTile_emote: msgtype === MsgType.Emote,
        mx_EventTile_noSender: !snapshot.showSender,
        mx_EventTile_clamp: roomContext.timelineRenderingType === TimelineRenderingType.ThreadsList || isNotification,
        mx_EventTile_noBubble: snapshot.noBubbleEvent,
    });
    const contentClassName = getContentClassName(props.mxEvent);
    const notificationRoomLabel = room
        ? _t("timeline|in_room_name", { room: room.name }, { strong: (sub) => <strong>{sub}</strong> })
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
    const encryptionIndicatorTitle = getEncryptionIndicatorTitle(
        props.mxEvent,
        snapshot,
        Boolean(roomContext.isRoomEncrypted),
    );
    const handlers = useMemo<EventTileViewProps["handlers"]>(
        () => ({
            onClick: isListLikeTile ? actions.onListTileClick : undefined,
            onContextMenu: actions.onContextMenu,
            onMouseEnter,
            onMouseLeave,
            onFocus,
            onBlur,
        }),
        [isListLikeTile, actions.onListTileClick, actions.onContextMenu, onMouseEnter, onMouseLeave, onFocus, onBlur],
    );
    const content = useMemo<EventTileViewProps["content"]>(
        () => ({
            sender: contentNodes.sender,
            avatar: contentNodes.avatar,
            replyChain: contentNodes.replyChain,
            messageStatus: contentNodes.messageStatus,
            messageBody: contentNodes.messageBody,
            actionBar: contentNodes.actionBar,
            footer: snapshot.hasFooter ? contentNodes.footer : undefined,
            contextMenu: contextMenuNode,
        }),
        [
            contentNodes.sender,
            contentNodes.avatar,
            contentNodes.replyChain,
            contentNodes.messageStatus,
            contentNodes.messageBody,
            contentNodes.actionBar,
            snapshot.hasFooter,
            contentNodes.footer,
            contextMenuNode,
        ],
    );
    const threads = useMemo<EventTileViewProps["threads"]>(
        () => ({
            info: threadNodes.info,
            replyCount: threadNodes.replyCount,
            preview: threadNodes.preview,
            toolbar: threadNodes.toolbar,
        }),
        [threadNodes.info, threadNodes.replyCount, threadNodes.preview, threadNodes.toolbar],
    );
    const timestamp = useMemo<EventTileViewProps["timestamp"]>(
        () => ({
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
    const encryption = useMemo<EventTileViewProps["encryption"]>(
        () => ({
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
    const notification = useMemo<EventTileViewProps["notification"]>(
        () => ({
            enabled: isNotification,
            roomLabel: notificationRoomLabel,
            roomAvatar: room ? (
                <div className="mx_EventTile_avatar">
                    <RoomAvatar room={room} size={AvatarSize.Medium} />
                </div>
            ) : undefined,
            unreadBadge: room ? (
                <UnreadNotificationBadge room={room} threadId={props.mxEvent.getId()} forceDot={true} />
            ) : undefined,
        }),
        [isNotification, notificationRoomLabel, room, props.mxEvent],
    );

    return {
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
    };
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

type ThreadToolbarHostProps = {
    onViewInRoomClick: (anchor: HTMLElement | null) => void;
    onCopyLinkClick: (anchor: HTMLElement | null) => void | Promise<void>;
};

function buildThreadToolbarViewModelProps({
    onViewInRoomClick,
    onCopyLinkClick,
}: ThreadToolbarHostProps): ThreadListActionBarViewModelProps {
    return {
        onViewInRoomClick,
        onCopyLinkClick,
    };
}

function ThreadToolbarHost({ onViewInRoomClick, onCopyLinkClick }: ThreadToolbarHostProps): JSX.Element {
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
    } = useEventTileVmState(props, forwardedRef);
    const {
        room,
        onPermalinkClicked,
        openInRoom,
        copyLinkToThread,
        onContextMenu,
        onTimestampContextMenu,
        onListTileClick,
    } = useEventTileCommands(props, cli, setContextMenuState, vm, vmSnapshot);
    const onActionBarFocusChange = useCallback(
        (focused: boolean): void => {
            vm.onActionBarFocusChange(focused, rootRef.current?.matches(":hover") ?? false);
        },
        [vm, rootRef],
    );
    const toggleThreadExpanded = useCallback((): void => {
        vm.setQuoteExpanded(!vmSnapshot.isQuoteExpanded);
    }, [vm, vmSnapshot.isQuoteExpanded]);
    const nodes = useEventTileNodes({
        props,
        roomContext,
        snapshot: vmSnapshot,
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
        snapshot: vmSnapshot,
        contextMenuState,
        tileRef,
        replyChainRef,
        setContextMenuState,
        vm,
    });

    const eventTileViewProps = useEventTileViewProps({
        props,
        vm,
        snapshot: vmSnapshot,
        roomContext,
        room,
        tileContentId,
        rootRef,
        contentNodes: nodes.content,
        threadNodes: nodes.thread,
        contextMenuNode,
        actions: {
            onContextMenu,
            onPermalinkClicked,
            onTimestampContextMenu,
            openInRoom,
            copyLinkToThread,
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
