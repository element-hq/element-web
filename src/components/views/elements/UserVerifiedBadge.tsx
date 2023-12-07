import React from "react";

import { Icon as VerifiedIcon } from "../../../../res/themes/superhero/img/icons/verified.svg";
import { useVerifiedUser } from "../../../hooks/useVerifiedUser";

export interface UserVerifiedBadgeProps {
    userId: string;
}

export const UserVerifiedBadge = ({ userId }: UserVerifiedBadgeProps): JSX.Element => {
    const isVerifiedUser = useVerifiedUser(userId);

    return <>{isVerifiedUser && <VerifiedIcon className="sh_VerifiedIcon" />}</>;
};
