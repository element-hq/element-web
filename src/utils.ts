import { MatrixClient, RoomMember, User } from "matrix-js-sdk/src/matrix";
import { DirectoryMember, startDmOnFirstMessage } from "matrix-react-sdk/src/utils/direct-messages";

import { Member } from "./components/views/right_panel/UserInfo";
import { BareUser } from "./atoms";

export async function openDmForUser(matrixClient: MatrixClient, user: Member | BareUser): Promise<void> {
    const avatarUrl = user instanceof User ? user.avatarUrl : user instanceof RoomMember ? user.getMxcAvatarUrl() : "";
    const startDmUser = new DirectoryMember({
        user_id: user.userId,
        display_name: user.rawDisplayName,
        avatar_url: avatarUrl,
    });
    await startDmOnFirstMessage(matrixClient, [startDmUser]);
}
