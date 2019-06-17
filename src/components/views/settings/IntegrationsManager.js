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
import MatrixClientPeg from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import dis from '../../../dispatcher';

export default class IntegrationsManager extends React.Component {
    static propTypes = {
        // the source of the integration manager being embedded
        src: PropTypes.string.isRequired,

        // callback when the manager is dismissed
        onFinished: PropTypes.func.isRequired,
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
        return <iframe src={ this.props.src }></iframe>;
    }
}