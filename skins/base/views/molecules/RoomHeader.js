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

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");
var RoomHeaderController = require("../../../../src/controllers/molecules/RoomHeader");

module.exports = React.createClass({
    displayName: 'RoomHeader',
    mixins: [RoomHeaderController],

    render: function() {

        var topic = this.props.room.currentState.getStateEvents('m.room.topic', '');
        topic = topic ? <div className="mx_RoomHeader_topic">{ topic.getContent().topic }</div> : null;

        var callButtons;
        if (this.state) {
            switch (this.state.callState) {
                case "INBOUND":
                    callButtons = (
                        <div>
                        <div className="mx_RoomHeader_button" onClick={this.onAnswerClick}>
                        YUP
                        </div>
                        <div className="mx_RoomHeader_button" onClick={this.onHangupClick}>
                        NOPE
                        </div>
                        </div>
                    );
                    break;
                case "OUTBOUND":
                    callButtons = (
                        <div className="mx_RoomHeader_button" onClick={this.onHangupClick}>
                        BYEBYE
                        </div>
                    );
                    break;
                case "IN_CALL":
                    callButtons = (
                        <div className="mx_RoomHeader_button" onClick={this.onHangupClick}>
                        BYEBYE
                        </div>
                    );
                    break;
            }
        }

        return (
            <div className="mx_RoomHeader">
                <div className="mx_RoomHeader_wrapper">
                    <div className="mx_RoomHeader_leftRow">
                        <div className="mx_RoomHeader_avatar">
                            <img src={ MatrixClientPeg.get().getAvatarUrlForRoom(this.props.room, 48, 48, "crop") } width="48" height="48"/>
                        </div>
                        <div className="mx_RoomHeader_info">
                            <div className="mx_RoomHeader_name">{ this.props.room.name }</div>
                            { topic }
                        </div>
                    </div>
                    <div className="mx_RoomHeader_rightRow">
                        <div className="mx_RoomHeader_button">
                            <img src="img/settings.png" width="32" height="32"/>
                        </div>
                        <div className="mx_RoomHeader_button">
                            <img src="img/search.png" width="32" height="32"/>
                        </div>
                        {callButtons}
                        <div className="mx_RoomHeader_button" onClick={this.onVideoClick}>
                            <img src="img/video.png" width="32" height="32"/>
                        </div>
                        <div className="mx_RoomHeader_button" onClick={this.onVoiceClick}>
                            <img src="img/voip.png" width="32" height="32"/>
                        </div>
                    </div>
                </div>
            </div>
        );
    },
});

