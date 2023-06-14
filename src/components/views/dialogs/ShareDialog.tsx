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

import * as React from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { User } from "matrix-js-sdk/src/models/user";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { _t } from "../../../languageHandler";
import QRCode from "../elements/QRCode";
import { RoomPermalinkCreator, makeUserPermalink } from "../../../utils/permalinks/Permalinks";
import { selectText } from "../../../utils/strings";
import StyledCheckbox from "../elements/StyledCheckbox";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import BaseDialog from "./BaseDialog";
import CopyableText from "../elements/CopyableText";
import { XOR } from "../../../@types/common";

const socials = [
    {
        name: "Facebook",
        img: require("../../../../res/img/social/facebook.png"),
        url: (url: String) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    },
    {
        name: "Twitter",
        img: require("../../../../res/img/social/twitter-2.png"),
        url: (url: string) => `https://twitter.com/home?status=${url}`,
    },
    /* // icon missing
        name: 'Google Plus',
        img: 'img/social/',
        url: (url) => `https://plus.google.com/share?url=${url}`,
    },*/ {
        name: "LinkedIn",
        img: require("../../../../res/img/social/linkedin.png"),
        url: (url: string) => `https://www.linkedin.com/shareArticle?mini=true&url=${url}`,
    },
    {
        name: "Reddit",
        img: require("../../../../res/img/social/reddit.png"),
        url: (url: string) => `https://www.reddit.com/submit?url=${url}`,
    },
    {
        name: "email",
        img: require("../../../../res/img/social/email-1.png"),
        url: (url: string) => `mailto:?body=${url}`,
    },
];

interface BaseProps {
    onFinished(): void;
}

interface Props extends BaseProps {
    target: Room | User | RoomMember;
    permalinkCreator?: RoomPermalinkCreator;
}

interface EventProps extends BaseProps {
    target: MatrixEvent;
    permalinkCreator: RoomPermalinkCreator;
}

interface IState {
    linkSpecificEvent: boolean;
    permalinkCreator: RoomPermalinkCreator | null;
}

export default class ShareDialog extends React.PureComponent<XOR<Props, EventProps>, IState> {
    public constructor(props: XOR<Props, EventProps>) {
        super(props);

        let permalinkCreator: RoomPermalinkCreator | null = null;
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

    public static onLinkClick(e: React.MouseEvent): void {
        e.preventDefault();
        selectText(e.currentTarget);
    }

    private onLinkSpecificEventCheckboxClick = (): void => {
        this.setState({
            linkSpecificEvent: !this.state.linkSpecificEvent,
        });
    };

    private getUrl(): string {
        if (this.props.target instanceof Room) {
            if (this.state.linkSpecificEvent) {
                const events = this.props.target.getLiveTimeline().getEvents();
                return this.state.permalinkCreator!.forEvent(events[events.length - 1].getId()!);
            } else {
                return this.state.permalinkCreator!.forShareableRoom();
            }
        } else if (this.props.target instanceof User || this.props.target instanceof RoomMember) {
            return makeUserPermalink(this.props.target.userId);
        } else if (this.state.linkSpecificEvent) {
            return this.props.permalinkCreator!.forEvent(this.props.target.getId()!);
        } else {
            return this.props.permalinkCreator!.forShareableRoom();
        }
    }

    public render(): React.ReactNode {
        let title: string | undefined;
        let checkbox: JSX.Element | undefined;

        if (this.props.target instanceof Room) {
            title = _t("Share Room");

            const events = this.props.target.getLiveTimeline().getEvents();
            if (events.length > 0) {
                checkbox = (
                    <div>
                        <StyledCheckbox
                            checked={this.state.linkSpecificEvent}
                            onChange={this.onLinkSpecificEventCheckboxClick}
                        >
                            {_t("Link to most recent message")}
                        </StyledCheckbox>
                    </div>
                );
            }
        } else if (this.props.target instanceof User || this.props.target instanceof RoomMember) {
            title = _t("Share User");
        } else if (this.props.target instanceof MatrixEvent) {
            title = _t("Share Room Message");
            checkbox = (
                <div>
                    <StyledCheckbox
                        checked={this.state.linkSpecificEvent}
                        onChange={this.onLinkSpecificEventCheckboxClick}
                    >
                        {_t("Link to selected message")}
                    </StyledCheckbox>
                </div>
            );
        }

        const matrixToUrl = this.getUrl();
        const encodedUrl = encodeURIComponent(matrixToUrl);

        const showQrCode = SettingsStore.getValue(UIFeature.ShareQRCode);
        const showSocials = SettingsStore.getValue(UIFeature.ShareSocial);

        let qrSocialSection;
        if (showQrCode || showSocials) {
            qrSocialSection = (
                <>
                    <hr />
                    <div className="mx_ShareDialog_split">
                        {showQrCode && (
                            <div className="mx_ShareDialog_qrcode_container">
                                <QRCode data={matrixToUrl} width={256} />
                            </div>
                        )}
                        {showSocials && (
                            <div className="mx_ShareDialog_social_container">
                                {socials.map((social) => (
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
                                ))}
                            </div>
                        )}
                    </div>
                </>
            );
        }

        return (
            <BaseDialog
                title={title}
                className="mx_ShareDialog"
                contentId="mx_Dialog_content"
                onFinished={this.props.onFinished}
            >
                <div className="mx_ShareDialog_content">
                    <CopyableText getTextToCopy={() => matrixToUrl}>
                        <a title={_t("Link to room")} href={matrixToUrl} onClick={ShareDialog.onLinkClick}>
                            {matrixToUrl}
                        </a>
                    </CopyableText>
                    {checkbox}
                    {qrSocialSection}
                </div>
            </BaseDialog>
        );
    }
}
