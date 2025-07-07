/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React, { useEffect, useSyncExternalStore } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import type {
    EventStatus,
    EventType,
    MatrixEvent,
    Relations,
    RelationType,
    RoomMember,
    Thread,
} from "matrix-js-sdk/src/matrix";
import type { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { SentReceipt, type IEventTileType } from "./EventTile";
import type ReplyChain from "../elements/ReplyChain";
import type { IReadReceiptPosition } from "./ReadReceiptMarker";
import type { EventTileViewModel, IReadReceiptProps, ViewModel } from "../../viewmodels/rooms/EventTileViewModel";
import { _t } from "../../../languageHandler";
import MemberAvatar from "../avatars/MemberAvatar";
import SenderProfile from "../messages/SenderProfile";
import MessageActionBar from "../messages/MessageActionBar";
import MessageTimestamp from "../messages/MessageTimestamp";
import { PinnedMessageBadge } from "../messages/PinnedMessageBadge";
import ReactionsRow from "../messages/ReactionsRow";
import { ReadReceiptGroup } from "./ReadReceiptGroup";

interface IProps {
    vm: EventTileViewModel;
}

export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

export interface EventTileViewState {
    avatarSize: string | null;
    member: RoomMember | null;
    viewUserOnClick: boolean;
    forceHistorical: boolean;
    senderProfileInfo: {
        shouldRender: boolean;
        onClick?: () => void;
        tooltip?: boolean;
    };
    hasNoRenderer: boolean;
    mxEvent: MatrixEvent;
    showMessageActionBar: boolean;
    // The Relations model from the JS SDK for reactions to `mxEvent`
    reactions?: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getTile: () => IEventTileType | null;
    getReplyChain: () => ReplyChain | null;
    onFocusChange?: (menuDisplayed: boolean) => void;
    isQuoteExpanded?: boolean;
    toggleThreadExpanded: () => void;
    getRelationsForEvent?: GetRelationsForEvent;
    actionBarFocused: boolean;

    timestampViewModel: {
        shouldRender: boolean;
        showRelative?: boolean;
        showTwelveHour?: boolean;
        ts: number;
        receivedTs?: number;
    };

    hover: boolean;
    contextMenu?: {
        position: Pick<DOMRect, "top" | "left" | "bottom">;
        link?: string;
    };
    thread: Thread | null;

    needsPinnedMessageBadge: boolean;
    isRedacted: boolean;
    needsFooter: boolean;

    linkedTimestampViewModel: {
        hideTimestamp?: boolean;
        permalink: string;
        onClick: (e: React.MouseEvent) => void;
        ariaLabel?: string;
        onContextMenu: (e: React.MouseEvent) => void;
    };

    suppressReadReceiptAnimation: boolean;

    shouldShowSentReceipt: boolean;
    shouldShowSendingReceipt: boolean;
    messageState: EventStatus | null;

    // a list of read-receipts we should show. Each object has a 'roomMember' and 'ts'.
    readReceipts?: IReadReceiptProps[];

    // opaque readreceipt info for each userId; used by ReadReceiptMarker
    // to manage its animations. Should be an empty object when the room
    // first loads
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };

    // A function which is used to check if the parent panel is being
    // unmounted, to avoid unnecessary work. Should return true if we
    // are being unmounted.
    checkUnmounting?: () => boolean;
    showReadReceipts?: boolean;
}

const NoRendererView: React.FC = () => {
    return (
        <div className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
            <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
        </div>
    );
};

const EventTileAvatarView: React.FC<{ vs: EventTileViewState }> = ({ vs }) => {
    if (!vs.avatarSize || !vs.member) return null;
    return (
        <div className="mx_EventTile_avatar">
            <MemberAvatar
                member={vs.member}
                size={vs.avatarSize}
                viewUserOnClick={vs.viewUserOnClick}
                forceHistorical={vs.forceHistorical}
            />
        </div>
    );
};

type ExtractViewState<V> = V extends ViewModel<unknown, infer S> ? S : never;

