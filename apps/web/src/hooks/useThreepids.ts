/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type IThreepid } from "matrix-js-sdk/src/matrix";

import { useAsyncRefreshMemo } from "./useAsyncRefreshMemo";

export function useThreepids(client: MatrixClient): [IThreepid[], () => void] {
    return useAsyncRefreshMemo<IThreepid[]>(() => client.getThreePids().then((it) => it.threepids), [client], []);
}
