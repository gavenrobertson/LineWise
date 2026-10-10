# Unverified device templates

LineWise never invents hardware specifications (FR-TPL-03). A vendor-model template is
`"verified": true` only when its port layout was checked against a public datasheet linked in its
`sourceUrl`. A template that has not been checked yet ships with `"verified": false` and is
listed here until someone verifies it.

A test (`packages/device-library/test/library.test.ts`) fails if this table and the template files
disagree.

## How to verify a template

1. Open the vendor's public datasheet for the exact model.
2. Compare every interface range, type and speed in the template with the datasheet.
3. Set `sourceUrl` to the datasheet and `verified` to `true`, and remove the row below.
4. In the pull request, quote the datasheet table or section you checked.

## Templates awaiting verification

| Template | Vendor and model | What needs checking |
| -------- | ---------------- | ------------------- |

No vendor-model templates are unverified. The built-in generic templates (`generic/…`) describe no
real product, so they need no datasheet.
