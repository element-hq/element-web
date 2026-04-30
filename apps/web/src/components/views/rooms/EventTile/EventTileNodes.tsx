/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { DisambiguatedProfileView } from "@element-hq/web-shared-components";

import type { MatrixEvent, Relations, RoomMember } from "matrix-js-sdk/src/matrix";
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
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import { aboveRightOf } from "../../../structures/ContextMenu";
import ThreadSummary, { ThreadMessagePreview } from "../ThreadSummary";
import { ActionBar } from "./ActionBar";
import { Avatar } from "./Avatar";
import { Footer } from "./Footer";
import { MessageBody, type MessageBodyProps, type MessageBodyRenderTileProps } from "./MessageBody";
import { MessageStatus } from "./MessageStatus";
import { ReplyPreview } from "./ReplyPreview";
import { ThreadInfo } from "./ThreadInfo";
import { ThreadToolbar } from "./ThreadToolbar";
import type { EventTileContextMenuState, EventTileOps, GetRelationsForEvent, ReadReceiptProps } from "./types";
import type { Layout } from "../../../../settings/enums/Layout";

type EventTileNodesProps = {
    mxEvent: MatrixEvent;
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
    footer?: JSX.Element;
    contextMenu?: JSX.Element;
};

type EventTileThreadNodes = {
    info?: JSX.Element;
    replyCount?: number;
    preview?: JSX.Element;
    toolbar?: JSX.Element;
};

