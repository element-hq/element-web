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

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var sdk = require('../../../index');

var Velociraptor = require('../../../Velociraptor');
require('../../../VelocityBounce');

var bounce = false;
try {
    if (global.localStorage) {
        bounce = global.localStorage.getItem('avatar_bounce') == 'true';
    }
} catch (e) {
}

module.exports = React.createClass({
    displayName: 'ReadReceiptMarker',

    propTypes: {
        // the RoomMember to show the RR for
        member: React.PropTypes.object.isRequired,

        // number of pixels to offset the avatar from the right of its parent;
        // typically a negative value.
        leftOffset: React.PropTypes.number,

        // true to hide the avatar (it will still be animated)
        hidden: React.PropTypes.bool,

        // don't animate this RR into position
        suppressAnimation: React.PropTypes.bool,

        // an opaque object for storing information about this user's RR in
        // this room
        readReceiptInfo: React.PropTypes.object,

        // A function which is used to check if the parent panel is being
        // unmounted, to avoid unnecessary work. Should return true if we
        // are being unmounted.
        checkUnmounting: React.PropTypes.func,

        // callback for clicks on this RR
        onClick: React.PropTypes.func,

        // Timestamp when the receipt was read
        timestamp: React.PropTypes.number,

        // True to show the full date/time rather than just the time
        showFullTimestamp: React.PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            leftOffset: 0,
        };
    },

    getInitialState: function() {
        // if we are going to animate the RR, we don't show it on first render,
        // and instead just add a placeholder to the DOM; once we've been
        // mounted, we start an animation which moves the RR from its old
        // position.
        return {
            suppressDisplay: !this.props.suppressAnimation,
        };
    },

    componentWillUnmount: function() {
        // before we remove the rr, store its location in the map, so that if
        // it reappears, it can be animated from the right place.
        var rrInfo = this.props.readReceiptInfo;
        if (!rrInfo) {
            return;
        }

        // checking the DOM properties can force a re-layout, which can be
        // quite expensive; so if the parent messagepanel is being unmounted,
        // then don't bother with this.
        if (this.props.checkUnmounting && this.props.checkUnmounting()) {
            return;
        }

        var avatarNode = ReactDOM.findDOMNode(this);
        rrInfo.top = avatarNode.offsetTop;
        rrInfo.left = avatarNode.offsetLeft;
        rrInfo.parent = avatarNode.offsetParent;
    },

    componentDidMount: function() {
        if (!this.state.suppressDisplay) {
            // we've already done our display - nothing more to do.
            return;
        }

        // treat new RRs as though they were off the top of the screen
        var oldTop = -15;

        var oldInfo = this.props.readReceiptInfo;
        if (oldInfo && oldInfo.parent) {
            oldTop = oldInfo.top + oldInfo.parent.getBoundingClientRect().top;
        }

        var newElement = ReactDOM.findDOMNode(this);
        var startTopOffset = oldTop - newElement.offsetParent.getBoundingClientRect().top;

        var startStyles = [];
        var enterTransitionOpts = [];

        if (oldInfo && oldInfo.left) {
            // start at the old height and in the old h pos

            var leftOffset = oldInfo.left;
            startStyles.push({ top: startTopOffset+"px",
                               left: oldInfo.left+"px" });

            var reorderTransitionOpts = {
                duration: 100,
                easing: 'easeOut'
            };

            enterTransitionOpts.push(reorderTransitionOpts);
        }

        // then shift to the rightmost column,
        // and then it will drop down to its resting position
        startStyles.push({ top: startTopOffset+'px', left: '0px' });
        enterTransitionOpts.push({
            duration: bounce ? Math.min(Math.log(Math.abs(startTopOffset)) * 200, 3000) : 300,
            easing: bounce ? 'easeOutBounce' : 'easeOutCubic',
        });

        this.setState({
            suppressDisplay: false,
            startStyles: startStyles,
            enterTransitionOpts: enterTransitionOpts,
        });
    },


    render: function() {
        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        if (this.state.suppressDisplay) {
            return <div/>;
        }

        var style = {
            left: this.props.leftOffset+'px',
            top: '0px',
            visibility: this.props.hidden ? 'hidden' : 'visible',
        };

        let title;
        if (this.props.timestamp) {
            let suffix = " (" + this.props.member.userId + ")";
            let ts = new Date(this.props.timestamp);
            if (this.props.showFullTimestamp) {
                // "15/12/2016, 7:05:45 PM (@alice:matrix.org)"
                title = ts.toLocaleString() + suffix;
            }
            else {
                // "7:05:45 PM (@alice:matrix.org)"
                title = ts.toLocaleTimeString() + suffix;
            }
        }

        return (
            <Velociraptor
                    startStyles={this.state.startStyles}
                    enterTransitionOpts={this.state.enterTransitionOpts} >
                <MemberAvatar
                    member={this.props.member}
                    aria-hidden="true"
                    width={14} height={14} resizeMethod="crop"
                    style={style}
                    title={title}
                    onClick={this.props.onClick}
                />
            </Velociraptor>
        );
    },
});
