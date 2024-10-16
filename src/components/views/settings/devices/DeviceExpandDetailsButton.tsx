/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { ComponentProps } from "react";

import { Icon as CaretIcon } from "../../../../../res/img/feather-customised/dropdown-arrow.svg";
import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";

type Props<T extends keyof JSX.IntrinsicElements> = Omit<
    ComponentProps<typeof AccessibleButton<T>>,
    "aria-label" | "title" | "kind" | "className" | "onClick" | "element"
> & {
    isExpanded: boolean;
    onClick: () => void;
};

export const DeviceExpandDetailsButton = <T extends keyof JSX.IntrinsicElements>({
    isExpanded,
    onClick,
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
            onClick={onClick}
        >
            <CaretIcon className="mx_DeviceExpandDetailsButton_icon" />
        </AccessibleButton>
    );
};
