/*
Copyright 2019, 2024 The Matrix.org Foundation C.I.C.

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

import React, { createRef, useCallback, useEffect, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import { mediaFromMxc } from "../../../customisations/Media";
import { chromeFileInputFix } from "../../../utils/BrowserWorkarounds";

interface IProps {
    /**
     * The current value of the avatar URL, as an mxc URL or a File.
     * Generally, an mxc URL would be specified until the user selects a file, then
     * the file supplied by the onChange callback would be supplied here until it's
     * saved.
     */
    avatar?: string | File;

    /**
     * If true, the user cannot change the avatar
     */
    disabled?: boolean;

    /**
     * Called when the user has selected a new avatar
     * The callback is passed a File object for the new avatar data
     */
    onChange?: (f: File) => void;

    /**
     * Called when the user wishes to remove the avatar
     */
    removeAvatar?: () => void;

    /**
     * The alt text for the avatar
     */
    avatarAltText: string;
}

/**
 * Component for setting or removing an avatar on something (eg. a user or a room)
 */
const AvatarSetting: React.FC<IProps> = ({ avatar, avatarAltText, onChange, removeAvatar, disabled }) => {
    const fileInputRef = createRef<HTMLInputElement>();

    // Real URL that we can supply to the img element, either a data URL or whatever mediaFromMxc gives
    // This represents whatever avatar the user has chosen at the time
    const [avatarURL, setAvatarURL] = useState<string | undefined>(undefined);
    useEffect(() => {
        if (avatar instanceof File) {
            const reader = new FileReader();
            reader.onload = () => {
                setAvatarURL(reader.result as string);
            };
            reader.readAsDataURL(avatar);
        } else if (avatar) {
            setAvatarURL(mediaFromMxc(avatar).getSquareThumbnailHttp(96) ?? undefined);
        } else {
            setAvatarURL(undefined);
        }
    }, [avatar]);

    // TODO: Use useId() as soon as we're using React 18.
    // Prevents ID collisions when this component is used more than once on the same page.
    const a11yId = useRef(`hover-text-${Math.random()}`);

    const onFileChanged = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) onChange?.(e.target.files[0]);
        },
        [onChange],
    );

    const uploadAvatar = useCallback((): void => {
        fileInputRef.current?.click();
    }, [fileInputRef]);

    let avatarElement = (
        <AccessibleButton
            element="div"
            onClick={uploadAvatar}
            className="mx_AvatarSetting_avatarPlaceholder mx_AvatarSetting_avatarDisplay"
            aria-labelledby={disabled ? undefined : a11yId.current}
            // Inhibit tab stop as we have explicit upload/remove buttons
            tabIndex={-1}
        />
    );
    if (avatarURL) {
        avatarElement = (
            <AccessibleButton
                element="img"
                className="mx_AvatarSetting_avatarDisplay"
                src={avatarURL}
                alt={avatarAltText}
                onClick={uploadAvatar}
                // Inhibit tab stop as we have explicit upload/remove buttons
                tabIndex={-1}
            />
        );
    }

    let uploadAvatarBtn: JSX.Element | undefined;
    if (uploadAvatar) {
        // insert an empty div to be the host for a css mask containing the upload.svg
        uploadAvatarBtn = (
            <>
                <AccessibleButton
                    onClick={uploadAvatar}
                    className="mx_AvatarSetting_uploadButton"
                    aria-labelledby={a11yId.current}
                />
                <input
                    type="file"
                    style={{ display: "none" }}
                    ref={fileInputRef}
                    onClick={chromeFileInputFix}
                    onChange={onFileChanged}
                    accept="image/*"
                    alt={_t("action|upload")}
                />
            </>
        );
    }

    let removeAvatarBtn: JSX.Element | undefined;
    if (avatarURL && removeAvatar && !disabled) {
        removeAvatarBtn = (
            <AccessibleButton onClick={removeAvatar} kind="link_sm">
                {_t("action|remove")}
            </AccessibleButton>
        );
    }

    return (
        <div className="mx_AvatarSetting_avatar" role="group" aria-label={avatarAltText}>
            {avatarElement}
            <div className="mx_AvatarSetting_hover" aria-hidden="true">
                <div className="mx_AvatarSetting_hoverBg" />
                {!disabled && <span id={a11yId.current}>{_t("action|upload")}</span>}
            </div>
            {uploadAvatarBtn}
            {removeAvatarBtn}
        </div>
    );
};

export default AvatarSetting;
