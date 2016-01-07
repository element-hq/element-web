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
var ReactDOM = require("react-dom");
var dis = require("../../../dispatcher");
var Tinter = require("../../../Tinter");

module.exports = React.createClass({
    displayName: 'TintableSvg',

    propTypes: {
        src: React.PropTypes.string.isRequired,
        width: React.PropTypes.string.isRequired,
        height: React.PropTypes.string.isRequired,
        className: React.PropTypes.string,
    },

    componentWillMount: function() {
        this.fixups = [];
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentDidMount: function() {
        // we can't use onLoad on object due to https://github.com/facebook/react/pull/5781
        // so handle it with pure DOM instead
        ReactDOM.findDOMNode(this).addEventListener('load', this.onLoad);
    },

    componentWillUnmount: function() {
        ReactDOM.findDOMNode(this).removeEventListener('load', this.onLoad);
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        if (payload.action !== 'tint_update') return;
        Tinter.applySvgFixups(this.fixups);
    },

    onLoad: function(event) {
        this.fixups = Tinter.calcSvgFixups([event.target]);
        Tinter.applySvgFixups(this.fixups);
    },

    render: function() {
        return (
            <object className={ "mx_TintableSvg " + this.props.className }
                    type="image/svg+xml"
                    data={ this.props.src }
                    width={ this.props.width }
                    height={ this.props.height }/>
        );
    }
});
