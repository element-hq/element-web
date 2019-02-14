/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd

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
import dis from '../../../dispatcher';

export default class HeaderButtons extends React.Component {
    constructor(props, initialPhase) {
        super(props);

        this.state = {
            phase: props.collapsedRhs ? null : initialPhase,
            isUserPrivilegedInGroup: null,
        };
        this.onAction = this.onAction.bind(this);
    }

    componentWillMount() {
        this.dispatcherRef = dis.register(this.onAction);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    setPhase(phase, extras) {
        // TODO: delay?
        dis.dispatch(Object.assign({
            action: 'view_right_panel_phase',
            phase: phase,
        }, extras));
    }

    isPhase(phases) {
        if (this.props.collapsedRhs) {
            return false;
        }
        if (Array.isArray(phases)) {
            return phases.includes(this.state.phase);
        } else {
            return phases === this.state.phase;
        }
    }

    onAction(payload) {
        if (payload.action === "view_right_panel_phase") {
            // only actions coming from header buttons should collapse the right panel
            if (this.state.phase === payload.phase && payload.fromHeader) {
                dis.dispatch({
                    action: 'hide_right_panel',
                });
                this.setState({
                    phase: null,
                });
            } else {
                if (this.props.collapsedRhs && payload.fromHeader) {
                    dis.dispatch({
                        action: 'show_right_panel',
                    });
                    // emit payload again as the RightPanel didn't exist up
                    // till show_right_panel, just without the fromHeader flag
                    // as that would hide the right panel again
                    dis.dispatch(Object.assign({}, payload, {fromHeader: false}));
                }
                this.setState({
                    phase: payload.phase,
                });
            }
        }
    }

    render() {
        // inline style as this will be swapped around in future commits
        return <div className="mx_HeaderButtons">
            { this.renderButtons() }
        </div>;
    }
}

HeaderButtons.propTypes = {
    collapsedRhs: PropTypes.bool,
};
