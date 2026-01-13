/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { EventTimeline } from "matrix-js-sdk/src/matrix";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext.tsx";
import { _t } from "../../../../languageHandler.tsx";
import { E2ePadlock, E2ePadlockIcon } from "./E2ePadlock.tsx";

/** The React properties of an {@link E2eMessageSharedIcon}. */
interface E2eMessageSharedIconParams {
    /** The ID of the user who shared the keys. */
    keyForwardingUserId: string;

    /** The ID of the room that contains the event whose keys were shared. Used to find the displayname of the user who shared the keys. */
    roomId: string;
}

/**
 * A small icon with tooltip, used as part of an {@link EventTile}, which indicates that the key to this event
 * was shared with us by another user.
 *
 * An alternative to the {@link E2ePadlock} component, which is used for UTD events and other error cases.
 */
export function E2eMessageSharedIcon(props: E2eMessageSharedIconParams): JSX.Element {
    const { roomId, keyForwardingUserId } = props;
    const client = useMatrixClientContext();

    const roomState = client.getRoom(roomId)?.getLiveTimeline()?.getState(EventTimeline.FORWARDS);
    const forwardingMember = roomState?.getMember(keyForwardingUserId);

    // We always disambiguate the user, since we need to prevent users from forging a disambiguation, and
    // the ToolTip component doesn't support putting styling inside a label.
    const tooltip = _t("encryption|message_shared_by", {
        displayName: forwardingMember?.rawDisplayName ?? keyForwardingUserId,
        userId: keyForwardingUserId,
    });

    return <E2ePadlock icon={E2ePadlockIcon.Normal} title={tooltip} />;
}
