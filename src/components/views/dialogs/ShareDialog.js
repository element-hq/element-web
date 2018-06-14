/*
Copyright 2018 New Vector Ltd

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
import {Room, User, Group, RoomMember} from 'matrix-js-sdk';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import QRCode from 'qrcode-react';
import {makeEventPermalink, makeGroupPermalink, makeRoomPermalink, makeUserPermalink} from "../../../matrix-to";
import * as ContextualMenu from "../../structures/ContextualMenu";

const socials = [
    {
        name: 'Facebook',
        img: 'img/social/facebook.png',
        url: (url) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    }, {
        name: 'Twitter',
        img: 'img/social/twitter-2.png',
        url: (url) => `https://twitter.com/home?status=${url}`,
    }, /* // icon missing
        name: 'Google Plus',
        img: 'img/social/',
        url: (url) => `https://plus.google.com/share?url=${url}`,
    },*/ {
        name: 'LinkedIn',
        img: 'img/social/linkedin.png',
        url: (url) => `https://www.linkedin.com/shareArticle?mini=true&url=${url}`,
    }, {
        name: 'Reddit',
        img: 'img/social/reddit.png',
        url: (url) => `http://www.reddit.com/submit?url=${url}`,
    }, {
        name: 'email',
        img: 'img/social/email-1.png',
        url: (url) => `mailto:?body=${url}`,
    },
];

export default class ShareDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        target: PropTypes.oneOfType([
            PropTypes.instanceOf(Room),
            PropTypes.instanceOf(User),
            PropTypes.instanceOf(Group),
            PropTypes.instanceOf(RoomMember),
            // PropTypes.instanceOf(MatrixEvent),
        ]).isRequired,
    };

    constructor(props) {
        super(props);

        this.onCopyClick = this.onCopyClick.bind(this);
        this.onLinkRecentCheckboxClick = this.onLinkRecentCheckboxClick.bind(this);

        this.state = {
            linkRecentTicked: false,
        };
    }

    static _selectText(target) {
        const range = document.createRange();
        range.selectNodeContents(target);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    static onLinkClick(e) {
        e.preventDefault();
        const {target} = e;
        ShareDialog._selectText(target);
    }

    onCopyClick(e) {
        e.preventDefault();

        ShareDialog._selectText(this.refs.link);

        let successful;
        try {
            successful = document.execCommand('copy');
        } catch (err) {
            console.error('Failed to copy: ', err);
        }

        const GenericTextContextMenu = sdk.getComponent('context_menus.GenericTextContextMenu');
        const buttonRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = buttonRect.right + window.pageXOffset;
        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;
        const {close} = ContextualMenu.createMenu(GenericTextContextMenu, {
            chevronOffset: 10,
            left: x,
            top: y,
            message: successful ? _t('Copied!') : _t('Failed to copy'),
        }, false);
        e.target.onmouseleave = close;
    }

    onLinkRecentCheckboxClick() {
        this.setState({
            linkRecentTicked: !this.state.linkRecentTicked,
        });
    }

    render() {
        let title;
        let matrixToUrl;

        let checkbox;

        if (this.props.target instanceof Room) {
            title = _t('Share Room');

            const events = this.props.target.getLiveTimeline().getEvents();
            if (events.length > 0) {
                checkbox = <div>
                    <input type="checkbox"
                           value={this.state.linkRecentTicked}
                           id="mx_ShareDialog_checkbox"
                           onClick={this.onLinkRecentCheckboxClick} />
                    <label htmlFor="mx_ShareDialog_checkbox">
                        { _t('Link to most recent message') }
                    </label>
                </div>;
            }

            if (this.state.linkRecentTicked) {
                matrixToUrl = makeEventPermalink(this.props.target.roomId, events[events.length - 1].getId());
            } else {
                matrixToUrl = makeRoomPermalink(this.props.target.roomId);
            }
        } else if (this.props.target instanceof User || this.props.target instanceof RoomMember) {
            title = _t('Share User');
            matrixToUrl = makeUserPermalink(this.props.target.userId);
        } else if (this.props.target instanceof Group) {
            title = _t('Share Community');
            matrixToUrl = makeGroupPermalink(this.props.target.groupId);
        }

        const encodedUrl = encodeURIComponent(matrixToUrl);

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return <BaseDialog title={title}
                           className='mx_ShareDialog'
                           contentId='mx_Dialog_content'
                           onFinished={this.props.onFinished}
        >
            <div className="mx_ShareDialog_content">
                <div className="mx_ShareDialog_matrixto">
                    <a ref="link"
                       href={matrixToUrl}
                       onClick={ShareDialog.onLinkClick}
                       className="mx_ShareDialog_matrixto_link"
                    >
                        { matrixToUrl }
                    </a>
                    <a href={matrixToUrl} className="mx_ShareDialog_matrixto_copy" onClick={this.onCopyClick}>
                        { _t('COPY') }
                        <div>&nbsp;</div>
                    </a>
                </div>
                { checkbox }
                <hr />

                <div className="mx_ShareDialog_split">
                    <div className="mx_ShareDialog_left">
                        <h3>QR Code</h3>
                        <div className="mx_ShareDialog_qrcode_container">
                            <QRCode value={matrixToUrl} size={256} logoWidth={48} logo="img/matrix-m.svg" />
                        </div>
                    </div>
                    <div className="mx_ShareDialog_right">
                        <h3>Social</h3>
                        <div className="mx_ShareDialog_social_container">
                            {
                                socials.map((social) => <a rel="noopener"
                                                           target="_blank"
                                                           key={social.name}
                                                           name={social.name}
                                                           href={social.url(encodedUrl)}
                                                           className="mx_ShareDialog_social_icon"
                                >
                                    <img src={social.img} alt={social.name} height={64} width={64} />
                                </a>)
                            }
                        </div>
                    </div>
                </div>
            </div>
        </BaseDialog>;
    }
}
