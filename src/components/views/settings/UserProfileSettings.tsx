/*
Copyright 2019 - 2024 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { EditInPlace, Alert } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import AvatarSetting from "./AvatarSetting";
import PosthogTrackers from "../../../PosthogTrackers";
import { formatBytes } from "../../../utils/FormattingUtils";
import { useToastContext } from "../../../contexts/ToastContext";
import InlineSpinner from "../elements/InlineSpinner";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import { useId } from "../../../utils/useId";
import CopyableText from "../elements/CopyableText";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

const SpinnerToast: React.FC = ({ children }) => (
    <>
        <InlineSpinner />
        {children}
    </>
);

interface UsernameBoxProps {
    username: string;
}

const UsernameBox: React.FC<UsernameBoxProps> = ({ username }) => {
    const labelId = useId();
    return (
        <div className="mx_UserProfileSettings_profile_controls_userId">
            <div className="mx_UserProfileSettings_profile_controls_userId_label" id={labelId}>
                {_t("settings|general|username")}
            </div>
            <CopyableText getTextToCopy={() => username} aria-labelledby={labelId}>
                {username}
            </CopyableText>
        </div>
    );
};

/**
 * A group of settings views to allow the user to set their profile information.
 */
const UserProfileSettings: React.FC = () => {
    const [avatarURL, setAvatarURL] = useState(OwnProfileStore.instance.avatarMxc);
    const [displayName, setDisplayName] = useState(OwnProfileStore.instance.displayName ?? "");
    const [initialDisplayName, setInitialDisplayName] = useState(OwnProfileStore.instance.displayName ?? "");
    const [avatarError, setAvatarError] = useState<boolean>(false);
    const [maxUploadSize, setMaxUploadSize] = useState<number | undefined>();
    const [displayNameError, setDisplayNameError] = useState<boolean>(false);

    const toastRack = useToastContext();

    const client = useMatrixClientContext();

    useEffect(() => {
        (async () => {
            try {
                const mediaConfig = await client.getMediaConfig();
                setMaxUploadSize(mediaConfig["m.upload.size"]);
            } catch (e) {
                logger.warn("Failed to get media config", e);
            }
        })();
    }, [client]);

    const onAvatarRemove = useCallback(async () => {
        const removeToast = toastRack.displayToast(
            <SpinnerToast>{_t("settings|general|avatar_remove_progress")}</SpinnerToast>,
        );
        try {
            await client.setAvatarUrl(""); // use empty string as Synapse 500s on undefined
            setAvatarURL("");
        } finally {
            removeToast();
        }
    }, [toastRack, client]);

    const onAvatarChange = useCallback(
        async (avatarFile: File) => {
            PosthogTrackers.trackInteraction("WebProfileSettingsAvatarUploadButton");
            logger.log(
                `Uploading new avatar, ${avatarFile.name} of type ${avatarFile.type}, (${avatarFile.size}) bytes`,
            );
            const removeToast = toastRack.displayToast(
                <SpinnerToast>{_t("settings|general|avatar_save_progress")}</SpinnerToast>,
            );
            try {
                setAvatarError(false);
                const { content_uri: uri } = await client.uploadContent(avatarFile);
                await client.setAvatarUrl(uri);
                setAvatarURL(uri);
            } catch (e) {
                setAvatarError(true);
            } finally {
                removeToast();
            }
        },
        [toastRack, client],
    );

    const onDisplayNameChanged = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setDisplayName(e.target.value);
    }, []);

    const onDisplayNameCancel = useCallback(() => {
        setDisplayName(OwnProfileStore.instance.displayName ?? "");
    }, []);

    const onDisplayNameSave = useCallback(async (): Promise<void> => {
        try {
            setDisplayNameError(false);
            await client.setDisplayName(displayName);
            setInitialDisplayName(displayName);
        } catch (e) {
            setDisplayNameError(true);
        }
    }, [displayName, client]);

    const userIdentifier = useMemo(
        () =>
            UserIdentifierCustomisations.getDisplayUserIdentifier(client.getSafeUserId(), {
                withDisplayName: true,
            }),
        [client],
    );

    return (
        <div className="mx_UserProfileSettings">
            <h2>{_t("common|profile")}</h2>
            <div>{_t("settings|general|profile_subtitle")}</div>
            <div className="mx_UserProfileSettings_profile">
                <AvatarSetting
                    avatar={avatarURL ?? undefined}
                    avatarAltText={_t("common|user_avatar")}
                    onChange={onAvatarChange}
                    removeAvatar={avatarURL ? onAvatarRemove : undefined}
                    placeholderName={displayName}
                    placeholderId={client.getUserId() ?? ""}
                />
                <EditInPlace
                    className="mx_UserProfileSettings_profile_displayName"
                    label={_t("settings|general|display_name")}
                    value={displayName}
                    disableSaveButton={displayName === initialDisplayName}
                    saveButtonLabel={_t("common|save")}
                    cancelButtonLabel={_t("common|cancel")}
                    savedLabel={_t("common|saved")}
                    onChange={onDisplayNameChanged}
                    onCancel={onDisplayNameCancel}
                    onSave={onDisplayNameSave}
                    error={displayNameError ? _t("settings|general|display_name_error") : undefined}
                />
            </div>
            {avatarError && (
                <Alert title={_t("settings|general|avatar_upload_error_title")} type="critical">
                    {maxUploadSize === undefined
                        ? _t("settings|general|avatar_upload_error_text_generic")
                        : _t("settings|general|avatar_upload_error_text", { size: formatBytes(maxUploadSize) })}
                </Alert>
            )}
            {userIdentifier && <UsernameBox username={userIdentifier} />}
        </div>
    );
};

export default UserProfileSettings;
