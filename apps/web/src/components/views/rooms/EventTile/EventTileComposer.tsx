/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, type ContextType, type JSX, type MouseEvent, type ReactNode } from "react";
import { CircleIcon, CheckCircleIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { PinnedMessageBadge } from "@element-hq/web-shared-components";

import type { EventStatus, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import type { IReadReceiptPosition } from "../ReadReceiptMarker";
import type { EventTileViewModel, EventTileViewSnapshot } from "../../../../viewmodels/room/EventTileViewModel";
import RoomContext, { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { EventTileView, type EventTileViewProps } from "./EventTileView";
import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
import { type ComposerInsertPayload } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import { _t } from "../../../../languageHandler";
import { getLateEventInfo } from "../../../structures/grouper/LateEventGrouper";
import ThreadSummary, { ThreadMessagePreview } from "../ThreadSummary";
import NotificationBadge from "../NotificationBadge";
import { StaticNotificationState } from "../../../../stores/notifications/StaticNotificationState";
import { ReadReceiptGroup } from "../ReadReceiptGroup";
import type { ButtonEvent } from "../../elements/AccessibleButton";
import type { Layout } from "../../../../settings/enums/Layout";

export interface EventTileComposerProps {
    as?: string;
    mxEvent: MatrixEvent;
    layout?: Layout;
    highlightLink?: string;
    readReceipts?: readonly { userId: string; roomMember: RoomMember | null; ts: number }[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    checkUnmounting?: () => boolean;
    eventSendStatus?: EventStatus;
    isTwelveHour?: boolean;
    vm: EventTileViewModel;
    vmSnapshot: EventTileViewSnapshot;
    messageBody: ReactNode;
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    viewInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => Promise<void>;
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
}

export function EventTileComposer(props: EventTileComposerProps): JSX.Element {
    const roomContext = useContext(RoomContext);
    const cli = useMatrixClientContext();
    const { vm, vmSnapshot } = props;
    const roomId = props.mxEvent.getRoomId();
    const room = roomId ? cli.getRoom(roomId) : null;
    const thread = vmSnapshot.thread;

    if (!vmSnapshot.hasRenderer && roomContext.timelineRenderingType !== TimelineRenderingType.Notification) {
        return (
            <div className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
            </div>
        );
    }

    const eventTileViewProps = composeEventTileViewProps(props, vm, vmSnapshot, roomContext, room, thread);
    return <EventTileView {...eventTileViewProps} />;
}

function composeEventTileViewProps(
    props: EventTileComposerProps,
    vm: EventTileViewModel,
    snapshot: EventTileViewSnapshot,
    roomContext: ContextType<typeof RoomContext>,
    room: Room | null,
    thread: EventTileViewSnapshot["thread"],
): EventTileViewProps {
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
    const threadPanelReplyCount = snapshot.showThreadPanelSummary && thread ? thread.length : undefined;
    const threadPanelPreview =
        snapshot.showThreadPanelSummary && thread ? <ThreadMessagePreview thread={thread} /> : undefined;
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

    const commonProps: EventTileViewProps = {
        as: props.as,
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
        avatarMember,
        avatarSize: snapshot.avatarSize,
        avatarViewUserOnClick: snapshot.avatarMemberUserOnClick,
        avatarForceHistorical: snapshot.avatarForceHistorical,
        senderMode: snapshot.senderMode,
        onSenderProfileClick,
        sentReceiptIcon: sentReceipt?.icon,
        sentReceiptLabel: sentReceipt?.label,
        readReceipts,
        hasFooter: snapshot.hasFooter,
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
        onContextMenu: preventDefault,
        onTimestampContextMenu: preventDefault,
        onPermalinkClicked: props.onPermalinkClicked,
        viewInRoom: props.viewInRoom,
        copyLinkToThread: props.copyLinkToThread,
        permalink: snapshot.permalink,
        messageBody: props.messageBody,
    };

    if (
        roomContext.timelineRenderingType === TimelineRenderingType.Notification ||
        roomContext.timelineRenderingType === TimelineRenderingType.ThreadsList
    ) {
        return {
            ...commonProps,
            threadPanelReplyCount,
            threadPanelPreview,
            onClick: props.onListTileClick,
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

function preventDefault(ev: MouseEvent<HTMLElement>): void {
    ev.preventDefault();
}

function getAvatarMember(props: EventTileComposerProps): RoomMember | null {
    let member: RoomMember | null;
    if (props.mxEvent.getContent().third_party_invite) {
        member = props.mxEvent.target;
    } else {
        member = props.mxEvent.sender;
    }
    return member;
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
