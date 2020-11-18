/*
Copyright 2017 New Vector Ltd

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
import { _t } from '../../../languageHandler';
import MatrixClientContext from "../../../contexts/MatrixClientContext";

export default class GroupUserSettings extends React.Component {
    static contextType = MatrixClientContext;

    state = {
        error: null,
        groups: null,
    };

    componentDidMount() {
        this.context.getJoinedGroups().then((result) => {
            this.setState({groups: result.groups || [], error: null});
        }, (err) => {
            console.error(err);
            this.setState({groups: null, error: err});
        });
    }

    render() {
        let text = "";
        let groupPublicityToggles = null;
        const groups = this.state.groups;

        if (this.state.error) {
            text = _t('Something went wrong when trying to get your communities.');
        } else if (groups === null) {
            text = _t('Loading...');
        } else if (groups.length > 0) {
            const GroupPublicityToggle = sdk.getComponent('groups.GroupPublicityToggle');
            groupPublicityToggles = groups.map((groupId, index) => {
                return <GroupPublicityToggle key={index} groupId={groupId} />;
            });
            text = _t('Display your community flair in rooms configured to show it.');
        } else {
            text = _t("You're not currently a member of any communities.");
        }

        return (
            <div>
                <p className="mx_SettingsTab_subsectionText">{ text }</p>
                <div className='mx_SettingsTab_subsectionText'>
                    { groupPublicityToggles }
                </div>
            </div>
        );
    }
}
