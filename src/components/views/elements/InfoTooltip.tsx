/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";

export enum InfoTooltipKind {
    Info = "info",
    Warning = "warning",
}

interface TooltipProps {
    tooltip?: string;
    className?: string;
    kind?: InfoTooltipKind;
    children?: ReactNode;
    tabIndex?: number;
}

export default class InfoTooltip extends React.PureComponent<TooltipProps> {
    public render(): React.ReactNode {
        const { tooltip, children, className, kind } = this.props;
        const title = _t("info_tooltip_title");
        const iconClassName =
            kind !== InfoTooltipKind.Warning ? "mx_InfoTooltip_icon_info" : "mx_InfoTooltip_icon_warning";

        // Tooltip are forced on the right for a more natural feel to them on info icons
        return (
            <Tooltip label={tooltip || title} side="right">
                <div className={classNames("mx_InfoTooltip", className)} tabIndex={this.props.tabIndex ?? 0}>
                    <span className={classNames("mx_InfoTooltip_icon", iconClassName)} aria-label={title} />
                    {children}
                </div>
            </Tooltip>
        );
    }
}
