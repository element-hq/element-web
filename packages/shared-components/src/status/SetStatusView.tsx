/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Menu, MenuItem, Text } from "@vector-im/compound-web";
import { ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td, type UserStatus } from "..";
import { useViewModel, type ViewModel } from "../core/viewmodel";
import { StatusButtonView } from "./StatusButtonView";
import styles from "./SetStatusView.module.css";

const PRESET_STATUSES = [
    { emoji: "💬", textKey: _td("status|set_status|in_a_meeting") },
    { emoji: "💡", textKey: _td("status|set_status|focus_time") },
    { emoji: "🚙", textKey: _td("status|set_status|on_the_road") },
    { emoji: "☕️", textKey: _td("status|set_status|be_right_back") },
    { emoji: "🌴", textKey: _td("status|set_status|away") },
];

export interface SetStatusViewSnapshot {
    /**
     * The current user status, or undefined if no status is set.
     */
    userStatus?: UserStatus;

    /**
     * Whether the status picker dropdown is open.
     */
    open: boolean;
}

export interface SetStatusViewActions {
    /**
     * When the user clicks the trigger to open or close the menu
     * @param open Whether the menu should be open or closed
     */
    onOpenChange: (open: boolean) => void;

    /**
     * Called when the user selects a preset status from the dropdown.
     */
    setStatus: (status: UserStatus) => void;

    /**
     * Called when the user clears their current status.
     */
    clearStatus: () => void;
}

export type SetStatusViewModel = ViewModel<SetStatusViewSnapshot, SetStatusViewActions>;

export type SetStatusViewProps = {
    vm: SetStatusViewModel;
};

export function SetStatusView({ vm }: SetStatusViewProps): JSX.Element {
    const { userStatus, open } = useViewModel(vm);

    const trigger = userStatus ? (
        <StatusButtonView status={userStatus} clearStatus={vm.clearStatus} />
    ) : (
        <button className={styles.setStatusTrigger}>
            <ReactionIcon />
            <Text as="span" type="body" size="md" weight="medium">
                {_t("status|set_status|set_status_prompt")}
            </Text>
        </button>
    );

    return (
        <Menu
            open={open}
            title={_t("status|set_status|set_status_prompt")}
            showTitle={false}
            trigger={trigger}
            onOpenChange={vm.onOpenChange}
        >
            {PRESET_STATUSES.map((status) => (
                <MenuItem
                    key={status.textKey}
                    label={null}
                    onSelect={() => vm.setStatus({ emoji: status.emoji, text: _t(status.textKey) })}
                    hideChevron={true}
                    className={styles.menuItem}
                >
                    <span>{status.emoji}</span> <span>{_t(status.textKey)}</span>
                </MenuItem>
            ))}
        </Menu>
    );
}
