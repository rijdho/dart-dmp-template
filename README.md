# dart-dmp-template

A short data management plan template for projects at IT:U, as a page that runs in the browser.
It is a draft prepared by DART and has not been adopted as IT:U policy.

Language: English.

## What the page asks for

- The plan: title, contact person (name, e-mail, ORCID iD) and whether there are ethical issues.
- The project: title, dates, funder, grant number and funding status.
- The datasets: one entry each, with the core fields only.
- The fifteen questions of Science Europe's core requirements for data management plans, each
  with Science Europe's guidance.

A new plan records IT:U, with its ROR ID, as the affiliation of the contact.

## What it gives back

- The plan as a Markdown document, in the sections of the Horizon Europe template or in Science
  Europe's.
- `dmp.json`, the same plan in the RDA DMP Common Standard v1.2. A `dmp.json` can be opened
  again to continue.

The page sends the plan nowhere. A draft is kept in the browser's local storage, and the page's
Content-Security-Policy names no host the page may connect to.

## How it is built

The page is built on [Actionable DMP](https://doi.org/10.5281/zenodo.23498569). The modules
for the questions, the plan file and its validation (`src/requirements.js`, `src/plan.js`,
`src/jsonschema.js`, `src/madmp-schema.js`, `src/i18n/index.js`) and the two schemas are copied
unchanged from its commit 86eff52; `tests/upstream.lock.json` holds their hashes and a test
compares them. Written for this page: `index.html`, `style.css`, `src/itu.js`, `src/theme-boot.js` and the
IT:U texts in `src/i18n/en.js`; `src/app.js` is a shortened version of Actionable DMP's.

Compared with Actionable DMP, the page leaves out the fields for the plan's language and
identifier, the optional dataset fields, the plan-level detail (contributors, costs), saved
versions, the comparison of two plans and the check of a plan against deposits.

There is no build step. To run it locally:

```sh
python3 -m http.server 8000
```

and open `http://localhost:8000/`. To run the tests (written and run with Node 24):

```sh
node --test tests/*.test.mjs
```

## License

The code is under the MIT License (`LICENSE`); the texts are under CC BY 4.0. `NOTICE` lists
what comes from Actionable DMP, from Science Europe and from the RDA DMP Common Standard, and
under which terms.

## Citation

If you use this template, please cite it: see `CITATION.cff`.
