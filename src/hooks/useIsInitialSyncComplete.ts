/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent } from "matrix-js-sdk/src/matrix";

import { useEventEmitterState } from "./useEventEmitter";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";

export function useInitialSyncComplete(): boolean {
    const cli = useMatrixClientContext();
    return useEventEmitterState(cli, ClientEvent.Sync, () => cli.isInitialSyncComplete());
}