function useViewModel<V extends ViewModel<unknown, ExtractViewState<V>>>(vm: V): ExtractViewState<V> {
    const vs = useSyncExternalStore(vm.subscribe, vm.getSnapshot);

    useEffect(() => {
        vm.onComponentMounted();
    }, [vm]);

    return vs;
}

export const EventTileView: React.FC<IProps> = ({ vm }) => {
    const vs = useViewModel(vm);

    if (vs.hasNoRenderer) {
        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        // todo: logger.warn should go to vm
        logger.warn(`Event type not supported: `);
        return <NoRendererView />;
    }

    const avatar = <EventTileAvatarView vs={vs} />;

    let sender: React.JSX.Element | null = null;
    const senderProfileInfo = vs.senderProfileInfo;
    if (senderProfileInfo.shouldRender) {
        sender = (
            <SenderProfile
                mxEvent={vs.mxEvent}
                onClick={vs.senderProfileInfo.onClick}
                withTooltip={vs.senderProfileInfo.tooltip}
            />
        );
    }

    let actionBar: React.JSX.Element | null = null;
    if (vs.showMessageActionBar) {
        actionBar = (
            <MessageActionBar
                mxEvent={vs.mxEvent}
                reactions={vs.reactions}
                permalinkCreator={vs.permalinkCreator}
                getTile={vs.getTile}
                getReplyChain={vs.getReplyChain}
                onFocusChange={vs.onFocusChange}
                isQuoteExpanded={vs.isQuoteExpanded}
                toggleThreadExpanded={vs.toggleThreadExpanded}
                getRelationsForEvent={vs.getRelationsForEvent}
            />
        );
    }

    let messageTimestamp: React.JSX.Element | null = null;
    const timestampVm = vs.timestampViewModel;
    if (timestampVm.shouldRender) {
        messageTimestamp = (
            <MessageTimestamp
                showRelative={timestampVm.showRelative}
                showTwelveHour={timestampVm.showTwelveHour}
                ts={timestampVm.ts}
                receivedTs={timestampVm.receivedTs}
            />
        );
    }

    let pinnedMessageBadge: React.JSX.Element | null = null;
    if (vs.needsPinnedMessageBadge) {
        pinnedMessageBadge = <PinnedMessageBadge />;
    }

    let reactionsRow: React.JSX.Element | null = null;
    if (!vs.isRedacted) {
        reactionsRow = <ReactionsRow mxEvent={vs.mxEvent} reactions={vs.reactions} key="mx_EventTile_reactionsRow" />;
    }

    let linkedTimestamp: React.JSX.Element | null = null;
    const linkedTimestampVm = vs.linkedTimestampViewModel;
    if (!linkedTimestampVm.hideTimestamp) {
        linkedTimestamp = (
            <a
                href={linkedTimestampVm.permalink}
                onClick={linkedTimestampVm.onClick}
                aria-label={linkedTimestampVm.ariaLabel}
                onContextMenu={linkedTimestampVm.onContextMenu}
            >
                {messageTimestamp}
            </a>
        );
    }

    let msgOption: React.JSX.Element | null = null;
    if (vs.shouldShowSentReceipt || vs.shouldShowSendingReceipt) {
        msgOption = <SentReceipt messageState={vs.messageState} />;
    } else if (vs.showReadReceipts) {
        msgOption = (
            <ReadReceiptGroup
                readReceipts={vs.readReceipts ?? []}
                readReceiptMap={vs.readReceiptMap ?? {}}
                checkUnmounting={vs.checkUnmounting}
                suppressAnimation={vs.suppressReadReceiptAnimation}
                isTwelveHour={timestampVm.showTwelveHour}
            />
        );
    }
    return (
        <div className="EventTileView">
            {avatar}
            {sender}
            {actionBar}
            {pinnedMessageBadge}
            {reactionsRow}
            {msgOption}
            {linkedTimestamp}
        </div>
    );
};
