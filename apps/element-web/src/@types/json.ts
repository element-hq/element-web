/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export type JsonValue = null | string | number | boolean;
export type JsonArray = Array<JsonValue | JsonObject | JsonArray>;
export interface JsonObject {
    [key: string]: JsonObject | JsonArray | JsonValue;
}
export type Json = JsonArray | JsonObject;
