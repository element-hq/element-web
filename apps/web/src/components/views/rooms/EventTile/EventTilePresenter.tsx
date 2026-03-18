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
    type ReactNode,
    type Ref,
    type RefObject,
} from "react";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import {
    type EventStatus,
    type MatrixEvent,
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
import type { GetRelationsForEvent, ReadReceiptProps } from "./EventTile";
import { ReplyPreview } from "./ReplyPreview";
import { Sender } from "./Sender";
import { ThreadInfo } from "./ThreadInfo";

export interface EventTileOps {
    isWidgetHidden(): boolean;
    unhideWidget(): void;
}

export interface EventTileApi {
    getEventTileOps?(): EventTileOps;
    getMediaHelper(): { destroy?(): void } | undefined;
}

export interface EventTileHandle extends EventTileApi {
    ref: RefObject<HTMLElement | null>;
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
    tileRef: RefObject<EventTileApi | null>;
    replyChainRef: RefObject<ReplyChain | null>;
    suppressReadReceiptAnimation: boolean;
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
    replyChain?: ReactNode;
    messageBody: ReactNode;
    actionBar?: ReactNode;
    contextMenu?: ReactNode;
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
    suppressReadReceiptAnimation: boolean;
    renderedContent: EventTileViewRenderContent;
    actions: EventTileViewActions;
};

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
    const [suppressReadReceiptAnimation, setSuppressReadReceiptAnimation] = useState(true);
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
            get getEventTileOps(): EventTileHandle["getEventTileOps"] {
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

    const onPermalinkClicked = useCallback((ev: MouseEvent<HTMLElement>): void => {
        ev.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: props.mxEvent.getId(),
            highlighted: true,
            room_id: props.mxEvent.getRoomId(),
            metricsTrigger: snapshot.viewRoomMetricsTrigger,
        });
    }, [props.mxEvent, snapshot.viewRoomMetricsTrigger]);

    const openInRoom = useCallback((evt: ButtonEvent): void => {
        evt.preventDefault();
        evt.stopPropagation();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: props.mxEvent.getId(),
            highlighted: true,
            room_id: props.mxEvent.getRoomId(),
            metricsTrigger: undefined,
        });
    }, [props.mxEvent]);

    const copyLinkToThread = useCallback(async (evt: ButtonEvent): Promise<void> => {
        evt.preventDefault();
        evt.stopPropagation();
        if (!props.permalinkCreator) return;
        await copyPlaintext(props.permalinkCreator.forEvent(props.mxEvent.getId()!));
    }, [props.permalinkCreator, props.mxEvent]);

    const showContextMenu = useCallback((ev: MouseEvent<HTMLElement>, permalink?: string): void => {
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
    }, [props.editState, vm]);

    const onContextMenu = useCallback((ev: MouseEvent<HTMLElement>): void => {
        showContextMenu(ev);
    }, [showContextMenu]);

    const onTimestampContextMenu = useCallback((ev: MouseEvent<HTMLElement>): void => {
        showContextMenu(ev, props.permalinkCreator?.forEvent(props.mxEvent.getId()!));
    }, [showContextMenu, props.permalinkCreator, props.mxEvent]);

    const onListTileClick = useCallback((ev: MouseEvent<HTMLElement>): void => {
        const target = ev.currentTarget as HTMLElement;
        let index = -1;
        if (target.parentElement) index = Array.from(target.parentElement.children).indexOf(target);

        switch (snapshot.tileClickMode) {
            case ClickMode.ViewRoom:
                openInRoom(ev as never);
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
    }, [snapshot.tileClickMode, openInRoom, props.mxEvent]);

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

export function EventTilePresenter({ ref: forwardedRef, ...props }: EventTileProps): JSX.Element {
    const {
        cli,
        roomContext,
        tileContentId,
        rootRef,
        tileRef,
        replyChainRef,
        suppressReadReceiptAnimation,
        vm,
        snapshot: vmSnapshot,
    } = useEventTileViewModel(props, forwardedRef);
    const renderTileProps = props;
    const {
        room,
        onPermalinkClicked,
        openInRoom,
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
                mxEvent={props.mxEvent}
                cli={cli}
                showHiddenEvents={roomContext.showHiddenEvents}
                forExport={props.forExport}
                permalinkCreator={props.permalinkCreator}
                layout={props.layout}
                alwaysShowTimestamps={props.alwaysShowTimestamps}
                getRelationsForEvent={props.getRelationsForEvent}
                hover={vmSnapshot.hover}
                focusWithin={vmSnapshot.focusWithin}
                isQuoteExpanded={vmSnapshot.isQuoteExpanded}
                replyChainRef={replyChainRef}
                setQuoteExpanded={(expanded) => vm.setQuoteExpanded(expanded)}
            />
        ),
        [
            props.mxEvent,
            cli,
            roomContext.showHiddenEvents,
            props.forExport,
            props.permalinkCreator,
            props.layout,
            props.alwaysShowTimestamps,
            props.getRelationsForEvent,
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
                mxEvent={props.mxEvent}
                forExport={props.forExport}
                permalinkCreator={props.permalinkCreator}
                getRelationsForEvent={props.getRelationsForEvent}
                reactions={vmSnapshot.reactions}
                isEditing={vmSnapshot.isEditing}
                isQuoteExpanded={vmSnapshot.isQuoteExpanded}
                tileRef={tileRef}
                replyChainRef={replyChainRef}
                onFocusChange={(focused) => vm.setActionBarFocused(focused)}
                toggleThreadExpanded={() => vm.setQuoteExpanded(!vmSnapshot.isQuoteExpanded)}
            />
        ),
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
            vm,
        ],
    );

    const contextMenu = useMemo(
        () =>
            vmSnapshot.contextMenu ? (
                <ContextMenu
                    mxEvent={props.mxEvent}
                    permalinkCreator={props.permalinkCreator}
                    getRelationsForEvent={props.getRelationsForEvent}
                    reactions={vmSnapshot.reactions}
                    contextMenu={vmSnapshot.contextMenu}
                    tileRef={tileRef}
                    replyChainRef={replyChainRef}
                    onFinished={() => vm.setContextMenu(undefined)}
                />
            ) : undefined,
        [
            props.mxEvent,
            props.permalinkCreator,
            props.getRelationsForEvent,
            vmSnapshot.reactions,
            vmSnapshot.contextMenu,
            tileRef,
            replyChainRef,
            vm,
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
        suppressReadReceiptAnimation,
        renderedContent: {
            actionBar,
            contextMenu,
            replyChain,
            messageBody,
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

    if (!vmSnapshot.hasRenderer && roomContext.timelineRenderingType !== TimelineRenderingType.Notification) {
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
    suppressReadReceiptAnimation,
    renderedContent,
    actions,
}: UseEventTileViewPropsArgs): EventTileViewProps {
    const avatarMember = getAvatarMember(props);
    const onSenderProfileClick = useCallback((): void => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: props.mxEvent.getSender()!,
            timelineRenderingType: roomContext.timelineRenderingType,
        });
    }, [props.mxEvent, roomContext.timelineRenderingType]);
    const footer = useMemo(
        () =>
            snapshot.hasFooter ? (
                <Footer
                    layout={props.layout}
                    mxEvent={props.mxEvent}
                    isRedacted={props.isRedacted}
                    isPinned={snapshot.isPinned}
                    isOwnEvent={snapshot.isOwnEvent}
                    reactions={snapshot.reactions}
                    tileContentId={tileContentId}
                />
            ) : undefined,
        [
            props.layout,
            props.mxEvent,
            props.isRedacted,
            snapshot.hasFooter,
            snapshot.isPinned,
            snapshot.isOwnEvent,
            snapshot.reactions,
            tileContentId,
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
        () => (snapshot.showThreadPanelSummary && snapshot.thread ? snapshot.thread.length : undefined),
        [snapshot.showThreadPanelSummary, snapshot.thread],
    );
    const threadPanelPreview = useMemo(
        () =>
            snapshot.showThreadPanelSummary && snapshot.thread ? (
                <ThreadMessagePreview key={snapshot.threadUpdateKey} thread={snapshot.thread} />
            ) : undefined,
        [snapshot.showThreadPanelSummary, snapshot.thread, snapshot.threadUpdateKey],
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
    const notificationRoomLabel = useMemo(
        () =>
            room ? _t("timeline|in_room_name", { room: room.name }, { strong: (sub) => <strong>{sub}</strong> }) : undefined,
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
        () => (room ? <UnreadNotificationBadge room={room} threadId={props.mxEvent.getId()} forceDot={true} /> : undefined),
        [room, props.mxEvent],
    );
    const handlers = useMemo(
        () => ({
            onClick: undefined,
            onContextMenu: actions.onContextMenu,
            onMouseEnter: (): void => vm.setHover(true),
            onMouseLeave: (): void => vm.setHover(false),
            onFocus: (): void => vm.setFocusWithin(true),
            onBlur: (): void => vm.setFocusWithin(false),
        }),
        [actions.onContextMenu, vm],
    );

    const commonProps: EventTileViewProps = useMemo(
        () => ({
            as: props.as,
            rootRef,
            contentId: tileContentId,
            eventId: props.mxEvent.getId() ?? undefined,
            layout: props.layout,
            timelineRenderingType: roomContext.timelineRenderingType,
            rootClassName: snapshot.classes,
            contentClassName: snapshot.lineClasses,
            ariaLive: props.eventSendStatus !== null ? ("off" as const) : undefined,
            scrollTokens: snapshot.scrollToken,
            isOwnEvent: snapshot.isOwnEvent,
            content: {
                sender,
                avatar,
                replyChain: renderedContent.replyChain,
                messageStatus,
                messageBody: renderedContent.messageBody,
                actionBar: renderedContent.actionBar,
                footer,
                contextMenu: renderedContent.contextMenu,
            },
            threads: {
                info: threadInfo,
                replyCount: threadPanelReplyCount,
                preview: threadPanelPreview,
                showToolbar: snapshot.showThreadToolbar,
                openInRoom: actions.openInRoom,
                copyLinkToThread: actions.copyLinkToThread,
            },
            timestamp: {
                show: snapshot.showTimestamp,
                showLinked: snapshot.showLinkedTimestamp,
                showPlaceholder: snapshot.showDummyTimestamp,
                ts: snapshot.timestampTs,
                receivedTs: getLateEventInfo(props.mxEvent)?.received_ts,
                showRelative: snapshot.showRelativeTimestamp,
                isTwelveHour: props.isTwelveHour,
                permalink: snapshot.permalink,
                onPermalinkClicked: actions.onPermalinkClicked,
                onContextMenu: actions.onTimestampContextMenu,
            },
            encryption: {
                showGroupPadlock: snapshot.showGroupPadlock,
                showIrcPadlock: snapshot.showIrcPadlock,
                mode: snapshot.encryptionIndicatorMode,
                indicatorTitle: snapshot.encryptionIndicatorTitle,
                sharedKeysUserId: snapshot.sharedKeysUserId,
                sharedKeysRoomId: snapshot.sharedKeysRoomId,
            },
            notification: {
                enabled: roomContext.timelineRenderingType === TimelineRenderingType.Notification,
                roomLabel: notificationRoomLabel,
                roomAvatar: notificationRoomAvatar,
                unreadBadge,
            },
            handlers,
        }),
        [
            props.as,
            rootRef,
            tileContentId,
            props.mxEvent,
            props.layout,
            roomContext.timelineRenderingType,
            snapshot.classes,
            snapshot.lineClasses,
            props.eventSendStatus,
            snapshot.scrollToken,
            snapshot.isOwnEvent,
            sender,
            avatar,
            renderedContent.replyChain,
            messageStatus,
            renderedContent.messageBody,
            renderedContent.actionBar,
            footer,
            renderedContent.contextMenu,
            threadInfo,
            threadPanelReplyCount,
            threadPanelPreview,
            snapshot.showThreadToolbar,
            actions.openInRoom,
            actions.copyLinkToThread,
            snapshot.showTimestamp,
            snapshot.showLinkedTimestamp,
            snapshot.showDummyTimestamp,
            snapshot.timestampTs,
            snapshot.showRelativeTimestamp,
            props.isTwelveHour,
            snapshot.permalink,
            actions.onPermalinkClicked,
            actions.onTimestampContextMenu,
            snapshot.showGroupPadlock,
            snapshot.showIrcPadlock,
            snapshot.encryptionIndicatorMode,
            snapshot.encryptionIndicatorTitle,
            snapshot.sharedKeysUserId,
            snapshot.sharedKeysRoomId,
            notificationRoomLabel,
            notificationRoomAvatar,
            unreadBadge,
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

function getAvatarMember(props: EventTileProps): RoomMember | null {
    if (props.mxEvent.getContent().third_party_invite) {
        return props.mxEvent.target;
    }
    return props.mxEvent.sender;
}
