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
    /**
     * The event being quoted in the reply.
     */
    mxEvent: MatrixEvent;
    /**
     * Matrix client used to resolve event display info and sender avatars.
     */
    cli: MatrixClient;
    /**
     * Creates the permalink used as the reply link target. Falls back to `#` when absent.
     */
    permalinkCreator?: RoomPermalinkCreator;
    /**
     * Search terms to highlight in the quoted body.
     */
    highlights?: string[];
    /**
     * Link to navigate to when a highlight is clicked.
     */
    highlightLink?: string;
    /**
     * Toggles the expanded quote in the reply chain. Invoked on shift-click instead of navigating.
     */
    toggleExpandedQuote?: () => void;
    /**
     * Resolves relations (edits, reactions, etc.) for the quoted event.
     */
    getRelationsForEvent?: GetRelationsForEvent;
    /**
     * Presence status of the quoted event sender, shown in the sender profile.
     */
    userStatus?: UserStatus;
}

/**
 * ViewModel backing {@link ReplyTileView}: the compact quote of an event shown
 * in a reply chain or in the composer reply preview.
 *
 * Responsibilities:
 * - Compute the snapshot (permalink, sender presentation, inline/info flags and
 *   the rendered body) from the quoted event.
 * - Re-compute it when the quoted event is decrypted, redacted or replaced.
 * - Own the sender avatar and profile sub-ViewModels and dispose them.
 * - Handle activation of the reply link (navigate to the event, or expand the
 *   quote on shift-click).
 *
 * The body is rendered through {@link renderReplyTile} with reply-specific
 * overrides so that media is shown in a compact form.
 */
export class ReplyTileViewModel
    extends BaseViewModel<ReplyTileViewSnapshot, ReplyTileViewModelProps>
    implements ReplyTileViewModelInterface, ReplyTileViewActions
{
    /** The event currently listened to for decryption, redaction and edit updates. */
    private watchedEvent?: MatrixEvent;
    /** Avatar ViewModel for the quoted event sender, reused across snapshots. */
    private senderAvatarViewModel?: AppMemberAvatarViewModel;
    /** Member the avatar ViewModel was created for, used to detect when it must be recreated. */
    private senderAvatarMember?: RoomMember;
    /** Client the avatar ViewModel was created with, used to detect when it must be recreated. */
    private senderAvatarClient?: MatrixClient;
    /** Profile ViewModel for the quoted event sender, reused across snapshots. */
    private senderProfileViewModel?: AppDisambiguatedProfileViewModel;

    public constructor(props: ReplyTileViewModelProps) {
        // The sender sub-ViewModels need `this`, so compute a first snapshot without them
        // and replace it once the instance is initialised.
        super(props, ReplyTileViewModel.computeSnapshot(props, undefined));
        this.watchEvent(props.mxEvent);
        this.snapshot.set(this.computeSnapshot());
    }

    /**
     * Update the props and re-compute the snapshot.
     * Switches event listeners when the quoted event changes.
     */
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

    /**
     * Permalink to the quoted event, or `#` when no permalink creator is available.
     */
    private static readonly getPermalink = (props: ReplyTileViewModelProps): string => {
        const eventId = props.mxEvent.getId();
        if (props.permalinkCreator && eventId) {
            return props.permalinkCreator.forEvent(eventId);
        }
        return "#";
    };

    /**
     * Render the quoted event body.
     *
     * Media bodies are swapped for compact reply variants: images and stickers use
     * {@link MImageReplyBody}, audio attachments use the file body (voice messages keep
     * their player) and URL previews are disabled.
     */
    private static readonly renderBody = (
        props: ReplyTileViewModelProps,
        isSeeingThroughMessageHiddenForModeration: boolean,
    ): ReactNode => {
        const mxEvent = props.mxEvent;
        const ReplyTileFileBody: ComponentType<IBodyProps> = (bodyProps) => renderMBody(bodyProps, FileBodyFactory);

        const msgtypeOverrides: Record<string, ComponentType<IBodyProps>> = {
            [MsgType.Image]: MImageReplyBody,
            // Audio attachments render as a file body, voice messages keep their player.
            [MsgType.Audio]: isVoiceMessage(mxEvent) ? MVoiceMessageBody : ReplyTileFileBody,
            [MsgType.Video]: VideoBodyFactory,
        };
        const evOverrides: Record<string, ComponentType<IBodyProps>> = {
            // Use the image reply body so the sticker does not take up a lot of space.
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

    /**
     * Build the view snapshot for the quoted event.
     *
     * Events without a renderer produce an informational "unable to render" body.
     * Informational events and room creation already display their own sender, so the
     * sender presentation is omitted for them.
     */
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

    /**
     * Sender presentation for the quoted event, or `undefined` when the sender is unknown.
     * Emotes only show the avatar, as the display name is part of the body.
     */
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

    /**
     * Get the sender profile ViewModel, creating it on first use and updating it afterwards.
     */
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

    /**
     * Get the sender avatar ViewModel, recreating it when the member or client changes.
     */
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

    /**
     * Listen for changes to the quoted event that require the snapshot to be re-computed.
     */
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

    /**
     * Handle activation of the reply link.
     *
     * Links within the quoted body are left to the browser. Clicking the reply itself
     * navigates to the quoted event, or toggles the expanded quote on shift-click.
     * Default navigation is prevented so the permalink can still be copied or opened in
     * a new tab while in-app routing is used on a plain click.
     */
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
