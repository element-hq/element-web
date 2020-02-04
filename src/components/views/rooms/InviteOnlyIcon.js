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
import * as sdk from '../../../index';
import SettingsStore from '../../../settings/SettingsStore';

export default class InviteOnlyIcon extends React.Component {
    constructor() {
        super();

        this.state = {
            hover: false,
        };
    }

    onHoverStart = () => {
        this.setState({hover: true});
    };

    onHoverEnd = () => {
        this.setState({hover: false});
    };

    render() {
        if (!SettingsStore.isFeatureEnabled("feature_invite_only_padlocks")) {
            return null;
        }

        const Tooltip = sdk.getComponent("elements.Tooltip");
        let tooltip;
        if (this.state.hover) {
            tooltip = <Tooltip className="mx_InviteOnlyIcon_tooltip" label={_t("Invite only")} dir="auto" />;
        }
        return (<div className="mx_InviteOnlyIcon"
          onMouseEnter={this.onHoverStart}
          onMouseLeave={this.onHoverEnd}
        >
          { tooltip }
        </div>);
    }
}
