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
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

var RoomAvatarController = require('matrix-react-sdk/lib/controllers/atoms/RoomAvatar')

module.exports = React.createClass({
    displayName: 'RoomAvatar',
    mixins: [RoomAvatarController],

    getUrlList: function() {
        return [
            this.roomAvatarUrl(),
            this.getOneToOneAvatar(),
            this.getFallbackAvatar()
        ];
    },

    getFallbackAvatar: function() {
        var images = [ '76cfa6', '50e2c2', 'f4c371' ];
        var total = 0;
        for (var i = 0; i < this.props.room.roomId.length; ++i) {
            total += this.props.room.roomId.charCodeAt(i);
        }
        return 'img/' + images[total % images.length] + '.png';
    },

    render: function() {
        return (
            <img className="mx_RoomAvatar" src={this.state.imageUrl} onError={this.onError}
                width={this.props.width} height={this.props.height}
            />
        );
    }
});
