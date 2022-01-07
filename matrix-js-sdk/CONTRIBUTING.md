Contributing code to matrix-js-sdk
==================================

Everyone is welcome to contribute code to matrix-js-sdk, provided that they are
willing to license their contributions under the same license as the project
itself. We follow a simple 'inbound=outbound' model for contributions: the act
of submitting an 'inbound' contribution means that the contributor agrees to
license the code under the same terms as the project's overall 'outbound'
license - in this case, Apache Software License v2 (see
[LICENSE](LICENSE)).

How to contribute
-----------------

The preferred and easiest way to contribute changes to the project is to fork
it on github, and then create a pull request to ask us to pull your changes
into our repo (https://help.github.com/articles/using-pull-requests/)

We use GitHub's pull request workflow to review the contribution, and either
ask you to make any refinements needed or merge it and make them ourselves.

Things that should go into your PR description:
 * A changelog entry in the `Notes` section (see below)
 * References to any bugs fixed by the change (in GitHub's `Fixes` notation)
 * Describe the why and what is changing in the PR description so it's easy for
   onlookers and reviewers to onboard and context switch.
 * Include both **before** and **after** screenshots to easily compare and discuss
   what's changing.
 * Include a step-by-step testing strategy so that a reviewer can check out the
   code locally and easily get to the point of testing your change.
 * Add comments to the diff for the reviewer that might help them to understand
   why the change is necessary or how they might better understand and review it.

Things that should *not* go into your PR description:
 * Any information on how the code works or why you chose to do it the way
   you did. If this isn't obvious from your code, you haven't written enough
   comments.

We rely on information in pull request to populate the information that goes
into the changelogs our users see, both for the JS SDK itself and also for some
projects based on it. This is picked up from both labels on the pull request and
the `Notes:` annotation in the description. By default, the PR title will be
used for the changelog entry, but you can specify more options, as follows.

To add a longer, more detailed description of the change for the changelog:


*Fix llama herding bug*

```
Notes: Fix a bug (https://github.com/matrix-org/notaproject/issues/123) where the 'Herd' button would not herd more than 8 Llamas if the moon was in the waxing gibbous phase
```

For some PRs, it's not useful to have an entry in the user-facing changelog (this is
the default for PRs labelled with `T-Task`):

*Remove outdated comment from `Ungulates.ts`*
```
Notes: none
```

Sometimes, you're fixing a bug in a downstream project, in which case you want
an entry in that project's changelog. You can do that too:

*Fix another herding bug*
```
Notes: Fix a bug where the `herd()` function would only work on Tuesdays
element-web notes: Fix a bug where the 'Herd' button only worked on Tuesdays
```

This example is for Element Web. You can specify:
 * matrix-react-sdk
 * element-web
 * element-desktop

If your PR introduces a breaking change, use the `Notes` section in the same
way, additionally adding the `X-Breaking-Change` label (see below). There's no need
to specify in the notes that it's a breaking change - this will be added
automatically based on the label - but remember to tell the developer how to
migrate:

*Remove legacy class*

```
Notes: Remove legacy `Camelopard` class. `Giraffe` should be used instead.
```

Other metadata can be added using labels.
 * `X-Breaking-Change`: A breaking change - adding this label will mean the change causes a *major* version bump.
 * `T-Enhancement`: A new feature - adding this label will mean the change causes a *minor* version bump.
 * `T-Defect`: A bug fix (in either code or docs).
 * `T-Task`: No user-facing changes, eg. code comments, CI fixes, refactors or tests. Won't have a changelog entry unless you specify one.

If you don't have permission to add labels, your PR reviewer(s) can work with you
to add them: ask in the PR description or comments.

We use continuous integration, and all pull requests get automatically tested:
if your change breaks the build, then the PR will show that there are failed
checks, so please check back after a few minutes.

Tests
-----
If your PR is a feature (ie. if it's being labelled with the 'T-Enhancement'
label) then we require that the PR also includes tests. These need to test that
your feature works as expected and ideally test edge cases too. For the js-sdk
itself, your tests should generally be unit tests. matrix-react-sdk also uses
these guidelines, so for that your tests can be unit tests using
react-test-utils, snapshot tests or screenshot tests.

We don't require tests for bug fixes (T-Defect) but strongly encourage regression
tests for the bug itself wherever possible.

In the future we may formalise this more with a minimum test coverage
percentage for the diff.

Code style
----------
The js-sdk aims to target TypeScript/ES6. All new files should be written in
TypeScript and existing files should use ES6 principles where possible.

Members should not be exported as a default export in general - it causes problems
with the architecture of the SDK (index file becomes less clear) and could
introduce naming problems (as default exports get aliased upon import). In
general, avoid using `export default`.

The remaining code-style for matrix-js-sdk is not formally documented, but
contributors are encouraged to read the
[code style document for matrix-react-sdk](https://github.com/matrix-org/matrix-react-sdk/blob/master/code_style.md)
and follow the principles set out there.

Please ensure your changes match the cosmetic style of the existing project,
and ***never*** mix cosmetic and functional changes in the same commit, as it
makes it horribly hard to review otherwise.

Attribution
-----------
Everyone who contributes anything to Matrix is welcome to be listed in the
AUTHORS.rst file for the project in question. Please feel free to include a
change to AUTHORS.rst in your pull request to list yourself and a short
description of the area(s) you've worked on. Also, we sometimes have swag to
give away to contributors - if you feel that Matrix-branded apparel is missing
from your life, please mail us your shipping address to matrix at matrix.org
and we'll try to fix it :)

Sign off
--------
In order to have a concrete record that your contribution is intentional
and you agree to license it under the same terms as the project's license, we've
adopted the same lightweight approach that the Linux Kernel
(https://www.kernel.org/doc/Documentation/SubmittingPatches), Docker
(https://github.com/docker/docker/blob/master/CONTRIBUTING.md), and many other
projects use: the DCO (Developer Certificate of Origin:
http://developercertificate.org/). This is a simple declaration that you wrote
the contribution or otherwise have the right to contribute it to Matrix:

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
660 York Street, Suite 102,
San Francisco, CA 94110 USA

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

If you agree to this for your contribution, then all that's needed is to
include the line in your commit or pull request comment:

```
Signed-off-by: Your Name <your@email.example.org>
```

We accept contributions under a legally identifiable name, such as your name on
government documentation or common-law names (names claimed by legitimate usage
or repute). Unfortunately, we cannot accept anonymous contributions at this
time.

Git allows you to add this signoff automatically when using the `-s` flag to
`git commit`, which uses the name and email set in your `user.name` and
`user.email` git configs.

If you forgot to sign off your commits before making your pull request and are
on Git 2.17+ you can mass signoff using rebase:

```
git rebase --signoff origin/develop
```