type BuildEventTileNodesArgs = {
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

type BuildEventTileNodeContext = BuildEventTileNodesArgs & {
    reactions: Relations | null;
};

type EventTileContextMenuProps = {
    contextMenuState: EventTileContextMenuState;
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    vm: EventTileViewModel;
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

function buildRenderTileProps(props: EventTileNodesProps): MessageBodyRenderTileProps {
    return {
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
    };
}

function buildReplyChainNode({
    props,
    snapshot,
    replyChainRef,
    vm,
}: BuildEventTileNodeContext): JSX.Element | undefined {
    if (!snapshot.rendering.shouldRenderReplyPreview) {
        return undefined;
    }

    const setQuoteExpanded = (expanded: boolean): void => {
        vm.setQuoteExpanded(expanded);
    };

    return (
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
    );
}

function buildActionBarNode({
    props,
    snapshot,
    reactions,
    tileRef,
    replyChainRef,
    vm,
    onActionBarMenuOpenChange,
}: BuildEventTileNodeContext): JSX.Element | undefined {
    if (!snapshot.rendering.shouldRenderActionBar) {
        return undefined;
    }

    return (
        <ActionBar
            mxEvent={props.mxEvent}
            permalinkCreator={props.permalinkCreator}
            getRelationsForEvent={props.getRelationsForEvent}
            reactions={reactions}
            vm={vm.getActionBarViewModel()}
            tileRef={tileRef}
            replyChainRef={replyChainRef}
            onMenuOpenChange={onActionBarMenuOpenChange}
        />
    );
}

function EventTileContextMenu({
    contextMenuState,
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    tileRef,
    replyChainRef,
    vm,
}: Readonly<EventTileContextMenuProps>): JSX.Element {
    const collapseReplyChain = replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined;

    return (
        <MessageContextMenu
            {...aboveRightOf(contextMenuState.position)}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            eventTileOps={tileRef.current ?? undefined}
            collapseReplyChain={collapseReplyChain}
            onFinished={() => vm.closeContextMenu()}
            rightClick={true}
            reactions={reactions}
            link={contextMenuState.link}
            getRelationsForEvent={getRelationsForEvent}
        />
    );
}

function buildContextMenuNode({
    props,
    snapshot,
    reactions,
    tileRef,
    replyChainRef,
    vm,
}: BuildEventTileNodeContext): JSX.Element | undefined {
    const contextMenuState = snapshot.interaction.contextMenuState;
    if (!contextMenuState || !snapshot.interaction.isContextMenuOpen) {
        return undefined;
    }

    return (
        <EventTileContextMenu
            mxEvent={props.mxEvent}
            permalinkCreator={props.permalinkCreator}
            getRelationsForEvent={props.getRelationsForEvent}
            reactions={reactions}
            contextMenuState={contextMenuState}
            tileRef={tileRef}
            replyChainRef={replyChainRef}
            vm={vm}
        />
    );
}

function buildMessageBodyNode({ props, roomContext, snapshot, tileRef }: BuildEventTileNodeContext): JSX.Element {
    const messageBodyProps: MessageBodyProps = {
        mxEvent: props.mxEvent,
        isDecryptionFailure: snapshot.encryption.isEncryptionFailure,
        timelineRenderingType: roomContext.timelineRenderingType,
        tileRenderType: snapshot.rendering.tileRenderType,
        isSeeingThroughMessageHiddenForModeration: snapshot.rendering.isSeeingThroughMessageHiddenForModeration,
        renderTileProps: buildRenderTileProps(props),
        tileRef,
        permalinkCreator: props.permalinkCreator,
        showHiddenEvents: roomContext.showHiddenEvents,
    };

    return <MessageBody {...messageBodyProps} />;
}

function buildThreadInfoNode({ props, snapshot }: BuildEventTileNodeContext): JSX.Element | undefined {
    if (snapshot.thread.threadInfoMode === ThreadInfoMode.None) {
        return undefined;
    }

    const summary =
        snapshot.thread.threadInfoMode === ThreadInfoMode.Summary ? (
            <ThreadSummary
                key={snapshot.thread.threadUpdateKey}
                mxEvent={props.mxEvent}
                thread={snapshot.thread.thread!}
                data-testid="thread-summary"
            />
        ) : undefined;

    return (
        <ThreadInfo summary={summary} href={snapshot.thread.threadInfoHref} label={snapshot.thread.threadInfoLabel} />
    );
}

function buildFooterNode({
    props,
    snapshot,
    reactions,
    tileContentId,
    vm,
}: BuildEventTileNodeContext): JSX.Element | undefined {
    if (!snapshot.rendering.hasFooter) {
        return undefined;
    }

    return (
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
    );
}

/** Builds the React nodes used by `EventTileView` from the current tile props and view-model snapshot. */
export function buildEventTileNodes(args: BuildEventTileNodesArgs): {
    content: EventTileContentNodes;
    thread: EventTileThreadNodes;
} {
    const { props, snapshot, suppressReadReceiptAnimation, vm } = args;
    const reactions = vm.getReactions();
    const context = { ...args, reactions };
    const avatarMember = getAvatarMember(props, snapshot.sender.avatarSubject);
    const sender = snapshot.sender.showSenderProfile ? (
        <DisambiguatedProfileView vm={vm.disambiguatedProfileViewModel} className="mx_DisambiguatedProfile" />
    ) : undefined;
    const avatar = (
        <Avatar
            member={avatarMember}
            size={snapshot.sender.avatarSize}
            viewUserOnClick={snapshot.sender.avatarMemberUserOnClick}
            forceHistorical={snapshot.sender.avatarForceHistorical}
        />
    );
    const messageStatus = (
        <MessageStatus
            vm={vm.messageStatusViewModel}
            readReceipts={props.readReceipts}
            readReceiptMap={props.readReceiptMap}
            checkUnmounting={props.checkUnmounting}
            isTwelveHour={props.isTwelveHour}
            suppressReadReceiptAnimation={suppressReadReceiptAnimation}
        />
    );
    const preview =
        snapshot.thread.shouldRenderThreadPreview && snapshot.thread.thread ? (
            <ThreadMessagePreview key={snapshot.thread.threadUpdateKey} thread={snapshot.thread.thread} />
        ) : undefined;
    const toolbar = snapshot.thread.shouldRenderThreadToolbar ? (
        <ThreadToolbar vm={vm.threadToolbarViewModel} />
    ) : undefined;

    return {
        content: {
            sender,
            avatar,
            replyChain: buildReplyChainNode(context),
            messageBody: buildMessageBodyNode(context),
            actionBar: buildActionBarNode(context),
            messageStatus,
            footer: buildFooterNode(context),
            contextMenu: buildContextMenuNode(context),
        },
        thread: {
            info: buildThreadInfoNode(context),
            replyCount: snapshot.thread.threadReplyCount,
            preview,
            toolbar,
        },
    };
}
