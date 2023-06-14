/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, { useRef, useState } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";

interface IProps {
    avatarUrl?: string;
    avatarName: string; // name of user/room the avatar belongs to
    uploadAvatar?: (e: ButtonEvent) => void;
    removeAvatar?: (e: ButtonEvent) => void;
    avatarAltText: string;
}

const AvatarSetting: React.FC<IProps> = ({ avatarUrl, avatarAltText, avatarName, uploadAvatar, removeAvatar }) => {
    const [isHovering, setIsHovering] = useState(false);
    const hoveringProps = {
        onMouseEnter: () => setIsHovering(true),
        onMouseLeave: () => setIsHovering(false),
    };
    // TODO: Use useId() as soon as we're using React 18.
    // Prevents ID collisions when this component is used more than once on the same page.
    const a11yId = useRef(`hover-text-${Math.random()}`);

    let avatarElement = (
        <AccessibleButton
            element="div"
            onClick={uploadAvatar ?? null}
            className="mx_AvatarSetting_avatarPlaceholder"
            aria-labelledby={uploadAvatar ? a11yId.current : undefined}
            // Inhibit tab stop as we have explicit upload/remove buttons
            tabIndex={-1}
            {...hoveringProps}
        />
    );
    if (avatarUrl) {
        avatarElement = (
            <AccessibleButton
                element="img"
                src={avatarUrl}
                alt={avatarAltText}
                onClick={uploadAvatar ?? null}
                // Inhibit tab stop as we have explicit upload/remove buttons
                tabIndex={-1}
                {...hoveringProps}
            />
        );
    }

    let uploadAvatarBtn: JSX.Element | undefined;
    if (uploadAvatar) {
        // insert an empty div to be the host for a css mask containing the upload.svg
        uploadAvatarBtn = (
            <AccessibleButton
                onClick={uploadAvatar}
                className="mx_AvatarSetting_uploadButton"
                aria-labelledby={a11yId.current}
                {...hoveringProps}
            />
        );
    }

    let removeAvatarBtn: JSX.Element | undefined;
    if (avatarUrl && removeAvatar) {
        removeAvatarBtn = (
            <AccessibleButton onClick={removeAvatar} kind="link_sm">
                {_t("Remove")}
            </AccessibleButton>
        );
    }

    const avatarClasses = classNames({
        mx_AvatarSetting_avatar: true,
        mx_AvatarSetting_avatar_hovering: isHovering && uploadAvatar,
    });
    return (
        <div className={avatarClasses} role="group" aria-label={avatarAltText}>
            {avatarElement}
            <div className="mx_AvatarSetting_hover" aria-hidden="true">
                <div className="mx_AvatarSetting_hoverBg" />
                {uploadAvatar && <span id={a11yId.current}>{_t("Upload")}</span>}
            </div>
            {uploadAvatarBtn}
            {removeAvatarBtn}
        </div>
    );
};

export default AvatarSetting;
