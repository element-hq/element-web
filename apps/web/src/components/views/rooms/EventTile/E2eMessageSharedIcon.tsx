/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect } from "react";
import { E2eMessageSharedIconView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext.tsx";
import { E2eMessageSharedIconViewModel } from "../../../../viewmodels/room/timeline/event-tile/E2eMessageSharedIconViewModel.ts";

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
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new E2eMessageSharedIconViewModel({
                client,
                roomId,
                keyForwardingUserId,
            }),
    );

    useEffect(() => {
        vm.setClient(client);
    }, [client, vm]);

    useEffect(() => {
        vm.setRoomId(roomId);
    }, [roomId, vm]);

    useEffect(() => {
        vm.setKeyForwardingUserId(keyForwardingUserId);
    }, [keyForwardingUserId, vm]);

    return (
        <E2eMessageSharedIconView
            vm={vm}
            className={
                // Timeline PCSS uses this app class as a layout hook for positioning and layout variants.
                "mx_EventTile_e2eIcon"
            }
        />
    );
}
