/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { type Filter, FilterEnum } from ".";

export class ExcludeTagsFilter implements Filter {
    public constructor(private tags: string[]) {}

    public matches(room: Room): boolean {
        return !this.tags.some((tag) => room.tags[tag]);
    }

    public get key(): FilterEnum.ExcludeTagsFilter {
        return FilterEnum.ExcludeTagsFilter;
    }
}
