/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import { EventType } from "matrix-js-sdk/src/matrix";
import React, { useContext, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Tooltip } from "@vector-im/compound-web";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useTimeout } from "../../../hooks/useTimeout";
import { chromeFileInputFix } from "../../../utils/BrowserWorkarounds";
import AccessibleButton from "./AccessibleButton";
import Spinner from "./Spinner";
import { getFileChanged } from "../settings/AvatarSetting.tsx";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";

export const AVATAR_SIZE = "52px";

interface IProps {
    hasAvatar: boolean;
    noAvatarLabel?: string;
    hasAvatarLabel?: string;
    setAvatarUrl(url: string): Promise<unknown>;
    isUserAvatar?: boolean;
    onClick?(ev: MouseEvent<HTMLInputElement>): void;
    children?: ReactNode;
}

const MiniAvatarUploader: React.FC<IProps> = ({
    hasAvatar,
    hasAvatarLabel,
    noAvatarLabel,
    setAvatarUrl,
    isUserAvatar,
    children,
    onClick,
}) => {
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

    const uploadRef = useRef<HTMLInputElement>(null);

    const label = hasAvatar || busy ? hasAvatarLabel : noAvatarLabel;

    const { room } = useScopedRoomContext("room");
    const canSetAvatar =
        isUserAvatar || room?.currentState?.maySendStateEvent(EventType.RoomAvatar, cli.getSafeUserId());
    if (!canSetAvatar) return <React.Fragment>{children}</React.Fragment>;

    const visible = !!label && (hover || show);
    return (
        <React.Fragment>
            <input
                type="file"
                ref={uploadRef}
                className="mx_MiniAvatarUploader_input"
                onClick={(ev) => {
                    chromeFileInputFix(ev);
                    onClick?.(ev);
                }}
                onChange={async (ev): Promise<void> => {
                    setBusy(true);
                    const file = getFileChanged(ev);
                    if (file) {
                        const { content_uri: uri } = await cli.uploadContent(file);
                        await setAvatarUrl(uri);
                    }
                    setBusy(false);
                }}
                accept="image/*"
            />

            <Tooltip label={label!} open={visible} onOpenChange={setHover}>
                <AccessibleButton
                    className={classNames("mx_MiniAvatarUploader", {
                        mx_MiniAvatarUploader_busy: busy,
                        mx_MiniAvatarUploader_hasAvatar: hasAvatar,
                    })}
                    disabled={busy}
                    onClick={() => {
                        uploadRef.current?.click();
                    }}
                >
                    {children}

                    <div className="mx_MiniAvatarUploader_indicator">
                        {busy ? <Spinner w={20} h={20} /> : <div className="mx_MiniAvatarUploader_cameraIcon" />}
                    </div>
                </AccessibleButton>
            </Tooltip>
        </React.Fragment>
    );
};

export default MiniAvatarUploader;
