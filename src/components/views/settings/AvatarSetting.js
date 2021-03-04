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

import React, {useState} from "react";
import PropTypes from "prop-types";
import {_t} from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import classNames from "classnames";

const AvatarSetting = ({avatarUrl, avatarAltText, avatarName, uploadAvatar, removeAvatar}) => {
    const [isHovering, setIsHovering] = useState(false);
    const hoveringProps = {
        onMouseEnter: () => setIsHovering(true),
        onMouseLeave: () => setIsHovering(false),
    };

    let avatarElement = <AccessibleButton
        element="div"
        onClick={uploadAvatar}
        className="mx_AvatarSetting_avatarPlaceholder"
        {...hoveringProps}
    />;
    if (avatarUrl) {
        avatarElement = (
            <AccessibleButton
                element="img"
                src={avatarUrl}
                alt={avatarAltText}
                aria-label={avatarAltText}
                onClick={uploadAvatar}
                {...hoveringProps}
            />
        );
    }

    let uploadAvatarBtn;
    if (uploadAvatar) {
        // insert an empty div to be the host for a css mask containing the upload.svg
        uploadAvatarBtn = <AccessibleButton
            onClick={uploadAvatar}
            className='mx_AvatarSetting_uploadButton'
            {...hoveringProps}
        />;
    }

    let removeAvatarBtn;
    if (avatarUrl && removeAvatar) {
        removeAvatarBtn = <AccessibleButton onClick={removeAvatar} kind="link_sm">
            {_t("Remove")}
        </AccessibleButton>;
    }

    const avatarClasses = classNames({
        "mx_AvatarSetting_avatar": true,
        "mx_AvatarSetting_avatar_hovering": isHovering && uploadAvatar,
    });
    return <div className={avatarClasses}>
        {avatarElement}
        <div className="mx_AvatarSetting_hover">
            <div className="mx_AvatarSetting_hoverBg" />
            <span>{_t("Upload")}</span>
        </div>
        {uploadAvatarBtn}
        {removeAvatarBtn}
    </div>;
};

AvatarSetting.propTypes = {
    avatarUrl: PropTypes.string,
    avatarName: PropTypes.string.isRequired, // name of user/room the avatar belongs to
    uploadAvatar: PropTypes.func,
    removeAvatar: PropTypes.func,
    avatarAltText: PropTypes.string.isRequired,
};

export default AvatarSetting;
