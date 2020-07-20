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
import SdkConfig from '../../../../SdkConfig';
import SettingsStore, {SettingLevel} from "../../../../settings/SettingsStore";

import Modal from '../../../../Modal';
import {formatBytes, formatCountLong} from "../../../../utils/FormattingUtils";
import EventIndexPeg from "../../../../indexing/EventIndexPeg";

/*
 * Allows the user to introspect the event index state and disable it.
 */
export default class ManageEventIndexDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            eventIndexSize: 0,
            eventCount: 0,
            crawlingRoomsCount: 0,
            roomCount: 0,
            currentRoom: null,
            crawlerSleepTime:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'crawlerSleepTime'),
        };
    }

    updateCurrentRoom = async (room) => {
        const eventIndex = EventIndexPeg.get();
        let stats;

        try {
            stats = await eventIndex.getStats();
        } catch {
            // This call may fail if sporadically, not a huge issue as we will
            // try later again and probably succeed.
            return;
        }

        let currentRoom = null;

        if (room) currentRoom = room.name;
        const roomStats = eventIndex.crawlingRooms();
        const crawlingRoomsCount = roomStats.crawlingRooms.size;
        const roomCount = roomStats.totalRooms.size;

        this.setState({
            eventIndexSize: stats.size,
            eventCount: stats.eventCount,
            crawlingRoomsCount: crawlingRoomsCount,
            roomCount: roomCount,
            currentRoom: currentRoom,
        });
    };

    componentWillUnmount(): void {
        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.removeListener("changedCheckpoint", this.updateCurrentRoom);
        }
    }

    async componentDidMount(): void {
        let eventIndexSize = 0;
        let crawlingRoomsCount = 0;
        let roomCount = 0;
        let eventCount = 0;
        let currentRoom = null;

        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.on("changedCheckpoint", this.updateCurrentRoom);

            try {
                const stats = await eventIndex.getStats();
                eventIndexSize = stats.size;
                eventCount = stats.eventCount;
            } catch {
                // This call may fail if sporadically, not a huge issue as we
                // will try later again in the updateCurrentRoom call and
                // probably succeed.
            }

            const roomStats = eventIndex.crawlingRooms();
            crawlingRoomsCount = roomStats.crawlingRooms.size;
            roomCount = roomStats.totalRooms.size;

            const room = eventIndex.currentRoom();
            if (room) currentRoom = room.name;
        }

        this.setState({
            eventIndexSize,
            eventCount,
            crawlingRoomsCount,
            roomCount,
            currentRoom,
        });
    }

    _onDisable = async () => {
        Modal.createTrackedDialogAsync("Disable message search", "Disable message search",
            import("./DisableEventIndexDialog"),
            null, null, /* priority = */ false, /* static = */ true,
        );
    };

    _onCrawlerSleepTimeChange = (e) => {
        this.setState({crawlerSleepTime: e.target.value});
        SettingsStore.setValue("crawlerSleepTime", null, SettingLevel.DEVICE, e.target.value);
    };

    render() {
        const brand = SdkConfig.get().brand;
        const Field = sdk.getComponent('views.elements.Field');

        let crawlerState;
        if (this.state.currentRoom === null) {
            crawlerState = _t("Not currently indexing messages for any room.");
        } else {
            crawlerState = (
                    _t("Currently indexing: %(currentRoom)s", { currentRoom: this.state.currentRoom })
            );
        }

        const doneRooms = Math.max(0, (this.state.roomCount - this.state.crawlingRoomsCount));

        const eventIndexingSettings = (
            <div>
                {_t(
                    "%(brand)s is securely caching encrypted messages locally for them " +
                    "to appear in search results:",
                    { brand },
                )}
                <div className='mx_SettingsTab_subsectionText'>
                    {crawlerState}<br />
                    {_t("Space used:")} {formatBytes(this.state.eventIndexSize, 0)}<br />
                    {_t("Indexed messages:")} {formatCountLong(this.state.eventCount)}<br />
                    {_t("Indexed rooms:")} {_t("%(doneRooms)s out of %(totalRooms)s", {
                        doneRooms: formatCountLong(doneRooms),
                        totalRooms: formatCountLong(this.state.roomCount),
                    })} <br />
                    <Field
                        label={_t('Message downloading sleep time(ms)')}
                        type='number'
                        value={this.state.crawlerSleepTime}
                        onChange={this._onCrawlerSleepTimeChange} />
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
