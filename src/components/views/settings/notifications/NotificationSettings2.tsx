/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";

import NewAndImprovedIcon from "../../../../../res/img/element-icons/new-and-improved.svg";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useNotificationSettings } from "../../../../hooks/useNotificationSettings";
import { useSettingValue } from "../../../../hooks/useSettings";
import { _t } from "../../../../languageHandler";
import {
    DefaultNotificationSettings,
    type NotificationSettings,
} from "../../../../models/notificationsettings/NotificationSettings";
import { RoomNotifState } from "../../../../RoomNotifs";
import { SettingLevel } from "../../../../settings/SettingLevel";
import SettingsStore from "../../../../settings/SettingsStore";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { clearAllNotifications } from "../../../../utils/notifications";
import AccessibleButton from "../../elements/AccessibleButton";
import ExternalLink from "../../elements/ExternalLink";
import LabelledCheckbox from "../../elements/LabelledCheckbox";
import LabelledToggleSwitch from "../../elements/LabelledToggleSwitch";
import StyledRadioGroup from "../../elements/StyledRadioGroup";
import TagComposer from "../../elements/TagComposer";
import { StatelessNotificationBadge } from "../../rooms/NotificationBadge/StatelessNotificationBadge";
import { SettingsBanner } from "../shared/SettingsBanner";
import { SettingsSection } from "../shared/SettingsSection";
import { SettingsSubsection } from "../shared/SettingsSubsection";
import { NotificationPusherSettings } from "./NotificationPusherSettings";
import SettingsFlag from "../../elements/SettingsFlag";

enum NotificationDefaultLevels {
    AllMessages = "all_messages",
    PeopleMentionsKeywords = "people_mentions_keywords",
    MentionsKeywords = "mentions_keywords",
}

function toDefaultLevels(levels: NotificationSettings["defaultLevels"]): NotificationDefaultLevels {
    if (levels.room === RoomNotifState.AllMessages) {
        return NotificationDefaultLevels.AllMessages;
    } else if (levels.dm === RoomNotifState.AllMessages) {
        return NotificationDefaultLevels.PeopleMentionsKeywords;
    } else {
        return NotificationDefaultLevels.MentionsKeywords;
    }
}

function boldText(text: string): JSX.Element {
    return <strong>{text}</strong>;
}

function helpLink(sub: string): JSX.Element {
    return <ExternalLink href="https://element.io/help#settings2">{sub}</ExternalLink>;
}

function useHasUnreadNotifications(): boolean {
    const cli = useMatrixClientContext();
    return cli.getRooms().some((room) => room.getUnreadNotificationCount() > 0);
}

/**
 * The new notification settings tab view, only displayed if the user has Features.NotificationSettings2 enabled
 */
