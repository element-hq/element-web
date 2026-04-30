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
    type Ref,
    type RefObject,
} from "react";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import type { EventStatus, MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    EventTileViewModel,
    type EventTileViewModelProps,
} from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import RoomContext from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import dis from "../../../../dispatcher/dispatcher";
import PosthogTrackers from "../../../../PosthogTrackers";
import { copyPlaintext } from "../../../../utils/strings";
import { EventTileView, type EventTileViewProps } from "./EventTileView";
import { _t } from "../../../../languageHandler";
import PlatformPeg from "../../../../PlatformPeg";
import type { Layout } from "../../../../settings/enums/Layout";
import type LegacyCallEventGrouper from "../../../structures/LegacyCallEventGrouper";
import RoomAvatar from "../../avatars/RoomAvatar";
import { UnreadNotificationBadge } from "../NotificationBadge/UnreadNotificationBadge";
import { AvatarSize } from "../../../../models/rooms/EventTileModel";
import type ReplyChain from "../../elements/ReplyChain";
import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { type IReadReceiptPosition } from "../ReadReceiptMarker";
import type { EventTileOps, GetRelationsForEvent, ReadReceiptProps } from "./types";
import { type EventTileCommandDeps } from "./EventTileCommands";
import { useContextMenuNode } from "./ContextMenu";
import { useEventTileCommands } from "./useEventTileCommands";
import { useEventTileNodes } from "./useEventTileNodes";
import { CardContext } from "../../right_panel/context";
import { useRoomMemberProfile } from "../../../../hooks/room/useRoomMemberProfile";
import { useUserStatus } from "../../../../hooks/useUserStatus";

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
export type EventTileHostProps = EventTileCoreProps &
    EventTileRenderingProps &
    EventTileRelationProps &
    EventTileEditingProps &
    EventTileEnvironmentProps;

function buildEventTileViewModelProps(
    props: EventTileHostProps,
    readReceipts: EventTileViewModelProps["readReceipts"],
    senderMember: EventTileViewModelProps["senderMember"],
    senderUserStatus: EventTileViewModelProps["senderUserStatus"],
    cli: ReturnType<typeof useMatrixClientContext>,
    commandDeps: EventTileViewModelProps["commandDeps"],
    roomContext: Pick<
        React.ContextType<typeof RoomContext>,
        "timelineRenderingType" | "isRoomEncrypted" | "showHiddenEvents" | "canSendMessages" | "canReact" | "search"
    >,
    isCard: boolean,
): EventTileViewModelProps {
    return {
        mxEvent: props.mxEvent,
        senderMember,
        senderUserStatus,
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
        canSendMessages: roomContext.canSendMessages,
        canReact: roomContext.canReact,
        isSearch: Boolean(roomContext.search),
        isCard,
    };
}

function renderStrongSubstitution(sub: React.ReactNode): JSX.Element {
    return <strong>{sub}</strong>;
}

