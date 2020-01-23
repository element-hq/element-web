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

import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";
import AccessibleButton from "../elements/AccessibleButton";
import {formatBytes} from "../../../utils/FormattingUtils";
import EventIndexPeg from "../../../indexing/EventIndexPeg";

export default class EventIndexPanel extends React.Component {
    constructor() {
        super();

        this.state = {
            eventIndexSize: 0,
            roomCount: 0,
            eventIndexingEnabled:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'enableEventIndexing'),
        };
    }

    async updateCurrentRoom(room) {
        const eventIndex = EventIndexPeg.get();
        const stats = await eventIndex.getStats();

        this.setState({
            eventIndexSize: stats.size,
            roomCount: stats.roomCount,
        });
    }

    componentWillUnmount(): void {
        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.removeListener("changedCheckpoint", this.updateCurrentRoom.bind(this));
        }
    }

    async componentWillMount(): void {
        this.updateState();
    }

    async updateState() {
        let eventIndexSize = 0;
        let roomCount = 0;

        const eventIndex = EventIndexPeg.get();
        const eventIndexingEnabled = SettingsStore.getValueAt(SettingLevel.DEVICE, 'enableEventIndexing');

        if (eventIndex !== null) {
            eventIndex.on("changedCheckpoint", this.updateCurrentRoom.bind(this));

            const stats = await eventIndex.getStats();
            eventIndexSize = stats.size;
            roomCount = stats.roomCount;
        }

        this.setState({
            eventIndexSize,
            roomCount,
            eventIndexingEnabled,
        });
    }

    _onManage = async () => {
        Modal.createTrackedDialogAsync('Message search', 'Message search',
            import('../../../async-components/views/dialogs/eventindex/ManageEventIndex'),
            {
                onFinished: () => {},
            }, null, /* priority = */ false, /* static = */ true,
        );
    }

    _onEnable = async () => {
        await EventIndexPeg.initEventIndex();
        await EventIndexPeg.get().addInitialCheckpoints();
        await EventIndexPeg.get().startCrawler();
        await SettingsStore.setValue('enableEventIndexing', null, SettingLevel.DEVICE, true);
        await this.updateState();
    }

    render() {
        let eventIndexingSettings = null;

        if (EventIndexPeg.get() !== null) {
            eventIndexingSettings = (
                <div>
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t( "Securely cache encrypted messages locally for them " +
                             "to appear in search results, using ")
                        } {formatBytes(this.state.eventIndexSize, 0)}
                        {_t( " to store messages from ")} {this.state.roomCount} {_t("rooms.")}
                    </div>
                    <div>
                        <AccessibleButton kind="primary" onClick={this._onManage}>
                            {_t("Manage")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (!this.state.eventIndexingEnabled && EventIndexPeg.supportIsInstalled()) {
            eventIndexingSettings = (
                <div>
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t( "Securely cache encrypted messages locally for them to appear in search results.")}
                    </div>
                    <div>
                        <AccessibleButton kind="primary" onClick={this._onEnable}>
                            {_t("Enable")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else {
            eventIndexingSettings = (
                <div>
                    {
                        _t( "Riot can't securely cache encrypted messages locally " +
                            "while running in a web browser. Use Riot Desktop for " +
                            "encrypted messages to appear in search results.",
                        )
                    }
                </div>
            );
        }

        return eventIndexingSettings;
    }
}
