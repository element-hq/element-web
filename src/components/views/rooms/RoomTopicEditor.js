/*
Copyright 2016 OpenMarket Ltd

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
import { _t } from "../../../languageHandler";

module.exports = React.createClass({
    displayName: 'RoomTopicEditor',

    propTypes: {
        room: React.PropTypes.object.isRequired,
    },

    componentWillMount: function() {
        var room = this.props.room;
        var topic = room.currentState.getStateEvents('m.room.topic', '');
        this._initialTopic = topic ? topic.getContent().topic : '';
    },

    getTopic: function() {
        return this.refs.editor.getValue();
    },

    render: function() {
        var EditableText = sdk.getComponent("elements.EditableText");

        return (
                <EditableText ref="editor"
                     className="mx_RoomHeader_topic mx_RoomHeader_editable"
                     placeholderClassName="mx_RoomHeader_placeholder"
                     placeholder={_t("Add a topic")}
                     blurToCancel={ false }
                     initialValue={ this._initialTopic }
                     dir="auto" />
        );
    },
});
