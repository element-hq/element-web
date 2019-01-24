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
import {_t} from "../../../../languageHandler";
import PropTypes from "prop-types";
import SettingsStore from "../../../../settings/SettingsStore";
import ToggleSwitch from "../../elements/ToggleSwitch";

export class LabsSettingToggle extends React.Component {
    static propTypes = {
        featureId: PropTypes.string.isRequired,
    };

    _onChange = async (checked) => {
        if (this.props.featureId === "feature_lazyloading") {
            const confirmed = await this._onLazyLoadChanging(checked);
            if (!confirmed) {
                return;
            }
        }

        await SettingsStore.setFeatureEnabled(this.props.featureId, checked);
        this.forceUpdate();
    };

    render() {
        // This is a minimal version of a SettingsFlag
        const label = _t(SettingsStore.getDisplayName(this.props.featureId));
        const value = SettingsStore.isFeatureEnabled(this.props.featureId);
        return (
            <div className="mx_SettingsFlag">
                <span className="mx_SettingsFlag_label">{label}</span>
                <ToggleSwitch checked={value} onChange={this._onChange} />
            </div>
        );
    }
}

export default class LabsSettingsTab extends React.Component {
    constructor() {
        super();
    }

    render() {
        const flags = SettingsStore.getLabsFeatures().map(f => <LabsSettingToggle featureId={f} key={f} />);
        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Labs")}</div>
                <div className="mx_SettingsTab_section">
                    {flags}
                </div>
            </div>
        );
    }
}
