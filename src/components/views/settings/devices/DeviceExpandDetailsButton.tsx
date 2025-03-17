/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React from "react";
import { ChevronDownIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import AccessibleButton, { type ButtonProps } from "../../elements/AccessibleButton";

type Props<T extends keyof HTMLElementTagNameMap> = Omit<
    ButtonProps<T>,
    "aria-label" | "title" | "kind" | "className" | "element"
> & {
    isExpanded: boolean;
};

export const DeviceExpandDetailsButton = <T extends keyof HTMLElementTagNameMap>({
    isExpanded,
    ...rest
}: Props<T>): JSX.Element => {
    const label = isExpanded ? _t("settings|sessions|hide_details") : _t("settings|sessions|show_details");
    return (
        <AccessibleButton
            {...rest}
            aria-label={label}
            title={label}
            kind="icon"
            className={classNames("mx_DeviceExpandDetailsButton", {
                mx_DeviceExpandDetailsButton_expanded: isExpanded,
            })}
        >
            <ChevronDownIcon className="mx_DeviceExpandDetailsButton_icon" />
        </AccessibleButton>
    );
};
