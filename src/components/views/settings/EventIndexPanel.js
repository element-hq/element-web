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
            eventIndexingEnabled:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'enableCrawling'),
            crawlerSleepTime:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'crawlerSleepTime'),
        };
    }

    async componentWillMount(): void {
        let eventIndexSize = 0;
        let crawlingRooms = 0;
        let totalCrawlingRooms = 0;

        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndexSize = await eventIndex.indexSize();
            const crawledRooms = eventIndex.currentlyCrawledRooms();
            crawlingRooms = crawledRooms.crawlingRooms.size;
            totalCrawlingRooms = crawledRooms.totalRooms.size;
        }

        this.setState({
            eventIndexSize,
            crawlingRooms,
            totalCrawlingRooms,
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
            crawlerState = <div>{_t("Message downloader is stopped.")}</div>;
        } else if (this.state.crawlingRooms === 0) {
            crawlerState = <div>{_t("Message downloader is currently idle.")}</div>;
        } else {
            crawlerState = (
                <div>{_t(
                    "Currently downloading mesages in %(crawlingRooms)s of %(totalRooms)s rooms.",
                    { crawlingRooms: this.state.crawlingRooms,
                      totalRooms: this.state.totalCrawlingRooms,
                    })}
                </div>
            );
        }

        if (EventIndexPeg.get() !== null) {
            eventIndexingSettings = (
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Encrypted search")}</span>
                    {
                        _t( "To enable search in encrypted rooms, Riot needs to run " +
                            "a background process to download historical messages " +
                            "from those rooms to your computer.",
                        )
                    }
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t("Message disk usage:")} {formatBytes(this.state.eventIndexSize, 0)}<br />
                        {crawlerState}<br />
                    </div>

                    <LabelledToggleSwitch
                        value={this.state.eventIndexingEnabled}
                        onChange={this._onEventIndexingEnabledChange}
                        label={_t('Enable message downloading')} />

                    <Field
                        id={"crawlerSleepTimeMs"}
                        label={_t('Message downloading sleep time(ms)')}
                        type='number'
                        value={this.state.crawlerSleepTime}
                        onChange={this._onCrawlerSleepTimeChange} />
                </div>
            );
        }

        return eventIndexingSettings;
    }
}
