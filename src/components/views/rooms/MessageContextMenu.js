/*
Copyright 2015, 2016 OpenMarket Ltd

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

    propTypes: {
        /* the MatrixEvent associated with the context menu */
        mxEvent: React.PropTypes.object.isRequired,

        /* an optional EventTileOps implementation that can be used to unhide preview widgets */
        eventTileOps: React.PropTypes.object,

        /* callback called when the menu is dismissed */
        onFinished: React.PropTypes.func,
    },

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
        if (this.props.onFinished) this.props.onFinished();
    },

    onPermalinkClick: function() {
        if (this.props.onFinished) this.props.onFinished();
    },

    onUnhidePreviewClick: function() {
        if (this.props.eventTileOps) {
            this.props.eventTileOps.unhideWidget();
        }
        if (this.props.onFinished) this.props.onFinished();
    },

    render: function() {
        var eventStatus = this.props.mxEvent.status;
        var resendButton;
        var viewSourceButton;
        var redactButton;
        var cancelButton;
        var permalinkButton;
        var unhidePreviewButton;

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

        if (eventStatus === "queued" || eventStatus === "not_sent") {
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

        if (this.props.eventTileOps) {
            if (this.props.eventTileOps.isWidgetHidden()) {
                unhidePreviewButton = (
                    <div className="mx_ContextualMenu_field" onClick={this.onUnhidePreviewClick}>
                        Unhide Preview
                    </div>
                )
            }
        }

        // XXX: this should be https://matrix.to.
        // XXX: if we use room ID, we should also include a server where the event can be found (other than in the domain of the event ID)
        permalinkButton = (
            <div className="mx_ContextualMenu_field">
                <a href={ "#/room/" + this.props.mxEvent.getRoomId() +"/"+ this.props.mxEvent.getId() }
                   onClick={ this.onPermalinkClick }>Permalink</a>
            </div>
        );

        return (
            <div>
                {resendButton}
                {redactButton}
                {cancelButton}
                {viewSourceButton}
                {unhidePreviewButton}
                {permalinkButton}
            </div>
        );
    }
});
