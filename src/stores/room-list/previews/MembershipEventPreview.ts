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

import { IPreview } from "./IPreview";
import { TagID } from "../models";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { getTargetName, isSelfTarget } from "./utils";
import { _t } from "../../../languageHandler";

export class MembershipEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID): string {
        const newMembership = event.getContent()['membership'];
        const oldMembership = event.getPrevContent()['membership'];
        const reason = event.getContent()['reason'];
        const isUs = isSelfTarget(event);

        if (newMembership === 'invite') {
            return isUs
                ? _t("You were invited")
                : _t("%(targetName)s was invited", {targetName: getTargetName(event)});
        } else if (newMembership === 'leave' && oldMembership !== 'invite') {
            if (event.getSender() === event.getStateKey()) {
                return isUs
                    ? _t("You left")
                    : _t("%(targetName)s left", {targetName: getTargetName(event)});
            } else {
                if (reason) {
                    return isUs
                        ? _t("You were kicked (%(reason)s)", {reason})
                        : _t("%(targetName)s was kicked (%(reason)s)", {targetName: getTargetName(event), reason});
                } else {
                    return isUs
                        ? _t("You were kicked")
                        : _t("%(targetName)s was kicked", {targetName: getTargetName(event)});
                }
            }
        } else if (newMembership === 'leave' && oldMembership === 'invite') {
            if (event.getSender() === event.getStateKey()) {
                return isUs
                    ? _t("You rejected the invite")
                    : _t("%(targetName)s rejected the invite", {targetName: getTargetName(event)});
            } else {
                return isUs
                    ? _t("You were uninvited")
                    : _t("%(targetName)s was uninvited", {targetName: getTargetName(event)});
            }
        } else if (newMembership === 'ban') {
            if (reason) {
                return isUs
                    ? _t("You were banned (%(reason)s)", {reason})
                    : _t("%(targetName)s was banned (%(reason)s)", {targetName: getTargetName(event), reason});
            } else {
                return isUs
                    ? _t("You were banned")
                    : _t("%(targetName)s was banned", {targetName: getTargetName(event)});
            }
        } else if (newMembership === 'join' && oldMembership !== 'join') {
            return isUs
                ? _t("You joined")
                : _t("%(targetName)s joined", {targetName: getTargetName(event)});
        } else {
            const isDisplayNameChange = event.getContent()['displayname'] !== event.getPrevContent()['displayname'];
            const isAvatarChange = event.getContent()['avatar_url'] !== event.getPrevContent()['avatar_url'];
            if (isDisplayNameChange) {
                return isUs
                    ? _t("You changed your name")
                    : _t("%(targetName)s changed their name", {targetName: getTargetName(event)});
            } else if (isAvatarChange) {
                return isUs
                    ? _t("You changed your avatar")
                    : _t("%(targetName)s changed their avatar", {targetName: getTargetName(event)});
            } else {
                return null; // no change
            }
        }
    }
}
