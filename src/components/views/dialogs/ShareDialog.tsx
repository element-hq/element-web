/*
Copyright 2018 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as React from 'react';
import * as PropTypes from 'prop-types';
import {Room} from "matrix-js-sdk/src/models/room";
import {User} from "matrix-js-sdk/src/models/user";
import {Group} from "matrix-js-sdk/src/models/group";
import {RoomMember} from "matrix-js-sdk/src/models/room-member";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import QRCode from "../elements/QRCode";
import {RoomPermalinkCreator, makeGroupPermalink, makeUserPermalink} from "../../../utils/permalinks/Permalinks";
import * as ContextMenu from "../../structures/ContextMenu";
import {toRightOf} from "../../structures/ContextMenu";
import {copyPlaintext, selectText} from "../../../utils/strings";
import StyledCheckbox from '../elements/StyledCheckbox';
import AccessibleTooltipButton from '../elements/AccessibleTooltipButton';
import { IDialogProps } from "./IDialogProps";

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

interface IProps extends IDialogProps {
    target: Room | User | Group | RoomMember | MatrixEvent;
    permalinkCreator: RoomPermalinkCreator;
}

interface IState {
    linkSpecificEvent: boolean;
    permalinkCreator: RoomPermalinkCreator;
}

export default class ShareDialog extends React.PureComponent<IProps, IState> {
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

    protected closeCopiedTooltip: () => void;

    constructor(props) {
        super(props);

        this.onCopyClick = this.onCopyClick.bind(this);
        this.onLinkSpecificEventCheckboxClick = this.onLinkSpecificEventCheckboxClick.bind(this);

        let permalinkCreator: RoomPermalinkCreator = null;
        if (props.target instanceof Room) {
            permalinkCreator = new RoomPermalinkCreator(props.target);
            permalinkCreator.load();
        }

        this.state = {
            // MatrixEvent defaults to share linkSpecificEvent
            linkSpecificEvent: this.props.target instanceof MatrixEvent,
            permalinkCreator,
        };
    }

    static onLinkClick(e) {
        e.preventDefault();
        selectText(e.target);
    }

    async onCopyClick(e) {
        e.preventDefault();
        const target = e.target; // copy target before we go async and React throws it away

        const successful = await copyPlaintext(this.getUrl());
        const buttonRect = target.getBoundingClientRect();
        const GenericTextContextMenu = sdk.getComponent('context_menus.GenericTextContextMenu');
        const {close} = ContextMenu.createMenu(GenericTextContextMenu, {
            ...toRightOf(buttonRect, 2),
            message: successful ? _t('Copied!') : _t('Failed to copy'),
        });
        // Drop a reference to this close handler for componentWillUnmount
        this.closeCopiedTooltip = target.onmouseleave = close;
    }

    onLinkSpecificEventCheckboxClick() {
        this.setState({
            linkSpecificEvent: !this.state.linkSpecificEvent,
        });
    }

    componentWillUnmount() {
        // if the Copied tooltip is open then get rid of it, there are ways to close the modal which wouldn't close
        // the tooltip otherwise, such as pressing Escape or clicking X really quickly
        if (this.closeCopiedTooltip) this.closeCopiedTooltip();
    }

    getUrl() {
        let matrixToUrl;

        if (this.props.target instanceof Room) {
            if (this.state.linkSpecificEvent) {
                const events = this.props.target.getLiveTimeline().getEvents();
                matrixToUrl = this.state.permalinkCreator.forEvent(events[events.length - 1].getId());
            } else {
                matrixToUrl = this.state.permalinkCreator.forRoom();
            }
        } else if (this.props.target instanceof User || this.props.target instanceof RoomMember) {
            matrixToUrl = makeUserPermalink(this.props.target.userId);
        } else if (this.props.target instanceof Group) {
            matrixToUrl = makeGroupPermalink(this.props.target.groupId);
        } else if (this.props.target instanceof MatrixEvent) {
            if (this.state.linkSpecificEvent) {
                matrixToUrl = this.props.permalinkCreator.forEvent(this.props.target.getId());
            } else {
                matrixToUrl = this.props.permalinkCreator.forRoom();
            }
        }
        return matrixToUrl;
    }

    render() {
        let title;
        let checkbox;

        if (this.props.target instanceof Room) {
            title = _t('Share Room');

            const events = this.props.target.getLiveTimeline().getEvents();
            if (events.length > 0) {
                checkbox = <div>
                    <StyledCheckbox
                        checked={this.state.linkSpecificEvent}
                        onChange={this.onLinkSpecificEventCheckboxClick}
                    >
                        { _t('Link to most recent message') }
                    </StyledCheckbox>
                </div>;
            }
        } else if (this.props.target instanceof User || this.props.target instanceof RoomMember) {
            title = _t('Share User');
        } else if (this.props.target instanceof Group) {
            title = _t('Share Community');
        } else if (this.props.target instanceof MatrixEvent) {
            title = _t('Share Room Message');
            checkbox = <div>
                <StyledCheckbox
                    checked={this.state.linkSpecificEvent}
                    onClick={this.onLinkSpecificEventCheckboxClick}
                >
                    { _t('Link to selected message') }
                </StyledCheckbox>
            </div>;
        }

        const matrixToUrl = this.getUrl();
        const encodedUrl = encodeURIComponent(matrixToUrl);

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return <BaseDialog
            title={title}
            className='mx_ShareDialog'
            contentId='mx_Dialog_content'
            onFinished={this.props.onFinished}
        >
            <div className="mx_ShareDialog_content">
                <div className="mx_ShareDialog_matrixto">
                    <a
                        href={matrixToUrl}
                        onClick={ShareDialog.onLinkClick}
                        className="mx_ShareDialog_matrixto_link"
                    >
                        { matrixToUrl }
                    </a>
                    <AccessibleTooltipButton
                        title={_t("Copy")}
                        onClick={this.onCopyClick}
                        className="mx_ShareDialog_matrixto_copy"
                    />
                </div>
                { checkbox }
                <hr />

                <div className="mx_ShareDialog_split">
                    <div className="mx_ShareDialog_qrcode_container">
                        <QRCode data={matrixToUrl} width={256} />
                    </div>
                    <div className="mx_ShareDialog_social_container">
                        { socials.map((social) => (
                            <a
                                rel="noreferrer noopener"
                                target="_blank"
                                key={social.name}
                                title={social.name}
                                href={social.url(encodedUrl)}
                                className="mx_ShareDialog_social_icon"
                            >
                                <img src={social.img} alt={social.name} height={64} width={64} />
                            </a>
                        )) }
                    </div>
                </div>
            </div>
        </BaseDialog>;
    }
}
