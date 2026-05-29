/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { E2eMessageSharedIconView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { E2eMessageSharedIconViewModel } from "../../../../viewmodels/room/timeline/event-tile/E2eMessageSharedIconViewModel";

interface E2eMessageSharedIconAdapterProps {
    /**
     * The ID of the room containing the event whose keys were shared.
     */
    roomId: string;
    /**
     * The ID of the user who shared the keys.
     */
    keyForwardingUserId: string;
}

export function E2eMessageSharedIconAdapter({
    roomId,
    keyForwardingUserId,
}: Readonly<E2eMessageSharedIconAdapterProps>): JSX.Element {
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
