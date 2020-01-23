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

import SettingsStore, {SettingLevel} from "../../../../settings/SettingsStore";
import LabelledToggleSwitch from "../../../../components/views/elements/LabelledToggleSwitch";
import Field from "../../../../components/views/elements/Field";
import {formatBytes} from "../../../../utils/FormattingUtils";
import EventIndexPeg from "../../../../indexing/EventIndexPeg";
import AccessibleButton from "../../../../components/views/elements/AccessibleButton";


/*
 * Walks the user through the process of creating an e2e key backup
 * on the server.
 */
export default class ManageEventIndex extends React.Component {
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

    _onDisable = async () => {
        this.props.onFinished(false);
    }

    _onEnable = async () => {
        this.props.onFinished(false);
    }

    _onDone = () => {
        this.props.onFinished(true);
    }

    render() {
        let eventIndexingSettings = null;
        let buttons;
        let crawlerState;

        if (!this.state.eventIndexingEnabled) {
            crawlerState = _t("Message search for encrypted rooms is disabled.");
        } else if (this.state.currentRoom === null) {
            crawlerState = _t("Not downloading messages for any room.");
        } else {
            crawlerState = (
                    _t("Downloading mesages for %(currentRoom)s.", { currentRoom: this.state.currentRoom })
            );
        }

        if (EventIndexPeg.get() !== null) {
            eventIndexingSettings = (
                <div>
                    {
                        _t( "Riot is securely caching encrypted messages locally for them " +
                            "to appear in search results:",
                        )
                    }
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t("Space used:")} {formatBytes(this.state.eventIndexSize, 0)}<br />
                        {_t("Indexed messages:")} {this.state.eventCount}<br />
                        {_t("Number of rooms:")} {this.state.roomCount}<br />
                        {crawlerState}<br />
                    </div>
                </div>
            );

            buttons = (
                <div className="mx_Dialog_buttons">
                    <AccessibleButton kind="secondary" onClick={this._onDisable}>
                        {_t("Disable")}
                    </AccessibleButton>
                    <AccessibleButton kind="primary" onClick={this._onDone}>
                        {_t("Done")}
                    </AccessibleButton>
                </div>
            );
        } else if (!this.state.eventIndexingEnabled && this.state.eventIndexingInstalled) {
            eventIndexingSettings = (
                <div>
                    {_t( "Securely cache encrypted messages locally for them to appear in search results.")}
                </div>
            );
            buttons = (
                <div className="mx_Dialog_buttons">
                    <AccessibleButton kind="primary" onClick={this._onEnable}>
                        {_t("Enable")}
                    </AccessibleButton>
                </div>
            );
        } else {
            eventIndexingSettings = (
                <div>
                    {
                        _t( "Riot can't securely cache encrypted messages locally" +
                            "while running in a web browser. Use Riot Desktop for" +
                            "encrypted messages to appear in search results.",
                        )
                    }
                </div>
            );
        }

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        return (
            <BaseDialog className='mx_ManageEventIndexDialog'
                onFinished={this.props.onFinished}
                title={_t("Message search")}
            >
            {eventIndexingSettings}
            {buttons}
            </BaseDialog>
        );
    }
}
