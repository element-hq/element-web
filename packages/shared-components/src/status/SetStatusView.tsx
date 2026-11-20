/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useState, useCallback } from "react";
import { Dropdown, type DropdownTriggerProps, Link, MenuItem, SubMenu, Text } from "@vector-im/compound-web";
import { ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td, type UserStatus } from "..";
import { useViewModel, type ViewModel } from "../core/viewmodel";
import { StatusPillView } from "./StatusPillView";
import { CustomStatusView } from "./CustomStatusView";
import styles from "./SetStatusView.module.css";
import classNames from "classnames";

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

    /**
     * Recently used emoji (unicode strings, most relevant first) to offer when
     * choosing an emoji for a custom status.
     */
    recentEmojis?: string[];

    /**
     * If true, the view will show as disabled and cannot be interacted with.
     * Default: false
     */
    disabled?: boolean;
}

export interface SetStatusViewActions {
    /**
     * Called when the user clicks to start setting a custom status.
     *
     * If falsy, the UI will change to allow the user to choose an emoji and enter text.
     */
    onSetCustomStatusClick?: () => void;

    /**
     * Called when the user selects a preset status from the dropdown.
     */
    setStatus: (status: UserStatus) => void;

    /**
     * Called when the user clears their current status.
     */
    clearStatus: () => void;

    /**
     * Called with the unicode of an emoji the user picked for a custom status,
     * so it can be recorded as recently used.
     */
    recordRecentEmoji?: (unicode: string) => void;
}

export type SetStatusViewModel = ViewModel<SetStatusViewSnapshot, SetStatusViewActions>;

export type SetStatusViewProps = {
    vm: SetStatusViewModel;

    /**
     * If true, the view starts in custom status mode, ready for the user to enter a custom status.
     *
     * Ignored if the user already has a status set, as their existing status is shown instead.
     */
    initialCustomMode?: boolean;

    /**
     * How the list of statuses is shown:
     * - `"dropdown"`: a dropdown opened from the "Set status" link.
     * - `"submenu"`: a cascading submenu. Only use this when the view is inside a compound `Menu`.
     *
     * Default: `"dropdown"`
     */
    variant?: "dropdown" | "submenu";
};

function StatusOption({ value }: { value: StatusValue }): React.ReactNode {
    return (
        <>
            <span className={styles.dropdownEmoji}>{STATUSES[value].emoji}</span>
            <span>{_t(STATUSES[value].textKey)}</span>
        </>
    );
}

/**
 * The icon and label shown in the "Set status" trigger.
 */
function SetStatusPrompt(): JSX.Element {
    return (
        <>
            <ReactionIcon />
            <Text as="span" type="body" size="md" weight="medium">
                {_t("status|set_status|set_status_prompt")}
            </Text>
        </>
    );
}

export function SetStatusView({
    vm,
    initialCustomMode = false,
    variant = "dropdown",
}: SetStatusViewProps): JSX.Element {
    const { userStatus, recentEmojis, disabled } = useViewModel(vm);
    const [customMode, setCustomMode] = useState(initialCustomMode);

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
                recentEmojis={recentEmojis}
                onRecordRecentEmoji={vm.recordRecentEmoji}
            />
        );
    }

    const renderTrigger = (props: DropdownTriggerProps): JSX.Element => {
        const trigger = (
            <div className={styles.setStatusContainer}>
                <Link
                    className={classNames(styles.setStatusTrigger, { [styles.disabledTrigger]: disabled })}
                    aria-label={_t("status|set_status|set_status_prompt")}
                    aria-disabled={disabled}
                    {...props}
                >
                    <SetStatusPrompt />
                </Link>
            </div>
        );

        return trigger;
    };

    const onValueChange = (value: StatusValue): void => {
        if (value === "custom") {
            if (vm.onSetCustomStatusClick) {
                vm.onSetCustomStatusClick();
            } else {
                setCustomMode(true);
            }
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

    if (variant === "submenu") {
        if (disabled) {
            // compound's SubMenu can't be disabled, so show the trigger without a submenu.
            return (
                <div className={styles.subMenuTrigger}>
                    <Link
                        className={classNames(styles.setStatusTrigger, styles.disabledTrigger)}
                        aria-label={_t("status|set_status|set_status_prompt")}
                        aria-disabled={true}
                    >
                        <SetStatusPrompt />
                    </Link>
                </div>
            );
        }

        return (
            <SubMenu
                // The trigger looks like a link, so it opens on click rather than hover.
                openOn="click"
                trigger={
                    // A full-width row, so the submenu opens beside the edge of the enclosing menu
                    // rather than beside the link text. Radix makes this row the menu item.
                    <div className={styles.subMenuTrigger}>
                        <Link className={styles.setStatusTrigger} tabIndex={-1}>
                            <SetStatusPrompt />
                        </Link>
                    </div>
                }
            >
                {STATUS_KEYS.map((key) => (
                    <MenuItem
                        key={key}
                        Icon={
                            <span className={styles.menuItemEmoji} aria-hidden={true}>
                                {STATUSES[key].emoji}
                            </span>
                        }
                        label={_t(STATUSES[key].textKey)}
                        onSelect={() => onValueChange(key)}
                        hideChevron={true}
                    />
                ))}
            </SubMenu>
        );
    }

    return (
        <Dropdown<StatusValue>
            values={STATUS_KEYS}
            label={null}
            trigger={renderTrigger}
            onValueChange={onValueChange}
            renderItem={renderItem}
            disabled={disabled}
        />
    );
}
