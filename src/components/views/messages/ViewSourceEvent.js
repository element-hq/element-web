/*
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
import classNames from 'classnames';

export default class ViewSourceEvent extends React.PureComponent {
    static propTypes = {
        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            expanded: false,
        };
    }

    componentDidMount() {
        const {mxEvent} = this.props;
        if (mxEvent.isBeingDecrypted()) {
            mxEvent.once("Event.decrypted", () => this.forceUpdate());
        }
    }

    onToggle = (ev) => {
        ev.preventDefault();
        const { expanded } = this.state;
        this.setState({
            expanded: !expanded,
        });
    }

    render() {
        const { mxEvent } = this.props;
        const { expanded } = this.state;

        let content;
        if (expanded) {
            content = <pre>{JSON.stringify(mxEvent, null, 4)}</pre>;
        } else {
            content = <code>{`{ "type": ${mxEvent.getType()} }`}</code>;
        }

        const classes = classNames("mx_ViewSourceEvent mx_EventTile_content", {
            mx_ViewSourceEvent_expanded: expanded,
        });

        return <span className={classes}>
            {content}
            <a
                className="mx_ViewSourceEvent_toggle"
                href="#"
                onClick={this.onToggle}
            />
        </span>;
    }
}
