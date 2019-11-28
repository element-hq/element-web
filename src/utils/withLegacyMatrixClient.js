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

import React from "react";
import PropTypes from "prop-types";
import {MatrixClient} from "matrix-js-sdk";

// Higher Order Component to allow use of legacy MatrixClient React Context
// in Functional Components which do not otherwise support legacy React Contexts
export default (Component) => class extends React.PureComponent {
    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    };

    render() {
        return <Component {...this.props} matrixClient={this.context.matrixClient} />;
    }
};
