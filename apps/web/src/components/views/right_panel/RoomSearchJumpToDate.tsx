/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { IconButton } from "@vector-im/compound-web";
import CalendarIcon from "@vector-im/compound-design-tokens/assets/web/icons/calendar";
import {
    DateSeparatorContextMenuView,
    useCreateAutoDisposedViewModel,
    useViewModel,
} from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { DateSeparatorViewModel } from "../../../viewmodels/room/timeline/DateSeparatorViewModel";

interface Props {
    /**
     * The room whose live timeline the date jump targets. Mount this control keyed by the room id so the underlying
     * ViewModel (which only reads `roomId` at construction) always matches the room being searched.
     */
    roomId: string;
}

/**
 * Jump-to-date control for the in-room search header (Telegram-style calendar in the search bar).
 *
 * Reuses the timeline date separator's {@link DateSeparatorViewModel} + {@link DateSeparatorContextMenuView} so the
 * quick options, date picker, MSC3030 resolution and error handling stay identical to the timeline affordance. The
 * menu dispatches a plain `ViewRoom` with the resolved event id, which RoomView's clear gate treats like a result
 * click: it ends any active search and teleports the live timeline to that date.
 *
 * Renders nothing unless jump-to-date is enabled (`feature_jump_to_date`, gated on the homeserver supporting
 * MSC3030).
 */
export function RoomSearchJumpToDate({ roomId }: Props): JSX.Element | null {
    const vm = useCreateAutoDisposedViewModel(() => new DateSeparatorViewModel({ roomId, ts: Date.now() }));
    const { jumpToEnabled } = useViewModel(vm);
    const [open, setOpen] = useState(false);

    if (!jumpToEnabled) return null;

    return (
        <DateSeparatorContextMenuView
            vm={vm}
            open={open}
            onOpenChange={setOpen}
            trigger={
                <IconButton
                    size="28px"
                    aria-label={_t("room|search|jump_to_date_button")}
                    data-testid="search-jump-to-date-button"
                >
                    <CalendarIcon width="20px" height="20px" />
                </IconButton>
            }
        />
    );
}
