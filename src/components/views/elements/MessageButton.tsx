import React, { useContext, useState } from "react";
import MatrixClientContext from "matrix-react-sdk/src/contexts/MatrixClientContext";
import AccessibleButton from "matrix-react-sdk/src/components/views/elements/AccessibleButton";
import { useAtom } from "jotai";

import { Member } from "../right_panel/UserInfo";
import { Icon as SendMessage } from "../../../../res/themes/superhero/img/icons/send.svg";
import { BareUser, botAccountsAtom } from "../../../atoms";
import { openDmForUser } from "../../../utils";

/**
 * Converts the member to a DirectoryMember and starts a DM with them.
 */

export const MessageButton = ({
    member,
    text = "Send Message",
}: {
    member: Member | BareUser;
    text?: string;
}): JSX.Element => {
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

export const MessageCommunityBotButton = ({ text = "Send Message" }: { text?: string }): JSX.Element => {
    const [botAccounts] = useAtom(botAccountsAtom);

    const botUser = {
        userId: botAccounts?.communityBot || "",
        rawDisplayName: "Community Bot",
    } as Member;

    return <MessageButton member={botUser} text={text} />;
};
