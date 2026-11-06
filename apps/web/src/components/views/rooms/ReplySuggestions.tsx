/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { ReplySuggestionsView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { ReplySuggestionsViewModel } from "../../../viewmodels/composer/ReplySuggestionsViewModel";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import PlatformPeg from "../../../PlatformPeg";

interface ReplySuggestionsProps {
    /** The room to suggest replies in */
    room: Room;
}

/**
 * Replies to the latest message of a room, suggested by the agent of the platform. Shows nothing on a platform
 * without an agent, or while no provider is connected.
 *
 * Give it a `key` of the room ID, so that it starts over in another room.
 */
export function ReplySuggestions({ room }: Readonly<ReplySuggestionsProps>): JSX.Element {
    const client = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(
        () => new ReplySuggestionsViewModel({ client, room, agent: PlatformPeg.get()?.agent }),
    );
    return <ReplySuggestionsView vm={vm} />;
}
