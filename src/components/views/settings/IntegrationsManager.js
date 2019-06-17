/*
Copyright 2015, 2016 OpenMarket Ltd
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
import PropTypes from 'prop-types';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher';
import ScalarAuthClient from '../../../ScalarAuthClient';

export default class IntegrationsManager extends React.Component {
    static propTypes = {
        // the room object where the integrations manager should be opened in
        room: PropTypes.object.isRequired,

        // the screen name to open
        screen: PropTypes.string,

        // the integration ID to open
        integrationId: PropTypes.string,

        // callback when the manager is dismissed
        onFinished: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            loading: true,
            configured: ScalarAuthClient.isPossible(),
            connected: false, // true if a `src` is set and able to be connected to
            src: null, // string for where to connect to
        };
    }

    componentWillMount() {
        if (!this.state.configured) return;

        const scalarClient = new ScalarAuthClient();
        scalarClient.connect().then(() => {
            const hasCredentials = scalarClient.hasCredentials();
            if (!hasCredentials) {
                this.setState({
                    connected: false,
                    loading: false,
                });
            } else {
                const src = scalarClient.getScalarInterfaceUrlForRoom(
                    this.props.room,
                    this.props.screen,
                    this.props.integrationId,
                );
                this.setState({
                    loading: false,
                    connected: true,
                    src: src,
                });
            }
        }).catch(err => {
            console.error(err);
            this.setState({
                loading: false,
                connected: false,
            });
        });
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        document.addEventListener("keydown", this.onKeyDown);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        document.removeEventListener("keydown", this.onKeyDown);
    }

    onKeyDown = (ev) => {
        if (ev.keyCode === 27) { // escape
            ev.stopPropagation();
            ev.preventDefault();
            this.props.onFinished();
        }
    };

    onAction = (payload) => {
        if (payload.action === 'close_scalar') {
            this.props.onFinished();
        }
    };

    render() {
        if (!this.state.configured) {
            return (
                <div className='mx_IntegrationsManager_error'>
                    <h3>{_t("No integrations server configured")}</h3>
                    <p>{_t("This Riot instance does not have an integrations server configured.")}</p>
                </div>
            );
        }

        if (this.state.loading) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return (
                <div className='mx_IntegrationsManager_loading'>
                    <h3>{_t("Connecting to integrations server...")}</h3>
                    <Spinner />
                </div>
            );
        }

        if (!this.state.connected) {
            return (
                <div className='mx_IntegrationsManager_error'>
                    <h3>{_t("Cannot connect to integrations server")}</h3>
                    <p>{_t("The integrations server is offline or it cannot reach your homeserver.")}</p>
                </div>
            );
        }

        return <iframe src={this.state.src}></iframe>;
    }
}
