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

var classNames = require("classnames");

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");
var ComponentBroker = require('../../../../src/ComponentBroker');

var MessageTimestamp = ComponentBroker.get('atoms/MessageTimestamp');
var SenderProfile = ComponentBroker.get('molecules/SenderProfile');
var MemberAvatar = ComponentBroker.get('atoms/MemberAvatar');

var UnknownMessageTile = ComponentBroker.get('molecules/UnknownMessageTile');

var tileTypes = {
    'm.text': ComponentBroker.get('molecules/MTextTile'),
    'm.notice': ComponentBroker.get('molecules/MNoticeTile'),
    'm.emote': ComponentBroker.get('molecules/MEmoteTile'),
    'm.image': ComponentBroker.get('molecules/MImageTile'),
    'm.file': ComponentBroker.get('molecules/MFileTile')
};

var MessageTileController = require('matrix-react-sdk/lib/controllers/molecules/MessageTile')

module.exports = React.createClass({
    displayName: 'MessageTile',
    mixins: [MessageTileController],

    render: function() {
        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;
        var TileType = UnknownMessageTile;
        if (msgtype && tileTypes[msgtype]) {
            TileType = tileTypes[msgtype];
        }
        var classes = classNames({
            mx_MessageTile: true,
            mx_MessageTile_sending: ['sending', 'queued'].indexOf(
                this.props.mxEvent.status
            ) !== -1,
            mx_MessageTile_notSent: this.props.mxEvent.status == 'not_sent',
            mx_MessageTile_highlight: this.shouldHighlight(),
            mx_MessageTile_continuation: this.props.continuation,
            mx_MessageTile_last: this.props.last,
        });
        var timestamp = <MessageTimestamp ts={this.props.mxEvent.getTs()} />

        var aux = null;
        if (msgtype === 'm.image') aux = "sent an image";
        else if (msgtype === 'm.video') aux = "sent a video";
        else if (msgtype === 'm.file') aux = "uploaded a file";

        var avatar, sender, resend;
        if (!this.props.continuation) {
            if (this.props.mxEvent.sender) {
                avatar = (
                    <div className="mx_MessageTile_avatar">
                        <MemberAvatar member={this.props.mxEvent.sender} />
                    </div>
                );
            }
            sender = <SenderProfile mxEvent={this.props.mxEvent} aux={aux} />;
        }
        if (this.props.mxEvent.status === "not_sent" && !this.state.resending) {
            resend = <button className="mx_MessageTile_msgOption" onClick={this.onResend}>
                Resend
            </button>;
        }
        return (
            <div className={classes}>
                { avatar }
                { timestamp }
                { resend }
                { sender }
                <TileType mxEvent={this.props.mxEvent} />
            </div>
        );
    },
});
