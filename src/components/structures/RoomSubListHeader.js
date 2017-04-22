/*
Copyright 2017 Vector Creations Ltd

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
var classNames = require('classnames');
var sdk = require('matrix-react-sdk')
var FormattingUtils = require('matrix-react-sdk/lib/utils/FormattingUtils');
var RoomNotifs = require('matrix-react-sdk/lib/RoomNotifs');
var AccessibleButton = require('matrix-react-sdk/lib/components/views/elements/AccessibleButton');
var ConstantTimeDispatcher = require('matrix-react-sdk/lib/ConstantTimeDispatcher');

module.exports = React.createClass({
    displayName: 'RoomSubListHeader',

    propTypes: {
        label: React.PropTypes.string.isRequired,
        tagName: React.PropTypes.string,
        roomCount: React.PropTypes.oneOfType([
            React.PropTypes.string,
            React.PropTypes.number
        ]),
        collapsed: React.PropTypes.bool.isRequired, // is LeftPanel collapsed?
        incomingCall: React.PropTypes.object,
        isIncomingCallRoom: React.PropTypes.bool,
        roomNotificationCount: React.PropTypes.array,
        hidden: React.PropTypes.bool,
        onClick: React.PropTypes.func,
        onHeaderClick: React.PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            onHeaderClick: function() {}, // NOP
        };
    },

    componentWillMount: function() {
        // constantTimeDispatcher.register("RoomSubList.refreshHeader", this.props.tagName, this.onRefresh);
    },

    componentWillUnmount: function() {
        // constantTimeDispatcher.unregister("RoomSubList.refreshHeader", this.props.tagName, this.onRefresh);
    },

    // onRefresh: function() {
    //     this.forceUpdate();
    // },

    render: function() {
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        var subListNotifications = this.props.roomNotificationCount;
        var subListNotifCount = subListNotifications[0];
        var subListNotifHighlight = subListNotifications[1];

        var chevronClasses = classNames({
            'mx_RoomSubList_chevron': true,
            'mx_RoomSubList_chevronRight': this.props.hidden,
            'mx_RoomSubList_chevronDown': !this.props.hidden,
        });

        var badgeClasses = classNames({
            'mx_RoomSubList_badge': true,
            'mx_RoomSubList_badgeHighlight': subListNotifHighlight,
        });

        var badge;
        if (subListNotifCount > 0) {
            badge = <div className={badgeClasses}>{ FormattingUtils.formatCount(subListNotifCount) }</div>;
        }
        else if (subListNotifHighlight) {
            badge = <div className={badgeClasses}>!</div>;   
        }

        // When collapsed, allow a long hover on the header to show user
        // the full tag name and room count
        var title;
        var roomCount = this.props.roomCount;
        if (this.props.collapsed) {
            title = this.props.label;
            if (roomCount !== '') {
                title += " [" + roomCount + "]";
            }
        }

        var incomingCall;
        if (this.props.isIncomingCallRoom) {
            var IncomingCallBox = sdk.getComponent("voip.IncomingCallBox");
            incomingCall = <IncomingCallBox className="mx_RoomSubList_incomingCall" incomingCall={ this.props.incomingCall }/>;
        }

        return (
            <div className="mx_RoomSubList_labelContainer" title={ title } ref="header">
                <AccessibleButton onClick={ this.props.onClick } className="mx_RoomSubList_label" tabIndex="0">
                    { this.props.collapsed ? '' : this.props.label }
                    <div className="mx_RoomSubList_roomCount">{ roomCount }</div>
                    <div className={chevronClasses}></div>
                    { badge }
                </AccessibleButton>
                { incomingCall }
            </div>
        );
    },
});

