/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useState } from "react";
import { Dropdown, type DropdownTriggerProps, Link, Text } from "@vector-im/compound-web";
import { ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td, type UserStatus } from "..";
import { useViewModel, type ViewModel } from "../core/viewmodel";
import { StatusPillView } from "./StatusPillView";
import { CustomStatusView } from "./CustomStatusView";
import styles from "./SetStatusView.module.css";

const PRESET_STATUSES = [
    { emoji: "💬", textKey: _td("status|set_status|in_a_meeting") },
    { emoji: "💡", textKey: _td("status|set_status|focus_time") },
    { emoji: "🚙", textKey: _td("status|set_status|on_the_road") },
    { emoji: "☕️", textKey: _td("status|set_status|be_right_back") },
    { emoji: "🌴", textKey: _td("status|set_status|away") },
];

// Sentinel value used to distinguish the "Custom…" dropdown entry from a preset.
const CUSTOM_STATUS_VALUE = "custom";

export interface SetStatusViewSnapshot {
    /**
     * The current user status, or undefined if no status is set.
     */
    userStatus?: UserStatus;
}

export interface SetStatusViewActions {
    /**
     * Called when the user clicks to start setting a status.
     *
     * If falsy, the default dropdown will open for the user to choose a status.
     */
    onSetStatusClick?: () => void;

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
    const { userStatus } = useViewModel(vm);
    const [customMode, setCustomMode] = useState(false);

    if (userStatus) {
        return <StatusPillView status={userStatus} clearStatus={vm.clearStatus} />;
    }

    if (customMode) {
        return (
            <CustomStatusView
                onSave={(status) => {
                    setCustomMode(false);
                    vm.setStatus(status);
                }}
                onCancel={() => setCustomMode(false)}
            />
        );
    }

    const renderTrigger = (props: DropdownTriggerProps): JSX.Element => {
        const trigger = (
            <div className={styles.setStatusContainer}>
                <Link
                    className={styles.setStatusTrigger}
                    aria-label={_t("status|set_status|set_status_prompt")}
                    {...props}
                >
                    <ReactionIcon />
                    <Text as="span" type="body" size="md" weight="medium">
                        {_t("status|set_status|set_status_prompt")}
                    </Text>
                </Link>
            </div>
        );

        return trigger;
    };

    const onValueChange = (value: string): void => {
        if (value === CUSTOM_STATUS_VALUE) {
            setCustomMode(true);
            return;
        }

        const status = PRESET_STATUSES.find((s) => s.textKey === value);

        if (!status) {
            return;
        }

        vm.setStatus({
            emoji: status.emoji,
            text: _t(status.textKey),
        });
    };

    const dropdownValues: Array<[string, string]> = [
        ...PRESET_STATUSES.map((s): [string, string] => [s.textKey, `${s.emoji} ${_t(s.textKey)}`]),
        [CUSTOM_STATUS_VALUE, `✍️ ${_t("status|set_status|custom")}`],
    ];

    return vm.onSetStatusClick ? (
        renderTrigger({ onClick: vm.onSetStatusClick })
    ) : (
        <Dropdown
            values={dropdownValues}
            label={null}
            placeholder={null}
            trigger={renderTrigger}
            onValueChange={onValueChange}
        />
    );
}
