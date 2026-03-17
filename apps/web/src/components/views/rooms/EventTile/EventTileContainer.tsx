/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    useContext,
    useEffect,
    useImperativeHandle,
    useRef,
    type JSX,
    type MouseEvent,
    type ReactNode,
    type Ref,
    type RefObject,
} from "react";
import { PinnedMessageBadge, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import { CircleIcon, CheckCircleIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
    EventType,
    type EventStatus,
    type MatrixEvent,
    type Room,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";

import type { EventTileViewSnapshot } from "../../../../viewmodels/room/EventTileViewModel";
import RoomContext, { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import type {
    EventTileProps as LegacyEventTileProps,
    GetRelationsForEvent,
    IReadReceiptProps,
    IEventTileOps,
    IEventTileType,
} from "../EventTile";
import { EventTileViewModel } from "../../../../viewmodels/room/EventTileViewModel";
import { EventTileDecryptionFailureBody } from "./EventTileDecryptionFailureBody";
import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { type ShowThreadPayload } from "../../../../dispatcher/payloads/ShowThreadPayload";
import PosthogTrackers from "../../../../PosthogTrackers";
import RedactedBody from "../../messages/RedactedBody";
import { EventPreview } from "../EventPreview";
import ReplyChain from "../../elements/ReplyChain";
import { haveRendererForEvent, isMessageEvent, renderTile } from "../../../../events/EventTileFactory";
import { copyPlaintext } from "../../../../utils/strings";
import { EventTileView, type EventTileViewProps } from "./EventTileView";
import { type ComposerInsertPayload } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import { _t } from "../../../../languageHandler";
import PlatformPeg from "../../../../PlatformPeg";
import { Layout } from "../../../../settings/enums/Layout";
import { getLateEventInfo } from "../../../structures/grouper/LateEventGrouper";
import { aboveRightOf } from "../../../structures/ContextMenu";
import ThreadSummary, { ThreadMessagePreview } from "../ThreadSummary";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import NotificationBadge from "../NotificationBadge";
import { StaticNotificationState } from "../../../../stores/notifications/StaticNotificationState";
import { ReadReceiptGroup } from "../ReadReceiptGroup";
import TileErrorBoundary from "../../messages/TileErrorBoundary";
import { EventTileReactionsRow } from "./EventTileReactionsRow";
import { shouldDisplayReply } from "../../../../utils/Reply";
import MessageActionBar from "../../messages/MessageActionBar";

export interface EventTileContainerHandle {
    ref: RefObject<HTMLElement | null>;
    getEventTileOps?: IEventTileType["getEventTileOps"];
    getMediaHelper: IEventTileType["getMediaHelper"];
}

export type UnwrappedEventTile = EventTileContainerHandle;

export type EventTileProps = Omit<LegacyEventTileProps, "ref"> & {
    ref?: Ref<UnwrappedEventTile>;
};

export type EventTileContainerProps = EventTileProps;

export type { GetRelationsForEvent, IReadReceiptProps, IEventTileOps, IEventTileType };

export function isEligibleForSpecialReceipt(event: MatrixEvent): boolean {
    if (!isMessageEvent(event) && event.getType() !== EventType.RoomMessageEncrypted) return false;
    return true;
}

export function UnwrappedEventTileContainer({ ref: forwardedRef, ...props }: EventTileContainerProps): JSX.Element {
    const roomContext = useContext(RoomContext);
    const cli = useMatrixClientContext();
    const isRoomEncrypted = Boolean(roomContext.isRoomEncrypted);
    const rootRef = useRef<HTMLElement>(null);
    const tileRef = useRef<IEventTileType>(null);
    const replyChainRef = useRef<ReplyChain>(null);
    const renderTileProps = props;

    useImperativeHandle(
        forwardedRef,
        (): EventTileContainerHandle => ({
            ref: rootRef,
            get getEventTileOps(): IEventTileType["getEventTileOps"] {
                return tileRef.current?.getEventTileOps?.bind(tileRef.current);
            },
            getMediaHelper: () => tileRef.current?.getMediaHelper(),
        }),
        [],
    );

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new EventTileViewModel({
                cli,
                mxEvent: props.mxEvent,
                forExport: props.forExport,
                showReactions: props.showReactions,
                getRelationsForEvent: props.getRelationsForEvent,
                readReceipts: props.readReceipts?.map(({ userId, ts }) => ({ userId, ts })),
                lastSuccessful: props.lastSuccessful,
                eventSendStatus: props.eventSendStatus,
                timelineRenderingType: roomContext.timelineRenderingType,
                isRedacted: props.isRedacted,
                continuation: props.continuation,
                last: props.last,
                lastInSection: props.lastInSection,
                contextual: props.contextual,
                isSelectedEvent: props.isSelectedEvent,
                isTwelveHour: props.isTwelveHour,
                layout: props.layout,
                editState: props.editState,
                permalinkCreator: props.permalinkCreator,
                alwaysShowTimestamps: props.alwaysShowTimestamps,
                hideSender: props.hideSender,
                hideTimestamp: props.hideTimestamp,
                inhibitInteraction: props.inhibitInteraction,
                showReadReceipts: props.showReadReceipts,
                highlightLink: props.highlightLink,
                isRoomEncrypted,
                callEventGrouper: props.callEventGrouper,
                showHiddenEvents: roomContext.showHiddenEvents,
            }),
    );

    useEffect(() => {
        vm.updateProps({
            cli,
            mxEvent: props.mxEvent,
            forExport: props.forExport,
            showReactions: props.showReactions,
            getRelationsForEvent: props.getRelationsForEvent,
            readReceipts: props.readReceipts?.map(({ userId, ts }) => ({ userId, ts })),
            lastSuccessful: props.lastSuccessful,
            eventSendStatus: props.eventSendStatus,
            timelineRenderingType: roomContext.timelineRenderingType,
            isRedacted: props.isRedacted,
            continuation: props.continuation,
            last: props.last,
            lastInSection: props.lastInSection,
            contextual: props.contextual,
            isSelectedEvent: props.isSelectedEvent,
            isTwelveHour: props.isTwelveHour,
            layout: props.layout,
            editState: props.editState,
            permalinkCreator: props.permalinkCreator,
            alwaysShowTimestamps: props.alwaysShowTimestamps,
            hideSender: props.hideSender,
            hideTimestamp: props.hideTimestamp,
            inhibitInteraction: props.inhibitInteraction,
            showReadReceipts: props.showReadReceipts,
            highlightLink: props.highlightLink,
            isRoomEncrypted,
            callEventGrouper: props.callEventGrouper,
            showHiddenEvents: roomContext.showHiddenEvents,
        });
    }, [
        cli,
        props.mxEvent,
        props.forExport,
        props.showReactions,
        props.getRelationsForEvent,
        props.readReceipts,
        props.lastSuccessful,
        props.eventSendStatus,
        props.isRedacted,
        props.continuation,
        props.last,
        props.lastInSection,
        props.contextual,
        props.isSelectedEvent,
        props.isTwelveHour,
        props.layout,
        props.editState,
        props.permalinkCreator,
        props.alwaysShowTimestamps,
        props.hideSender,
        props.hideTimestamp,
        props.inhibitInteraction,
        props.showReadReceipts,
        props.highlightLink,
        isRoomEncrypted,
        props.callEventGrouper,
        roomContext.showHiddenEvents,
        roomContext.timelineRenderingType,
        vm,
    ]);

    const vmSnapshot = useViewModel(vm);

    useEffect(() => {
        const rootNode = rootRef.current;
        if (!props.resizeObserver || !rootNode) return;

        props.resizeObserver.observe(rootNode);

        return () => {
            props.resizeObserver?.unobserve(rootNode);
        };
    }, [props.resizeObserver, props.as, roomContext.timelineRenderingType, vmSnapshot.hasRenderer]);

    const onPermalinkClicked = (ev: MouseEvent<HTMLElement>): void => {
        ev.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: props.mxEvent.getId(),
            highlighted: true,
            room_id: props.mxEvent.getRoomId(),
            metricsTrigger: vmSnapshot.viewRoomMetricsTrigger,
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

        switch (vmSnapshot.tileClickMode) {
            case "viewRoom":
                viewInRoom(ev as never);
                break;
            case "showThread":
                dis.dispatch<ShowThreadPayload>({
                    action: Action.ShowThread,
                    rootEvent: props.mxEvent,
                    push: true,
                });
                PosthogTrackers.trackInteraction("WebThreadsPanelThreadItem", ev, index);
                break;
        }
    };

    const messageBody: ReactNode =
        roomContext.timelineRenderingType === TimelineRenderingType.Notification ||
        roomContext.timelineRenderingType === TimelineRenderingType.ThreadsList ? (
            props.mxEvent.isRedacted() ? (
                <RedactedBody mxEvent={props.mxEvent} />
            ) : props.mxEvent.isDecryptionFailure() ? (
                <EventTileDecryptionFailureBody mxEvent={props.mxEvent} />
            ) : (
                <EventPreview mxEvent={props.mxEvent} />
            )
        ) : (
            renderTile(vmSnapshot.tileRenderType, {
                ...renderTileProps,
                ref: tileRef,
                permalinkCreator: props.permalinkCreator,
                showHiddenEvents: roomContext.showHiddenEvents,
                isSeeingThroughMessageHiddenForModeration: vmSnapshot.isSeeingThroughMessageHiddenForModeration,
            })
        );
    const replyChain =
        haveRendererForEvent(props.mxEvent, cli, roomContext.showHiddenEvents) && shouldDisplayReply(props.mxEvent) ? (
            <ReplyChain
                parentEv={props.mxEvent}
                ref={replyChainRef}
                forExport={props.forExport}
                permalinkCreator={props.permalinkCreator}
                layout={props.layout}
                alwaysShowTimestamps={props.alwaysShowTimestamps || vmSnapshot.hover || vmSnapshot.focusWithin}
                isQuoteExpanded={vmSnapshot.isQuoteExpanded}
                setQuoteExpanded={vm.setQuoteExpanded.bind(vm)}
                getRelationsForEvent={props.getRelationsForEvent}
            />
        ) : undefined;
    const actionBar =
        !vmSnapshot.isEditing && !props.forExport ? (
            <MessageActionBar
                mxEvent={props.mxEvent}
                reactions={vmSnapshot.reactions}
                permalinkCreator={props.permalinkCreator}
                getTile={() => tileRef.current}
                getReplyChain={() => replyChainRef.current}
                onFocusChange={(focused) => vm.setActionBarFocused(focused)}
                isQuoteExpanded={vmSnapshot.isQuoteExpanded}
                toggleThreadExpanded={() => vm.setQuoteExpanded(!vmSnapshot.isQuoteExpanded)}
                getRelationsForEvent={props.getRelationsForEvent}
            />
        ) : undefined;
    const contextMenu = vmSnapshot.contextMenu ? (
        <MessageContextMenu
            {...aboveRightOf(vmSnapshot.contextMenu.position)}
            mxEvent={props.mxEvent}
            permalinkCreator={props.permalinkCreator}
            eventTileOps={tileRef.current?.getEventTileOps?.()}
            collapseReplyChain={replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined}
            onFinished={() => vm.setContextMenu(undefined)}
            rightClick={true}
            reactions={vmSnapshot.reactions}
            link={vmSnapshot.contextMenu.link}
            getRelationsForEvent={props.getRelationsForEvent}
        />
    ) : undefined;

    if (!vmSnapshot.hasRenderer && roomContext.timelineRenderingType !== TimelineRenderingType.Notification) {
        return (
            <div ref={rootRef as React.Ref<HTMLDivElement>} className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
            </div>
        );
    }

    const roomId = props.mxEvent.getRoomId();
    const room = roomId ? cli.getRoom(roomId) : null;
    const eventTileViewProps = composeEventTileViewProps({
        props,
        vm,
        snapshot: vmSnapshot,
        roomContext,
        room,
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

    return <EventTileView {...eventTileViewProps} />;
}

export function EventTileContainer(props: EventTileContainerProps): JSX.Element {
    return (
        <TileErrorBoundary mxEvent={props.mxEvent} layout={props.layout ?? Layout.Group}>
            <UnwrappedEventTileContainer {...props} />
        </TileErrorBoundary>
    );
}

export const UnwrappedEventTile = UnwrappedEventTileContainer;
export default EventTileContainer;

interface ComposeEventTileViewPropsArgs {
    props: EventTileProps;
    vm: EventTileViewModel;
    snapshot: EventTileViewSnapshot;
    roomContext: React.ContextType<typeof RoomContext>;
    room: Room | null;
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

function composeEventTileViewProps({
    props,
    vm,
    snapshot,
    roomContext,
    room,
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
}: ComposeEventTileViewPropsArgs): EventTileViewProps {
    const avatarMember = getAvatarMember(props);
    const onSenderProfileClick = (): void => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: props.mxEvent.getSender()!,
            timelineRenderingType: roomContext.timelineRenderingType,
        });
    };
    const pinnedMessageBadge = snapshot.isPinned ? (
        <PinnedMessageBadge aria-describedby={props.mxEvent.getId() ?? "event-tile"} tabIndex={0} />
    ) : undefined;
    const threadInfoSummary =
        snapshot.threadInfoMode === "summary" ? (
            <ThreadSummary mxEvent={props.mxEvent} thread={snapshot.thread!} data-testid="thread-summary" />
        ) : undefined;
    const threadInfoHref = snapshot.threadInfoMode === "searchLink" ? props.highlightLink : undefined;
    const threadInfoLabel =
        snapshot.threadInfoMode === "searchLink" || snapshot.threadInfoMode === "searchText"
            ? _t("timeline|thread_info_basic")
            : undefined;
    const threadPanelReplyCount = snapshot.showThreadPanelSummary && snapshot.thread ? snapshot.thread.length : undefined;
    const threadPanelPreview =
        snapshot.showThreadPanelSummary && snapshot.thread ? <ThreadMessagePreview thread={snapshot.thread} /> : undefined;
    const sentReceipt = getSentReceiptDetails(props.eventSendStatus, snapshot);
    const readReceipts = snapshot.showReadReceipts ? (
        <ReadReceiptGroup
            readReceipts={[...(props.readReceipts ?? [])]}
            readReceiptMap={props.readReceiptMap ?? {}}
            checkUnmounting={props.checkUnmounting}
            suppressAnimation={false}
            isTwelveHour={props.isTwelveHour}
        />
    ) : undefined;
    const reactionsRow = props.isRedacted ? undefined : <EventTileReactionsRow mxEvent={props.mxEvent} reactions={snapshot.reactions} />;
    const hasFooter = Boolean(snapshot.isPinned || reactionsRow);

    const commonProps: EventTileViewProps = {
        as: props.as,
        rootRef,
        id: props.mxEvent.getId() ?? "event-tile",
        mxEvent: props.mxEvent,
        room,
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
        avatarMember,
        avatarSize: snapshot.avatarSize,
        avatarViewUserOnClick: snapshot.avatarMemberUserOnClick,
        avatarForceHistorical: snapshot.avatarForceHistorical,
        senderMode: snapshot.senderMode,
        onSenderProfileClick,
        sentReceiptIcon: sentReceipt?.icon,
        sentReceiptLabel: sentReceipt?.label,
        readReceipts,
        reactionsRow,
        hasFooter,
        pinnedMessageBadge,
        showThreadToolbar: snapshot.showThreadToolbar,
        showTimestamp: snapshot.showTimestamp,
        showLinkedTimestamp: snapshot.showLinkedTimestamp,
        showDummyTimestamp: snapshot.showDummyTimestamp,
        timestampTs: snapshot.timestampTs,
        timestampReceivedTs: getLateEventInfo(props.mxEvent)?.received_ts,
        showRelativeTimestamp: snapshot.showRelativeTimestamp,
        showGroupPadlock: snapshot.showGroupPadlock,
        showIrcPadlock: snapshot.showIrcPadlock,
        e2ePadlockIcon: snapshot.e2ePadlockIcon,
        e2ePadlockTitle: snapshot.e2ePadlockTitle,
        e2ePadlockSharedUserId: snapshot.e2ePadlockSharedUserId,
        e2ePadlockRoomId: snapshot.e2ePadlockRoomId,
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
        threadInfoSummary,
        threadInfoHref,
        threadInfoLabel,
        onClick: undefined,
    };
}

function getAvatarMember(props: EventTileProps): RoomMember | null {
    if (props.mxEvent.getContent().third_party_invite) {
        return props.mxEvent.target;
    }
    return props.mxEvent.sender;
}

function getSentReceiptDetails(
    messageState: EventStatus | undefined,
    snapshot: EventTileViewSnapshot,
): { icon: ReactNode; label: string } | undefined {
    if (!snapshot.shouldShowSentReceipt && !snapshot.shouldShowSendingReceipt) {
        return undefined;
    }

    const isSent = !messageState || messageState === "sent";
    const isFailed = messageState === "not_sent";

    let icon: JSX.Element | undefined;
    let label: string | undefined;
    if (messageState === "encrypting") {
        icon = <CircleIcon />;
        label = _t("timeline|send_state_encrypting");
    } else if (isSent) {
        icon = <CheckCircleIcon />;
        label = _t("timeline|send_state_sent");
    } else if (isFailed) {
        icon = <NotificationBadge notification={StaticNotificationState.RED_EXCLAMATION} />;
        label = _t("timeline|send_state_failed");
    } else {
        icon = <CircleIcon />;
        label = _t("timeline|send_state_sending");
    }

    return icon && label ? { icon, label } : undefined;
}
