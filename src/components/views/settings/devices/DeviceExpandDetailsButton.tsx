/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
