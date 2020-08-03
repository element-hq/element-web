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
import PropTypes from 'prop-types';
import * as sdk from '../../../index';

export default class TextWithTooltip extends React.Component {
    static propTypes = {
        class: PropTypes.string,
        tooltipClass: PropTypes.string,
        tooltip: PropTypes.node.isRequired,
    };

    constructor() {
        super();

        this.state = {
            hover: false,
        };
    }

    onMouseOver = () => {
        this.setState({hover: true});
    };

    onMouseLeave = () => {
        this.setState({hover: false});
    };

    render() {
        const Tooltip = sdk.getComponent("elements.Tooltip");

        return (
            <span onMouseOver={this.onMouseOver} onMouseLeave={this.onMouseLeave} className={this.props.class}>
                {this.props.children}
                {this.state.hover && <Tooltip
                    label={this.props.tooltip}
                    tooltipClassName={this.props.tooltipClass}
                    className={"mx_TextWithTooltip_tooltip"} /> }
            </span>
        );
    }
}
