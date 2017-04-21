/*
 Copyright 2017 Vector Creations Ltd
 Copyright 2017 Michael Telatynski

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
import MatrixClientPeg from '../../../MatrixClientPeg';
import dis from '../../../dispatcher';
import KeyCode from "../../../KeyCode";


module.exports = React.createClass({
    displayName: 'ForwardMessage',

    propTypes: {
        content: React.PropTypes.object.isRequired,

        // true if RightPanel is collapsed
        collapsedRhs: React.PropTypes.bool,
        onCancelClick: React.PropTypes.func.isRequired,
    },

    componentWillMount: function() {
        this._unmounted = false;

        if (!this.props.collapsedRhs) {
            dis.dispatch({
                action: 'hide_right_panel',
            });
        }

        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 1.0,
            middleOpacity: 0.3,
        });
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        document.addEventListener('keydown', this._onKeyDown);
    },

    componentWillUnmount: function() {
        this._unmounted = true;
        dis.dispatch({
            action: 'show_right_panel',
        });
        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 1.0,
            middleOpacity: 1.0,
        });
        dis.unregister(this.dispatcherRef);
        document.removeEventListener('keydown', this._onKeyDown);
    },

    onAction: function(payload) {
        if (payload.action === 'view_room') {
            MatrixClientPeg.get().sendMessage(payload.room_id, this.props.content);
        }
    },

    _onKeyDown: function(ev) {
        switch (ev.keyCode) {
            case KeyCode.ESCAPE:
                this.props.onCancelClick();
                dis.dispatch({action: 'focus_composer'});
                break;
        }
    },

    render: function() {
        return (
            <div className="mx_ForwardMessage">

                <h1>Select a room to send the message to</h1>
                <h2>Use the left sidebar Room List to select forwarding target</h2>

            </div>
        );
    },
});
