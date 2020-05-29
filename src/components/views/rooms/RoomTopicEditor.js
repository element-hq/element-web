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

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import * as sdk from '../../../index';
import { _t } from "../../../languageHandler";

export default createReactClass({
    displayName: 'RoomTopicEditor',

    propTypes: {
        room: PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            topic: null,
        };
    },

    componentDidMount: function() {
        const room = this.props.room;
        const topic = room.currentState.getStateEvents('m.room.topic', '');
        this.setState({
            topic: topic ? topic.getContent().topic : '',
        });
    },

    getTopic: function() {
        return this.state.topic;
    },

    _onValueChanged: function(value) {
        this.setState({
            topic: value,
        });
    },

    render: function() {
        const EditableText = sdk.getComponent("elements.EditableText");

        return (
                <EditableText
                     className="mx_RoomHeader_topic mx_RoomHeader_editable"
                     placeholderClassName="mx_RoomHeader_placeholder"
                     placeholder={_t("Add a topic")}
                     blurToCancel={false}
                     initialValue={this.state.topic}
                     onValueChanged={this._onValueChanged}
                     dir="auto" />
        );
    },
});
