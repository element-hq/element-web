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
var sanitizeHtml = require('sanitize-html');

var MNoticeTileController = require('matrix-react-sdk/lib/controllers/molecules/MNoticeTile')

var allowedAttributes = sanitizeHtml.defaults.allowedAttributes;
allowedAttributes['font'] = ['color'];
var sanitizeHtmlParams = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'font' ]),
    allowedAttributes: allowedAttributes,
};

module.exports = React.createClass({
    displayName: 'MNoticeTile',
    mixins: [MNoticeTileController],

    // FIXME: this entire class is copy-pasted from MTextTile :(        
    render: function() {
        var content = this.props.mxEvent.getContent();
        var originalBody = content.body;
        var body;

        if (this.props.searchTerm) {
            var lastOffset = 0;
            var bodyList = [];
            var k = 0;
            var offset;

            // XXX: rather than searching for the search term in the body,
            // we should be looking at the match delimiters returned by the FTS engine
            if (content.format === "org.matrix.custom.html") {
                var safeBody = sanitizeHtml(content.formatted_body, sanitizeHtmlParams);
                var safeSearchTerm = sanitizeHtml(this.props.searchTerm, sanitizeHtmlParams);
                while ((offset = safeBody.indexOf(safeSearchTerm, lastOffset)) >= 0) {
                    // FIXME: we need to apply the search highlighting to only the text elements of HTML, which means
                    // hooking into the sanitizer parser rather than treating it as a string.  Otherwise
                    // the act of highlighting a <b/> or whatever will break the HTML badly.
                    bodyList.push(<span key={ k++ } dangerouslySetInnerHTML={{ __html: safeBody.substring(lastOffset, offset) }} />);
                    bodyList.push(<span key={ k++ } dangerouslySetInnerHTML={{ __html: safeSearchTerm }} className="mx_MessageTile_searchHighlight" />);
                    lastOffset = offset + safeSearchTerm.length;
                }
                bodyList.push(<span key={ k++ } dangerouslySetInnerHTML={{ __html: safeBody.substring(lastOffset) }} />);
            }
            else {
                while ((offset = originalBody.indexOf(this.props.searchTerm, lastOffset)) >= 0) {
                    bodyList.push(<span key={ k++ } >{ originalBody.substring(lastOffset, offset) }</span>);
                    bodyList.push(<span key={ k++ } className="mx_MessageTile_searchHighlight">{ this.props.searchTerm }</span>);
                    lastOffset = offset + this.props.searchTerm.length;
                }
                bodyList.push(<span key={ k++ }>{ originalBody.substring(lastOffset) }</span>);
            }
            body = bodyList;
        }
        else {
            if (content.format === "org.matrix.custom.html") {
                var safeBody = sanitizeHtml(content.formatted_body, sanitizeHtmlParams);
                body = <span dangerouslySetInnerHTML={{ __html: safeBody }} />;
            }
            else {
                body = originalBody;
            }
        }

        return (
            <span ref="content" className="mx_MNoticeTile mx_MessageTile_content">
                { body }
            </span>
        );
    },
});

