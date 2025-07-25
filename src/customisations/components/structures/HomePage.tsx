/*
Copyright 2025 Keypair Establishment.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { useContext, useState } from "react";

import AutoHideScrollbar from "../../../components/structures/AutoHideScrollbar";
import { getHomePageUrl } from "../../../utils/pages";
import { _t, _tDom } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import BaseAvatar from "../../../components/views/avatars/BaseAvatar";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import AccessibleButton, { type ButtonEvent } from "../../../components/views/elements/AccessibleButton";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import MatrixClientContext, { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import MiniAvatarUploader, { AVATAR_SIZE } from "../../../components/views/elements/MiniAvatarUploader";
import PosthogTrackers from "../../../PosthogTrackers";
import EmbeddedPage from "../../../components/structures/EmbeddedPage";
import AuthFooter from "../../../components/views/auth/AuthFooter";
import { Icon as AutoAccessIcon } from "../../../../res/img/auto-access.svg";
import { Icon as NameServiceProfileIcon } from "../../../../res/img/name-service-profile.svg";
import { Icon as SearchIcon } from "../../../../res/img/element-icons/room/search-bright.svg";
import { Icon as GradientCirclesIcon } from "../../../../res/img/home-circles.svg";
import { Icon as GradientChatIcon } from "../../../../res/img/home-chat.svg";
import { Button } from "@vector-im/compound-web";


const onClickSendDm = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebHomeCreateChatButton", ev);
    dis.dispatch({ action: Action.CreateChat });
};

const onClickExplore = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebHomeExploreRoomsButton", ev);
    dis.fire(Action.ViewRoomDirectory);
};

const onClickNewRoom = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebHomeCreateRoomButton", ev);
    dis.dispatch({ action: Action.CreateRoom });
};

interface IProps {
    justRegistered?: boolean;
}

const getOwnProfile = (
    userId: string,
): {
    displayName: string;
    avatarUrl?: string;
} => ({
    displayName: OwnProfileStore.instance.displayName || userId,
    avatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(parseInt(AVATAR_SIZE, 10)) ?? undefined,
});

const UserWelcomeTop: React.FC = () => {
    const config = SdkConfig.get();
    const cli = useContext(MatrixClientContext);
    const userId = cli.getUserId()!;
    const [ownProfile, setOwnProfile] = useState(getOwnProfile(userId));
    useEventEmitter(OwnProfileStore.instance, UPDATE_EVENT, () => {
        setOwnProfile(getOwnProfile(userId));
    });

    return (
        <div>
            {/* <MiniAvatarUploader
                hasAvatar={!!ownProfile.avatarUrl}
                hasAvatarLabel={_tDom("onboarding|has_avatar_label")}
                noAvatarLabel={_tDom("onboarding|no_avatar_label")}
                setAvatarUrl={(url) => cli.setAvatarUrl(url)}
                isUserAvatar
                onClick={(ev) => PosthogTrackers.trackInteraction("WebHomeMiniAvatarUploadButton", ev)}
            >
                <BaseAvatar
                    idName={userId}
                    name={ownProfile.displayName}
                    url={ownProfile.avatarUrl}
                    size={AVATAR_SIZE}
                />
            </MiniAvatarUploader> */}

            <h1>{_tDom("onboarding|intro_welcome", { appName: config.brand })}</h1>
            <h2>
                {_tDom(
                    "onboarding|welcome_user",
                    {},
                    {
                        name: () => <span className="displayName">{ownProfile.displayName}</span>,
                    },
                )}
            </h2>

            {/* <h2>{_tDom("onboarding|welcome_detail")}</h2> */}
        </div>
    );
};

const HomePage: React.FC<IProps> = ({ justRegistered = false }) => {
    const cli = useMatrixClientContext();
    const config = SdkConfig.get();
    const pageUrl = getHomePageUrl(config, cli);

    if (pageUrl) {
        return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    }

    // if (justRegistered || !OwnProfileStore.instance.getHttpAvatarUrl(parseInt(AVATAR_SIZE, 10))) {
    //     introSection = <UserWelcomeTop />;
    // } else {
    //     const brandingConfig = SdkConfig.getObject("branding");
    //     const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/element/img/logos/element-logo.svg";

    //     introSection = (
    //         <React.Fragment>
    //             <img src={logoUrl} alt={config.brand} />
    //             <h1>{_tDom("onboarding|intro_welcome", { appName: config.brand })}</h1>
    //             <h2>{_tDom("onboarding|intro_byline")}</h2>
    //         </React.Fragment>
    //     );
    // }

    return (
        <AutoHideScrollbar className="mx_HomePage mx_HomePage_default" element="main">
            <div className="mx_HomePage_default_wrapper">
                <GradientCirclesIcon className="qc_Circles_icon" />
                <div className="qc_Home_group">
                <UserWelcomeTop />
                    <div className="mx_HomePage_default_buttons">
                        <div className="qc_HomePage_action">
                            <h4>{_tDom("onboarding|use_case_encrypted_messaging")}</h4>
                            <Button onClick={onClickSendDm} size="sm" className="qc_Button">
                                {_tDom("onboarding|send_dm")}
                            </Button>
                        </div>
                        <div className="qc_HomePage_action">
                            <h4>{_tDom("onboarding|use_case_discover_messaging")}</h4>
                            <Button
                                onClick={onClickExplore}
                                size="sm"
                                Icon={SearchIcon}
                                kind="secondary"
                                className="qc_Button"
                            >
                                {_tDom("onboarding|explore_rooms")}
                            </Button>
                        </div>
                        <div className="qc_HomePage_feature">
                            <div>
                                <div className="qc_Feature_header">
                                    <AutoAccessIcon />
                                    <h3>{_tDom("onboarding|automatic_access|title")}</h3>
                                </div>
                                <span>{_tDom("onboarding|automatic_access|description")}</span>
                            </div>
                            <div>
                                <div className="qc_Feature_header">
                                    <NameServiceProfileIcon />
                                    <h3>{_tDom("onboarding|name_service|title")}</h3>
                                </div>
                                <span>{_tDom("onboarding|name_service|description")}.</span>
                            </div>
                        </div>
                    </div>
                </div>
                <GradientChatIcon className="qc_Chat_icon" />
            </div>
            <AuthFooter />
        </AutoHideScrollbar>
    );
};

export default HomePage;
