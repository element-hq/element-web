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
var React = require('react');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var Avatar = require('../../../Avatar');

module.exports = React.createClass({
    displayName: 'RoomAvatar',

    getDefaultProps: function() {
        return {
            width: 36,
            height: 36,
            resizeMethod: 'crop'
        }
    },

    getInitialState: function() {
        this._update();
        return {
            imageUrl: this._nextUrl()
        };
    },

    componentWillReceiveProps: function(nextProps) {
        this.refreshImageUrl();
    },

    refreshImageUrl: function(nextProps) {
        // If the list has changed, we start from scratch and re-check, but
        // don't do so unless the list has changed or we'd re-try fetching
        // images each time we re-rendered
        var newList = this.getUrlList();
        var differs = false;
        for (var i = 0; i < newList.length && i < this.urlList.length; ++i) {
            if (this.urlList[i] != newList[i]) differs = true;
        }
        if (this.urlList.length != newList.length) differs = true;

        if (differs) {
            this._update();
            this.setState({
                imageUrl: this._nextUrl()
            });
        }
    },

    _update: function() {
        this.urlList = this.getUrlList();
        this.urlListIndex = -1;
    },

    _nextUrl: function() {
        do {
            ++this.urlListIndex;
        } while (
            this.urlList[this.urlListIndex] === null &&
            this.urlListIndex < this.urlList.length
        );
        if (this.urlListIndex < this.urlList.length) {
            return this.urlList[this.urlListIndex];
        } else {
            return null;
        }
    },

    // provided to the view class for convenience
    roomAvatarUrl: function() {
        var url = this.props.room.getAvatarUrl(
            MatrixClientPeg.get().getHomeserverUrl(),
            this.props.width, this.props.height, this.props.resizeMethod,
            false
        );
        return url;
    },

    // provided to the view class for convenience
    getOneToOneAvatar: function() {
        var userIds = Object.keys(this.props.room.currentState.members);

        if (userIds.length == 2) {
            var theOtherGuy = null;
            if (this.props.room.currentState.members[userIds[0]].userId == MatrixClientPeg.get().credentials.userId) {
                theOtherGuy = this.props.room.currentState.members[userIds[1]];
            } else {
                theOtherGuy = this.props.room.currentState.members[userIds[0]];
            }
            return theOtherGuy.getAvatarUrl(
                MatrixClientPeg.get().getHomeserverUrl(),
                this.props.width, this.props.height, this.props.resizeMethod,
                false
            );
        } else if (userIds.length == 1) {
            return this.props.room.currentState.members[userIds[0]].getAvatarUrl(
                MatrixClientPeg.get().getHomeserverUrl(),
                this.props.width, this.props.height, this.props.resizeMethod,
                    false
            );
        } else {
           return null;
        }
    },


    onError: function(ev) {
        this.setState({
            imageUrl: this._nextUrl()
        });
    },



    ////////////


    getUrlList: function() {
        return [
            this.roomAvatarUrl(),
            this.getOneToOneAvatar(),
            this.getFallbackAvatar()
        ];
    },

    getFallbackAvatar: function() {
        return Avatar.defaultAvatarUrlForString(this.props.room.roomId);
    },

    render: function() {
        var style = {
            width: this.props.width,
            height: this.props.height,
        };

        // XXX: recalculates fallback avatar constantly
        if (this.state.imageUrl === this.getFallbackAvatar()) {
            var initial;
            if (this.props.room.name[0])
                initial = this.props.room.name[0].toUpperCase();
            if ((initial === '@' || initial === '#') && this.props.room.name[1])
                initial = this.props.room.name[1].toUpperCase();
         
            return (
                <span>
                    <span className="mx_RoomAvatar_initial" aria-hidden="true"
                          style={{ fontSize: (this.props.width * 0.65) + "px",
                                   width: this.props.width + "px",
                                   lineHeight: this.props.height + "px" }}>{ initial }</span>
                    <img className="mx_RoomAvatar" src={this.state.imageUrl}
                            onError={this.onError} style={style} />
                </span>
            );
        }
        else {
            return <img className="mx_RoomAvatar" src={this.state.imageUrl}
                        onError={this.onError} style={style} />
        }
    }
});
