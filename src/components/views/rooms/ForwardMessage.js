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
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher';
import KeyCode from '../../../KeyCode';


module.exports = React.createClass({
    displayName: 'ForwardMessage',

    propTypes: {
        onCancelClick: React.PropTypes.func.isRequired,
    },

    componentWillMount: function() {
        dis.dispatch({
            action: 'ui_opacity',
            leftOpacity: 1.0,
            rightOpacity: 0.3,
            middleOpacity: 0.5,
        });
    },

    componentDidMount: function() {
        document.addEventListener('keydown', this._onKeyDown);
    },

    componentWillUnmount: function() {
        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 1.0,
            middleOpacity: 1.0,
        });
        document.removeEventListener('keydown', this._onKeyDown);
    },

    _onKeyDown: function(ev) {
        switch (ev.keyCode) {
            case KeyCode.ESCAPE:
                this.props.onCancelClick();
                break;
        }
    },

    render: function() {
        return (
            <div className="mx_ForwardMessage">
                <h1>{_t('Please select the destination room for this message')}</h1>
            </div>
        );
    },
});
