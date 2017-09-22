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
import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'TruncatedList',

    propTypes: {
        // The number of elements to show before truncating. If negative, no truncation is done.
        truncateAt: PropTypes.number,
        // The className to apply to the wrapping div
        className: PropTypes.string,
        // A function which will be invoked when an overflow element is required.
        // This will be inserted after the children.
        createOverflowElement: PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            truncateAt: 2,
            createOverflowElement: function(overflowCount, totalCount) {
                return (
                    <div>{_t("And %(count)s more...", {count: overflowCount})}</div>
                );
            },
        };
    },

    render: function() {
        let childsJsx = this.props.children;
        let overflowJsx;
        const childArray = React.Children.toArray(this.props.children).filter((c) => {
            return c != null;
        });

        const childCount = childArray.length;

        if (this.props.truncateAt >= 0) {
            const overflowCount = childCount - this.props.truncateAt;

            if (overflowCount > 1) {
                overflowJsx = this.props.createOverflowElement(
                    overflowCount, childCount,
                );

                // cut out the overflow elements
                childArray.splice(childCount - overflowCount, overflowCount);
                childsJsx = childArray; // use what is left
            }
        }

        return (
            <div className={this.props.className}>
                {childsJsx}
                {overflowJsx}
            </div>
        );
    },
});
