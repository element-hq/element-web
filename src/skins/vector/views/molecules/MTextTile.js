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

var MTextTileController = require('matrix-react-sdk/lib/controllers/molecules/MTextTile')

var allowedAttributes = sanitizeHtml.defaults.allowedAttributes;
allowedAttributes['font'] = ['color'];
var sanitizeHtmlParams = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'font' ]),
    allowedAttributes: allowedAttributes,
};

module.exports = React.createClass({
    displayName: 'MTextTile',
    mixins: [MTextTileController],

    render: function() {
        var content = this.props.mxEvent.getContent();
        var body = content.body;

        if (content.format === "org.matrix.custom.html") {
            body = sanitizeHtml(content.formatted_body, sanitizeHtmlParams);
        }

        if (this.props.searchTerm) {
            var lastOffset = 0;
            var bodyList = [];
            var k = 0;
            var offset;
            // XXX: this probably doesn't handle stemming very well.
            while ((offset = body.indexOf(this.props.searchTerm, lastOffset)) >= 0) {
                if (content.format === "org.matrix.custom.html") {
                    // FIXME: we need to apply the search highlighting to only the text elements of HTML, which means
                    // hooking into the sanitizer parser rather than treating it as a string.  Otherwise
                    // the act of highlighting a <b/> or whatever will break the HTML badly.
                    bodyList.push(<span key={ k++ } dangerouslySetInnerHTML={{ __html: body.substring(lastOffset, offset) }} />);
                    bodyList.push(<span key={ k++ } dangerouslySetInnerHTML={{ __html: this.props.searchTerm }} className="mx_MessageTile_searchHighlight" />);
                }
                else {
                    bodyList.push(<span key={ k++ } >{ body.substring(lastOffset, offset) }</span>);
                    bodyList.push(<span key={ k++ } className="mx_MessageTile_searchHighlight">{ this.props.searchTerm }</span>);
                }
                lastOffset = offset + this.props.searchTerm.length;
            }
            if (content.format === "org.matrix.custom.html") {
                bodyList.push(<span key={ k++ } dangerouslySetInnerHTML={{ __html: body.substring(lastOffset) }} />);
            }
            else {
                bodyList.push(<span key={ k++ }>{ body.substring(lastOffset) }</span>);
            }
            body = bodyList;
        }
        else {
            if (content.format === "org.matrix.custom.html") {
                body = <span dangerouslySetInnerHTML={{ __html: body }} />;
            }
        }

        return (
            <span ref="content" className="mx_MTextTile mx_MessageTile_content">
                { body }
            </span>
        );
    },
});

