/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { type Filter } from ".";

export class TagFilter implements Filter {
    public constructor(private tag: string) {}

    public matches(room: Room): boolean {
        return !!room.tags[this.tag];
    }

    public get key(): string {
        return this.tag;
    }
}
