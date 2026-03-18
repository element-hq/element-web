/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    useContext,
    useEffect,
    useImperativeHandle,
    useId,
    useMemo,
    useRef,
    type JSX,
    type MouseEvent,
    type ReactNode,
    type Ref,
    type RefObject,
} from "react";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import {
    type EventStatus,
    type EventType,
    type MatrixEvent,
    type RelationType,
    type Relations,
    type Room,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";

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
import { type Layout } from "../../../../settings/enums/Layout";
import { getLateEventInfo } from "../../../structures/grouper/LateEventGrouper";
import type LegacyCallEventGrouper from "../../../structures/LegacyCallEventGrouper";
import RoomAvatar from "../../avatars/RoomAvatar";
import ThreadSummary, { ThreadMessagePreview } from "../ThreadSummary";
import { UnreadNotificationBadge } from "../NotificationBadge/UnreadNotificationBadge";
import { ClickMode, ThreadInfoMode } from "./EventTileModes";
import type ReplyChain from "../../elements/ReplyChain";
import type { ComposerInsertPayload } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { type IReadReceiptPosition } from "../ReadReceiptMarker";
import { Avatar } from "./Avatar";
import { MessageBody } from "./MessageBody";
import { ActionBar } from "./ActionBar";
import { ContextMenu } from "./ContextMenu";
import { Footer } from "./Footer";
import { MessageStatus } from "./MessageStatus";
import { ReplyPreview } from "./ReplyPreview";
import { Sender } from "./Sender";
import { ThreadInfo } from "./ThreadInfo";

export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

export interface ReadReceiptProps {
    userId: string;
    roomMember: RoomMember | null;
    ts: number;
}

export interface EventTileOps {
    isWidgetHidden(): boolean;
    unhideWidget(): void;
}

export interface EventTileApi {
    getEventTileOps?(): EventTileOps;
    getMediaHelper(): { destroy?(): void } | undefined;
}

export interface EventTileHandle {
    ref: RefObject<HTMLElement | null>;
    forceUpdate(): void;
    getEventTileOps?: EventTileApi["getEventTileOps"];
    getMediaHelper: EventTileApi["getMediaHelper"];
}

export interface EventTileProps {
    mxEvent: MatrixEvent;
    isRedacted?: boolean;
    continuation?: boolean;
    last?: boolean;
    lastInSection?: boolean;
    lastSuccessful?: boolean;
    contextual?: boolean;
    highlights?: string[];
    highlightLink?: string;
    showUrlPreview?: boolean;
    isSelectedEvent?: boolean;
    resizeObserver?: ResizeObserver;
    readReceipts?: ReadReceiptProps[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    checkUnmounting?: () => boolean;
    eventSendStatus?: EventStatus;
    forExport?: boolean;
    isTwelveHour?: boolean;
    getRelationsForEvent?: GetRelationsForEvent;
    showReactions?: boolean;
    layout?: Layout;
    showReadReceipts?: boolean;
    editState?: EditorStateTransfer;
    replacingEventId?: string;
    permalinkCreator?: RoomPermalinkCreator;
    callEventGrouper?: LegacyCallEventGrouper;
    as?: string;
    alwaysShowTimestamps?: boolean;
    hideSender?: boolean;
    isSeeingThroughMessageHiddenForModeration?: boolean;
    hideTimestamp?: boolean;
    inhibitInteraction?: boolean;
    ref?: Ref<EventTileHandle>;
}

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

interface UseEventTileViewModelResult {
    cli: ReturnType<typeof useMatrixClientContext>;
    roomContext: React.ContextType<typeof RoomContext>;
    tileContentId: string;
    rootRef: RefObject<HTMLElement | null>;
    tileRef: RefObject<EventTileApi | null>;
    replyChainRef: RefObject<ReplyChain | null>;
    vm: EventTileViewModel;
    snapshot: EventTileViewSnapshot;
}

interface UseEventTileActionsResult {
    room: Room | null;
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    viewInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => Promise<void>;
    onContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    onTimestampContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
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
    const tileRef = useRef<EventTileApi>(null);
    const replyChainRef = useRef<ReplyChain>(null);
    const vmReadReceipts = useMemo(() => readReceipts?.map(({ userId, ts }) => ({ userId, ts })), [readReceipts]);
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
            get getEventTileOps(): EventTileApi["getEventTileOps"] {
                return tileRef.current?.getEventTileOps?.bind(tileRef.current);
            },
            getMediaHelper: () => tileRef.current?.getMediaHelper(),
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

    return {
        cli,
        roomContext,
        tileContentId,
        rootRef,
        tileRef,
        replyChainRef,
        vm,
        snapshot,
    };
}

function useEventTileActions(
    props: EventTileProps,
    cli: ReturnType<typeof useMatrixClientContext>,
    roomContext: React.ContextType<typeof RoomContext>,
    vm: EventTileViewModel,
    snapshot: EventTileViewSnapshot,
): UseEventTileActionsResult {
    const roomId = props.mxEvent.getRoomId();
    const room = roomId ? cli.getRoom(roomId) : null;

    const onPermalinkClicked = (ev: MouseEvent<HTMLElement>): void => {
        ev.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: props.mxEvent.getId(),
            highlighted: true,
            room_id: props.mxEvent.getRoomId(),
            metricsTrigger: snapshot.viewRoomMetricsTrigger,
        });
    };

    const viewInRoom = (evt: ButtonEvent): void => {
        evt.preventDefault();
        evt.stopPropagation();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: props.mxEvent.getId(),
            highlighted: true,
            room_id: props.mxEvent.getRoomId(),
            metricsTrigger: undefined,
        });
    };

    const copyLinkToThread = async (evt: ButtonEvent): Promise<void> => {
        evt.preventDefault();
        evt.stopPropagation();
        if (!props.permalinkCreator) return;
        await copyPlaintext(props.permalinkCreator.forEvent(props.mxEvent.getId()!));
    };

    const showContextMenu = (ev: MouseEvent<HTMLElement>, permalink?: string): void => {
        const clickTarget = ev.target as HTMLElement;
        const anchorElement = clickTarget instanceof HTMLAnchorElement ? clickTarget : clickTarget.closest("a");

        if (clickTarget instanceof HTMLImageElement) return;
        if (!PlatformPeg.get()?.allowOverridingNativeContextMenus() && anchorElement) return;
        if (props.editState) return;

        ev.preventDefault();
        ev.stopPropagation();
        vm.setContextMenu({
            position: {
                left: ev.clientX,
                top: ev.clientY,
                bottom: ev.clientY,
            },
            link: anchorElement?.href || permalink,
        });
    };

    const onContextMenu = (ev: MouseEvent<HTMLElement>): void => {
        showContextMenu(ev);
    };

    const onTimestampContextMenu = (ev: MouseEvent<HTMLElement>): void => {
        showContextMenu(ev, props.permalinkCreator?.forEvent(props.mxEvent.getId()!));
    };

    const onListTileClick = (ev: MouseEvent<HTMLElement>): void => {
        const target = ev.currentTarget as HTMLElement;
        let index = -1;
        if (target.parentElement) index = Array.from(target.parentElement.children).indexOf(target);

        switch (snapshot.tileClickMode) {
            case ClickMode.ViewRoom:
                viewInRoom(ev as never);
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
    };

    return {
        room,
        onPermalinkClicked,
        viewInRoom,
        copyLinkToThread,
        onContextMenu,
        onTimestampContextMenu,
        onListTileClick,
    };
}

