/*
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

import React, { ChangeEvent, FormEvent } from 'react';
import BaseDialog from "./BaseDialog";
import { _t } from "../../../languageHandler";
import { IDialogProps } from "./IDialogProps";
import Field from "../elements/Field";
import AccessibleButton from "../elements/AccessibleButton";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { arrayFastClone } from "../../../utils/arrays";
import SdkConfig from "../../../SdkConfig";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import InviteDialog from "./InviteDialog";
import BaseAvatar from "../avatars/BaseAvatar";
import {getHttpUriForMxc} from "matrix-js-sdk/src/content-repo";
import {inviteMultipleToRoom, showAnyInviteErrors} from "../../../RoomInvite";
import StyledCheckbox from "../elements/StyledCheckbox";
import Modal from "../../../Modal";
import ErrorDialog from "./ErrorDialog";

interface IProps extends IDialogProps {
    roomId: string;
    communityName: string;
}

interface IPerson {
    userId: string;
    user: RoomMember;
    lastActive: number;
}

interface IState {
    emailTargets: string[];
    userTargets: string[];
    showPeople: boolean;
    people: IPerson[];
    numPeople: number;
    busy: boolean;
}

export default class CommunityPrototypeInviteDialog extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            emailTargets: [],
            userTargets: [],
            showPeople: false,
            people: this.buildSuggestions(),
            numPeople: 5, // arbitrary default
            busy: false,
        };
    }

    private buildSuggestions(): IPerson[] {
        const alreadyInvited = new Set([MatrixClientPeg.get().getUserId(), SdkConfig.get()['welcomeUserId']]);
        if (this.props.roomId) {
            const room = MatrixClientPeg.get().getRoom(this.props.roomId);
            if (!room) throw new Error("Room ID given to InviteDialog does not look like a room");
            room.getMembersWithMembership('invite').forEach(m => alreadyInvited.add(m.userId));
            room.getMembersWithMembership('join').forEach(m => alreadyInvited.add(m.userId));
            // add banned users, so we don't try to invite them
            room.getMembersWithMembership('ban').forEach(m => alreadyInvited.add(m.userId));
        }

        return InviteDialog.buildRecents(alreadyInvited);
    }

    private onSubmit = async (ev: FormEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        this.setState({busy: true});
        try {
            const targets = [...this.state.emailTargets, ...this.state.userTargets];
            const result = await inviteMultipleToRoom(this.props.roomId, targets);
            const room = MatrixClientPeg.get().getRoom(this.props.roomId);
            const success = showAnyInviteErrors(result.states, room, result.inviter);
            if (success) {
                this.props.onFinished(true);
            } else {
                this.setState({busy: false});
            }
        } catch (e) {
            this.setState({busy: false});
            console.error(e);
            Modal.createTrackedDialog('Failed to invite', '', ErrorDialog, {
                title: _t("Failed to invite"),
                description: ((e && e.message) ? e.message : _t("Operation failed")),
            });
        }
    };

    private onAddressChange = (ev: ChangeEvent<HTMLInputElement>, index: number) => {
        const targets = arrayFastClone(this.state.emailTargets);
        if (index >= targets.length) {
            targets.push(ev.target.value);
        } else {
            targets[index] = ev.target.value;
        }
        this.setState({emailTargets: targets});
    };

    private onAddressBlur = (index: number) => {
        const targets = arrayFastClone(this.state.emailTargets);
        if (index >= targets.length) return; // not important
        if (targets[index].trim() === "") {
            targets.splice(index, 1);
            this.setState({emailTargets: targets});
        }
    };

    private onShowPeopleClick = () => {
        this.setState({showPeople: !this.state.showPeople});
    };

    private setPersonToggle = (person: IPerson, selected: boolean) => {
        const targets = arrayFastClone(this.state.userTargets);
        if (selected && !targets.includes(person.userId)) {
            targets.push(person.userId);
        } else if (!selected && targets.includes(person.userId)) {
            targets.splice(targets.indexOf(person.userId), 1);
        }
        this.setState({userTargets: targets});
    };

    private renderPerson(person: IPerson, key: any) {
        const avatarSize = 36;
        return (
            <div className="mx_CommunityPrototypeInviteDialog_person" key={key}>
                <BaseAvatar
                    url={getHttpUriForMxc(
                        MatrixClientPeg.get().getHomeserverUrl(), person.user.getMxcAvatarUrl(),
                        avatarSize, avatarSize, "crop")}
                    name={person.user.name}
                    idName={person.user.userId}
                    width={avatarSize}
                    height={avatarSize}
                />
                <div className="mx_CommunityPrototypeInviteDialog_personIdentifiers">
                    <span className="mx_CommunityPrototypeInviteDialog_personName">{person.user.name}</span>
                    <span className="mx_CommunityPrototypeInviteDialog_personId">{person.userId}</span>
                </div>
                <StyledCheckbox onChange={(e) => this.setPersonToggle(person, e.target.checked)} />
            </div>
        );
    }

    private onShowMorePeople = () => {
        this.setState({numPeople: this.state.numPeople + 5}); // arbitrary increase
    };

    public render() {
        const emailAddresses = [];
        this.state.emailTargets.forEach((address, i) => {
            emailAddresses.push((
                <Field
                    key={i}
                    value={address}
                    onChange={(e) => this.onAddressChange(e, i)}
                    label={_t("Email address")}
                    placeholder={_t("Email address")}
                    onBlur={() => this.onAddressBlur(i)}
                />
            ));
        });

        // Push a clean input
        emailAddresses.push((
            <Field
                key={emailAddresses.length}
                value={""}
                onChange={(e) => this.onAddressChange(e, emailAddresses.length)}
                label={emailAddresses.length > 0 ? _t("Add another email") : _t("Email address")}
                placeholder={emailAddresses.length > 0 ? _t("Add another email") : _t("Email address")}
            />
        ));

        let peopleIntro = null;
        const people = [];
        if (this.state.showPeople) {
            const humansToPresent = this.state.people.slice(0, this.state.numPeople);
            humansToPresent.forEach((person, i) => {
                people.push(this.renderPerson(person, i));
            });
            if (humansToPresent.length < this.state.people.length) {
                people.push((
                    <AccessibleButton
                        onClick={this.onShowMorePeople}
                        kind="link" key="more"
                        className="mx_CommunityPrototypeInviteDialog_morePeople"
                    >{_t("Show more")}</AccessibleButton>
                ));
            }
        }
        if (this.state.people.length > 0) {
            peopleIntro = (
                <div className="mx_CommunityPrototypeInviteDialog_people">
                    <span>{_t("People you know on %(brand)s", {brand: SdkConfig.get().brand})}</span>
                    <AccessibleButton onClick={this.onShowPeopleClick}>
                        {this.state.showPeople ? _t("Hide") : _t("Show")}
                    </AccessibleButton>
                </div>
            );
        }

        let buttonText = _t("Skip");
        const targetCount = this.state.userTargets.length + this.state.emailTargets.length;
        if (targetCount > 0) {
            buttonText = _t("Send %(count)s invites", {count: targetCount});
        }

        return (
            <BaseDialog
                className="mx_CommunityPrototypeInviteDialog"
                onFinished={this.props.onFinished}
                title={_t("Invite people to join %(communityName)s", {communityName: this.props.communityName})}
            >
                <form onSubmit={this.onSubmit}>
                    <div className="mx_Dialog_content">
                        {emailAddresses}
                        {peopleIntro}
                        {people}
                        <AccessibleButton
                            kind="primary" onClick={this.onSubmit}
                            disabled={this.state.busy}
                            className="mx_CommunityPrototypeInviteDialog_primaryButton"
                        >{buttonText}</AccessibleButton>
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
