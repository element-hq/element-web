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
import PropTypes from 'prop-types';
import sdk from '../../../index';
import { MatrixClient } from 'matrix-js-sdk';
import { _t } from '../../../languageHandler';

export default React.createClass({
    displayName: 'GroupUserSettings',

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getInitialState() {
        return {
            error: null,
            groups: null,
        };
    },

    componentWillMount: function() {
        this.context.matrixClient.getJoinedGroups().done((result) => {
            this.setState({groups: result.groups || [], error: null});
        }, (err) => {
            console.error(err);
            this.setState({groups: null, error: err});
        });
    },

    _renderGroupPublicity() {
        let text = "";
        let scrollbox = <div />;
        const groups = this.state.groups;

        if (this.state.error) {
            text = _t('Something went wrong when trying to get your communities.');
        } else if (groups === null) {
            text = _t('Loading...');
        } else if (groups.length > 0) {
            const GroupPublicityToggle = sdk.getComponent('groups.GroupPublicityToggle');
            const GeminiScrollbarWrapper = sdk.getComponent('elements.GeminiScrollbarWrapper');
            const groupPublicityToggles = groups.map((groupId, index) => {
                return <GroupPublicityToggle key={index} groupId={groupId} />;
            });
            text = _t('Display your community flair in rooms configured to show it.');
            scrollbox = <div className="mx_GroupUserSettings_groupPublicity_scrollbox">
                <GeminiScrollbarWrapper>
                    { groupPublicityToggles }
                </GeminiScrollbarWrapper>
            </div>;
        } else {
            text = _t("You're not currently a member of any communities.");
        }

        return <div>
            <h3>{ _t('Flair') }</h3>
            <div className="mx_UserSettings_section">
                <p>
                    { text }
                </p>
                { scrollbox }
            </div>
        </div>;
    },

    render() {
        const groupPublicity = this._renderGroupPublicity();

        return <div>
            { groupPublicity }
        </div>;
    },
});