export function UnwrappedEventTile({ ref: forwardedRef, ...props }: EventTileProps): JSX.Element {
    const {
        cli,
        roomContext,
        tileContentId,
        rootRef,
        tileRef,
        replyChainRef,
        vm,
        snapshot: vmSnapshot,
    } = useEventTileViewModel(props, forwardedRef);
    const renderTileProps = props;
    const {
        room,
        onPermalinkClicked,
        viewInRoom,
        copyLinkToThread,
        onContextMenu,
        onTimestampContextMenu,
        onListTileClick,
    } = useEventTileActions(props, cli, roomContext, vm, vmSnapshot);

    const messageBody: ReactNode = useMemo(
        () => (
            <MessageBody
                mxEvent={props.mxEvent}
                timelineRenderingType={roomContext.timelineRenderingType}
                tileRenderType={vmSnapshot.tileRenderType}
                isSeeingThroughMessageHiddenForModeration={vmSnapshot.isSeeingThroughMessageHiddenForModeration}
                renderTileProps={renderTileProps}
                tileRef={tileRef}
                permalinkCreator={props.permalinkCreator}
                showHiddenEvents={roomContext.showHiddenEvents}
            />
        ),
        [
            props.mxEvent,
            props.permalinkCreator,
            renderTileProps,
            tileRef,
            roomContext.timelineRenderingType,
            roomContext.showHiddenEvents,
            vmSnapshot.tileRenderType,
            vmSnapshot.isSeeingThroughMessageHiddenForModeration,
        ],
    );

    const replyChain = useMemo(
        () => (
            <ReplyPreview
                props={props}
                cli={cli}
                showHiddenEvents={roomContext.showHiddenEvents}
                hover={vmSnapshot.hover}
                focusWithin={vmSnapshot.focusWithin}
                isQuoteExpanded={vmSnapshot.isQuoteExpanded}
                replyChainRef={replyChainRef}
                setQuoteExpanded={(expanded) => vm.setQuoteExpanded(expanded)}
            />
        ),
        [
            props,
            cli,
            roomContext.showHiddenEvents,
            replyChainRef,
            vm,
            vmSnapshot.hover,
            vmSnapshot.focusWithin,
            vmSnapshot.isQuoteExpanded,
        ],
    );

    const actionBar = useMemo(
        () => (
            <ActionBar
                props={props}
                reactions={vmSnapshot.reactions}
                isEditing={vmSnapshot.isEditing}
                isQuoteExpanded={vmSnapshot.isQuoteExpanded}
                tileRef={tileRef}
                replyChainRef={replyChainRef}
                onFocusChange={(focused) => vm.setActionBarFocused(focused)}
                toggleThreadExpanded={() => vm.setQuoteExpanded(!vmSnapshot.isQuoteExpanded)}
            />
        ),
        [props, vmSnapshot.isEditing, vmSnapshot.reactions, vmSnapshot.isQuoteExpanded, tileRef, replyChainRef, vm],
    );

    const contextMenu = vmSnapshot.contextMenu ? (
        <ContextMenu
            props={props}
            contextMenu={vmSnapshot.contextMenu}
            snapshot={vmSnapshot}
            tileRef={tileRef}
            replyChainRef={replyChainRef}
            onFinished={() => vm.setContextMenu(undefined)}
        />
    ) : undefined;

    const eventTileViewProps = useEventTileViewProps({
        props,
        vm,
        snapshot: vmSnapshot,
        roomContext,
        room,
        tileContentId,
        rootRef,
        actionBar,
        contextMenu,
        replyChain,
        messageBody,
        onContextMenu,
        onPermalinkClicked,
        onTimestampContextMenu,
        viewInRoom,
        copyLinkToThread,
        onListTileClick,
    });

    if (!vmSnapshot.hasRenderer && roomContext.timelineRenderingType !== TimelineRenderingType.Notification) {
        return (
            <div ref={rootRef as React.Ref<HTMLDivElement>} className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
            </div>
        );
    }

    return <EventTileView {...eventTileViewProps} />;
}

