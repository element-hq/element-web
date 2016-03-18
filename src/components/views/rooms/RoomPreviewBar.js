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
var sdk = require('../../../index');
var MatrixClientPeg = require('../../../MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'RoomPreviewBar',

    propTypes: {
        onJoinClick: React.PropTypes.func,
        onRejectClick: React.PropTypes.func,

        // if inviterName is specified, the preview bar will shown an invite to the room.
        // You should also specify onRejectClick if specifiying inviterName
        inviterName: React.PropTypes.string,

        // If invited by 3rd party invite, the email address the invite was sent to
        invitedEmail: React.PropTypes.string,
        canJoin: React.PropTypes.bool,
        canPreview: React.PropTypes.bool,
        spinner: React.PropTypes.bool,
        room: React.PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            onJoinClick: function() {},
            canJoin: false,
            canPreview: true,
        };
    },

    getInitialState: function() {
        return {
            busy: false
        }
    },

    componentWillMount: function() {
        // If this is an invite and we've been told what email
        // address was invited, fetch the user's list of 3pids
        // so we can check them against the one that was invited
        if (this.props.inviterName && this.props.invitedEmail) {
            this.setState({busy: true});
            MatrixClientPeg.get().lookupThreePid(
                'email', this.props.invitedEmail
            ).finally(() => {
                this.setState({busy: false});
            }).done((result) => {
                this.setState({invitedEmailMxid: result.mxid});
            }, (err) => {
                this.setState({threePidFetchError: err});
            });
        }
    },

    render: function() {
        var joinBlock, previewBlock;

        if (this.props.spinner || this.state.busy) {
            var Spinner = sdk.getComponent("elements.Spinner");
            return (<div className="mx_RoomPreviewBar">
                <Spinner />
            </div>);
        }

        if (this.props.inviterName) {
            var emailMatchBlock;
            if (this.props.invitedEmail) {
                if (this.state.threePidFetchError) {
                    emailMatchBlock = <div className="error">
                        Vector was unable to ascertain that the address this invite was
                        sent to matches one associated with your account.
                    </div>
                } else if (this.state.invitedEmailMxid != MatrixClientPeg.get().credentials.userId) {
                    emailMatchBlock = <div className="warning">
                        <img src="img/warning.svg" width="24" height="23" title= "/!\\" alt="/!\\" />
                        This invitation was sent to <span className="email">{this.props.invitedEmail}</span>
                        which is not publicly associated with your account.
                    </div>
                }
            }
            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_invite_text">
                        You have been invited to join this room by { this.props.inviterName }
                    </div>
                    <div className="mx_RoomPreviewBar_join_text">
                        Would you like to <a onClick={ this.props.onJoinClick }>accept</a> or <a onClick={ this.props.onRejectClick }>decline</a> this invitation?
                    </div>
                    {emailMatchBlock}
                </div>
            );

        }
        else if (this.props.canJoin) {
            var name = this.props.room ? this.props.room.name : "";
            name = name ? <b>{ name }</b> : "a room";
            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_join_text">
                        You are trying to access { name }.<br/>
                        Would you like to <a onClick={ this.props.onJoinClick }>join</a> in order to participate in the discussion?
                    </div>
                </div>
            );
        }

        if (this.props.canPreview) {
            previewBlock = (
                <div className="mx_RoomPreviewBar_preview_text">
                    This is a preview of this room. Room interactions have been disabled.
                </div>
            );
        }

        return (
            <div className="mx_RoomPreviewBar">
                <div className="mx_RoomPreviewBar_wrapper">
                    { joinBlock }
                    { previewBlock }
                </div>
            </div>
        );
    }
});
