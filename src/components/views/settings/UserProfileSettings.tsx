/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useState, useId } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { EditInPlace, Alert, ErrorMessage } from "@vector-im/compound-web";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";
import SignOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/sign-out";

import { _t } from "../../../languageHandler";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import AvatarSetting from "./AvatarSetting";
import PosthogTrackers from "../../../PosthogTrackers";
import { formatBytes } from "../../../utils/FormattingUtils";
import { useToastContext } from "../../../contexts/ToastContext";
import InlineSpinner from "../elements/InlineSpinner";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import CopyableText from "../elements/CopyableText";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import AccessibleButton from "../elements/AccessibleButton";
import LogoutDialog, { shouldShowLogoutDialog } from "../dialogs/LogoutDialog";
import Modal from "../../../Modal";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Flex } from "../../utils/Flex";

const SpinnerToast: React.FC<{ children?: ReactNode }> = ({ children }) => (
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

interface ManageAccountButtonProps {
    externalAccountManagementUrl: string;
}

const ManageAccountButton: React.FC<ManageAccountButtonProps> = ({ externalAccountManagementUrl }) => (
    <AccessibleButton
        onClick={null}
        element="a"
        kind="primary"
        target="_blank"
        rel="noreferrer noopener"
        href={externalAccountManagementUrl}
        data-testid="external-account-management-link"
    >
        <PopOutIcon className="mx_UserProfileSettings_accountmanageIcon" width="24" height="24" />
        {_t("settings|general|oidc_manage_button")}
    </AccessibleButton>
);

const SignOutButton: React.FC = () => {
    const client = useMatrixClientContext();

    const onClick = useCallback(async () => {
        if (await shouldShowLogoutDialog(client)) {
            Modal.createDialog(LogoutDialog);
        } else {
            defaultDispatcher.dispatch({ action: "logout" });
        }
    }, [client]);

    return (
        <AccessibleButton onClick={onClick} kind="danger_outline">
            <SignOutIcon className="mx_UserProfileSettings_accountmanageIcon" width="24" height="24" />
            {_t("action|sign_out")}
        </AccessibleButton>
    );
};

interface UserProfileSettingsProps {
    // The URL to redirect the user to in order to manage their account.
    externalAccountManagementUrl?: string;
    // Whether the homeserver allows the user to set their display name.
    canSetDisplayName: boolean;
    // Whether the homeserver allows the user to set their avatar.
    canSetAvatar: boolean;
}

/**
 * A group of settings views to allow the user to set their profile information.
 */
const UserProfileSettings: React.FC<UserProfileSettingsProps> = ({
    externalAccountManagementUrl,
    canSetDisplayName,
    canSetAvatar,
}) => {
    const [avatarURL, setAvatarURL] = useState(OwnProfileStore.instance.avatarMxc);
    const [displayName, setDisplayName] = useState(OwnProfileStore.instance.displayName ?? "");
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
            } catch {
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
        } catch (e) {
            setDisplayNameError(true);
            throw e;
        }
    }, [displayName, client]);

    const userIdentifier = useMemo(
        () =>
            UserIdentifierCustomisations.getDisplayUserIdentifier(client.getSafeUserId(), {
                withDisplayName: true,
            }),
        [client],
    );

    const someFieldsDisabled = !canSetDisplayName || !canSetAvatar;

    return (
        <div className="mx_UserProfileSettings">
            <h2>{_t("common|profile")}</h2>
            <div>
                {someFieldsDisabled
                    ? _t("settings|general|profile_subtitle_oidc")
                    : _t("settings|general|profile_subtitle")}
            </div>
            <div className="mx_UserProfileSettings_profile">
                <AvatarSetting
                    avatar={avatarURL ?? undefined}
                    avatarAltText={_t("common|user_avatar")}
                    onChange={onAvatarChange}
                    removeAvatar={avatarURL ? onAvatarRemove : undefined}
                    placeholderName={displayName}
                    placeholderId={client.getUserId() ?? ""}
                    disabled={!canSetAvatar}
                />
                <EditInPlace
                    className="mx_UserProfileSettings_profile_displayName"
                    label={_t("settings|general|display_name")}
                    value={displayName}
                    saveButtonLabel={_t("common|save")}
                    cancelButtonLabel={_t("common|cancel")}
                    savedLabel={_t("common|saved")}
                    savingLabel={_t("common|updating")}
                    onChange={onDisplayNameChanged}
                    onCancel={onDisplayNameCancel}
                    onSave={onDisplayNameSave}
                    disabled={!canSetDisplayName}
                >
                    {displayNameError && <ErrorMessage>{_t("settings|general|display_name_error")}</ErrorMessage>}
                </EditInPlace>
            </div>
            {avatarError && (
                <Alert title={_t("settings|general|avatar_upload_error_title")} type="critical">
                    {maxUploadSize === undefined
                        ? _t("settings|general|avatar_upload_error_text_generic")
                        : _t("settings|general|avatar_upload_error_text", { size: formatBytes(maxUploadSize) })}
                </Alert>
            )}
            {userIdentifier && <UsernameBox username={userIdentifier} />}
            <Flex gap="var(--cpd-space-4x)" className="mx_UserProfileSettings_profile_buttons">
                {externalAccountManagementUrl && (
                    <ManageAccountButton externalAccountManagementUrl={externalAccountManagementUrl} />
                )}
                <SignOutButton />
            </Flex>
        </div>
    );
};

export default UserProfileSettings;
