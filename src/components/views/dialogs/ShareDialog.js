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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import {Room, User, Group, RoomMember, MatrixEvent} from 'matrix-js-sdk';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import QRCode from 'qrcode-react';
import {RoomPermalinkCreator, makeGroupPermalink, makeUserPermalink} from "../../../utils/permalinks/Permalinks";
import * as ContextMenu from "../../structures/ContextMenu";
import {toRightOf} from "../../structures/ContextMenu";

const socials = [
    {
        name: 'Facebook',
        img: require("../../../../res/img/social/facebook.png"),
        url: (url) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    }, {
        name: 'Twitter',
        img: require("../../../../res/img/social/twitter-2.png"),
        url: (url) => `https://twitter.com/home?status=${url}`,
    }, /* // icon missing
        name: 'Google Plus',
        img: 'img/social/',
        url: (url) => `https://plus.google.com/share?url=${url}`,
    },*/ {
        name: 'LinkedIn',
        img: require("../../../../res/img/social/linkedin.png"),
        url: (url) => `https://www.linkedin.com/shareArticle?mini=true&url=${url}`,
    }, {
        name: 'Reddit',
        img: require("../../../../res/img/social/reddit.png"),
        url: (url) => `http://www.reddit.com/submit?url=${url}`,
    }, {
        name: 'email',
        img: require("../../../../res/img/social/email-1.png"),
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
            PropTypes.instanceOf(MatrixEvent),
        ]).isRequired,
    };

    constructor(props) {
        super(props);

        this.onCopyClick = this.onCopyClick.bind(this);
        this.onLinkSpecificEventCheckboxClick = this.onLinkSpecificEventCheckboxClick.bind(this);

        this.state = {
            // MatrixEvent defaults to share linkSpecificEvent
            linkSpecificEvent: this.props.target instanceof MatrixEvent,
        };

        this._link = createRef();
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

        ShareDialog._selectText(this._link.current);

        let successful;
        try {
            successful = document.execCommand('copy');
        } catch (err) {
            console.error('Failed to copy: ', err);
        }

        const buttonRect = e.target.getBoundingClientRect();
        const GenericTextContextMenu = sdk.getComponent('context_menus.GenericTextContextMenu');
        const {close} = ContextMenu.createMenu(GenericTextContextMenu, {
            ...toRightOf(buttonRect, 2),
            message: successful ? _t('Copied!') : _t('Failed to copy'),
        });
        // Drop a reference to this close handler for componentWillUnmount
        this.closeCopiedTooltip = e.target.onmouseleave = close;
    }

    onLinkSpecificEventCheckboxClick() {
        this.setState({
            linkSpecificEvent: !this.state.linkSpecificEvent,
        });
    }

    componentWillMount() {
        if (this.props.target instanceof Room) {
            const permalinkCreator = new RoomPermalinkCreator(this.props.target);
            permalinkCreator.load();
            this.setState({permalinkCreator});
        }
    }

    componentWillUnmount() {
        // if the Copied tooltip is open then get rid of it, there are ways to close the modal which wouldn't close
        // the tooltip otherwise, such as pressing Escape or clicking X really quickly
        if (this.closeCopiedTooltip) this.closeCopiedTooltip();
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
                           id="mx_ShareDialog_checkbox"
                           checked={this.state.linkSpecificEvent}
                           onChange={this.onLinkSpecificEventCheckboxClick} />
                    <label htmlFor="mx_ShareDialog_checkbox">
                        { _t('Link to most recent message') }
                    </label>
                </div>;
            }

            if (this.state.linkSpecificEvent) {
                matrixToUrl = this.state.permalinkCreator.forEvent(events[events.length - 1].getId());
            } else {
                matrixToUrl = this.state.permalinkCreator.forRoom();
            }
        } else if (this.props.target instanceof User || this.props.target instanceof RoomMember) {
            title = _t('Share User');
            matrixToUrl = makeUserPermalink(this.props.target.userId);
        } else if (this.props.target instanceof Group) {
            title = _t('Share Community');
            matrixToUrl = makeGroupPermalink(this.props.target.groupId);
        } else if (this.props.target instanceof MatrixEvent) {
            title = _t('Share Room Message');
            checkbox = <div>
                <input type="checkbox"
                       id="mx_ShareDialog_checkbox"
                       checked={this.state.linkSpecificEvent}
                       onClick={this.onLinkSpecificEventCheckboxClick} />
                <label htmlFor="mx_ShareDialog_checkbox">
                    { _t('Link to selected message') }
                </label>
            </div>;

            if (this.state.linkSpecificEvent) {
                matrixToUrl = this.props.permalinkCreator.forEvent(this.props.target.getId());
            } else {
                matrixToUrl = this.props.permalinkCreator.forRoom();
            }
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
                    <a ref={this._link}
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
                    <div className="mx_ShareDialog_qrcode_container">
                        <QRCode value={matrixToUrl} size={256} logoWidth={48} logo={require("../../../../res/img/matrix-m.svg")} />
                    </div>
                    <div className="mx_ShareDialog_social_container">
                        {
                            socials.map((social) => <a rel="noreferrer noopener"
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
        </BaseDialog>;
    }
}
