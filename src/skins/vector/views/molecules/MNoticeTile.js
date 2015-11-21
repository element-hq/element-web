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
var HtmlUtils = require('../../../../HtmlUtils');

var MNoticeTileController = require('matrix-react-sdk/lib/controllers/molecules/MNoticeTile')

module.exports = React.createClass({
    displayName: 'MNoticeTile',
    mixins: [MNoticeTileController],

    componentDidMount: function() {
        if (this.props.mxEvent.getContent().format === "org.matrix.custom.html")
            HtmlUtils.highlightDom(this.getDOMNode());
    },

    componentDidUpdate: function() {
        if (this.props.mxEvent.getContent().format === "org.matrix.custom.html")
            HtmlUtils.highlightDom(this.getDOMNode());
    },

    shouldComponentUpdate: function(nextProps) {
        // exploit that events are immutable :)
        return (nextProps.mxEvent.getId() !== this.props.mxEvent.getId() ||
                nextProps.searchTerm !== this.props.searchTerm);
    },

    // XXX: fix horrible duplication with MTextTile
    render: function() {
        var content = this.props.mxEvent.getContent();
        var body = HtmlUtils.bodyToHtml(content, this.props.searchTerm);

        return (
            <span ref="content" className="mx_MNoticeTile mx_MessageTile_content">
                { body }
            </span>
        );
    },
});

