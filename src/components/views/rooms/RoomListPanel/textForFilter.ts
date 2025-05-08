/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { _t } from "../../../../languageHandler";
import { SecondaryFilters } from "../../../viewmodels/roomlist/useFilteredRooms";

/**
 * Gives the human readable text name for a secondary filter.
 * @param filter The filter in question
 * @returns The translated, human readable name for the filter
 */
export function textForSecondaryFilter(filter: SecondaryFilters): string {
    switch (filter) {
        case SecondaryFilters.AllActivity:
            return _t("room_list|secondary_filter|all_activity");
        case SecondaryFilters.MentionsOnly:
            return _t("room_list|secondary_filter|mentions_only");
        case SecondaryFilters.InvitesOnly:
            return _t("room_list|secondary_filter|invites_only");
        case SecondaryFilters.LowPriority:
            return _t("room_list|secondary_filter|low_priority");
        default:
            throw new Error("Unknown filter");
    }
}
