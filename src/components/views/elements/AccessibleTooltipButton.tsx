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

import React from 'react';
import classNames from 'classnames';

import AccessibleButton from "./AccessibleButton";
import Tooltip from './Tooltip';

interface ITooltipProps extends React.ComponentProps<typeof AccessibleButton> {
    title: string;
    tooltip?: React.ReactNode;
    tooltipClassName?: string;
}

interface IState {
    hover: boolean;
}

export default class AccessibleTooltipButton extends React.PureComponent<ITooltipProps, IState> {
    constructor(props: ITooltipProps) {
        super(props);
        this.state = {
            hover: false,
        };
    }

    onMouseOver = () => {
        this.setState({
            hover: true,
        });
    };

    onMouseLeave = () => {
        this.setState({
            hover: false,
        });
    };

    render() {
        const {title, tooltip, children, tooltipClassName, ...props} = this.props;

        const tip = this.state.hover ? <Tooltip
            className="mx_AccessibleTooltipButton_container"
            tooltipClassName={classNames("mx_AccessibleTooltipButton_tooltip", tooltipClassName)}
            label={tooltip || title}
        /> : <div />;
        return (
            <AccessibleButton
                {...props}
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
                aria-label={title}
            >
                { children }
                { tip }
            </AccessibleButton>
        );
    }
}