interface UseEventTileViewPropsArgs {
    props: EventTileProps;
    vm: EventTileViewModel;
    snapshot: EventTileViewSnapshot;
    roomContext: React.ContextType<typeof RoomContext>;
    room: Room | null;
    tileContentId: string;
    rootRef: RefObject<HTMLElement | null>;
    actionBar?: ReactNode;
    contextMenu?: ReactNode;
    replyChain?: ReactNode;
    messageBody: ReactNode;
    onContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    onTimestampContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    viewInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => Promise<void>;
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
}

function useEventTileViewProps({
    props,
    vm,
    snapshot,
    roomContext,
    room,
    tileContentId,
    rootRef,
    actionBar,
    contextMenu,
    replyChain,
    messageBody,
    onContextMenu,
    onPermalinkClicked,
    onTimestampContextMenu,
    viewInRoom,
    copyLinkToThread,
    onListTileClick,
}: UseEventTileViewPropsArgs): EventTileViewProps {
    const avatarMember = getAvatarMember(props);
    const onSenderProfileClick = (): void => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: props.mxEvent.getSender()!,
            timelineRenderingType: roomContext.timelineRenderingType,
        });
    };
    const footer = <Footer props={props} snapshot={snapshot} tileContentId={tileContentId} />;
    const sender = <Sender mode={snapshot.senderMode} mxEvent={props.mxEvent} onClick={onSenderProfileClick} />;
    const avatar = (
        <Avatar
            member={avatarMember}
            size={snapshot.avatarSize}
            viewUserOnClick={snapshot.avatarMemberUserOnClick}
            forceHistorical={snapshot.avatarForceHistorical}
        />
    );
    const threadInfo =
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
        );
    const threadPanelReplyCount =
        snapshot.showThreadPanelSummary && snapshot.thread ? snapshot.thread.length : undefined;
    const threadPanelPreview =
        snapshot.showThreadPanelSummary && snapshot.thread ? (
            <ThreadMessagePreview key={snapshot.threadUpdateKey} thread={snapshot.thread} />
        ) : undefined;
    const messageStatus = (
        <MessageStatus
            messageState={props.eventSendStatus}
            snapshot={snapshot}
            readReceipts={props.readReceipts}
            readReceiptMap={props.readReceiptMap}
            checkUnmounting={props.checkUnmounting}
            isTwelveHour={props.isTwelveHour}
        />
    );
    const notificationRoomLabel = room
        ? _t("timeline|in_room_name", { room: room.name }, { strong: (sub) => <strong>{sub}</strong> })
        : undefined;
    const notificationRoomAvatar = room ? (
        <div className="mx_EventTile_avatar">
            <RoomAvatar room={room} size="28px" />
        </div>
    ) : undefined;
    const unreadBadge = room ? (
        <UnreadNotificationBadge room={room} threadId={props.mxEvent.getId()} forceDot={true} />
    ) : undefined;

    const commonProps: EventTileViewProps = {
        as: props.as,
        rootRef,
        id: tileContentId,
        eventId: props.mxEvent.getId() ?? undefined,
        layout: props.layout,
        timelineRenderingType: roomContext.timelineRenderingType,
        classes: snapshot.classes,
        lineClasses: snapshot.lineClasses,
        ariaLive: props.eventSendStatus !== null ? ("off" as const) : undefined,
        scrollToken: snapshot.scrollToken,
        isTwelveHour: props.isTwelveHour,
        isOwnEvent: snapshot.isOwnEvent,
        isRenderingNotification: roomContext.timelineRenderingType === TimelineRenderingType.Notification,
        replyChain,
        actionBar,
        avatar,
        sender,
        messageStatus,
        footer,
        showThreadToolbar: snapshot.showThreadToolbar,
        showTimestamp: snapshot.showTimestamp,
        showLinkedTimestamp: snapshot.showLinkedTimestamp,
        showDummyTimestamp: snapshot.showDummyTimestamp,
        timestampTs: snapshot.timestampTs,
        timestampReceivedTs: getLateEventInfo(props.mxEvent)?.received_ts,
        showRelativeTimestamp: snapshot.showRelativeTimestamp,
        showGroupPadlock: snapshot.showGroupPadlock,
        showIrcPadlock: snapshot.showIrcPadlock,
        encryptionIndicatorMode: snapshot.encryptionIndicatorMode,
        encryptionIndicatorTitle: snapshot.encryptionIndicatorTitle,
        sharedKeysUserId: snapshot.sharedKeysUserId,
        sharedKeysRoomId: snapshot.sharedKeysRoomId,
        notificationRoomLabel,
        notificationRoomAvatar,
        unreadBadge,
        onMouseEnter: (): void => vm.setHover(true),
        onMouseLeave: (): void => vm.setHover(false),
        onFocus: (): void => vm.setFocusWithin(true),
        onBlur: (): void => vm.setFocusWithin(false),
        contextMenu,
        onContextMenu,
        onTimestampContextMenu,
        onPermalinkClicked,
        viewInRoom,
        copyLinkToThread,
        permalink: snapshot.permalink,
        messageBody,
    };

    if (
        roomContext.timelineRenderingType === TimelineRenderingType.Notification ||
        roomContext.timelineRenderingType === TimelineRenderingType.ThreadsList
    ) {
        return {
            ...commonProps,
            threadPanelReplyCount,
            threadPanelPreview,
            onClick: onListTileClick,
        };
    }

    return {
        ...commonProps,
        threadInfo,
        onClick: undefined,
    };
}

function getAvatarMember(props: EventTileProps): RoomMember | null {
    if (props.mxEvent.getContent().third_party_invite) {
        return props.mxEvent.target;
    }
    return props.mxEvent.sender;
}
