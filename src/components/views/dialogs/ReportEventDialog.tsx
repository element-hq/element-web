/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ChangeEvent } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t, UserFriendlyError } from "../../../languageHandler";
import { ensureDMExists } from "../../../createRoom";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";
import Markdown from "../../../Markdown";
import SettingsStore from "../../../settings/SettingsStore";
import StyledRadioButton from "../elements/StyledRadioButton";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import Spinner from "../elements/Spinner";
import LabelledCheckbox from "../elements/LabelledCheckbox";

declare module "matrix-js-sdk/src/types" {
    interface TimelineEvents {
        [ABUSE_EVENT_TYPE]: AbuseEventContent;
    }
}

interface IProps {
    mxEvent: MatrixEvent;
    onFinished(report?: boolean): void;
}

interface IState {
    // A free-form text describing the abuse.
    reason: string;
    busy: boolean;
    err?: string;
    // If we know it, the nature of the abuse, as specified by MSC3215.
    nature?: ExtendedNature;
    ignoreUserToo: boolean; // if true, user will be ignored/blocked on submit
    /*
     * Whether the room is encrypted.
     */
    isRoomEncrypted: boolean;
}

const MODERATED_BY_STATE_EVENT_TYPE = [
    "org.matrix.msc3215.room.moderation.moderated_by",
    /**
     * Unprefixed state event. Not ready for prime time.
     *
     * "m.room.moderation.moderated_by"
     */
];

export const ABUSE_EVENT_TYPE = "org.matrix.msc3215.abuse.report";

interface AbuseEventContent {
    event_id: string;
    room_id: string;
    moderated_by_id: string;
    nature?: ExtendedNature;
    reporter: string;
    comment: string;
}

// Standard abuse natures.
enum Nature {
    Disagreement = "org.matrix.msc3215.abuse.nature.disagreement",
    Toxic = "org.matrix.msc3215.abuse.nature.toxic",
    Illegal = "org.matrix.msc3215.abuse.nature.illegal",
    Spam = "org.matrix.msc3215.abuse.nature.spam",
    Other = "org.matrix.msc3215.abuse.nature.other",
}

enum NonStandardValue {
    // Non-standard abuse nature.
    // It should never leave the client - we use it to fallback to
    // server-wide abuse reporting.
    Admin = "non-standard.abuse.nature.admin",
}

type ExtendedNature = Nature | NonStandardValue;

type Moderation = {
    // The id of the moderation room.
    moderationRoomId: string;
    // The id of the bot in charge of forwarding abuse reports to the moderation room.
    moderationBotUserId: string;
};
/*
 * A dialog for reporting an event.
 *
 * The actual content of the dialog will depend on two things:
 *
 * 1. Is `feature_report_to_moderators` enabled?
 * 2. Does the room support moderation as per MSC3215, i.e. is there
 *    a well-formed state event `m.room.moderation.moderated_by`
 *    /`org.matrix.msc3215.room.moderation.moderated_by`?
 */
export default class ReportEventDialog extends React.Component<IProps, IState> {
    // If the room supports moderation, the moderation information.
    private moderation?: Moderation;

    public constructor(props: IProps) {
        super(props);

        let moderatedByRoomId: string | null = null;
        let moderatedByUserId: string | null = null;

        if (SettingsStore.getValue("feature_report_to_moderators")) {
            // The client supports reporting to moderators.
            // Does the room support it, too?

            // Extract state events to determine whether we should display
            const client = MatrixClientPeg.safeGet();
            const room = client.getRoom(props.mxEvent.getRoomId());

            for (const stateEventType of MODERATED_BY_STATE_EVENT_TYPE) {
                const stateEvent = room?.currentState.getStateEvents(stateEventType, stateEventType);
                if (!stateEvent) {
                    continue;
                }
                if (Array.isArray(stateEvent)) {
                    // Internal error.
                    throw new TypeError(
                        `getStateEvents(${stateEventType}, ${stateEventType}) ` +
                            "should return at most one state event",
                    );
                }
                const event = stateEvent.event;
                if (!("content" in event) || typeof event["content"] != "object") {
                    // The room is improperly configured.
                    // Display this debug message for the sake of moderators.
                    console.debug(
                        "Moderation error",
                        "state event",
                        stateEventType,
                        "should have an object field `content`, got",
                        event,
                    );
                    continue;
                }
                const content = event["content"];
                if (!("room_id" in content) || typeof content["room_id"] != "string") {
                    // The room is improperly configured.
                    // Display this debug message for the sake of moderators.
                    console.debug(
                        "Moderation error",
                        "state event",
                        stateEventType,
                        "should have a string field `content.room_id`, got",
                        event,
                    );
                    continue;
                }
                if (!("user_id" in content) || typeof content["user_id"] != "string") {
                    // The room is improperly configured.
                    // Display this debug message for the sake of moderators.
                    console.debug(
                        "Moderation error",
                        "state event",
                        stateEventType,
                        "should have a string field `content.user_id`, got",
                        event,
                    );
                    continue;
                }
                moderatedByRoomId = content["room_id"];
                moderatedByUserId = content["user_id"];
            }

            if (moderatedByRoomId && moderatedByUserId) {
                // The room supports moderation.
                this.moderation = {
                    moderationRoomId: moderatedByRoomId,
                    moderationBotUserId: moderatedByUserId,
                };
            }
        }

        this.state = {
            // A free-form text describing the abuse.
            reason: "",
            busy: false,
            err: undefined,
            // If specified, the nature of the abuse, as specified by MSC3215.
            nature: undefined,
            ignoreUserToo: false, // default false, for now. Could easily be argued as default true
            isRoomEncrypted: false, // async, will be set later
        };
    }

