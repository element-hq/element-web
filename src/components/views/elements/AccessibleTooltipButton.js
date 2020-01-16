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
import PropTypes from 'prop-types';

import AccessibleButton from "./AccessibleButton";
import * as sdk from "../../../index";

export default class AccessibleTooltipButton extends React.PureComponent {
    static propTypes = {
        ...AccessibleButton.propTypes,
        // The tooltip to render on hover
        title: PropTypes.string.isRequired,
    };

    state = {
        hover: false,
    };

    onMouseOver = () => {
        this.setState({
            hover: true,
        });
    };

    onMouseOut = () => {
        this.setState({
            hover: false,
        });
    };

    render() {
        const Tooltip = sdk.getComponent("elements.Tooltip");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        const {title, children, ...props} = this.props;

        const tip = this.state.hover ? <Tooltip
            className="mx_AccessibleTooltipButton_container"
            tooltipClassName="mx_AccessibleTooltipButton_tooltip"
            label={title}
        /> : <div />;
        return (
            <AccessibleButton {...props} onMouseOver={this.onMouseOver} onMouseOut={this.onMouseOut} aria-label={title}>
                { children }
                { tip }
            </AccessibleButton>
        );
    }
}
