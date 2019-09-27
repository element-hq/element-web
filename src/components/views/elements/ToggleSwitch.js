/*
Copyright 2019 New Vector Ltd

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
import classNames from "classnames";
import {KeyCode} from "../../../Keyboard";

export default class ToggleSwitch extends React.Component {
    static propTypes = {
        // Whether or not this toggle is in the 'on' position. Default false (off).
        checked: PropTypes.bool,

        // Whether or not the user can interact with the switch
        disabled: PropTypes.bool,

        // Called when the checked state changes. First argument will be the new state.
        onChange: PropTypes.func,
    };

    constructor(props) {
        super(props);

        this.state = {
            checked: props.checked || false, // default false
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.checked !== this.state.checked) {
            this.setState({checked: nextProps.checked});
        }
    }

    _toggle = () => {
        if (this.props.disabled) return;

        const newState = !this.state.checked;
        this.setState({checked: newState});
        if (this.props.onChange) {
            this.props.onChange(newState);
        }
    };

    _onClick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this._toggle();
    };

    _onKeyDown = (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (e.keyCode === KeyCode.ENTER || e.keyCode === KeyCode.SPACE) {
            this._toggle();
        }
    };

    render() {
        // eslint-disable-next-line no-unused-vars
        const {checked, disabled, onChange, ...props} = this.props;

        const classes = classNames({
            "mx_ToggleSwitch": true,
            "mx_ToggleSwitch_on": this.state.checked,
            "mx_ToggleSwitch_enabled": !this.props.disabled,
        });
        return (
            <div
                {...props}
                className={classes}
                onClick={this._onClick}
                onKeyDown={this._onKeyDown}
                role="checkbox"
                aria-checked={this.state.checked}
                aria-disabled={disabled}
                tabIndex={0}
            >
                <div className="mx_ToggleSwitch_ball" />
            </div>
        );
    }
}