/** Owns the `EventTileViewModel` lifecycle and connects the derived snapshot to the tile view. */
export function EventTileHost({ ref: forwardedRef, ...props }: Readonly<EventTileHostProps>): JSX.Element {
    const roomContext = useContext(RoomContext);
    const { isCard } = useContext(CardContext);
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
    const { showHiddenEvents, isRoomEncrypted, timelineRenderingType, canSendMessages, canReact, search } = roomContext;
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
    const sender = mxEvent.getSender();
    const senderMember = useRoomMemberProfile({
        userId: sender,
        member: mxEvent.sender,
    });
    const senderUserStatus = useUserStatus(sender);
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
                senderMember,
                senderUserStatus,
                cli,
                commandDeps,
                {
                    showHiddenEvents,
                    isRoomEncrypted,
                    timelineRenderingType,
                    canSendMessages,
                    canReact,
                    search,
                },
                isCard,
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
            senderMember,
            senderUserStatus,
            cli,
            commandDeps,
            showHiddenEvents,
            isRoomEncrypted,
            timelineRenderingType,
            canSendMessages,
            canReact,
            search,
            isCard,
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
    }, [props.resizeObserver, props.as, roomContext.timelineRenderingType, snapshot.rendering.hasRenderer]);
    useEffect(() => {
        setSuppressReadReceiptAnimation(false);
    }, []);

    const { room, onPermalinkClicked, onContextMenu, onPermalinkContextMenu, onListTileClick } = useEventTileCommands(
        props,
        cli,
        vm,
    );
    const onActionBarFocusChange = useCallback(
        (focused: boolean): void => {
            vm.onActionBarFocusChange(focused, rootRef.current?.matches(":hover") ?? false);
        },
        [vm, rootRef],
    );
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
    });
    const contextMenuNode = useContextMenuNode({
        props,
        snapshot,
        tileRef,
        replyChainRef,
        vm,
    });
    const notificationRoomLabel = room
        ? _t(
              "timeline|in_room_name",
              { room: snapshot.presentation.notificationRoomName ?? room.name },
              { strong: renderStrongSubstitution },
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
            eventId: snapshot.presentation.eventId,
            layout: props.layout,
            timelineRenderingType: roomContext.timelineRenderingType,
            rootClassName: snapshot.presentation.rootClassName,
            contentClassName: snapshot.presentation.contentClassName,
            ariaLive: snapshot.presentation.ariaLive,
            scrollTokens: snapshot.timestamp.scrollToken,
            isOwnEvent: snapshot.sender.isOwnEvent,
            content: {
                sender: nodes.content.sender,
                avatar: nodes.content.avatar,
                replyChain: nodes.content.replyChain,
                messageStatus: nodes.content.messageStatus,
                messageBody: nodes.content.messageBody,
                actionBar: nodes.content.actionBar,
                footer: snapshot.rendering.hasFooter ? nodes.content.footer : undefined,
                contextMenu: contextMenuNode,
            },
            threads: {
                info: nodes.thread.info,
                replyCount: nodes.thread.replyCount,
                preview: nodes.thread.preview,
                toolbar: nodes.thread.toolbar,
            },
            timestamp: {
                displayMode: snapshot.timestamp.timestampDisplayMode,
                receivedTs: snapshot.timestamp.receivedTs,
                vm: vm.timestampViewModel,
            },
            fileDetailsLink: {
                href: snapshot.timestamp.permalink,
                onClick: onPermalinkClicked,
                onContextMenu: onPermalinkContextMenu,
            },
            encryption: {
                padlockMode: snapshot.encryption.padlockMode,
                mode: snapshot.encryption.encryptionIndicatorMode,
                indicatorTitle: snapshot.encryption.encryptionIndicatorTitle,
                sharedKeysUserId: snapshot.encryption.sharedKeysUserId,
                sharedKeysRoomId: snapshot.encryption.sharedKeysRoomId,
            },
            notification: {
                enabled: snapshot.presentation.isNotification,
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
                onClick: snapshot.presentation.isListLikeTile ? onListTileClick : undefined,
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
            props.mxEvent,
            rootRef,
            tileContentId,
            snapshot.presentation.eventId,
            snapshot.presentation.rootClassName,
            snapshot.presentation.contentClassName,
            snapshot.presentation.ariaLive,
            snapshot.timestamp.scrollToken,
            snapshot.sender.isOwnEvent,
            snapshot.rendering.hasFooter,
            snapshot.timestamp.timestampDisplayMode,
            snapshot.timestamp.receivedTs,
            snapshot.timestamp.permalink,
            vm.timestampViewModel,
            snapshot.encryption.padlockMode,
            snapshot.encryption.encryptionIndicatorMode,
            snapshot.encryption.encryptionIndicatorTitle,
            snapshot.encryption.sharedKeysUserId,
            snapshot.encryption.sharedKeysRoomId,
            snapshot.presentation.isListLikeTile,
            snapshot.presentation.isNotification,
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
            onPermalinkContextMenu,
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

    if (snapshot.presentation.shouldRenderMissingRendererFallback) {
        return (
            <div ref={rootRef as React.Ref<HTMLDivElement>} className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
            </div>
        );
    }

    return <EventTileView {...eventTileViewProps} />;
}
