/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { _t } from "../../../../../core/i18n/i18n";
import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { E2ePadlock, E2ePadlockIcon } from "../E2ePadlock";

export interface E2eMessageSharedIconViewSnapshot {
    /**
     * Display name for the user who shared keys for the message.
     */
    displayName: string;
    /**
     * User ID for the user who shared keys for the message.
     */
    userId: string;
}

export type E2eMessageSharedIconViewModel = ViewModel<E2eMessageSharedIconViewSnapshot>;

interface E2eMessageSharedIconViewProps {
    /**
     * ViewModel providing the localized tooltip.
     */
    vm: E2eMessageSharedIconViewModel;
    /**
     * Optional CSS class name applied to the icon container.
     */
    className?: string;
}

/**
 * Renders the end-to-end encryption icon used for messages whose keys were
 * shared by another room member.
 */
export function E2eMessageSharedIconView({ vm, className }: Readonly<E2eMessageSharedIconViewProps>): JSX.Element {
    const { displayName, userId } = useViewModel(vm);
    // We always disambiguate the user, since we need to prevent users from forging a disambiguation, and
    // the ToolTip component doesn't support putting styling inside a label.
    const tooltip = _t("timeline|message_shared_by", { displayName, userId });

    return <E2ePadlock className={className} icon={E2ePadlockIcon.Normal} title={tooltip} />;
}
