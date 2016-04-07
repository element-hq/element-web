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

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var HtmlUtils = require('../../../HtmlUtils');
var linkify = require('linkifyjs');
var linkifyElement = require('linkifyjs/element');
var linkifyMatrix = require('../../../linkify-matrix');
var sdk = require('../../../index');

linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'TextualBody',

    propTypes: {
        /* the MatrixEvent to show */
        mxEvent: React.PropTypes.object.isRequired,

        /* a list of words to highlight */
        highlights: React.PropTypes.array,

        /* link URL for the highlights */
        highlightLink: React.PropTypes.string,

        /* callback for when our widget has loaded */
        onWidgetLoad: React.PropTypes.func,
    },

    getInitialState: function() {
        return {
            link: null,

            // track whether the preview widget is hidden
            // we can't directly use mxEvent's widgetHidden property
            // as shouldComponentUpdate needs to be able to do before & after
            // comparisons of the property (and we don't pass it in as a top
            // level prop to avoid bloating the number of props flying around)
            widgetHidden: false,
        };
    },

    componentDidMount: function() {
        linkifyElement(this.refs.content, linkifyMatrix.options);

        var link = this.findLink(this.refs.content.children);
        if (link) {
            this.setState({ link: link.getAttribute("href") });

            // lazy-load the hidden state of the preview widget from localstorage
            if (global.localStorage) {
                var hidden = global.localStorage.getItem("hide_preview_" + this.props.mxEvent.getId());
                // XXX: we're gutwrenching mxEvent here by setting our own custom property on it
                this.props.mxEvent.widgetHidden = hidden;
                this.setState({ widgetHidden: hidden });
            }
        }

        if (this.props.mxEvent.getContent().format === "org.matrix.custom.html")
            HtmlUtils.highlightDom(ReactDOM.findDOMNode(this));
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        // exploit that events are immutable :)
        return (nextProps.mxEvent.getId() !== this.props.mxEvent.getId() ||
                nextProps.highlights !== this.props.highlights ||
                nextProps.highlightLink !== this.props.highlightLink ||
                nextState.link !== this.state.link ||
                nextProps.mxEvent.widgetHidden !== this.state.widgetHidden);
    },

    componentWillUpdate: function(nextProps, nextState) {
        this.setState({ widgetHidden: nextProps.mxEvent.widgetHidden });
    },

    findLink: function(nodes) {
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.tagName === "A" && node.getAttribute("href")) {
                return node;
            }
            else if (node.children && node.children.length) {
                return this.findLink(node.children)
            }
        }
    },

    onCancelClick: function(event) {
        // XXX: we're gutwrenching mxEvent here by setting our own custom property on it
        this.props.mxEvent.widgetHidden = true;
        this.setState({ widgetHidden: true });
        // FIXME: persist this somewhere smarter than local storage
        if (global.localStorage) {
            global.localStorage.setItem("hide_preview_" + this.props.mxEvent.getId(), "1");
        }
        this.forceUpdate();
    },

    render: function() {
        var mxEvent = this.props.mxEvent;
        var content = mxEvent.getContent();
        var body = HtmlUtils.bodyToHtml(content, this.props.highlights,
                                       {highlightLink: this.props.highlightLink});


        var widget;
        if (this.state.link && !this.state.widgetHidden) {
            var LinkPreviewWidget = sdk.getComponent('rooms.LinkPreviewWidget');
            widget = <LinkPreviewWidget
                link={ this.state.link }
                mxEvent={ this.props.mxEvent }
                onCancelClick={ this.onCancelClick }
                onWidgetLoad={ this.props.onWidgetLoad }/>;
        }

        switch (content.msgtype) {
            case "m.emote":
                var name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
                return (
                    <span ref="content" className="mx_MEmoteBody mx_EventTile_content">
                        * { name } { body }
                        { widget }
                    </span>
                );
            case "m.notice":
                return (
                    <span ref="content" className="mx_MNoticeBody mx_EventTile_content">
                        { body }
                        { widget }
                    </span>
                );
            default: // including "m.text"
                return (
                    <span ref="content" className="mx_MTextBody mx_EventTile_content">
                        { body }
                        { widget }
                    </span>
                );
        }
    },
});

