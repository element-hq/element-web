/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import Modal from "../../Modal";
import { _t } from "../../languageHandler";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import MainSplit from "./MainSplit";
import RightPanel from "./RightPanel";
import Spinner from "../views/elements/Spinner";
import ResizeNotifier from "../../utils/ResizeNotifier";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import { UserOnboardingPage } from "../views/user-onboarding/UserOnboardingPage";

interface IProps {
    userId: string;
    resizeNotifier: ResizeNotifier;
}

interface IState {
    loading: boolean;
    member?: RoomMember;
}

export default class UserView extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
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
        const cli = MatrixClientPeg.get();
        this.setState({ loading: true });
        let profileInfo: Awaited<ReturnType<MatrixClient["getProfileInfo"]>>;
        try {
            profileInfo = await cli.getProfileInfo(this.props.userId);
        } catch (err) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Could not load user profile"),
                description: err && err.message ? err.message : _t("Operation failed"),
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
                    overwriteCard={{ phase: RightPanelPhases.RoomMemberInfo, state: { member: this.state.member } }}
                    resizeNotifier={this.props.resizeNotifier}
                />
            );
            return (
                <MainSplit panel={panel} resizeNotifier={this.props.resizeNotifier}>
                    <UserOnboardingPage />
                </MainSplit>
            );
        } else {
            return <div />;
        }
    }
}
