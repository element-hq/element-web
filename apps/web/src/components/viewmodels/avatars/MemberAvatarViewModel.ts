/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, type MemberAvatarViewSnapshot } from "@element-hq/web-shared-components";
import { type MatrixClient, RoomStateEvent, type RoomMember } from "matrix-js-sdk/src/matrix";

import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import { mediaFromMxc } from "../../../customisations/Media";

interface Props {
    /**
     * The size of the avatar in pixels, eg: 20.
     */
    size: number;
    /**
     * The room member for this avatar.
     */
    member: RoomMember;

    /**
     * MatrixClient object to access js-sdk.
     */
    cli: MatrixClient;
}

function computeSnapshot(props: Props): MemberAvatarViewSnapshot {
    const size = props.size;
    const member = props.member;
    const id = member.userId;
    const name = member.name ?? member.userId;
    const title =
        UserIdentifierCustomisations.getDisplayUserIdentifier(member.userId ?? "", {
            roomId: member.roomId ?? "",
        }) ?? member.userId;
    let url: string | undefined;
    if (member.getMxcAvatarUrl()) {
        url =
            mediaFromMxc(member.getMxcAvatarUrl() ?? "", props.cli).getThumbnailOfSourceHttp(size, size, "crop") ??
            undefined;
    }
    return {
        name,
        id,
        url,
        size: `${size}px`,
        title,
    };
}

/**
 * A view-model for rendering the avatar for a given room member.
 */
export class MemberAvatarViewModel extends BaseViewModel<MemberAvatarViewSnapshot, Props> {
    public constructor(props: Props) {
        super(props, computeSnapshot(props));
        const roomId = props.member.roomId;
        const room = props.cli.getRoom(roomId);
        if (room) {
            this.disposables.trackListener(room, RoomStateEvent.Members, this.onUpdate as (...args: unknown[]) => void);
        }
    }

    private onUpdate = (event: unknown, state: unknown, member: RoomMember): void => {
        if (member.userId === this.props.member.userId) {
            const newSnapshot = computeSnapshot(this.props);
            this.snapshot.set(newSnapshot);
        }
    };
}
