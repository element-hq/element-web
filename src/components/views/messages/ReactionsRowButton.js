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
import classNames from 'classnames';

export default class ReactionsRowButton extends React.PureComponent {
    static propTypes = {
        content: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
    }

    constructor(props) {
        super(props);

        // TODO: This should be derived from actual reactions you may have sent
        // once we have some API to read them.
        this.state = {
            selected: false,
        };
    }

    onClick = (ev) => {
        const state = this.state.selected;
        this.setState({
            selected: !state,
        });
        // TODO: Send the reaction event
    };

    render() {
        const { content, count } = this.props;
        const { selected } = this.state;

        const classes = classNames({
            mx_ReactionsRowButton: true,
            mx_ReactionsRowButton_selected: selected,
        });

        let adjustedCount = count;
        if (selected) {
            adjustedCount++;
        }

        return <span className={classes}
            onClick={this.onClick}
        >
            {content} {adjustedCount}
        </span>;
    }
}
