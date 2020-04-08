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

interface IProps {
    title: React.ReactNode;
    message: React.ReactNode;
}

const ErrorView: React.FC<IProps> = ({title, message}) => {
    return <div className="mx_GenericErrorPage">
        <div className="mx_GenericErrorPage_box">
            <h1>{ title }</h1>
            <p>{ message }</p>
        </div>
    </div>;
};

ErrorView.propTypes = {
    title: PropTypes.object.isRequired, // jsx for title
    message: PropTypes.object.isRequired, // jsx to display
};

export default ErrorView;

