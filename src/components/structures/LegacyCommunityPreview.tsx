/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useContext } from "react";

import MatrixClientContext from "../../contexts/MatrixClientContext";
import { _t } from "../../languageHandler";
import AccessibleButton from "../views/elements/AccessibleButton";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import { IGroupSummary } from "../views/dialogs/CreateSpaceFromCommunityDialog";
import { useAsyncMemo } from "../../hooks/useAsyncMemo";
import Spinner from "../views/elements/Spinner";
import GroupAvatar from "../views/avatars/GroupAvatar";
import { linkifyElement } from "../../HtmlUtils";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { UserTab } from "../views/dialogs/UserSettingsDialog";

interface IProps {
    groupId: string;
}

const onSwapClick = () => {
    defaultDispatcher.dispatch({
        action: Action.ViewUserSettings,
        initialTabId: UserTab.Preferences,
    });
};

// XXX: temporary community migration component, reuses SpaceRoomView & SpacePreview classes for simplicity
const LegacyCommunityPreview = ({ groupId }: IProps) => {
    const cli = useContext(MatrixClientContext);

    const groupSummary = useAsyncMemo<IGroupSummary>(() => cli.getGroupSummary(groupId), [cli, groupId]);

    if (!groupSummary) {
        return <main className="mx_SpaceRoomView">
            <div className="mx_MainSplit">
                <div className="mx_SpaceRoomView_preview">
                    <Spinner />
                </div>
            </div>
        </main>;
    }

    let visibilitySection: JSX.Element;
    if (groupSummary.profile.is_public) {
        visibilitySection = <span className="mx_SpaceRoomView_info_public">
            { _t("Public community") }
        </span>;
    } else {
        visibilitySection = <span className="mx_SpaceRoomView_info_private">
            { _t("Private community") }
        </span>;
    }

    return <main className="mx_SpaceRoomView">
        <ErrorBoundary>
            <div className="mx_MainSplit">
                <div className="mx_SpaceRoomView_preview">
                    <GroupAvatar
                        groupId={groupId}
                        groupName={groupSummary.profile.name}
                        groupAvatarUrl={groupSummary.profile.avatar_url}
                        height={80}
                        width={80}
                        resizeMethod='crop'
                    />
                    <h1 className="mx_SpaceRoomView_preview_name">
                        { groupSummary.profile.name }
                    </h1>
                    <div className="mx_SpaceRoomView_info">
                        { visibilitySection }
                    </div>
                    <div className="mx_SpaceRoomView_preview_topic" ref={e => e && linkifyElement(e)}>
                        { groupSummary.profile.short_description }
                    </div>
                    <div className="mx_SpaceRoomView_preview_spaceBetaPrompt">
                        { groupSummary.user?.membership === "join"
                            ? _t("To view %(communityName)s, swap to communities in your <a>preferences</a>", {
                                communityName: groupSummary.profile.name,
                            }, {
                                a: sub => (
                                    <AccessibleButton onClick={onSwapClick} kind="link">{ sub }</AccessibleButton>
                                ),
                            })
                            : _t("To join %(communityName)s, swap to communities in your <a>preferences</a>", {
                                communityName: groupSummary.profile.name,
                            }, {
                                a: sub => (
                                    <AccessibleButton onClick={onSwapClick} kind="link">{ sub }</AccessibleButton>
                                ),
                            })
                        }
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    </main>;
};

export default LegacyCommunityPreview;
