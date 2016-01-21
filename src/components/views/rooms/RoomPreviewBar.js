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

module.exports = React.createClass({
    displayName: 'RoomPreviewBar',

    propTypes: {
        onJoinClick: React.PropTypes.func,
        onRejectClick: React.PropTypes.func,
        inviterName: React.PropTypes.string,
        canJoin: React.PropTypes.bool,
        canPreview: React.PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            onJoinClick: function() {},
            canJoin: false,
            canPreview: true,
        };
    },

    render: function() {
        var joinBlock, previewBlock;

        if (this.props.inviterName) {
            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_invite_text">
                        You have been invited to join this room by { this.props.inviterName }
                    </div>
                    <div className="mx_RoomPreviewBar_join_text">
                        Would you like to <a onClick={ this.props.onJoinClick }>accept</a> or <a onClick={ this.props.onRejectClick }>decline</a> this invitation?
                    </div>
                </div>
            );

        }
        else if (this.props.canJoin) {
            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_join_text">
                        Would you like to <a onClick={ this.props.onJoinClick }>join</a> this room?
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
