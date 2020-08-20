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
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import {Key} from "../../../Keyboard";

export default class IntegrationManager extends React.Component {
    static propTypes = {
        // false to display an error saying that we couldn't connect to the integration manager
        connected: PropTypes.bool.isRequired,

        // true to display a loading spinner
        loading: PropTypes.bool.isRequired,

        // The source URL to load
        url: PropTypes.string,

        // callback when the manager is dismissed
        onFinished: PropTypes.func.isRequired,
    };

    static defaultProps = {
        connected: true,
        loading: false,
    };

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        document.addEventListener("keydown", this.onKeyDown);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        document.removeEventListener("keydown", this.onKeyDown);
    }

    onKeyDown = (ev) => {
        if (ev.key === Key.ESCAPE) {
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
        if (this.props.loading) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return (
                <div className='mx_IntegrationManager_loading'>
                    <h3>{_t("Connecting to integration manager...")}</h3>
                    <Spinner />
                </div>
            );
        }

        if (!this.props.connected) {
            return (
                <div className='mx_IntegrationManager_error'>
                    <h3>{_t("Cannot connect to integration manager")}</h3>
                    <p>{_t("The integration manager is offline or it cannot reach your homeserver.")}</p>
                </div>
            );
        }

        return <iframe src={this.props.url}></iframe>;
    }
}
