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
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import * as sdk from "../../../index";
import { _t } from '../../../languageHandler';

export default createReactClass({
    displayName: 'RoomNameEditor',

    propTypes: {
        room: PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            name: null,
        };
    },

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount: function() {
        const room = this.props.room;
        const name = room.currentState.getStateEvents('m.room.name', '');
        const myId = MatrixClientPeg.get().credentials.userId;
        const defaultName = room.getDefaultRoomName(myId);

        this.setState({
            name: name ? name.getContent().name : '',
        });

        this._placeholderName = _t("Unnamed Room");
        if (defaultName && defaultName !== 'Empty room') { // default name from JS SDK, needs no translation as we don't ever show it.
            this._placeholderName += " (" + defaultName + ")";
        }
    },

    getRoomName: function() {
        return this.state.name;
    },

    _onValueChanged: function(value, shouldSubmit) {
        this.setState({
            name: value,
        });
    },

    render: function() {
        const EditableText = sdk.getComponent("elements.EditableText");

        return (
                <div className="mx_RoomHeader_name">
                    <EditableText
                        className="mx_RoomHeader_nametext mx_RoomHeader_editable"
                        placeholderClassName="mx_RoomHeader_placeholder"
                        placeholder={this._placeholderName}
                        blurToCancel={false}
                        initialValue={this.state.name}
                        onValueChanged={this._onValueChanged}
                        dir="auto" />
                </div>
        );
    },
});
