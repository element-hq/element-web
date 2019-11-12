/*
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
import {_t} from '../../../languageHandler';

export default class MjolnirBody extends React.Component {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        onMessageAllowed: PropTypes.func.isRequired,
    };

    constructor() {
        super();
    }

    _onAllowClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const key = `mx_mjolnir_render_${this.props.mxEvent.getRoomId()}__${this.props.mxEvent.getId()}`;
        localStorage.setItem(key, "true");
        this.props.onMessageAllowed();
    };

    render() {
        return (
            <div className='mx_MjolnirBody'><i>{_t(
                "You have ignored this user, so their message is hidden. <a>Show anyways.</a>",
                {}, {a: (sub) => <a href="#" onClick={this._onAllowClick}>{sub}</a>},
            )}</i></div>
        );
    }
}
