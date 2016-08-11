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

        /* should show URL previews for this event */
        showUrlPreview: React.PropTypes.bool,

        /* callback for when our widget has loaded */
        onWidgetLoad: React.PropTypes.func,
    },

    getInitialState: function() {
        return {
            // the URLs (if any) to be previewed with a LinkPreviewWidget
            // inside this TextualBody.
            links: [],

            // track whether the preview widget is hidden
            widgetHidden: false,
        };
    },

    componentDidMount: function() {
        linkifyElement(this.refs.content, linkifyMatrix.options);
        this.calculateUrlPreview();

        if (this.props.mxEvent.getContent().format === "org.matrix.custom.html")
            HtmlUtils.highlightDom(ReactDOM.findDOMNode(this));
    },

    componentDidUpdate: function() {
        this.calculateUrlPreview();
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        //console.log("shouldComponentUpdate: ShowUrlPreview for %s is %s", this.props.mxEvent.getId(), this.props.showUrlPreview);

        // exploit that events are immutable :)
        return (nextProps.mxEvent.getId() !== this.props.mxEvent.getId() ||
                nextProps.highlights !== this.props.highlights ||
                nextProps.highlightLink !== this.props.highlightLink ||
                nextProps.showUrlPreview !== this.props.showUrlPreview ||
                nextState.links !== this.state.links ||
                nextState.widgetHidden !== this.state.widgetHidden);
    },

    calculateUrlPreview: function() {
        //console.log("calculateUrlPreview: ShowUrlPreview for %s is %s", this.props.mxEvent.getId(), this.props.showUrlPreview);

        if (this.props.showUrlPreview && !this.state.links.length) {
            var links = this.findLinks(this.refs.content.children);
            if (links.length) {
                this.setState({ links: links.map((link)=>{
                    return link.getAttribute("href");
                })});

                // lazy-load the hidden state of the preview widget from localstorage
                if (global.localStorage) {
                    var hidden = global.localStorage.getItem("hide_preview_" + this.props.mxEvent.getId());
                    this.setState({ widgetHidden: hidden });
                }
            }
        }
    },

    findLinks: function(nodes) {
        var links = [];
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.tagName === "A" && node.getAttribute("href"))
            {
                if (this.isLinkPreviewable(node)) {
                    links.push(node);
                }
            }
            else if (node.tagName === "PRE" || node.tagName === "CODE") {
                continue;
            }
            else if (node.children && node.children.length) {
                links = links.concat(this.findLinks(node.children));
            }
        }
        return links;
    },

    isLinkPreviewable: function(node) {
        // don't try to preview relative links
        if (!node.getAttribute("href").startsWith("http://") &&
            !node.getAttribute("href").startsWith("https://"))
        {
            return false;
        }

        // as a random heuristic to avoid highlighting things like "foo.pl"
        // we require the linked text to either include a / (either from http://
        // or from a full foo.bar/baz style schemeless URL) - or be a markdown-style
        // link, in which case we check the target text differs from the link value.
        // TODO: make this configurable?
        if (node.textContent.indexOf("/") > -1)
        {
            return node;
        }
        else {
            var url = node.getAttribute("href");
            var host = url.match(/^https?:\/\/(.*?)(\/|$)/)[1];
            if (node.textContent.toLowerCase().trim().startsWith(host.toLowerCase())) {
                // it's a "foo.pl" style link
                return;
            }
            else {
                // it's a [foo bar](http://foo.com) style link
                return node;
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
        const EmojiText = sdk.getComponent('elements.EmojiText');
        var mxEvent = this.props.mxEvent;
        var content = mxEvent.getContent();
        var body = HtmlUtils.bodyToHtml(content, this.props.highlights, {});

        if (this.props.highlightLink) {
            body = <a href={ this.props.highlightLink }>{ body }</a>;
        }

        var widgets;
        if (this.state.links.length && !this.state.widgetHidden && this.props.showUrlPreview) {
            var LinkPreviewWidget = sdk.getComponent('rooms.LinkPreviewWidget');
            widgets = this.state.links.map((link)=>{
                return <LinkPreviewWidget
                            key={ link }
                            link={ link }
                            mxEvent={ this.props.mxEvent }
                            onCancelClick={ this.onCancelClick }
                            onWidgetLoad={ this.props.onWidgetLoad }/>;
            });
        }

        switch (content.msgtype) {
            case "m.emote":
                const name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
                return (
                    <span ref="content" className="mx_MEmoteBody mx_EventTile_content">
                        * <EmojiText>{name}</EmojiText> { body }
                        { widgets }
                    </span>
                );
            case "m.notice":
                return (
                    <span ref="content" className="mx_MNoticeBody mx_EventTile_content">
                        { body }
                        { widgets }
                    </span>
                );
            default: // including "m.text"
                return (
                    <span ref="content" className="mx_MTextBody mx_EventTile_content">
                        { body }
                        { widgets }
                    </span>
                );
        }
    },
});

