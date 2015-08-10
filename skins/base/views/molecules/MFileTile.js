/*
Copyright 2015 OpenMarket Ltd

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

var React = require('react');

var MFileTileController = require("../../../../src/controllers/molecules/MFileTile");

var MatrixClientPeg = require('../../../../src/MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'MFileTile',
    mixins: [MFileTileController],

    render: function() {
        var content = this.props.mxEvent.getContent();
        var cli = MatrixClientPeg.get();

        return (
            <li className="mx_MFileTile">
                <a href={cli.mxcUrlToHttp(content.url)} target="_blank">
                    {this.presentableTextForFile(content)}
                </a>
            </li>
        );
    },
});
