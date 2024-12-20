# Verji Merge Notes - December 2024
I found it necessary to include a note file, to document the process where I am attempting to:
- Update our Element-web fork (big update)
  - This includes the huge change where matrix-react-sdk was absorbed by element-web
  - Ensure Verji-customisations are included

## Documenting & Planning

After spending some time looking into the available documentation about how Element managed and conducted the absorbtion of matrix-react-sdk into element-web.
See: [Task #2125 - Discover/Understand Elements Process of Merging matrix-react-sdk Into element-web](https://dev.azure.com/rosbergas/VerjiKanban/_boards/board/t/VerjiKanban%20Team/Issues?workitem=2125)
[test](https://vg.no)

As we have some different challanges than element, namely make sure our own customisations, which is a layer on top of matrix-react-sdk, and a layer on top of element-web.
Our Verji-customisations, have been tracked in forks of their Upstream counterparts, and in our custom branches. 

In the Task: [#2148 Explore Merge Strategies to get our Verji-Element Up to date](https://dev.azure.com/rosbergas/VerjiKanban/_boards/board/t/VerjiKanban%20Team/Issues?workitem=2148)
I start exploring different possibilities, on how to achive our desired goal.

We decided to go for a "hybrid" of the initial 2 suggetions:
- Two step rocket?
    - Absorb our fork matrix-react-sdk into our fork element-web
    - Then handle the upgrade / sync to upstream?
- New Fork?
    - Start from working new fresh fork
    - Manually add customisations?

- Hybrid 
    - Start from working new fresh fork
    - merge in our customisations from our previous matrix-react-sdk fork on top

## The Process
As mention we pursued an hybrid approach, New Forks + merge matrix-react-sdk fork on top.

### 1. New Forks
I created new fresh forks on all the repos involved and added suffix (v2)
- [element-web-v2](https://github.com/verji/element-web-v2/tree/verji-develop)
- [matrix-js-sdk-v2](https://github.com/verji/matrix-js-sdk-v2)

To verify that the forks were stable and working, spun up the client locally. Everything worked like a charm.

### 2. Prepping for Merger of our matrix-react-sdk
I cloned the repositores into a new workspace/work folder and created a new branch to be able to safely abort if anyhing went wrong

1. `mkdir fresh-fork`
2. `cd fresh-fork`
3. `git clone https://github.com/verji/element-web-v2`
4. `git clone https://github.com/verji/matrix-js-sdk-v2`
5. `https://github.com/verji/matrix-react-sdk`
6. `cd element-web`
7. `checkout -b verji-merge-react-sdk`
8. `git remote add -f matrix-react-sdk ../matrix-react-sdk`

### 3. The Merger
Once the project had been set up, and prepared, the next step was to merge in our fork for matrix-react-sdk

- `git merge matrix-react-sdk/verji-develop --allow-unrelated-histories --no-commit`

Instantly I can tell that this merger is much more managable than previous attempts
Looks like most of our customisations are detected, and easily manually solveable. 

Some cases may turn out to require a bit more attention. In cases were components or functionality have been removed, heavily altered or similar. But this is something that we would have to solve regardless. 

I'll attempt to document the files and areas which may need more attention. 

## Config & .git Files(workflows)
There are large changes in most .git-workflows and action files. 
So I think we most likely will have to re-visit these - as we've done previously. To make sure the automatic actions are running to our liking. 
We might have to disable checks, and automations that doesen't make sense for us, and incorporate the workflows we wish to keep and or customise. 

## Deleted Files
### Deleted Components
Deleted components from Upstream, but existing in our version. 
I will denote each file with:
- ✅ - Keep file (I'll keep file which has custom Verji-Code / feature flags and document FF'appears in file.)
- ❌ - File deleted (If we don't have any customisations in them, I'll delete)
- RoomContextMenu.tsx ✅
    - UIFeature.RoomSummaryFilesOption
    - SettingsStore.getValue(UIFeature.ShowAddWidgetsInRoomInfo)
- Tooltip.tsx ❌
- LegacyRoomHeader.tsx ✅
    - CustomComponentLifecycle.LegacyRoomHeader
- SearchBar.tsx ✅
    - SettingsStore.getValue(UIFeature.SearchInAllRooms)
- EmailAddresses.tsx ✅
    - SettingsStore.getValue(UIFeature.EmailAddressShowRemoveButton)
    - SettingsStore.getValue(UIFeature.EmailAddressShowAddButton)
- PhoneNumbers.tsx ✅
    - UIFeature.PhoneNumerShowRemoveButton
    - SettingsStore.getValue(UIFeature.PhoneNumerShowAddButton)
- GeneralUserSettingsTab.tsx✅
    - SettingsStore.getValue(UIFeature.UserSettingsExternalAccount)
    - SettingsStore.getValue(UIFeature.UserSettingsChangePassword)
    - SettingsStore.getValue(UIFeature.UserSettingsSetIdServer)
    - SettingsStore.getValue(UIFeature.UserSettingsDiscovery)
    - SettingsStore.getValue(UIFeature.UserSettingsIntegrationManager)
### Deleted Test Files
Deleted or moved tests from Upstream, but existing in our version. 
I will denote each file with:
- ✅ - Keep file (I'll keep file which has custom Verji-tests)
- ❌ - File deleted (If we don't have any custom verji tests in them, I'll delete)

- DeviceListener-test.ts        ✅
- MatrixClientPeg-test.ts       ✅
- LeftPanel-test.tsx            ✅
- LoggedInView-test.tsx         ✅
- MatrixChat-test.tsx           ✅
- MessagePanel-test.tsx         ✅
- RoomView-test.tsx             ✅
- ViewSource-test.tsx           ❌
- Login-test.tsx                ✅
- MessageContextMenu-test.tsx   ✅
- RoomContextMenu-test.tsx      ✅
- SpaceContextMenu-test.tsx     ✅
- CreateRoomDialog-test.tsx     ✅
- ExportDialog-test.tsx         ✅
- InviteDialog-test.tsx         ✅
- RoomSettingsDialog-test.tsx   ✅
- UserSettingsDialog-test.tsx   ✅
- PowerSelector-test.tsx        ✅
- RoomSummaryCard-test.tsx      ✅
- UserInfo-test.tsx             ✅
- LegacyRoomHeader-test.tsx     ✅
- MessageComposer-test.tsx      ✅
- RoomKnocksBar-test.tsx        ✅
- RoomList-test.tsx             ✅
- RoomListHeader-test.tsx       ✅
- RoomPreviewBar-test.tsx       ✅
- SendMessageComposer-test.tsx  ❌
- WysiwygComposer-test.tsx      ❌
- CrossSigningPanel-test.tsx    ✅
- SecureBacupPanel-test.tsx     ✅
- ThemeChoicePanel-test.tsx     ✅
- PhoneNumbers-test.tsx         ✅
- PeopleRoomSettingsTab-test.tsx❌
- GeneralUserSettingsTab-test.tsx ✅
- PreferenceUserSettingsTab-test.tsx✅
- SecurityUserSettingsTab-test.tsx✅
- SidebarUserSettingsTab-test.tsx❌
- VoiceUserSettingsTab-test.tsx ✅
- SpacePanel-test.tsx           ✅
- MockModule.ts                 ✅
- ModuleRunner-test.ts          ✅
- StopGapWidget-test.ts         ❌
- StopGapWidgetDriver-test.ts   ❌
