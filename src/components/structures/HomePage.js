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

import React from 'react';
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';
import sdk from 'matrix-react-sdk';

module.exports = React.createClass({
    displayName: 'HomePage',

    propTypes: {
        // URL base of the team server. Optional.
        teamServerUrl: React.PropTypes.string,
        // Team token. Optional. If set, used to get the static homepage of the team
        //      associated. If unset, homePageUrl will be used.
        teamToken: React.PropTypes.string,
        // URL to use as the iFrame src. Defaults to /home.html.
        homePageUrl: React.PropTypes.string,
    },

    render: function() {
        let src = this.props.homePageUrl || '/home/home.html';

        if (this.props.teamToken && this.props.teamServerUrl) {
            src = `${this.props.teamServerUrl}/static/${this.props.teamToken}/home.html`;
        }

        return (
        <div className="mx_HomePage">
            <iframe src={src}/>
        </div>
        );
    }
});
