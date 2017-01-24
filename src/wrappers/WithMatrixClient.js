/*
Copyright 2015, 2016 OpenMarket Ltd

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

import * as Matrix from 'matrix-js-sdk';
import React from 'react';

/**
 * Wraps a react class, pulling the MatrixClient from the context and adding it
 * as a 'matrixClient' property instead.
 *
 * This abstracts the use of the context API, so that we can use a different
 * mechanism in future.
 */
export default function(WrappedComponent) {
    return React.createClass({
        displayName: "WithMatrixClient<" + WrappedComponent.displayName + ">",

        contextTypes: {
            matrixClient: React.PropTypes.instanceOf(Matrix.MatrixClient).isRequired,
        },

        render: function() {
            return <WrappedComponent {...this.props} matrixClient={this.context.matrixClient} />;
        },
    });
}
