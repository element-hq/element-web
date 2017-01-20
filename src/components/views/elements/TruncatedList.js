/*
Copyright 2016 OpenMarket Ltd

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
var React = require('react');

module.exports = React.createClass({
    displayName: 'TruncatedList',

    propTypes: {
        // The number of elements to show before truncating. If negative, no truncation is done.
        truncateAt: React.PropTypes.number,
        // The className to apply to the wrapping div
        className: React.PropTypes.string,
        // A function which will be invoked when an overflow element is required.
        // This will be inserted after the children.
        createOverflowElement: React.PropTypes.func
    },

    getDefaultProps: function() {
        return {
            truncateAt: 2,
            createOverflowElement: function(overflowCount, totalCount) {
                return (
                    <div>And {overflowCount} more...</div>
                );
            }
        };
    },

    render: function() {
        var childsJsx = this.props.children;
        var overflowJsx;
        var childArray = React.Children.toArray(this.props.children).filter((c) => {
            return c != null;
        });

        var childCount = childArray.length;

        if (this.props.truncateAt >= 0) {
            var overflowCount = childCount - this.props.truncateAt;

            if (overflowCount > 1) {
                overflowJsx = this.props.createOverflowElement(
                    overflowCount, childCount
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
    }
});
