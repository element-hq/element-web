/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import React from "react";
import PropTypes from "prop-types";
import Matrix from "matrix-js-sdk";
import {MatrixClientPeg} from "../../MatrixClientPeg";
import * as sdk from "../../index";
import Modal from '../../Modal';
import { _t } from '../../languageHandler';
import HomePage from "./HomePage";

export default class UserView extends React.Component {
    static get propTypes() {
        return {
            userId: PropTypes.string,
        };
    }

    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        if (this.props.userId) {
            this._loadProfileInfo();
        }
    }

    componentDidUpdate(prevProps) {
        // XXX: We shouldn't need to null check the userId here, but we declare
        // it as optional and MatrixChat sometimes fires in a way which results
        // in an NPE when we try to update the profile info.
        if (prevProps.userId !== this.props.userId && this.props.userId) {
            this._loadProfileInfo();
        }
    }

    async _loadProfileInfo() {
        const cli = MatrixClientPeg.get();
        this.setState({loading: true});
        let profileInfo;
        try {
            profileInfo = await cli.getProfileInfo(this.props.userId);
        } catch (err) {
            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
            Modal.createTrackedDialog(_t('Could not load user profile'), '', ErrorDialog, {
                title: _t('Could not load user profile'),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
            this.setState({loading: false});
            return;
        }
        const fakeEvent = new Matrix.MatrixEvent({type: "m.room.member", content: profileInfo});
        const member = new Matrix.RoomMember(null, this.props.userId);
        member.setMembershipEvent(fakeEvent);
        this.setState({member, loading: false});
    }

    render() {
        if (this.state.loading) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        } else if (this.state.member) {
            const RightPanel = sdk.getComponent('structures.RightPanel');
            const MainSplit = sdk.getComponent('structures.MainSplit');
            const panel = <RightPanel user={this.state.member} />;
            return (<MainSplit panel={panel} resizeNotifier={this.props.resizeNotifier}>
                <HomePage />
            </MainSplit>);
        } else {
            return (<div />);
        }
    }
}
