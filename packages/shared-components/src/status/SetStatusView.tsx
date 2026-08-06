/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useState } from "react";
import { Dropdown, type DropdownTriggerProps, Link, Text } from "@vector-im/compound-web";
import { ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td, type UserStatus } from "..";
import { useViewModel, type ViewModel } from "../core/viewmodel";
import { StatusPillView } from "./StatusPillView";
import { CustomStatusView } from "./CustomStatusView";
import styles from "./SetStatusView.module.css";

const STATUSES = {
    in_a_meeting: { emoji: "💬", textKey: _td("status|set_status|in_a_meeting") },
    focus_time: { emoji: "💡", textKey: _td("status|set_status|focus_time") },
    on_the_road: { emoji: "🚙", textKey: _td("status|set_status|on_the_road") },
    be_right_back: { emoji: "☕️", textKey: _td("status|set_status|be_right_back") },
    away: { emoji: "🌴", textKey: _td("status|set_status|away") },
    custom: { emoji: "✍️", textKey: _td("status|set_status|custom") },
};
type StatusValue = keyof typeof STATUSES;
// No need to keep recompyuting this, it won't change
const STATUS_KEYS = Object.keys(STATUSES) as StatusValue[];

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

function StatusOption({ value }: { value: StatusValue }): React.ReactNode {
    return (
        <>
            <span className={styles.dropdownEmoji}>{STATUSES[value].emoji}</span>
            <span>{_t(STATUSES[value].textKey)}</span>
        </>
    );
}

export function SetStatusView({ vm }: SetStatusViewProps): JSX.Element {
    const { userStatus } = useViewModel(vm);
    const [customMode, setCustomMode] = useState(false);

    const renderItem = useCallback((value: StatusValue | null): React.ReactNode => {
        if (value === null) return null;

        return <StatusOption value={value} />;
    }, []);

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

    const onValueChange = (value: StatusValue): void => {
        if (value === "custom") {
            setCustomMode(true);
            return;
        }

        const status = STATUSES[value];

        if (!status) {
            return;
        }

        vm.setStatus({
            emoji: status.emoji,
            text: _t(status.textKey),
        });
    };

    return vm.onSetStatusClick ? (
        renderTrigger({ onClick: vm.onSetStatusClick })
    ) : (
        <Dropdown<StatusValue>
            values={STATUS_KEYS}
            label={null}
            trigger={renderTrigger}
            onValueChange={onValueChange}
            renderItem={renderItem}
        />
    );
}
