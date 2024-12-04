/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX } from "react";
import CheckCircleIcon from "@vector-im/compound-design-tokens/assets/web/icons/check-circle-solid";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import classNames from "classnames";

interface SettingsSubheaderProps {
    /**
     * The subheader text.
     */
    label?: string;
    /**
     * The state of the subheader.
     */
    state: "success" | "error";
    /**
     * The message to display next to the state icon.
     */
    stateMessage: string;
}

/**
 * A styled subheader for settings.
 */
export function SettingsSubheader({ label, state, stateMessage }: SettingsSubheaderProps): JSX.Element {
    return (
        <div className="mx_SettingsSubheader">
            {label}
            <span
                className={classNames({
                    mx_SettingsSubheader_success: state === "success",
                    mx_SettingsSubheader_error: state === "error",
                })}
            >
                {state === "success" ? (
                    <CheckCircleIcon width="20" height="20" />
                ) : (
                    <ErrorIcon width="20" height="20" />
                )}
                {stateMessage}
            </span>
        </div>
    );
}
