/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { MatrixEvent, RoomMember, type MatrixClient } from "matrix-js-sdk/src/matrix";

import Modal from "../../Modal";
import { _t } from "../../languageHandler";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import MainSplit from "./MainSplit";
import RightPanel from "./RightPanel";
import Spinner from "../views/elements/Spinner";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import HomePage from "./HomePage.tsx";
import MatrixClientContext from "../../contexts/MatrixClientContext";

interface IProps {
    userId: string;
    resizeNotifier: ResizeNotifier;
}

interface IState {
    loading: boolean;
    member?: RoomMember;
}

export default class UserView extends React.Component<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);
        this.state = {
            loading: true,
        };
    }

    public componentDidMount(): void {
        if (this.props.userId) {
            this.loadProfileInfo();
        }
    }

    public componentDidUpdate(prevProps: IProps): void {
        // XXX: We shouldn't need to null check the userId here, but we declare
        // it as optional and MatrixChat sometimes fires in a way which results
        // in an NPE when we try to update the profile info.
        if (prevProps.userId !== this.props.userId && this.props.userId) {
            this.loadProfileInfo();
        }
    }

    private async loadProfileInfo(): Promise<void> {
        this.setState({ loading: true });
        let profileInfo: Awaited<ReturnType<MatrixClient["getProfileInfo"]>>;
        try {
            profileInfo = await this.context.getProfileInfo(this.props.userId);
        } catch (err) {
            Modal.createDialog(ErrorDialog, {
                title: _t("error_dialog|error_loading_user_profile"),
                description: err instanceof Error ? err.message : _t("invite|failed_generic"),
            });
            this.setState({ loading: false });
            return;
        }
        const fakeEvent = new MatrixEvent({ type: "m.room.member", content: profileInfo });
        // We pass an empty string room ID here, this is slight abuse of the class to simplify code
        const member = new RoomMember("", this.props.userId);
        member.setMembershipEvent(fakeEvent);
        this.setState({ member, loading: false });
    }

    public render(): React.ReactNode {
        if (this.state.loading) {
            return <Spinner />;
        } else if (this.state.member) {
            const panel = (
                <RightPanel
                    overwriteCard={{ phase: RightPanelPhases.MemberInfo, state: { member: this.state.member } }}
                    resizeNotifier={this.props.resizeNotifier}
                />
            );
            return (
                <MainSplit
                    panel={panel}
                    resizeNotifier={this.props.resizeNotifier}
                    defaultSize={420}
                    analyticsRoomType="user_profile"
                >
                    <HomePage />
                </MainSplit>
            );
        } else {
            return <div />;
        }
    }
}
