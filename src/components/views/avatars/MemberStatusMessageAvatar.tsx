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

import React, { createRef } from 'react';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { _t } from "../../../languageHandler";
import MemberAvatar from '../avatars/MemberAvatar';
import classNames from 'classnames';
import StatusMessageContextMenu from "../context_menus/StatusMessageContextMenu";
import SettingsStore from "../../../settings/SettingsStore";
import { ChevronFace, ContextMenu, ContextMenuButton } from "../../structures/ContextMenu";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { ResizeMethod } from "matrix-js-sdk/src/@types/partials";

interface IProps {
    member: RoomMember;
    width?: number;
    height?: number;
    resizeMethod?: ResizeMethod;
}

interface IState {
    hasStatus: boolean;
    menuDisplayed: boolean;
}

@replaceableComponent("views.avatars.MemberStatusMessageAvatar")
export default class MemberStatusMessageAvatar extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        width: 40,
        height: 40,
        resizeMethod: 'crop',
    };
    private button = createRef<HTMLDivElement>();

    constructor(props: IProps) {
        super(props);

        this.state = {
            hasStatus: this.hasStatus,
            menuDisplayed: false,
        };
    }

    public componentDidMount(): void {
        if (this.props.member.userId !== MatrixClientPeg.get().getUserId()) {
            throw new Error("Cannot use MemberStatusMessageAvatar on anyone but the logged in user");
        }
        if (!SettingsStore.getValue("feature_custom_status")) {
            return;
        }
        const { user } = this.props.member;
        if (!user) {
            return;
        }
        user.on("User._unstable_statusMessage", this.onStatusMessageCommitted);
    }

    public componentWillUnmount(): void {
        const { user } = this.props.member;
        if (!user) {
            return;
        }
        user.removeListener(
            "User._unstable_statusMessage",
            this.onStatusMessageCommitted,
        );
    }

    private get hasStatus(): boolean {
        const { user } = this.props.member;
        if (!user) {
            return false;
        }
        return !!user.unstable_statusMessage;
    }

    private onStatusMessageCommitted = (): void => {
        // The `User` object has observed a status message change.
        this.setState({
            hasStatus: this.hasStatus,
        });
    };

    private openMenu = (): void => {
        this.setState({ menuDisplayed: true });
    };

    private closeMenu = (): void => {
        this.setState({ menuDisplayed: false });
    };

    public render(): JSX.Element {
        const avatar = <MemberAvatar
            member={this.props.member}
            width={this.props.width}
            height={this.props.height}
            resizeMethod={this.props.resizeMethod}
        />;

        if (!SettingsStore.getValue("feature_custom_status")) {
            return avatar;
        }

        const classes = classNames({
            "mx_MemberStatusMessageAvatar": true,
            "mx_MemberStatusMessageAvatar_hasStatus": this.state.hasStatus,
        });

        let contextMenu;
        if (this.state.menuDisplayed) {
            const elementRect = this.button.current.getBoundingClientRect();

            const chevronWidth = 16; // See .mx_ContextualMenu_chevron_bottom
            const chevronMargin = 1; // Add some spacing away from target

            contextMenu = (
                <ContextMenu
                    chevronOffset={(elementRect.width - chevronWidth) / 2}
                    chevronFace={ChevronFace.Bottom}
                    left={elementRect.left + window.pageXOffset}
                    top={elementRect.top + window.pageYOffset - chevronMargin}
                    menuWidth={226}
                    onFinished={this.closeMenu}
                >
                    <StatusMessageContextMenu user={this.props.member.user} />
                </ContextMenu>
            );
        }

        return <React.Fragment>
            <ContextMenuButton
                className={classes}
                inputRef={this.button}
                onClick={this.openMenu}
                isExpanded={this.state.menuDisplayed}
                label={_t("User Status")}
            >
                { avatar }
            </ContextMenuButton>

            { contextMenu }
        </React.Fragment>;
    }
}
