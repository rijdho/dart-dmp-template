# Next

State on 2026-11-10: version 0.1.0, a first draft. The repository is local, with no remote, and
the page is not published anywhere.

## What exists

- The page (`index.html`): the plan, the project, the datasets with their core fields, the
  fifteen questions, and three downloads.
- Fourteen tests in `tests/page.test.mjs`, all passing on 2026-11-10.
- Tried in a browser on 2026-11-10 from a local server: a filled plan was valid, the three
  downloads were produced, and the policy blocked a request to another host, an external
  stylesheet and an inline script. Opening a `dmp.json` and the two-click buttons were not
  tried in the browser.

## Open decisions

- Where the repository lives and under which name, and whether the page is published with
  GitHub Pages. The page needs no build: Pages can serve the branch root (`.nojekyll` is there).
- Once the repository has an address: add it to the signature in the rail, to `CITATION.cff`
  (`repository-code`) and to the README.
- `dmp.json` names the schema of Actionable DMP's extension in its `$schema` field, at that
  tool's own address, because `src/plan.js` is used unchanged. Decide whether an IT:U page
  should keep that.
- Whether the plan should also download as a Word file.
- Whether IT:U guidance (storage, repository, the ethics committee) is added under the
  questions. None is there now: the guidance shown is Science Europe's.
- Review of the questions and the dataset fields by DART and by researchers who have written
  a plan.

## Updating from Actionable DMP

Copy the seven files listed in `tests/upstream.lock.json` from the new commit, update the
hashes and the commit there, bring over any new catalogue key the page uses, and run the tests.
