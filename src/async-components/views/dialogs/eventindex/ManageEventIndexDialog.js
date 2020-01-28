/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import * as sdk from '../../../../index';
import PropTypes from 'prop-types';
import { _t } from '../../../../languageHandler';

import Modal from '../../../../Modal';
import {formatBytes, formatCountLong} from "../../../../utils/FormattingUtils";
import EventIndexPeg from "../../../../indexing/EventIndexPeg";

/*
 * Allows the user to introspect the event index state and disable it.
 */
export default class ManageEventIndexDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            eventIndexSize: 0,
            eventCount: 0,
            roomCount: 0,
            currentRoom: null,
        };
    }

    async updateCurrentRoom(room) {
        const eventIndex = EventIndexPeg.get();
        const stats = await eventIndex.getStats();
        let currentRoom = null;

        if (room) currentRoom = room.name;

        this.setState({
            eventIndexSize: stats.size,
            roomCount: stats.roomCount,
            eventCount: stats.eventCount,
            currentRoom: currentRoom,
        });
    }

    componentWillUnmount(): void {
        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.removeListener("changedCheckpoint", this.updateCurrentRoom.bind(this));
        }
    }

    async componentWillMount(): void {
        let eventIndexSize = 0;
        let roomCount = 0;
        let eventCount = 0;
        let currentRoom = null;

        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.on("changedCheckpoint", this.updateCurrentRoom.bind(this));

            const stats = await eventIndex.getStats();
            eventIndexSize = stats.size;
            roomCount = stats.roomCount;
            eventCount = stats.eventCount;

            const room = eventIndex.currentRoom();
            if (room) currentRoom = room.name;
        }

        this.setState({
            eventIndexSize,
            eventCount,
            roomCount,
            currentRoom,
        });
    }

    _onDisable = async () => {
        Modal.createTrackedDialogAsync("Disable message search", "Disable message search",
            import("./DisableEventIndexDialog"),
            null, null, /* priority = */ false, /* static = */ true,
        );
    }

    _onDone = () => {
        this.props.onFinished(true);
    }

    render() {
        let crawlerState;

        if (this.state.currentRoom === null) {
            crawlerState = _t("Not currently downloading messages for any room.");
        } else {
            crawlerState = (
                    _t("Downloading mesages for %(currentRoom)s.", { currentRoom: this.state.currentRoom })
            );
        }

        const eventIndexingSettings = (
            <div>
                {
                    _t( "Riot is securely caching encrypted messages locally for them " +
                        "to appear in search results:",
                    )
                }
                <div className='mx_SettingsTab_subsectionText'>
                    {_t("Space used:")} {formatBytes(this.state.eventIndexSize, 0)}<br />
                    {_t("Indexed messages:")} {formatCountLong(this.state.eventCount)}<br />
                    {_t("Number of rooms:")} {formatCountLong(this.state.roomCount)}<br />
                    {crawlerState}<br />
                </div>
            </div>
        );

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog className='mx_ManageEventIndexDialog'
                onFinished={this.props.onFinished}
                title={_t("Message search")}
            >
                {eventIndexingSettings}
                <DialogButtons
                    primaryButton={_t("Done")}
                    onPrimaryButtonClick={this.props.onFinished}
                    primaryButtonClass="primary"
                    cancelButton={_t("Disable")}
                    onCancel={this._onDisable}
                    cancelButtonClass="danger"
                />
            </BaseDialog>
        );
    }
}
