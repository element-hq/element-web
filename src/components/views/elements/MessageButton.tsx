import React, { useContext, useState } from "react";
import MatrixClientContext from "matrix-react-sdk/src/contexts/MatrixClientContext";
import AccessibleButton from "matrix-react-sdk/src/components/views/elements/AccessibleButton";
import { Member } from "../right_panel/UserInfo";
import { Icon as SendMessage } from "../../../../res/themes/superhero/img/icons/send.svg";
import { MatrixClient, RoomMember, User } from "matrix-js-sdk/src/matrix";
import { DirectoryMember, startDmOnFirstMessage } from "matrix-react-sdk/src/utils/direct-messages";

import { BareUser } from "../../../atoms";
/**
 * Converts the member to a DirectoryMember and starts a DM with them.
 */
async function openDmForUser(matrixClient: MatrixClient, user: Member | BareUser): Promise<void> {
    const avatarUrl = user instanceof User ? user.avatarUrl : user instanceof RoomMember ? user.getMxcAvatarUrl() : '';
    const startDmUser = new DirectoryMember({
        user_id: user.userId,
        display_name: user.rawDisplayName,
        avatar_url: avatarUrl,
    });
    await startDmOnFirstMessage(matrixClient, [startDmUser]);
}

export const MessageButton = ({ member, text = 'Send Message' }: { member: Member | BareUser, text?: string }): JSX.Element => {
    const cli = useContext(MatrixClientContext);
    const [busy, setBusy] = useState(false);

    return (
        <AccessibleButton
            kind="primary"
            onClick={async (): Promise<void> => {
                if (busy) return;
                setBusy(true);
                await openDmForUser(cli, member);
                setBusy(false);
            }}
            className="mx_UserInfo_field"
            disabled={busy}
        >
            <SendMessage width="16px" height="16px" />
            <span style={{ marginLeft: "5px" }}>{text}</span>
        </AccessibleButton>
    );
};
