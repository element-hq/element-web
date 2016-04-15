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
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');

module.exports = React.createClass({
    displayName: 'SearchBox',

    render: function() {
        var TintableSvg = sdk.getComponent('elements.TintableSvg');
        var EditableText = sdk.getComponent("elements.EditableText");

        var toggleCollapse;
        if (this.props.collapsed) {
            toggleCollapse = <img className="mx_SearchBox_maximise" src="img/maximise.svg" width="10" height="16" alt="&lt;"/>;
        }
        else {
            toggleCollapse = <img className="mx_SearchBox_minimise" src="img/minimise.svg" width="10" height="16" alt="&lt;"/>;
        }

        return (
            <div className="mx_SearchBox">
                <TintableSvg
                    className="mx_SearchBox_searchButton"
                    src="img/search.svg" width="21" height="19"
                />
                <EditableText
                    className="mx_SearchBox_search"
                    placeholderClassName="mx_SearchBox_searchPlaceholder"
                    blurToCancel={ false }
                    editable={ true }
                    placeholder="Search Vector"
                />
                { toggleCollapse }
            </div>
        );
    }
});
