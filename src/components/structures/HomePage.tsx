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

import * as React from "react";
import {useContext, useState} from "react";

import AutoHideScrollbar from './AutoHideScrollbar';
import {getHomePageUrl} from "../../utils/pages";
import {_t} from "../../languageHandler";
import SdkConfig from "../../SdkConfig";
import * as sdk from "../../index";
import dis from "../../dispatcher/dispatcher";
import {Action} from "../../dispatcher/actions";
import BaseAvatar from "../views/avatars/BaseAvatar";
import {OwnProfileStore} from "../../stores/OwnProfileStore";
import AccessibleButton from "../views/elements/AccessibleButton";
import {UPDATE_EVENT} from "../../stores/AsyncStore";
import {useEventEmitter} from "../../hooks/useEventEmitter";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import MiniAvatarUploader, {AVATAR_SIZE} from "../views/elements/MiniAvatarUploader";
import Analytics from "../../Analytics";
import CountlyAnalytics from "../../CountlyAnalytics";

const onClickSendDm = () => {
    Analytics.trackEvent('home_page', 'button', 'dm');
    CountlyAnalytics.instance.track("home_page_button", { button: "dm" });
    dis.dispatch({action: 'view_create_chat'});
};

const onClickExplore = () => {
    Analytics.trackEvent('home_page', 'button', 'room_directory');
    CountlyAnalytics.instance.track("home_page_button", { button: "room_directory" });
    dis.fire(Action.ViewRoomDirectory);
};

const onClickNewRoom = () => {
    Analytics.trackEvent('home_page', 'button', 'create_room');
    CountlyAnalytics.instance.track("home_page_button", { button: "create_room" });
    dis.dispatch({action: 'view_create_room'});
};

interface IProps {
    justRegistered?: boolean;
}

const getOwnProfile = (userId: string) => ({
    displayName: OwnProfileStore.instance.displayName || userId,
    avatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_SIZE),
});

const UserWelcomeTop = () => {
    const cli = useContext(MatrixClientContext);
    const userId = cli.getUserId();
    const [ownProfile, setOwnProfile] = useState(getOwnProfile(userId));
    useEventEmitter(OwnProfileStore.instance, UPDATE_EVENT, () => {
        setOwnProfile(getOwnProfile(userId));
    });

    return <div>
        <MiniAvatarUploader
            hasAvatar={!!ownProfile.avatarUrl}
            hasAvatarLabel={_t("Great, that'll help people know it's you")}
            noAvatarLabel={_t("Add a photo so people know it's you.")}
            setAvatarUrl={url => cli.setAvatarUrl(url)}
        >
            <BaseAvatar
                idName={userId}
                name={ownProfile.displayName}
                url={ownProfile.avatarUrl}
                width={AVATAR_SIZE}
                height={AVATAR_SIZE}
                resizeMethod="crop"
            />
        </MiniAvatarUploader>

        <h1>{ _t("Welcome %(name)s", { name: ownProfile.displayName }) }</h1>
        <h4>{ _t("Now, let's help you get started") }</h4>
    </div>;
};

const HomePage: React.FC<IProps> = ({ justRegistered = false }) => {
    const config = SdkConfig.get();
    const pageUrl = getHomePageUrl(config);

    if (pageUrl) {
        const EmbeddedPage = sdk.getComponent('structures.EmbeddedPage');
        return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    }

    let introSection;
    if (justRegistered) {
        introSection = <UserWelcomeTop />;
    } else {
        const brandingConfig = config.branding;
        let logoUrl = "themes/element/img/logos/element-logo.svg";
        if (brandingConfig && brandingConfig.authHeaderLogoUrl) {
            logoUrl = brandingConfig.authHeaderLogoUrl;
        }

        introSection = <React.Fragment>
            <img src={logoUrl} alt={config.brand} />
            <h1>{ _t("Welcome to %(appName)s", { appName: config.brand }) }</h1>
            <h4>{ _t("Liberate your communication") }</h4>
        </React.Fragment>;
    }


    return <AutoHideScrollbar className="mx_HomePage mx_HomePage_default">
        <div className="mx_HomePage_default_wrapper">
            { introSection }
            <div className="mx_HomePage_default_buttons">
                <AccessibleButton onClick={onClickSendDm} className="mx_HomePage_button_sendDm">
                    { _t("Send a Direct Message") }
                </AccessibleButton>
                <AccessibleButton onClick={onClickExplore} className="mx_HomePage_button_explore">
                    { _t("Explore Public Rooms") }
                </AccessibleButton>
                <AccessibleButton onClick={onClickNewRoom} className="mx_HomePage_button_createGroup">
                    { _t("Create a Group Chat") }
                </AccessibleButton>
            </div>
        </div>
    </AutoHideScrollbar>;
};

export default HomePage;
