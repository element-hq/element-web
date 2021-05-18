/*
Copyright 2015, 2016 OpenMarket Ltd
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

import React from "react";
import * as sdk from './index';
import PropTypes from 'prop-types';
import { _t } from './languageHandler';

/**
 * Wrap an asynchronous loader function with a react component which shows a
 * spinner until the real component loads.
 */
export default class AsyncWrapper extends React.Component {
    static propTypes = {
        /** A promise which resolves with the real component
         */
        prom: PropTypes.object.isRequired,
    };

    state = {
        component: null,
        error: null,
    };

    componentDidMount() {
        this._unmounted = false;
        // XXX: temporary logging to try to diagnose
        // https://github.com/vector-im/element-web/issues/3148
        console.log('Starting load of AsyncWrapper for modal');
        this.props.prom.then((result) => {
            if (this._unmounted) {
                return;
            }
            // Take the 'default' member if it's there, then we support
            // passing in just an import()ed module, since ES6 async import
            // always returns a module *namespace*.
            const component = result.default ? result.default : result;
            this.setState({component});
        }).catch((e) => {
            console.warn('AsyncWrapper promise failed', e);
            this.setState({error: e});
        });
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    _onWrapperCancelClick = () => {
        this.props.onFinished(false);
    };

    render() {
        if (this.state.component) {
            const Component = this.state.component;
            return <Component {...this.props} />;
        } else if (this.state.error) {
            const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            return <BaseDialog onFinished={this.props.onFinished}
                title={_t("Error")}
            >
                {_t("Unable to load! Check your network connectivity and try again.")}
                <DialogButtons primaryButton={_t("Dismiss")}
                    onPrimaryButtonClick={this._onWrapperCancelClick}
                    hasCancel={false}
                />
            </BaseDialog>;
        } else {
            // show a spinner until the component is loaded.
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        }
    }
}