    public componentDidMount = async (): Promise<void> => {
        const crypto = MatrixClientPeg.safeGet().getCrypto();
        const roomId = this.props.mxEvent.getRoomId();
        if (!crypto || !roomId) return;

        this.setState({
            isRoomEncrypted: await crypto.isEncryptionEnabledInRoom(roomId),
        });
    };

    private onIgnoreUserTooChanged = (newVal: boolean): void => {
        this.setState({ ignoreUserToo: newVal });
    };

    // The user has written down a freeform description of the abuse.
    private onReasonChange = ({ target: { value: reason } }: ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ reason });
    };

    // The user has clicked on a nature.
    private onNatureChosen = (e: React.FormEvent<HTMLInputElement>): void => {
        this.setState({ nature: e.currentTarget.value as ExtendedNature });
    };

    // The user has clicked "cancel".
    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    // The user has clicked "submit".
    private onSubmit = async (): Promise<void> => {
        let reason = this.state.reason || "";
        reason = reason.trim();
        if (this.moderation) {
            // This room supports moderation.
            // We need a nature.
            // If the nature is `NATURE.OTHER` or `NON_STANDARD_NATURE.ADMIN`, we also need a `reason`.
            if (
                !this.state.nature ||
                ((this.state.nature == Nature.Other || this.state.nature == NonStandardValue.Admin) && !reason)
            ) {
                this.setState({
                    err: _t("report_content|missing_reason"),
                });
                return;
            }
        } else {
            // This room does not support moderation.
            // We need a `reason`.
            if (!reason) {
                this.setState({
                    err: _t("report_content|missing_reason"),
                });
                return;
            }
        }

        this.setState({
            busy: true,
            err: undefined,
        });

        try {
            const client = MatrixClientPeg.safeGet();
            const ev = this.props.mxEvent;
            if (this.moderation && this.state.nature !== NonStandardValue.Admin) {
                const nature = this.state.nature;

                // Report to moderators through to the dedicated bot,
                // as configured in the room's state events.
                const dmRoomId = await ensureDMExists(client, this.moderation.moderationBotUserId);
                if (!dmRoomId) {
                    throw new UserFriendlyError("report_content|error_create_room_moderation_bot");
                }

                await client.sendEvent(dmRoomId, ABUSE_EVENT_TYPE, {
                    event_id: ev.getId()!,
                    room_id: ev.getRoomId()!,
                    moderated_by_id: this.moderation.moderationRoomId,
                    nature,
                    reporter: client.getUserId()!,
                    comment: this.state.reason.trim(),
                } satisfies AbuseEventContent);
            } else {
                // Report to homeserver admin through the dedicated Matrix API.
                await client.reportEvent(ev.getRoomId()!, ev.getId()!, -100, this.state.reason.trim());
            }

            // if the user should also be ignored, do that
            if (this.state.ignoreUserToo) {
                await client.setIgnoredUsers([...client.getIgnoredUsers(), ev.getSender()!]);
            }

            this.props.onFinished(true);
        } catch (e) {
            logger.error(e);
            this.setState({
                busy: false,
                err: e instanceof Error ? e.message : String(e),
            });
        }
    };

    public render(): React.ReactNode {
        let error: JSX.Element | undefined;
        if (this.state.err) {
            error = <div className="error">{this.state.err}</div>;
        }

        let progress: JSX.Element | undefined;
        if (this.state.busy) {
            progress = (
                <div className="progress">
                    <Spinner />
                </div>
            );
        }

        const ignoreUserCheckbox = (
            <LabelledCheckbox
                value={this.state.ignoreUserToo}
                label={_t("report_content|ignore_user")}
                byline={_t("report_content|hide_messages_from_user")}
                onChange={this.onIgnoreUserTooChanged}
                disabled={this.state.busy}
            />
        );

        const adminMessageMD = SdkConfig.getObject("report_event")?.get("admin_message_md", "adminMessageMD");
        let adminMessage: JSX.Element | undefined;
        if (adminMessageMD) {
            const html = new Markdown(adminMessageMD).toHTML({ externalLinks: true });
            adminMessage = <p dangerouslySetInnerHTML={{ __html: html }} />;
        }

        if (this.moderation) {
            // Display report-to-moderator dialog.
            // We let the user pick a nature.
            const homeServerName = SdkConfig.get("validated_server_config")!.hsName;
            let subtitle: string;
            switch (this.state.nature) {
                case Nature.Disagreement:
                    subtitle = _t("report_content|nature_disagreement");
                    break;
                case Nature.Toxic:
                    subtitle = _t("report_content|nature_toxic");
                    break;
                case Nature.Illegal:
                    subtitle = _t("report_content|nature_illegal");
                    break;
                case Nature.Spam:
                    subtitle = _t("report_content|nature_spam");
                    break;
                case NonStandardValue.Admin:
                    if (this.state.isRoomEncrypted) {
                        subtitle = _t("report_content|nature_nonstandard_admin_encrypted", {
                            homeserver: homeServerName,
                        });
                    } else {
                        subtitle = _t("report_content|nature_nonstandard_admin", { homeserver: homeServerName });
                    }
                    break;
                case Nature.Other:
                    subtitle = _t("report_content|nature_other");
                    break;
                default:
                    subtitle = _t("report_content|nature");
                    break;
            }

            return (
                <BaseDialog
                    className="mx_ReportEventDialog"
                    onFinished={this.props.onFinished}
                    title={_t("action|report_content")}
                    contentId="mx_ReportEventDialog"
                >
                    <div>
                        <StyledRadioButton
                            name="nature"
                            value={Nature.Disagreement}
                            checked={this.state.nature == Nature.Disagreement}
                            onChange={this.onNatureChosen}
                        >
                            {_t("report_content|disagree")}
                        </StyledRadioButton>
                        <StyledRadioButton
                            name="nature"
                            value={Nature.Toxic}
                            checked={this.state.nature == Nature.Toxic}
                            onChange={this.onNatureChosen}
                        >
                            {_t("report_content|toxic_behaviour")}
                        </StyledRadioButton>
                        <StyledRadioButton
                            name="nature"
                            value={Nature.Illegal}
                            checked={this.state.nature == Nature.Illegal}
                            onChange={this.onNatureChosen}
                        >
                            {_t("report_content|illegal_content")}
                        </StyledRadioButton>
                        <StyledRadioButton
                            name="nature"
                            value={Nature.Spam}
                            checked={this.state.nature == Nature.Spam}
                            onChange={this.onNatureChosen}
                        >
                            {_t("report_content|spam_or_propaganda")}
                        </StyledRadioButton>
                        <StyledRadioButton
                            name="nature"
                            value={NonStandardValue.Admin}
                            checked={this.state.nature == NonStandardValue.Admin}
                            onChange={this.onNatureChosen}
                        >
                            {_t("report_content|report_entire_room")}
                        </StyledRadioButton>
                        <StyledRadioButton
                            name="nature"
                            value={Nature.Other}
                            checked={this.state.nature == Nature.Other}
                            onChange={this.onNatureChosen}
                        >
                            {_t("report_content|other_label")}
                        </StyledRadioButton>
                        <p>{subtitle}</p>
                        <Field
                            className="mx_ReportEventDialog_reason"
                            element="textarea"
                            label={_t("room_settings|permissions|ban_reason")}
                            rows={5}
                            onChange={this.onReasonChange}
                            value={this.state.reason}
                            disabled={this.state.busy}
                        />
                        {progress}
                        {error}
                        {ignoreUserCheckbox}
                    </div>
                    <DialogButtons
                        primaryButton={_t("action|send_report")}
                        onPrimaryButtonClick={this.onSubmit}
                        focus={true}
                        onCancel={this.onCancel}
                        disabled={this.state.busy}
                    />
                </BaseDialog>
            );
        }
        // Report to homeserver admin.
        // Currently, the API does not support natures.
        return (
            <BaseDialog
                className="mx_ReportEventDialog"
                onFinished={this.props.onFinished}
                title={_t("report_content|report_content_to_homeserver")}
                contentId="mx_ReportEventDialog"
            >
                <div className="mx_ReportEventDialog" id="mx_ReportEventDialog">
                    <p>{_t("report_content|description")}</p>
                    {adminMessage}
                    <Field
                        className="mx_ReportEventDialog_reason"
                        element="textarea"
                        label={_t("room_settings|permissions|ban_reason")}
                        rows={5}
                        onChange={this.onReasonChange}
                        value={this.state.reason}
                        disabled={this.state.busy}
                    />
                    {progress}
                    {error}
                    {ignoreUserCheckbox}
                </div>
                <DialogButtons
                    primaryButton={_t("action|send_report")}
                    onPrimaryButtonClick={this.onSubmit}
                    focus={true}
                    onCancel={this.onCancel}
                    disabled={this.state.busy}
                />
            </BaseDialog>
        );
    }
}
