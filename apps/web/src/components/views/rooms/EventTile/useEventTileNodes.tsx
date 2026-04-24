/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useMemo, type JSX } from "react";

import type { EventStatus, MatrixEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import type LegacyCallEventGrouper from "../../../structures/LegacyCallEventGrouper";
import type RoomContext from "../../../../contexts/RoomContext";
import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
import type { ComposerInsertPayload } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import { AvatarSubject, ThreadInfoMode } from "../../../../models/rooms/EventTileModel";
import type {
    EventTileViewModel,
    EventTileViewSnapshot,
} from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import type ReplyChain from "../../elements/ReplyChain";
import type { IReadReceiptPosition } from "../ReadReceiptMarker";
import ThreadSummary, { ThreadMessagePreview } from "../ThreadSummary";
import { ActionBar } from "./ActionBar";
import { Avatar } from "./Avatar";
import { Footer } from "./Footer";
import { MessageBody, type MessageBodyProps, type MessageBodyRenderTileProps } from "./MessageBody";
import { MessageStatus } from "./MessageStatus";
import { ReplyPreview } from "./ReplyPreview";
import { Sender } from "./Sender";
import { ThreadInfo } from "./ThreadInfo";
import { ThreadToolbar } from "./ThreadToolbar";
import type { EventTileOps, GetRelationsForEvent, ReadReceiptProps } from "./types";
import type { Layout } from "../../../../settings/enums/Layout";

type EventTileNodesProps = {
    mxEvent: MatrixEvent;
    eventSendStatus?: EventStatus;
    forExport?: boolean;
    layout?: Layout;
    isTwelveHour?: boolean;
    alwaysShowTimestamps?: boolean;
    isRedacted?: boolean;
    showUrlPreview?: boolean;
    highlights?: string[];
    highlightLink?: string;
    getRelationsForEvent?: GetRelationsForEvent;
    readReceipts?: ReadReceiptProps[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    editState?: EditorStateTransfer;
    replacingEventId?: string;
    checkUnmounting?: () => boolean;
    inhibitInteraction?: boolean;
    permalinkCreator?: RoomPermalinkCreator;
    callEventGrouper?: LegacyCallEventGrouper;
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
    props: EventTileNodesProps;
    roomContext: React.ContextType<typeof RoomContext>;
    snapshot: EventTileViewSnapshot;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    suppressReadReceiptAnimation: boolean;
    tileContentId: string;
    vm: EventTileViewModel;
    onActionBarFocusChange: (focused: boolean) => void;
    toggleThreadExpanded: () => void;
    openInRoom: (_anchor: HTMLElement | null) => void;
    copyLinkToThread: (_anchor: HTMLElement | null) => void | Promise<void>;
};

function getAvatarMember(props: EventTileNodesProps, avatarSubject: AvatarSubject): RoomMember | null {
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

export function useEventTileNodes({
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
                <ActionBar
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
                <ThreadToolbar onViewInRoomClick={openInRoom} onCopyLinkClick={copyLinkToThread} />
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
