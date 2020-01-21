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
import PropTypes from 'prop-types';
import classNames from 'classnames';

import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import Field from "../elements/Field";
import {formatBytes} from "../../../utils/FormattingUtils";
import EventIndexPeg from "../../../indexing/EventIndexPeg";

export default class EventIndexPanel extends React.Component {
    constructor() {
        super();

        this.state = {
            eventIndexSize: 0,
            crawlingRooms: 0,
            totalCrawlingRooms: 0,
            eventCount: 0,
            roomCount: 0,
            currentRoom: null,
            eventIndexingEnabled:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'enableCrawling'),
            crawlerSleepTime:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'crawlerSleepTime'),
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
        let crawlingRooms = 0;
        let totalCrawlingRooms = 0;
        let currentRoom = null;

        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.on("changedCheckpoint", this.updateCurrentRoom.bind(this));

            const stats = await eventIndex.getStats();
            eventIndexSize = stats.size;
            roomCount = stats.roomCount;
            eventCount = stats.eventCount;

            const crawledRooms = eventIndex.currentlyCrawledRooms();
            crawlingRooms = crawledRooms.crawlingRooms.size;
            totalCrawlingRooms = crawledRooms.totalRooms.size;

            const room = eventIndex.currentRoom();
            if (room) currentRoom = room.name;
        }

        this.setState({
            eventIndexSize,
            crawlingRooms,
            totalCrawlingRooms,
            eventCount,
            roomCount,
            currentRoom,
        });
    }

    _onEventIndexingEnabledChange = (checked) => {
        SettingsStore.setValue("enableCrawling", null, SettingLevel.DEVICE, checked);

        if (checked) EventIndexPeg.start();
        else EventIndexPeg.stop();

        this.setState({eventIndexingEnabled: checked});
    }

    _onCrawlerSleepTimeChange = (e) => {
        this.setState({crawlerSleepTime: e.target.value});
        SettingsStore.setValue("crawlerSleepTime", null, SettingLevel.DEVICE, e.target.value);
    }

    render() {
        let eventIndexingSettings = null;
        let crawlerState;

        if (!this.state.eventIndexingEnabled) {
            crawlerState = <div>{_t("Message search for encrypted rooms is disabled.")}</div>;
        } else if (this.state.currentRoom === null) {
            crawlerState = <div>{_t("Not downloading messages for any room.")}</div>;
        } else {
            crawlerState = (
                <div>{_t(
                    "Downloading mesages for %(currentRoom)s.",
                    { currentRoom: this.state.currentRoom }
                )}
                </div>
            );
        }

        if (EventIndexPeg.get() !== null) {
            eventIndexingSettings = (
                <div>
                    {
                        _t( "Riot is securely caching encrypted messages locally for them" +
                            "to appear in search results:"
                        )
                    }
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t("Space used:")} {formatBytes(this.state.eventIndexSize, 0)}<br />
                        {_t("Indexed messages:")} {this.state.eventCount}<br />
                        {_t("Number of rooms:")} {this.state.roomCount}<br />
                        {crawlerState}<br />
                    </div>

                    <LabelledToggleSwitch
                        value={this.state.eventIndexingEnabled}
                        onChange={this._onEventIndexingEnabledChange}
                        label={_t('Download and index encrypted messages')} />

                    <Field
                        id={"crawlerSleepTimeMs"}
                        label={_t('Message downloading sleep time(ms)')}
                        type='number'
                        value={this.state.crawlerSleepTime}
                        onChange={this._onCrawlerSleepTimeChange} />
                </div>
            );
        } else {
            eventIndexingSettings = (
                <div>
                    {
                        _t( "Riot can't securely cache encrypted messages locally" +
                            "while running in a web browser. Use Riot Desktop for" +
                            "encrypted messages to appear in search results."
                        )
                    }
                </div>
            );
        }

        return eventIndexingSettings;
    }
}
