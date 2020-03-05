/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';

export default createReactClass({
    displayName: 'TruncatedList',

    propTypes: {
        // The number of elements to show before truncating. If negative, no truncation is done.
        truncateAt: PropTypes.number,
        // The className to apply to the wrapping div
        className: PropTypes.string,
        // A function that returns the children to be rendered into the element.
        // function getChildren(start: number, end: number): Array<React.Node>
        // The start element is included, the end is not (as in `slice`).
        // If omitted, the React child elements will be used. This parameter can be used
        // to avoid creating unnecessary React elements.
        getChildren: PropTypes.func,
        // A function that should return the total number of child element available.
        // Required if getChildren is supplied.
        getChildCount: PropTypes.func,
        // A function which will be invoked when an overflow element is required.
        // This will be inserted after the children.
        createOverflowElement: PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            truncateAt: 2,
            createOverflowElement: function(overflowCount, totalCount) {
                return (
                    <div>{ _t("And %(count)s more...", {count: overflowCount}) }</div>
                );
            },
        };
    },

    _getChildren: function(start, end) {
        if (this.props.getChildren && this.props.getChildCount) {
            return this.props.getChildren(start, end);
        } else {
            // XXX: I'm not sure why anything would pass null into this, it seems
            // like a bizzare case to handle, but I'm preserving the behaviour.
            // (see commit 38d5c7d5c5d5a34dc16ef5d46278315f5c57f542)
            return React.Children.toArray(this.props.children).filter((c) => {
                return c != null;
            }).slice(start, end);
        }
    },

    _getChildCount: function() {
        if (this.props.getChildren && this.props.getChildCount) {
            return this.props.getChildCount();
        } else {
            return React.Children.toArray(this.props.children).filter((c) => {
                return c != null;
            }).length;
        }
    },

    render: function() {
        let overflowNode = null;

        const totalChildren = this._getChildCount();
        let upperBound = totalChildren;
        if (this.props.truncateAt >= 0) {
            const overflowCount = totalChildren - this.props.truncateAt;
            if (overflowCount > 1) {
                overflowNode = this.props.createOverflowElement(
                    overflowCount, totalChildren,
                );
                upperBound = this.props.truncateAt;
            }
        }
        const childNodes = this._getChildren(0, upperBound);

        return (
            <div className={this.props.className}>
                { childNodes }
                { overflowNode }
            </div>
        );
    },
});
