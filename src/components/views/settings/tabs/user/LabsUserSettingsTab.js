/*
Copyright 2019 New Vector Ltd

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
import {_t} from "../../../../../languageHandler";
import PropTypes from "prop-types";
import SettingsStore, {SettingLevel} from "../../../../../settings/SettingsStore";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import * as sdk from "../../../../../index";

export class LabsSettingToggle extends React.Component {
    static propTypes = {
        featureId: PropTypes.string.isRequired,
    };

    _onChange = async (checked) => {
        await SettingsStore.setFeatureEnabled(this.props.featureId, checked);
        this.forceUpdate();
    };

    render() {
        const label = SettingsStore.getDisplayName(this.props.featureId);
        const value = SettingsStore.isFeatureEnabled(this.props.featureId);
        return <LabelledToggleSwitch value={value} label={label} onChange={this._onChange} />;
    }
}

export default class LabsUserSettingsTab extends React.Component {
    constructor() {
        super();
    }

    render() {
        const SettingsFlag = sdk.getComponent("views.elements.SettingsFlag");
        const flags = SettingsStore.getLabsFeatures().map(f => <LabsSettingToggle featureId={f} key={f} />);
        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Labs")}</div>
                <div className='mx_SettingsTab_subsectionText'>
                    {
                        _t('Customise your experience with experimental labs features. ' +
                            '<a>Learn more</a>.', {}, {
                            'a': (sub) => {
                                return <a href="https://github.com/vector-im/riot-web/blob/develop/docs/labs.md"
                                    rel='noreferrer noopener' target='_blank'>{sub}</a>;
                            },
                        })
                    }
                </div>
                <div className="mx_SettingsTab_section">
                    {flags}
                    <SettingsFlag name={"enableWidgetScreenshots"} level={SettingLevel.ACCOUNT} />
                    <SettingsFlag name={"showHiddenEventsInTimeline"} level={SettingLevel.DEVICE} />
                    <SettingsFlag name={"lowBandwidth"} level={SettingLevel.DEVICE} />
                    <SettingsFlag name={"sendReadReceipts"} level={SettingLevel.ACCOUNT} />
                    <SettingsFlag name={"advancedRoomListLogging"} level={SettingLevel.DEVICE} />
                </div>
            </div>
        );
    }
}
