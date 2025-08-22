/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import Modal from "../../../Modal.tsx";
import InviteProgressBody from "./InviteProgressBody.tsx";

/** A Modal dialog that pops up while room invites are being sent. */
const InviteProgressDialog: React.FC = (_) => {
    return <InviteProgressBody />;
};

/**
 * Open the invite progress dialog.
 *
 * Returns a callback which will close the dialog again.
 */
export function openInviteProgressDialog(): () => void {
    const onBeforeClose = async (reason?: string): Promise<boolean> => {
        // Inhibit closing via background click
        return reason != "backgroundClick";
    };

    const { close } = Modal.createDialog(
        InviteProgressDialog,
        /* props */ {},
        /* className */ undefined,
        /* isPriorityModal */ false,
        /* isStaticModal */ false,
        { onBeforeClose },
    );
    return close;
}
