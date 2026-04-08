/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { DateSeparatorViewModel } from "@element-hq/web-shared-components";

export type TimelineModelItem =
    | {
          key: string;
          kind: "event";
      }
    | {
          key: string;
          kind: "read-marker";
      }
    | {
          key: string;
          kind: "loading";
      }
    | {
          key: string;
          kind: "gap";
      }
    | {
          key: string;
          kind: "date-separator";
          vm: DateSeparatorViewModel;
      };
