# @element-hq/element-web-module-banner

Banner module for Element Web.
Allows rendering a top bar with slide out left panel menu.

Supports the following configuration options:

| Key           | Type   | Description                                                  |
| ------------- | ------ | ------------------------------------------------------------ |
| logo_url      | string | URL to the logo to render in the banner                      |
| logo_link_url | string | URL to send the user to when clicking the logo in the banner |
| menu          | `Menu` | Data to render in the banner menu                            |

The `Menu` type is fulfilled by the following discriminated union:

### Univention menu

| Key     | Type         | Description                                                                                                              |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| type    | "univention" | The type for this menu config                                                                                            |
| ics_url | string       | URL to the UCS Intercom Service, https://docs.software-univention.de/intercom-service/latest/architecture.html#endpoints |

### Static menu

| Key        | Type             | Description                                                               |
| ---------- | ---------------- | ------------------------------------------------------------------------- |
| type       | "static"         | The type for this menu config                                             |
| logo_url   | string, optional | URL to the logo to render in the menu, defaults to banner logo if omitted |
| categories | `[]Category`     | Categories to render in the menu                                          |

The `Category` type is fulfilled by the following interface:

| Key   | Type     | Description                      |
| ----- | -------- | -------------------------------- |
| name  | string   | The name of this category        |
| links | `[]Link` | Links to render in this category |

The `Link` type is fulfilled by the following interface:

| Key      | Type             | Description                             |
| -------- | ---------------- | --------------------------------------- |
| icon_uri | string           | URL to the icon to render for this link |
| name     | string           | The name to render for this link        |
| link_url | string           | The URL to link to                      |
| target   | string, optional | The `target` to use for this link       |
