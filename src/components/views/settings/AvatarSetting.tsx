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

import React, { ReactNode, createRef, useCallback, useEffect, useState } from "react";
import EditIcon from "@vector-im/compound-design-tokens/assets/web/icons/edit";
import UploadIcon from "@vector-im/compound-design-tokens/assets/web/icons/share";
import DeleteIcon from "@vector-im/compound-design-tokens/assets/web/icons/delete";
import { Menu, MenuItem } from "@vector-im/compound-web";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { mediaFromMxc } from "../../../customisations/Media";
import { chromeFileInputFix } from "../../../utils/BrowserWorkarounds";
import { useId } from "../../../utils/useId";
import AccessibleButton from "../elements/AccessibleButton";
import BaseAvatar from "../avatars/BaseAvatar";

interface MenuProps {
    trigger: ReactNode;
    onUploadSelect: () => void;
    onRemoveSelect?: () => void;
    menuOpen: boolean;
    onOpenChange: (newOpen: boolean) => void;
}

const AvatarSettingContextMenu: React.FC<MenuProps> = ({
    trigger,
    onUploadSelect,
    onRemoveSelect,
    menuOpen,
    onOpenChange,
}) => {
    return (
        <Menu
            trigger={trigger}
            title={_t("action|set_avatar")}
            showTitle={false}
            open={menuOpen}
            onOpenChange={onOpenChange}
        >
            <MenuItem
                as="div"
                Icon={<UploadIcon width="24px" height="24px" />}
                label={_t("action|upload_file")}
                onSelect={onUploadSelect}
            />
            {onRemoveSelect && (
                <MenuItem
                    as="div"
                    Icon={<DeleteIcon width="24px" height="24px" />}
                    className="mx_AvatarSetting_removeMenuItem"
                    label={_t("action|remove")}
                    onSelect={onRemoveSelect}
                />
            )}
        </Menu>
    );
};

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

    /**
     * String to use for computing the colour of the placeholder avatar if no avatar is set
     */
    placeholderId: string;

    /**
     * String to use for the placeholder display if no avatar is set
     */
    placeholderName: string;
}

/**
 * Component for setting or removing an avatar on something (eg. a user or a room)
 */
const AvatarSetting: React.FC<IProps> = ({
    avatar,
    avatarAltText,
    onChange,
    removeAvatar,
    disabled,
    placeholderId,
    placeholderName,
}) => {
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

    // Prevents ID collisions when this component is used more than once on the same page.
    const a11yId = useId();

    const onFileChanged = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) onChange?.(e.target.files[0]);
        },
        [onChange],
    );

    const uploadAvatar = useCallback((): void => {
        fileInputRef.current?.click();
    }, [fileInputRef]);

    const [menuOpen, setMenuOpen] = useState(false);

    const onOpenChange = useCallback((newOpen: boolean) => {
        setMenuOpen(newOpen);
    }, []);

    let avatarElement = (
        <AccessibleButton
            element="div"
            onClick={uploadAvatar}
            className="mx_AvatarSetting_avatarPlaceholder mx_AvatarSetting_avatarDisplay"
            aria-labelledby={disabled ? undefined : a11yId}
            // Inhibit tab stop as we have explicit upload/remove buttons
            tabIndex={-1}
            disabled={disabled}
        >
            <BaseAvatar idName={placeholderId} name={placeholderName} size="90px" />
        </AccessibleButton>
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
                disabled={disabled}
            />
        );
    }

    let uploadAvatarBtn: JSX.Element | undefined;
    if (!disabled) {
        const uploadButtonClasses = classNames("mx_AvatarSetting_uploadButton", {
            mx_AvatarSetting_uploadButton_active: menuOpen,
        });
        uploadAvatarBtn = (
            <div className={uploadButtonClasses}>
                <EditIcon width="20px" height="20px" />
            </div>
        );
    }

    const content = (
        <div className="mx_AvatarSetting_avatar" role="group" aria-label={avatarAltText}>
            {avatarElement}
            {uploadAvatarBtn}
        </div>
    );

    if (disabled) {
        return content;
    }

    return (
        <>
            <AvatarSettingContextMenu
                trigger={content}
                onUploadSelect={uploadAvatar}
                onRemoveSelect={removeAvatar}
                menuOpen={menuOpen}
                onOpenChange={onOpenChange}
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
};

export default AvatarSetting;
