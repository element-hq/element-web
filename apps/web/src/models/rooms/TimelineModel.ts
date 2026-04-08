/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { MatrixEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import type { DateSeparatorViewModel } from "@element-hq/web-shared-components";

export type TimelineModelItem =
    | {
          key: string;
          kind: "event";
      }
    | {
          key: string;
          kind: "virtual";
          type: "read-marker";
      }
    | {
          key: string;
          kind: "virtual";
          type: "loading";
      }
    | {
          key: string;
          kind: "virtual";
          type: "new-room";
      }
    | {
          key: string;
          kind: "virtual";
          type: "gap";
      }
    | {
          key: string;
          kind: "virtual";
          type: "date-separator";
          vm: DateSeparatorViewModel;
      }
    | {
          key: string;
          kind: "group";
          type: "room-creation";
          events: MatrixEvent[];
          summaryText: string;
          summaryMembers?: RoomMember[];
      };
