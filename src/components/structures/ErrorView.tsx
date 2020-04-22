/*
Copyright 2020 New Vector Ltd

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

import * as React from "react";
import * as PropTypes from "prop-types";

import { _t } from "matrix-react-sdk/src/languageHandler";

interface IProps {
    title: string;
    messages?: string[];
}

const ErrorView: React.FC<IProps> = ({title, messages}) => {
    return <div className="mx_GenericErrorPage">
        <div className="mx_GenericErrorPage_box">
            <h1>{title}</h1>
            <div>
                {messages && messages.map(msg => <p key={msg}>
                    { _t(msg) }
                </p>)}
            </div>
        </div>
    </div>;
};

ErrorView.propTypes = {
    title: PropTypes.string.isRequired,
    messages: PropTypes.arrayOf(PropTypes.string.isRequired),
};

export default ErrorView;

