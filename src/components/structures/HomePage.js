/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

var React = require("react");
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var sdk = require('matrix-react-sdk');

module.exports = React.createClass({
    displayName: 'HomePage',

    propTypes: {
        teamServerUrl: React.PropTypes.string.isRequired,
        teamToken: React.PropTypes.string.isRequired,
        collapsedRhs: React.PropTypes.bool,
    },

    render: function() {
        return (
        <div className="mx_HomePage">
            <iframe src={`${this.props.teamServerUrl}/static/${this.props.teamToken}/welcome.html`} style={{width: '100%', border: 'none'}}/>
        </div>
        );
    }
});
