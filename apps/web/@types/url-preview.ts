/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type UnstableBundledUrlPreviews } from "@element-hq/element-web-module-api";
import { type RoomMessageEventContent as SdkRoomMessageEventContent } from "matrix-js-sdk/src/types";

export type RoomMessageEventContent = SdkRoomMessageEventContent & UnstableBundledUrlPreviews;
