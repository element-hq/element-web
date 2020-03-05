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
import React from "react";
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import Modal from '../../../Modal';
import * as sdk from "../../../index";
import * as Avatar from '../../../Avatar';
import {getHttpUriForMxc} from "matrix-js-sdk/src/content-repo";

export default createReactClass({
    displayName: 'RoomAvatar',

    // Room may be left unset here, but if it is,
    // oobData.avatarUrl should be set (else there
    // would be nowhere to get the avatar from)
    propTypes: {
        room: PropTypes.object,
        oobData: PropTypes.object,
        width: PropTypes.number,
        height: PropTypes.number,
        resizeMethod: PropTypes.string,
        viewAvatarOnClick: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            width: 36,
            height: 36,
            resizeMethod: 'crop',
            oobData: {},
        };
    },

    getInitialState: function() {
        return {
            urls: this.getImageUrls(this.props),
        };
    },

    componentDidMount: function() {
        MatrixClientPeg.get().on("RoomState.events", this.onRoomStateEvents);
    },

    componentWillUnmount: function() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomState.events", this.onRoomStateEvents);
        }
    },

    componentWillReceiveProps: function(newProps) {
        this.setState({
            urls: this.getImageUrls(newProps),
        });
    },

    onRoomStateEvents: function(ev) {
        if (!this.props.room ||
            ev.getRoomId() !== this.props.room.roomId ||
            ev.getType() !== 'm.room.avatar'
        ) return;

        this.setState({
            urls: this.getImageUrls(this.props),
        });
    },

    getImageUrls: function(props) {
        return [
            getHttpUriForMxc(
                MatrixClientPeg.get().getHomeserverUrl(),
                props.oobData.avatarUrl,
                Math.floor(props.width * window.devicePixelRatio),
                Math.floor(props.height * window.devicePixelRatio),
                props.resizeMethod,
            ), // highest priority
            this.getRoomAvatarUrl(props),
        ].filter(function(url) {
            return (url != null && url != "");
        });
    },

    getRoomAvatarUrl: function(props) {
        if (!props.room) return null;

        return Avatar.avatarUrlForRoom(
            props.room,
            Math.floor(props.width * window.devicePixelRatio),
            Math.floor(props.height * window.devicePixelRatio),
            props.resizeMethod,
        );
    },

    onRoomAvatarClick: function() {
        const avatarUrl = this.props.room.getAvatarUrl(
            MatrixClientPeg.get().getHomeserverUrl(),
            null, null, null, false);
        const ImageView = sdk.getComponent("elements.ImageView");
        const params = {
            src: avatarUrl,
            name: this.props.room.name,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
    },

    render: function() {
        const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");

        /*eslint no-unused-vars: ["error", { "ignoreRestSiblings": true }]*/
        const {room, oobData, viewAvatarOnClick, ...otherProps} = this.props;

        const roomName = room ? room.name : oobData.name;

        return (
            <BaseAvatar {...otherProps} name={roomName}
                idName={room ? room.roomId : null}
                urls={this.state.urls}
                onClick={this.props.viewAvatarOnClick ? this.onRoomAvatarClick : null}
                disabled={!this.state.urls[0]} />
        );
    },
});
