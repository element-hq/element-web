/*
Copyright 2019 New Vector Ltd

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
import {_t} from "../../languageHandler";

export default class GenericErrorPage extends React.PureComponent {
    static propTypes = {
        message: PropTypes.string.isRequired,
    };

    render() {
        return <div className='mx_GenericErrorPage'>
            <div className='mx_GenericErrorPage_box'>
                <h1>{_t("Error loading Riot")}</h1>
                <p>{this.props.message}</p>
                <p>{_t(
                    "If this is unexpected, please contact your system administrator " +
                    "or technical support representative.",
                )}</p>
            </div>
        </div>;
    }
}
