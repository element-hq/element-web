/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Heading } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";

/**
 * The heading for a settings section.
 */
interface SettingsHeaderProps {
    /**
     * Whether the user has a recommended tag.
     */
    hasRecommendedTag?: boolean;
    /**
     * The label for the header.
     */
    label: string;
}

export function SettingsHeader({ hasRecommendedTag = false, label }: SettingsHeaderProps): JSX.Element {
    return (
        <Heading className="mx_SettingsHeader" as="h2" size="sm" weight="semibold">
            {label} {hasRecommendedTag && <span>{_t("common|recommended")}</span>}
        </Heading>
    );
}
