/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type DateSeparatorViewSnapshot as DateSeparatorViewSnapshotInterface,
    type DateSeparatorViewModel as DateSeparatorViewModelInterface,
} from "@element-hq/web-shared-components";
import { ChevronDownIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { capitalize } from "lodash";
import React from "react";
import { Direction, ConnectionError, HTTPError, MatrixError } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { formatFullDateNoDay, formatFullDateNoTime, getDaysArray } from "../../DateUtils";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import dispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { _t, getUserLanguage } from "../../languageHandler";
import Modal from "../../Modal";
import SettingsStore from "../../settings/SettingsStore";
import { UIFeature } from "../../settings/UIFeature";
import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import BugReportDialog from "../../components/views/dialogs/BugReportDialog";
import AccessibleButton, { type ButtonEvent } from "../../components/views/elements/AccessibleButton";
import { ContextMenuTooltipButton } from "../../components/structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../../components/views/context_menus/IconizedContextMenu";
import JumpToDatePicker from "../../components/views/messages/JumpToDatePicker";
import { contextMenuBelow } from "../../components/views/rooms/RoomTile";
import { SdkContextClass } from "../../contexts/SDKContext";

export interface DateSeparatorViewModelProps {
    /**
     * Room ID used for jump-to-date navigation and room-switch guards.
     */
    roomId: string;
    /**
     * Timestamp used to compute the date separator label and initial picker value.
     */
    ts: number;
    /**
     * Export mode disables relative date labels and jump-to-date menu UI.
     */
    forExport?: boolean;
}

/**
 * ViewModel for the date separator, providing the current state of the component.
 */
export class DateSeparatorViewModel
    extends BaseViewModel<DateSeparatorViewSnapshotInterface, DateSeparatorViewModelProps>
    implements DateSeparatorViewModelInterface
{
    /**
     * Cached setting for UIFeature.TimelineEnableRelativeDates.
     * Updated via SettingsStore watcher to keep labels in sync at runtime.
     */
    private relativeDatesEnabled: boolean;
    /**
     * Cached setting for feature_jump_to_date.
     * Controls whether the jump-to-date menu is exposed in the snapshot.
     */
    private jumpToDateEnabled: boolean;
    /**
     * Anchor rectangle for the jump-to-date context menu.
     * Undefined means the menu is closed.
     */
    private contextMenuPosition?: DOMRect;

    public constructor(props: DateSeparatorViewModelProps) {
        const relativeDatesEnabled = SettingsStore.getValue(UIFeature.TimelineEnableRelativeDates);
        const jumpToDateEnabled = SettingsStore.getValue("feature_jump_to_date");

        super(props, {
            label: DateSeparatorViewModel.computeLabel(props, relativeDatesEnabled),
            className: "mx_TimelineSeparator",
            headerContent: undefined,
        });

        this.relativeDatesEnabled = relativeDatesEnabled;
        this.jumpToDateEnabled = jumpToDateEnabled;
        this.updateSnapshot();

        // Keep label behaviour in sync with runtime setting updates.
        const jumpToDateWatcherRef = SettingsStore.watchSetting(
            "feature_jump_to_date",
            null,
            (_settingName, _roomId, _level, _newValAtLevel, newVal) => {
                this.jumpToDateEnabled = newVal;
                this.updateSnapshot();
            },
        );
        this.disposables.track(() => SettingsStore.unwatchSetting(jumpToDateWatcherRef));

        const relativeDatesWatcherRef = SettingsStore.watchSetting(
            UIFeature.TimelineEnableRelativeDates,
            null,
            (_settingName, _roomId, _level, _newValAtLevel, newVal) => {
                this.relativeDatesEnabled = newVal;
                this.updateSnapshot();
            },
        );
        this.disposables.track(() => SettingsStore.unwatchSetting(relativeDatesWatcherRef));
    }

    private computeSnapshot(): DateSeparatorViewSnapshotInterface {
        const label = DateSeparatorViewModel.computeLabel(this.props, this.relativeDatesEnabled);
        return {
            label,
            className: "mx_TimelineSeparator",
            headerContent:
                this.jumpToDateEnabled && !this.props.forExport ? this.renderJumpToDateMenu(label) : undefined,
        };
    }

    private updateSnapshot(): void {
        this.snapshot.set(this.computeSnapshot());
    }

    private static get relativeTimeFormat(): Intl.RelativeTimeFormat {
        return new Intl.RelativeTimeFormat(getUserLanguage(), { style: "long", numeric: "auto" });
    }

    private static computeLabel(props: DateSeparatorViewModelProps, relativeDatesEnabled: boolean): string {
        try {
            const date = new Date(props.ts);

            // During export, relative dates are ambiguous and should not be used.
            if (props.forExport || !relativeDatesEnabled) return formatFullDateNoTime(date);

            const today = new Date();
            const yesterday = new Date();
            const days = getDaysArray("long");
            yesterday.setDate(today.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
                return this.relativeTimeFormat.format(0, "day");
            } else if (date.toDateString() === yesterday.toDateString()) {
                return this.relativeTimeFormat.format(-1, "day");
            } else if (today.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
                return days[date.getDay()];
            } else {
                return formatFullDateNoTime(date);
            }
        } catch {
            return _t("common|message_timestamp_invalid");
        }
    }

    public pickDate = async (inputTimestamp: number | string | Date): Promise<void> => {
        const unixTimestamp = new Date(inputTimestamp).getTime();
        const roomIdForJumpRequest = this.props.roomId;

        try {
            const cli = MatrixClientPeg.safeGet();
            const { event_id: eventId, origin_server_ts: originServerTs } = await cli.timestampToEvent(
                roomIdForJumpRequest,
                unixTimestamp,
                Direction.Forward,
            );
            logger.log(
                `/timestamp_to_event: ` +
                    `found ${eventId} (${originServerTs}) for timestamp=${unixTimestamp} (looking forward)`,
            );

            // Only try to navigate to the room if the user is still viewing the same
            // room. We don't want to jump someone back to a room after a slow request
            // if they've already navigated away to another room.
            const currentRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
            if (currentRoomId === roomIdForJumpRequest) {
                dispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    event_id: eventId,
                    highlighted: true,
                    room_id: roomIdForJumpRequest,
                    metricsTrigger: undefined, // room doesn't change
                });
            } else {
                logger.debug(
                    `No longer navigating to date in room (jump to date) because the user already switched ` +
                        `to another room: currentRoomId=${currentRoomId}, roomIdForJumpRequest=${roomIdForJumpRequest}`,
                );
            }
        } catch (err) {
            logger.error(
                `Error occured while trying to find event in ${roomIdForJumpRequest} ` +
                    `at timestamp=${unixTimestamp}:`,
                err,
            );

            // Only display an error if the user is still viewing the same room. We
            // don't want to worry someone about an error in a room they no longer care
            // about after a slow request if they've already navigated away to another
            // room.
            const currentRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
            if (currentRoomId === roomIdForJumpRequest) {
                let friendlyErrorMessage = "An error occured while trying to find and jump to the given date.";
                let submitDebugLogsContent: React.ReactElement = <></>;

                if (err instanceof ConnectionError) {
                    friendlyErrorMessage = _t("room|error_jump_to_date_connection");
                } else if (err instanceof MatrixError) {
                    if (err?.errcode === "M_NOT_FOUND") {
                        friendlyErrorMessage = _t("room|error_jump_to_date_not_found", {
                            dateString: formatFullDateNoDay(new Date(unixTimestamp)),
                        });
                    } else {
                        friendlyErrorMessage = _t("room|error_jump_to_date", {
                            statusCode: err?.httpStatus || _t("room|unknown_status_code_for_timeline_jump"),
                            errorCode: err?.errcode || _t("common|unavailable"),
                        });
                    }
                } else if (err instanceof HTTPError) {
                    friendlyErrorMessage = err.message;
                } else {
                    // We only give the option to submit logs for actual errors, not network problems.
                    submitDebugLogsContent = (
                        <p>
                            {_t(
                                "room|error_jump_to_date_send_logs_prompt",
                                {},
                                {
                                    debugLogsLink: (sub) => (
                                        // This is by default a `<div>` which we
                                        // can't nest within a `<p>` here so update
                                        // this to a be a inline anchor element.
                                        <AccessibleButton
                                            element="a"
                                            kind="link"
                                            onClick={() => this.onBugReport(err instanceof Error ? err : undefined)}
                                            data-testid="jump-to-date-error-submit-debug-logs-button"
                                        >
                                            {sub}
                                        </AccessibleButton>
                                    ),
                                },
                            )}
                        </p>
                    );
                }

                Modal.createDialog(ErrorDialog, {
                    title: _t("room|error_jump_to_date_title"),
                    description: (
                        <div data-testid="jump-to-date-error-content">
                            <p>{friendlyErrorMessage}</p>
                            {submitDebugLogsContent}
                            <details>
                                <summary>{_t("room|error_jump_to_date_details")}</summary>
                                <p>{String(err)}</p>
                            </details>
                        </div>
                    ),
                });
            }
        }
    };

    public onBugReport = (err?: Error): void => {
        Modal.createDialog(BugReportDialog, {
            error: err,
            initialText: "Error occured while using jump to date #jump-to-date",
        });
    };

    public pickLastWeek = (): Promise<void> => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        void this.pickDate(date);
        this.closeMenu();
        return Promise.resolve();
    };

    public pickLastMonth = (): Promise<void> => {
        const date = new Date();
        // Month numbers are 0-11 and setMonth handles rollover.
        date.setMonth(date.getMonth() - 1, 1);
        void this.pickDate(date);
        this.closeMenu();
        return Promise.resolve();
    };

    public pickTheBeginning = (): Promise<void> => {
        void this.pickDate(new Date(0));
        this.closeMenu();
        return Promise.resolve();
    };

    private onDatePicked = (dateString: string): void => {
        void this.pickDate(dateString);
        this.closeMenu();
    };

    private onContextMenuOpenClick = (e: ButtonEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLButtonElement;
        this.contextMenuPosition = target.getBoundingClientRect();
        this.updateSnapshot();
    };

    private onContextMenuCloseClick = (): void => {
        this.closeMenu();
    };

    private closeMenu = (): void => {
        this.contextMenuPosition = undefined;
        this.updateSnapshot();
    };

    private renderJumpToDateMenu(label: string): React.ReactElement {
        let contextMenu: React.ReactElement | undefined;
        if (this.contextMenuPosition) {
            const relativeTimeFormat = DateSeparatorViewModel.relativeTimeFormat;
            contextMenu = (
                <IconizedContextMenu
                    {...contextMenuBelow(this.contextMenuPosition)}
                    onFinished={this.onContextMenuCloseClick}
                >
                    <IconizedContextMenuOptionList first>
                        <IconizedContextMenuOption
                            label={capitalize(relativeTimeFormat.format(-1, "week"))}
                            onClick={this.pickLastWeek}
                            data-testid="jump-to-date-last-week"
                        />
                        <IconizedContextMenuOption
                            label={capitalize(relativeTimeFormat.format(-1, "month"))}
                            onClick={this.pickLastMonth}
                            data-testid="jump-to-date-last-month"
                        />
                        <IconizedContextMenuOption
                            label={_t("room|jump_to_date_beginning")}
                            onClick={this.pickTheBeginning}
                            data-testid="jump-to-date-beginning"
                        />
                    </IconizedContextMenuOptionList>

                    <IconizedContextMenuOptionList>
                        <JumpToDatePicker ts={this.props.ts} onDatePicked={this.onDatePicked} />
                    </IconizedContextMenuOptionList>
                </IconizedContextMenu>
            );
        }

        return (
            <ContextMenuTooltipButton
                data-testid="jump-to-date-separator-button"
                onClick={this.onContextMenuOpenClick}
                isExpanded={Boolean(this.contextMenuPosition)}
                title={_t("room|jump_to_date")}
            >
                <h2 aria-hidden="true">{label}</h2>
                <ChevronDownIcon />
                {contextMenu}
            </ContextMenuTooltipButton>
        );
    }
}
