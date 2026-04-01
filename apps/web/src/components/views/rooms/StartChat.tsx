/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { StartChatView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";
import React, { type JSX } from "react";

import { StartChatViewModel } from "../../../viewmodels/room/StartChatViewModel";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext";

/**
 * Wrapper around StartChatView that creates the StartChatViewModel and passes it to the view.
 */
export function StartChat(): JSX.Element {
    const matrixClient = useMatrixClientContext();
    const { room } = useScopedRoomContext("room", "roomId");
    const vm = useCreateAutoDisposedViewModel(() => new StartChatViewModel({ room: room!, matrixClient }));

    return <StartChatView vm={vm} />;
}
