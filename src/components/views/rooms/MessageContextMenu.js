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
var sdk = require('matrix-react-sdk')
var Modal = require('matrix-react-sdk/lib/Modal');
var Resend = require("matrix-react-sdk/lib/Resend");

module.exports = React.createClass({
    displayName: 'MessageContextMenu',

    onResendClick: function() {
        Resend.resend(this.props.mxEvent);
        if (this.props.onFinished) this.props.onFinished();
    },

    onViewSourceClick: function() {
        var ViewSource = sdk.getComponent('structures.ViewSource');
        Modal.createDialog(ViewSource, {
            mxEvent: this.props.mxEvent
        });
        if (this.props.onFinished) this.props.onFinished();
    },

    onRedactClick: function() {
        MatrixClientPeg.get().redactEvent(
            this.props.mxEvent.getRoomId(), this.props.mxEvent.getId()
        ).done(function() {
            // message should disappear by itself
        }, function(e) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            // display error message stating you couldn't delete this.
            var code = e.errcode || e.statusCode;
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: "You cannot delete this message. (" + code + ")"
            });
        });
        if (this.props.onFinished) this.props.onFinished();
    },

    onCancelSendClick: function() {
        Resend.removeFromQueue(this.props.mxEvent);
    },

    render: function() {
        var eventStatus = this.props.mxEvent.status;
        var resendButton;
        var viewSourceButton;
        var redactButton;
        var cancelButton;

        if (eventStatus === 'not_sent') {
            resendButton = (
                <div className="mx_ContextualMenu_field" onClick={this.onResendClick}>
                    Resend
                </div>
            );
        }

        if (!eventStatus) { // sent
            redactButton = (
                <div className="mx_ContextualMenu_field" onClick={this.onRedactClick}>
                    Redact
                </div>
            );
        }

        if (eventStatus === "queued") {
            cancelButton = (
                <div className="mx_ContextualMenu_field" onClick={this.onCancelSendClick}>
                    Cancel Sending
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
                {redactButton}
                {cancelButton}
                {viewSourceButton}
            </div>
        );
    }
});
