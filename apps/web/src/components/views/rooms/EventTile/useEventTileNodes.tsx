/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useMemo, type JSX, type ReactNode } from "react";
import { DisambiguatedProfileView } from "@element-hq/web-shared-components";

import type { EventStatus, MatrixEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import type LegacyCallEventGrouper from "../../../structures/LegacyCallEventGrouper";
import type RoomContext from "../../../../contexts/RoomContext";
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
    sender?: ReactNode;
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
    onActionBarMenuOpenChange: (open: boolean) => void;
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

/** Builds the React nodes used by `EventTileView` from the current tile props and view-model snapshot. */
export function useEventTileNodes({
    props,
    roomContext,
    snapshot,
    tileRef,
    replyChainRef,
    suppressReadReceiptAnimation,
    tileContentId,
    vm,
    onActionBarMenuOpenChange,
}: UseEventTileNodesArgs): { content: EventTileContentNodes; thread: EventTileThreadNodes } {
    const avatarMember = getAvatarMember(props, snapshot.sender.avatarSubject);
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
            snapshot.rendering.shouldRenderReplyPreview ? (
                <ReplyPreview
                    mxEvent={props.mxEvent}
                    forExport={props.forExport}
                    permalinkCreator={props.permalinkCreator}
                    layout={props.layout}
                    alwaysShowTimestamps={props.alwaysShowTimestamps}
                    getRelationsForEvent={props.getRelationsForEvent}
                    isQuoteExpanded={snapshot.interaction.isQuoteExpanded}
                    replyChainRef={replyChainRef}
                    setQuoteExpanded={setQuoteExpanded}
                />
            ) : undefined,
        [
            snapshot.rendering.shouldRenderReplyPreview,
            props.mxEvent,
            props.forExport,
            props.permalinkCreator,
            props.layout,
            props.alwaysShowTimestamps,
            props.getRelationsForEvent,
            snapshot.interaction.isQuoteExpanded,
            replyChainRef,
            setQuoteExpanded,
        ],
    );
    const reactions = vm.getReactions();
    const actionBarViewModel = snapshot.rendering.shouldRenderActionBar ? vm.getActionBarViewModel() : undefined;
    const actionBar = useMemo(
        () =>
            actionBarViewModel ? (
                <ActionBar
                    mxEvent={props.mxEvent}
                    permalinkCreator={props.permalinkCreator}
                    getRelationsForEvent={props.getRelationsForEvent}
                    reactions={reactions}
                    vm={actionBarViewModel}
                    tileRef={tileRef}
                    replyChainRef={replyChainRef}
                    onMenuOpenChange={onActionBarMenuOpenChange}
                />
            ) : undefined,
        [
            actionBarViewModel,
            props.mxEvent,
            props.permalinkCreator,
            props.getRelationsForEvent,
            reactions,
            tileRef,
            replyChainRef,
            onActionBarMenuOpenChange,
        ],
    );
    const sender = useMemo(
        () =>
            snapshot.sender.showSenderProfile ? (
                <DisambiguatedProfileView vm={vm.disambiguatedProfileViewModel} className="mx_DisambiguatedProfile" />
            ) : undefined,
        [snapshot.sender.showSenderProfile, vm.disambiguatedProfileViewModel],
    );
    const avatar = useMemo(
        () => (
            <Avatar
                member={avatarMember}
                size={snapshot.sender.avatarSize}
                viewUserOnClick={snapshot.sender.avatarMemberUserOnClick}
                forceHistorical={snapshot.sender.avatarForceHistorical}
            />
        ),
        [
            avatarMember,
            snapshot.sender.avatarSize,
            snapshot.sender.avatarMemberUserOnClick,
            snapshot.sender.avatarForceHistorical,
        ],
    );
    const messageStatus = useMemo(
        () => (
            <MessageStatus
                vm={vm.messageStatusViewModel}
                readReceipts={props.readReceipts}
                readReceiptMap={props.readReceiptMap}
                checkUnmounting={props.checkUnmounting}
                isTwelveHour={props.isTwelveHour}
                suppressReadReceiptAnimation={suppressReadReceiptAnimation}
            />
        ),
        [
            vm.messageStatusViewModel,
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
                    isPinned={snapshot.rendering.isPinned}
                    isOwnEvent={snapshot.sender.isOwnEvent}
                    reactions={reactions}
                    tileContentId={tileContentId}
                    reactionsRowViewModel={vm.reactionsRowViewModel}
                />
            </div>
        ),
        [
            props.layout,
            props.mxEvent,
            props.isRedacted,
            snapshot.rendering.isPinned,
            snapshot.sender.isOwnEvent,
            reactions,
            tileContentId,
            vm.reactionsRowViewModel,
        ],
    );
    const messageBodyProps = useMemo<MessageBodyProps>(
        () => ({
            mxEvent: props.mxEvent,
            isDecryptionFailure: snapshot.encryption.isEncryptionFailure,
            timelineRenderingType: roomContext.timelineRenderingType,
            tileRenderType: snapshot.rendering.tileRenderType,
            isSeeingThroughMessageHiddenForModeration: snapshot.rendering.isSeeingThroughMessageHiddenForModeration,
            renderTileProps,
            tileRef,
            permalinkCreator: props.permalinkCreator,
            showHiddenEvents: roomContext.showHiddenEvents,
        }),
        [
            props.mxEvent,
            snapshot.encryption.isEncryptionFailure,
            roomContext.timelineRenderingType,
            snapshot.rendering.tileRenderType,
            snapshot.rendering.isSeeingThroughMessageHiddenForModeration,
            renderTileProps,
            tileRef,
            props.permalinkCreator,
            roomContext.showHiddenEvents,
        ],
    );
    const messageBody = useMemo(() => <MessageBody {...messageBodyProps} />, [messageBodyProps]);
    const info = useMemo(
        () =>
            snapshot.thread.threadInfoMode === ThreadInfoMode.None ? undefined : (
                <ThreadInfo
                    summary={
                        snapshot.thread.threadInfoMode === ThreadInfoMode.Summary ? (
                            <ThreadSummary
                                key={snapshot.thread.threadUpdateKey}
                                mxEvent={props.mxEvent}
                                thread={snapshot.thread.thread!}
                                data-testid="thread-summary"
                            />
                        ) : undefined
                    }
                    href={snapshot.thread.threadInfoHref}
                    label={snapshot.thread.threadInfoLabel}
                />
            ),
        [
            snapshot.thread.threadInfoMode,
            snapshot.thread.threadUpdateKey,
            props.mxEvent,
            snapshot.thread.thread,
            snapshot.thread.threadInfoHref,
            snapshot.thread.threadInfoLabel,
        ],
    );
    const preview = useMemo(
        () =>
            snapshot.thread.shouldRenderThreadPreview && snapshot.thread.thread ? (
                <ThreadMessagePreview key={snapshot.thread.threadUpdateKey} thread={snapshot.thread.thread} />
            ) : undefined,
        [snapshot.thread.shouldRenderThreadPreview, snapshot.thread.thread, snapshot.thread.threadUpdateKey],
    );
    const toolbar = useMemo(
        () =>
            snapshot.thread.shouldRenderThreadToolbar ? <ThreadToolbar vm={vm.threadToolbarViewModel} /> : undefined,
        [snapshot.thread.shouldRenderThreadToolbar, vm.threadToolbarViewModel],
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
                replyCount: snapshot.thread.threadReplyCount,
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
            snapshot.thread.threadReplyCount,
            preview,
            toolbar,
        ],
    );
}
