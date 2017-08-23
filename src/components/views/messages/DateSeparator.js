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

import React from 'react';
import DateUtils from 'matrix-react-sdk/lib/DateUtils';
import { Sticky } from 'react-sticky';

module.exports = React.createClass({
    displayName: 'DateSeparator',
    render: function() {
        const date = new Date(this.props.ts);
        const label = DateUtils.formatDateSeparator(date);
        return (
            <Sticky relative={true} disableCompensation={true}>
                {({style, isSticky, wasSticky, distanceFromTop}) => {
                    return (
                        <div className={"mx_DateSeparator_container mx_DateSeparator_container" + (isSticky ? '_sticky' : '')}
                            style={{top: isSticky ? -distanceFromTop + "px" : 0}}
                        >
                            <h2 className="mx_DateSeparator">{ label }</h2>
                        </div>
                    );
                }}
            </Sticky>
        );
    },
});
