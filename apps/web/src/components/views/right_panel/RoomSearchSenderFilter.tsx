/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { CheckboxMenuItem, IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import UserProfileIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-profile";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { RoomSearchSenderFilterViewModel } from "../../../viewmodels/search/RoomSearchSenderFilterViewModel";

interface Props {
    /** The room whose members can be picked as `from:` filters. Key this control by room id (see the VM). */
    room: Room;
    /** The currently-selected sender MXIDs (owned by the SearchSessionStore, threaded down as a prop). */
    senders: string[];
    /** Re-run the search with the updated sender filter (empty array clears it). */
    onSearchSendersChange: (senders: string[]) => void;
}

/**
 * `from:`/sender filter control for the in-room search header (Telegram-style member picker), sitting beside the
 * search input.
 *
 * A Compound {@link Menu} of the room's members as multi-select checkboxes; toggling a member re-runs the active
 * search narrowed to that sender (homeserver `IRoomEventFilter.senders` natively, Seshat via a client-side
 * post-filter). The selected senders are owned by RoomView's search session and threaded down as the `senders`
 * prop; this control is stateless and toggles them through the injected callback. Renders nothing when the room
 * has no other members (nobody to filter by).
 */
export function RoomSearchSenderFilter({ room, senders, onSearchSendersChange }: Props): JSX.Element | null {
    const vm = useCreateAutoDisposedViewModel(() => new RoomSearchSenderFilterViewModel({ room }));
    const { members } = useViewModel(vm);
    const [open, setOpen] = useState(false);

    if (members.length === 0) return null;

    const selected = new Set(senders);
    const toggle = (userId: string): void => {
        onSearchSendersChange(selected.has(userId) ? senders.filter((s) => s !== userId) : [...senders, userId]);
    };

    return (
        <Menu
            title={_t("room|search|sender_filter_label")}
            open={open}
            onOpenChange={setOpen}
            trigger={
                <IconButton
                    size="28px"
                    // The visual indicator dot is invisible to screen readers, so fold the active count into the
                    // accessible name when a filter is set.
                    aria-label={
                        senders.length > 0
                            ? _t("room|search|sender_filter_button_active", { count: senders.length })
                            : _t("room|search|sender_filter_button")
                    }
                    data-testid="search-sender-filter-button"
                    // A dot signals that a sender filter is active without opening the menu.
                    indicator={senders.length > 0 ? "default" : undefined}
                >
                    <UserProfileIcon width="20px" height="20px" />
                </IconButton>
            }
        >
            {members.map((m) => (
                <CheckboxMenuItem
                    key={m.userId}
                    label={m.name}
                    checked={selected.has(m.userId)}
                    onSelect={(e) => {
                        // Keep the menu open so several senders can be toggled in one pass (multi-select).
                        e.preventDefault();
                        toggle(m.userId);
                    }}
                />
            ))}
            {senders.length > 0 && (
                <MenuItem
                    kind="critical"
                    Icon={CloseIcon}
                    label={_t("room|search|sender_filter_clear")}
                    data-testid="search-sender-filter-clear"
                    onSelect={() => onSearchSendersChange([])}
                />
            )}
        </Menu>
    );
}
