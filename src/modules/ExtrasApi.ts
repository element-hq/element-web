/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SpacePanelItemProps, type ExtrasApi } from "@element-hq/element-web-module-api";

export class ElementWebExtrasApi implements ExtrasApi {
    public spacePanelItems: SpacePanelItemProps[] = [];

    public addSpacePanelItem(item: SpacePanelItemProps): void {
        this.spacePanelItems.push(item);
    }
}
