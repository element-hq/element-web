/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/** Type representing a valid JSON value */
export type JsonValue = null | string | number | boolean;

/** Type representing a valid JSON array */
export type JsonArray = Array<JsonValue | JsonObject | JsonArray>;

/** Type representing a valid JSON object */
export interface JsonObject {
    [key: string]: JsonObject | JsonArray | JsonValue;
}

/** Type representing a valid JSON document */
export type JsonDocument = JsonArray | JsonObject;
