import React from "react";
import { type RoomMember, type Room } from "matrix-js-sdk/src/matrix";
import { textualPowerLevel } from "../../../../Roles";
import PowerSelector from "../../elements/PowerSelector";
import { type IRoomPermissions } from "../UserInfo";
import { UserInfoPowerLevelState, useUserInfoAdminPowerlevelViewModel } from "../../../viewmodels/right_panel/admin/UserInfoAdminPowerlevelViewModel";

export const PowerLevelSection: React.FC<{
    user: RoomMember;
    room: Room;
    roomPermissions: IRoomPermissions;
}> = ({ user, room, roomPermissions }) => {
    const vm = useUserInfoAdminPowerlevelViewModel(user, room);

    if (roomPermissions.canEdit) {
        return <PowerLevelEditor vm={vm} roomPermissions={roomPermissions} />;
    }

    const powerLevel = user.powerLevel;
    const role = textualPowerLevel(powerLevel, vm.powerLevelUsersDefault);
    return (
        <div className="mx_UserInfo_profileField">
            <div className="mx_UserInfo_roleDescription">{role}</div>
        </div>
    );
};

const PowerLevelEditor: React.FC<{
    vm: UserInfoPowerLevelState;
    roomPermissions: IRoomPermissions;
}> = ({ vm, roomPermissions }) => {
    return (
        <div className="mx_UserInfo_profileField">
            <PowerSelector
                label={undefined}
                value={vm.selectedPowerLevel}
                maxValue={roomPermissions.modifyLevelMax}
                usersDefault={vm.powerLevelUsersDefault}
                onChange={vm.onPowerChange}
            />
        </div>
    );
};
