/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ComponentType, type MouseEvent, type ReactNode } from "react";
import {
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    EventType,
    MsgType,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type UserStatus,
    type ReplyTileSenderViewSnapshot,
    type ReplyTileViewActions,
    type ReplyTileViewModel as ReplyTileViewModelInterface,
    type ReplyTileViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import dis from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { renderReplyTile } from "../../../../events/EventTileFactory";
import { type GetRelationsForEvent } from "../../../../components/views/rooms/EventTile";
import { type IBodyProps } from "../../../../components/views/messages/IBodyProps";
import { FileBodyFactory, VideoBodyFactory, renderMBody } from "../../../../components/views/messages/MBodyFactory";
import MImageReplyBody from "../../../../components/views/messages/MImageReplyBody";
import MVoiceMessageBody from "../../../../components/views/messages/MVoiceMessageBody";
import { isVoiceMessage } from "../../../../utils/EventUtils";
import { getEventDisplayInfo } from "../../../../utils/EventRenderingUtils";
import { MemberAvatarViewModel as AppMemberAvatarViewModel } from "../../../../components/viewmodels/avatars/MemberAvatarViewModel";
import {
    DisambiguatedProfileViewModel as AppDisambiguatedProfileViewModel,
    type MemberInfo,
} from "./DisambiguatedProfileViewModel";
import { roomMemberToMemberInfo } from "../../../../hooks/room/useRoomMemberProfile";

export interface ReplyTileViewModelProps {
    mxEvent: MatrixEvent;
    cli: MatrixClient;
    permalinkCreator?: RoomPermalinkCreator;
    highlights?: string[];
    highlightLink?: string;
    toggleExpandedQuote?: () => void;
    getRelationsForEvent?: GetRelationsForEvent;
    userStatus?: UserStatus;
}

export class ReplyTileViewModel
    extends BaseViewModel<ReplyTileViewSnapshot, ReplyTileViewModelProps>
    implements ReplyTileViewModelInterface, ReplyTileViewActions
{
    private watchedEvent?: MatrixEvent;
    private senderAvatarViewModel?: AppMemberAvatarViewModel;
    private senderAvatarMember?: RoomMember;
    private senderAvatarClient?: MatrixClient;
    private senderProfileViewModel?: AppDisambiguatedProfileViewModel;

    public constructor(props: ReplyTileViewModelProps) {
        super(props, ReplyTileViewModel.computeSnapshot(props, undefined));
        this.watchEvent(props.mxEvent);
        this.snapshot.set(this.computeSnapshot());
    }

    public setProps(props: ReplyTileViewModelProps): void {
        this.props = props;
        this.watchEvent(props.mxEvent);
        this.snapshot.set(this.computeSnapshot());
    }

    public override dispose(): void {
        this.unwatchEvent();
        this.senderAvatarViewModel?.dispose();
        this.senderAvatarViewModel = undefined;
        this.senderProfileViewModel?.dispose();
        this.senderProfileViewModel = undefined;
        super.dispose();
    }

    private static readonly getPermalink = (props: ReplyTileViewModelProps): string => {
        const eventId = props.mxEvent.getId();
        if (props.permalinkCreator && eventId) {
            return props.permalinkCreator.forEvent(eventId);
        }
        return "#";
    };

    private static readonly renderBody = (
        props: ReplyTileViewModelProps,
        isSeeingThroughMessageHiddenForModeration: boolean,
    ): ReactNode => {
        const mxEvent = props.mxEvent;
        const ReplyTileFileBody: ComponentType<IBodyProps> = (bodyProps) => renderMBody(bodyProps, FileBodyFactory);

        const msgtypeOverrides: Record<string, ComponentType<IBodyProps>> = {
            [MsgType.Image]: MImageReplyBody,
            [MsgType.Audio]: isVoiceMessage(mxEvent) ? MVoiceMessageBody : ReplyTileFileBody,
            [MsgType.Video]: VideoBodyFactory,
        };
        const evOverrides: Record<string, ComponentType<IBodyProps>> = {
            [EventType.Sticker]: MImageReplyBody,
        };

        return renderReplyTile(
            {
                mxEvent,
                getRelationsForEvent: props.getRelationsForEvent,
                highlights: props.highlights,
                highlightLink: props.highlightLink,
                permalinkCreator: props.permalinkCreator,
                showUrlPreview: false,
                showHiddenEvents: false,
                overrideBodyTypes: msgtypeOverrides,
                overrideEventTypes: evOverrides,
                maxImageHeight: 96,
                isSeeingThroughMessageHiddenForModeration,
                ref: undefined,
            },
            false,
        );
    };

    private static readonly computeSnapshot = (
        props: ReplyTileViewModelProps,
        sender?: ReplyTileSenderViewSnapshot,
    ): ReplyTileViewSnapshot => {
        const mxEvent = props.mxEvent;
        const msgType = mxEvent.getContent().msgtype;
        const evType = mxEvent.getType();
        const { hasRenderer, isInfoMessage, isSeeingThroughMessageHiddenForModeration } = getEventDisplayInfo(
            props.cli,
            mxEvent,
            false,
        );

        if (!hasRenderer) {
            logger.warn(`Event type not supported: type:${mxEvent.getType()} isState:${mxEvent.isState()}`);
            return {
                href: ReplyTileViewModel.getPermalink(props),
                body: _t("timeline|error_no_renderer"),
                info: true,
            };
        }

        const hasOwnSender = isInfoMessage || evType === EventType.RoomCreate;

        return {
            href: ReplyTileViewModel.getPermalink(props),
            sender: hasOwnSender ? undefined : sender,
            inline: msgType === MsgType.Emote,
            info: isInfoMessage && !mxEvent.isRedacted(),
            body: ReplyTileViewModel.renderBody(props, isSeeingThroughMessageHiddenForModeration),
        };
    };

    private computeSnapshot(): ReplyTileViewSnapshot {
        return ReplyTileViewModel.computeSnapshot(this.props, this.getSenderSnapshot());
    }

    private getSenderSnapshot(): ReplyTileSenderViewSnapshot | undefined {
        const member = this.props.mxEvent.sender;
        const userId = this.props.mxEvent.getSender() ?? member?.userId;
        if (!member && !userId) return undefined;
        const isEmote = this.props.mxEvent.getContent().msgtype === MsgType.Emote;

        if (isEmote) {
            this.clearSenderProfileViewModel();
        }

        return {
            avatarViewModel: member ? this.getSenderAvatarViewModel(member) : undefined,
            profileViewModel: isEmote
                ? undefined
                : this.getSenderProfileViewModel(userId ?? "", roomMemberToMemberInfo(member)),
        };
    }

    private getSenderProfileViewModel(
        fallbackName: string,
        member: MemberInfo | null,
    ): AppDisambiguatedProfileViewModel {
        if (!this.senderProfileViewModel) {
            this.senderProfileViewModel = new AppDisambiguatedProfileViewModel({
                fallbackName,
                member,
                colored: true,
                emphasizeDisplayName: true,
                userStatus: this.props.userStatus,
            });
        } else {
            this.senderProfileViewModel.setMember(fallbackName, member);
            this.senderProfileViewModel.setUserStatus(this.props.userStatus);
        }

        return this.senderProfileViewModel;
    }

    private clearSenderProfileViewModel(): void {
        this.senderProfileViewModel?.dispose();
        this.senderProfileViewModel = undefined;
    }

    private getSenderAvatarViewModel(member: RoomMember): AppMemberAvatarViewModel {
        if (
            !this.senderAvatarViewModel ||
            this.senderAvatarMember !== member ||
            this.senderAvatarClient !== this.props.cli
        ) {
            this.senderAvatarViewModel?.dispose();
            this.senderAvatarMember = member;
            this.senderAvatarClient = this.props.cli;
            this.senderAvatarViewModel = new AppMemberAvatarViewModel({ member, size: 16, cli: this.props.cli });
        }

        return this.senderAvatarViewModel;
    }

    private readonly onEventRequiresUpdate = (): void => {
        this.snapshot.set(this.computeSnapshot());
    };

    private watchEvent(mxEvent: MatrixEvent): void {
        if (this.watchedEvent === mxEvent) return;
        this.unwatchEvent();
        this.watchedEvent = mxEvent;
        mxEvent.on(MatrixEventEvent.Decrypted, this.onEventRequiresUpdate);
        mxEvent.on(MatrixEventEvent.BeforeRedaction, this.onEventRequiresUpdate);
        mxEvent.on(MatrixEventEvent.Replaced, this.onEventRequiresUpdate);
    }

    private readonly unwatchEvent = (): void => {
        this.watchedEvent?.off(MatrixEventEvent.Decrypted, this.onEventRequiresUpdate);
        this.watchedEvent?.off(MatrixEventEvent.BeforeRedaction, this.onEventRequiresUpdate);
        this.watchedEvent?.off(MatrixEventEvent.Replaced, this.onEventRequiresUpdate);
        this.watchedEvent = undefined;
    };

    public onClick = (event: MouseEvent<HTMLAnchorElement>): void => {
        const clickTarget = event.target as HTMLElement;
        if (
            clickTarget.tagName.toLowerCase() !== "a" ||
            clickTarget.closest("a") === null ||
            clickTarget === event.currentTarget
        ) {
            event.preventDefault();
            if (this.props.toggleExpandedQuote && event.shiftKey) {
                this.props.toggleExpandedQuote();
            } else {
                dis.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    event_id: this.props.mxEvent.getId(),
                    highlighted: true,
                    room_id: this.props.mxEvent.getRoomId(),
                    metricsTrigger: undefined,
                });
            }
        }
    };
}
