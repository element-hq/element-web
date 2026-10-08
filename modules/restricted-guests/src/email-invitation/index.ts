/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Api, DialogHandle, Room, RoomActionCallback } from "@element-hq/element-web-module-api";
import { GuestIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { EmailInvitationFormDialog } from "./EmailInvitationFormDialog";
import { EmailInvitationSuccessDialog } from "./EmailInvitationSuccessDialog";
import type { ModuleConfig } from "../config";
import { ErrorDialog } from "./ErrorDialog";
import type { EmailInvitationFormResult } from "./EmailInvitationFormDialog";

/**
 * Adds an "Invite guests" action to the room summary card and the member list header.
 * The action opens a form to invite guests by email, sends the invitations and shows the invited emails.
 * The action is disabled when the user can't invite, or when the room must switch to "knock" and the user
 * can't change the join rule.
 *
 * @param api - Module API
 * @param config - Module configuration
 */
export function initEmailInvitation(api: Api, config: ModuleConfig): void {
    const inviteGuestAction: RoomActionCallback = (roomId) => {
        const room = api.client.getRoom(roomId);
        if (!room) return undefined;

        // Inviting a guest switches the room to knock, so the user may also need to change the join rule
        const disabled = !room.canInvite() || (room.joinRule.value !== "knock" && !room.canChangeJoinRule());

        return {
            key: "restricted-guests",
            label: api.i18n.translate("invite_guest"),
            onClick: async () => {
                // Guests join through knocking, so old room versions can't have guests
                if (!room.supportsKnock()) {
                    showRoomVersionErrorDialog(api, room.name.value);
                    return;
                }

                // Ask the user for the emails to invite, and whether they want to change the join rule
                const { finished } = showInvitationFormDialog(api, room, config);

                const { ok, model } = await finished;
                if (!ok || !model) return;
                const { emails, hasToChangeJoinRule } = model;

                try {
                    // If the user has to change the join rule, do it before sending the invitations
                    if (hasToChangeJoinRule) {
                        await room.setJoinRule("knock");
                    }

                    // Send the invitations to the server. The server will send the emails to the guests.
                    await api.client.http.authedRequest("POST", "/invite_guests", {
                        prefix: "/_synapse/client",
                        body: { room_id: room.id, emails },
                    });
                } catch (e) {
                    console.error("Failed to invite guests", e);
                    showInvitationErrorDialog(api);
                    return;
                }

                // Once the invitations are sent, show the invited emails in a second dialog
                showInvitationSuccessDialog(api, emails);
            },
            disabled,
            icon: GuestIcon,
            disabledTooltip: api.i18n.translate("invite_guest_disabled_tooltip"),
        };
    };

    api.extras.addRoomSummaryCardActionCallback(inviteGuestAction);
    api.extras.addMemberListHeaderActionCallback(inviteGuestAction);
}

/**
 * Opens the form where the user enters the emails to invite and, if needed, confirms the join rule change.
 *
 * @param api - Module API
 * @param room - The room to invite guests to
 * @param config - Module configuration
 */
function showInvitationFormDialog(api: Api, room: Room, config: ModuleConfig): DialogHandle<EmailInvitationFormResult> {
    return api.openDialog(
        {
            title: api.i18n.translate("invitation_email_dialog_title", { roomName: room.name.value }),
        },
        EmailInvitationFormDialog,
        {
            api: api,
            room,
            config: config,
        },
    );
}

/**
 * Shows an error dialog explaining that the room version does not support guests,
 * and that the user can upgrade the room or create a new one.
 *
 * @param api - Module API
 * @param roomName - Name of the room, shown in the dialog title
 */
function showRoomVersionErrorDialog(api: Api, roomName: string): void {
    api.openDialog(
        {
            title: api.i18n.translate("room_version_error_dialog_title", {
                roomName,
            }),
        },
        ErrorDialog,
        {
            api,
            lines: [
                api.i18n.translate("room_version_error_dialog_line_1"),
                api.i18n.translate("room_version_error_dialog_line_2"),
            ],
        },
    );
}

/**
 * Shows an error dialog telling the user that the invitations could not be sent and to try again.
 *
 * @param api - Module API
 */
function showInvitationErrorDialog(api: Api): void {
    api.openDialog(
        {
            title: api.i18n.translate("invitation_email_dialog_error_title"),
        },
        ErrorDialog,
        {
            api,
            lines: [
                api.i18n.translate("invitation_email_dialog_error_line_1"),
                api.i18n.translate("invitation_email_dialog_error_line_2"),
            ],
        },
    );
}

/**
 * Shows a dialog confirming that the invitations were sent, listing the invited emails.
 *
 * @param api - Module API
 * @param emails - The invited email addresses
 */
function showInvitationSuccessDialog(api: Api, emails: string[]): void {
    api.openDialog(
        { ariaLabel: api.i18n.translate("invitation_email_dialog_success_title") },
        EmailInvitationSuccessDialog,
        { api, emails },
    );
}
