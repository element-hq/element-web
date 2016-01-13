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
var dis = require("../../../dispatcher");
var MatrixClientPeg = require('../../../MatrixClientPeg');

var linkify = require('linkifyjs');
var linkifyElement = require('linkifyjs/element');
var linkifyMatrix = require('../../../linkify-matrix');

linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'RoomHeader',

    propTypes: {
        room: React.PropTypes.object,
        editing: React.PropTypes.bool,
        onSettingsClick: React.PropTypes.func,
        onSaveClick: React.PropTypes.func,
        onSearchClick: React.PropTypes.func,
        onLeaveClick: React.PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            editing: false,
            onSettingsClick: function() {},
            onSaveClick: function() {},
        };
    },

    componentWillReceiveProps: function(newProps) {
        if (newProps.editing) {
            var topic = this.props.room.currentState.getStateEvents('m.room.topic', '');
            var name = this.props.room.currentState.getStateEvents('m.room.name', '');

            this.setState({
                name: name ? name.getContent().name : '',
                defaultName: this.props.room.getDefaultRoomName(MatrixClientPeg.get().credentials.userId),
                topic: topic ? topic.getContent().topic : '',
            });
        }
    },

    componentDidUpdate: function() {
        if (this.refs.topic) {
            linkifyElement(this.refs.topic, linkifyMatrix.options);
        }
    },

    onVideoClick: function(e) {
        dis.dispatch({
            action: 'place_call',
            type: e.shiftKey ? "screensharing" : "video",
            room_id: this.props.room.roomId
        });
    },

    onVoiceClick: function() {
        dis.dispatch({
            action: 'place_call',
            type: "voice",
            room_id: this.props.room.roomId
        });
    },

    onNameChanged: function(value) {
        this.setState({ name : value });
    },

    onTopicChanged: function(value) {
        this.setState({ topic : value });
    },

    getRoomName: function() {
        return this.state.name;
    },

    getTopic: function() {
        return this.state.topic;
    },

    render: function() {
        var EditableText = sdk.getComponent("elements.EditableText");
        var RoomAvatar = sdk.getComponent('avatars.RoomAvatar');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        var header;
        if (this.props.simpleHeader) {
            var cancel;
            if (this.props.onCancelClick) {
                cancel = <img className="mx_RoomHeader_simpleHeaderCancel" src="img/cancel.svg" onClick={ this.props.onCancelClick } alt="Close" width="18" height="18"/>
            }
            header =
                <div className="mx_RoomHeader_wrapper">
                    <div className="mx_RoomHeader_simpleHeader">
                        { this.props.simpleHeader }
                        { cancel }
                    </div>
                </div>
        }
        else {
            var name = null;
            var searchStatus = null;
            var topic_el = null;
            var cancel_button = null;
            var save_button = null;
            var settings_button = null;
            // var actual_name = this.props.room.currentState.getStateEvents('m.room.name', '');
            // if (actual_name) actual_name = actual_name.getContent().name;
            if (this.props.editing) {
                // name = 
                //     <div className="mx_RoomHeader_nameEditing">
                //         <input className="mx_RoomHeader_nameInput" type="text" defaultValue={actual_name} placeholder="Name" ref="name_edit"/>
                //     </div>
                // if (topic) topic_el = <div className="mx_RoomHeader_topic"><textarea>{ topic.getContent().topic }</textarea></div>

                var placeholderName = "Unnamed Room";
                if (this.state.defaultName && this.state.defaultName !== '?') {
                    placeholderName += " (" + this.state.defaultName + ")";
                }

                name =
                    <div className="mx_RoomHeader_name">
                        <EditableText
                             className="mx_RoomHeader_nametext mx_RoomHeader_editable"
                             placeholderClassName="mx_RoomHeader_placeholder"
                             placeholder={ placeholderName }
                             blurToCancel={ false }
                             onValueChanged={ this.onNameChanged }
                             initialValue={ this.state.name }/>
                    </div>

                topic_el =
                    <EditableText 
                         className="mx_RoomHeader_topic mx_RoomHeader_editable"
                         placeholderClassName="mx_RoomHeader_placeholder"
                         placeholder="Add a topic"
                         blurToCancel={ false }
                         onValueChanged={ this.onTopicChanged }
                         initialValue={ this.state.topic }/>

                save_button = <div className="mx_RoomHeader_textButton" onClick={this.props.onSaveClick}>Save</div>
                cancel_button = <div className="mx_RoomHeader_cancelButton" onClick={this.props.onCancelClick}><img src="img/cancel.svg" width="18" height="18" alt="Cancel"/> </div>
            } else {
                // <EditableText label={this.props.room.name} initialValue={actual_name} placeHolder="Name" onValueChanged={this.onNameChange} />
                var searchStatus;
                // don't display the search count until the search completes and
                // gives us a valid (possibly zero) searchCount.
                if (this.props.searchInfo && this.props.searchInfo.searchCount !== undefined && this.props.searchInfo.searchCount !== null) {
                    searchStatus = <div className="mx_RoomHeader_searchStatus">&nbsp;(~{ this.props.searchInfo.searchCount } results)</div>;
                }

                name =
                    <div className="mx_RoomHeader_name" onClick={this.props.onSettingsClick}>
                        <div className="mx_RoomHeader_nametext" title={ this.props.room.name }>{ this.props.room.name }</div>
                        { searchStatus }
                        <div className="mx_RoomHeader_settingsButton" title="Settings">
                            <TintableSvg src="img/settings.svg" width="12" height="12"/>
                        </div>
                    </div>

                var topic = this.props.room.currentState.getStateEvents('m.room.topic', '');
                if (topic) topic_el = <div className="mx_RoomHeader_topic" ref="topic" title={ topic.getContent().topic }>{ topic.getContent().topic }</div>;
            }

            var roomAvatar = null;
            if (this.props.room) {
                roomAvatar = (
                    <RoomAvatar room={this.props.room} width="48" height="48" />
                );
            }

            var leave_button;
            if (this.props.onLeaveClick) {
                leave_button =
                    <div className="mx_RoomHeader_button mx_RoomHeader_leaveButton" onClick={this.props.onLeaveClick} title="Leave room">
                        <TintableSvg src="img/leave.svg" width="26" height="20"/>
                    </div>;
            }

            var forget_button;
            if (this.props.onForgetClick) {
                forget_button =
                    <div className="mx_RoomHeader_button mx_RoomHeader_leaveButton" onClick={this.props.onForgetClick} title="Forget room">
                        <TintableSvg src="img/leave.svg" width="26" height="20"/>
                    </div>;
            }

            var right_row;
            if (!this.props.editing) {
                right_row = 
                    <div className="mx_RoomHeader_rightRow">
                        { forget_button }
                        { leave_button }
                        <div className="mx_RoomHeader_button" onClick={this.props.onSearchClick} title="Search">
                            <TintableSvg src="img/search.svg" width="21" height="19"/>
                        </div>
                    </div>;
            }

            header =
                <div className="mx_RoomHeader_wrapper">
                    <div className="mx_RoomHeader_leftRow">
                        <div className="mx_RoomHeader_avatar">
                            { roomAvatar }
                        </div>
                        <div className="mx_RoomHeader_info">
                            { name }
                            { topic_el }
                        </div>
                    </div>
                    {save_button}
                    {cancel_button}
                    {right_row}
                </div>
        }

        return (
            <div className="mx_RoomHeader">
                { header }
            </div>
        );
    },
});
