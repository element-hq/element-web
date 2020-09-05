/*
 Copyright 2017 Vector Creations Ltd
 Copyright 2017 Michael Telatynski

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
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import {Key} from '../../../Keyboard';


export default class ForwardMessage extends React.Component {
    static propTypes = {
        onCancelClick: PropTypes.func.isRequired,
    };

    componentDidMount() {
        dis.dispatch({
            action: 'panel_disable',
            middleDisabled: true,
        });

        document.addEventListener('keydown', this._onKeyDown);
    }

    componentWillUnmount() {
        dis.dispatch({
            action: 'panel_disable',
            middleDisabled: false,
        });
        document.removeEventListener('keydown', this._onKeyDown);
    }

    _onKeyDown = ev => {
        switch (ev.key) {
            case Key.ESCAPE:
                this.props.onCancelClick();
                break;
        }
    };

    render() {
        return (
            <div className="mx_ForwardMessage">
                <h1>{ _t('Please select the destination room for this message') }</h1>
            </div>
        );
    }
}
