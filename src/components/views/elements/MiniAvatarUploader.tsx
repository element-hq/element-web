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

import React, {useContext, useRef, useState} from 'react';
import {EventType} from 'matrix-js-sdk/src/@types/event';
import classNames from 'classnames';

import AccessibleButton from "./AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {useTimeout} from "../../../hooks/useTimeout";
import Analytics from "../../../Analytics";
import CountlyAnalytics from '../../../CountlyAnalytics';
import RoomContext from "../../../contexts/RoomContext";

export const AVATAR_SIZE = 52;

interface IProps {
    hasAvatar: boolean;
    noAvatarLabel?: string;
    hasAvatarLabel?: string;
    setAvatarUrl(url: string): Promise<void>;
}

const MiniAvatarUploader: React.FC<IProps> = ({ hasAvatar, hasAvatarLabel, noAvatarLabel, setAvatarUrl, children }) => {
    const cli = useContext(MatrixClientContext);
    const [busy, setBusy] = useState(false);
    const [hover, setHover] = useState(false);
    const [show, setShow] = useState(false);

    useTimeout(() => {
        setShow(true);
    }, 3000); // show after 3 seconds
    useTimeout(() => {
        setShow(false);
    }, 13000); // hide after being shown for 10 seconds

    const uploadRef = useRef<HTMLInputElement>();

    const label = (hasAvatar || busy) ? hasAvatarLabel : noAvatarLabel;

    const {room} = useContext(RoomContext);
    const canSetAvatar = room?.currentState.maySendStateEvent(EventType.RoomAvatar, cli.getUserId());
    if (!canSetAvatar) return <React.Fragment>{ children }</React.Fragment>;

    const visible = !!label && (hover || show);
    return <React.Fragment>
        <input
            type="file"
            ref={uploadRef}
            className="mx_MiniAvatarUploader_input"
            onChange={async (ev) => {
                if (!ev.target.files?.length) return;
                setBusy(true);
                Analytics.trackEvent("mini_avatar", "upload");
                CountlyAnalytics.instance.track("mini_avatar_upload");
                const file = ev.target.files[0];
                const uri = await cli.uploadContent(file);
                await setAvatarUrl(uri);
                setBusy(false);
            }}
            accept="image/*"
        />

        <AccessibleButton
            className={classNames("mx_MiniAvatarUploader", {
                mx_MiniAvatarUploader_busy: busy,
                mx_MiniAvatarUploader_hasAvatar: hasAvatar,
            })}
            disabled={busy}
            onClick={() => {
                uploadRef.current.click();
            }}
            onMouseOver={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            { children }

            <div className={classNames("mx_Tooltip", {
                "mx_Tooltip_visible": visible,
                "mx_Tooltip_invisible": !visible,
            })}>
                <div className="mx_Tooltip_chevron" />
                { label }
            </div>
        </AccessibleButton>
    </React.Fragment>;
};

export default MiniAvatarUploader;
