/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import Modal from "../../Modal";
import ConfirmUserActionDialog from "../../components/views/dialogs/ConfirmUserActionDialog";
import { _t } from "../../languageHandler";

/**
 * Ask for confirmation and an optional reason, then ban a user who knocked on the room.
 * Resolves without banning if the user cancels the dialog.
 * @param room - the room the member knocked on
 * @param member - the knocking member to ban
 */
export async function banKnockingMember(room: Room, member: RoomMember): Promise<void> {
    const { finished } = Modal.createDialog(ConfirmUserActionDialog, {
        member,
        action: _t("user_info|ban_button_room"),
        title: _t("user_info|ban_room_confirm_title", { roomName: room.name }),
        askReason: true,
        danger: true,
    });
    const [proceed, reason] = await finished;
    if (!proceed) return;
    await room.client.ban(room.roomId, member.userId, reason || undefined);
}
