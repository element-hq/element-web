/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { Room } from 'matrix-js-sdk/src/models/room';
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from '../../../languageHandler';
import Spinner from '../elements/Spinner';
import { mediaFromMxc } from "../../../customisations/Media";
import RoomAvatar from '../avatars/RoomAvatar';
import BaseAvatar from '../avatars/BaseAvatar';
import { chromeFileInputFix } from "../../../utils/BrowserWorkarounds";

interface IProps {
    initialAvatarUrl?: string;
    room?: Room;
    // if false, you need to call changeAvatar.onFileSelected yourself.
    showUploadSection?: boolean;
    width?: number;
    height?: number;
    className?: string;
}

interface IState {
    avatarUrl?: string;
    errorText?: string;
    phase?: Phases;
}

enum Phases {
    Display = "display",
    Uploading = "uploading",
    Error = "error",
}

export default class ChangeAvatar extends React.Component<IProps, IState> {
    public static defaultProps = {
        showUploadSection: true,
        className: "",
        width: 80,
        height: 80,
    };

    private avatarSet = false;

    constructor(props: IProps) {
        super(props);

        this.state = {
            avatarUrl: this.props.initialAvatarUrl,
            phase: Phases.Display,
        };
    }

    public componentDidMount(): void {
        MatrixClientPeg.get().on(RoomStateEvent.Events, this.onRoomStateEvents);
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    // eslint-disable-next-line
    public UNSAFE_componentWillReceiveProps(newProps: IProps): void {
        if (this.avatarSet) {
            // don't clobber what the user has just set
            return;
        }
        this.setState({
            avatarUrl: newProps.initialAvatarUrl,
        });
    }

    public componentWillUnmount(): void {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        }
    }

    private onRoomStateEvents = (ev: MatrixEvent) => {
        if (!this.props.room) {
            return;
        }

        if (ev.getRoomId() !== this.props.room.roomId ||
            ev.getType() !== EventType.RoomAvatar ||
            ev.getSender() !== MatrixClientPeg.get().getUserId()
        ) {
            return;
        }

        if (!ev.getContent().url) {
            this.avatarSet = false;
            this.setState({}); // force update
        }
    };

    private setAvatarFromFile(file: File): Promise<{}> {
        let newUrl = null;

        this.setState({
            phase: Phases.Uploading,
        });
        const httpPromise = MatrixClientPeg.get().uploadContent(file).then((url) => {
            newUrl = url;
            if (this.props.room) {
                return MatrixClientPeg.get().sendStateEvent(
                    this.props.room.roomId,
                    'm.room.avatar',
                    { url: url },
                    '',
                );
            } else {
                return MatrixClientPeg.get().setAvatarUrl(url);
            }
        });

        httpPromise.then(() => {
            this.setState({
                phase: Phases.Display,
                avatarUrl: mediaFromMxc(newUrl).srcHttp,
            });
        }, () => {
            this.setState({
                phase: Phases.Error,
            });
            this.onError();
        });

        return httpPromise;
    }

    private onFileSelected = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.avatarSet = true;
        return this.setAvatarFromFile(ev.target.files[0]);
    };

    private onError = (): void => {
        this.setState({
            errorText: _t("Failed to upload profile picture!"),
        });
    };

    public render(): JSX.Element {
        let avatarImg;
        // Having just set an avatar we just display that since it will take a little
        // time to propagate through to the RoomAvatar.
        if (this.props.room && !this.avatarSet) {
            avatarImg = <RoomAvatar
                room={this.props.room}
                width={this.props.width}
                height={this.props.height}
                resizeMethod='crop'
            />;
        } else {
            // XXX: FIXME: once we track in the JS what our own displayname is(!) then use it here rather than ?
            avatarImg = <BaseAvatar
                width={this.props.width}
                height={this.props.height}
                resizeMethod='crop'
                name='?'
                idName={MatrixClientPeg.get().getUserIdLocalpart()}
                url={this.state.avatarUrl}
            />;
        }

        let uploadSection;
        if (this.props.showUploadSection) {
            uploadSection = (
                <div className={this.props.className}>
                    { _t("Upload new:") }
                    <input type="file" accept="image/*" onClick={chromeFileInputFix} onChange={this.onFileSelected} />
                    { this.state.errorText }
                </div>
            );
        }

        switch (this.state.phase) {
            case Phases.Display:
            case Phases.Error:
                return (
                    <div>
                        <div className={this.props.className}>
                            { avatarImg }
                        </div>
                        { uploadSection }
                    </div>
                );
            case Phases.Uploading:
                return (
                    <Spinner />
                );
        }
    }
}
