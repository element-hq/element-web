/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import Field from "../elements/Field";
import { chromeFileInputFix } from "../../../utils/BrowserWorkarounds";

interface IProps {
    avatarUrl?: string;
    avatarDisabled?: boolean;
    name: string;
    nameDisabled?: boolean;
    topic?: string;
    topicDisabled?: boolean;
    setAvatar(avatar?: File): void;
    setName(name: string): void;
    setTopic(topic: string): void;
}

export const SpaceAvatar: React.FC<Pick<IProps, "avatarUrl" | "avatarDisabled" | "setAvatar">> = ({
    avatarUrl,
    avatarDisabled = false,
    setAvatar,
}) => {
    const avatarUploadRef = useRef<HTMLInputElement>(null);
    const [avatar, setAvatarDataUrl] = useState(avatarUrl); // avatar data url cache

    let avatarSection;
    if (avatarDisabled) {
        if (avatar) {
            avatarSection = <img className="mx_SpaceBasicSettings_avatar" src={avatar} alt="" />;
        } else {
            avatarSection = <div className="mx_SpaceBasicSettings_avatar" />;
        }
    } else {
        if (avatar) {
            avatarSection = (
                <React.Fragment>
                    <AccessibleButton
                        className="mx_SpaceBasicSettings_avatar"
                        onClick={() => avatarUploadRef.current?.click()}
                        element="img"
                        src={avatar}
                        alt=""
                    />
                    <AccessibleButton
                        onClick={() => {
                            if (avatarUploadRef.current) avatarUploadRef.current.value = "";
                            setAvatarDataUrl(undefined);
                            setAvatar(undefined);
                        }}
                        kind="link"
                        className="mx_SpaceBasicSettings_avatar_remove"
                        aria-label={_t("room_settings|delete_avatar_label")}
                    >
                        {_t("action|delete")}
                    </AccessibleButton>
                </React.Fragment>
            );
        } else {
            avatarSection = (
                <React.Fragment>
                    <AccessibleButton
                        className="mx_SpaceBasicSettings_avatar"
                        onClick={() => avatarUploadRef.current?.click()}
                    />
                    <AccessibleButton
                        onClick={() => avatarUploadRef.current?.click()}
                        kind="link"
                        aria-label={_t("room_settings|upload_avatar_label")}
                    >
                        {_t("action|upload")}
                    </AccessibleButton>
                </React.Fragment>
            );
        }
    }

    return (
        <div className="mx_SpaceBasicSettings_avatarContainer">
            {avatarSection}
            <input
                type="file"
                ref={avatarUploadRef}
                onClick={chromeFileInputFix}
                onChange={(e) => {
                    if (!e.target.files?.length) return;
                    const file = e.target.files[0];
                    setAvatar(file);
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        setAvatarDataUrl(ev.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                }}
                accept="image/*"
            />
        </div>
    );
};

const SpaceBasicSettings: React.FC<IProps> = ({
    avatarUrl,
    avatarDisabled = false,
    setAvatar,
    name = "",
    nameDisabled = false,
    setName,
    topic = "",
    topicDisabled = false,
    setTopic,
}) => {
    return (
        <div className="mx_SpaceBasicSettings">
            <SpaceAvatar avatarUrl={avatarUrl} avatarDisabled={avatarDisabled} setAvatar={setAvatar} />

            <Field
                name="spaceName"
                label={_t("common|name")}
                autoFocus={true}
                value={name}
                onChange={(ev: ChangeEvent<HTMLInputElement>) => setName(ev.target.value)}
                disabled={nameDisabled}
            />

            <Field
                name="spaceTopic"
                element="textarea"
                label={_t("common|description")}
                value={topic}
                onChange={(ev: ChangeEvent<HTMLTextAreaElement>) => setTopic(ev.target.value)}
                rows={3}
                disabled={topicDisabled}
            />
        </div>
    );
};

export default SpaceBasicSettings;
