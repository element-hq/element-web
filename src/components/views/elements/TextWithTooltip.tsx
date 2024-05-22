/*
 Copyright 2019 New Vector Ltd.

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

import React, { HTMLAttributes } from "react";
import { Tooltip } from "@vector-im/compound-web";

interface IProps extends HTMLAttributes<HTMLSpanElement> {
    tooltip: string;
    tooltipProps?: {
        tabIndex?: number;
    };
}

export default class TextWithTooltip extends React.Component<IProps> {
    public constructor(props: IProps) {
        super(props);
    }

    public render(): React.ReactNode {
        const { className, children, tooltip, tooltipProps } = this.props;

        return (
            <Tooltip label={tooltip} placement="right">
                <span className={className} tabIndex={tooltipProps?.tabIndex ?? 0}>
                    {children}
                </span>
            </Tooltip>
        );
    }
}
