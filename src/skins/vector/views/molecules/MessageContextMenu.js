/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

var React = require('react');

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var dis = require('matrix-react-sdk/lib/dispatcher');

module.exports = React.createClass({
    displayName: 'MessageContextMenu',

    onResendClick: function() {
        MatrixClientPeg.get().resendEvent(
            this.props.mxEvent, MatrixClientPeg.get().getRoom(
                this.props.mxEvent.getRoomId()
            )
        ).done(function() {
            dis.dispatch({
                action: 'message_sent'
            });
        }, function() {
            dis.dispatch({
                action: 'message_send_failed'
            });
        });
        dis.dispatch({action: 'message_resend_started'});
        if (this.props.onFinished) this.props.onFinished();
    },

    onViewSourceClick: function() {
    },

    render: function() {
        var resendButton;
        var viewSourceButton;

        if (this.props.mxEvent.status == 'not_sent') {
            resendButton = (
                <div className="mx_ContextualMenu_field" onClick={this.onResendClick}>
                    Resend
                </div>
            );
        }
        viewSourceButton = (
            <div className="mx_ContextualMenu_field" onClick={this.onViewSourceClick}>
                View Source
            </div>
        );

        return (
            <div>
                {resendButton}
                {viewSourceButton}
            </div>
        );
    }
});
