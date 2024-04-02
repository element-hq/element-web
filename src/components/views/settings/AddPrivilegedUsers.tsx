/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { FormEvent, useCallback, useContext, useRef, useState } from "react";
import { Room, EventType } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { ICompletion } from "../../../autocomplete/Autocompleter";
import UserProvider from "../../../autocomplete/UserProvider";
import { AutocompleteInput } from "../../structures/AutocompleteInput";
import PowerSelector from "../elements/PowerSelector";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AccessibleButton from "../elements/AccessibleButton";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import SettingsFieldset from "./SettingsFieldset";

interface AddPrivilegedUsersProps {
    room: Room;
    defaultUserLevel: number;
}

export const AddPrivilegedUsers: React.FC<AddPrivilegedUsersProps> = ({ room, defaultUserLevel }) => {
    const client = useContext(MatrixClientContext);
    const userProvider = useRef(new UserProvider(room));
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [powerLevel, setPowerLevel] = useState<number>(defaultUserLevel);
    const [selectedUsers, setSelectedUsers] = useState<ICompletion[]>([]);
    const hasLowerOrEqualLevelThanDefaultLevelFilter = useCallback(
        (user: ICompletion) => hasLowerOrEqualLevelThanDefaultLevel(room, user, defaultUserLevel),
        [room, defaultUserLevel],
    );

    const onSubmit = async (event: FormEvent): Promise<void> => {
        event.preventDefault();
        setIsLoading(true);

        const userIds = getUserIdsFromCompletions(selectedUsers);
        const powerLevelEvent = room.currentState.getStateEvents(EventType.RoomPowerLevels, "");

        // `RoomPowerLevels` event should exist, but technically it is not guaranteed.
        if (powerLevelEvent === null) {
            Modal.createDialog(ErrorDialog, {
                title: _t("common|error"),
                description: _t("error|update_power_level"),
            });

            return;
        }

        try {
            await client.setPowerLevel(room.roomId, userIds, powerLevel);
            setSelectedUsers([]);
            setPowerLevel(defaultUserLevel);
        } catch (error) {
            Modal.createDialog(ErrorDialog, {
                title: _t("common|error"),
                description: _t("error|update_power_level"),
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form style={{ display: "flex" }} onSubmit={onSubmit}>
            <SettingsFieldset
                legend={_t("room_settings|permissions|add_privileged_user_heading")}
                description={_t("room_settings|permissions|add_privileged_user_description")}
                style={{ flexGrow: 1 }}
            >
                <AutocompleteInput
                    provider={userProvider.current}
                    placeholder={_t("room_settings|permissions|add_privileged_user_filter_placeholder")}
                    onSelectionChange={setSelectedUsers}
                    selection={selectedUsers}
                    additionalFilter={hasLowerOrEqualLevelThanDefaultLevelFilter}
                />
                <PowerSelector value={powerLevel} onChange={setPowerLevel} />
                <AccessibleButton
                    type="submit"
                    element="button"
                    kind="primary"
                    disabled={!selectedUsers.length || isLoading}
                    onClick={null}
                    data-testid="add-privileged-users-submit-button"
                >
                    {_t("action|apply")}
                </AccessibleButton>
            </SettingsFieldset>
        </form>
    );
};

export const hasLowerOrEqualLevelThanDefaultLevel = (
    room: Room,
    user: ICompletion,
    defaultUserLevel: number,
): boolean => {
    if (user.completionId === undefined) {
        return false;
    }

    const member = room.getMember(user.completionId);

    if (member === null) {
        return false;
    }

    return member.powerLevel <= defaultUserLevel;
};

export const getUserIdsFromCompletions = (completions: ICompletion[]): string[] => {
    const completionsWithId = completions.filter((completion) => completion.completionId !== undefined);

    // undefined completionId's are filtered out above but TypeScript does not seem to understand.
    return completionsWithId.map((completion) => completion.completionId!);
};
