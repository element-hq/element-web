/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MouseEvent } from "react";
import { EventType, MatrixEventEvent, MsgType, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type ReplyTileViewModel as ReplyTileViewModelInterface,
    type ReplyTileViewSnapshot,
} from "@element-hq/web-shared-components";

import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
import { _t } from "../../../../languageHandler";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { getEventDisplayInfo } from "../../../../utils/EventRenderingUtils";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";

export interface ReplyTileViewModelProps {
    /** Matrix client used to derive render metadata. */
    client: MatrixClient;
    /** Matrix event rendered inside the reply tile. */
    mxEvent: MatrixEvent;
    /** Optional permalink creator for the event link. */
    permalinkCreator?: RoomPermalinkCreator;
    /** Optional callback for expanding/collapsing a quoted reply chain. */
    toggleExpandedQuote?: () => void;
}

interface ReplyTileViewModelSnapshot extends ReplyTileViewSnapshot {
    /** Whether the body slot should expose hidden-pending-moderation content. */
    isSeeingThroughMessageHiddenForModeration: boolean;
}

const CAPTIONED_MEDIA_MSGTYPES = new Set<MsgType>([MsgType.Image, MsgType.File, MsgType.Audio, MsgType.Video]);
const TEXTUAL_MSGTYPES = new Set<MsgType>([MsgType.Text, MsgType.Notice, MsgType.Emote]);

export class ReplyTileViewModel
    extends BaseViewModel<ReplyTileViewModelSnapshot, ReplyTileViewModelProps>
    implements ReplyTileViewModelInterface
{
    private observedEvent?: MatrixEvent;

    private static readonly computePermalink = ({
        mxEvent,
        permalinkCreator,
    }: Pick<ReplyTileViewModelProps, "mxEvent" | "permalinkCreator">): string => {
        const eventId = mxEvent.getId();

        return permalinkCreator && eventId ? permalinkCreator.forEvent(eventId) : "#";
    };

    private static readonly computeShouldClampContent = (mxEvent: MatrixEvent): boolean => {
        if (mxEvent.isRedacted()) {
            return false;
        }

        if (mxEvent.isDecryptionFailure()) {
            return true;
        }

        const content = mxEvent.getContent();
        const msgType = content.msgtype as MsgType | undefined;
        if (!msgType) {
            return false;
        }

        const hasCaption =
            CAPTIONED_MEDIA_MSGTYPES.has(msgType) && !!content.filename && content.filename !== content.body;

        return TEXTUAL_MSGTYPES.has(msgType) || hasCaption;
    };

    private static readonly computeSnapshot = (props: ReplyTileViewModelProps): ReplyTileViewModelSnapshot => {
        const { client, mxEvent } = props;
        const msgType = mxEvent.getContent().msgtype;
        const evType = mxEvent.getType();
        const { hasRenderer, isInfoMessage, isSeeingThroughMessageHiddenForModeration } = getEventDisplayInfo(
            client,
            mxEvent,
            false,
        );

        if (!hasRenderer) {
            logger.warn(`Event type not supported: type:${mxEvent.getType()} isState:${mxEvent.isState()}`);
        }

        return {
            permalink: ReplyTileViewModel.computePermalink(props),
            isInline: msgType === MsgType.Emote,
            isInfoMessage: isInfoMessage && !mxEvent.isRedacted(),
            showSender: !(isInfoMessage || evType === EventType.RoomCreate),
            shouldClampContent: ReplyTileViewModel.computeShouldClampContent(mxEvent),
            noRendererMessage: hasRenderer ? undefined : _t("timeline|error_no_renderer"),
            isSeeingThroughMessageHiddenForModeration,
        };
    };

    public constructor(props: ReplyTileViewModelProps) {
        super(props, ReplyTileViewModel.computeSnapshot(props));

        this.addEventListeners(props.mxEvent);
    }

    public setEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.removeEventListeners();
        this.props = {
            ...this.props,
            mxEvent,
        };
        this.addEventListeners(mxEvent);
        this.updateSnapshotFromEvent();
    }

    public setClient(client: MatrixClient): void {
        if (this.props.client === client) return;

        this.props = {
            ...this.props,
            client,
        };
        this.updateSnapshotFromEvent();
    }

    public setPermalinkCreator(permalinkCreator?: RoomPermalinkCreator): void {
        if (this.props.permalinkCreator === permalinkCreator) return;

        this.props = {
            ...this.props,
            permalinkCreator,
        };
        this.snapshot.merge({
            permalink: ReplyTileViewModel.computePermalink(this.props),
        });
    }

    public setToggleExpandedQuote(toggleExpandedQuote?: () => void): void {
        if (this.props.toggleExpandedQuote === toggleExpandedQuote) return;

        this.props = {
            ...this.props,
            toggleExpandedQuote,
        };
    }

    public onClick = (event: MouseEvent<HTMLAnchorElement>): void => {
        const { mxEvent, toggleExpandedQuote } = this.props;

        if (toggleExpandedQuote && event.shiftKey) {
            toggleExpandedQuote();
            return;
        }

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: mxEvent.getId(),
            highlighted: true,
            room_id: mxEvent.getRoomId(),
            metricsTrigger: undefined,
        });
    };

    public override dispose(): void {
        this.removeEventListeners();
        super.dispose();
    }

    private addEventListeners(mxEvent: MatrixEvent): void {
        this.observedEvent = mxEvent;
        mxEvent.on(MatrixEventEvent.Decrypted, this.updateSnapshotFromEvent);
        mxEvent.on(MatrixEventEvent.BeforeRedaction, this.updateSnapshotFromEvent);
        mxEvent.on(MatrixEventEvent.Replaced, this.updateSnapshotFromEvent);
    }

    private removeEventListeners(): void {
        if (!this.observedEvent) return;

        this.observedEvent.removeListener(MatrixEventEvent.Decrypted, this.updateSnapshotFromEvent);
        this.observedEvent.removeListener(MatrixEventEvent.BeforeRedaction, this.updateSnapshotFromEvent);
        this.observedEvent.removeListener(MatrixEventEvent.Replaced, this.updateSnapshotFromEvent);
        this.observedEvent = undefined;
    }

    private updateSnapshotFromEvent = (): void => {
        this.snapshot.set(ReplyTileViewModel.computeSnapshot(this.props));
    };
}