export default function NotificationSettings2(): JSX.Element {
    const cli = useMatrixClientContext();

    const desktopNotifications = useSettingValue("notificationsEnabled");
    const desktopShowBody = useSettingValue("notificationBodyEnabled");
    const audioNotifications = useSettingValue("audioNotificationsEnabled");

    const { model, hasPendingChanges, reconcile } = useNotificationSettings(cli);

    const disabled = model === null || hasPendingChanges;
    const settings = model ?? DefaultNotificationSettings;

    const [updatingUnread, setUpdatingUnread] = useState<boolean>(false);
    const hasUnreadNotifications = useHasUnreadNotifications();

    const NotificationOptions = [
        {
            value: NotificationDefaultLevels.AllMessages,
            label: _t("notifications|all_messages"),
        },
        {
            value: NotificationDefaultLevels.PeopleMentionsKeywords,
            label: _t("settings|notifications|people_mentions_keywords"),
        },
        {
            value: NotificationDefaultLevels.MentionsKeywords,
            label: _t("settings|notifications|mentions_keywords_only"),
        },
    ];

    return (
        <div className="mx_NotificationSettings2">
            {hasPendingChanges && model !== null && (
                <SettingsBanner
                    icon={<img src={NewAndImprovedIcon} alt="" width={12} />}
                    action={_t("action|proceed")}
                    onAction={() => reconcile(model!)}
                >
                    {_t(
                        "settings|notifications|labs_notice_prompt",
                        {},
                        {
                            strong: boldText,
                            a: helpLink,
                        },
                    )}
                </SettingsBanner>
            )}
            <SettingsSection>
                <div className="mx_SettingsSubsection_content mx_NotificationSettings2_flags">
                    <LabelledToggleSwitch
                        label={_t("settings|notifications|enable_notifications_account")}
                        value={!settings.globalMute}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                globalMute: !value,
                            });
                        }}
                    />
                    <LabelledToggleSwitch
                        label={_t("settings|notifications|enable_desktop_notifications_session")}
                        value={desktopNotifications}
                        onChange={(value) =>
                            SettingsStore.setValue("notificationsEnabled", null, SettingLevel.DEVICE, value)
                        }
                    />
                    <LabelledToggleSwitch
                        label={_t("settings|notifications|desktop_notification_message_preview")}
                        value={desktopShowBody}
                        onChange={(value) =>
                            SettingsStore.setValue("notificationBodyEnabled", null, SettingLevel.DEVICE, value)
                        }
                    />
                    <LabelledToggleSwitch
                        label={_t("settings|notifications|enable_audible_notifications_session")}
                        value={audioNotifications}
                        onChange={(value) =>
                            SettingsStore.setValue("audioNotificationsEnabled", null, SettingLevel.DEVICE, value)
                        }
                    />
                </div>
                <SettingsSubsection
                    heading={_t("settings|notifications|default_setting_section")}
                    description={_t("settings|notifications|default_setting_description")}
                >
                    <StyledRadioGroup
                        name="defaultNotificationLevel"
                        value={toDefaultLevels(settings.defaultLevels)}
                        disabled={disabled}
                        definitions={NotificationOptions}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                defaultLevels: {
                                    ...model!.defaultLevels,
                                    dm:
                                        value !== NotificationDefaultLevels.MentionsKeywords
                                            ? RoomNotifState.AllMessages
                                            : RoomNotifState.MentionsOnly,
                                    room:
                                        value === NotificationDefaultLevels.AllMessages
                                            ? RoomNotifState.AllMessages
                                            : RoomNotifState.MentionsOnly,
                                },
                            });
                        }}
                    />
                </SettingsSubsection>
                <SettingsSubsection
                    heading={_t("settings|notifications|play_sound_for_section")}
                    description={_t("settings|notifications|play_sound_for_description")}
                >
                    <LabelledCheckbox
                        label="People"
                        value={settings.sound.people !== undefined}
                        disabled={disabled || settings.defaultLevels.dm === RoomNotifState.MentionsOnly}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                sound: {
                                    ...model!.sound,
                                    people: value ? "default" : undefined,
                                },
                            });
                        }}
                    />
                    <LabelledCheckbox
                        label={_t("settings|notifications|mentions_keywords")}
                        value={settings.sound.mentions !== undefined}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                sound: {
                                    ...model!.sound,
                                    mentions: value ? "default" : undefined,
                                },
                            });
                        }}
                    />
                    <LabelledCheckbox
                        label={_t("settings|notifications|voip")}
                        value={settings.sound.calls !== undefined}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                sound: {
                                    ...model!.sound,
                                    calls: value ? "ring" : undefined,
                                },
                            });
                        }}
                    />
                </SettingsSubsection>
                <SettingsSubsection heading={_t("settings|notifications|other_section")}>
                    <LabelledCheckbox
                        label={_t("settings|notifications|invites")}
                        value={settings.activity.invite}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                activity: {
                                    ...model!.activity,
                                    invite: value,
                                },
                            });
                        }}
                    />
                    <LabelledCheckbox
                        label={_t("settings|notifications|room_activity")}
                        value={settings.activity.status_event}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                activity: {
                                    ...model!.activity,
                                    status_event: value,
                                },
                            });
                        }}
                    />
                    <LabelledCheckbox
                        label={_t("settings|notifications|notices")}
                        value={settings.activity.bot_notices}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                activity: {
                                    ...model!.activity,
                                    bot_notices: value,
                                },
                            });
                        }}
                    />
                </SettingsSubsection>
                <SettingsSubsection
                    heading={_t("settings|notifications|mentions_keywords")}
                    description={_t(
                        "settings|notifications|keywords",
                        {},
                        {
                            badge: (
                                <StatelessNotificationBadge
                                    symbol="1"
                                    count={1}
                                    level={NotificationLevel.Notification}
                                />
                            ),
                        },
                    )}
                >
                    <LabelledCheckbox
                        label={_t("settings|notifications|notify_at_room")}
                        value={settings.mentions.room}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                mentions: {
                                    ...model!.mentions,
                                    room: value,
                                },
                            });
                        }}
                    />
                    <LabelledCheckbox
                        label={_t("settings|notifications|notify_mention", {
                            mxid: cli.getUserId()!,
                        })}
                        value={settings.mentions.user}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                mentions: {
                                    ...model!.mentions,
                                    user: value,
                                },
                            });
                        }}
                    />
                    <LabelledCheckbox
                        label={_t("settings|notifications|notify_keyword")}
                        byline={_t("settings|notifications|keywords_prompt")}
                        value={settings.mentions.keywords}
                        disabled={disabled}
                        onChange={(value) => {
                            reconcile({
                                ...model!,
                                mentions: {
                                    ...model!.mentions,
                                    keywords: value,
                                },
                            });
                        }}
                    />
                    <TagComposer
                        id="mx_NotificationSettings2_Keywords"
                        tags={model?.keywords ?? []}
                        disabled={disabled}
                        onAdd={(keyword) => {
                            reconcile({
                                ...model!,
                                keywords: [keyword, ...model!.keywords],
                            });
                        }}
                        onRemove={(keyword) => {
                            reconcile({
                                ...model!,
                                keywords: model!.keywords.filter((it) => it !== keyword),
                            });
                        }}
                        label={_t("notifications|keyword")}
                        placeholder={_t("notifications|keyword_new")}
                    />

                    <SettingsFlag name="Notifications.showbold" level={SettingLevel.DEVICE} />
                    <SettingsFlag name="Notifications.tac_only_notifications" level={SettingLevel.DEVICE} />
                </SettingsSubsection>
                <NotificationPusherSettings />
                <SettingsSubsection heading={_t("settings|notifications|quick_actions_section")}>
                    {hasUnreadNotifications && (
                        <AccessibleButton
                            kind="primary_outline"
                            disabled={updatingUnread}
                            onClick={async () => {
                                setUpdatingUnread(true);
                                await clearAllNotifications(cli);
                                setUpdatingUnread(false);
                            }}
                        >
                            {_t("settings|notifications|quick_actions_mark_all_read")}
                        </AccessibleButton>
                    )}
                    <AccessibleButton
                        kind="danger_outline"
                        disabled={model === null}
                        onClick={() => {
                            reconcile(DefaultNotificationSettings);
                        }}
                    >
                        {_t("settings|notifications|quick_actions_reset")}
                    </AccessibleButton>
                </SettingsSubsection>
            </SettingsSection>
        </div>
    );
}
