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

import React from 'react';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import Tooltip from "./Tooltip";

interface IProps {
    class?: string;
    tooltipClass?: string;
    tooltip: React.ReactNode;
    tooltipProps?: {};
    onClick?: (ev?: React.MouseEvent) => void;
}

interface IState {
    hover: boolean;
}

@replaceableComponent("views.elements.TextWithTooltip")
export default class TextWithTooltip extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            hover: false,
        };
    }

    private onMouseOver = (): void => {
        this.setState({ hover: true });
    };

    private onMouseLeave = (): void => {
        this.setState({ hover: false });
    };

    public render(): JSX.Element {
        const { class: className, children, tooltip, tooltipClass, tooltipProps, ...props } = this.props;

        return (
            <span {...props} onMouseOver={this.onMouseOver} onMouseLeave={this.onMouseLeave} onClick={this.props.onClick} className={className}>
                { children }
                { this.state.hover && <Tooltip
                    {...tooltipProps}
                    label={tooltip}
                    tooltipClassName={tooltipClass}
                    className="mx_TextWithTooltip_tooltip"
                /> }
            </span>
        );
    }
}
