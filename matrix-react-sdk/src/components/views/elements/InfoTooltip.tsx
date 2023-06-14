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

import { Alignment } from "./Tooltip";
import { _t } from "../../../languageHandler";
import TooltipTarget from "./TooltipTarget";

export enum InfoTooltipKind {
    Info = "info",
    Warning = "warning",
}

interface ITooltipProps {
    tooltip?: React.ReactNode;
    className?: string;
    tooltipClassName?: string;
    kind?: InfoTooltipKind;
    children?: ReactNode;
}

export default class InfoTooltip extends React.PureComponent<ITooltipProps> {
    public constructor(props: ITooltipProps) {
        super(props);
    }

    public render(): React.ReactNode {
        const { tooltip, children, tooltipClassName, className, kind } = this.props;
        const title = _t("Information");
        const iconClassName =
            kind !== InfoTooltipKind.Warning ? "mx_InfoTooltip_icon_info" : "mx_InfoTooltip_icon_warning";

        // Tooltip are forced on the right for a more natural feel to them on info icons
        return (
            <TooltipTarget
                tooltipTargetClassName={classNames("mx_InfoTooltip", className)}
                className="mx_InfoTooltip_container"
                tooltipClassName={classNames("mx_InfoTooltip_tooltip", tooltipClassName)}
                label={tooltip || title}
                alignment={Alignment.Right}
            >
                <span className={classNames("mx_InfoTooltip_icon", iconClassName)} aria-label={title} />
                {children}
            </TooltipTarget>
        );
    }
}
