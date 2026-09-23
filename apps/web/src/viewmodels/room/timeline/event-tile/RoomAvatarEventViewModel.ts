/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type RoomAvatarEventContent } from "matrix-js-sdk/src/types";
import {
    BaseViewModel,
    type RoomAvatarEventViewModel as RoomAvatarEventViewModelInterface,
    type RoomAvatarEventViewSnapshot,
} from "@element-hq/web-shared-components";

import { mediaFromMxc } from "../../../../customisations/Media";
import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";
import ImageView from "../../../../components/views/elements/ImageView";

export interface RoomAvatarEventViewModelProps {
    /**
     * Caller-provided client.
     */
    cli: MatrixClient;
    /**
     * Room avatar state event.
     */
    mxEvent: MatrixEvent;
}

/**
 * ViewModel for room avatar state events.
 */
export class RoomAvatarEventViewModel
    extends BaseViewModel<RoomAvatarEventViewSnapshot, RoomAvatarEventViewModelProps>
    implements RoomAvatarEventViewModelInterface
{
    public constructor(props: RoomAvatarEventViewModelProps) {
        super(props, RoomAvatarEventViewModel.computeSnapshot(props));
    }

    public setEvent(mxEvent: MatrixEvent): void {
        this.props = { ...this.props, mxEvent };
        this.updateSnapshotFromProps();
    }

    public onAvatarClick = (): void => {
        const avatarUrl = RoomAvatarEventViewModel.getAvatarUrl(this.props.mxEvent);
        if (!avatarUrl) return;

        const httpUrl = mediaFromMxc(avatarUrl, this.props.cli).srcHttp;
        if (!httpUrl) return;

        Modal.createDialog(
            ImageView,
            {
                src: httpUrl,
                name: RoomAvatarEventViewModel.computeLightboxLabel(this.props),
            },
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    };

    private updateSnapshotFromProps(): void {
        this.snapshot.merge(RoomAvatarEventViewModel.computeSnapshot(this.props));
    }

    private static computeSnapshot(props: RoomAvatarEventViewModelProps): RoomAvatarEventViewSnapshot {
        const avatarUrl = RoomAvatarEventViewModel.getAvatarUrl(props.mxEvent);
        const senderDisplayName = RoomAvatarEventViewModel.getSenderDisplayName(props.mxEvent);
        const roomName = RoomAvatarEventViewModel.getRoomName(props);

        return {
            senderDisplayName,
            roomName,
            avatarUrl,
            lightboxLabel: RoomAvatarEventViewModel.computeLightboxLabel(props),
            isRemoved: !avatarUrl,
        };
    }

    private static computeLightboxLabel(props: RoomAvatarEventViewModelProps): string {
        return _t("timeline|m.room.avatar|lightbox_title", {
            senderDisplayName: RoomAvatarEventViewModel.getSenderDisplayName(props.mxEvent),
            roomName: RoomAvatarEventViewModel.getRoomName(props),
        });
    }

    private static getSenderDisplayName(mxEvent: MatrixEvent): string {
        return mxEvent.sender?.name || mxEvent.getSender() || "";
    }

    private static getRoomName({ cli, mxEvent }: RoomAvatarEventViewModelProps): string {
        const roomId = mxEvent.getRoomId();
        if (!roomId) return "";

        return cli.getRoom(roomId)?.name ?? "";
    }

    private static getAvatarUrl(mxEvent: MatrixEvent): string | undefined {
        const avatarUrl = mxEvent.getContent<RoomAvatarEventContent>().url;
        if (!avatarUrl || avatarUrl.trim().length === 0) return undefined;

        return avatarUrl;
    }
}
