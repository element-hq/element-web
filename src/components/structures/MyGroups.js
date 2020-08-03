/*
Copyright 2017 Vector Creations Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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
import createReactClass from 'create-react-class';
import * as sdk from '../../index';
import { _t } from '../../languageHandler';
import SdkConfig from '../../SdkConfig';
import dis from '../../dispatcher/dispatcher';
import AccessibleButton from '../views/elements/AccessibleButton';
import MatrixClientContext from "../../contexts/MatrixClientContext";
import AutoHideScrollbar from "./AutoHideScrollbar";

export default createReactClass({
    displayName: 'MyGroups',

    getInitialState: function() {
        return {
            groups: null,
            error: null,
        };
    },

    statics: {
        contextType: MatrixClientContext,
    },

    componentDidMount: function() {
        this._fetch();
    },

    _onCreateGroupClick: function() {
        dis.dispatch({action: 'view_create_group'});
    },

    _fetch: function() {
        this.context.getJoinedGroups().then((result) => {
            this.setState({groups: result.groups, error: null});
        }, (err) => {
            if (err.errcode === 'M_GUEST_ACCESS_FORBIDDEN') {
                // Indicate that the guest isn't in any groups (which should be true)
                this.setState({groups: [], error: null});
                return;
            }
            this.setState({groups: null, error: err});
        });
    },

    render: function() {
        const brand = SdkConfig.get().brand;
        const Loader = sdk.getComponent("elements.Spinner");
        const SimpleRoomHeader = sdk.getComponent('rooms.SimpleRoomHeader');
        const GroupTile = sdk.getComponent("groups.GroupTile");

        let content;
        let contentHeader;
        if (this.state.groups) {
            const groupNodes = [];
            this.state.groups.forEach((g) => {
                groupNodes.push(<GroupTile key={g} groupId={g} />);
            });
            contentHeader = groupNodes.length > 0 ? <h3>{ _t('Your Communities') }</h3> : <div />;
            content = groupNodes.length > 0 ?
                <AutoHideScrollbar className="mx_MyGroups_scrollable">
                    <div className="mx_MyGroups_microcopy">
                        <p>
                            { _t(
                                "Did you know: you can use communities to filter your %(brand)s experience!",
                                { brand },
                            ) }
                        </p>
                        <p>
                            { _t(
                                "To set up a filter, drag a community avatar over to the filter panel on " +
                                "the far left hand side of the screen. You can click on an avatar in the " +
                                "filter panel at any time to see only the rooms and people associated " +
                                "with that community.",
                            ) }
                        </p>
                    </div>
                    <div className="mx_MyGroups_joinedGroups">
                        { groupNodes }
                    </div>
                </AutoHideScrollbar> :
                <div className="mx_MyGroups_placeholder">
                    { _t(
                        "You're not currently a member of any communities.",
                    ) }
                </div>;
        } else if (this.state.error) {
            content = <div className="mx_MyGroups_error">
                { _t('Error whilst fetching joined communities') }
            </div>;
        } else {
            content = <Loader />;
        }

        return <div className="mx_MyGroups">
            <SimpleRoomHeader title={_t("Communities")} icon={require("../../../res/img/icons-groups.svg")} />
            <div className='mx_MyGroups_header'>
                <div className="mx_MyGroups_headerCard">
                    <AccessibleButton className='mx_MyGroups_headerCard_button' onClick={this._onCreateGroupClick}>
                    </AccessibleButton>
                    <div className="mx_MyGroups_headerCard_content">
                        <div className="mx_MyGroups_headerCard_header">
                            { _t('Create a new community') }
                        </div>
                        { _t(
                            'Create a community to group together users and rooms! ' +
                            'Build a custom homepage to mark out your space in the Matrix universe.',
                        ) }
                    </div>
                </div>
                {/*<div className="mx_MyGroups_joinBox mx_MyGroups_headerCard">
                    <AccessibleButton className='mx_MyGroups_headerCard_button' onClick={this._onJoinGroupClick}>
                        <TintableSvg src={require("../../../res/img/icons-create-room.svg")} width="50" height="50" />
                    </AccessibleButton>
                    <div className="mx_MyGroups_headerCard_content">
                        <div className="mx_MyGroups_headerCard_header">
                            { _t('Join an existing community') }
                        </div>
                        { _t(
                            'To join an existing community you\'ll have to '+
                            'know its community identifier; this will look '+
                            'something like <i>+example:matrix.org</i>.',
                            {},
                            { 'i': (sub) => <i>{ sub }</i> })
                        }
                    </div>
                </div>*/}
            </div>
            <div className="mx_MyGroups_content">
                { contentHeader }
                { content }
            </div>
        </div>;
    },
});
