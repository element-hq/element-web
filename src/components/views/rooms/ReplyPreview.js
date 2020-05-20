/*
Copyright 2017 New Vector Ltd

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
import dis from '../../../dispatcher/dispatcher';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import RoomViewStore from '../../../stores/RoomViewStore';
import SettingsStore from "../../../settings/SettingsStore";
import PropTypes from "prop-types";
import {RoomPermalinkCreator} from "../../../utils/permalinks/Permalinks";

function cancelQuoting() {
    dis.dispatch({
        action: 'reply_to_event',
        event: null,
    });
}

export default class ReplyPreview extends React.Component {
    static propTypes = {
        permalinkCreator: PropTypes.instanceOf(RoomPermalinkCreator).isRequired,
    };

    constructor(props) {
        super(props);
        this.unmounted = false;

        this.state = {
            event: RoomViewStore.getQuotingEvent(),
        };

        this._onRoomViewStoreUpdate = this._onRoomViewStoreUpdate.bind(this);
        this._roomStoreToken = RoomViewStore.addListener(this._onRoomViewStoreUpdate);
    }

    componentWillUnmount() {
        this.unmounted = true;

        // Remove RoomStore listener
        if (this._roomStoreToken) {
            this._roomStoreToken.remove();
        }
    }

    _onRoomViewStoreUpdate() {
        if (this.unmounted) return;

        const event = RoomViewStore.getQuotingEvent();
        if (this.state.event !== event) {
            this.setState({ event });
        }
    }

    render() {
        if (!this.state.event) return null;

        const EventTile = sdk.getComponent('rooms.EventTile');

        return <div className="mx_ReplyPreview">
            <div className="mx_ReplyPreview_section">
                <div className="mx_ReplyPreview_header mx_ReplyPreview_title">
                    { '💬 ' + _t('Replying') }
                </div>
                <div className="mx_ReplyPreview_header mx_ReplyPreview_cancel">
                    <img className="mx_filterFlipColor" src={require("../../../../res/img/cancel.svg")} width="18" height="18"
                         onClick={cancelQuoting} />
                </div>
                <div className="mx_ReplyPreview_clear" />
                <EventTile last={true}
                           tileShape="reply_preview"
                           mxEvent={this.state.event}
                           permalinkCreator={this.props.permalinkCreator}
                           isTwelveHour={SettingsStore.getValue("showTwelveHourTimestamps")} />
            </div>
        </div>;
    }
}
