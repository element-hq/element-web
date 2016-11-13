/*
Copyright 2016 OpenMarket Ltd

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

import 'isomorphic-fetch';

var React = require("react");
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var sdk = require('matrix-react-sdk');

module.exports = React.createClass({
    displayName: 'HomePage',

    propTypes: {
        config: React.PropTypes.object.isRequired,
        collapsedRhs: React.PropTypes.bool,
    },

    getInitialState: function() {
        return {
            page: ""
        };
    },

    componentWillMount: function() {
        fetch(this.props.config.home_page).then(
            (response)=>{
                return response.text();
            },
            (error)=>{
                console.log(error);
                this.setState({ page: "Couldn't load home page" });
            }
        ).then(
            (body)=>{
                this.setState({ page: body });
            }
        );
    },

    render: function() {
        // const SimpleRoomHeader = sdk.getComponent('rooms.SimpleRoomHeader');
        // <SimpleRoomHeader title="Welcome to Riot" collapsedRhs={ this.props.collapsedRhs }/>

        return (
        <div className="mx_HomePage">
            <div className="mx_HomePage_body" dangerouslySetInnerHTML={{ __html: this.state.page }}>
            </div>
        </div>
        );
    }
});
