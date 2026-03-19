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
    type JSX,
    type MouseEvent,
    type Ref,
    type RefObject,
} from "react";
import classNames from "classnames";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import {
    EventStatus,
    EventType,
    MsgType,
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
import { type ButtonEvent } from "../../elements/AccessibleButton";
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
import { type ActionBarProps } from "./ActionBar";
import { type ContextMenuProps, type ContextMenuState } from "./ContextMenu";
import type { EventTileOps, GetRelationsForEvent, ReadReceiptProps } from "./types";
import { type ReplyPreviewProps } from "./ReplyPreview";
import { ThreadInfo } from "./ThreadInfo";
import { MediaEventHelper as TileMediaEventHelper } from "../../../../utils/MediaEventHelper";
import { haveRendererForEvent } from "../../../../events/EventTileFactory";

/**
 * Ref handle for consumers that need direct access to tile actions and the root element.
 */
export interface EventTileHandle extends EventTileOps {
    /**
     * Ref to the tile's root DOM element.
     */
    ref: RefObject<HTMLElement | null>;
    /**
     * Recomputes derived tile state without changing props.
     */
    forceUpdate(): void;
}

interface EventTileCoreProps {
    mxEvent: MatrixEvent;
    eventSendStatus?: EventStatus;
    ref?: Ref<EventTileHandle>;
}

interface EventTileRenderingProps {
    as?: string;
    layout?: Layout;
    isTwelveHour?: boolean;
    forExport?: boolean;
    alwaysShowTimestamps?: boolean;
    isRedacted?: boolean;
    continuation?: boolean;
    last?: boolean;
    lastInSection?: boolean;
    lastSuccessful?: boolean;
    contextual?: boolean;
    isSelectedEvent?: boolean;
    hideSender?: boolean;
    hideTimestamp?: boolean;
    inhibitInteraction?: boolean;
    isSeeingThroughMessageHiddenForModeration?: boolean;
    showUrlPreview?: boolean;
    highlights?: string[];
    highlightLink?: string;
}

interface EventTileRelationProps {
    getRelationsForEvent?: GetRelationsForEvent;
    showReactions?: boolean;
    showReadReceipts?: boolean;
    readReceipts?: ReadReceiptProps[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
}

interface EventTileEditingProps {
    editState?: EditorStateTransfer;
    replacingEventId?: string;
    checkUnmounting?: () => boolean;
}

interface EventTileEnvironmentProps {
    resizeObserver?: ResizeObserver;
    permalinkCreator?: RoomPermalinkCreator;
    callEventGrouper?: LegacyCallEventGrouper;
}

/**
 * Props consumed by {@link EventTilePresenter} to render a single timeline tile.
 */
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

type UseEventTileViewModelResult = {
    cli: ReturnType<typeof useMatrixClientContext>;
    roomContext: React.ContextType<typeof RoomContext>;
    tileContentId: string;
    rootRef: RefObject<HTMLElement | null>;
    tileRef: RefObject<EventTileOps | null>;
    replyChainRef: RefObject<ReplyChain | null>;
    suppressReadReceiptAnimation: boolean;
    contextMenuState?: ContextMenuState;
    setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | undefined>>;
    vm: EventTileViewModel;
    snapshot: EventTileViewSnapshot;
};

type UseEventTileActionsResult = {
    room: Room | null;
    openInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => Promise<void>;
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
    onContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    onTimestampContextMenu: (ev: MouseEvent<HTMLElement>) => void;
};

type EventTileViewRenderContent = {
    replyChain?: ReplyPreviewProps;
    actionBar?: ActionBarProps;
    contextMenu?: ContextMenuProps;
};

type EventTileViewActions = {
    openInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => Promise<void>;
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
    onContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    onTimestampContextMenu: (ev: MouseEvent<HTMLElement>) => void;
};

type UseEventTileViewPropsArgs = {
    props: EventTileProps;
    vm: EventTileViewModel;
    snapshot: EventTileViewSnapshot;
    roomContext: React.ContextType<typeof RoomContext>;
    room: Room | null;
    tileContentId: string;
    rootRef: RefObject<HTMLElement | null>;
    tileRef: RefObject<EventTileOps | null>;
    suppressReadReceiptAnimation: boolean;
    renderedContent: EventTileViewRenderContent;
    actions: EventTileViewActions;
};

function getRootClassName(
    mxEvent: MatrixEvent,
    isTwelveHour: boolean | undefined,
    isSelectedEvent: boolean | undefined,
    last: boolean | undefined,
    lastInSection: boolean | undefined,
    contextual: boolean | undefined,
    snapshot: EventTileViewSnapshot,
    timelineRenderingType: TimelineRenderingType,
): string {
    const msgtype = mxEvent.getContent().msgtype;
    const eventType = mxEvent.getType();
    const isRenderingNotification = timelineRenderingType === TimelineRenderingType.Notification;

    return classNames({
        mx_EventTile_bubbleContainer: snapshot.isBubbleMessage,
        mx_EventTile_leftAlignedBubble: snapshot.isLeftAlignedBubbleMessage,
        mx_EventTile: true,
        mx_EventTile_isEditing: snapshot.isEditing,
        mx_EventTile_info: snapshot.isInfoMessage,
        mx_EventTile_12hr: isTwelveHour,
        mx_EventTile_sending: !snapshot.isEditing && snapshot.isSending,
        mx_EventTile_highlight: snapshot.isHighlighted,
        mx_EventTile_selected: isSelectedEvent || snapshot.isContextMenuOpen,
        mx_EventTile_continuation:
            snapshot.isContinuation || eventType === EventType.CallInvite || ElementCallEventType.matches(eventType),
        mx_EventTile_last: last,
        mx_EventTile_lastInSection: lastInSection,
        mx_EventTile_contextual: contextual,
        mx_EventTile_actionBarFocused: snapshot.actionBarFocused,
        mx_EventTile_bad: snapshot.isEncryptionFailure,
        mx_EventTile_emote: msgtype === MsgType.Emote,
        mx_EventTile_noSender: !snapshot.showSender,
        mx_EventTile_clamp: timelineRenderingType === TimelineRenderingType.ThreadsList || isRenderingNotification,
        mx_EventTile_noBubble: snapshot.noBubbleEvent,
    });
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
        (evt: ButtonEvent): void => {
            evt.preventDefault();
            evt.stopPropagation();
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
        async (evt: ButtonEvent): Promise<void> => {
            evt.preventDefault();
            evt.stopPropagation();
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
            vm.setContextMenuOpen(true);
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
                    openInRoom(ev);
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

/**
 * Headless presenter for a single event tile that wires the view model to the view.
 */
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
    const onActionBarFocusChange = useCallback((focused: boolean): void => vm.setActionBarFocused(focused), [vm]);
    const toggleThreadExpanded = useCallback((): void => {
        vm.setQuoteExpanded(!vmSnapshot.isQuoteExpanded);
    }, [vm, vmSnapshot.isQuoteExpanded]);
    const closeContextMenu = useCallback((): void => {
        setContextMenuState(undefined);
        vm.setContextMenuOpen(false);
    }, [setContextMenuState, vm]);
    const shouldRenderReplyPreview = useMemo(
        () => vmSnapshot.showReplyPreview && haveRendererForEvent(props.mxEvent, cli, roomContext.showHiddenEvents),
        [vmSnapshot.showReplyPreview, props.mxEvent, cli, roomContext.showHiddenEvents],
    );

    const replyChain = useMemo(
        (): ReplyPreviewProps | undefined =>
            shouldRenderReplyPreview
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
            shouldRenderReplyPreview,
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
        (): ActionBarProps => ({
            mxEvent: props.mxEvent,
            forExport: props.forExport,
            permalinkCreator: props.permalinkCreator,
            getRelationsForEvent: props.getRelationsForEvent,
            reactions: vmSnapshot.reactions,
            isEditing: vmSnapshot.isEditing,
            isQuoteExpanded: vmSnapshot.isQuoteExpanded,
            tileRef,
            replyChainRef,
            onFocusChange: onActionBarFocusChange,
            toggleThreadExpanded,
        }),
        [
            props.mxEvent,
            props.forExport,
            props.permalinkCreator,
            props.getRelationsForEvent,
            vmSnapshot.isEditing,
            vmSnapshot.reactions,
            vmSnapshot.isQuoteExpanded,
            tileRef,
            replyChainRef,
            onActionBarFocusChange,
            toggleThreadExpanded,
        ],
    );

    const contextMenu = useMemo(
        (): ContextMenuProps | undefined =>
            contextMenuState && vmSnapshot.isContextMenuOpen
                ? {
                      mxEvent: props.mxEvent,
                      permalinkCreator: props.permalinkCreator,
                      getRelationsForEvent: props.getRelationsForEvent,
                      reactions: vmSnapshot.reactions,
                      contextMenu: contextMenuState,
                      tileRef,
                      replyChainRef,
                      onFinished: closeContextMenu,
                  }
                : undefined,
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
        },
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
    const rootClassName = useMemo(
        () =>
            getRootClassName(
                props.mxEvent,
                props.isTwelveHour,
                props.isSelectedEvent,
                props.last,
                props.lastInSection,
                props.contextual,
                snapshot,
                roomContext.timelineRenderingType,
            ),
        [
            props.mxEvent,
            props.isTwelveHour,
            props.isSelectedEvent,
            props.last,
            props.lastInSection,
            props.contextual,
            snapshot,
            roomContext.timelineRenderingType,
        ],
    );
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
                    <RoomAvatar room={room} size="28px" />
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
    const onFocus = useCallback((): void => vm.setFocusWithin(true), [vm]);
    const onBlur = useCallback((): void => vm.setFocusWithin(false), [vm]);
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
    const messageBody: MessageBodyProps = useMemo(
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
    const content = useMemo(
        (): EventTileViewProps["content"] => ({
            sender: {
                mode: snapshot.senderMode,
                mxEvent: props.mxEvent,
                onClick: onSenderProfileClick,
            },
            avatar: {
                member: avatarMember,
                size: snapshot.avatarSize,
                viewUserOnClick: snapshot.avatarMemberUserOnClick,
                forceHistorical: snapshot.avatarForceHistorical,
            },
            replyChain: renderedContent.replyChain,
            messageStatus: {
                messageState: props.eventSendStatus,
                shouldShowSentReceipt: snapshot.shouldShowSentReceipt,
                shouldShowSendingReceipt: snapshot.shouldShowSendingReceipt,
                showReadReceipts: snapshot.showReadReceipts,
                readReceipts: props.readReceipts,
                readReceiptMap: props.readReceiptMap,
                checkUnmounting: props.checkUnmounting,
                isTwelveHour: props.isTwelveHour,
                suppressReadReceiptAnimation,
            },
            messageBody,
            actionBar: renderedContent.actionBar,
            footer: {
                enabled: snapshot.hasFooter,
                layout: props.layout,
                mxEvent: props.mxEvent,
                isRedacted: props.isRedacted,
                isPinned: snapshot.isPinned,
                isOwnEvent: snapshot.isOwnEvent,
                reactions: snapshot.reactions,
                tileContentId,
            },
            contextMenu: renderedContent.contextMenu,
        }),
        [
            snapshot.senderMode,
            props.mxEvent,
            onSenderProfileClick,
            avatarMember,
            snapshot.avatarSize,
            snapshot.avatarMemberUserOnClick,
            snapshot.avatarForceHistorical,
            renderedContent.replyChain,
            props.eventSendStatus,
            snapshot.shouldShowSentReceipt,
            snapshot.shouldShowSendingReceipt,
            snapshot.showReadReceipts,
            props.readReceipts,
            props.readReceiptMap,
            props.checkUnmounting,
            props.isTwelveHour,
            suppressReadReceiptAnimation,
            messageBody,
            renderedContent.actionBar,
            snapshot.hasFooter,
            props.layout,
            props.isRedacted,
            snapshot.isPinned,
            snapshot.isOwnEvent,
            snapshot.reactions,
            tileContentId,
            renderedContent.contextMenu,
        ],
    );
    const threads = useMemo(
        (): EventTileViewProps["threads"] => ({
            info: threadInfo,
            replyCount: threadPanelReplyCount,
            preview: threadPanelPreview,
            showToolbar:
                snapshot.threadPanelMode === ThreadPanelMode.Toolbar ||
                snapshot.threadPanelMode === ThreadPanelMode.SummaryWithToolbar,
            openInRoom: actions.openInRoom,
            copyLinkToThread: actions.copyLinkToThread,
        }),
        [
            threadInfo,
            threadPanelReplyCount,
            threadPanelPreview,
            snapshot.threadPanelMode,
            actions.openInRoom,
            actions.copyLinkToThread,
        ],
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
            ariaLive: props.eventSendStatus !== null ? "off" : undefined,
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
