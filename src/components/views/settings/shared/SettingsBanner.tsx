/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type PropsWithChildren, type ReactNode } from "react";

import AccessibleButton from "../../elements/AccessibleButton";

interface Props {
    icon?: ReactNode;
    action?: ReactNode;
    onAction?: () => void;
}

export function SettingsBanner({ children, icon, action, onAction }: PropsWithChildren<Props>): JSX.Element {
    return (
        <div className="mx_SettingsBanner">
            {icon}
            <div className="mx_SettingsBanner_content">{children}</div>
            {action && (
                <AccessibleButton kind="primary_outline" onClick={onAction ?? null}>
                    {action}
                </AccessibleButton>
            )}
        </div>
    );
}
