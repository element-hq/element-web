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
            // the URL (if any) to be previewed with a LinkPreviewWidget
            // inside this TextualBody.
            link: null,

            // track whether the preview widget is hidden
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
                nextState.widgetHidden !== this.state.widgetHidden);
    },

    findLink: function(nodes) {
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.tagName === "A" && node.getAttribute("href") &&
                (node.getAttribute("href").startsWith("http://") ||
                 node.getAttribute("href").startsWith("https://")))
            {
                // as a random heuristic to avoid highlighting things like "foo.pl"
                // we require the linked text to either include a / (either from http:// )
                // or from a full foo.bar/baz style schemeless URL - or be a markdown-style
                // link, in which case we check the target text differs from the link value.
                // TODO: make this configurable?
                if (node.textContent.indexOf("/") > -1)
                {
                    return node;
                }
                else {
                    var url = node.getAttribute("href");
                    var host = url.match(/^https?:\/\/(.*?)(\/|$)/)[1];
                    if (node.textContent.trim().startsWith(host)) {
                        // it's a "foo.pl" style link
                        return;
                    }
                    else {
                        // it's a [foo bar](http://foo.com) style link
                        return node;
                    }
                }
            }
            else if (node.tagName === "PRE" || node.tagName === "CODE") {
                return;
            }
            else if (node.children && node.children.length) {
                return this.findLink(node.children)
            }
        }
    },

    onCancelClick: function(event) {
        this.setState({ widgetHidden: true });
        // FIXME: persist this somewhere smarter than local storage
        if (global.localStorage) {
            global.localStorage.setItem("hide_preview_" + this.props.mxEvent.getId(), "1");
        }
        this.forceUpdate();
    },

    getEventTileOps: function() {
        var self = this;
        return {
            isWidgetHidden: function() {
                return self.state.widgetHidden;
            },

            unhideWidget: function() {
                self.setState({ widgetHidden: false });
                if (global.localStorage) {
                    global.localStorage.removeItem("hide_preview_" + self.props.mxEvent.getId());
                }
            },
        }
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

