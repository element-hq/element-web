/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import * as sdk from '../../../index';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';

export default class ChangeDisplayName extends React.Component {
    _getDisplayName = async () => {
        const cli = MatrixClientPeg.get();
        try {
            const res = await cli.getProfileInfo(cli.getUserId());
            return res.displayname;
        } catch (e) {
            throw new Error("Failed to fetch display name");
        }
    };

    _changeDisplayName = (newDisplayname) => {
        const cli = MatrixClientPeg.get();
        return cli.setDisplayName(newDisplayname).catch(function(e) {
            throw new Error("Failed to set display name", e);
        });
    };

    render() {
        const EditableTextContainer = sdk.getComponent('elements.EditableTextContainer');
        return (
            <EditableTextContainer
                getInitialValue={this._getDisplayName}
                placeholder={_t("No display name")}
                blurToSubmit={true}
                onSubmit={this._changeDisplayName} />
        );
    }
}
