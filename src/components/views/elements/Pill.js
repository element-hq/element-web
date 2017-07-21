
import React from 'react';
import sdk from '../../../index';
import classNames from 'classnames';
import { Room, RoomMember } from 'matrix-js-sdk';
import PropTypes from 'prop-types';
import MatrixClientPeg from '../../../MatrixClientPeg';
import { MATRIXTO_URL_PATTERN } from '../../../linkify-matrix';
import { getDisplayAliasForRoom } from '../../../Rooms';

const REGEX_MATRIXTO = new RegExp(MATRIXTO_URL_PATTERN);
const REGEX_LOCAL_MATRIXTO = /^#\/(?:user|room)\/(([\#\!\@\+]).*)$/;

export default React.createClass({
    statics: {
        isPillUrl: (url) => {
            return !!REGEX_MATRIXTO.exec(url);
        },
        isMessagePillUrl: (url) => {
            return !!REGEX_LOCAL_MATRIXTO.exec(url);
        },
    },

    props: {
        // The URL to pillify (no validation is done, see isPillUrl and isMessagePillUrl)
        url: PropTypes.string,
        // Whether the pill is in a message
        inMessage: PropTypes.bool,
        // The room in which this pill is being rendered
        room: PropTypes.instanceOf(Room),
    },

    render: function() {
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        const RoomAvatar = sdk.getComponent('avatars.RoomAvatar');

        let regex = REGEX_MATRIXTO;
        if (this.props.inMessage) {
            regex = REGEX_LOCAL_MATRIXTO;
        }

        // Default to the empty array if no match for simplicity
        // resource and prefix will be undefined instead of throwing
        const matrixToMatch = regex.exec(this.props.url) || [];
        console.info(matrixToMatch);

        const resource = matrixToMatch[1]; // The room/user ID
        const prefix = matrixToMatch[2]; // The first character of prefix

        // Default to the room/user ID
        let linkText = resource;

        const isUserPill = prefix === '@';
        const isRoomPill = prefix === '#' || prefix === '!';

        let avatar = null;
        let userId;
        if (isUserPill) {
            // If this user is not a member of this room, default to the empty
            // member. This could be improved by doing an async profile lookup.
            const member = this.props.room.getMember(resource) ||
                new RoomMember(null, resource);
            if (member) {
                userId = member.userId;
                linkText = member.name;
                avatar = <MemberAvatar member={member} width={16} height={16}/>;
            }
        } else if (isRoomPill) {
            const room = prefix === '#' ?
                MatrixClientPeg.get().getRooms().find((r) => {
                    return r.getAliases().includes(resource);
                }) : MatrixClientPeg.get().getRoom(resource);

            if (room) {
                linkText = (room ? getDisplayAliasForRoom(room) : null) || resource;
                avatar = <RoomAvatar room={room} width={16} height={16}/>;
            }
        }

        const classes = classNames({
            "mx_UserPill": isUserPill,
            "mx_RoomPill": isRoomPill,
            "mx_UserPill_me": userId === MatrixClientPeg.get().credentials.userId,
        });

        if ((isUserPill || isRoomPill) && avatar) {
            return this.props.inMessage ?
                <a className={classes} href={this.props.url}>
                    {avatar}
                    {linkText}
                </a> :
                <span className={classes}>
                    {avatar}
                    {linkText}
                </span>;
        } else {
            // Deliberately render nothing if the URL isn't recognised
            return null;
        }
    },
});
