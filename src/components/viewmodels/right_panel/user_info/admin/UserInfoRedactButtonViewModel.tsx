/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type RoomMember } from "matrix-js-sdk/src/matrix";

import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import Modal from "../../../../../Modal";
import BulkRedactDialog from "../../../../views/dialogs/BulkRedactDialog";

export interface RedactMessagesButtonState {
    onRedactAllMessagesClick: () => void;
}

/**
 * The view model for the redact messages button used in the UserInfoAdminToolsContainer
 * @param {RoomMember} member - the selected member to redact messages for
 * @returns {RedactMessagesButtonState} the redact messages button state
 */
export const useRedactMessagesButtonViewModel = (member: RoomMember): RedactMessagesButtonState => {
    const cli = useMatrixClientContext();

    const onRedactAllMessagesClick = (): void => {
        const room = cli.getRoom(member.roomId);
        if (!room) return;

        Modal.createDialog(BulkRedactDialog, {
            matrixClient: cli,
            room,
            member,
        });
    };

    return {
        onRedactAllMessagesClick,
    };
};
