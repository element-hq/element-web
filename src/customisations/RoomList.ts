/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import type { RoomListCustomisations as IRoomListCustomisations } from "@element-hq/element-web-module-api";

// Populate this file with the details of your customisations when copying it.

// A real customisation module will define and export one or more of the
// customisation points that make up the interface above.
export const RoomListCustomisations: IRoomListCustomisations<Room> = {};
