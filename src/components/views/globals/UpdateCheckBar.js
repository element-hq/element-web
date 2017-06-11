/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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

'use strict';

import React from 'react';
import dis from 'matrix-react-sdk/lib/dispatcher';
import { _t } from 'matrix-react-sdk/lib/languageHandler';
import PlatformPeg from 'matrix-react-sdk/lib/PlatformPeg';
import {updateStateEnum} from '../../../vector/platform/VectorBasePlatform';
import AccessibleButton from 'matrix-react-sdk/lib/components/views/elements/AccessibleButton';

export default React.createClass({

    getInitialState: function() {
        return {
            message: _t('Checking for an update...'),
            done: false,
        };
    },

    componentWillMount: function() {
        PlatformPeg.get().checkForUpdate().done((state) => {
            if (this._unmounted) return;

            console.log('checkForUpdate done, ', state);

            // We will be replaced by NewVersionBar
            if (state === updateStateEnum.READY) return;

            let done = true;
            let message;
            switch (state) {
                case updateStateEnum.ERROR:
                    message = _t('Error encountered when checking for an update.');
                    break;
                case updateStateEnum.TIMEOUT:
                    message = _t('Update Check timed out, try again later.');
                    break;
                case updateStateEnum.NOTAVAILABLE:
                    message = _t('No update found.');
                    break;
                case updateStateEnum.DOWNLOADING:
                    message = _t('Update is being downloaded.');
                    done = false;
                    break;
            }

            this.setState({message, done});
        });
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    hideToolbar: function() {
        dis.dispatch({
            action: 'check_updates',
            value: false,
        });
    },

    render: function() {
        let image;
        if (this.state.done) {
            image = <img className="mx_MatrixToolbar_warning" src="img/warning.svg" width="24" height="23" alt="Warning"/>;
        } else {
            image = <img className="mx_MatrixToolbar_warning" src="'img/spinner.gif'" width="24" height="23" alt={this.state.message}/>;
        }

        return (
            <div className="mx_MatrixToolbar">
                {image}
                <div className="mx_MatrixToolbar_content">
                    {this.state.message}
                </div>
                <AccessibleButton className="mx_MatrixToolbar_close" onClick={this.hideToolbar}>
                    <img src="img/cancel.svg" width="18" height="18" />
                </AccessibleButton>
            </div>
        );
    }
});
